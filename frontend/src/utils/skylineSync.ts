/**
 * Skyline cross-window synchronization helpers.
 *
 * Changing the active Skyline character or its emote must be reflected
 * immediately across every window/tab: the main window overlays, other
 * browser tabs and the separate Electron projection windows.
 *
 * Three channels are used because each one covers a different scenario:
 * - `localStorage` `storage` events: cross-tab in the browser.
 * - `BroadcastChannel`: fast same-origin sync within the same renderer.
 * - Electron `projectionPoke` IPC: the only channel that crosses separate
 *   Electron `BrowserWindow` instances (BroadcastChannel does not).
 */

/** localStorage key other windows listen to in order to refresh on change. */
const ACTIVE_CHARACTER_UPDATED_KEY = 'app.skyline.activeCharacterUpdated';

/** Name of the BroadcastChannel used for campaign-wide synchronization. */
const CAMPAIGN_SYNC_CHANNEL = 'campaign-sync';

/**
 * Notifies all windows that the active Skyline character or emote changed,
 * so they refresh from the server without waiting for periodic polling.
 *
 * Every channel is wrapped in its own try/catch so a failure in one (e.g.
 * BroadcastChannel unsupported, not running under Electron) never prevents
 * the others from firing.
 *
 * @param campaignId - Campaign whose Skyline state changed.
 */
export function notifySkylineCharacterChanged(campaignId: string): void {
  try {
    localStorage.setItem(
      ACTIVE_CHARACTER_UPDATED_KEY,
      JSON.stringify({ campaignId, at: Date.now() }),
    );
  } catch { /* storage may be unavailable */ }

  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(CAMPAIGN_SYNC_CHANNEL);
      channel.postMessage({ type: 'activeSkylineChanged', campaignId });
      channel.close();
    }
  } catch { /* BroadcastChannel may be unsupported */ }

  try {
    (window as unknown as { electronAPI?: { projectionPoke?: (payload: unknown) => void } })
      .electronAPI?.projectionPoke?.({ kind: 'activeSkylineChanged', campaignId });
  } catch { /* not running under Electron */ }
}
