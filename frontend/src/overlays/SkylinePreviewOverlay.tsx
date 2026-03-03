/**
 * SkylinePreviewOverlay
 *
 * Componente global que muestra en miniatura, en la esquina inferior derecha
 * de la app principal, las imágenes que en ese momento aparecen en la ventana
 * de proyección Skyline: personaje activo, ítems de tienda e imagen del turno
 * actual de combate (cuando hay una batalla en curso).
 *
 * Se activa/desactiva mediante la clave de localStorage
 * `app.settings.showSkylinePreview`. El toggle está en SettingsSection.
 *
 * IMPORTANTE – Aislamiento del interceptor global de logout:
 * Este componente usa `silentApi`, una instancia axios PROPIA que envía el
 * token JWT pero NO tiene el interceptor de respuesta que, ante un 401/403,
 * elimina el access_token y redirige a login. De esta forma, cualquier error
 * de red o de permisos en el polling silencioso NO rompe la sesión activa ni
 * las ventanas de proyección secundarias.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Box, Tooltip } from '@mui/material';
import axios from 'axios';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import API_BASE_URL from '../apiBase';

/** localStorage key that persists the user preference. */
export const SKYLINE_PREVIEW_KEY = 'app.settings.showSkylinePreview';

/** Thumbnail size in px for each image in the overlay. */
const THUMB = 72;

/** Polling interval in ms. */
const POLL_MS = 3000;

// ─── Silent axios instance ─────────────────────────────────────────────────
//
// ISOLATED from the global `api` instance:
// - Sends the JWT token as Bearer header (same as the global `api`)
// - Does NOT have the response interceptor that logs the user out on 401/403
// - Any error from this instance is handled locally and never bubbles up to
//   the global error handling, so projection windows keep working.

/** Builds a fresh axios instance that sends auth but never logs out on errors. */
const silentApi = axios.create({ baseURL: API_BASE_URL });

silentApi.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers = config.headers || {};
      if (!('Authorization' in config.headers)) {
        (config.headers as any)['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {}
  return config;
});
// NO response interceptor → 401/403 errors stay local, never log the user out.

// ─── Local API helpers ──────────────────────────────────────────────────────

/**
 * Returns the active skyline character ID for a campaign without touching the
 * global `api` instance.
 *
 * @param campaignId - Campaign identifier.
 * @returns Character ID string, or null if none is set.
 */
async function silentGetActiveCharId(campaignId: string): Promise<string | null> {
  const res = await silentApi.get<{ characterId: string | null }>(
    `/campaigns/${campaignId}/active-skyline-character`,
  );
  return res.data?.characterId ?? null;
}

/** Shape of a skyline item as returned by the API. */
interface SkylineItem {
  id: string;
  campaignId: string;
  cellId: string;
  label: string | null;
  order: number;
  createdAt: string;
}

/** Shape of a single participant in the projection battle state. */
interface BattleStateItem {
  id: string;
  name: string;
  imageUrl: string | null;
  fullImageUrl: string | null;
  size: string | null;
  role: 'ally' | 'foe' | undefined;
}

/** Projection battle-state shape (richer than the auth endpoint). */
interface BattleStatePublic {
  started: boolean;
  currentTurnId: string | null;
  items: BattleStateItem[];
}

/**
 * Returns the skyline item overlays for a campaign without touching the global
 * `api` instance.
 *
 * @param campaignId - Campaign identifier.
 * @returns Array of skyline item descriptors.
 */
async function silentGetSkylineItems(campaignId: string): Promise<SkylineItem[]> {
  const res = await silentApi.get<SkylineItem[]>(
    `/campaigns/${campaignId}/skyline-items`,
  );
  return res.data;
}

/** Shape of the relevant character fields we need for the thumbnail. */
interface CharThumb {
  name: string;
  characterImageUrl: string | null;
  tokenImageUrl: string | null;
  tokenColor: string | null;
}

/**
 * Returns the character data needed to render the thumbnail without touching
 * the global `api` instance.
 *
 * @param charId - Character identifier.
 * @returns Relevant character fields.
 */
async function silentGetCharacter(charId: string): Promise<CharThumb> {
  const res = await silentApi.get<CharThumb>(`/characters/${charId}`);
  return res.data;
}

