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
import {
  Avatar, Box, Divider, ListItemIcon, ListItemText,
  Menu, MenuItem, Tooltip,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import InfoIcon from '@mui/icons-material/Info';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import WorldpediaEntityViewer from '../components/Worldpedia/WorldpediaEntityViewer';
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
  /** 'character' for player characters, 'enemy' for monsters. */
  kind?: 'character' | 'enemy';
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

/**
 * Returns the mapping of encounter participant IDs → campaign monster IDs
 * via the public no-auth projection endpoint.
 *
 * This is needed to open WorldpediaEntityViewer for bestiary enemies:
 * the participant ID (used internally in combat) differs from the campaign
 * monster ID expected by getCampaignMonster().
 *
 * @param campaignId - Campaign identifier.
 * @returns Record where key = participantId, value = campaignMonsterId.
 */
async function silentGetParticipantMonsterMap(
  campaignId: string,
): Promise<Record<string, string>> {
  const res = await silentApi.get<Record<string, string>>(
    `/campaigns/projection/${campaignId}/participant-monster-map`,
  );
  return res.data ?? {};
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

  const navigate = useNavigate();

  // ── data state ────────────────────────────────────────────────────────
  const [character, setCharacter] = useState<CharThumb | null>(null);
  /** ID of the currently active skyline character (kept in sync with poll). */
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [items, setItems] = useState<SkylineItem[]>([]);

  // ── menu / entity-viewer state ────────────────────────────────────────
  const [charMenuAnchor, setCharMenuAnchor] = useState<HTMLElement | null>(null);
  const [itemMenuAnchor, setItemMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedMenuItem, setSelectedMenuItem] = useState<SkylineItem | null>(null);
  const [turnMenuAnchor, setTurnMenuAnchor] = useState<HTMLElement | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  /**
   * Maps encounter participant IDs → campaign monster IDs.
   * Populated by poll(). Used to resolve the correct entityId for bestiary
   * enemies when opening WorldpediaEntityViewer (participant IDs ≠ monster IDs).
   */
  const [monsterMapByParticipantId, setMonsterMapByParticipantId] = useState<Record<string, string>>({});

  /** Opens the Worldpedia-style entity viewer dialog. */
  const openViewer = (type: string, id: string) => {
    setViewerType(type);
    setViewerId(id);
    setViewerOpen(true);
  };

  /** Removes the active skyline character (sets it to null) via silentApi. */
  const handleRemoveCharFromSkyline = async () => {
    setCharMenuAnchor(null);
    if (!campaignId) return;
    try {
      await silentApi.patch(`/campaigns/${campaignId}/active-skyline-character`, { characterId: null });
      setCharacter(null);
      setActiveCharId(null);
      try { localStorage.setItem('app.skyline.activeCharacterUpdated', JSON.stringify({ campaignId, at: Date.now() })); } catch {}
      try { new BroadcastChannel('campaign-sync').postMessage({ type: 'activeSkylineChanged', campaignId }); } catch {}
    } catch {}
  };

  /** Removes a skyline shop item by ID via silentApi. */
  const handleRemoveSkylineItem = async (itemId: string) => {
    setItemMenuAnchor(null);
    setSelectedMenuItem(null);
    if (!campaignId) return;
    try {
      await silentApi.delete(`/campaigns/skyline-items/${itemId}`);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      try { localStorage.setItem('app.skyline.itemsUpdated', JSON.stringify({ campaignId, at: Date.now() })); } catch {}
      try { new BroadcastChannel('campaign-sync').postMessage({ type: 'skylineItemsChanged', campaignId }); } catch {}
    } catch {}
  };

  /**
   * Applies a turn navigation action directly, without relying on CombatView
   * being mounted. Reads the current state from localStorage,
   * computes the next/previous participant, updates both localStorage and the
   * server, and signals CombatView via BroadcastChannel so it can sync its
   * own useTurnOrder state if it happens to be open.
   *
   * @param action - 'next' to advance a turn, 'previous' to go back.
   */
  const applyTurnNav = useCallback((action: 'next' | 'previous') => {
    setTurnMenuAnchor(null);
    if (!campaignId) return;
    try {
      const raw = localStorage.getItem('app.skyline.initiativeStrip');
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (stored?.campaignId !== campaignId) return;

      const items: any[] = Array.isArray(stored.items) ? stored.items : [];
      if (items.length === 0) return;

      const totalParticipants = items.length;
      // stored.turnIndex is the ABSOLUTE index (0..N-1) of the current
      // participant in the original (sorted-by-initiative) order.
      const currentAbsIdx: number = typeof stored.turnIndex === 'number' ? stored.turnIndex : 0;
      const currentRound: number  = typeof stored.round === 'number'     ? stored.round     : 1;
      const encounterId: string | null = stored.encounterId ?? null;

      let newAbsIdx: number;
      let newRound: number;
      if (action === 'next') {
        if (currentAbsIdx + 1 >= totalParticipants) {
          newAbsIdx = 0;
          newRound  = currentRound + 1;
        } else {
          newAbsIdx = currentAbsIdx + 1;
          newRound  = currentRound;
        }
      } else {
        if (currentAbsIdx - 1 < 0) {
          newAbsIdx = totalParticipants - 1;
          newRound  = Math.max(1, currentRound - 1);
        } else {
          newAbsIdx = currentAbsIdx - 1;
          newRound  = currentRound;
        }
      }

      // Items are already rotated so items[0] = absolute index currentAbsIdx.
      // items[k] = absolute index (currentAbsIdx + k) % totalParticipants.
      const k = (newAbsIdx - currentAbsIdx + totalParticipants) % totalParticipants;
      const newCurrentItem = items[k];
      if (!newCurrentItem) return;
      const newCurrentTurnId: string = newCurrentItem.id;

      // Rotate the full items array so the new current participant is first.
      const newItems: any[] = [...items.slice(k), ...items.slice(0, k)];

      // ── 1. Immediately update the overlay thumbnail ───────────────────────
      setCurrentTurnParticipant({
        id:           newCurrentTurnId,
        name:         newCurrentItem.name         || '',
        imageUrl:     newCurrentItem.imageUrl      ?? null,
        fullImageUrl: newCurrentItem.fullImageUrl  ?? null,
        size:         newCurrentItem.size          ?? null,
        role:         newCurrentItem.role,
        kind:         newCurrentItem.kind,
      });

      // ── 2. Update localStorage ─────────────────────────────────────────────
      const newStrip = {
        ...stored,
        currentTurnId: newCurrentTurnId,
        turnIndex:     newAbsIdx,
        round:         newRound,
        items:         newItems,
        at:            Date.now(),
      };
      try { localStorage.setItem('app.skyline.initiativeStrip', JSON.stringify(newStrip)); } catch {}

      // Also update turn.state so useTurnOrder re-hydrates correctly when
      // CombatView mounts (or remounts) later.
      if (encounterId) {
        try {
          const turnKey   = `turn.state:${campaignId}:${encounterId}`;
          const turnState = { round: newRound, index: newAbsIdx, currentId: newCurrentTurnId };
          localStorage.setItem(turnKey, JSON.stringify(turnState));
        } catch {}
      }

      // ── 3. Persist to server ───────────────────────────────────────────────
      const serverItems = newItems
        .slice(0, 10)
        .map(({ id, name, imageUrl, role, kind }: any) => ({ id, name, imageUrl, role, kind }));
      silentApi.patch(`/campaigns/${campaignId}/battle-state`, {
        started:      true,
        encounterId,
        round:        newRound,
        turnIndex:    newAbsIdx,
        currentTurnId: newCurrentTurnId,
        items:        serverItems,
      }).catch(() => {});

      // ── 4. Broadcast to Skyline projection window ──────────────────────────
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('campaign-sync');
          bc.postMessage({ ...newStrip, type: 'initiativeStripUpdated' });
          bc.close();
        }
      } catch {}

      // ── 5. Signal CombatView to sync its useTurnOrder state ───────────────
      // CombatView listens for 'skylineTurnNavApplied' and calls setIndex +
      // setRound from useTurnOrder so its own state stays in sync when mounted.
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('campaign-sync');
          bc.postMessage({
            type:            'skylineTurnNavApplied',
            campaignId,
            newTurnIndex:    newAbsIdx,
            newRound,
            newCurrentTurnId,
          });
          bc.close();
        }
      } catch {}
    } catch {}
  }, [campaignId]);
  const [currentTurnParticipant, setCurrentTurnParticipant] = useState<BattleStateItem | null>(null);
  /** Object URL created from a blob fetch of the turn image (auth-safe, revoked on change). */
  const [turnImageObjectUrl, setTurnImageObjectUrl] = useState<string | null>(null);
  const turnImageLoadRef = useRef<AbortController | null>(null);
  const [showCurrentTurnImage] = useState<boolean>(readShowCurrentTurnImage);
  /** Manual overlay source pinned by the user (null = use auto-stack priority). */
  const [forcedOverlay, setForcedOverlayState] = useState<'character' | 'shopItem' | 'turnImage' | null>(() => {
    try {
      const val = localStorage.getItem('app.skyline.forcedOverlay');
      return (val as 'character' | 'shopItem' | 'turnImage') || null;
    } catch { return null; }
  });

  /** Writes the forced overlay to localStorage and broadcasts to all Skyline windows. */
  const handleForceOverlay = (source: 'character' | 'shopItem' | 'turnImage' | null) => {
    setForcedOverlayState(source);
    try { localStorage.setItem('app.skyline.forcedOverlay', source ?? ''); } catch {}
    try {
      if ('BroadcastChannel' in window && campaignId) {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'skylineOverlayForced', campaignId, forcedOverlay: source ?? null });
        bc.close();
      }
    } catch {}
  };

  const isFetching = useRef(false);

  // ── React to forcedOverlay changes from other tabs / Skyline windows ──
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'app.skyline.forcedOverlay') {
        setForcedOverlayState((e.newValue as any) || null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

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
      // Run all four calls in parallel; each is independently protected
      const [charId, skyItems, battleState, monsterMap] = await Promise.allSettled([
        silentGetActiveCharId(campaignId),
        silentGetSkylineItems(campaignId),
        silentGetBattleState(campaignId),
        silentGetParticipantMonsterMap(campaignId),
      ]);

      // Update participant→monster ID map (needed for "Ver ficha" of bestiary enemies)
      if (monsterMap.status === 'fulfilled') {
        setMonsterMapByParticipantId(monsterMap.value);
      }

      // Update items only on success
      if (skyItems.status === 'fulfilled') {
        setItems(skyItems.value);
      }

      // Update character only on success
      if (charId.status === 'fulfilled' && charId.value) {
        setActiveCharId(charId.value);
        try {
          const ch = await silentGetCharacter(charId.value);
          setCharacter(ch);
        } catch {
          setCharacter(null);
        }
      } else if (charId.status === 'fulfilled' && !charId.value) {
        setActiveCharId(null);
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

            // Before trusting the server's turnId, check whether localStorage
            // knows of a DIFFERENT (more recent) current turn.
            // useSkylineInitiativeSync writes to localStorage with the same 250 ms
            // debounce it uses to persist to the server, but localStorage is local
            // and always ahead of the server round-trip. If they disagree, the
            // server is stale — keep whatever BC already set (prev) and wait for
            // the next poll when the server has caught up.
            try {
              const raw = localStorage.getItem('app.skyline.initiativeStrip');
              if (raw) {
                const stored = JSON.parse(raw);
                if (
                  stored?.campaignId === campaignId &&
                  stored?.currentTurnId &&
                  stored.currentTurnId !== turnId
                ) {
                  // localStorage is ahead of the server — don't let the stale
                  // server response overwrite the BC-set state.
                  return prev;
                }
              }
            } catch {}

            // Server and localStorage agree on the turn. Resolve the image.
            let fullImageUrl: string | null = null;
            let name = bs.items.find(it => it.id === turnId)?.name ?? null;
            let role: 'ally' | 'foe' | undefined = (bs.items.find(it => it.id === turnId) as any)?.role;
            let kind: 'character' | 'enemy' | undefined = (bs.items.find(it => it.id === turnId) as any)?.kind;
            try {
              const raw = localStorage.getItem('app.skyline.initiativeStrip');
              if (raw) {
                const stored = JSON.parse(raw);
                if (stored?.campaignId === campaignId) {
                  // Only use the FIRST item (the current-turn participant) to avoid
                  // accidentally matching a non-current participant with the same id.
                  const firstItem = (stored.items as any[])?.[0];
                  if (firstItem?.id === turnId && firstItem?.fullImageUrl) {
                    fullImageUrl = firstItem.fullImageUrl;
                    if (firstItem.name) name = firstItem.name;
                    if (firstItem.role) role = firstItem.role;
                    if (firstItem.kind) kind = firstItem.kind;
                  }
                }
              }
            } catch {}

            if (!fullImageUrl) {
              return prev?.fullImageUrl ? prev : null;
            }
            return { id: turnId, name: name || '', imageUrl: null, fullImageUrl, size: null, role, kind };
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
                  kind: x.kind ?? undefined,
                }))
              : [];

            if (battleStarted && currentTurnId) {
              const participant = bcItems.find(it => it.id === currentTurnId) ?? null;
              if (participant?.fullImageUrl) {
                // BC has rich image data (initiative strip enabled) — use it directly.
                setCurrentTurnParticipant(participant);
              } else {
                // BC has no image data: initiative strip is disabled or
                // the participant wasn't found in the empty items list.
                // Preserve the existing participant if it's the same turn;
                // the 3-second poll interval will hydrate it otherwise.
                setCurrentTurnParticipant((prev) => {
                  if (prev?.id === currentTurnId && prev?.fullImageUrl) return prev;
                  return null;
                });
                // ⚠ Do NOT call poll() here — it races with the 250 ms server-persist
                // debounce in useSkylineInitiativeSync and can restore the OLD turn.
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
            kind: x.kind ?? undefined,
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

  // ── Determine which overlay is currently active in the Skyline window ──
  // Mirrors the priority-stack logic in ProjectionSkylinePage / SkylineViewportContent.
  // The forced overlay takes precedence when its data is available.
  const effectiveActiveOverlay: 'character' | 'shopItem' | 'turnImage' | null = (() => {
    if (forcedOverlay) {
      const dataActive: Record<string, boolean> = {
        character: hasCharacter,
        shopItem: hasItems,
        turnImage: hasTurnImage,
      };
      if (dataActive[forcedOverlay]) return forcedOverlay;
    }
    // Auto-stack: last one to become active wins.
    const stack: Array<'character' | 'shopItem' | 'turnImage'> = [];
    if (hasCharacter) stack.push('character');
    if (hasItems) stack.push('shopItem');
    if (hasTurnImage) stack.push('turnImage');
    return stack[stack.length - 1] ?? null;
  })();

  /** WorldpediaEntityViewer type for the current turn participant. */
  const turnEntityType: string =
    currentTurnParticipant?.kind === 'character' ? 'character' : 'monster';

  return (
    <>
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
        {/* ── Active skyline character ───────────────────────────────── */}
        {hasCharacter && (
          <Tooltip title={character!.name || 'Personaje activo'} placement="top">
            <Box
              onClick={(e) => setCharMenuAnchor(e.currentTarget)}
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
                cursor: 'pointer',
                opacity: effectiveActiveOverlay === 'character' ? 1 : 0.3,
                transition: 'opacity 0.3s',
              }}
            >
              {charImageSrc ? (
                <img
                  src={buildCharImageUrl(charImageSrc)}
                  alt={character!.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <Avatar sx={{ width: '100%', height: '100%', borderRadius: 0, bgcolor: charBg, fontSize: 22 }}>
                  {charInitials}
                </Avatar>
              )}
            </Box>
          </Tooltip>
        )}

        {/* ── Skyline shop-item overlays ─────────────────────────────── */}
        {items.map((item) => (
          <Tooltip key={item.id} title={item.label || 'Ítem de tienda'} placement="top">
            <Box
              onClick={(e) => { setSelectedMenuItem(item); setItemMenuAnchor(e.currentTarget); }}
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
                cursor: 'pointer',
                opacity: effectiveActiveOverlay === 'shopItem' ? 1 : 0.3,
                transition: 'opacity 0.3s',
              }}
            >
              <img
                src={buildCellImageUrl(item.cellId)}
                alt={item.label || 'Ítem'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </Box>
          </Tooltip>
        ))}

        {/* ── Current combat turn image ──────────────────────────────── */}
        {hasTurnImage && currentTurnParticipant && (
          <Tooltip title={`Turno: ${currentTurnParticipant.name || 'Combatiente'}`} placement="top">
            <Box
              onClick={(e) => setTurnMenuAnchor(e.currentTarget)}
              sx={{
                width: THUMB,
                height: THUMB,
                borderRadius: 2,
                overflow: 'hidden',
                border: '2px solid',
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
                cursor: 'pointer',
                position: 'relative',
                opacity: effectiveActiveOverlay === 'turnImage' ? 1 : 0.3,
                transition: 'opacity 0.3s',
              }}
            >
              <img
                src={turnImageObjectUrl!}
                alt={currentTurnParticipant.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
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

      {/* ── Character context menu ─────────────────────────────────────── */}
      <Menu
        anchorEl={charMenuAnchor}
        open={!!charMenuAnchor}
        onClose={() => setCharMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem onClick={() => { setCharMenuAnchor(null); navigate('/characters/' + activeCharId); }}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ir al personaje</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setCharMenuAnchor(null); openViewer('character', activeCharId!); }}>
          <ListItemIcon><InfoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ver ficha completa</ListItemText>
        </MenuItem>
        <Divider />
        {effectiveActiveOverlay === 'character' ? (
          <MenuItem onClick={() => { setCharMenuAnchor(null); handleForceOverlay(null); }}>
            <ListItemIcon><VisibilityOffIcon fontSize="small" color="action" /></ListItemIcon>
            <ListItemText>Ocultar en Skyline</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { setCharMenuAnchor(null); handleForceOverlay('character'); }}>
            <ListItemIcon><VisibilityIcon fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText>Mostrar en Skyline</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleRemoveCharFromSkyline} sx={{ color: 'warning.main' }}>
          <ListItemIcon><LayersClearIcon fontSize="small" color="warning" /></ListItemIcon>
          <ListItemText>Quitar de Skyline</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── Shop-item context menu ─────────────────────────────────────── */}
      <Menu
        anchorEl={itemMenuAnchor}
        open={!!itemMenuAnchor}
        onClose={() => setItemMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem onClick={() => { setItemMenuAnchor(null); navigate('/shops'); }}>
          <ListItemIcon><StorefrontIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ir a tiendas</ListItemText>
        </MenuItem>
        <Divider />
        {effectiveActiveOverlay === 'shopItem' ? (
          <MenuItem onClick={() => { setItemMenuAnchor(null); handleForceOverlay(null); }}>
            <ListItemIcon><VisibilityOffIcon fontSize="small" color="action" /></ListItemIcon>
            <ListItemText>Ocultar en Skyline</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { setItemMenuAnchor(null); handleForceOverlay('shopItem'); }}>
            <ListItemIcon><VisibilityIcon fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText>Mostrar en Skyline</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => selectedMenuItem && handleRemoveSkylineItem(selectedMenuItem.id)}
          sx={{ color: 'warning.main' }}
        >
          <ListItemIcon><LayersClearIcon fontSize="small" color="warning" /></ListItemIcon>
          <ListItemText>Quitar de Skyline</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── Combat turn context menu ───────────────────────────────────── */}
      <Menu
        anchorEl={turnMenuAnchor}
        open={!!turnMenuAnchor}
        onClose={() => setTurnMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem onClick={() => { setTurnMenuAnchor(null); navigate('/combat'); }}>
          <ListItemIcon><SportsKabaddiIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ir a combate</ListItemText>
        </MenuItem>
        {currentTurnParticipant && (
          <MenuItem onClick={() => {
            setTurnMenuAnchor(null);
            // For bestiary enemies the participant ID ≠ campaign monster ID.
            // Resolve the correct ID from the map fetched during poll().
            const resolvedId =
              turnEntityType === 'monster'
                ? (monsterMapByParticipantId[currentTurnParticipant.id] || currentTurnParticipant.id)
                : currentTurnParticipant.id;
            openViewer(turnEntityType, resolvedId);
          }}>
            <ListItemIcon><InfoIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Ver ficha del turno</ListItemText>
          </MenuItem>
        )}
        <Divider />
        {effectiveActiveOverlay === 'turnImage' ? (
          <MenuItem onClick={() => { setTurnMenuAnchor(null); handleForceOverlay(null); }}>
            <ListItemIcon><VisibilityOffIcon fontSize="small" color="action" /></ListItemIcon>
            <ListItemText>Ocultar en Skyline</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { setTurnMenuAnchor(null); handleForceOverlay('turnImage'); }}>
            <ListItemIcon><VisibilityIcon fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText>Mostrar en Skyline</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => applyTurnNav('previous')}>
          <ListItemIcon><SkipPreviousIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Turno anterior</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => applyTurnNav('next')}>
          <ListItemIcon><SkipNextIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Turno siguiente</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── Worldpedia-style entity viewer ─────────────────────────────── */}
      <WorldpediaEntityViewer
        open={viewerOpen}
        entityType={viewerType}
        entityId={viewerId}
        campaignId={campaignId}
        onClose={() => setViewerOpen(false)}
        dialogSx={{ zIndex: 1500 }}
      />
    </>  );
};

export default SkylinePreviewOverlay;