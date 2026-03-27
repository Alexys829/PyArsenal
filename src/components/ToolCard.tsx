import { createSignal, onMount, Show } from "solid-js";
import { open } from "@tauri-apps/plugin-shell";
import type { CatalogEntry, InstalledTool, UpdateInfo } from "../lib/types";
import {
  installTool,
  cancelInstall,
  uninstallTool,
  launchTool,
  launchToolAdmin,
  openInstallFolder,
  createToolShortcut,
  removeToolShortcut,
  toolShortcutExists,
  toggleFavorite,
  getToolChangelog,
  getPlatform,
  getToolIcon,
} from "../lib/api";
import type { ReleaseInfo } from "../lib/types";
import {
  installedTools,
  setInstalledTools,
  updates,
  activeDownloads,
  setActiveDownloads,
  favorites,
  setFavorites,
  showToast,
  formatBytes,
  formatDate,
} from "../lib/stores";

// SVG Icons
const PlayIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>;
const DownloadIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>;
const UpdateIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 2.48-.94 4.96-2.82 6.86-3.72 3.72-9.76 3.72-13.48 0s-3.72-9.76 0-13.48 9.76-3.72 13.48 0L21 2v8.12z"/></svg>;
const CancelIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>;
const DeleteIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
const FolderIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>;
const BugIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20 8h-2.81a5.985 5.985 0 00-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/></svg>;
const GitHubIcon = () => <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>;
const ShortcutIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>;
const CheckIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>;
const ShieldIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>;
const StarIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>;
const StarOutlineIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>;
const ChangelogIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>;

interface ToolCardProps {
  entry: CatalogEntry;
  mode: "store" | "library";
  installedTool?: InstalledTool;
  updateInfo?: UpdateInfo;
  onRefresh: () => void;
  compact?: boolean;
}

