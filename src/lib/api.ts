import { invoke } from "@tauri-apps/api/core";
import type { CatalogEntry, InstalledTool, UpdateInfo, RepoScanResult, ReleaseInfo, AppStats, ExportProfile } from "./types";

export const fetchCatalog = () =>
  invoke<CatalogEntry[]>("fetch_catalog");

export const forceRefreshCatalog = () =>
  invoke<void>("force_refresh_catalog");

export const getToolIcon = (repo: string, toolId: string) =>
  invoke<string>("get_tool_icon", { repo, toolId });

// Admin
export const scanRepo = (repoUrl: string) =>
  invoke<RepoScanResult>("scan_repo", { repoUrl });

export const addToCatalog = (entry: CatalogEntry) =>
  invoke<void>("add_to_catalog", { entry });

export const removeFromCatalog = (toolId: string) =>
  invoke<void>("remove_from_catalog", { toolId });

export const updateInCatalog = (entry: CatalogEntry) =>
  invoke<void>("update_in_catalog", { entry });

export const getCatalogEntries = () =>
  invoke<CatalogEntry[]>("get_catalog_entries");

export const checkCatalogPermission = () =>
  invoke<boolean>("check_catalog_permission");

export const getInstalledTools = () =>
  invoke<Record<string, InstalledTool>>("get_installed_tools");

export const installTool = (toolId: string, catalogEntry: CatalogEntry) =>
  invoke<InstalledTool>("install_tool", { toolId, catalogEntry });

export const cancelInstall = (toolId: string) =>
  invoke<void>("cancel_install", { toolId });

export const uninstallTool = (toolId: string) =>
  invoke<void>("uninstall_tool", { toolId });

export const launchTool = (toolId: string) =>
  invoke<void>("launch_tool", { toolId });

export const launchToolAdmin = (toolId: string) =>
  invoke<void>("launch_tool_admin", { toolId });

export const openInstallFolder = (toolId: string) =>
  invoke<void>("open_install_folder", { toolId });

export const checkAllUpdates = () =>
  invoke<UpdateInfo[]>("check_all_updates");

// Favorites
export const toggleFavorite = (toolId: string) =>
  invoke<boolean>("toggle_favorite", { toolId });

export const getFavorites = () =>
  invoke<string[]>("get_favorites");

// Stats & Counts
export const getLaunchCounts = () =>
  invoke<Record<string, number>>("get_launch_counts");

export const getStats = () =>
  invoke<AppStats>("get_stats");

// Changelog
export const getToolChangelog = (repo: string) =>
  invoke<ReleaseInfo[]>("get_tool_changelog", { repo });

// Export/Import
export const exportProfile = () =>
  invoke<string>("export_profile");

export const importProfile = (json: string) =>
  invoke<ExportProfile>("import_profile", { json });

// Settings
export const savePat = (pat: string) =>
  invoke<void>("save_pat", { pat });

export const getPat = () =>
  invoke<string | null>("get_pat");

export const clearPat = () =>
  invoke<void>("clear_pat");

export const getRateLimit = () =>
  invoke<[number, number]>("get_rate_limit");

// Desktop integration
export const getPlatform = () =>
  invoke<string>("get_platform");

export const getAppimagePath = () =>
  invoke<string | null>("get_appimage_path");

export const desktopFileExists = () =>
  invoke<boolean>("desktop_file_exists");

export const addToAppMenu = (appimagePath: string) =>
  invoke<void>("add_to_app_menu", { appimagePath });

export const removeFromAppMenu = () =>
  invoke<boolean>("remove_from_app_menu");

export const createToolShortcut = (toolId: string, toolName: string, binaryPath: string, shortcutType: string = "both") =>
  invoke<void>("create_tool_shortcut", { toolId, toolName, binaryPath, shortcutType });

export const removeToolShortcut = (toolId: string, toolName: string) =>
  invoke<void>("remove_tool_shortcut", { toolId, toolName });

export const toolShortcutExists = (toolId: string, toolName: string) =>
  invoke<boolean>("tool_shortcut_exists", { toolId, toolName });
