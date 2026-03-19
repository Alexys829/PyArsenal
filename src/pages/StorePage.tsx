import { createSignal, createMemo, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { catalog, loading } from "../lib/stores";
import ToolCard from "../components/ToolCard";
import SearchBar from "../components/SearchBar";

interface StorePageProps {
  onRefresh: () => void;
}

export default function StorePage(props: StorePageProps) {
  const [search, setSearch] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal("All");
  const [platform, setPlatform] = createSignal("linux");

  // Detect platform once
  invoke<string>("get_platform").then(setPlatform).catch(() => {});

  const compatible = createMemo(() =>
    catalog().filter((t) => t.platforms.includes(platform()))
  );

  const incompatible = createMemo(() =>
    catalog().filter((t) => !t.platforms.includes(platform()))
  );

  const categories = createMemo(() => {
    const cats = new Set(compatible().map((t) => t.category));
    const list = ["All", ...Array.from(cats).sort()];
    if (incompatible().length > 0) {
      list.push("Not Compatible");
    }
    return list;
  });

  const filtered = createMemo(() => {
    if (selectedCategory() === "Not Compatible") {
      const q = search().toLowerCase();
      if (!q) return incompatible();
      return incompatible().filter(
        (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }

    let tools = compatible();
    const q = search().toLowerCase();
    if (q) {
      tools = tools.filter(
        (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }
    if (selectedCategory() !== "All") {
      tools = tools.filter((t) => t.category === selectedCategory());
    }
    return tools;
  });

  const isIncompatibleTab = () => selectedCategory() === "Not Compatible";

  return (
    <div class="page">
      <div class="page-header">
        <h2>Store</h2>
        <SearchBar value={search()} onInput={setSearch} />
      </div>

      <div class="category-tabs">
        <For each={categories()}>
          {(cat) => (
            <button
              class={`tab ${selectedCategory() === cat ? "tab-active" : ""} ${cat === "Not Compatible" ? "tab-incompatible" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
              {cat === "Not Compatible" && ` (${incompatible().length})`}
            </button>
          )}
        </For>
      </div>

      <Show when={isIncompatibleTab()}>
        <p class="incompatible-hint">
          These tools are not available for your platform ({platform()}).
        </p>
      </Show>

      <Show when={!loading()} fallback={<div class="loading">Loading catalog...</div>}>
        <Show
          when={filtered().length > 0}
          fallback={<div class="empty">No tools found.</div>}
        >
          <div class={`tool-grid ${isIncompatibleTab() ? "tool-grid-dimmed" : ""}`}>
            <For each={filtered()}>
              {(entry) => (
                <ToolCard
                  entry={entry}
                  mode="store"
                  onRefresh={props.onRefresh}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
