use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::AutoLaunchManager;

use crate::error::{AppError, AppResult};
use crate::github::GitHubClient;
use crate::paths::theme_config_path;

const SERVICE: &str = "pyarsenal";
const ACCOUNT: &str = "github_pat";

fn get_keyring_entry() -> AppResult<keyring::Entry> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| AppError::Keychain(e.to_string()))
}

#[tauri::command]
pub async fn save_pat(pat: String, github: State<'_, GitHubClient>) -> AppResult<()> {
    let entry = get_keyring_entry()?;
    entry
        .set_password(&pat)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    github.set_pat(Some(pat)).await;
    Ok(())
}

#[tauri::command]
pub async fn get_pat() -> AppResult<Option<String>> {
    let entry = get_keyring_entry()?;
    match entry.get_password() {
        Ok(pat) => Ok(Some(pat)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

#[tauri::command]
pub async fn clear_pat(github: State<'_, GitHubClient>) -> AppResult<()> {
    let entry = get_keyring_entry()?;
    match entry.delete_credential() {
        Ok(()) => {}
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(AppError::Keychain(e.to_string())),
    }
    github.set_pat(None).await;
    Ok(())
}

#[tauri::command]
pub async fn get_rate_limit(github: State<'_, GitHubClient>) -> AppResult<(u32, u32)> {
    github.get_rate_limit().await
}

// ── Autostart ──

#[tauri::command]
pub async fn get_autostart(app: AppHandle) -> AppResult<bool> {
    let manager = app.state::<AutoLaunchManager>();
    manager.is_enabled().map_err(|e| AppError::Generic(e.to_string()))
}

#[tauri::command]
pub async fn set_autostart(app: AppHandle, enabled: bool) -> AppResult<()> {
    let manager = app.state::<AutoLaunchManager>();
    if enabled {
        manager.enable().map_err(|e| AppError::Generic(e.to_string()))?;
    } else {
        manager.disable().map_err(|e| AppError::Generic(e.to_string()))?;
    }
    Ok(())
}

// ── Theme persistence ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    pub active: String,
    #[serde(default)]
    pub custom_themes: Vec<CustomTheme>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomTheme {
    pub id: String,
    pub name: String,
    pub colors: HashMap<String, String>,
}

impl Default for ThemeConfig {
    fn default() -> Self {
        Self {
            active: "steam-dark".to_string(),
            custom_themes: Vec::new(),
        }
    }
}

#[tauri::command]
pub async fn get_theme_config() -> AppResult<ThemeConfig> {
    let path = theme_config_path();
    if !path.exists() {
        return Ok(ThemeConfig::default());
    }
    let data = std::fs::read_to_string(&path)?;
    let config: ThemeConfig = serde_json::from_str(&data)?;
    Ok(config)
}

#[tauri::command]
pub async fn save_theme_config(config: ThemeConfig) -> AppResult<()> {
    let path = theme_config_path();
    let json = serde_json::to_string_pretty(&config)?;
    std::fs::write(&path, json)?;
    Ok(())
}
