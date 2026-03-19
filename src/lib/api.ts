import { invoke } from "@tauri-apps/api/core";
import type { CatalogEntry, InstalledTool, UpdateInfo } from "./types";

export const fetchCatalog = () =>
  invoke<CatalogEntry[]>("fetch_catalog");

export const getInstalledTools = () =>
  invoke<Record<string, InstalledTool>>("get_installed_tools");

export const installTool = (toolId: string, catalogEntry: CatalogEntry) =>
  invoke<InstalledTool>("install_tool", {
    toolId,
    catalogEntry,
  });

export const uninstallTool = (toolId: string) =>
  invoke<void>("uninstall_tool", { toolId });

export const launchTool = (toolId: string) =>
  invoke<void>("launch_tool", { toolId });

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
