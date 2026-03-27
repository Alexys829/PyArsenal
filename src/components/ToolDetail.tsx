import { createSignal, onMount, For, Show } from "solid-js";
import { getToolChangelog, getToolIcon } from "../lib/api";
import { formatDate, formatBytes } from "../lib/stores";
import type { CatalogEntry, InstalledTool, ReleaseInfo } from "../lib/types";

interface ToolDetailProps {
  entry: CatalogEntry;
  installedTool?: InstalledTool;
  onClose: () => void;
}

export default function ToolDetail(props: ToolDetailProps) {
  const [changelog, setChangelog] = createSignal<ReleaseInfo[]>([]);
  const [iconSrc, setIconSrc] = createSignal("");
  const [loadingChangelog, setLoadingChangelog] = createSignal(true);

  onMount(async () => {
    // Load icon
    try {
      const src = await getToolIcon(props.entry.repo, props.entry.id);
      if (src) setIconSrc(src);
    } catch {}

    // Load changelog
    try {
      const releases = await getToolChangelog(props.entry.repo);
      setChangelog(releases);
    } catch {}
    setLoadingChangelog(false);
  });

  return (
    <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="tool-detail-modal">
        <button class="detail-close" onClick={props.onClose}>&times;</button>

        <div class="detail-header">
          <div class="detail-icon">
            {iconSrc() ? (
              <img src={iconSrc()} alt={props.entry.name} class="tool-icon-img" />
            ) : (
              props.entry.name[0]
            )}
          </div>
          <div class="detail-title">
            <h2>{props.entry.name}</h2>
            <div class="tool-meta">
              <span class="category-badge cat-default">{props.entry.category}</span>
              <span class="tool-author">by {props.entry.author || props.entry.repo.split("/")[0]}</span>
              <span class="tool-author">&middot; {props.entry.repo}</span>
            </div>
          </div>
        </div>

        <p class="detail-description">{props.entry.description}</p>

        {props.entry.tags && props.entry.tags.length > 0 && (
          <div class="tool-tags" style={{ "margin-bottom": "16px" }}>
            {props.entry.tags.map((tag) => <span class="tool-tag">{tag}</span>)}
          </div>
        )}

        <div class="detail-info-grid">
          <div class="detail-info-item">
            <span class="detail-label">Platforms</span>
            <span>{props.entry.platforms.join(", ")}</span>
          </div>
          <Show when={props.installedTool}>
            <div class="detail-info-item">
              <span class="detail-label">Installed Version</span>
              <span>v{props.installedTool!.installed_version}</span>
            </div>
            <div class="detail-info-item">
              <span class="detail-label">Installed Size</span>
              <span>{formatBytes(props.installedTool!.size_bytes)}</span>
            </div>
            <div class="detail-info-item">
              <span class="detail-label">Install Date</span>
              <span>{formatDate(props.installedTool!.installed_at)}</span>
            </div>
            <div class="detail-info-item">
              <span class="detail-label">Install Path</span>
              <span style={{ "font-size": "11px", "font-family": "monospace", "word-break": "break-all" }}>{props.installedTool!.install_path}</span>
            </div>
          </Show>
        </div>

        <h3 class="detail-section-title">Releases</h3>
        <Show when={!loadingChangelog()} fallback={<p class="settings-hint">Loading releases...</p>}>
          <Show when={changelog().length > 0} fallback={<p class="settings-hint">No releases found.</p>}>
            <div class="detail-changelog">
              <For each={changelog()}>
                {(r) => (
                  <div class="detail-release">
                    <div class="detail-release-header">
                      <strong>{r.version}</strong>
                      {r.name && r.name !== r.version && <span class="detail-release-name">{r.name}</span>}
                      <span class="release-date">{formatDate(r.published_at)}</span>
                    </div>
                    <Show when={r.body}>
                      <pre class="detail-release-body">{r.body}</pre>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
