import { createSignal, createMemo, For, Show } from "solid-js";
import { catalog, installedTools, updates } from "../lib/stores";
import ToolCard from "../components/ToolCard";
import SearchBar from "../components/SearchBar";

interface LibraryPageProps {
  onRefresh: () => void;
}

export default function LibraryPage(props: LibraryPageProps) {
  const [search, setSearch] = createSignal("");

  const installedEntries = createMemo(() => {
    const installed = installedTools();
    const catalogList = catalog();
    const q = search().toLowerCase();

    return Object.keys(installed)
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
  });

  return (
    <div class="page">
      <div class="page-header">
        <h2>Library</h2>
        <SearchBar
          value={search()}
          onInput={setSearch}
          placeholder="Search installed tools..."
        />
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
        <div class="tool-grid">
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
                    platforms: [],
                    asset_patterns: {},
                    binary_name: {},
                  }
                }
                mode="library"
                installedTool={tool}
                updateInfo={updateInfo}
                onRefresh={props.onRefresh}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