/**
 * Returns the projection battle state (includes fullImageUrl per participant)
 * via the public no-auth endpoint, using the isolated silentApi.
 *
 * @param campaignId - Campaign identifier.
 * @returns Public battle state with rich item data.
 */
async function silentGetBattleState(campaignId: string): Promise<BattleStatePublic> {
  const res = await silentApi.get<any>(`/campaigns/projection/${campaignId}/battle-state`);
  const data = res.data;
  return {
    started: !!data.started,
    currentTurnId: data.currentTurnId ?? null,
    items: Array.isArray(data.items)
      ? data.items.map((x: any) => ({
          id: x.id,
          name: x.name,
          imageUrl: x.imageUrl ?? null,
          fullImageUrl: x.fullImageUrl ?? null,
          size: x.size ?? null,
          role: x.role,
        }))
      : [],
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Reads the current enabled state from localStorage.
 *
 * @returns `true` when the user has enabled the skyline preview (default off).
 */
function readEnabled(): boolean {
  try {
    return localStorage.getItem(SKYLINE_PREVIEW_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Reads whether "show current turn image" is enabled from localStorage.
 * Shares the same key as the combat settings toggle in the main app.
 *
 * @returns `true` when the option is on (defaults to true).
 */
function readShowCurrentTurnImage(): boolean {
  try {
    const val = localStorage.getItem('app.combat.showCurrentTurnImage');
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Builds a URL for a shop cell image that embeds the JWT token as a query
 * param so plain `<img>` tags can load it without going through axios.
 *
 * @param cellId - Cell identifier.
 * @returns Absolute URL with ?token= query param.
 */
function buildCellImageUrl(cellId: string): string {
  const token = localStorage.getItem('access_token') ?? '';
  return `${API_BASE_URL}/shops/cells/${cellId}/stream?token=${encodeURIComponent(token)}`;
}

/**
 * Builds a URL for a character image that embeds the JWT token as a query
 * param so plain `<img>` tags can load it without going through axios.
 *
 * @param src - Original image URL (absolute or relative).
 * @returns URL usable by a plain img element.
 */
function buildCharImageUrl(src: string): string {
  if (!src) return '';
  // If it's already a data URL or absolute external URL, use as-is
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    // Append token for our own backend URLs
    if (src.includes('localhost') || src.includes(window.location.hostname)) {
      const token = localStorage.getItem('access_token') ?? '';
      const sep = src.includes('?') ? '&' : '?';
      return `${src}${sep}token=${encodeURIComponent(token)}`;
    }
    return src;
  }
  // Relative path – prepend base URL
  const token = localStorage.getItem('access_token') ?? '';
  const full = `${API_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
  const sep = full.includes('?') ? '&' : '?';
  return `${full}${sep}token=${encodeURIComponent(token)}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Global persistent widget rendered inside MainLayout that mirrors what the
 * Skyline projection window is currently showing, as small thumbnails.
 *
 * Polls the backend every {@link POLL_MS} ms while a campaign is active and
 * the preference is enabled. Stops polling when hidden.
 *
 * All API calls go through {@link silentApi} – a dedicated axios instance
 * that NEVER triggers the global logout interceptor, so any 401/403 from
 * backend guards (e.g. CampaignOwnerGuard on skyline-items) does NOT break
 * the user session or the separate projection windows.
 */
const SkylinePreviewOverlay: React.FC = () => {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id;

  // ── preference state ──────────────────────────────────────────────────
  const [enabled, setEnabled] = useState<boolean>(readEnabled);

  /** React to changes made from SettingsSection in another tab (storage event). */
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === SKYLINE_PREVIEW_KEY) setEnabled(e.newValue === 'true');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  /**
   * Also listen to a custom event dispatched by SettingsSection within the
   * same window (storage events don't fire for same-tab writes).
   */
  useEffect(() => {
    const handler = () => setEnabled(readEnabled());
    window.addEventListener('skylinePreviewToggled', handler);
    return () => window.removeEventListener('skylinePreviewToggled', handler);
  }, []);

  // ── data state ────────────────────────────────────────────────────────
  const [character, setCharacter] = useState<CharThumb | null>(null);
  const [items, setItems] = useState<SkylineItem[]>([]);
  const [currentTurnParticipant, setCurrentTurnParticipant] = useState<BattleStateItem | null>(null);
  /** Object URL created from a blob fetch of the turn image (auth-safe, revoked on change). */
  const [turnImageObjectUrl, setTurnImageObjectUrl] = useState<string | null>(null);
  const turnImageLoadRef = useRef<AbortController | null>(null);
  const [showCurrentTurnImage] = useState<boolean>(readShowCurrentTurnImage);

  const isFetching = useRef(false);

  // ── turn image blob loader ────────────────────────────────────────────
  /**
   * Loads the fullImageUrl of the current turn participant via silentApi
   * (same technique as AuthImage) so that URLs requiring JWT auth header
   * work correctly inside the overlay's plain <img> tag.
   *
   * For data: URIs the URL is used directly without a network request.
   */
  useEffect(() => {
    // Cancel any in-progress load
    if (turnImageLoadRef.current) {
      turnImageLoadRef.current.abort();
      turnImageLoadRef.current = null;
    }
    // Revoke previous object URL
    setTurnImageObjectUrl((prev) => {
      if (prev && !prev.startsWith('data:')) URL.revokeObjectURL(prev);
      return null;
    });

    const url = currentTurnParticipant?.fullImageUrl;
    if (!url) return;

    // data URIs can be used directly
    if (url.startsWith('data:')) {
      setTurnImageObjectUrl(url);
      return;
    }

    const controller = new AbortController();
    turnImageLoadRef.current = controller;

    // Resolve relative URLs to absolute
    const absUrl = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

    silentApi
      .get(absUrl, { responseType: 'blob', signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const objUrl = URL.createObjectURL(res.data);
        setTurnImageObjectUrl(objUrl);
      })
      .catch(() => {
        // Silently ignore — leave image blank
      });

    return () => {
      controller.abort();
    };
  }, [currentTurnParticipant?.fullImageUrl]);

  /**
   * Fetches the current active skyline character, shop items and combat
   * turn image via the isolated {@link silentApi}. All errors are swallowed
   * locally so the global session is never affected.
   */
  const poll = useCallback(async () => {
    if (!campaignId || isFetching.current) return;
    isFetching.current = true;
    try {
      // Run all three calls in parallel; each is independently protected
      const [charId, skyItems, battleState] = await Promise.allSettled([
        silentGetActiveCharId(campaignId),
        silentGetSkylineItems(campaignId),
        silentGetBattleState(campaignId),
      ]);

      // Update items only on success
      if (skyItems.status === 'fulfilled') {
        setItems(skyItems.value);
      }

      // Update character only on success
      if (charId.status === 'fulfilled' && charId.value) {
        try {
          const ch = await silentGetCharacter(charId.value);
          setCharacter(ch);
        } catch {
          setCharacter(null);
        }
      } else if (charId.status === 'fulfilled' && !charId.value) {
        setCharacter(null);
      }

      // Update current turn participant from battle state.
      // NOTE: server-persisted items intentionally omit fullImageUrl (images are
      // only sent via BroadcastChannel to avoid 10 MB+ payloads with base64 data).
      // When the server tells us a new turn started we resolve fullImageUrl from
      // the last BroadcastChannel snapshot stored in localStorage.
      if (battleState.status === 'fulfilled') {
        const bs = battleState.value;
        if (bs.started && bs.currentTurnId) {
          // Capture as const so TypeScript knows it's non-null inside the callback.
          const turnId: string = bs.currentTurnId;
          setCurrentTurnParticipant((prev) => {
            // Same turn and we already have a valid image — don't disturb it.
            if (prev?.id === turnId && prev?.fullImageUrl) return prev;

            // Try to resolve fullImageUrl from the latest localStorage BC snapshot.
            let fullImageUrl: string | null = null;
            let name = bs.items.find(it => it.id === turnId)?.name ?? null;
            let role: 'ally' | 'foe' | undefined = (bs.items.find(it => it.id === turnId) as any)?.role;
            try {
              const raw = localStorage.getItem('app.skyline.initiativeStrip');
              if (raw) {
                const stored = JSON.parse(raw);
                if (stored?.campaignId === campaignId) {
                  const match = (stored.items as any[])?.find((x: any) => x.id === turnId);
                  if (match?.fullImageUrl) {
                    fullImageUrl = match.fullImageUrl;
                    if (match.name) name = match.name;
                    if (match.role) role = match.role;
                  }
                }
              }
            } catch {}

            if (!fullImageUrl) {
              // Battle state changed but no BC data yet; clear so we don't show stale image.
              return null;
            }
            return { id: turnId, name: name || '', imageUrl: null, fullImageUrl, size: null, role };
          });
        } else {
          setCurrentTurnParticipant(null);
        }
      }
    } catch {
      // Safety net — leave stale data
    } finally {
      isFetching.current = false;
    }
  }, [campaignId]);

  // ── polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !campaignId) {
      setCharacter(null);
      setItems([]);
      setCurrentTurnParticipant(null);
      return;
    }

    let disposed = false;
    const doPoll = () => {
      if (disposed || document.visibilityState === 'hidden') return;
      poll();
    };

    doPoll();
    const id = setInterval(doPoll, POLL_MS);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [enabled, campaignId, poll]);

  // React instantaneously to DM-triggered skyline changes (no need to wait for next poll)
  useEffect(() => {
    if (!enabled || !campaignId) return;
    const handler = (e: StorageEvent) => {
      if (
        e.key === 'app.skyline.activeCharacterUpdated' ||
        e.key === 'app.skyline.itemsUpdated' ||
        // Re-poll when the initiative strip changes (turn change, battle start/end)
        e.key === 'app.combat.initiativeStripUpdated'
      ) {
        poll();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [enabled, campaignId, poll]);

  // Also react to BroadcastChannel messages for fast combat-turn sync
  useEffect(() => {
    if (!enabled || !campaignId) return;
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('campaign-sync');
        bc.onmessage = (e: MessageEvent) => {
          const data = e?.data;
          if (!data || data?.campaignId !== campaignId) return;

          if (data?.type === 'initiativeStripUpdated') {
            // ── Use BC data directly (same as ProjectionSkylinePage) ──────
            // The BC message always has the freshest fullImageUrl, straight
            // from the DM's CombatView — no server round-trip needed.
            const battleStarted: boolean = !!data.battleStarted;
            const currentTurnId: string | null = data.currentTurnId ?? null;
            const bcItems: BattleStateItem[] = Array.isArray(data.items)
              ? data.items.map((x: any) => ({
                  id: x.id,
                  name: x.name,
                  imageUrl: x.imageUrl ?? null,
                  fullImageUrl: x.fullImageUrl ?? null,
                  size: x.size ?? null,
                  role: x.role,
                }))
              : [];

            if (battleStarted && currentTurnId) {
              const participant = bcItems.find(it => it.id === currentTurnId) ?? null;
              if (participant?.fullImageUrl) {
                // BC has rich image data (initiative strip enabled) — use it directly.
                setCurrentTurnParticipant(participant);
              } else {
                // BC has no image data: initiative strip is disabled (showInitiativeStrip=false)
                // or the participant wasn't found in the empty items list.
                // Preserve the existing participant if it's the same turn so the image
                // doesn't flicker off. Poll the server to restore the image if the turn
                // actually changed or we have no valid participant yet.
                setCurrentTurnParticipant((prev) => {
                  if (prev?.id === currentTurnId && prev?.fullImageUrl) return prev;
                  return null;
                });
                poll(); // fetch fullImageUrl from server-persisted battle state
              }
            } else {
              setCurrentTurnParticipant(null);
            }
            return; // don't poll server for this event
          }

          if (
            data?.type === 'activeSkylineChanged' ||
            data?.type === 'skylineItemsChanged'
          ) {
            poll();
          }
        };
      }
    } catch {}
    return () => { try { bc?.close(); } catch {} };
  }, [enabled, campaignId, poll]);

  // Hydrate currentTurnParticipant from localStorage on mount/enable
  // (covers the case where the DM started combat before the overlay was open)
  useEffect(() => {
    if (!enabled || !campaignId) return;
    try {
      const raw = localStorage.getItem('app.skyline.initiativeStrip');
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (stored?.campaignId !== campaignId) return;
      const battleStarted: boolean = !!stored.battleStarted;
      const currentTurnId: string | null = stored.currentTurnId ?? null;
      if (!battleStarted || !currentTurnId) return;
      const bcItems: BattleStateItem[] = Array.isArray(stored.items)
        ? stored.items.map((x: any) => ({
            id: x.id,
            name: x.name,
            imageUrl: x.imageUrl ?? null,
            fullImageUrl: x.fullImageUrl ?? null,
            size: x.size ?? null,
            role: x.role,
          }))
        : [];
      const participant = bcItems.find(it => it.id === currentTurnId) ?? null;
      // Only pre-populate when localStorage has the full image data.
      // If items is empty (e.g. showInitiativeStrip was false) don't call
      // setCurrentTurnParticipant at all — the initial poll() in the polling
      // effect will fetch the richer server-persisted state with fullImageUrl.
      if (participant?.fullImageUrl) {
        setCurrentTurnParticipant(participant);
      }
    } catch {}
  }, [enabled, campaignId]);

  // ── render ────────────────────────────────────────────────────────────
  if (!enabled || !campaignId) return null;

  const charImageSrc =
    character?.characterImageUrl || character?.tokenImageUrl || null;
  const charInitials = character
    ? (character.name || '?').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const charBg = character?.tokenColor || '#263238';

  const hasCharacter = !!character;
  const hasItems = items.length > 0;
  const hasTurnImage = showCurrentTurnImage && !!currentTurnParticipant && !!turnImageObjectUrl;

  if (!hasCharacter && !hasItems && !hasTurnImage) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 1,
        pointerEvents: 'none',
      }}
    >
      {/* ── Active skyline character ─────────────────────────────────── */}
      {hasCharacter && (
        <Tooltip title={character!.name || 'Personaje activo'} placement="top">
          <Box
            sx={{
              width: THUMB,
              height: THUMB,
              borderRadius: 2,
              overflow: 'hidden',
              border: '2px solid',
              borderColor: 'primary.main',
              bgcolor: 'background.paper',
              boxShadow: 4,
              pointerEvents: 'all',
              flexShrink: 0,
            }}
          >
            {charImageSrc ? (
              // Plain <img> with token embedded in URL – bypasses the global
              // api interceptor entirely so no risk of triggering logout
              <img
                src={buildCharImageUrl(charImageSrc)}
                alt={character!.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Avatar
                sx={{ width: '100%', height: '100%', borderRadius: 0, bgcolor: charBg, fontSize: 22 }}
              >
                {charInitials}
              </Avatar>
            )}
          </Box>
        </Tooltip>
      )}

      {/* ── Skyline shop-item overlays ───────────────────────────────── */}
      {items.map((item) => (
        <Tooltip key={item.id} title={item.label || 'Ítem de tienda'} placement="top">
          <Box
            sx={{
              width: THUMB,
              height: THUMB,
              borderRadius: 2,
              overflow: 'hidden',
              border: '2px solid',
              borderColor: 'secondary.main',
              bgcolor: 'background.paper',
              boxShadow: 4,
              pointerEvents: 'all',
              flexShrink: 0,
            }}
          >
            {/* Plain <img> with token embedded – same isolation strategy */}
            <img
              src={buildCellImageUrl(item.cellId)}
              alt={item.label || 'Ítem'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </Box>
        </Tooltip>
      ))}

      {/* ── Current combat turn image ────────────────────────────────── */}
      {hasTurnImage && currentTurnParticipant && (
        <Tooltip
          title={`Turno: ${currentTurnParticipant.name || 'Combatiente'}`}
          placement="top"
        >
          <Box
            sx={{
              width: THUMB,
              height: THUMB,
              borderRadius: 2,
              overflow: 'hidden',
              border: '2px solid',
              // Amber for allies, red for foes, orange when role unknown
              borderColor:
                currentTurnParticipant.role === 'ally'
                  ? 'success.main'
                  : currentTurnParticipant.role === 'foe'
                    ? 'error.main'
                    : 'warning.main',
              bgcolor: 'background.paper',
              boxShadow: 4,
              pointerEvents: 'all',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {/* turnImageObjectUrl is already auth-resolved (blob or data URI) */}
            <img
              src={turnImageObjectUrl!}
              alt={currentTurnParticipant.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Small ⚔ badge to distinguish from character/item thumbnails */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                fontSize: 10,
                lineHeight: 1,
                bgcolor: 'rgba(0,0,0,0.55)',
                borderRadius: '3px',
                px: '3px',
                py: '1px',
                color: 'white',
                userSelect: 'none',
              }}
            >
              ⚔
            </Box>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

export default SkylinePreviewOverlay;

