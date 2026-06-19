/**
 * Runtime (per-map) fog-of-war toggle persistence.
 *
 * The DM can enable/disable fog-of-war per map at runtime. This preference is
 * stored in localStorage keyed by `campaignId:mapId` so it survives navigation
 * and is mirrored by the players projection window.
 *
 * Persistence is intentionally driven by explicit user actions (toggling the
 * switch) rather than a reactive effect, to avoid clobbering the stored value
 * with a transient default during mount (which also double-fires under
 * React StrictMode).
 */

/** localStorage key holding a map of `campaignId:mapId` -> boolean. */
const FOG_ENABLED_KEY = 'app.map.fog.enabled';

/** Builds the per-map scoped key. */
function scopedKey(campaignId: string, mapId: string): string {
  return `${campaignId}:${mapId}`;
}

/**
 * Reads the persisted runtime fog toggle for a given campaign+map.
 *
 * @returns The stored boolean, or `null` when there is no stored value
 *          (caller decides the default, e.g. the map's `fogEnabledByDefault`).
 */
export function readRuntimeFogEnabled(
  campaignId: string | undefined,
  mapId: string | null | undefined,
): boolean | null {
  if (!campaignId || !mapId) return null;
  try {
    const raw = localStorage.getItem(FOG_ENABLED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const value = parsed?.[scopedKey(campaignId, mapId)];
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Persists the runtime fog toggle for a campaign+map and notifies every window
 * (other tabs via the `storage` event, same-renderer listeners via
 * BroadcastChannel, and separate Electron windows via the projection poke).
 *
 * @param campaignId - Active campaign id.
 * @param mapId - Map the toggle applies to.
 * @param enabled - New fog-of-war enabled state.
 */
export function writeRuntimeFogEnabled(
  campaignId: string | undefined,
  mapId: string | null | undefined,
  enabled: boolean,
): void {
  if (!campaignId || !mapId) return;
  try {
    const raw = localStorage.getItem(FOG_ENABLED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = { ...(parsed || {}), [scopedKey(campaignId, mapId)]: enabled };
    localStorage.setItem(FOG_ENABLED_KEY, JSON.stringify(next));
  } catch { /* storage may be unavailable */ }

  try {
    const bc = new BroadcastChannel('campaign-sync');
    bc.postMessage({ type: 'fog-enabled-updated', campaignId, mapId, fogEnabled: enabled, at: Date.now() });
    bc.close();
  } catch { /* BroadcastChannel may be unsupported */ }

  try {
    (window as unknown as { electronAPI?: { projectionPoke?: (payload: unknown) => void } })
      .electronAPI?.projectionPoke?.({ reason: 'fog-enabled-updated', campaignId, mapId, fogEnabled: enabled });
  } catch { /* not running under Electron */ }
}
