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
    let download_manager = commands::install::DownloadManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(github_client)
        .manage(download_manager)
        .invoke_handler(tauri::generate_handler![
            commands::admin::scan_repo,
            commands::admin::add_to_catalog,
            commands::admin::remove_from_catalog,
            commands::admin::update_in_catalog,
            commands::admin::get_catalog_entries,
            commands::admin::check_catalog_permission,
            commands::catalog::fetch_catalog,
            commands::catalog::force_refresh_catalog,
            commands::catalog::get_tool_icon,
            commands::install::install_tool,
            commands::install::cancel_install,
            commands::install::uninstall_tool,
            commands::library::get_installed_tools,
            commands::update::check_all_updates,
            commands::launch::launch_tool,
            commands::launch::launch_tool_admin,
            commands::launch::open_install_folder,
            commands::settings::save_pat,
            commands::settings::get_pat,
            commands::settings::clear_pat,
            commands::settings::get_rate_limit,
            commands::desktop::get_platform,
            commands::desktop::get_appimage_path,
            commands::desktop::desktop_file_exists,
            commands::desktop::add_to_app_menu,
            commands::desktop::remove_from_app_menu,
            commands::desktop::create_tool_shortcut,
            commands::desktop::remove_tool_shortcut,
            commands::desktop::tool_shortcut_exists,
        ])
        .setup(|app| {
            // Install app icon on Linux
            #[cfg(unix)]
            commands::desktop::ensure_app_icon();

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
