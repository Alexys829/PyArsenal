import { createSignal } from "solid-js";
import { open } from "@tauri-apps/plugin-shell";
import type { CatalogEntry, InstalledTool, UpdateInfo } from "../lib/types";
import { installTool, uninstallTool, launchTool } from "../lib/api";
import {
  installedTools,
  setInstalledTools,
  updates,
  activeDownloads,
  setActiveDownloads,
  showToast,
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

  const isInstalled = () => !!installedTools()[props.entry.id];
  const downloadProgress = () => activeDownloads()[props.entry.id];
  const update = () =>
    updates().find((u) => u.tool_id === props.entry.id);

  async function handleInstall() {
    setBusy(true);
    setActiveDownloads((prev) => ({ ...prev, [props.entry.id]: 0 }));
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
    try {
      const tool = await installTool(props.entry.id, props.entry);
      setInstalledTools((prev) => ({ ...prev, [props.entry.id]: tool }));
      showToast("success", `${props.entry.name} updated to v${tool.installed_version}!`);
    } catch (e) {
      showToast("error", `Failed to update ${props.entry.name}: ${e}`);
    } finally {
      setBusy(false);
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

  const categoryClass = () => {
    switch (props.entry.category.toLowerCase()) {
      case "utilities": return "cat-utilities";
      case "productivity": return "cat-productivity";
      default: return "cat-default";
    }
  };

  return (
    <div class="tool-card">
      <div class="tool-card-header">
        <div class="tool-icon">{props.entry.name[0]}</div>
        <div class="tool-info">
          <h3>{props.entry.name}</h3>
          <span class={`category-badge ${categoryClass()}`}>
            {props.entry.category}
          </span>
        </div>
      </div>
      <p class="tool-description">{props.entry.description}</p>

      {props.mode === "library" && props.installedTool && (
        <div class="tool-version">
          <span>v{props.installedTool.installed_version}</span>
          {update() && (
            <span class="update-badge">
              v{update()!.latest_version} available
            </span>
          )}
        </div>
      )}

      {downloadProgress() !== undefined && (
        <div class="progress-bar">
          <div class="progress-fill" style={{ width: "100%" }} />
        </div>
      )}

      <div class="tool-actions">
        {props.mode === "store" && (
          <>
            {isInstalled() ? (
              <button class="btn btn-installed" disabled>
                Installed
              </button>
            ) : (
              <button
                class="btn btn-install"
                disabled={busy()}
                onClick={handleInstall}
              >
                {busy() ? "Installing..." : "Install"}
              </button>
            )}
          </>
        )}

        {props.mode === "library" && (
          <>
            <button class="btn btn-launch" onClick={handleLaunch}>
              Launch
            </button>
            {update() && (
              <button
                class="btn btn-update"
                disabled={busy()}
                onClick={handleUpdate}
              >
                {busy() ? "Updating..." : "Update"}
              </button>
            )}
            <button
              class="btn btn-bug"
              onClick={handleBugReport}
              title="Report a bug"
            >
              Bug
            </button>
            <button
              class="btn btn-uninstall"
              disabled={busy()}
              onClick={handleUninstall}
              title="Uninstall"
            >
              &times;
            </button>
          </>
        )}
      </div>
    </div>
  );
}
