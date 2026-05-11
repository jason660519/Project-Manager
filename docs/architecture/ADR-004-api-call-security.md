# ADR-004: API Call Security — Route Through Rust Bridge

> **Created Date**: 2026-05-12
> **Created By**: Jason (Project Lead)
> **Last Modified**: 2026-05-12
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason

---

## Background

DevPilot needs to:
1. Fetch GitHub repository metadata (PR status, commit history, issues)
2. Call Anthropic API for spec parsing and task generation
3. Manage API keys (GitHub tokens, Anthropic API keys)

The question is: where should API calls happen?

1. **Frontend (TypeScript)** — Directly in React components
2. **Backend (Rust)** — Via Tauri commands

---

## Decision

**All API calls must go through Rust bridge commands.** API keys never appear in the renderer process (Tauri WebView).

```
[Frontend]
    ↓
[Rust Command Handler] ← Keys stored here
    ↓
[HTTPS Request] (Anthropic / GitHub API)
```

---

## Rationale

### Security Threat: Renderer Process Exposure

Tauri's renderer process is fundamentally a **browser environment**. Any variable accessible in JavaScript can be:

1. **Exposed in DevTools**: User opens DevTools → inspects console → sees API keys
2. **Accessed via scripts**: If any third-party JS is loaded (even accidentally), it can read window variables
3. **Captured in logs**: Browser might cache sensitive data in memory or crash dumps

### Rust Isolation

- API keys are read in Rust layer (not exposed to JavaScript)
- `reqwest` HTTP client makes HTTPS call directly from Rust
- Keys never appear in JavaScript runtime

### Example Threat

```typescript
// ❌ WRONG: API key in frontend
window.ANTHROPIC_KEY = 'sk-...';  // Visible in DevTools!

async function callAnthropicFromFrontend() {
  const response = await fetch('https://api.anthropic.com/..', {
    headers: { 'x-api-key': window.ANTHROPIC_KEY },
  });
}
```

**vs.**

```rust
// ✅ CORRECT: Key in backend
#[tauri::command]
async fn call_anthropic(prompt: String) -> Result<String, String> {
    let api_key = get_key_from_keychain("anthropic-api-key")?;
    // api_key never exposed to JavaScript
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/..")
        .header("x-api-key", &api_key)
        .body(prompt)
        .send()
        .await?;
    
    Ok(response.text().await?)
}
```

---

## Implementation

### API Key Storage

**Option A: Keychain (Recommended)**
```rust
use keychain_access::KeychainAccess;

#[tauri::command]
fn keychain_get(key: String) -> Result<Option<String>, String> {
    KeychainAccess::get(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn keychain_set(key: String, value: String) -> Result<(), String> {
    KeychainAccess::set(&key, &value)
        .map_err(|e| e.to_string())
}
```

**Option B: Environment Variables**
```bash
# .env.local (not committed)
ANTHROPIC_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
```

**Option C: Config File (Less Secure)**
```json
// ~/.dev-pilot/config.json
{
  "anthropic_key": "...",
  "github_token": "..."
}
```

**Recommendation**: Use macOS Keychain for security; allow environment variables as fallback for testing.

### Anthropic API Command

```rust
// src-tauri/src/commands/anthropic.rs
use reqwest::Client;

#[tauri::command]
async fn call_anthropic(
    prompt: String,
    model: Option<String>,
) -> Result<String, String> {
    let api_key = get_api_key_from_keychain("anthropic").await?;
    let model = model.unwrap_or("claude-3-5-sonnet".to_string());

    let client = Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": model,
            "max_tokens": 2048,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("API error: {}", e))?;

    let body = response.json::<AnthropicResponse>().await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(body.content[0].text.clone())
}

#[derive(Debug, serde::Deserialize)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
}

#[derive(Debug, serde::Deserialize)]
struct ContentBlock {
    text: String,
}
```

### GitHub API Command

