import { For } from "solid-js";

const FEATURES = [
  {
    category: "Store",
    items: [
      "Browse all available tools from the centralized catalog",
      "Search by name and description (Ctrl+K global shortcut)",
      "Category filter tabs (Utilities, Productivity, etc.)",
      "\"Not Compatible\" tab for tools unavailable on current platform",
      "Grid and list view toggle (persistent)",
      "Install button with real-time download progress, speed, and cancel",
      "Launch button for already installed tools directly from Store",
      "GitHub repo link on each tool card",
      "Tool icons loaded from each repo's assets/icon.png",
      "Favorite toggle (star) on each card",
      "Tags displayed as badges",
      "Tool counter: available vs installed",
    ],
  },
  {
    category: "Library",
    items: [
      "View all installed tools with version and size",
      "Launch, update, and uninstall tools",
      "Run as Administrator (Windows, with UAC shield icon)",
      "Confirm before uninstall (double-click with 3s timeout)",
      "Update All button for batch updates",
      "Sorting: by name, date, or size (favorites always first)",
      "Desktop shortcut creation (Linux app menu + Windows Desktop & Start Menu)",
      "Open install folder",
      "Changelog viewer (last 10 releases from GitHub)",
      "Release notes preview in update badge",
      "Bug report button (opens GitHub Issues)",
      "Grid and list view toggle",
      "Hidden console when launching tools on Windows",
    ],
  },
  {
    category: "Downloads",
    items: [
      "Download files from cloud drive links",
      "Supported: Google Drive, Dropbox, OneDrive, SharePoint, MediaFire, MEGA",
      "Auto-convert share links to direct download URLs",
      "Google Drive virus scan confirmation page handled automatically",
      "MEGA support via megatools CLI",
      "Download progress with speed indicator",
      "Open file and open folder buttons after download",
      "Configurable download path (saved in Settings)",
      "Grid and list view toggle",
    ],
  },
  {
    category: "Manage Catalog",
    items: [
      "Add tools by scanning a GitHub repo URL",
      "Auto-detect releases, assets, icon, platforms, and install type",
      "Edit and remove existing tools",
      "Tags editor with chip add/remove (Enter or comma to add)",
      "Support for multiple install types: binary, archive, Inno Setup, Tauri NSIS",
      "Manage download links: add, edit, remove",
      "Link validation before adding (checks reachability)",
      "Upload custom icons for links to catalog repo",
      "Visible only for GitHub collaborators with push access",
    ],
  },
  {
    category: "Statistics",
    items: [
      "Total tools, installed count, disk usage",
      "Most launched tools ranking",
      "Profile export/import (backup installed tools list and favorites)",
    ],
  },
  {
    category: "Themes",
    items: [
      "6 preset themes: Steam Dark, Midnight Blue, Forest, Sunset, Arctic, Monokai",
      "Custom theme editor with color picker for all CSS variables",
      "Theme persistence across sessions",
    ],
  },
  {
    category: "Settings",
    items: [
      "GitHub login (PAT) with browser-based token creation",
      "API rate limit display with visual bar",
      "Desktop integration: add/remove AppImage from Linux app menu (with KDE support)",
      "Autostart on login (tauri-plugin-autostart)",
      "Default download path configuration",
      "Force refresh catalog button",
    ],
  },
  {
    category: "Self-Update",
    items: [
      "Automatic update check on startup",
      "Modal with download progress, speed, and percentage",
      "Signed updates (minisign) for security",
      "Cross-platform: AppImage.tar.gz (Linux), NSIS zip (Windows)",
    ],
  },
  {
    category: "Technical",
    items: [
      "Built with Tauri v2 (Rust) + SolidJS + TypeScript",
      "ETag caching for GitHub API (304 responses don't consume rate limit)",
      "Streaming downloads with cancellation support (CancellationToken)",
      "PNG icon validation (magic bytes check) with cache",
      "Embedded app icon (include_bytes!) for Linux desktop integration",
      "Atomic installs: extract to temp dir, then rename swap",
      "Tauri NSIS extraction via 7z (no installer execution, no UAC, no registry)",
      "Smart binary detection: finds exe even if name differs from catalog",
      "Desktop notifications for available updates",
      "Context menu disabled",
      "CI/CD: GitHub Actions with parallel Linux + Windows builds",
    ],
  },
];

