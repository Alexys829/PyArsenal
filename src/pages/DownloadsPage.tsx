import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { getCatalogLinks, downloadLink, getLinkIcon, getDefaultDownloadDir, getPrefs, openFile, openFileFolder } from "../lib/api";
import { showToast, formatBytes, type ViewMode } from "../lib/stores";
import SearchBar from "../components/SearchBar";
import type { LinkEntry, DownloadProgress } from "../lib/types";

export default function DownloadsPage() {
  const [links, setLinks] = createSignal<LinkEntry[]>([]);
  const [search, setSearch] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [downloadDir, setDownloadDir] = createSignal("");
  const [activeDownloads, setActiveDownloads] = createSignal<Record<string, DownloadProgress>>({});
  const [icons, setIcons] = createSignal<Record<string, string>>({});
  const [downloadedFiles, setDownloadedFiles] = createSignal<Record<string, string>>({});
  const [viewMode, setViewMode] = createSignal<ViewMode>(
    (localStorage.getItem("downloadsViewMode") as ViewMode) || "grid"
  );
  const updateViewMode = (mode: ViewMode) => { setViewMode(mode); localStorage.setItem("downloadsViewMode", mode); };

  onMount(async () => {
    // Listen for download progress
    listen<DownloadProgress>("download-progress", (event) => {
      setActiveDownloads((prev) => ({ ...prev, [event.payload.tool_id]: event.payload }));
    });

    // Load download dir from prefs, fallback to default
    try {
      const prefs = await getPrefs();
      if (prefs.download_dir) {
        setDownloadDir(prefs.download_dir);
      } else {
        const dir = await getDefaultDownloadDir();
        setDownloadDir(dir);
      }
    } catch {
      try { const dir = await getDefaultDownloadDir(); setDownloadDir(dir); }
      catch { /* ignore */ }
    }

    // Load links
    try {
      const entries = await getCatalogLinks();
      setLinks(entries);
      // Load icons
      for (const link of entries) {
        getLinkIcon(link.id).then((src) => {
          if (src) setIcons((prev) => ({ ...prev, [link.id]: src }));
        }).catch(() => {});
      }
    } catch {
      // Might fail without PAT
    } finally {
      setLoading(false);
    }
  });

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    if (!q) return links();
    return links().filter(
      (l) => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
        || l.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  async function handleDownload(link: LinkEntry) {
    const dir = downloadDir();
    if (!dir) {
      showToast("error", "No download directory set.");
      return;
    }
    setActiveDownloads((prev) => ({
      ...prev,
      [link.id]: { tool_id: link.id, downloaded: 0, total: 0, speed_bps: 0 },
    }));
    try {
      const path = await downloadLink(link.id, link.url, link.filename, dir);
      setDownloadedFiles((prev) => ({ ...prev, [link.id]: path }));
      showToast("success", `Downloaded: ${link.filename}`);
    } catch (e) {
      showToast("error", `Download failed: ${e}`);
    } finally {
      setActiveDownloads((prev) => {
        const n = { ...prev };
        delete n[link.id];
        return n;
      });
    }
  }

  const getProgress = (id: string) => {
    const p = activeDownloads()[id];
    if (!p || p.total === 0) return 0;
    return Math.round((p.downloaded / p.total) * 100);
  };

  return (
    <div class="page">
      <div class="page-header">
        <h2>Downloads</h2>
        <SearchBar value={search()} onInput={setSearch} placeholder="Search downloads..." />
      </div>

      <div class="library-summary">
        <span>Saving to: {downloadDir()}</span>
        <div class="view-toggle">
          <button
            class={`btn btn-icon ${viewMode() === "grid" ? "btn-icon-active" : ""}`}
            onClick={() => updateViewMode("grid")}
            title="Grid view"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z"/></svg>
          </button>
          <button
            class={`btn btn-icon ${viewMode() === "list" ? "btn-icon-active" : ""}`}
            onClick={() => updateViewMode("list")}
            title="List view"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/></svg>
          </button>
        </div>
      </div>

      <Show when={!loading()} fallback={<div class="loading">Loading downloads...</div>}>
        <Show when={filtered().length > 0} fallback={<div class="empty">No downloads available.</div>}>
          <div class={viewMode() === "grid" ? "tool-grid" : "tool-list"}>
            <For each={filtered()}>
              {(link) => viewMode() === "grid" ? (
                <div class="tool-card">
                  <div class="tool-card-header">
                    <div class="tool-icon">
                      {icons()[link.id] ? (
                        <img src={icons()[link.id]} alt={link.name} class="tool-icon-img" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                        </svg>
                      )}
                    </div>
                    <div class="tool-info">
                      <h3>{link.name}</h3>
                      <div class="tool-meta">
                        {link.category && <span class="category-badge cat-default">{link.category}</span>}
                        {link.added_by && <span class="tool-author">by {link.added_by}</span>}
                      </div>
                    </div>
                  </div>
                  <p class="tool-description">{link.description}</p>
                  {link.tags.length > 0 && (
                    <div class="tool-tags">
                      {link.tags.map((tag) => <span class="tool-tag">{tag}</span>)}
                    </div>
                  )}
                  <div class="link-filename">{link.filename}</div>
                  <Show when={activeDownloads()[link.id]}>
                    <div class="download-info">
                      <div class="progress-bar">
                        <div class="progress-fill" style={{ width: `${getProgress(link.id)}%` }} />
                      </div>
                      <div class="download-stats">
                        <span>{getProgress(link.id)}%</span>
                        <span>{formatBytes(activeDownloads()[link.id]!.downloaded)} / {formatBytes(activeDownloads()[link.id]!.total)}</span>
                        {activeDownloads()[link.id]!.speed_bps > 0 && <span>{formatBytes(activeDownloads()[link.id]!.speed_bps)}/s</span>}
                      </div>
                    </div>
                  </Show>
                  <div class="tool-actions">
                    <button class="btn btn-install" disabled={!!activeDownloads()[link.id]} onClick={() => handleDownload(link)} title={`Download ${link.filename}`}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                      {activeDownloads()[link.id] ? "Downloading..." : downloadedFiles()[link.id] ? "Re-download" : "Download"}
                    </button>
                    {downloadedFiles()[link.id] && (
                      <>
                        <button class="btn btn-icon" onClick={() => openFile(downloadedFiles()[link.id]!)} title="Open file">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                        </button>
                        <button class="btn btn-icon" onClick={() => openFileFolder(downloadedFiles()[link.id]!)} title="Open folder">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* List view - same structure as ToolCard compact */
                <div class="tool-row">
                  <div class="tool-row-icon">
                    {icons()[link.id] ? (
                      <img src={icons()[link.id]} alt={link.name} class="tool-icon-img" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    )}
                  </div>
                  <div class="tool-row-name">
                    {link.name}
                    <span class="tool-row-version-sub">{link.filename}</span>
                  </div>
                  {link.category && <span class="category-badge cat-default">{link.category}</span>}
                  {link.added_by && <span class="tool-row-author">by {link.added_by}</span>}
                  <div class="tool-row-actions">
                    {activeDownloads()[link.id] ? (
                      <span style={{ "font-size": "11px", color: "var(--accent)" }}>{getProgress(link.id)}%</span>
                    ) : (
                      <button class="btn btn-install" onClick={() => handleDownload(link)} title="Download">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                      </button>
                    )}
                    {downloadedFiles()[link.id] && (
                      <>
                        <button class="btn btn-launch" onClick={() => openFile(downloadedFiles()[link.id]!)} title="Open">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                        </button>
                        <button class="btn btn-icon" onClick={() => openFileFolder(downloadedFiles()[link.id]!)} title="Open folder">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
