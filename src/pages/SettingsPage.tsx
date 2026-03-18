import { createSignal, onMount } from "solid-js";
import { getPat, savePat, clearPat, getRateLimit } from "../lib/api";
import { showToast } from "../lib/stores";

export default function SettingsPage() {
  const [pat, setPat] = createSignal("");
  const [hasPat, setHasPat] = createSignal(false);
  const [showPat, setShowPat] = createSignal(false);
  const [rateRemaining, setRateRemaining] = createSignal<number | null>(null);
  const [rateLimit, setRateLimit] = createSignal<number | null>(null);
  const [saving, setSaving] = createSignal(false);

  onMount(async () => {
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

  return (
    <div class="page">
      <div class="page-header">
        <h2>Settings</h2>
      </div>

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
