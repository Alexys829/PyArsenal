import { createSignal, createMemo, onMount, onCleanup, For, Show } from "solid-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  getThirdPartyApps, downloadThirdPartyApp, getThirdPartyIcon,
  getPrefs, getDefaultDownloadDir, openFileFolder, executeThirdPartyCommands,
} from "../lib/api";
import { showToast, formatBytes } from "../lib/stores";
import type { ThirdPartyEntry, DownloadProgress, CommandOutput } from "../lib/types";
import SearchBar from "../components/SearchBar";

export default function ThirdPartyPage() {
  const [apps, setApps] = createSignal<ThirdPartyEntry[]>([]);
  const [icons, setIcons] = createSignal<Record<string, string>>({});
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");
  const [activeDownloads, setActiveDownloads] = createSignal<Record<string, DownloadProgress>>({});
  const [downloadedFiles, setDownloadedFiles] = createSignal<Record<string, string>>({});
  const [downloadDir, setDownloadDir] = createSignal("");
  const [commandLogs, setCommandLogs] = createSignal<Record<string, CommandOutput[]>>({});
  const [runningCommands, setRunningCommands] = createSignal<Record<string, boolean>>({});
  
  // Sudo modal state
  const [sudoPromptApp, setSudoPromptApp] = createSignal<ThirdPartyEntry | null>(null);
  const [sudoPromptPwd, setSudoPromptPwd] = createSignal("");

  const [platform, setPlatform] = createSignal("linux");
  let unlisten: UnlistenFn[] = [];

  onMount(async () => {
    unlisten.push(await listen<DownloadProgress>("download-progress", (e) => {
      setActiveDownloads(prev => ({ ...prev, [e.payload.tool_id]: e.payload }));
    }));
    unlisten.push(await listen<CommandOutput>("command-output", (e) => {
      setCommandLogs(prev => {
        const logs = prev[e.payload.tool_id] || [];
        return { ...prev, [e.payload.tool_id]: [...logs, e.payload] };
      });
    }));
    try { setPlatform(await invoke<string>("get_platform")); } catch { /* fallback "linux" */ }
    try {
      const prefs = await getPrefs();
      setDownloadDir(prefs.download_dir || await getDefaultDownloadDir());
    } catch { setDownloadDir(await getDefaultDownloadDir().catch(() => "")); }
    await loadApps();
  });

  onCleanup(() => { unlisten.forEach(fn => fn()); unlisten = []; });

  async function loadApps() {
    setLoading(true);
    try {
      const list = await getThirdPartyApps();
      setApps(list);
      for (const a of list) {
        getThirdPartyIcon(a.id)
          .then(src => { if (src) setIcons(p => ({ ...p, [a.id]: src })); })
          .catch(() => {});
      }
    } catch (e) {
      showToast("error", `Failed to load apps: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    if (!q) return apps();
    return apps().filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  const isLinux = () => platform() === "linux";

  // Detect actual sudo invocations: word-boundary match, ignoring lines that are comments
  // or that have "sudo" only inside a string literal. Imperfect but better than .includes("sudo").
  const SUDO_RE = /(^|[\s;&|`(])sudo(\s|$)/;
  const needsSudo = (cmds: string[]) =>
    cmds.some(c => {
      const stripped = c.replace(/^\s*#.*$/, "").trim();
      return stripped.length > 0 && SUDO_RE.test(stripped);
    });

  function getPlatformUrl(app: ThirdPartyEntry) {
    return isLinux() ? app.url_linux : app.url_windows;
  }
  function getPlatformFilename(app: ThirdPartyEntry) {
    const fn = isLinux() ? app.filename_linux : app.filename_windows;
    return fn || app.name;
  }
  function getPlatformDownloadType(app: ThirdPartyEntry) {
    return isLinux() ? app.download_type_linux : app.download_type_windows;
  }

  async function handleDownload(app: ThirdPartyEntry) {
    const url = getPlatformUrl(app);
    const filename = getPlatformFilename(app);
    const dlType = getPlatformDownloadType(app);
    if (!url) { showToast("error", "No download URL for this platform."); return; }
    const dir = downloadDir();
    if (!dir) { showToast("error", "No download directory configured."); return; }

    setActiveDownloads(p => ({ ...p, [app.id]: { tool_id: app.id, downloaded: 0, total: 0, speed_bps: 0 } }));
    try {
      const path = await downloadThirdPartyApp(app.id, url, filename, dlType, dir);
      setDownloadedFiles(p => ({ ...p, [app.id]: path }));
      showToast("success", dlType === "installer"
        ? `Installer launched: ${filename}`
        : `Saved: ${filename}`
      );
    } catch (e) {
      showToast("error", `Download failed: ${e}`);
    } finally {
      setActiveDownloads(p => { const n = { ...p }; delete n[app.id]; return n; });
    }
  }

  function getProgress(id: string) {
    const p = activeDownloads()[id];
    if (!p || p.total === 0) return 0;
    return Math.round((p.downloaded / p.total) * 100);
  }

  function handleRunCommandsBtn(app: ThirdPartyEntry) {
    // Always show the modal so the user can review the commands before they run.
    // Password is only required if any command actually invokes sudo.
    setSudoPromptPwd("");
    setSudoPromptApp(app);
  }

  async function handleRunCommands(app: ThirdPartyEntry, pwd?: string) {
    if (!app.commands_linux || app.commands_linux.length === 0) return;
    setRunningCommands(p => ({ ...p, [app.id]: true }));
    setCommandLogs(p => ({ ...p, [app.id]: [] })); // clear old logs
    try {
      await executeThirdPartyCommands(app.id, app.commands_linux, pwd);
      showToast("success", `Commands for ${app.name} completed.`);
    } catch (e) {
      showToast("error", `Commands failed: ${e}`);
    } finally {
      setRunningCommands(p => ({ ...p, [app.id]: false }));
    }
  }

  return (
    <div class="page">
      <div class="page-header">
        <h2>Third-Party Apps</h2>
        <SearchBar value={search()} onInput={setSearch} placeholder="Search apps…" />
      </div>

      <div class="library-summary">
        <span>{apps().length} app{apps().length !== 1 ? "s" : ""}</span>
        <span>Saving to: {downloadDir()}</span>
      </div>

      <Show when={!loading()} fallback={<div class="loading">Loading…</div>}>
        <Show when={filtered().length > 0} fallback={<div class="empty">No third-party apps in catalog.</div>}>
          <div class="tool-grid">
            <For each={filtered()}>
              {(app) => {
                const dl = () => activeDownloads()[app.id];
                const pct = () => getProgress(app.id);
                const done = () => downloadedFiles()[app.id];
                const hasUrl = () => !!getPlatformUrl(app);
                const dlType = () => getPlatformDownloadType(app);

                const isCommandsOnly = () => dlType() === "commands";
                return (
                  <div class="tool-card" id={`tp-card-${app.id}`}>
                    <div class="tool-card-header">
                      <div class="tool-icon">
                        {icons()[app.id]
                          ? <img src={icons()[app.id]} alt={app.name} class="tool-icon-img" />
                          : <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                              <path d="M20 6h-2.18c.07-.44.18-.86.18-1 0-2.21-1.79-4-4-4s-4 1.79-4 4c0 .14.11.56.18 1H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                            </svg>
                        }
                      </div>
                      <div class="tool-info">
                        <h3>{app.name}</h3>
                        <div class="tool-meta">
                          {app.category && <span class="category-badge cat-default">{app.category}</span>}
                          <span class={`tp-type-badge ${dlType() === "installer" ? "tp-type-installer" : dlType() === "commands" ? "tp-type-commands" : "tp-type-archive"}`}>
                            {dlType() === "installer" ? "Installer" : dlType() === "commands" ? "Commands" : "Archive"}
                          </span>
                          <span class="tp-platform-badges">
                            {app.url_linux && <span class="tp-plat" title="Linux">🐧</span>}
                            {app.url_windows && <span class="tp-plat" title="Windows">🪟</span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p class="tool-description">{app.description}</p>

                    {app.tags.length > 0 && (
                      <div class="tool-tags">
                        {app.tags.map(t => <span class="tool-tag">{t}</span>)}
                      </div>
                    )}

                    <Show when={dl()}>
                      <div class="download-info">
                        <div class="progress-bar">
                          <div class="progress-fill" style={{ width: `${pct()}%` }} />
                        </div>
                        <div class="download-stats">
                          <span>{pct()}%</span>
                          <span>{formatBytes(dl()!.downloaded)} / {formatBytes(dl()!.total)}</span>
                          {dl()!.speed_bps > 0 && <span>{formatBytes(dl()!.speed_bps)}/s</span>}
                        </div>
                      </div>
                    </Show>

                    <Show when={commandLogs()[app.id] && commandLogs()[app.id].length > 0}>
                      <div class="terminal-output" style={{ "margin-bottom": "12px", "max-height": "150px", "overflow-y": "auto", "background": "rgba(0,0,0,0.5)", "padding": "8px", "border-radius": "6px", "font-family": "monospace", "font-size": "11px" }}>
                        <For each={commandLogs()[app.id]}>
                          {(log) => (
                            <div style={{ color: log.is_error ? "var(--danger)" : "var(--text)" }}>{log.line}</div>
                          )}
                        </For>
                      </div>
                    </Show>

                    <div class="tool-actions">
                      <Show when={hasUrl() && !isCommandsOnly()}>
                        <button
                          class="btn btn-install"
                          disabled={!!dl()}
                          onClick={() => handleDownload(app)}
                          id={`tp-dl-${app.id}`}
                          title={`Download ${getPlatformFilename(app)}`}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                          </svg>
                          {dl() ? `${pct()}%…` : done() ? (dlType() === "installer" ? "Re-run" : "Re-download") : "Download"}
                        </button>
                      </Show>
                      {done() && dlType() === "archive" && (
                        <button class="btn btn-icon" onClick={() => openFileFolder(done()!)} title="Open folder">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                          </svg>
                        </button>
                      )}
                      <Show when={isLinux() && app.commands_linux && app.commands_linux.length > 0}>
                         <button
                          class="btn btn-admin"
                          disabled={runningCommands()[app.id]}
                          onClick={() => handleRunCommandsBtn(app)}
                          title="Execute Linux bash commands"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                          {runningCommands()[app.id] ? "Running..." : "Run Script"}
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>

      {/* Confirm + (optional) Sudo Password Modal */}
      <Show when={sudoPromptApp()}>
        {(() => {
          const app = sudoPromptApp()!;
          const cmds = app.commands_linux || [];
          const requiresSudo = needsSudo(cmds);
          const canConfirm = () => !requiresSudo || sudoPromptPwd().length > 0;
          const submit = () => {
            handleRunCommands(app, requiresSudo ? sudoPromptPwd() : "");
            setSudoPromptApp(null);
          };
          return (
            <div class="modal-overlay">
              <div class="modal-content" style={{ "max-width": "560px" }}>
                <h3 style={{ "margin-top": "0", "margin-bottom": "12px", color: "var(--text)" }}>
                  Run script for {app.name}
                </h3>
                <p style={{ "font-size": "13px", color: "var(--text-muted)", "margin-bottom": "12px", "line-height": "1.4" }}>
                  These commands come from the catalog and will run on your machine.
                  Review them before continuing{requiresSudo ? " — administrator privileges are required" : ""}.
                </p>
                <pre style={{
                  "background": "rgba(0,0,0,0.5)", padding: "10px", "border-radius": "6px",
                  "font-family": "monospace", "font-size": "12px", "max-height": "200px",
                  "overflow-y": "auto", "white-space": "pre-wrap", "word-break": "break-all",
                  "margin": "0 0 16px 0", color: "var(--text)",
                }}>{cmds.join("\n")}</pre>
                <Show when={requiresSudo}>
                  <input
                    type="password"
                    class="form-input"
                    value={sudoPromptPwd()}
                    onInput={e => setSudoPromptPwd(e.currentTarget.value)}
                    onKeyDown={e => { if (e.key === "Enter" && canConfirm()) submit(); }}
                    placeholder="Sudo password"
                    autofocus
                    style={{ "margin-bottom": "16px", width: "100%", "box-sizing": "border-box" }}
                  />
                </Show>
                <div style={{ display: "flex", gap: "10px", "justify-content": "flex-end" }}>
                  <button class="btn btn-small" onClick={() => setSudoPromptApp(null)}>Cancel</button>
                  <button class="btn btn-install" disabled={!canConfirm()} onClick={submit}>
                    {requiresSudo ? "Confirm & Run" : "Run"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Show>

    </div>
  );
}
