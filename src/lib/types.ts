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
  install_type: Record<string, string>;
  tags: string[];
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
  release_date: string;
  release_notes: string;
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

export interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  published_at: string;
}

export interface AppStats {
  total_tools: number;
  installed_tools: number;
  total_size_bytes: number;
  most_launched: [string, number][];
}

export interface ExportProfile {
  exported_at: string;
  tools: { id: string; name: string; version: string; repo: string }[];
  favorites: string[];
}

export interface LinkEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  filename: string;
  category: string;
  tags: string[];
  added_by: string;
}

export interface LinkValidation {
  valid: boolean;
  final_url: string;
  filename: string;
  content_type: string;
  size: number;
  service: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  colors: Record<string, string>;
}

export interface ThemeConfig {
  active: string;
  custom_themes: CustomTheme[];
}
