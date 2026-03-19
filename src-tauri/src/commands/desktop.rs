use std::path::PathBuf;

use crate::error::{AppError, AppResult};
use crate::models::current_platform;

#[tauri::command]
pub async fn get_platform() -> AppResult<String> {
    Ok(current_platform().to_string())
}

const APP_NAME: &str = "PyArsenal";
const APP_COMMENT: &str = "Personal tool distribution and update launcher";

fn desktop_file_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".local")
        .join("share")
        .join("applications")
        .join("pyarsenal.desktop")
}

#[tauri::command]
pub async fn get_appimage_path() -> AppResult<Option<String>> {
    Ok(std::env::var("APPIMAGE").ok())
}

#[tauri::command]
pub async fn desktop_file_exists() -> AppResult<bool> {
    Ok(desktop_file_path().exists())
}

#[tauri::command]
pub async fn add_to_app_menu(appimage_path: String) -> AppResult<()> {
    if !std::path::Path::new(&appimage_path).exists() {
        return Err(AppError::Generic(format!(
            "AppImage not found: {}",
            appimage_path
        )));
    }

    let desktop_content = format!(
"[Desktop Entry]
Type=Application
Name={}
Comment={}
Exec={}
Icon=pyarsenal
Terminal=false
Categories=Development;Utility;
Keywords=tools;launcher;github;update;
StartupWMClass=pyarsenal
", APP_NAME, APP_COMMENT, appimage_path);

    let path = desktop_file_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, desktop_content)?;

    // Set executable permissions
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&path, perms)?;
    }

    refresh_desktop_database();
    Ok(())
}

#[tauri::command]
pub async fn remove_from_app_menu() -> AppResult<bool> {
    let path = desktop_file_path();
    if path.exists() {
        std::fs::remove_file(path)?;
        refresh_desktop_database();
        Ok(true)
    } else {
        Ok(false)
    }
}

// ── Tool desktop shortcuts ──

fn apps_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".local").join("share").join("applications")
}

fn tool_desktop_path(tool_id: &str) -> PathBuf {
    apps_dir().join(format!("pyarsenal-{}.desktop", tool_id))
}

fn refresh_desktop_database() {
    let dir = apps_dir();
    // Standard freedesktop
    std::process::Command::new("update-desktop-database")
        .arg(&dir)
        .spawn()
        .ok();
    // KDE Plasma
    for cmd in &["kbuildsycoca6", "kbuildsycoca5"] {
        if std::process::Command::new(cmd).spawn().is_ok() {
            break;
        }
    }
}

#[tauri::command]
pub async fn create_tool_shortcut(tool_id: String, tool_name: String, binary_path: String) -> AppResult<()> {
    if !std::path::Path::new(&binary_path).exists() {
        return Err(AppError::Generic(format!("Binary not found: {}", binary_path)));
    }

    // Quote the path in case it has spaces
    let exec_path = if binary_path.contains(' ') {
        format!("\"{}\"", binary_path)
    } else {
        binary_path.clone()
    };

    let desktop_content = format!(
"[Desktop Entry]
Type=Application
Name={}
Comment=Installed via PyArsenal
Exec={}
Terminal=false
Categories=Utility;
StartupWMClass={}
", tool_name, exec_path, tool_id);

    let path = tool_desktop_path(&tool_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, desktop_content)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&path, perms)?;
    }

    refresh_desktop_database();
    Ok(())
}

#[tauri::command]
pub async fn remove_tool_shortcut(tool_id: String) -> AppResult<()> {
    let path = tool_desktop_path(&tool_id);
    if path.exists() {
        std::fs::remove_file(path)?;
        refresh_desktop_database();
    }
    Ok(())
}

#[tauri::command]
pub async fn tool_shortcut_exists(tool_id: String) -> AppResult<bool> {
    Ok(tool_desktop_path(&tool_id).exists())
}
