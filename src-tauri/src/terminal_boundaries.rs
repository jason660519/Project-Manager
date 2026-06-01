use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCommandRule {
    pub id: String,
    pub pattern: String,
    pub description: String,
    pub category: String,
    pub list_kind: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOperationalBoundaries {
    pub policy_mode: String,
    pub whitelist: Vec<TerminalCommandRule>,
    pub blacklist: Vec<TerminalCommandRule>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalEvaluationResult {
    pub decision: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched_rule_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocked_segment: Option<String>,
}

pub fn normalize_terminal_command(command: &str) -> String {
    command.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn split_compound_command(command: &str) -> Vec<String> {
    let normalized = normalize_terminal_command(command);
    if normalized.is_empty() {
        return Vec::new();
    }
    normalized
        .split(|c| c == ';')
        .flat_map(|part| part.split("&&"))
        .flat_map(|part| part.split("||"))
        .flat_map(|part| part.split('|'))
        .map(|s| normalize_terminal_command(s))
        .filter(|s| !s.is_empty())
        .collect()
}

fn matches_pattern(pattern: &str, input: &str) -> bool {
    if pattern.contains('<') {
        if let Some(prefix) = pattern.split('<').next() {
            let prefix = prefix.trim();
            return !prefix.is_empty() && input.starts_with(prefix);
        }
        return false;
    }
    if let Some(stripped) = pattern.strip_suffix(" *") {
        return input.starts_with(stripped);
    }
    input == pattern || input.starts_with(&format!("{pattern} "))
}

fn find_matching_rule<'a>(
    input: &str,
    rules: &'a [TerminalCommandRule],
) -> Option<&'a TerminalCommandRule> {
    rules.iter().find(|rule| matches_pattern(&rule.pattern, input))
}

fn evaluate_segment(
    segment: &str,
    boundaries: &TerminalOperationalBoundaries,
    blacklist_only: bool,
) -> TerminalEvaluationResult {
    let normalized = normalize_terminal_command(segment);
    if normalized.is_empty() {
        return TerminalEvaluationResult {
            decision: "unknown".to_string(),
            reason: Some("empty_command".to_string()),
            matched_rule_id: None,
            blocked_segment: None,
        };
    }

    if let Some(rule) = find_matching_rule(&normalized, &boundaries.blacklist) {
        return TerminalEvaluationResult {
            decision: "blocked".to_string(),
            reason: Some("blacklist".to_string()),
            matched_rule_id: Some(rule.id.clone()),
            blocked_segment: Some(normalized),
        };
    }

    if blacklist_only {
        return TerminalEvaluationResult {
            decision: "allowed".to_string(),
            reason: Some("blacklist_only_pass".to_string()),
            matched_rule_id: None,
            blocked_segment: None,
        };
    }

    if let Some(rule) = find_matching_rule(&normalized, &boundaries.whitelist) {
        return TerminalEvaluationResult {
            decision: "allowed".to_string(),
            reason: Some("whitelist".to_string()),
            matched_rule_id: Some(rule.id.clone()),
            blocked_segment: None,
        };
    }

    if boundaries.policy_mode == "default-deny" {
        return TerminalEvaluationResult {
            decision: "blocked".to_string(),
            reason: Some("default_deny".to_string()),
            matched_rule_id: None,
            blocked_segment: Some(normalized),
        };
    }

    TerminalEvaluationResult {
        decision: "unknown".to_string(),
        reason: Some("not_listed".to_string()),
        matched_rule_id: None,
        blocked_segment: Some(normalized),
    }
}

pub fn evaluate_terminal_command_internal(
    command: &str,
    boundaries: &TerminalOperationalBoundaries,
    blacklist_only: bool,
) -> TerminalEvaluationResult {
    let segments = split_compound_command(command);
    if segments.is_empty() {
        return TerminalEvaluationResult {
            decision: "unknown".to_string(),
            reason: Some("empty_command".to_string()),
            matched_rule_id: None,
            blocked_segment: None,
        };
    }

    for segment in segments {
        let result = evaluate_segment(&segment, boundaries, blacklist_only);
        if result.decision != "allowed" {
            return result;
        }
    }

    TerminalEvaluationResult {
        decision: "allowed".to_string(),
        reason: Some(if blacklist_only {
            "blacklist_only_pass".to_string()
        } else {
            "whitelist".to_string()
        }),
        matched_rule_id: None,
        blocked_segment: None,
    }
}

pub fn default_terminal_boundaries() -> TerminalOperationalBoundaries {
    TerminalOperationalBoundaries {
        policy_mode: "default-deny".to_string(),
        updated_at: "2026-05-26T00:00:00.000Z".to_string(),
        whitelist: vec![
            rule("wl-pwd", "pwd", "inspection", "whitelist"),
            rule("wl-git-status", "git status --short", "version-control", "whitelist"),
            rule(
                "wl-git-branch",
                "git branch --show-current",
                "version-control",
                "whitelist",
            ),
            rule("wl-npm-run", "npm run <script>", "build", "whitelist"),
            rule("wl-cargo-check", "cargo check", "build", "whitelist"),
            rule("wl-rg", "rg <pattern>", "inspection", "whitelist"),
        ],
        blacklist: vec![
            rule("bl-rm-rf", "rm -rf *", "destructive", "blacklist"),
            rule("bl-sudo", "sudo *", "privilege", "blacklist"),
            rule("bl-chmod", "chmod *", "privilege", "blacklist"),
            rule("bl-curl-pipe", "curl * | *", "exfiltration", "blacklist"),
            rule("bl-env-dump", "env | *", "exfiltration", "blacklist"),
            rule("bl-ssh-key", "cat ~/.ssh/*", "credential-theft", "blacklist"),
        ],
    }
}

fn rule(id: &str, pattern: &str, category: &str, list_kind: &str) -> TerminalCommandRule {
    TerminalCommandRule {
        id: id.to_string(),
        pattern: pattern.to_string(),
        description: format!("Default {list_kind} rule for {pattern}"),
        category: category.to_string(),
        list_kind: list_kind.to_string(),
    }
}

#[tauri::command]
pub fn evaluate_terminal_command(
    command: String,
    boundaries: Option<TerminalOperationalBoundaries>,
    blacklist_only: Option<bool>,
) -> Result<TerminalEvaluationResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("command must not be empty".to_string());
    }
    let policy = boundaries.unwrap_or_else(default_terminal_boundaries);
    Ok(evaluate_terminal_command_internal(
        trimmed,
        &policy,
        blacklist_only.unwrap_or(false),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_pwd() {
        let boundaries = default_terminal_boundaries();
        let result = evaluate_terminal_command_internal("pwd", &boundaries, false);
        assert_eq!(result.decision, "allowed");
    }

    #[test]
    fn blocks_sudo() {
        let boundaries = default_terminal_boundaries();
        let result = evaluate_terminal_command_internal("sudo ls", &boundaries, false);
        assert_eq!(result.decision, "blocked");
    }

    #[test]
    fn blacklist_only_allows_unknown() {
        let boundaries = default_terminal_boundaries();
        let result = evaluate_terminal_command_internal("claude --help", &boundaries, true);
        assert_eq!(result.decision, "allowed");
    }

    #[test]
    fn blocks_compound_segment() {
        let boundaries = default_terminal_boundaries();
        let result =
            evaluate_terminal_command_internal("git status --short && sudo ls", &boundaries, false);
        assert_eq!(result.decision, "blocked");
    }
}
