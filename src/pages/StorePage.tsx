import { createSignal, createMemo, For, Show } from "solid-js";
import { catalog, loading } from "../lib/stores";
import ToolCard from "../components/ToolCard";
import SearchBar from "../components/SearchBar";

interface StorePageProps {
  onRefresh: () => void;
}

export default function StorePage(props: StorePageProps) {
  const [search, setSearch] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal("All");

  const categories = createMemo(() => {
    const cats = new Set(catalog().map((t) => t.category));
    return ["All", ...Array.from(cats).sort()];
  });

  const filtered = createMemo(() => {
    let tools = catalog();
    const q = search().toLowerCase();
    if (q) {
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    if (selectedCategory() !== "All") {
      tools = tools.filter((t) => t.category === selectedCategory());
    }
    return tools;
  });

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
              class={`tab ${selectedCategory() === cat ? "tab-active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          )}
        </For>
      </div>

      <Show when={!loading()} fallback={<div class="loading">Loading catalog...</div>}>
        <Show
          when={filtered().length > 0}
          fallback={<div class="empty">No tools found.</div>}
        >
          <div class="tool-grid">
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