export default function ToolCard(props: ToolCardProps) {
  const [busy, setBusy] = createSignal(false);
  const [hasShortcut, setHasShortcut] = createSignal(false);
  const [currentPlatform, setCurrentPlatform] = createSignal("");
  const [iconSrc, setIconSrc] = createSignal("");
  const [confirmUninstall, setConfirmUninstall] = createSignal(false);
  const [showChangelog, setShowChangelog] = createSignal(false);
  const [changelog, setChangelog] = createSignal<ReleaseInfo[]>([]);

  const isLinux = () => currentPlatform() === "linux";
  const isWindows = () => currentPlatform() === "windows";
  const isFav = () => favorites().includes(props.entry.id);

  onMount(async () => {
    try {
      const platform = await getPlatform();
      setCurrentPlatform(platform);
    } catch { /* ignore */ }
    if (props.mode === "library" && props.installedTool) {
      try {
        const exists = await toolShortcutExists(props.entry.id, props.entry.name);
        setHasShortcut(exists);
      } catch { /* ignore */ }
    }
    // Load icon
    try {
      const dataUrl = await getToolIcon(props.entry.repo, props.entry.id);
      if (dataUrl) {
        setIconSrc(dataUrl);
      }
    } catch { /* fallback to letter */ }
  });

  const isInstalled = () => !!installedTools()[props.entry.id];
  const dlProgress = () => activeDownloads()[props.entry.id];
  const update = () => updates().find((u) => u.tool_id === props.entry.id);
  const author = () => props.entry.author || props.entry.repo.split("/")[0] || "";

  async function handleInstall() {
    setBusy(true);
    setActiveDownloads((prev) => ({
      ...prev,
      [props.entry.id]: { tool_id: props.entry.id, downloaded: 0, total: 0, speed_bps: 0 },
    }));
    try {
      const tool = await installTool(props.entry.id, props.entry);
      setInstalledTools((prev) => ({ ...prev, [props.entry.id]: tool }));
      showToast("success", `${props.entry.name} installed!`);
    } catch (e) {
      if (!String(e).includes("cancelled")) {
        showToast("error", `Failed to install ${props.entry.name}: ${e}`);
      }
    } finally {
      setBusy(false);
      setActiveDownloads((prev) => { const n = { ...prev }; delete n[props.entry.id]; return n; });
      props.onRefresh();
    }
  }

  async function handleUpdate() {
    setBusy(true);
    setActiveDownloads((prev) => ({
      ...prev,
      [props.entry.id]: { tool_id: props.entry.id, downloaded: 0, total: 0, speed_bps: 0 },
    }));
    try {
      const tool = await installTool(props.entry.id, props.entry);
      setInstalledTools((prev) => ({ ...prev, [props.entry.id]: tool }));
      showToast("success", `${props.entry.name} updated to v${tool.installed_version}!`);
    } catch (e) {
      if (!String(e).includes("cancelled")) {
        showToast("error", `Failed to update ${props.entry.name}: ${e}`);
      }
    } finally {
      setBusy(false);
      setActiveDownloads((prev) => { const n = { ...prev }; delete n[props.entry.id]; return n; });
      props.onRefresh();
    }
  }

  async function handleCancel() {
    await cancelInstall(props.entry.id);
    setBusy(false);
    setActiveDownloads((prev) => { const n = { ...prev }; delete n[props.entry.id]; return n; });
    showToast("info", "Download cancelled.");
  }

  async function handleUninstall() {
    if (!confirmUninstall()) {
      setConfirmUninstall(true);
      setTimeout(() => setConfirmUninstall(false), 3000);
      return;
    }
    setConfirmUninstall(false);
    setBusy(true);
    try {
      await uninstallTool(props.entry.id);
      setInstalledTools((prev) => { const n = { ...prev }; delete n[props.entry.id]; return n; });
      setHasShortcut(false);
      showToast("success", `${props.entry.name} uninstalled.`);
    } catch (e) {
      showToast("error", `Failed to uninstall: ${e}`);
    } finally {
      setBusy(false);
      props.onRefresh();
    }
  }

  async function handleLaunch() {
    try { await launchTool(props.entry.id); }
    catch (e) { showToast("error", `Failed to launch: ${e}`); }
  }

  async function handleToggleShortcut() {
    if (!props.installedTool) return;
    try {
      if (hasShortcut()) {
        await removeToolShortcut(props.entry.id, props.entry.name);
        setHasShortcut(false);
        showToast("info", `Shortcut removed.`);
      } else {
        // Linux: app menu; Windows: desktop + start menu
        const type = isWindows() ? "both" : "desktop";
        await createToolShortcut(props.entry.id, props.entry.name, props.installedTool.binary_path, type);
        setHasShortcut(true);
        showToast("success", `Shortcut created.`);
      }
    } catch (e) { showToast("error", `${e}`); }
  }

  async function handleToggleFavorite() {
    try {
      const newState = await toggleFavorite(props.entry.id);
      setFavorites((prev) =>
        newState ? [...prev, props.entry.id] : prev.filter((f) => f !== props.entry.id)
      );
    } catch (e) { showToast("error", `${e}`); }
  }

  async function handleShowChangelog() {
    if (showChangelog()) {
      setShowChangelog(false);
      return;
    }
    try {
      const releases = await getToolChangelog(props.entry.repo);
      setChangelog(releases);
      setShowChangelog(true);
    } catch (e) { showToast("error", `Failed to load changelog: ${e}`); }
  }

  const categoryClass = () => {
    switch (props.entry.category.toLowerCase()) {
      case "utilities": return "cat-utilities";
      case "productivity": return "cat-productivity";
      default: return "cat-default";
    }
  };

  const progressPercent = () => {
    const p = dlProgress();
    if (!p || p.total === 0) return 0;
    return Math.round((p.downloaded / p.total) * 100);
  };

  return (
    <Show when={!props.compact} fallback={
      <div class="tool-row">
        <div class="tool-row-icon">
          {iconSrc() ? (
            <img src={iconSrc()} alt={props.entry.name} class="tool-icon-img" />
          ) : (
            props.entry.name[0]
          )}
        </div>
        <div class="tool-row-name">
          {props.entry.name}
          {props.mode === "library" && props.installedTool && (
            <span class="tool-row-version-sub">v{props.installedTool.installed_version}</span>
          )}
        </div>
        <span class={`category-badge ${categoryClass()}`}>{props.entry.category}</span>
        <span class="tool-row-author">by {author()}</span>
        {props.mode === "library" && props.installedTool && props.installedTool.size_bytes > 0 && (
          <span class="tool-row-size">{formatBytes(props.installedTool.size_bytes)}</span>
        )}
        {update() && <span class="update-badge">Update</span>}
        <div class="tool-row-actions">
          <button
            class={`btn-fav ${isFav() ? "btn-fav-active" : ""}`}
            onClick={handleToggleFavorite}
            title={isFav() ? "Remove from favorites" : "Add to favorites"}
          >
            {isFav() ? <StarIcon /> : <StarOutlineIcon />}
          </button>
          {props.mode === "store" && (
            <>
              {isInstalled() ? (
                <button class="btn btn-launch" onClick={handleLaunch} title={`Launch ${props.entry.name}`}>
                  <PlayIcon />
                </button>
              ) : busy() ? (
                <button class="btn btn-cancel" onClick={handleCancel} title="Cancel">
                  <CancelIcon />
                </button>
              ) : (
                <button class="btn btn-install" onClick={handleInstall} title={`Install ${props.entry.name}`}>
                  <DownloadIcon />
                </button>
              )}
            </>
          )}
          {props.mode === "library" && (
            <>
              <button class="btn btn-launch" onClick={handleLaunch} title={`Launch ${props.entry.name}`}>
                <PlayIcon />
              </button>
              {update() && !busy() && (
                <button class="btn btn-update" onClick={handleUpdate} title={`Update to v${update()!.latest_version}`}>
                  <UpdateIcon />
                </button>
              )}
              {busy() && (
                <button class="btn btn-cancel" onClick={handleCancel} title="Cancel">
                  <CancelIcon />
                </button>
              )}
              <button
                class={`btn ${confirmUninstall() ? "btn-confirm-delete" : "btn-icon-danger"}`}
                disabled={busy()}
                onClick={handleUninstall}
                title={confirmUninstall() ? "Click again to confirm" : `Uninstall ${props.entry.name}`}
              >
                <DeleteIcon />
              </button>
            </>
          )}
        </div>
      </div>
    }>
    <div class="tool-card">
      <div class="tool-card-header">
        <div class="tool-icon">
          {iconSrc() ? (
            <img src={iconSrc()} alt={props.entry.name} class="tool-icon-img" />
          ) : (
            props.entry.name[0]
          )}
        </div>
        <div class="tool-info">
          <h3>{props.entry.name}</h3>
          <div class="tool-meta">
            <span class={`category-badge ${categoryClass()}`}>{props.entry.category}</span>
            <span class="tool-author">by {author()}</span>
          </div>
        </div>
        <button
          class={`btn-fav ${isFav() ? "btn-fav-active" : ""}`}
          onClick={handleToggleFavorite}
          title={isFav() ? "Remove from favorites" : "Add to favorites"}
        >
          {isFav() ? <StarIcon /> : <StarOutlineIcon />}
        </button>
      </div>
      <p class="tool-description">{props.entry.description}</p>
      {props.entry.tags && props.entry.tags.length > 0 && (
        <div class="tool-tags">
          {props.entry.tags.map((tag) => <span class="tool-tag">{tag}</span>)}
        </div>
      )}

      {props.mode === "library" && props.installedTool && (
        <div class="tool-version">
          <span>v{props.installedTool.installed_version}</span>
          {props.installedTool.size_bytes > 0 && (
            <span class="tool-size">{formatBytes(props.installedTool.size_bytes)}</span>
          )}
          {update() && <span class="update-badge">v{update()!.latest_version} available</span>}
        </div>
      )}

      <Show when={dlProgress()}>
        <div class="download-info">
          <div class="progress-bar">
            <div class="progress-fill" style={{ width: `${progressPercent()}%` }} />
          </div>
          <div class="download-stats">
            <span>{progressPercent()}%</span>
            <span>{formatBytes(dlProgress()!.downloaded)} / {formatBytes(dlProgress()!.total)}</span>
            {dlProgress()!.speed_bps > 0 && <span>{formatBytes(dlProgress()!.speed_bps)}/s</span>}
          </div>
        </div>
      </Show>

      <div class="tool-actions">
        {props.mode === "store" && (
          <>
            {isInstalled() ? (
              <>
                <button class="btn btn-launch" onClick={handleLaunch} title={`Launch ${props.entry.name}`}>
                  <PlayIcon /> Launch
                </button>
              </>
            ) : busy() ? (
              <button class="btn btn-cancel" onClick={handleCancel} title="Cancel installation">
                <CancelIcon /> Cancel
              </button>
            ) : (
              <button class="btn btn-install" onClick={handleInstall} title={`Install ${props.entry.name}`}>
                <DownloadIcon /> Install
              </button>
            )}
            <button class="btn btn-icon" onClick={() => open(`https://github.com/${props.entry.repo}`)} title="View on GitHub">
              <GitHubIcon />
            </button>
          </>
        )}

        {props.mode === "library" && (
          <>
            <button class="btn btn-launch" onClick={handleLaunch} title={`Launch ${props.entry.name}`}>
              <PlayIcon />
            </button>
            <Show when={isWindows()}>
              <button
                class="btn btn-icon btn-admin"
                onClick={async () => {
                  try { await launchToolAdmin(props.entry.id); }
                  catch (e) { showToast("error", `${e}`); }
                }}
                title="Run as Administrator"
              >
                <ShieldIcon />
              </button>
            </Show>
            {update() && !busy() && (
              <button class="btn btn-update" onClick={handleUpdate} title={`Update to v${update()!.latest_version}`}>
                <UpdateIcon />
              </button>
            )}
            {busy() && (
              <button class="btn btn-cancel" onClick={handleCancel} title="Cancel download">
                <CancelIcon />
              </button>
            )}
            <button
              class={`btn ${hasShortcut() ? "btn-icon-active" : "btn-icon"}`}
              onClick={handleToggleShortcut}
              title={hasShortcut()
                ? "Remove shortcut"
                : isWindows()
                  ? "Add to Desktop & Start Menu"
                  : "Add to application menu"
              }
            >
              {hasShortcut() ? <CheckIcon /> : <ShortcutIcon />}
            </button>
            <button class="btn btn-icon" onClick={() => openInstallFolder(props.entry.id)} title="Open install folder">
              <FolderIcon />
            </button>
            <button class="btn btn-icon" onClick={() => open(`https://github.com/${props.entry.repo}`)} title="View on GitHub">
              <GitHubIcon />
            </button>
            <button class={`btn ${showChangelog() ? "btn-icon-active" : "btn-icon"}`} onClick={handleShowChangelog} title="Changelog">
              <ChangelogIcon />
            </button>
            <button class="btn btn-icon" onClick={() => open(`https://github.com/${props.entry.repo}/issues/new`)} title="Report bug">
              <BugIcon />
            </button>
            <button
              class={`btn ${confirmUninstall() ? "btn-confirm-delete" : "btn-icon-danger"}`}
              disabled={busy()}
              onClick={handleUninstall}
              title={confirmUninstall() ? "Click again to confirm" : `Uninstall ${props.entry.name}`}
            >
              <DeleteIcon />
              {confirmUninstall() && <span style={{ "margin-left": "4px" }}>Confirm?</span>}
            </button>
          </>
        )}
      </div>

      {/* Update release notes */}
      <Show when={update()?.release_notes}>
        <div class="release-notes-preview">
          <strong>v{update()!.latest_version}</strong>
          {update()!.release_date && <span class="release-date">{formatDate(update()!.release_date)}</span>}
          <p>{update()!.release_notes.slice(0, 200)}{update()!.release_notes.length > 200 ? "..." : ""}</p>
        </div>
      </Show>

      {/* Changelog panel */}
      <Show when={showChangelog() && changelog().length > 0}>
        <div class="changelog-panel">
          {changelog().map((r) => (
            <div class="changelog-entry">
              <div class="changelog-header">
                <strong>{r.version}</strong>
                <span class="release-date">{formatDate(r.published_at)}</span>
              </div>
              <p class="changelog-body">{r.body || "No release notes."}</p>
            </div>
          ))}
        </div>
      </Show>
    </div>
    </Show>
  );
}
