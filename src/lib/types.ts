export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  repo: string;
  platforms: string[];
  asset_patterns: Record<string, string>;
  binary_name: Record<string, string>;
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
}

export interface UpdateInfo {
  tool_id: string;
  current_version: string;
  latest_version: string;
}

export interface DownloadProgress {
  tool_id: string;
  downloaded: number;
  total: number;
}
