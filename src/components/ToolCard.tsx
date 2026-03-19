import { createSignal, onMount, Show } from "solid-js";
import { open } from "@tauri-apps/plugin-shell";
import type { CatalogEntry, InstalledTool, UpdateInfo } from "../lib/types";
import {
  installTool,
  uninstallTool,
  launchTool,
  createToolShortcut,
  removeToolShortcut,
  toolShortcutExists,
  getPlatform,
} from "../lib/api";
import {
  installedTools,
  setInstalledTools,
  updates,
  activeDownloads,
  setActiveDownloads,
  showToast,
  formatBytes,
} from "../lib/stores";

interface ToolCardProps {
  entry: CatalogEntry;
  mode: "store" | "library";
  installedTool?: InstalledTool;
  updateInfo?: UpdateInfo;
  onRefresh: () => void;
}

export default function ToolCard(props: ToolCardProps) {
  const [busy, setBusy] = createSignal(false);
  const [hasShortcut, setHasShortcut] = createSignal(false);
  const [isLinux, setIsLinux] = createSignal(false);

  onMount(async () => {
    try {
      const platform = await getPlatform();
      setIsLinux(platform === "linux");
    } catch { /* ignore */ }
    if (props.mode === "library" && props.installedTool) {
      try {
        const exists = await toolShortcutExists(props.entry.id);
        setHasShortcut(exists);
      } catch { /* ignore */ }
    }
  });

  const isInstalled = () => !!installedTools()[props.entry.id];
  const dlProgress = () => activeDownloads()[props.entry.id];
  const update = () => updates().find((u) => u.tool_id === props.entry.id);

  const author = () => {
    if (props.entry.author) return props.entry.author;
    return props.entry.repo.split("/")[0] || "";
  };

  async function handleInstall() {
    setBusy(true);
    setActiveDownloads((prev) => ({
      ...prev,
      [props.entry.id]: { tool_id: props.entry.id, downloaded: 0, total: 0, speed_bps: 0 },
    }));
    try {
      const tool = await installTool(props.entry.id, props.entry);
      setInstalledTools((prev) => ({ ...prev, [props.entry.id]: tool }));
      showToast("success", `${props.entry.name} installed successfully!`);
    } catch (e) {
      showToast("error", `Failed to install ${props.entry.name}: ${e}`);
    } finally {
      setBusy(false);
      setActiveDownloads((prev) => {
        const next = { ...prev };
        delete next[props.entry.id];
        return next;
      });
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
      showToast("error", `Failed to update ${props.entry.name}: ${e}`);
    } finally {
      setBusy(false);
      setActiveDownloads((prev) => {
        const next = { ...prev };
        delete next[props.entry.id];
        return next;
      });
      props.onRefresh();
    }
  }

  async function handleUninstall() {
    setBusy(true);
    try {
      await uninstallTool(props.entry.id);
      setInstalledTools((prev) => {
        const next = { ...prev };
        delete next[props.entry.id];
        return next;
      });
      setHasShortcut(false);
      showToast("success", `${props.entry.name} uninstalled.`);
    } catch (e) {
      showToast("error", `Failed to uninstall ${props.entry.name}: ${e}`);
    } finally {
      setBusy(false);
      props.onRefresh();
    }
  }

  async function handleLaunch() {
    try {
      await launchTool(props.entry.id);
    } catch (e) {
      showToast("error", `Failed to launch ${props.entry.name}: ${e}`);
    }
  }

  async function handleBugReport() {
    const url = `https://github.com/${props.entry.repo}/issues/new`;
    await open(url);
  }

  async function handleOpenRepo() {
    const url = `https://github.com/${props.entry.repo}`;
    await open(url);
  }

  async function handleToggleShortcut() {
    if (!props.installedTool) return;
    try {
      if (hasShortcut()) {
        await removeToolShortcut(props.entry.id);
        setHasShortcut(false);
        showToast("info", `Desktop shortcut removed for ${props.entry.name}.`);
      } else {
        await createToolShortcut(
          props.entry.id,
          props.entry.name,
          props.installedTool.binary_path
        );
        setHasShortcut(true);
        showToast("success", `Desktop shortcut created for ${props.entry.name}.`);
      }
    } catch (e) {
      showToast("error", `Shortcut error: ${e}`);
    }
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
    <div class="tool-card">
      <div class="tool-card-header">
        <div class="tool-icon">{props.entry.name[0]}</div>
        <div class="tool-info">
          <h3>{props.entry.name}</h3>
          <div class="tool-meta">
            <span class={`category-badge ${categoryClass()}`}>
              {props.entry.category}
            </span>
            <span class="tool-author">by {author()}</span>
          </div>
        </div>
      </div>
      <p class="tool-description">{props.entry.description}</p>

      {props.mode === "library" && props.installedTool && (
        <div class="tool-version">
          <span>v{props.installedTool.installed_version}</span>
          {props.installedTool.size_bytes > 0 && (
            <span class="tool-size">{formatBytes(props.installedTool.size_bytes)}</span>
          )}
          {update() && (
            <span class="update-badge">
              v{update()!.latest_version} available
            </span>
          )}
        </div>
      )}

      <Show when={dlProgress()}>
        <div class="download-info">
          <div class="progress-bar">
            <div class="progress-fill" style={{ width: `${progressPercent()}%` }} />
          </div>
          <div class="download-stats">
            <span>{progressPercent()}%</span>
            <span>
              {formatBytes(dlProgress()!.downloaded)} / {formatBytes(dlProgress()!.total)}
            </span>
            {dlProgress()!.speed_bps > 0 && (
              <span>{formatBytes(dlProgress()!.speed_bps)}/s</span>
            )}
          </div>
        </div>
      </Show>

      <div class="tool-actions">
        {props.mode === "store" && (
          <>
            {isInstalled() ? (
              <button class="btn btn-installed" disabled title="Already installed">
                Installed
              </button>
            ) : (
              <button
                class="btn btn-install"
                disabled={busy()}
                onClick={handleInstall}
                title={`Download and install ${props.entry.name}`}
              >
                {busy() ? "Installing..." : "Install"}
              </button>
            )}
            <button
              class="btn btn-github"
              onClick={handleOpenRepo}
              title="View on GitHub"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            </button>
          </>
        )}

        {props.mode === "library" && (
          <>
            <button class="btn btn-launch" onClick={handleLaunch} title={`Launch ${props.entry.name}`}>
              Launch
            </button>
            {update() && (
              <button
                class="btn btn-update"
                disabled={busy()}
                onClick={handleUpdate}
                title={`Update to v${update()!.latest_version}`}
              >
                {busy() ? "Updating..." : "Update"}
              </button>
            )}
            <Show when={isLinux()}>
              <button
                class={`btn ${hasShortcut() ? "btn-shortcut-active" : "btn-shortcut"}`}
                onClick={handleToggleShortcut}
                title={hasShortcut() ? "Remove from application menu" : "Add to application menu"}
              >
                {hasShortcut() ? "Shortcut \u2713" : "Shortcut"}
              </button>
            </Show>
            <button
              class="btn btn-github"
              onClick={handleOpenRepo}
              title="View on GitHub"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            </button>
            <button
              class="btn btn-bug"
              onClick={handleBugReport}
              title="Report a bug on GitHub"
            >
              Bug
            </button>
            <button
              class="btn btn-uninstall"
              disabled={busy()}
              onClick={handleUninstall}
              title={`Uninstall ${props.entry.name}`}
            >
              &times;
            </button>
          </>
        )}
      </div>
    </div>
  );
}
