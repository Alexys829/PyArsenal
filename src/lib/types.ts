export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  repo: string;
  author: string;
  platforms: string[];
  asset_patterns: Record<string, string>;
  binary_name: Record<string, string>;
  /** "binary" (default) | "archive" | "innosetup" — per platform */
  install_type: Record<string, string>;
}

export interface InstalledTool {
  id: string;
  name: string;
  installed_version: string;
  installed_at: string;
  updated_at: string;
  install_path: string;
  binary_path: string;
  repo: string;
  size_bytes: number;
}

export interface UpdateInfo {
  tool_id: string;
  current_version: string;
  latest_version: string;
}

export interface RepoScanResult {
  repo: string;
  name: string;
  description: string;
  author: string;
  has_releases: boolean;
  latest_version: string;
  linux_assets: string[];
  windows_assets: string[];
  has_icon: boolean;
  suggested_entry: CatalogEntry;
}

export interface DownloadProgress {
  tool_id: string;
  downloaded: number;
  total: number;
  speed_bps: number;
}
