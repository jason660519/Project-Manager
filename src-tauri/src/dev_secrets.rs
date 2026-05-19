//! Dev-only plaintext secret store — bypasses macOS Keychain prompts during
//! `tauri dev` / debug builds. **Never enabled in release builds** unless
//! `PM_DEV_PLAINTEXT_SECRETS=1` is explicitly set (discouraged).
//!
//! Storage: `~/.project-manager/dev-secrets.json` (mode 0600 on Unix).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Default)]
struct DevSecretsFile {
    entries: HashMap<String, String>,
}

fn entry_id(service: &str, key: &str) -> String {
    format!("{service}\0{key}")
}

fn secrets_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Cannot resolve home directory for dev secrets file".to_string())?;
    Ok(PathBuf::from(home).join(".project-manager").join("dev-secrets.json"))
}

fn read_file() -> Result<DevSecretsFile, String> {
    let path = secrets_path()?;
    if !path.exists() {
        return Ok(DevSecretsFile::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid dev secrets JSON: {e}"))
}

fn write_file(file: &DevSecretsFile) -> Result<(), String> {
    let path = secrets_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create {}: {e}", parent.display()))?;
    }
    let raw = serde_json::to_string_pretty(file)
        .map_err(|e| format!("Cannot serialize dev secrets: {e}"))?;
    fs::write(&path, &raw).map_err(|e| format!("Cannot write {}: {e}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// True when secrets should use the dev file instead of OS Keychain.
pub fn dev_plaintext_secrets_enabled() -> bool {
    match std::env::var("PM_DEV_PLAINTEXT_SECRETS")
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "0" | "false" | "no" => false,
        "1" | "true" | "yes" => true,
        // Default: on for debug builds (`tauri dev`), off for release (`tauri build`).
        _ => cfg!(debug_assertions),
    }
}

pub fn storage_backend_label() -> &'static str {
    if dev_plaintext_secrets_enabled() {
        "dev-file (~/.project-manager/dev-secrets.json)"
    } else {
        "keychain"
    }
}

pub fn get_dev_secret(service: &str, key: &str) -> Result<Option<String>, String> {
    let file = read_file()?;
    Ok(file.entries.get(&entry_id(service, key)).cloned())
}

pub fn set_dev_secret(service: &str, key: &str, value: &str) -> Result<(), String> {
    let mut file = read_file()?;
    file.entries
        .insert(entry_id(service, key), value.to_string());
    write_file(&file)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    static TEST_HOME: OnceLock<Mutex<PathBuf>> = OnceLock::new();

    fn with_temp_home<F: FnOnce() -> R, R>(f: F) -> R {
        let dir = std::env::temp_dir().join(format!(
            "pm-dev-secrets-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let lock = TEST_HOME.get_or_init(|| Mutex::new(PathBuf::new()));
        let mut guard = lock.lock().unwrap();
        let prev = std::env::var("HOME").ok();
        *guard = dir.clone();
        std::env::set_var("HOME", dir.to_string_lossy().as_ref());
        std::env::set_var("PM_DEV_PLAINTEXT_SECRETS", "1");
        let out = f();
        if let Some(h) = prev {
            std::env::set_var("HOME", h);
        } else {
            std::env::remove_var("HOME");
        }
        std::env::remove_var("PM_DEV_PLAINTEXT_SECRETS");
        let _ = fs::remove_dir_all(&dir);
        out
    }

    #[test]
    fn round_trip_secret() {
        with_temp_home(|| {
            set_dev_secret("projectmanager", "github-token", "ghp_test").unwrap();
            let v = get_dev_secret("projectmanager", "github-token").unwrap();
            assert_eq!(v.as_deref(), Some("ghp_test"));
            assert!(get_dev_secret("projectmanager", "missing").unwrap().is_none());
        });
    }
}
