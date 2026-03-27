import { createSignal, Show, For, onMount } from "solid-js";
import { scanRepo, addToCatalog, removeFromCatalog, updateInCatalog, getCatalogEntries } from "../lib/api";
import { showToast } from "../lib/stores";
import type { RepoScanResult, CatalogEntry } from "../lib/types";

interface AddToolPageProps {
  onRefresh: () => void;
}

const CATEGORIES = ["Utilities", "Productivity", "Development", "Media", "Security", "Other"];

export default function AddToolPage(props: AddToolPageProps) {
  const [repoUrl, setRepoUrl] = createSignal("");
  const [scanning, setScanning] = createSignal(false);
  const [adding, setAdding] = createSignal(false);
  const [scanResult, setScanResult] = createSignal<RepoScanResult | null>(null);

  // Existing catalog entries
  const [catalogEntries, setCatalogEntries] = createSignal<CatalogEntry[]>([]);
  const [loadingCatalog, setLoadingCatalog] = createSignal(false);
  const [editingEntry, setEditingEntry] = createSignal<CatalogEntry | null>(null);

  // Editable fields
  const [toolId, setToolId] = createSignal("");
  const [toolName, setToolName] = createSignal("");
  const [toolDesc, setToolDesc] = createSignal("");
  const [toolCategory, setToolCategory] = createSignal("Utilities");
  const [toolAuthor, setToolAuthor] = createSignal("");
  const [linuxAsset, setLinuxAsset] = createSignal("");
  const [windowsAsset, setWindowsAsset] = createSignal("");
  const [linuxBinary, setLinuxBinary] = createSignal("");
  const [windowsBinary, setWindowsBinary] = createSignal("");
  const [linuxInstallType, setLinuxInstallType] = createSignal("binary");
  const [windowsInstallType, setWindowsInstallType] = createSignal("binary");
  const [toolTags, setToolTags] = createSignal("");
  const [tagInput, setTagInput] = createSignal("");

  onMount(() => loadCatalog());

  async function loadCatalog() {
    setLoadingCatalog(true);
    try {
      const entries = await getCatalogEntries();
      setCatalogEntries(entries);
    } catch {
      // Silent — might not have PAT
    } finally {
      setLoadingCatalog(false);
    }
  }

  function fillForm(entry: CatalogEntry) {
    setToolId(entry.id);
    setToolName(entry.name);
    setToolDesc(entry.description);
    setToolCategory(entry.category);
    setToolAuthor(entry.author || entry.repo.split("/")[0]);
    setLinuxAsset(entry.asset_patterns.linux || "");
    setWindowsAsset(entry.asset_patterns.windows || "");
    setLinuxBinary(entry.binary_name.linux || "");
    setWindowsBinary(entry.binary_name.windows || "");
    setLinuxInstallType(entry.install_type?.linux || "binary");
    setWindowsInstallType(entry.install_type?.windows || "binary");
    setToolTags((entry.tags || []).join(", "));
  }

  async function handleScan() {
    const url = repoUrl().trim();
    if (!url) return;
    setScanning(true);
    setScanResult(null);
    setEditingEntry(null);
    try {
      const result = await scanRepo(url);
      setScanResult(result);
      fillForm(result.suggested_entry);
    } catch (e) {
      showToast("error", `Scan failed: ${e}`);
    } finally {
      setScanning(false);
    }
  }

  function buildEntry(repo: string): CatalogEntry {
    const platforms: string[] = [];
    const assetPatterns: Record<string, string> = {};
    const binaryName: Record<string, string> = {};
    const installType: Record<string, string> = {};

    if (linuxAsset()) {
      platforms.push("linux");
      assetPatterns.linux = linuxAsset();
      binaryName.linux = linuxBinary();
      if (linuxInstallType() !== "binary") installType.linux = linuxInstallType();
    }
    if (windowsAsset()) {
      platforms.push("windows");
      assetPatterns.windows = windowsAsset();
      binaryName.windows = windowsBinary();
      if (windowsInstallType() !== "binary") installType.windows = windowsInstallType();
    }

    return {
      id: toolId(),
      name: toolName(),
      description: toolDesc(),
      category: toolCategory(),
      icon: "icon.png",
      repo,
      author: toolAuthor(),
      platforms,
      asset_patterns: assetPatterns,
      binary_name: binaryName,
      install_type: installType,
      tags: toolTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0),
    };
  }

  async function handleAdd() {
    const result = scanResult();
    if (!result) return;
    const entry = buildEntry(result.repo);
    if (entry.platforms.length === 0) {
      showToast("error", "At least one platform asset is required.");
      return;
    }
    setAdding(true);
    try {
      await addToCatalog(entry);
      showToast("success", `${toolName()} added to catalog!`);
      setRepoUrl("");
      setScanResult(null);
      props.onRefresh();
      loadCatalog();
    } catch (e) {
      showToast("error", `Failed to add: ${e}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate() {
    const editing = editingEntry();
    if (!editing) return;
    const entry = buildEntry(editing.repo);
    if (entry.platforms.length === 0) {
      showToast("error", "At least one platform asset is required.");
      return;
    }
    setAdding(true);
    try {
      await updateInCatalog(entry);
      showToast("success", `${toolName()} updated in catalog!`);
      setEditingEntry(null);
      props.onRefresh();
      loadCatalog();
    } catch (e) {
      showToast("error", `Failed to update: ${e}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(entry: CatalogEntry) {
    setAdding(true);
    try {
      await removeFromCatalog(entry.id);
      showToast("success", `${entry.name} removed from catalog.`);
      props.onRefresh();
      loadCatalog();
    } catch (e) {
      showToast("error", `Failed to remove: ${e}`);
    } finally {
      setAdding(false);
    }
  }

  function handleEdit(entry: CatalogEntry) {
    setEditingEntry(entry);
    setScanResult(null);
    fillForm(entry);
  }

  function handleCancelEdit() {
    setEditingEntry(null);
  }

  return (
    <div class="page">
      <div class="page-header">
        <h2>Manage Catalog</h2>
      </div>

      {/* Existing tools */}
      <div class="settings-section">
        <h3>Current Tools</h3>
        <Show when={!loadingCatalog()} fallback={<p class="settings-hint">Loading catalog...</p>}>
          <Show when={catalogEntries().length > 0} fallback={<p class="settings-hint">No tools in catalog yet.</p>}>
            <div class="catalog-list">
              <For each={catalogEntries()}>
                {(entry) => (
                  <div class="catalog-item">
                    <div class="catalog-item-info">
                      <strong>{entry.name}</strong>
                      <span class="catalog-item-meta">{entry.repo} &middot; {entry.platforms.join(", ")}</span>
                    </div>
                    <div class="catalog-item-actions">
                      <button class="btn btn-small" onClick={() => handleEdit(entry)} title="Edit tool">Edit</button>
                      <button class="btn btn-small btn-danger-small" onClick={() => handleRemove(entry)} disabled={adding()} title="Remove from catalog">Remove</button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Add new tool */}
      <Show when={!editingEntry()}>
        <div class="settings-section">
          <h3>Add New Tool</h3>
          <p class="settings-hint">
            Enter a GitHub repo URL. PyArsenal will scan it for releases, assets, and icon.
          </p>
          <div class="pat-input-row">
            <input
              type="text"
              value={repoUrl()}
              onInput={(e) => setRepoUrl(e.currentTarget.value)}
              placeholder="https://github.com/owner/repo or owner/repo"
              class="pat-input"
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
            <button
              class="btn btn-install"
              disabled={scanning() || !repoUrl().trim()}
              onClick={handleScan}
            >
              {scanning() ? "Scanning..." : "Scan"}
            </button>
          </div>
        </div>
      </Show>

      {/* Scan results */}
      <Show when={scanResult()}>
        {(result) => (
          <div class="settings-section">
            <h3>Scan Results</h3>
            <div class="scan-checks">
              <div class={`check-item ${result().has_releases ? "check-ok" : "check-fail"}`}>
                <span class="check-icon">{result().has_releases ? "\u2713" : "\u2717"}</span>
                <span>Releases found (latest: v{result().latest_version})</span>
              </div>
              <div class={`check-item ${result().linux_assets.length > 0 ? "check-ok" : "check-warn"}`}>
                <span class="check-icon">{result().linux_assets.length > 0 ? "\u2713" : "!"}</span>
                <span>Linux: {result().linux_assets.length > 0 ? result().linux_assets.join(", ") : "none"}</span>
              </div>
              <div class={`check-item ${result().windows_assets.length > 0 ? "check-ok" : "check-warn"}`}>
                <span class="check-icon">{result().windows_assets.length > 0 ? "\u2713" : "!"}</span>
                <span>Windows: {result().windows_assets.length > 0 ? result().windows_assets.join(", ") : "none"}</span>
              </div>
              <div class={`check-item ${result().has_icon ? "check-ok" : "check-warn"}`}>
                <span class="check-icon">{result().has_icon ? "\u2713" : "!"}</span>
                <span>Icon (assets/icon.png): {result().has_icon ? "found" : "not found"}</span>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Edit form (shown for both scan result and editing existing) */}
      <Show when={scanResult() || editingEntry()}>
        <div class="settings-section">
          <h3>{editingEntry() ? `Edit: ${editingEntry()!.name}` : "Tool Details"}</h3>
          <div class="form-grid">
            <label>ID</label>
            <input type="text" value={toolId()} onInput={(e) => setToolId(e.currentTarget.value)} class="form-input" disabled={!!editingEntry()} />

            <label>Name</label>
            <input type="text" value={toolName()} onInput={(e) => setToolName(e.currentTarget.value)} class="form-input" />

            <label>Description</label>
            <textarea value={toolDesc()} onInput={(e) => setToolDesc(e.currentTarget.value)} class="form-input form-textarea" />

            <label>Author</label>
            <input type="text" value={toolAuthor()} onInput={(e) => setToolAuthor(e.currentTarget.value)} class="form-input" />

            <label>Category</label>
            <select value={toolCategory()} onChange={(e) => setToolCategory(e.currentTarget.value)} class="form-input">
              <For each={CATEGORIES}>{(cat) => <option value={cat}>{cat}</option>}</For>
            </select>

            <label>Tags</label>
            <div class="tags-input-wrapper">
              <div class="tags-list">
                <For each={toolTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0)}>
                  {(tag) => (
                    <span class="tag-chip">
                      {tag}
                      <button
                        class="tag-remove"
                        onClick={() => {
                          const tags = toolTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0 && t !== tag);
                          setToolTags(tags.join(", "));
                        }}
                      >&times;</button>
                    </span>
                  )}
                </For>
              </div>
              <input
                type="text"
                value={tagInput()}
                onInput={(e) => setTagInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const val = tagInput().trim();
                    if (val) {
                      const current = toolTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0);
                      if (!current.includes(val)) {
                        setToolTags([...current, val].join(", "));
                      }
                      setTagInput("");
                    }
                  }
                }}
                class="form-input"
                placeholder="Type a tag and press Enter"
              />
            </div>
          </div>
        </div>

        {/* Linux platform */}
        <div class="settings-section">
          <h3>Linux</h3>
          <div class="form-grid">
            <label>Asset pattern</label>
            <Show when={scanResult()} fallback={
              <input type="text" value={linuxAsset()} onInput={(e) => setLinuxAsset(e.currentTarget.value)} class="form-input" placeholder="e.g. Tool-{version}-linux-x86_64.AppImage" />
            }>
              <select value={linuxAsset()} onChange={(e) => setLinuxAsset(e.currentTarget.value)} class="form-input">
                <option value="">— None —</option>
                <For each={scanResult()!.linux_assets}>
                  {(a) => {
                    const pattern = a.replace(scanResult()!.latest_version, "{version}");
                    return <option value={pattern}>{a}</option>;
                  }}
                </For>
              </select>
            </Show>
            <label>Binary name</label>
            <input type="text" value={linuxBinary()} onInput={(e) => setLinuxBinary(e.currentTarget.value)} class="form-input" />
            <label>Install type</label>
            <select value={linuxInstallType()} onChange={(e) => setLinuxInstallType(e.currentTarget.value)} class="form-input">
              <option value="binary">Binary (single file)</option>
              <option value="archive">Archive (zip/tar.gz)</option>
            </select>
          </div>
        </div>

        {/* Windows platform */}
        <div class="settings-section">
          <h3>Windows</h3>
          <div class="form-grid">
            <label>Asset pattern</label>
            <Show when={scanResult()} fallback={
              <input type="text" value={windowsAsset()} onInput={(e) => setWindowsAsset(e.currentTarget.value)} class="form-input" placeholder="e.g. Tool-{version}-windows-x86_64.exe" />
            }>
              <select value={windowsAsset()} onChange={(e) => setWindowsAsset(e.currentTarget.value)} class="form-input">
                <option value="">— None —</option>
                <For each={scanResult()!.windows_assets}>
                  {(a) => {
                    const pattern = a.replace(scanResult()!.latest_version, "{version}");
                    return <option value={pattern}>{a}</option>;
                  }}
                </For>
              </select>
            </Show>
            <label>Binary name</label>
            <input type="text" value={windowsBinary()} onInput={(e) => setWindowsBinary(e.currentTarget.value)} class="form-input" />
            <label>Install type</label>
            <select value={windowsInstallType()} onChange={(e) => setWindowsInstallType(e.currentTarget.value)} class="form-input">
              <option value="binary">Binary (single file)</option>
              <option value="archive">Archive (zip/tar.gz)</option>
              <option value="innosetup">Inno Setup installer</option>
              <option value="tauri">Tauri NSIS setup</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div class="settings-section">
          <div class="pat-actions">
            <Show when={editingEntry()}>
              <button class="btn btn-install btn-large" disabled={adding() || !toolId() || !toolName()} onClick={handleUpdate}>
                {adding() ? "Saving..." : "Save Changes"}
              </button>
              <button class="btn btn-small" onClick={handleCancelEdit}>Cancel</button>
            </Show>
            <Show when={scanResult() && !editingEntry()}>
              <button class="btn btn-install btn-large" disabled={adding() || !toolId() || !toolName()} onClick={handleAdd}>
                {adding() ? "Adding..." : "Add to Catalog"}
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
