import { createSignal, createMemo, For, Show } from "solid-js";
import { catalog, installedTools, updates, favorites, formatBytes, libraryViewMode, setLibraryViewMode } from "../lib/stores";
import { installTool } from "../lib/api";
import { showToast, setInstalledTools } from "../lib/stores";
import ToolCard from "../components/ToolCard";
import SearchBar from "../components/SearchBar";

interface LibraryPageProps {
  onRefresh: () => void;
}

type SortBy = "name" | "date" | "size";

export default function LibraryPage(props: LibraryPageProps) {
  const [search, setSearch] = createSignal("");
  const [sortBy, setSortBy] = createSignal<SortBy>("name");
  const [updatingAll, setUpdatingAll] = createSignal(false);

  const updatesAvailable = () => updates().length;

  const installedEntries = createMemo(() => {
    const installed = installedTools();
    const catalogList = catalog();
    const q = search().toLowerCase();
    const favs = favorites();

    let entries = Object.keys(installed)
      .map((id) => {
        const tool = installed[id];
        const entry = catalogList.find((c) => c.id === id);
        const updateInfo = updates().find((u) => u.tool_id === id);
        return { tool, entry, updateInfo };
      })
      .filter(({ tool }) => {
        if (!q) return true;
        return tool.name.toLowerCase().includes(q);
      });

    // Sort
    const sort = sortBy();
    entries.sort((a, b) => {
      // Favorites first
      const aFav = favs.includes(a.tool.id) ? 0 : 1;
      const bFav = favs.includes(b.tool.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      if (sort === "name") return a.tool.name.localeCompare(b.tool.name);
      if (sort === "date") return b.tool.updated_at.localeCompare(a.tool.updated_at);
      if (sort === "size") return (b.tool.size_bytes || 0) - (a.tool.size_bytes || 0);
      return 0;
    });

    return entries;
  });

  async function handleUpdateAll() {
    setUpdatingAll(true);
    const catalogList = catalog();
    let success = 0;
    let failed = 0;

    for (const u of updates()) {
      const entry = catalogList.find((c) => c.id === u.tool_id);
      if (!entry) { failed++; continue; }
      try {
        const tool = await installTool(u.tool_id, entry);
        setInstalledTools((prev) => ({ ...prev, [u.tool_id]: tool }));
        success++;
      } catch {
        failed++;
      }
    }

    setUpdatingAll(false);
    if (success > 0) showToast("success", `${success} tool(s) updated.`);
    if (failed > 0) showToast("error", `${failed} update(s) failed.`);
    props.onRefresh();
  }

  return (
    <div class="page">
      <div class="page-header">
        <h2>Library</h2>
        <div class="library-controls">
          <Show when={updatesAvailable() > 0}>
            <button
              class="btn btn-update"
              onClick={handleUpdateAll}
              disabled={updatingAll()}
              title={`Update ${updatesAvailable()} tool(s)`}
            >
              {updatingAll() ? "Updating..." : `Update All (${updatesAvailable()})`}
            </button>
          </Show>
          <select class="sort-select" value={sortBy()} onChange={(e) => setSortBy(e.currentTarget.value as SortBy)}>
            <option value="name">Sort: Name</option>
            <option value="date">Sort: Recent</option>
            <option value="size">Sort: Size</option>
          </select>
          <SearchBar
            value={search()}
            onInput={setSearch}
            placeholder="Search installed... (Ctrl+K)"
          />
        </div>
      </div>

      <div class="library-summary">
        <span>
          {Object.keys(installedTools()).length} installed
          {updatesAvailable() > 0 && <span class="update-badge" style={{ "margin-left": "8px" }}>{updatesAvailable()} update(s)</span>}
        </span>
        <div class="view-toggle">
          <button
            class={`btn btn-icon ${libraryViewMode() === "grid" ? "btn-icon-active" : ""}`}
            onClick={() => setLibraryViewMode("grid")}
            title="Grid view"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z"/></svg>
          </button>
          <button
            class={`btn btn-icon ${libraryViewMode() === "list" ? "btn-icon-active" : ""}`}
            onClick={() => setLibraryViewMode("list")}
            title="List view"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/></svg>
          </button>
        </div>
      </div>

      <Show
        when={installedEntries().length > 0}
        fallback={
          <div class="empty">
            <p>No tools installed yet.</p>
            <p class="empty-hint">Browse the Store to find and install tools.</p>
          </div>
        }
      >
        <div class={libraryViewMode() === "grid" ? "tool-grid" : "tool-list"}>
          <For each={installedEntries()}>
            {({ tool, entry, updateInfo }) => (
              <ToolCard
                entry={
                  entry || {
                    id: tool.id,
                    name: tool.name,
                    description: "",
                    category: "Unknown",
                    icon: "",
                    repo: tool.repo,
                    author: "",
                    platforms: [],
                    asset_patterns: {},
                    binary_name: {},
                    install_type: {},
                    tags: [],
                  }
                }
                mode="library"
                installedTool={tool}
                updateInfo={updateInfo}
                onRefresh={props.onRefresh}
                compact={libraryViewMode() === "list"}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
