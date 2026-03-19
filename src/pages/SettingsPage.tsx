import { createSignal, onMount, Show } from "solid-js";
import {
  getPat,
  savePat,
  clearPat,
  getRateLimit,
  getAppimagePath,
  desktopFileExists,
  addToAppMenu,
  removeFromAppMenu,
} from "../lib/api";
import { showToast } from "../lib/stores";

export default function SettingsPage() {
  const [pat, setPat] = createSignal("");
  const [hasPat, setHasPat] = createSignal(false);
  const [showPat, setShowPat] = createSignal(false);
  const [rateRemaining, setRateRemaining] = createSignal<number | null>(null);
  const [rateLimit, setRateLimit] = createSignal<number | null>(null);
  const [saving, setSaving] = createSignal(false);

  // Desktop integration
  const [appimagePath, setAppimagePath] = createSignal("");
  const [isDesktopInstalled, setIsDesktopInstalled] = createSignal(false);
  const [isLinux, setIsLinux] = createSignal(false);
  const [desktopBusy, setDesktopBusy] = createSignal(false);

  onMount(async () => {
    // Load PAT
    try {
      const existing = await getPat();
      if (existing) {
        setHasPat(true);
        setPat(existing);
      }
    } catch {
      // No PAT stored
    }
    refreshRateLimit();

    // Desktop integration - detect AppImage and status
    try {
      const detected = await getAppimagePath();
      if (detected !== null) {
        setIsLinux(true);
        setAppimagePath(detected);
      } else {
        // Check if we're on Linux anyway (env var absent = not running as AppImage)
        const exists = await desktopFileExists();
        setIsLinux(true);
        setIsDesktopInstalled(exists);
      }
    } catch {
      // Not on Linux or error
    }

    try {
      const exists = await desktopFileExists();
      setIsDesktopInstalled(exists);
    } catch {
      // Ignore
    }
  });

  async function refreshRateLimit() {
    try {
      const [remaining, limit] = await getRateLimit();
      setRateRemaining(remaining);
      setRateLimit(limit);
    } catch {
      // Offline or error
    }
  }

  async function handleSave() {
    const token = pat().trim();
    if (!token) return;
    setSaving(true);
    try {
      await savePat(token);
      setHasPat(true);
      showToast("success", "GitHub PAT saved to system keychain.");
      refreshRateLimit();
    } catch (e) {
      showToast("error", `Failed to save PAT: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    try {
      await clearPat();
      setPat("");
      setHasPat(false);
      showToast("info", "GitHub PAT removed.");
      refreshRateLimit();
    } catch (e) {
      showToast("error", `Failed to clear PAT: ${e}`);
    }
  }

  async function handleAddToMenu() {
    const path = appimagePath().trim();
    if (!path) {
      showToast("error", "Please enter the AppImage path.");
      return;
    }
    setDesktopBusy(true);
    try {
      await addToAppMenu(path);
      setIsDesktopInstalled(true);
      showToast("success", "PyArsenal added to application menu.");
    } catch (e) {
      showToast("error", `Failed to add to menu: ${e}`);
    } finally {
      setDesktopBusy(false);
    }
  }

  async function handleRemoveFromMenu() {
    setDesktopBusy(true);
    try {
      await removeFromAppMenu();
      setIsDesktopInstalled(false);
      showToast("info", "PyArsenal removed from application menu.");
    } catch (e) {
      showToast("error", `Failed to remove from menu: ${e}`);
    } finally {
      setDesktopBusy(false);
    }
  }

  return (
    <div class="page">
      <div class="page-header">
        <h2>Settings</h2>
      </div>

      {/* Desktop Integration - Linux only */}
      <Show when={isLinux()}>
        <div class="settings-section">
          <h3>Desktop Integration (AppImage)</h3>
          <p class="settings-hint">
            Add PyArsenal to your application menu so you can launch it from the system launcher.
          </p>

          <div class="desktop-status">
            <span
              class={`status-dot ${isDesktopInstalled() ? "status-installed" : "status-not-installed"}`}
            />
            <span>
              {isDesktopInstalled()
                ? "Installed in application menu"
                : "Not in application menu"}
            </span>
          </div>

          <div class="pat-input-row">
            <input
              type="text"
              value={appimagePath()}
              onInput={(e) => setAppimagePath(e.currentTarget.value)}
              placeholder="/path/to/PyArsenal.AppImage"
              class="pat-input"
            />
          </div>

          <div class="pat-actions">
            <Show when={!isDesktopInstalled()}>
              <button
                class="btn btn-install"
                disabled={desktopBusy() || !appimagePath().trim()}
                onClick={handleAddToMenu}
              >
                {desktopBusy() ? "Adding..." : "Add to App Menu"}
              </button>
            </Show>
            <Show when={isDesktopInstalled()}>
              <button
                class="btn btn-update"
                disabled={desktopBusy() || !appimagePath().trim()}
                onClick={handleAddToMenu}
              >
                {desktopBusy() ? "Updating..." : "Update Path"}
              </button>
              <button
                class="btn btn-uninstall"
                disabled={desktopBusy()}
                onClick={handleRemoveFromMenu}
                style={{ "font-size": "13px", padding: "8px 16px" }}
              >
                Remove from App Menu
              </button>
            </Show>
          </div>
        </div>
      </Show>

      <div class="settings-section">
        <h3>GitHub Personal Access Token</h3>
        <p class="settings-hint">
          Optional. Increases GitHub API rate limit from 60 to 5,000 requests/hour.
          The token is stored securely in your system keychain.
        </p>

        <div class="pat-input-row">
          <input
            type={showPat() ? "text" : "password"}
            value={pat()}
            onInput={(e) => setPat(e.currentTarget.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            class="pat-input"
          />
          <button
            class="btn btn-small"
            onClick={() => setShowPat(!showPat())}
          >
            {showPat() ? "Hide" : "Show"}
          </button>
        </div>

        <div class="pat-actions">
          <button
            class="btn btn-install"
            disabled={saving() || !pat().trim()}
            onClick={handleSave}
          >
            {saving() ? "Saving..." : "Save Token"}
          </button>
          {hasPat() && (
            <button class="btn btn-uninstall" onClick={handleClear}>
              Remove Token
            </button>
          )}
        </div>
      </div>

      <div class="settings-section">
        <h3>API Rate Limit</h3>
        {rateRemaining() !== null ? (
          <div class="rate-limit-info">
            <div class="rate-bar">
              <div
                class="rate-fill"
                style={{
                  width: `${((rateRemaining()! / rateLimit()!) * 100)}%`,
                }}
              />
            </div>
            <span>
              {rateRemaining()} / {rateLimit()} requests remaining
            </span>
          </div>
        ) : (
          <p class="settings-hint">Unable to check rate limit status.</p>
        )}
        <button class="btn btn-small" onClick={refreshRateLimit}>
          Refresh
        </button>
      </div>

      <div class="settings-section">
        <h3>About</h3>
        <p class="settings-hint">
          PyArsenal v0.1.0 — Personal tool launcher
        </p>
      </div>
    </div>
  );
}
