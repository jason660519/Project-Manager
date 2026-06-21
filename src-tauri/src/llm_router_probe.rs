//! Lightweight inference probes for Keys validation (F56 Slice 2).
//! Records baseline SLI observations into llm-router-state.json.

use std::time::Instant;

use serde::Serialize;

use crate::llm_router_sli::{self, DeploymentObservation};

#[derive(Serialize, Clone)]
pub struct ProbeProviderInferenceResult {
    pub ok: bool,
    pub model: String,
    #[serde(rename = "latencyMs")]
    pub latency_ms: u64,
    #[serde(rename = "ttftMs", skip_serializing_if = "Option::is_none")]
    pub ttft_ms: Option<u64>,
    #[serde(rename = "errorReason", skip_serializing_if = "Option::is_none")]
    pub error_reason: Option<String>,
}

pub async fn record_probe_sli(
    provider_id: &str,
    model: &str,
    success: bool,
    latency_ms: u64,
    ttft_ms: Option<u64>,
) -> Result<(), String> {
    let mut state = crate::read_llm_router_state().await;
    let now = crate::unix_now_secs();
    let dep_id = llm_router_sli::deployment_id(provider_id, model);
    llm_router_sli::record_observation(
        state.deployments.entry(dep_id).or_default(),
        DeploymentObservation {
            success,
            latency_ms,
            ttft_ms,
            observed_at_unix: now,
        },
        now,
    );
    crate::write_llm_router_state(&state).await
}

async fn probe_anthropic(api_key: &str, model: &str) -> Result<(u64, Option<u64>), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client init failed: {e}"))?;
    let started = Instant::now();

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 1,
        "stream": true,
        "messages": [{ "role": "user", "content": "ping" }],
    });

    let mut response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic {status}: {}", crate::truncate_error(&text)));
    }

    let mut ttft_ms = None;
    let mut buffer = String::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Stream read failed: {e}"))? {
        if ttft_ms.is_none() && !chunk.is_empty() {
            ttft_ms = Some(started.elapsed().as_millis() as u64);
        }
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        if buffer.contains("content_block_delta") || buffer.contains("\"text\"") {
            if ttft_ms.is_none() {
                ttft_ms = Some(started.elapsed().as_millis() as u64);
            }
            break;
        }
    }

    Ok((started.elapsed().as_millis() as u64, ttft_ms))
}

async fn probe_openai_compatible(
    api_key: &str,
    base_url: &str,
    model: &str,
) -> Result<(u64, Option<u64>), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client init failed: {e}"))?;
    let started = Instant::now();
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let is_openai = base_url.trim_end_matches('/') == "https://api.openai.com/v1";
    let token_key = if is_openai {
        "max_completion_tokens"
    } else {
        "max_tokens"
    };

    let mut body = serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": "ping" }],
        "stream": true,
    });
    if let Some(obj) = body.as_object_mut() {
        obj.insert(token_key.to_string(), serde_json::json!(1));
    }

    let mut response = client
        .post(&url)
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("{status}: {}", crate::truncate_error(&text)));
    }

    let mut ttft_ms = None;
    let mut buffer = String::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Stream read failed: {e}"))? {
        if ttft_ms.is_none() && !chunk.is_empty() {
            ttft_ms = Some(started.elapsed().as_millis() as u64);
        }
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        if buffer.contains("\"content\"") || buffer.contains("delta") {
            if ttft_ms.is_none() {
                ttft_ms = Some(started.elapsed().as_millis() as u64);
            }
            break;
        }
    }

    Ok((started.elapsed().as_millis() as u64, ttft_ms))
}

async fn probe_gemini(api_key: &str, model: &str) -> Result<(u64, Option<u64>), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client init failed: {e}"))?;
    let started = Instant::now();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        model
    );
    let body = serde_json::json!({
        "contents": [{ "parts": [{ "text": "ping" }] }],
        "generationConfig": { "maxOutputTokens": 1 },
    });

    let res = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Gemini {status}: {}", crate::truncate_error(&text)));
    }

    let latency_ms = started.elapsed().as_millis() as u64;
    Ok((latency_ms, Some(latency_ms)))
}

pub async fn run_probe_inference(
    api_kind: &str,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
) -> ProbeProviderInferenceResult {
    if api_key.trim().is_empty() {
        return ProbeProviderInferenceResult {
            ok: false,
            model: model.to_string(),
            latency_ms: 0,
            ttft_ms: None,
            error_reason: Some("API key is empty".to_string()),
        };
    }

    let probe_result = match api_kind {
        "anthropic" => probe_anthropic(api_key, model).await,
        "openai-compatible" => {
            let base = match base_url {
                Some(v) if !v.trim().is_empty() => v,
                _ => {
                    return ProbeProviderInferenceResult {
                        ok: false,
                        model: model.to_string(),
                        latency_ms: 0,
                        ttft_ms: None,
                        error_reason: Some("openai-compatible requires base_url".to_string()),
                    };
                }
            };
            probe_openai_compatible(api_key, base, model).await
        }
        "gemini" => probe_gemini(api_key, model).await,
        _ => Err(format!("Unsupported probe api_kind: {api_kind}")),
    };

    match probe_result {
        Ok((latency_ms, ttft_ms)) => ProbeProviderInferenceResult {
            ok: true,
            model: model.to_string(),
            latency_ms,
            ttft_ms,
            error_reason: None,
        },
        Err(reason) => ProbeProviderInferenceResult {
            ok: false,
            model: model.to_string(),
            latency_ms: 0,
            ttft_ms: None,
            error_reason: Some(reason),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_result_serializes_camel_case() {
        let raw = serde_json::to_value(ProbeProviderInferenceResult {
            ok: true,
            model: "gpt-4o-mini".to_string(),
            latency_ms: 820,
            ttft_ms: Some(410),
            error_reason: None,
        })
        .expect("serialize");
        assert_eq!(raw["latencyMs"], 820);
        assert_eq!(raw["ttftMs"], 410);
    }
}
