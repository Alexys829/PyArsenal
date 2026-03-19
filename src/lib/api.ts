import { invoke } from "@tauri-apps/api/core";
import type { CatalogEntry, InstalledTool, UpdateInfo, RepoScanResult } from "./types";

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
  invoke<InstalledTool>("install_tool", {
    toolId,
    catalogEntry,
  });

export const cancelInstall = (toolId: string) =>
  invoke<void>("cancel_install", { toolId });

export const uninstallTool = (toolId: string) =>
  invoke<void>("uninstall_tool", { toolId });

export const launchTool = (toolId: string) =>
  invoke<void>("launch_tool", { toolId });

export const openInstallFolder = (toolId: string) =>
  invoke<void>("open_install_folder", { toolId });

export const checkAllUpdates = () =>
  invoke<UpdateInfo[]>("check_all_updates");

export const savePat = (pat: string) =>
  invoke<void>("save_pat", { pat });

export const getPat = () =>
  invoke<string | null>("get_pat");

export const clearPat = () =>
  invoke<void>("clear_pat");

export const getRateLimit = () =>
  invoke<[number, number]>("get_rate_limit");

// Desktop integration (Linux AppImage)
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

// Tool desktop shortcuts
export const createToolShortcut = (toolId: string, toolName: string, binaryPath: string) =>
  invoke<void>("create_tool_shortcut", { toolId, toolName, binaryPath });

export const removeToolShortcut = (toolId: string) =>
  invoke<void>("remove_tool_shortcut", { toolId });

export const toolShortcutExists = (toolId: string) =>
  invoke<boolean>("tool_shortcut_exists", { toolId });
