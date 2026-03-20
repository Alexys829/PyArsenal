import { createSignal, onMount, For, Show } from "solid-js";
import { getStats, exportProfile, importProfile } from "../lib/api";
import { catalog, installedTools, showToast, formatBytes } from "../lib/stores";
import type { AppStats, ExportProfile } from "../lib/types";

export default function StatsPage() {
  const [stats, setStats] = createSignal<AppStats | null>(null);
  const [exporting, setExporting] = createSignal(false);

  onMount(async () => {
    try {
      const s = await getStats();
      s.total_tools = catalog().length;
      setStats(s);
    } catch { /* ignore */ }
  });

  async function handleExport() {
    setExporting(true);
    try {
      const json = await exportProfile();
      // Create a download link
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pyarsenal-profile-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("success", "Profile exported!");
    } catch (e) {
      showToast("error", `Export failed: ${e}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const json = await file.text();
        const profile = await importProfile(json);
        showToast("success", `Profile imported: ${profile.tools.length} tool(s), ${profile.favorites.length} favorite(s). Reinstall tools from the Store.`);
      } catch (e) {
        showToast("error", `Import failed: ${e}`);
      }
    };
    input.click();
  }

  return (
    <div class="page">
      <div class="page-header">
        <h2>Statistics</h2>
      </div>

      <Show when={stats()}>
        {(s) => (
          <>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">{s().total_tools}</div>
                <div class="stat-label">Total Tools</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{s().installed_tools}</div>
                <div class="stat-label">Installed</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{formatBytes(s().total_size_bytes)}</div>
                <div class="stat-label">Disk Usage</div>
              </div>
            </div>

            <Show when={s().most_launched.length > 0}>
              <div class="settings-section">
                <h3>Most Launched</h3>
                <div class="catalog-list">
                  <For each={s().most_launched}>
                    {([id, count]) => {
                      const tool = installedTools()[id];
                      return (
                        <div class="catalog-item">
                          <div class="catalog-item-info">
                            <strong>{tool?.name || id}</strong>
                          </div>
                          <span class="stat-count">{count} launches</span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>
          </>
        )}
      </Show>

      <div class="settings-section">
        <h3>Profile Backup</h3>
        <p class="settings-hint">
          Export your installed tools list and favorites to a JSON file, or import a previously exported profile.
        </p>
        <div class="pat-actions">
          <button class="btn btn-install" onClick={handleExport} disabled={exporting()}>
            {exporting() ? "Exporting..." : "Export Profile"}
          </button>
          <button class="btn btn-small" onClick={handleImport}>
            Import Profile
          </button>
        </div>
      </div>
    </div>
  );
}
