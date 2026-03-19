mod commands;
mod error;
mod github;
mod models;
mod paths;

use github::GitHubClient;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    let github_client = GitHubClient::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(github_client)
        .invoke_handler(tauri::generate_handler![
            commands::catalog::fetch_catalog,
            commands::install::install_tool,
            commands::install::uninstall_tool,
            commands::library::get_installed_tools,
            commands::update::check_all_updates,
            commands::launch::launch_tool,
            commands::settings::save_pat,
            commands::settings::get_pat,
            commands::settings::clear_pat,
            commands::settings::get_rate_limit,
            commands::desktop::get_platform,
            commands::desktop::get_appimage_path,
            commands::desktop::desktop_file_exists,
            commands::desktop::add_to_app_menu,
            commands::desktop::remove_from_app_menu,
        ])
        .setup(|app| {
            // Load PAT from keychain on startup
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let github: tauri::State<'_, GitHubClient> = handle.state();
                if let Ok(Some(pat)) = commands::settings::get_pat().await {
                    github.set_pat(Some(pat)).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PyArsenal");
}
