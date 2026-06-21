//! Per-deployment SLI tracking and SLO gates for `call_llm_routed` (F56).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const SLI_WINDOW_SECONDS: u64 = 300;
pub const SLI_MAX_OBSERVATIONS: usize = 50;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DeploymentObservation {
    pub success: bool,
    #[serde(rename = "latencyMs")]
    pub latency_ms: u64,
    #[serde(rename = "ttftMs", default, skip_serializing_if = "Option::is_none")]
    pub ttft_ms: Option<u64>,
    #[serde(rename = "observedAtUnix")]
    pub observed_at_unix: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct DeploymentSliStats {
    pub observations: Vec<DeploymentObservation>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SloThresholds {
    pub max_p95_latency_ms: u64,
    pub max_error_rate: f64,
    pub min_samples_to_gate: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WindowMetrics {
    pub sample_count: u32,
    pub error_rate: f64,
    pub p95_latency_ms: u64,
}

pub fn slo_for_alias(alias: &str) -> SloThresholds {
    match alias {
        "pm-fast" => SloThresholds {
            max_p95_latency_ms: 3000,
            max_error_rate: 0.15,
            min_samples_to_gate: 5,
        },
        "pm-reasoning" => SloThresholds {
            max_p95_latency_ms: 30000,
            max_error_rate: 0.15,
            min_samples_to_gate: 3,
        },
        "pm-local" => SloThresholds {
            max_p95_latency_ms: 8000,
            max_error_rate: 0.10,
            min_samples_to_gate: 3,
        },
        _ => SloThresholds {
            max_p95_latency_ms: 12000,
            max_error_rate: 0.20,
            min_samples_to_gate: 5,
        },
    }
}

pub fn prune_observations(
    observations: &[DeploymentObservation],
    now_unix: u64,
    window_seconds: u64,
) -> Vec<DeploymentObservation> {
    let cutoff = now_unix.saturating_sub(window_seconds);
    observations
        .iter()
        .filter(|o| o.observed_at_unix >= cutoff)
        .cloned()
        .collect()
}

pub fn compute_window_metrics(
    stats: &DeploymentSliStats,
    now_unix: u64,
    window_seconds: u64,
) -> WindowMetrics {
    let observations = prune_observations(&stats.observations, now_unix, window_seconds);
    if observations.is_empty() {
        return WindowMetrics {
            sample_count: 0,
            error_rate: 0.0,
            p95_latency_ms: 0,
        };
    }

    let failures = observations.iter().filter(|o| !o.success).count();
    let mut success_latencies: Vec<u64> = observations
        .iter()
        .filter(|o| o.success)
        .map(|o| o.latency_ms)
        .collect();
    success_latencies.sort_unstable();

    let latencies = if success_latencies.is_empty() {
        let mut all: Vec<u64> = observations.iter().map(|o| o.latency_ms).collect();
        all.sort_unstable();
        all
    } else {
        success_latencies
    };

    let p95_index = latencies
        .len()
        .saturating_sub(1)
        .min(((latencies.len() as f64 * 0.95).ceil() as usize).saturating_sub(1));

    WindowMetrics {
        sample_count: observations.len() as u32,
        error_rate: failures as f64 / observations.len() as f64,
        p95_latency_ms: latencies.get(p95_index).copied().unwrap_or(0),
    }
}

pub fn record_observation(
    stats: &mut DeploymentSliStats,
    observation: DeploymentObservation,
    now_unix: u64,
) {
    stats.observations.push(observation);
    stats.observations = prune_observations(&stats.observations, now_unix, SLI_WINDOW_SECONDS);
    if stats.observations.len() > SLI_MAX_OBSERVATIONS {
        let drop_count = stats.observations.len() - SLI_MAX_OBSERVATIONS;
        stats.observations.drain(0..drop_count);
    }
}

pub fn deployment_exceeds_slo(metrics: &WindowMetrics, slo: &SloThresholds) -> bool {
    if metrics.sample_count < slo.min_samples_to_gate {
        return false;
    }
    metrics.error_rate > slo.max_error_rate || metrics.p95_latency_ms > slo.max_p95_latency_ms
}

pub fn slo_breach_reason(metrics: &WindowMetrics, slo: &SloThresholds) -> String {
    if metrics.error_rate > slo.max_error_rate {
        return format!(
            "error rate {:.0}% exceeds SLO {:.0}%",
            metrics.error_rate * 100.0,
            slo.max_error_rate * 100.0
        );
    }
    if metrics.p95_latency_ms > slo.max_p95_latency_ms {
        return format!(
            "p95 latency {}ms exceeds SLO {}ms",
            metrics.p95_latency_ms, slo.max_p95_latency_ms
        );
    }
    "SLO threshold exceeded".to_string()
}

pub fn compute_health_score(metrics: &WindowMetrics, slo: &SloThresholds) -> u32 {
    if metrics.sample_count == 0 {
        return 75;
    }

    let latency_ratio = if slo.max_p95_latency_ms > 0 {
        (metrics.p95_latency_ms as f64 / slo.max_p95_latency_ms as f64).min(1.0)
    } else {
        0.0
    };
    let error_ratio = if slo.max_error_rate > 0.0 {
        (metrics.error_rate / slo.max_error_rate).min(1.0)
    } else {
        0.0
    };

    let penalty = latency_ratio * 45.0 + error_ratio * 45.0;
    (100.0 - penalty).max(0.0).round() as u32
}

#[derive(Clone)]
pub struct RankableCandidate {
    pub provider: String,
    pub model: Option<String>,
    pub original_index: usize,
}

pub fn rank_candidates_by_health(
    candidates: Vec<RankableCandidate>,
    deployments: &HashMap<String, DeploymentSliStats>,
    alias: &str,
    now_unix: u64,
) -> Vec<RankableCandidate> {
    let slo = slo_for_alias(alias);
    let mut ranked = candidates;
    ranked.sort_by(|a, b| {
        let a_id = deployment_id(&a.provider, a.model.as_deref().unwrap_or(""));
        let b_id = deployment_id(&b.provider, b.model.as_deref().unwrap_or(""));
        let a_metrics = compute_window_metrics(
            deployments.get(&a_id).unwrap_or(&DeploymentSliStats::default()),
            now_unix,
            SLI_WINDOW_SECONDS,
        );
        let b_metrics = compute_window_metrics(
            deployments.get(&b_id).unwrap_or(&DeploymentSliStats::default()),
            now_unix,
            SLI_WINDOW_SECONDS,
        );
        let a_score = compute_health_score(&a_metrics, &slo);
        let b_score = compute_health_score(&b_metrics, &slo);
        b_score
            .cmp(&a_score)
            .then_with(|| a.original_index.cmp(&b.original_index))
    });
    ranked
}

pub fn deployment_id(provider: &str, model: &str) -> String {
    format!("{provider}:{model}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: u64 = 1_720_000_000;

    fn obs(success: bool, latency_ms: u64, offset_sec: u64) -> DeploymentObservation {
        DeploymentObservation {
            success,
            latency_ms,
            ttft_ms: None,
            observed_at_unix: NOW - offset_sec,
        }
    }

    #[test]
    fn cold_start_does_not_gate() {
        let slo = slo_for_alias("pm-fast");
        let metrics = compute_window_metrics(
            &DeploymentSliStats {
                observations: vec![obs(true, 9000, 1), obs(true, 9500, 2)],
            },
            NOW,
            SLI_WINDOW_SECONDS,
        );
        assert!(!deployment_exceeds_slo(&metrics, &slo));
    }

    #[test]
    fn pm_fast_gates_high_latency() {
        let slo = slo_for_alias("pm-fast");
        let metrics = compute_window_metrics(
            &DeploymentSliStats {
                observations: vec![
                    obs(true, 4000, 10),
                    obs(true, 4500, 20),
                    obs(true, 5000, 30),
                    obs(true, 5500, 40),
                    obs(true, 6000, 50),
                ],
            },
            NOW,
            SLI_WINDOW_SECONDS,
        );
        assert!(deployment_exceeds_slo(&metrics, &slo));
    }

    #[test]
    fn pm_reasoning_tolerates_same_latency() {
        let slo = slo_for_alias("pm-reasoning");
        let metrics = compute_window_metrics(
            &DeploymentSliStats {
                observations: vec![
                    obs(true, 4000, 10),
                    obs(true, 4500, 20),
                    obs(true, 5000, 30),
                ],
            },
            NOW,
            SLI_WINDOW_SECONDS,
        );
        assert!(!deployment_exceeds_slo(&metrics, &slo));
    }

    #[test]
    fn ranks_healthier_candidate_first() {
        let mut deployments = HashMap::new();
        deployments.insert(
            "openai:gpt-4o".to_string(),
            DeploymentSliStats {
                observations: vec![
                    obs(false, 9000, 10),
                    obs(false, 9000, 20),
                    obs(false, 9000, 30),
                    obs(false, 9000, 40),
                    obs(false, 9000, 50),
                ],
            },
        );
        deployments.insert(
            "anthropic:claude-sonnet-4-6".to_string(),
            DeploymentSliStats {
                observations: vec![obs(true, 900, 10), obs(true, 800, 20), obs(true, 850, 30)],
            },
        );

        let ranked = rank_candidates_by_health(
            vec![
                RankableCandidate {
                    provider: "openai".to_string(),
                    model: Some("gpt-4o".to_string()),
                    original_index: 0,
                },
                RankableCandidate {
                    provider: "anthropic".to_string(),
                    model: Some("claude-sonnet-4-6".to_string()),
                    original_index: 1,
                },
            ],
            &deployments,
            "pm-fast",
            NOW,
        );
        assert_eq!(ranked[0].provider, "anthropic");
    }
}
