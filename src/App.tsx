import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { listen } from "@tauri-apps/api/event";
import { fetchCatalog, getInstalledTools, checkAllUpdates, getCatalogEntries, checkCatalogPermission } from "./lib/api";
import type { DownloadProgress } from "./lib/types";
import {
  setCatalog,
  setInstalledTools,
  setUpdates,
  setActiveDownloads,
  setLoading,
  showToast,
  formatBytes,
} from "./lib/stores";
import Sidebar from "./components/Sidebar";
import ToastContainer from "./components/Toast";
import StorePage from "./pages/StorePage";
import LibraryPage from "./pages/LibraryPage";
import SettingsPage from "./pages/SettingsPage";
import AddToolPage from "./pages/AddToolPage";
import "./App.css";

function App() {
  const [page, setPage] = createSignal("store");
  const [selfUpdateStatus, setSelfUpdateStatus] = createSignal("");
  const [selfUpdateProgress, setSelfUpdateProgress] = createSignal(0);
  const [selfUpdateTotal, setSelfUpdateTotal] = createSignal(0);
  const [selfUpdateVisible, setSelfUpdateVisible] = createSignal(false);
  const [canManageCatalog, setCanManageCatalog] = createSignal(false);

  async function loadData(forceApi?: boolean) {
    setLoading(true);
    try {
      // After catalog changes, use API (no CDN cache) to get fresh data
      const catalogPromise = forceApi
        ? getCatalogEntries().catch(() => fetchCatalog())
        : fetchCatalog();
      const [catalogData, installed] = await Promise.all([
        catalogPromise,
        getInstalledTools(),
      ]);
      setCatalog(catalogData);
      setInstalledTools(installed);
    } catch (e) {
      showToast("error", `Failed to load data: ${e}`);
    } finally {
      setLoading(false);
    }

    // Check updates in background
    try {
      const updateList = await checkAllUpdates();
      setUpdates(updateList);
      if (updateList.length > 0) {
        showToast("info", `${updateList.length} update(s) available.`);
      }
    } catch {
      // Silent fail for update check
    }
  }

  async function checkSelfUpdate() {
    try {
      const update = await check();
      if (!update) return;

      setSelfUpdateVisible(true);
      setSelfUpdateStatus(`PyArsenal ${update.version} found. Downloading...`);

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            setSelfUpdateTotal(contentLength);
            setSelfUpdateStatus(`Downloading PyArsenal ${update.version}...`);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setSelfUpdateProgress(downloaded);
            break;
          case "Finished":
            setSelfUpdateStatus("Installing update...");
            break;
        }
      });

      setSelfUpdateStatus("Update installed! Restarting...");
      await new Promise((r) => setTimeout(r, 1000));
      await relaunch();
    } catch {
      setSelfUpdateVisible(false);
    }
  }

  onMount(async () => {
    const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
      setActiveDownloads((prev) => ({
        ...prev,
        [event.payload.tool_id]: event.payload,
      }));
    });
    onCleanup(() => unlisten());

    loadData();
    checkSelfUpdate();
    checkCatalogPermission().then(setCanManageCatalog).catch(() => {});
  });

  const updatePercent = () => {
    if (selfUpdateTotal() === 0) return 0;
    return Math.round((selfUpdateProgress() / selfUpdateTotal()) * 100);
  };

  return (
    <div class="app">
      <Sidebar activePage={page()} onNavigate={setPage} showManage={canManageCatalog()} />
      <main class="content">
        <Show when={page() === "store"}>
          <StorePage onRefresh={loadData} />
        </Show>
        <Show when={page() === "library"}>
          <LibraryPage onRefresh={loadData} />
        </Show>
        <Show when={page() === "addtool"}>
          <AddToolPage onRefresh={() => loadData(true)} />
        </Show>
        <Show when={page() === "settings"}>
          <SettingsPage />
        </Show>
      </main>
      <ToastContainer />

      {/* Self-update modal */}
      <Show when={selfUpdateVisible()}>
        <div class="modal-overlay">
          <div class="modal-update">
            <h3>Updating PyArsenal</h3>
            <p class="modal-status">{selfUpdateStatus()}</p>
            <div class="progress-bar modal-progress">
              <div class="progress-fill" style={{ width: `${updatePercent()}%` }} />
            </div>
            <div class="modal-stats">
              <span>{updatePercent()}%</span>
              <span>
                {formatBytes(selfUpdateProgress())} / {formatBytes(selfUpdateTotal())}
              </span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default App;
