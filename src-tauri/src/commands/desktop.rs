use std::path::PathBuf;

use crate::error::{AppError, AppResult};
use crate::models::current_platform;
use crate::paths::icons_dir;

#[tauri::command]
pub async fn get_platform() -> AppResult<String> {
    Ok(current_platform().to_string())
}

const APP_NAME: &str = "PyArsenal";
const APP_COMMENT: &str = "Personal tool distribution and update launcher";

// ── Linux helpers ──

#[cfg(unix)]
fn linux_apps_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".local").join("share").join("applications")
}

#[cfg(unix)]
fn linux_icons_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home
        .join(".local")
        .join("share")
        .join("icons")
        .join("hicolor")
        .join("128x128")
        .join("apps");
    std::fs::create_dir_all(&dir).ok();
    dir
}

#[cfg(unix)]
fn refresh_desktop_database() {
    let dir = linux_apps_dir();
    std::process::Command::new("update-desktop-database")
        .arg(&dir)
        .spawn()
        .ok();
    for cmd in &["kbuildsycoca6", "kbuildsycoca5"] {
        if std::process::Command::new(cmd).spawn().is_ok() {
            break;
        }
    }
}

#[cfg(unix)]
fn set_file_executable(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(perms) = std::fs::metadata(path).map(|m| m.permissions()) {
        let mut p = perms;
        p.set_mode(0o755);
        std::fs::set_permissions(path, p).ok();
    }
}

/// Install the PyArsenal icon into the standard icon theme directory (Linux)
#[cfg(unix)]
fn install_app_icon_linux() -> Option<PathBuf> {
    let icon_dest = linux_icons_dir().join("pyarsenal.png");
    if icon_dest.exists() {
        return Some(icon_dest);
    }
    // Try to find icon from the bundled Tauri resources
    // The AppImage extracts icons to /tmp/.mount_*/usr/share/icons/
    if let Ok(appimage) = std::env::var("APPIMAGE") {
        // Try common icon locations near the AppImage
        let appimage_path = std::path::Path::new(&appimage);
        if let Some(dir) = appimage_path.parent() {
            let candidates = [
                dir.join("icons").join("128x128.png"),
                dir.join("pyarsenal.png"),
            ];
            for c in &candidates {
                if c.exists() {
                    std::fs::copy(c, &icon_dest).ok();
                    return Some(icon_dest);
                }
            }
        }
    }
    // Use a cached icon from our data dir if available
    let cached = icons_dir().join("pyarsenal-app.png");
    if cached.exists() {
        std::fs::copy(&cached, &icon_dest).ok();
        return Some(icon_dest);
    }
    None
}

/// Get the icon path for a tool (from our icon cache)
fn get_tool_icon_path(tool_id: &str) -> Option<PathBuf> {
    let cached = icons_dir().join(format!("{}.png", tool_id));
    if cached.exists() {
        return Some(cached);
    }
    None
}

// ── Windows helpers ──

#[cfg(windows)]
fn windows_start_menu_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AppData")
        .join("Roaming")
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("PyArsenal")
}

#[cfg(windows)]
fn windows_desktop_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("Desktop")
}

#[cfg(windows)]
fn create_windows_shortcut(lnk_path: &std::path::Path, target: &str, name: &str, icon: Option<&str>) -> AppResult<()> {
    let lnk_str = lnk_path.to_string_lossy();
    let icon_arg = icon.unwrap_or(target);

    let ps_script = format!(
        "$ws = New-Object -ComObject WScript.Shell; \
         $s = $ws.CreateShortcut('{}'); \
         $s.TargetPath = '{}'; \
         $s.Description = '{}'; \
         $s.IconLocation = '{},0'; \
         $s.Save()",
        lnk_str.replace('\'', "''"),
        target.replace('\'', "''"),
        name.replace('\'', "''"),
        icon_arg.replace('\'', "''"),
    );

    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(|e| AppError::Generic(format!("Failed to create shortcut: {}", e)))?;

    if !status.success() {
        return Err(AppError::Generic("PowerShell shortcut creation failed".to_string()));
    }
    Ok(())
}

// ── PyArsenal app menu (Linux) ──