const CHANGELOG = [
  {
    version: "v0.4.7",
    date: "2026-03-27",
    changes: [
      "Autostart support (launch on login)",
      "List/grid view toggle for Store and Library",
      "Tags editor in Manage Catalog",
      "Downloads section with Google Drive support",
      "Multi-cloud support: Dropbox, OneDrive, MediaFire, MEGA",
      "Download path configurable in Settings",
      "Link management in Manage Catalog (add/edit/remove)",
      "Icon upload for download links",
      "Open file / Open folder after download",
    ],
  },
  {
    version: "v0.4.3",
    date: "2026-03-21",
    changes: [
      "ETag caching for GitHub API rate limit optimization",
    ],
  },
  {
    version: "v0.4.1",
    date: "2026-03-21",
    changes: [
      "6 preset themes + custom theme editor",
      "Theme persistence via theme.json",
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-03-20",
    changes: [
      "Favorites with star toggle",
      "Custom tags per tool in catalog",
      "Changelog viewer (last 10 releases)",
      "Release notes preview in update badge",
      "Update All batch button in Library",
      "Sorting by name, date, or size",
      "Statistics page: disk usage, most launched, profile export/import",
      "Desktop notifications for available updates",
      "Ctrl+K global search shortcut",
      "Launch counter per tool",
    ],
  },
  {
    version: "v0.3.7",
    date: "2026-03-19",
    changes: [
      "Disable browser right-click context menu",
      "Run as Administrator button (Windows) with shield icon",
    ],
  },
  {
    version: "v0.3.4",
    date: "2026-03-19",
    changes: [
      "Cross-platform shortcuts: Linux hicolor icons + Windows Desktop & Start Menu",
      "Embedded app icon for Linux",
      "KDE Plasma desktop cache refresh (kbuildsycoca5)",
    ],
  },
  {
    version: "v0.3.1",
    date: "2026-03-19",
    changes: [
      "Confirm dialog before uninstall",
      "Hidden console when launching tools on Windows",
      "Manage Catalog visible only for collaborators with push access",
      "Force Refresh Catalog button in Settings",
      "\"Not Compatible\" tab in Store",
      "Launch button in Store for installed tools",
      "All buttons replaced with SVG icons",
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-03-19",
    changes: [
      "Manage Catalog page: add, edit, remove tools via GitHub API",
      "GitHub login flow (browser-based PAT creation)",
      "Tool icons from repo assets/icon.png",
      "Cancel download button",
      "Open install folder button",
      "Inno Setup and archive install support",
      "Tauri NSIS setup extraction (7z, no installer)",
    ],
  },
  {
    version: "v0.2.4",
    date: "2026-03-19",
    changes: [
      "Streaming download with progress bar and speed",
      "Tool author display",
      "Installed tool size in Library",
      "Desktop shortcuts for individual tools (Linux)",
      "GitHub logo button with SVG icon",
      "Tooltips on all buttons",
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-03-19",
    changes: [
      "Self-update via tauri-plugin-updater",
      "Update modal with download progress",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-03-18",
    changes: [
      "Initial release",
      "Store, Library, Settings pages",
      "Dark Steam-inspired UI",
      "Tool catalog from GitHub",
      "Download and install tools from GitHub Releases",
      "GitHub PAT support for higher rate limits",
      "Desktop integration (Linux AppImage menu)",
      "CI/CD with GitHub Actions (Linux + Windows)",
    ],
  },
];

export default function AboutPage() {
  return (
    <div class="page">
      <div class="page-header">
        <h2>About PyArsenal</h2>
      </div>

      <div class="settings-section">
        <p class="about-tagline">
          Personal tool distribution & update launcher — like Steam for your own tools.
        </p>
        <div class="about-meta">
          <span>Built with Tauri v2 + SolidJS + TypeScript</span>
          <span>&middot;</span>
          <span>Linux & Windows</span>
          <span>&middot;</span>
          <span>Open Source</span>
        </div>
      </div>

      <h3 class="section-title">Features</h3>
      <For each={FEATURES}>
        {(section) => (
          <div class="settings-section">
            <h3>{section.category}</h3>
            <ul class="feature-list">
              <For each={section.items}>
                {(item) => <li>{item}</li>}
              </For>
            </ul>
          </div>
        )}
      </For>

      <h3 class="section-title">Changelog</h3>
      <For each={CHANGELOG}>
        {(release) => (
          <div class="settings-section">
            <div class="changelog-release-header">
              <strong>{release.version}</strong>
              <span class="release-date">{release.date}</span>
            </div>
            <ul class="feature-list">
              <For each={release.changes}>
                {(change) => <li>{change}</li>}
              </For>
            </ul>
          </div>
        )}
      </For>
    </div>
  );
}
