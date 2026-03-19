use std::path::PathBuf;

use crate::error::{AppError, AppResult};

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
        "[Desktop Entry]\n\
         Type=Application\n\
         Name={}\n\
         Comment={}\n\
         Exec={}\n\
         Icon=pyarsenal\n\
         Terminal=false\n\
         Categories=Development;Utility;\n\
         Keywords=tools;launcher;github;update;\n\
         StartupWMClass=pyarsenal\n",
        APP_NAME, APP_COMMENT, appimage_path
    );

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

    Ok(())
}

#[tauri::command]
pub async fn remove_from_app_menu() -> AppResult<bool> {
    let path = desktop_file_path();
    if path.exists() {
        std::fs::remove_file(path)?;
        Ok(true)
    } else {
        Ok(false)
    }
}
