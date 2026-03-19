use std::process::Command;

use crate::commands::library::read_installed_db;
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn launch_tool(tool_id: String) -> AppResult<()> {
    let db = read_installed_db()?;
    let tool = db
        .tools
        .get(&tool_id)
        .ok_or_else(|| AppError::ToolNotInstalled(tool_id.clone()))?;

    let binary = &tool.binary_path;

    #[cfg(unix)]
    {
        Command::new(binary)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to launch {}: {}", tool_id, e)))?;
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        Command::new(binary)
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to launch {}: {}", tool_id, e)))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_install_folder(tool_id: String) -> AppResult<()> {
    let db = read_installed_db()?;
    let tool = db
        .tools
        .get(&tool_id)
        .ok_or_else(|| AppError::ToolNotInstalled(tool_id.clone()))?;

    let folder = &tool.install_path;

    #[cfg(unix)]
    {
        Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to open folder: {}", e)))?;
    }

    #[cfg(windows)]
    {
        Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to open folder: {}", e)))?;
    }

    Ok(())
}
