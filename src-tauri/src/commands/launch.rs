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
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to launch {}: {}", tool_id, e)))?;
    }

    #[cfg(windows)]
    {
        Command::new("cmd")
            .args(["/C", "start", "", binary])
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to launch {}: {}", tool_id, e)))?;
    }

    Ok(())
}
