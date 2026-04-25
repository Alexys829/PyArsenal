import { createSignal, Show, For, onMount } from "solid-js";
import { scanRepo, addToCatalog, removeFromCatalog, updateInCatalog, getCatalogEntries, getCatalogLinks, addLinkToCatalog, updateLinkInCatalog, removeLinkFromCatalog, validateLink, uploadLinkIcon, getThirdPartyApps, addThirdPartyApp, updateThirdPartyApp, removeThirdPartyApp, validateThirdPartyUrl, uploadThirdPartyIcon } from "../lib/api";
import { showToast } from "../lib/stores";
import type { RepoScanResult, CatalogEntry, LinkEntry, ThirdPartyEntry, ThirdPartyUrlValidation } from "../lib/types";

const EMPTY_TP = (): ThirdPartyEntry => ({
  id: "", name: "", description: "", category: "", tags: [], icon: "",
  url_linux: "", url_windows: "", filename_linux: "", filename_windows: "",
  download_type_linux: "installer", download_type_windows: "installer", added_by: "",
  commands_linux: [],
});

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

  // Links management
  const [catalogLinks, setCatalogLinks] = createSignal<LinkEntry[]>([]);
  const [linkUrl, setLinkUrl] = createSignal("");
  const [linkValidating, setLinkValidating] = createSignal(false);
  const [linkName, setLinkName] = createSignal("");
  const [linkDesc, setLinkDesc] = createSignal("");
  const [linkFilename, setLinkFilename] = createSignal("");
  const [linkCategory, setLinkCategory] = createSignal("Documents");
  const [linkTags, setLinkTags] = createSignal("");
  const [linkTagInput, setLinkTagInput] = createSignal("");
  const [linkValidated, setLinkValidated] = createSignal(false);
  const [linkFinalUrl, setLinkFinalUrl] = createSignal("");
  const [linkIconBase64, setLinkIconBase64] = createSignal("");
  const [editingLink, setEditingLink] = createSignal<LinkEntry | null>(null);
  const [linkAdding, setLinkAdding] = createSignal(false);

  // Third-party state
  const [tpApps, setTpApps] = createSignal<ThirdPartyEntry[]>([]);
  const [tpForm, setTpForm] = createSignal<ThirdPartyEntry>(EMPTY_TP());
  const [tpEditId, setTpEditId] = createSignal<string | null>(null);
  const [tpValLinux, setTpValLinux] = createSignal<ThirdPartyUrlValidation | null>(null);
  const [tpValWin, setTpValWin] = createSignal<ThirdPartyUrlValidation | null>(null);
  const [tpValLinuxing, setTpValLinuxing] = createSignal(false);
  const [tpValWining, setTpValWining] = createSignal(false);
  const [tpSaving, setTpSaving] = createSignal(false);
  const [tpIconB64, setTpIconB64] = createSignal("");
  const [tpIconPreview, setTpIconPreview] = createSignal("");
  const [tpTagsInput, setTpTagsInput] = createSignal("");
  const [tpCommandsInput, setTpCommandsInput] = createSignal("");
  const [tpFormOpen, setTpFormOpen] = createSignal(false);

  onMount(() => { loadCatalog(); loadLinks(); loadThirdParty(); });

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

  async function loadLinks() {
    try {
      const entries = await getCatalogLinks();
      setCatalogLinks(entries);
    } catch { /* ignore */ }
  }

  async function loadThirdParty() {
    try { setTpApps(await getThirdPartyApps()); } catch { /* ignore */ }
  }

  async function tpValidate(platform: "linux" | "windows") {
    const url = platform === "linux" ? tpForm().url_linux : tpForm().url_windows;
    if (!url.trim()) return;
    if (platform === "linux") { setTpValLinuxing(true); setTpValLinux(null); }
    else { setTpValWining(true); setTpValWin(null); }
    try {
      const r = await validateThirdPartyUrl(url);
      if (platform === "linux") {
        setTpValLinux(r);
        if (r.valid && r.filename) setTpForm(f => ({ ...f, filename_linux: r.filename }));
      } else {
        setTpValWin(r);
        if (r.valid && r.filename) setTpForm(f => ({ ...f, filename_windows: r.filename }));
      }
    } catch (e) {
      const err = { valid: false, final_url: "", filename: "", content_type: "", size: 0, service: "", error: String(e) };
      if (platform === "linux") setTpValLinux(err); else setTpValWin(err);
    } finally {
      if (platform === "linux") setTpValLinuxing(false); else setTpValWining(false);
    }
  }

  function tpOpenAdd() {
    setTpForm(EMPTY_TP()); setTpEditId(null); setTpValLinux(null); setTpValWin(null);
    setTpIconB64(""); setTpIconPreview(""); setTpTagsInput(""); setTpCommandsInput(""); setTpFormOpen(true);
  }

  function tpOpenEdit(app: ThirdPartyEntry) {
    setTpForm({ ...app }); setTpEditId(app.id); setTpValLinux(null); setTpValWin(null);
    setTpIconB64(""); setTpIconPreview(""); setTpTagsInput(app.tags.join(", "));
    setTpCommandsInput((app.commands_linux || []).join("\n"));
    setTpFormOpen(true);
  }

  async function tpSave() {
    const vl = tpValLinux(), vw = tpValWin();
    const isLinuxCmdsOnly = tpForm().download_type_linux === "commands" && tpCommandsInput().trim().length > 0;
    
    if (!vl?.valid && !vw?.valid && !isLinuxCmdsOnly) {
      showToast("error", "Validate at least one URL first (or enter commands for Linux).");
      return;
    }
    if (!tpForm().name.trim()) { showToast("error", "Name is required."); return; }
    setTpSaving(true);
    try {
      const tags = tpTagsInput().split(",").map(t => t.trim()).filter(Boolean);
      const cmds = tpCommandsInput().split("\n").map(c => c.trim()).filter(Boolean);
      const id = tpEditId() || crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const entry: ThirdPartyEntry = { ...tpForm(), id, tags, commands_linux: cmds };
      if (tpEditId()) await updateThirdPartyApp(entry);
      else await addThirdPartyApp(entry);
      if (tpIconB64()) await uploadThirdPartyIcon(id, tpIconB64()).catch(() => {});
      showToast("success", tpEditId() ? "App updated." : "App added to catalog.");
      setTpFormOpen(false); setTpEditId(null); setTpForm(EMPTY_TP());
      loadThirdParty();
    } catch (e) { showToast("error", `Failed: ${e}`); }
    finally { setTpSaving(false); }
  }

  async function tpRemove(app: ThirdPartyEntry) {
    if (!confirm(`Remove "${app.name}" from catalog?`)) return;
    try { await removeThirdPartyApp(app.id); showToast("success", "Removed."); loadThirdParty(); }
    catch (e) { showToast("error", `Failed: ${e}`); }
  }

  function tpHandleIcon(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      setTpIconPreview(r);
      setTpIconB64(r.split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  }

  function TpValBadge(v: ThirdPartyUrlValidation | null, checking: boolean) {
    if (checking) return <span class="tp-val-badge tp-val-checking">Checking…</span>;
    if (!v) return null;
    if (v.valid) return <span class="tp-val-badge tp-val-ok">✓ {v.service}{v.filename ? ` · ${v.filename}` : ""}</span>;
    return <span class="tp-val-badge tp-val-err">✗ {v.error || "Invalid"}</span>;
  }

  async function handleValidateLink() {
    const url = linkUrl().trim();
    if (!url) return;
    setLinkValidating(true);
    setLinkValidated(false);
    try {
      const result = await validateLink(url);
      if (result.valid) {
        setLinkFinalUrl(result.final_url);
        setLinkFilename(result.filename || "download");
        setLinkValidated(true);
        showToast("success", `Link valid (${result.service}).`);
      } else {
        showToast("error", "Link is not reachable or invalid.");
      }
    } catch (e) {
      showToast("error", `Validation failed: ${e}`);
    } finally {
      setLinkValidating(false);
    }
  }

  function handleIconUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".png";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 part (remove data:image/png;base64, prefix)
        const b64 = result.split(",")[1];
        if (b64) setLinkIconBase64(b64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function resetLinkForm() {
    setLinkUrl(""); setLinkName(""); setLinkDesc(""); setLinkFilename("");
    setLinkCategory("Documents"); setLinkTags(""); setLinkTagInput("");
    setLinkValidated(false); setLinkFinalUrl(""); setLinkIconBase64("");
    setEditingLink(null);
  }

  async function handleAddLink() {
    const id = linkName().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!id || !linkName() || !linkFinalUrl()) return;

    setLinkAdding(true);
    try {
      const entry: LinkEntry = {
        id,
        name: linkName(),
        description: linkDesc(),
        url: linkFinalUrl(),
        icon: `${id}.png`,
        filename: linkFilename(),
        category: linkCategory(),
        tags: linkTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0),
        added_by: "",
      };
      await addLinkToCatalog(entry);
      // Upload icon if provided
      if (linkIconBase64()) {
        await uploadLinkIcon(id, linkIconBase64());
      }
      showToast("success", `Link "${linkName()}" added!`);
      resetLinkForm();
      props.onRefresh();
      loadLinks();
    } catch (e) {
      showToast("error", `Failed to add link: ${e}`);
    } finally {
      setLinkAdding(false);
    }
  }

  async function handleUpdateLink() {
    const editing = editingLink();
    if (!editing) return;
    setLinkAdding(true);
    try {
      const entry: LinkEntry = {
        id: editing.id,
        name: linkName(),
        description: linkDesc(),
        url: linkFinalUrl() || editing.url,
        icon: editing.icon,
        filename: linkFilename(),
        category: linkCategory(),
        tags: linkTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0),
        added_by: editing.added_by,
      };
      await updateLinkInCatalog(entry);
      if (linkIconBase64()) {
        await uploadLinkIcon(editing.id, linkIconBase64());
      }
      showToast("success", `Link "${linkName()}" updated!`);
      resetLinkForm();
      props.onRefresh();
      loadLinks();
    } catch (e) {
      showToast("error", `Failed to update: ${e}`);
    } finally {
      setLinkAdding(false);
    }
  }

  function handleEditLink(link: LinkEntry) {
    setEditingLink(link);
    setLinkUrl(link.url);
    setLinkName(link.name);
    setLinkDesc(link.description);
    setLinkFilename(link.filename);
    setLinkCategory(link.category);
    setLinkTags((link.tags || []).join(", "));
    setLinkFinalUrl(link.url);
    setLinkValidated(true);
  }

  async function handleRemoveLink(link: LinkEntry) {
    setLinkAdding(true);
    try {
      await removeLinkFromCatalog(link.id);
      showToast("success", `Link "${link.name}" removed.`);
      loadLinks();
      props.onRefresh();
    } catch (e) {
      showToast("error", `Failed to remove: ${e}`);
    } finally {
      setLinkAdding(false);
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

      {/* ── Links Management ── */}
      <div class="settings-section" style={{ "margin-top": "32px" }}>
        <h3>Download Links</h3>
        <Show when={catalogLinks().length > 0}>
          <div class="catalog-list" style={{ "margin-bottom": "16px" }}>
            <For each={catalogLinks()}>
              {(link) => (
                <div class="catalog-item">
                  <div class="catalog-item-info">
                    <strong>{link.name}</strong>
                    <span class="catalog-item-meta">{link.filename} &middot; {link.category}</span>
                  </div>
                  <div class="catalog-item-actions">
                    <button class="btn btn-small" onClick={() => handleEditLink(link)}>Edit</button>
                    <button class="btn btn-small btn-danger-small" onClick={() => handleRemoveLink(link)} disabled={linkAdding()}>Remove</button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Add/Edit Link */}
      <div class="settings-section">
        <h3>{editingLink() ? `Edit: ${editingLink()!.name}` : "Add New Link"}</h3>
        <p class="settings-hint">
          Paste a Google Drive share link or any direct download URL.
        </p>
        <div class="pat-input-row">
          <input
            type="text"
            value={linkUrl()}
            onInput={(e) => setLinkUrl(e.currentTarget.value)}
            placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
            class="pat-input"
            onKeyDown={(e) => e.key === "Enter" && handleValidateLink()}
          />
          <button
            class="btn btn-install"
            disabled={linkValidating() || !linkUrl().trim()}
            onClick={handleValidateLink}
          >
            {linkValidating() ? "Checking..." : "Validate"}
          </button>
        </div>

        <Show when={linkValidated()}>
          <div class="form-grid" style={{ "margin-top": "12px" }}>
            <label>Name</label>
            <input type="text" value={linkName()} onInput={(e) => setLinkName(e.currentTarget.value)} class="form-input" placeholder="Resource name" />

            <label>Description</label>
            <textarea value={linkDesc()} onInput={(e) => setLinkDesc(e.currentTarget.value)} class="form-input form-textarea" placeholder="Brief description" />

            <label>Filename</label>
            <input type="text" value={linkFilename()} onInput={(e) => setLinkFilename(e.currentTarget.value)} class="form-input" />

            <label>Category</label>
            <select value={linkCategory()} onChange={(e) => setLinkCategory(e.currentTarget.value)} class="form-input">
              <option value="Documents">Documents</option>
              <option value="Media">Media</option>
              <option value="Templates">Templates</option>
              <option value="Resources">Resources</option>
              <option value="Other">Other</option>
            </select>

            <label>Tags</label>
            <div class="tags-input-wrapper">
              <div class="tags-list">
                <For each={linkTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0)}>
                  {(tag) => (
                    <span class="tag-chip">
                      {tag}
                      <button class="tag-remove" onClick={() => {
                        const tags = linkTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0 && t !== tag);
                        setLinkTags(tags.join(", "));
                      }}>&times;</button>
                    </span>
                  )}
                </For>
              </div>
              <input
                type="text"
                value={linkTagInput()}
                onInput={(e) => setLinkTagInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const val = linkTagInput().trim();
                    if (val) {
                      const current = linkTags().split(",").map((t) => t.trim()).filter((t) => t.length > 0);
                      if (!current.includes(val)) setLinkTags([...current, val].join(", "));
                      setLinkTagInput("");
                    }
                  }
                }}
                class="form-input"
                placeholder="Type a tag and press Enter"
              />
            </div>

            <label>Icon (PNG)</label>
            <div>
              <button class="btn btn-small" onClick={handleIconUpload}>
                {linkIconBase64() ? "Icon selected" : "Choose icon..."}
              </button>
              {linkIconBase64() && <span style={{ "margin-left": "8px", "font-size": "12px", color: "var(--success)" }}>Ready to upload</span>}
            </div>
          </div>

          <div class="pat-actions" style={{ "margin-top": "12px" }}>
            <Show when={editingLink()}>
              <button class="btn btn-install btn-large" disabled={linkAdding() || !linkName()} onClick={handleUpdateLink}>
                {linkAdding() ? "Saving..." : "Save Link"}
              </button>
              <button class="btn btn-small" onClick={resetLinkForm}>Cancel</button>
            </Show>
            <Show when={!editingLink()}>
              <button class="btn btn-install btn-large" disabled={linkAdding() || !linkName() || !linkFilename()} onClick={handleAddLink}>
                {linkAdding() ? "Adding..." : "Add Link"}
              </button>
            </Show>
          </div>
        </Show>
      </div>

      {/* ── Third-Party Apps Management ── */}
      <div class="settings-section" style={{ "margin-top": "32px" }}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "12px" }}>
          <h3>Third-Party Apps</h3>
          <Show when={!tpFormOpen()}>
            <button class="btn btn-install" onClick={tpOpenAdd}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Add App
            </button>
          </Show>
        </div>

        {/* List */}
        <Show when={tpApps().length > 0}>
          <div class="catalog-list" style={{ "margin-bottom": "16px" }}>
            <For each={tpApps()}>
              {(app) => (
                <div class="catalog-item">
                  <div class="catalog-item-info">
                    <strong>{app.name}</strong>
                    <span class="catalog-item-meta">
                      {app.download_type_linux !== app.download_type_windows
                        ? `🐧 ${app.download_type_linux} · 🪟 ${app.download_type_windows}`
                        : `${app.download_type_linux}`
                      }
                      {app.category ? ` · ${app.category}` : ""}
                    </span>
                  </div>
                  <div class="catalog-item-actions">
                    <button class="btn btn-small" onClick={() => tpOpenEdit(app)}>Edit</button>
                    <button class="btn btn-small btn-danger-small" onClick={() => tpRemove(app)}>Remove</button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Add/Edit Third-Party Form */}
      <Show when={tpFormOpen()}>
        <div class="settings-section">
          <h3>{tpEditId() ? `Edit: ${tpForm().name}` : "Add Third-Party App"}</h3>
          <div class="form-grid" style={{ "margin-bottom": "16px" }}>
            <label>Name *</label>
            <input class="form-input" value={tpForm().name}
              onInput={e => setTpForm(f => ({ ...f, name: e.currentTarget.value }))}
              placeholder="e.g. VLC Media Player" />

            <label>Description</label>
            <textarea class="form-input form-textarea" value={tpForm().description}
              onInput={e => setTpForm(f => ({ ...f, description: e.currentTarget.value }))}
              placeholder="Brief description…" />

            <label>Category</label>
            <input class="form-input" value={tpForm().category}
              onInput={e => setTpForm(f => ({ ...f, category: e.currentTarget.value }))}
              placeholder="e.g. Media, Utilities…" />

            <label>Tags (comma separated)</label>
            <input class="form-input" value={tpTagsInput()}
              onInput={e => setTpTagsInput(e.currentTarget.value)}
              placeholder="video, open-source" />

            <label>Added by</label>
            <input class="form-input" value={tpForm().added_by}
              onInput={e => setTpForm(f => ({ ...f, added_by: e.currentTarget.value }))}
              placeholder="Your name" />

            <label>Icon (PNG)</label>
            <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
              {tpIconPreview() && <img src={tpIconPreview()} style={{ width: "40px", height: "40px", "border-radius": "8px", "object-fit": "cover" }} alt="" />}
              <label class="btn btn-small" for="tp-icon-file">
                {tpIconPreview() ? "Change icon" : "Upload icon…"}
              </label>
              <input id="tp-icon-file" type="file" accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }} onChange={tpHandleIcon} />
            </div>
          </div>

          {/* Linux */}
          <div class="settings-section" style={{ "margin-bottom": "12px" }}>
            <h3>🐧 Linux</h3>
            <div class="form-grid">
              <label>URL</label>
              <div class="pat-input-row">
                <input class="pat-input" value={tpForm().url_linux}
                  onInput={e => { setTpForm(f => ({ ...f, url_linux: e.currentTarget.value })); setTpValLinux(null); }}
                  placeholder="https://example.com/app.AppImage" />
                <button class="btn btn-install" disabled={tpValLinuxing() || !tpForm().url_linux.trim()}
                  onClick={() => tpValidate("linux")}>
                  {tpValLinuxing() ? "Checking…" : "Validate"}
                </button>
              </div>
              <label></label>
              <div>{TpValBadge(tpValLinux(), tpValLinuxing())}</div>

              <label>Filename</label>
              <input class="form-input" value={tpForm().filename_linux}
                onInput={e => setTpForm(f => ({ ...f, filename_linux: e.currentTarget.value }))}
                placeholder="app.AppImage" />

              <label>Download type</label>
              <select class="form-input" value={tpForm().download_type_linux}
                onChange={e => setTpForm(f => ({ ...f, download_type_linux: e.currentTarget.value }))}>
                <option value="installer">Installer — launch &amp; delete file</option>
                <option value="archive">Archive — save to chosen folder</option>
                <option value="commands">Console Commands — no download</option>
              </select>

              <label>Bash Commands (optional, one per line)</label>
              <textarea class="form-input form-textarea" value={tpCommandsInput()}
                onInput={e => setTpCommandsInput(e.currentTarget.value)}
                placeholder="sudo apt-get install myapp\nmyapp --version" />
            </div>
          </div>

          {/* Windows */}
          <div class="settings-section" style={{ "margin-bottom": "12px" }}>
            <h3>🪟 Windows</h3>
            <div class="form-grid">
              <label>URL</label>
              <div class="pat-input-row">
                <input class="pat-input" value={tpForm().url_windows}
                  onInput={e => { setTpForm(f => ({ ...f, url_windows: e.currentTarget.value })); setTpValWin(null); }}
                  placeholder="https://example.com/setup.exe" />
                <button class="btn btn-install" disabled={tpValWining() || !tpForm().url_windows.trim()}
                  onClick={() => tpValidate("windows")}>
                  {tpValWining() ? "Checking…" : "Validate"}
                </button>
              </div>
              <label></label>
              <div>{TpValBadge(tpValWin(), tpValWining())}</div>

              <label>Filename</label>
              <input class="form-input" value={tpForm().filename_windows}
                onInput={e => setTpForm(f => ({ ...f, filename_windows: e.currentTarget.value }))}
                placeholder="setup.exe" />

              <label>Download type</label>
              <select class="form-input" value={tpForm().download_type_windows}
                onChange={e => setTpForm(f => ({ ...f, download_type_windows: e.currentTarget.value }))}>
                <option value="installer">Installer — launch &amp; delete file</option>
                <option value="archive">Archive — save to chosen folder</option>
              </select>
            </div>
          </div>

          <div class="pat-actions">
            <button class="btn btn-install btn-large"
              disabled={tpSaving() || !tpForm().name.trim()}
              onClick={tpSave}>
              {tpSaving() ? "Saving…" : tpEditId() ? "Save Changes" : "Add to Catalog"}
            </button>
            <button class="btn btn-small" onClick={() => { setTpFormOpen(false); setTpEditId(null); }}>Cancel</button>
          </div>
        </div>
      </Show>

    </div>
  );
}