```rust
// src-tauri/src/commands/github.rs
#[tauri::command]
async fn fetch_github_metadata(
    repo_url: String,
) -> Result<GitHubMetadata, String> {
    let token = get_api_key_from_keychain("github").await?;
    
    let parts: Vec<&str> = repo_url
        .trim_end_matches(".git")
        .split('/')
        .collect();
    
    let (owner, repo) = match (parts.get(parts.len()-2), parts.get(parts.len()-1)) {
        (Some(&o), Some(&r)) => (o, r),
        _ => return Err("Invalid repo URL".to_string()),
    };

    // Fetch PR status
    let prs = fetch_github_prs(owner, repo, &token).await?;
    let issues = fetch_github_issues(owner, repo, &token).await?;
    let releases = fetch_github_releases(owner, repo, &token).await?;

    Ok(GitHubMetadata {
        owner: owner.to_string(),
        repo: repo.to_string(),
        pr_count: prs.len(),
        issue_count: issues.len(),
        latest_release: releases.first().cloned(),
        // ...
    })
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct GitHubMetadata {
    pub owner: String,
    pub repo: String,
    pub pr_count: usize,
    pub issue_count: usize,
    pub latest_release: Option<Release>,
}
```

### Frontend Usage

```typescript
// lib/bridge/github-bridge.ts
import { invoke } from '@tauri-apps/api/tauri';

export async function fetchGitHubMetadata(repoUrl: string) {
  return invoke<GitHubMetadata>('fetch_github_metadata', {
    repo_url: repoUrl,
  });
}

// components/ProjectSetup.tsx
async function handleAddGitHubProject(repoUrl: string) {
  // Frontend never sees the token
  const metadata = await fetchGitHubMetadata(repoUrl);
  
  // Display metadata
  console.log(`Found ${metadata.pr_count} PRs in ${metadata.owner}/${metadata.repo}`);
}
```

---

## Evaluated Alternatives

### Option A: API Calls from Frontend

**Pros:**
- Simpler architecture (fewer layers)
- Faster initial development

**Cons:**
- ❌ API keys exposed in JavaScript
- ❌ Users can accidentally share keys via screenshots/share screens
- ❌ Rate limiting appears to come from user (not server)
- ❌ CORS issues when calling APIs

**Conclusion:** ❌ Rejected — Unacceptable security risk

### Option B: Separate Backend Server

**Pros:**
- Isolated API management

**Cons:**
- Requires user to run additional server
- Network overhead for local tool
- Defeats purpose of "local-first"

**Conclusion:** ❌ Rejected — Violates local-first design

### Option C: Browser Extensions (for API key injection)

**Pros:**
- Decouples key management from app

**Cons:**
- Over-engineered
- Fragile and hard to maintain

**Conclusion:** ❌ Rejected — Overcomplicated

---

## Error Handling

```rust
// src-tauri/src/error.rs
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("API key not found in keychain")]
    KeyNotFound,
    
    #[error("Network error: {0}")]
    NetworkError(#[from] reqwest::Error),
    
    #[error("API error: {status} - {body}")]
    ApiError { status: u16, body: String },
    
    #[error("Parse error: {0}")]
    ParseError(#[from] serde_json::Error),
}

impl From<ApiError> for String {
    fn from(err: ApiError) -> String {
        err.to_string()
    }
}
```

---

## Testing Strategy

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keychain_get_missing_key() {
        let result = keychain_get("nonexistent-key".to_string());
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_anthropic_call_with_invalid_key() {
        // Mock the API key as invalid
        let result = call_anthropic("test prompt".to_string(), None).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("401"));
    }
}
```

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Keychain access fails | Low | Medium | Fallback to env vars; cache API calls |
| API rate limiting | Medium | Low | Implement request throttling; show user message |
| Token expiration | Medium | Medium | Auto-refresh tokens; prompt user to re-auth |
| Network unavailable | Low | Low | Show offline mode indicator |

---

## Consequences

**Positive:**
- API keys never exposed to JavaScript
- Follows security best practices
- Aligns with Tauri's security model

**Negative:**
- More code (Rust command handlers needed)
- Rust developers required for API changes

---

## Future Considerations

- **Token Refresh**: Implement automatic token refresh for expired keys
- **Request Signing**: Add signature-based authentication for custom APIs
- **Rate Limiting**: Local caching to reduce API calls
- **Offline Mode**: Cache responses for offline-capable features

---

## References

- [OWASP: API Security](https://owasp.org/www-project-api-security/)
- [Tauri Security Guide](https://tauri.app/en/develop/security/)
- [Reqwest Documentation](https://docs.rs/reqwest/)
- [Anthropic API Docs](https://docs.anthropic.com/)
- [GitHub API Docs](https://docs.github.com/en/rest)

---

## Change History

| Date       | Version | Modified By | Changes |
|------------|---------|------------|---------|
| 2026-05-12 | 1.0     | Jason      | Initial ADR creation |
