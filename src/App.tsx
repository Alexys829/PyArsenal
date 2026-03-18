import { createSignal, onMount, Show } from "solid-js";
import { fetchCatalog, getInstalledTools, checkAllUpdates } from "./lib/api";
import {
  setCatalog,
  setInstalledTools,
  setUpdates,
  setLoading,
  showToast,
} from "./lib/stores";
import Sidebar from "./components/Sidebar";
import ToastContainer from "./components/Toast";
import StorePage from "./pages/StorePage";
import LibraryPage from "./pages/LibraryPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

function App() {
  const [page, setPage] = createSignal("store");

  async function loadData() {
    setLoading(true);
    try {
      const [catalogData, installed] = await Promise.all([
        fetchCatalog(),
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

  onMount(() => {
    loadData();
  });

  return (
    <div class="app">
      <Sidebar activePage={page()} onNavigate={setPage} />
      <main class="content">
        <Show when={page() === "store"}>
          <StorePage onRefresh={loadData} />
        </Show>
        <Show when={page() === "library"}>
          <LibraryPage onRefresh={loadData} />
        </Show>
        <Show when={page() === "settings"}>
          <SettingsPage />
        </Show>
      </main>
      <ToastContainer />
    </div>
  );
}

export default App;
