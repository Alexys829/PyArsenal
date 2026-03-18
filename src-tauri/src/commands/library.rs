use std::collections::HashMap;

use crate::error::AppResult;
use crate::models::{InstalledDb, InstalledTool};
use crate::paths::installed_db_path;

pub fn read_installed_db() -> AppResult<InstalledDb> {
    let path = installed_db_path();
    if !path.exists() {
        let db = InstalledDb {
            format_version: 1,
            tools: HashMap::new(),
        };
        let json = serde_json::to_string_pretty(&db)?;
        std::fs::write(&path, json)?;
        return Ok(db);
    }

    let data = std::fs::read_to_string(&path)?;
    match serde_json::from_str::<InstalledDb>(&data) {
        Ok(db) => Ok(db),
        Err(_) => {
            // Backup corrupt file and start fresh
            let backup = path.with_extension("json.bak");
            std::fs::copy(&path, backup).ok();
            let db = InstalledDb {
                format_version: 1,
                tools: HashMap::new(),
            };
            let json = serde_json::to_string_pretty(&db)?;
            std::fs::write(&path, json)?;
            Ok(db)
        }
    }
}

pub fn write_installed_db(db: &InstalledDb) -> AppResult<()> {
    let path = installed_db_path();
    let json = serde_json::to_string_pretty(db)?;
    std::fs::write(path, json)?;
    Ok(())
}

#[tauri::command]
pub async fn get_installed_tools() -> AppResult<HashMap<String, InstalledTool>> {
    let db = read_installed_db()?;
    Ok(db.tools)
}
