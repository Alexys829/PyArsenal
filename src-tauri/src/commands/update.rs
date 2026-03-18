use tauri::State;

use crate::commands::library::read_installed_db;
use crate::error::AppResult;
use crate::github::GitHubClient;
use crate::models::UpdateInfo;

#[tauri::command]
pub async fn check_all_updates(
    github: State<'_, GitHubClient>,
) -> AppResult<Vec<UpdateInfo>> {
    let db = read_installed_db()?;
    let mut updates = Vec::new();

    for (id, tool) in &db.tools {
        match github.get_latest_release(&tool.repo).await {
            Ok(release) => {
                let latest = release.tag_name.trim_start_matches('v').to_string();
                let current = tool.installed_version.trim_start_matches('v');

                // Try semver comparison, fallback to string comparison
                let is_newer = match (
                    semver::Version::parse(&latest),
                    semver::Version::parse(current),
                ) {
                    (Ok(l), Ok(c)) => l > c,
                    _ => latest != current,
                };

                if is_newer {
                    updates.push(UpdateInfo {
                        tool_id: id.clone(),
                        current_version: current.to_string(),
                        latest_version: latest,
                    });
                }
            }
            Err(_) => {
                // Skip tools we can't check — don't fail the whole check
                continue;
            }
        }
    }

    Ok(updates)
}
