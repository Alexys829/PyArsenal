import { createSignal, For, Show, onMount } from "solid-js";
import type { CustomTheme } from "../lib/types";
import { getThemeConfig, saveThemeConfig } from "../lib/api";
import {
  PRESET_THEMES,
  COLOR_LABELS,
  applyTheme,
  getPresetById,
} from "../lib/themes";
import { showToast } from "../lib/stores";

export default function ThemesPage() {
  const [activeTheme, setActiveTheme] = createSignal("steam-dark");
  const [customThemes, setCustomThemes] = createSignal<CustomTheme[]>([]);
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [editingCustom, setEditingCustom] = createSignal<CustomTheme | null>(null);
  const [customName, setCustomName] = createSignal("");
  const [customColors, setCustomColors] = createSignal<Record<string, string>>({});
  const [touchedColors, setTouchedColors] = createSignal<Set<string>>(new Set());

  onMount(async () => {
    try {
      const config = await getThemeConfig();
      setActiveTheme(config.active);
      setCustomThemes(config.custom_themes);
    } catch {
      // defaults are fine
    }
  });

  async function selectTheme(id: string, colors: Record<string, string>) {
    // If editor is open for a new theme, update untouched colors from the clicked theme
    if (editorOpen() && !editingCustom()) {
      const touched = touchedColors();
      const merged: Record<string, string> = {};
      for (const key of Object.keys(COLOR_LABELS)) {
        merged[key] = touched.has(key) ? customColors()[key] : (colors[key] ?? customColors()[key]);
      }
      setCustomColors(merged);
      applyTheme(merged);
      return;
    }

    applyTheme(colors);
    setActiveTheme(id);
    try {
      await saveThemeConfig({
        active: id,
        custom_themes: customThemes(),
      });
    } catch (e) {
      showToast("error", `Failed to save theme: ${e}`);
    }
  }

  function openEditor(theme?: CustomTheme) {
    if (theme) {
      setEditingCustom(theme);
      setCustomName(theme.name);
      setCustomColors({ ...theme.colors });
    } else {
      const current = getPresetById(activeTheme());
      const currentCustom = customThemes().find((t) => t.id === activeTheme());
      const baseColors = current?.colors ?? currentCustom?.colors ?? PRESET_THEMES[0].colors;
      setEditingCustom(null);
      setCustomName("");
      setCustomColors({ ...baseColors });
    }
    setTouchedColors(new Set());
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingCustom(null);
    setCustomName("");
    setCustomColors({});
    setTouchedColors(new Set());
    // Restore active theme
    const preset = getPresetById(activeTheme());
    const custom = customThemes().find((t) => t.id === activeTheme());
    if (preset) applyTheme(preset.colors);
    else if (custom) applyTheme(custom.colors);
  }

  function updateColor(key: string, value: string) {
    setCustomColors((prev) => ({ ...prev, [key]: value }));
    setTouchedColors((prev) => new Set(prev).add(key));
    applyTheme({ ...customColors(), [key]: value });
  }

  async function saveCustomTheme() {
    const name = customName().trim();
    if (!name) {
      showToast("error", "Theme name is required.");
      return;
    }

    const editing = editingCustom();
    const id = editing ? editing.id : `custom-${Date.now()}`;
    const theme: CustomTheme = { id, name, colors: customColors() };

    let updated: CustomTheme[];
    if (editing) {
      updated = customThemes().map((t) => (t.id === editing.id ? theme : t));
    } else {
      updated = [...customThemes(), theme];
    }

    setCustomThemes(updated);
    setActiveTheme(id);

    try {
      await saveThemeConfig({ active: id, custom_themes: updated });
      showToast("success", `Theme "${name}" saved.`);
    } catch (e) {
      showToast("error", `Failed to save theme: ${e}`);
    }

    setEditorOpen(false);
    setEditingCustom(null);
    setCustomName("");
    setCustomColors({});
    setTouchedColors(new Set());
  }

  async function deleteCustomTheme(id: string) {
    const updated = customThemes().filter((t) => t.id !== id);
    setCustomThemes(updated);

    // If deleting the active theme, fall back to default
    if (activeTheme() === id) {
      const fallback = PRESET_THEMES[0];
      setActiveTheme(fallback.id);
      applyTheme(fallback.colors);
    }

    try {
      await saveThemeConfig({
        active: activeTheme() === id ? "steam-dark" : activeTheme(),
        custom_themes: updated,
      });
      showToast("success", "Theme deleted.");
    } catch (e) {
      showToast("error", `Failed to delete theme: ${e}`);
    }
  }

  return (
    <div class="page">
      <div class="page-header">
        <h2>Themes</h2>
        <button
          class="btn btn-install"
          onClick={() => openEditor()}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          New Theme
        </button>
      </div>

      {/* Editor */}
      <Show when={editorOpen()}>
        <div class="settings-section" style={{ "margin-bottom": "24px" }}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "16px" }}>
            <h3>{editingCustom() ? `Edit: ${editingCustom()!.name}` : "New Custom Theme"}</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button class="btn btn-small" onClick={closeEditor}>Cancel</button>
              <button class="btn btn-install" onClick={saveCustomTheme}>Save Theme</button>
            </div>
          </div>

          <div style={{ "margin-bottom": "16px" }}>
            <label style={{ display: "block", "font-size": "13px", color: "var(--text-muted)", "margin-bottom": "6px" }}>
              Theme Name
            </label>
            <input
              class="form-input"
              type="text"
              value={customName()}
              onInput={(e) => setCustomName(e.currentTarget.value)}
              placeholder="My Theme"
              style={{ width: "300px" }}
            />
          </div>

          <div class="color-editor-grid">
            <For each={Object.entries(COLOR_LABELS)}>
              {([key, label]) => (
                <div class="color-editor-item">
                  <div class="color-editor-swatch-wrap">
                    <input
                      type="color"
                      class="color-editor-picker"
                      value={customColors()[key] || "#000000"}
                      onInput={(e) => updateColor(key, e.currentTarget.value)}
                    />
                    <div
                      class="color-editor-swatch"
                      style={{ background: customColors()[key] || "#000000" }}
                    />
                  </div>
                  <div class="color-editor-info">
                    <span class="color-editor-label">{label}</span>
                    <input
                      class="color-editor-hex"
                      type="text"
                      value={customColors()[key] || ""}
                      onInput={(e) => {
                        const v = e.currentTarget.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                          updateColor(key, v);
                        }
                      }}
                      onChange={(e) => {
                        let v = e.currentTarget.value.trim();
                        if (!v.startsWith("#")) v = "#" + v;
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                          updateColor(key, v);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Preset themes */}
      <h3 style={{ "margin-bottom": "12px", "font-size": "16px" }}>Presets</h3>
      <div class="theme-grid">
        <For each={PRESET_THEMES}>
          {(theme) => (
            <div
              class={`theme-card ${activeTheme() === theme.id ? "theme-card-active" : ""}`}
              onClick={() => selectTheme(theme.id, theme.colors)}
            >
              <div class="theme-preview">
                <div class="theme-preview-sidebar" style={{ background: theme.colors["bg-sidebar"] }}>
                  <div class="theme-preview-logo" style={{ background: theme.colors.accent }} />
                  <div class="theme-preview-nav-item" style={{ background: `${theme.colors.accent}33` }} />
                  <div class="theme-preview-nav-item" style={{ background: `${theme.colors["text-muted"]}22` }} />
                  <div class="theme-preview-nav-item" style={{ background: `${theme.colors["text-muted"]}22` }} />
                </div>
                <div class="theme-preview-content" style={{ background: theme.colors["bg-dark"] }}>
                  <div class="theme-preview-header" style={{ background: theme.colors["text-muted"] }} />
                  <div class="theme-preview-cards">
                    <div class="theme-preview-card" style={{ background: theme.colors["bg-card"] }}>
                      <div class="theme-preview-card-line" style={{ background: theme.colors.text, width: "60%" }} />
                      <div class="theme-preview-card-line" style={{ background: theme.colors["text-muted"], width: "80%" }} />
                      <div class="theme-preview-card-btn" style={{ background: theme.colors.accent }} />
                    </div>
                    <div class="theme-preview-card" style={{ background: theme.colors["bg-card"] }}>
                      <div class="theme-preview-card-line" style={{ background: theme.colors.text, width: "50%" }} />
                      <div class="theme-preview-card-line" style={{ background: theme.colors["text-muted"], width: "70%" }} />
                      <div class="theme-preview-card-btn" style={{ background: theme.colors.success }} />
                    </div>
                  </div>
                </div>
              </div>
              <div class="theme-card-footer">
                <span class="theme-card-name">{theme.name}</span>
                <Show when={activeTheme() === theme.id}>
                  <svg viewBox="0 0 24 24" fill="var(--accent)" width="16" height="16">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Custom themes */}
      <Show when={customThemes().length > 0}>
        <h3 style={{ "margin-top": "24px", "margin-bottom": "12px", "font-size": "16px" }}>Custom</h3>
        <div class="theme-grid">
          <For each={customThemes()}>
            {(theme) => (
              <div
                class={`theme-card ${activeTheme() === theme.id ? "theme-card-active" : ""}`}
                onClick={() => selectTheme(theme.id, theme.colors)}
              >
                <div class="theme-preview">
                  <div class="theme-preview-sidebar" style={{ background: theme.colors["bg-sidebar"] || "#171a21" }}>
                    <div class="theme-preview-logo" style={{ background: theme.colors.accent || "#66c0f4" }} />
                    <div class="theme-preview-nav-item" style={{ background: `${theme.colors.accent || "#66c0f4"}33` }} />
                    <div class="theme-preview-nav-item" style={{ background: `${theme.colors["text-muted"] || "#8f98a0"}22` }} />
                    <div class="theme-preview-nav-item" style={{ background: `${theme.colors["text-muted"] || "#8f98a0"}22` }} />
                  </div>
                  <div class="theme-preview-content" style={{ background: theme.colors["bg-dark"] || "#1b2838" }}>
                    <div class="theme-preview-header" style={{ background: theme.colors["text-muted"] || "#8f98a0" }} />
                    <div class="theme-preview-cards">
                      <div class="theme-preview-card" style={{ background: theme.colors["bg-card"] || "#2a475e" }}>
                        <div class="theme-preview-card-line" style={{ background: theme.colors.text || "#c7d5e0", width: "60%" }} />
                        <div class="theme-preview-card-line" style={{ background: theme.colors["text-muted"] || "#8f98a0", width: "80%" }} />
                        <div class="theme-preview-card-btn" style={{ background: theme.colors.accent || "#66c0f4" }} />
                      </div>
                      <div class="theme-preview-card" style={{ background: theme.colors["bg-card"] || "#2a475e" }}>
                        <div class="theme-preview-card-line" style={{ background: theme.colors.text || "#c7d5e0", width: "50%" }} />
                        <div class="theme-preview-card-line" style={{ background: theme.colors["text-muted"] || "#8f98a0", width: "70%" }} />
                        <div class="theme-preview-card-btn" style={{ background: theme.colors.success || "#5ba32b" }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div class="theme-card-footer">
                  <span class="theme-card-name">{theme.name}</span>
                  <div class="theme-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      class="btn-icon"
                      style={{ padding: "4px", "min-width": "auto", "border-radius": "4px", border: "none", cursor: "pointer" }}
                      onClick={() => openEditor(theme)}
                      title="Edit"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                      </svg>
                    </button>
                    <button
                      class="btn-icon-danger"
                      style={{ padding: "4px", "min-width": "auto", "border-radius": "4px", border: "none", cursor: "pointer" }}
                      onClick={() => deleteCustomTheme(theme.id)}
                      title="Delete"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