fn desktop_file_path() -> PathBuf {
    #[cfg(unix)]
    { linux_apps_dir().join("pyarsenal.desktop") }
    #[cfg(windows)]
    { PathBuf::from("") }
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
    #[cfg(unix)]
    {
        if !std::path::Path::new(&appimage_path).exists() {
            return Err(AppError::Generic(format!("AppImage not found: {}", appimage_path)));
        }

        // Install icon
        install_app_icon_linux();

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
        set_file_executable(&path);
        refresh_desktop_database();
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_from_app_menu() -> AppResult<bool> {
    let path = desktop_file_path();
    if path.exists() {
        std::fs::remove_file(path)?;
        #[cfg(unix)]
        refresh_desktop_database();
        Ok(true)
    } else {
        Ok(false)
    }
}

// ── Tool shortcuts (cross-platform) ──

#[tauri::command]
pub async fn create_tool_shortcut(
    tool_id: String,
    tool_name: String,
    binary_path: String,
    shortcut_type: String,
) -> AppResult<()> {
    if !std::path::Path::new(&binary_path).exists() {
        return Err(AppError::Generic(format!("Binary not found: {}", binary_path)));
    }

    let platform = current_platform();

    if platform == "linux" {
        #[cfg(unix)]
        {
            let exec_path = if binary_path.contains(' ') {
                format!("\"{}\"", binary_path)
            } else {
                binary_path.clone()
            };

            // Use tool icon if available
            let icon_line = if let Some(icon_path) = get_tool_icon_path(&tool_id) {
                // Copy to hicolor icon theme
                let dest = linux_icons_dir().join(format!("pyarsenal-{}.png", tool_id));
                std::fs::copy(&icon_path, &dest).ok();
                format!("Icon=pyarsenal-{}", tool_id)
            } else {
                "Icon=application-x-executable".to_string()
            };

            let desktop_content = format!(
"[Desktop Entry]
Type=Application
Name={}
Comment=Installed via PyArsenal
Exec={}
{}
Terminal=false
Categories=Utility;
StartupWMClass={}
", tool_name, exec_path, icon_line, tool_id);

            let path = linux_apps_dir().join(format!("pyarsenal-{}.desktop", tool_id));
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&path, desktop_content)?;
            set_file_executable(&path);
            refresh_desktop_database();
        }
    } else if platform == "windows" {
        #[cfg(windows)]
        {
            match shortcut_type.as_str() {
                "desktop" => {
                    let dir = windows_desktop_dir();
                    std::fs::create_dir_all(&dir).ok();
                    let lnk = dir.join(format!("{}.lnk", tool_name));
                    create_windows_shortcut(&lnk, &binary_path, &tool_name, None)?;
                }
                "startmenu" => {
                    let dir = windows_start_menu_dir();
                    std::fs::create_dir_all(&dir)?;
                    let lnk = dir.join(format!("{}.lnk", tool_name));
                    create_windows_shortcut(&lnk, &binary_path, &tool_name, None)?;
                }
                "both" => {
                    let desktop_dir = windows_desktop_dir();
                    let start_dir = windows_start_menu_dir();
                    std::fs::create_dir_all(&desktop_dir).ok();
                    std::fs::create_dir_all(&start_dir).ok();
                    let lnk1 = desktop_dir.join(format!("{}.lnk", tool_name));
                    let lnk2 = start_dir.join(format!("{}.lnk", tool_name));
                    create_windows_shortcut(&lnk1, &binary_path, &tool_name, None)?;
                    create_windows_shortcut(&lnk2, &binary_path, &tool_name, None)?;
                }
                _ => {
                    return Err(AppError::Generic(format!("Unknown shortcut type: {}", shortcut_type)));
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn remove_tool_shortcut(tool_id: String, tool_name: String) -> AppResult<()> {
    let platform = current_platform();

    if platform == "linux" {
        #[cfg(unix)]
        {
            let path = linux_apps_dir().join(format!("pyarsenal-{}.desktop", tool_id));
            if path.exists() {
                std::fs::remove_file(path)?;
            }
            // Remove icon from theme
            let icon = linux_icons_dir().join(format!("pyarsenal-{}.png", tool_id));
            if icon.exists() {
                std::fs::remove_file(icon).ok();
            }
            refresh_desktop_database();
        }
    } else if platform == "windows" {
        #[cfg(windows)]
        {
            // Remove from both Desktop and Start Menu
            let desktop_lnk = windows_desktop_dir().join(format!("{}.lnk", tool_name));
            let start_lnk = windows_start_menu_dir().join(format!("{}.lnk", tool_name));
            if desktop_lnk.exists() { std::fs::remove_file(desktop_lnk).ok(); }
            if start_lnk.exists() { std::fs::remove_file(start_lnk).ok(); }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn tool_shortcut_exists(tool_id: String, tool_name: String) -> AppResult<bool> {
    let platform = current_platform();

    if platform == "linux" {
        #[cfg(unix)]
        {
            let path = linux_apps_dir().join(format!("pyarsenal-{}.desktop", tool_id));
            return Ok(path.exists());
        }
    } else if platform == "windows" {
        #[cfg(windows)]
        {
            let desktop_lnk = windows_desktop_dir().join(format!("{}.lnk", tool_name));
            let start_lnk = windows_start_menu_dir().join(format!("{}.lnk", tool_name));
            return Ok(desktop_lnk.exists() || start_lnk.exists());
        }
    }

    Ok(false)
}
