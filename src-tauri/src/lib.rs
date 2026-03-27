mod commands;
mod error;
mod github;
mod models;
mod paths;

use github::GitHubClient;
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    let github_client = GitHubClient::new();
    let download_manager = commands::install::DownloadManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
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
            commands::admin::get_catalog_links,
            commands::admin::add_link_to_catalog,
            commands::admin::update_link_in_catalog,
            commands::admin::remove_link_from_catalog,
            commands::links::validate_link,
            commands::links::download_link,
            commands::links::get_link_icon,
            commands::links::upload_link_icon,
            commands::links::open_file,
            commands::links::open_file_folder,
            commands::links::get_default_download_dir,
            commands::catalog::fetch_catalog,
            commands::catalog::force_refresh_catalog,
            commands::catalog::get_tool_icon,
            commands::install::install_tool,
            commands::install::cancel_install,
            commands::install::uninstall_tool,
            commands::library::get_installed_tools,
            commands::library::toggle_favorite,
            commands::library::get_favorites,
            commands::library::get_launch_counts,
            commands::library::get_stats,
            commands::library::get_tool_changelog,
            commands::library::export_profile,
            commands::library::import_profile,
            commands::update::check_all_updates,
            commands::launch::launch_tool,
            commands::launch::launch_tool_admin,
            commands::launch::open_install_folder,
            commands::settings::save_pat,
            commands::settings::get_pat,
            commands::settings::clear_pat,
            commands::settings::get_rate_limit,
            commands::settings::get_theme_config,
            commands::settings::save_theme_config,
            commands::settings::get_autostart,
            commands::settings::set_autostart,
            commands::settings::get_prefs,
            commands::settings::save_prefs,
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
