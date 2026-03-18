use tauri::State;

use crate::error::{AppError, AppResult};
use crate::github::GitHubClient;

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
