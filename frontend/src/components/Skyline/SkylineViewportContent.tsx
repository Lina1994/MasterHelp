/**
 * SkylineViewportContent
 *
 * Full-fidelity replica of the Skyline projection window contents
 * (background image + all overlays) designed to be embedded inside a
 * scaled preview container in the Maps and Combat views.
 *
 * All sizing uses `%` units relative to the container so that it scales
 * correctly with CSS `transform: scale(…)` applied by the parent.
 * This is equivalent to `vh`/`vw` units used in the real ProjectionSkylinePage
 * because the container box has the same pixel dimensions as the actual
 * Skyline window (e.g. 1920 × 1080).
 *
 * Data sources (same as ProjectionSkylinePage):
 * - BroadcastChannel `campaign-sync` — live turn/character/items updates
 * - localStorage hydration — fast restore on mount
 * - API polling every POLL_MS ms — fallback for reconnect scenarios
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import AuthImage from '../common/AuthImage';
import { getMapSkylineUrlSized } from '../../api/maps';
import { getCellStreamUrl } from '../../api/shops';
import { api } from '../../apiBase';
import { getActiveSkylineCharacterId } from '../../api/campaigns/activeSkylineCharacter';
import { getSkylineItems, type SkylineItemOverlay } from '../../api/campaigns/skylineItems';
import { getSkylineOverlaySettingsPublic } from '../../api/campaigns/skylineOverlay';
import { hasDefaultSkylinePublic, getDefaultSkylinePublicUrl } from '../../api/campaigns/defaultSkyline';
import { getCampaignNowPlayingTitlePublic } from '../../api/soundtrack/nowPlaying';
import { getCharacter, type CharacterPayload } from '../../api/characters';

const POLL_MS = 3000;

// ─── Types ─────────────────────────────────────────────────────────────────

interface InitiativeItem {
  id: string;
  name: string;
  imageUrl: string | null;
  fullImageUrl?: string | null;
  size?: string | null;
  role?: 'ally' | 'foe';
}

interface InitiativeStrip {
  battleStarted: boolean;
  enabled: boolean;
  currentTurnId: string | null;
  items: InitiativeItem[];
}

interface SkylineSettings {
  showSongTitle: boolean;
  showInitiativeStrip: boolean;
  showCurrentTurnImage: boolean;
  currentTurnImagePosition: string;
  currentTurnImageSizes: Record<string, number>;
  /** Whether to show the QR code overlay in the Skyline window. */
  showQr: boolean;
  /** The URL encoded in the QR overlay. */
  qrUrl: string;
}

const DEFAULT_STRIP: InitiativeStrip = { battleStarted: false, enabled: false, currentTurnId: null, items: [] };

const DEFAULT_SETTINGS: SkylineSettings = {
  showSongTitle: false,
  showInitiativeStrip: false,
  showCurrentTurnImage: true,
  currentTurnImagePosition: 'center-right',
  currentTurnImageSizes: { Tiny: 15, Small: 20, Medium: 30, Large: 40, Huge: 50, Gargantuan: 60 },
  showQr: false,
  qrUrl: '',
};

// ─── localStorage helpers ───────────────────────────────────────────────────

function readInitiativeStrip(campaignId: string): InitiativeStrip | null {
  try {
    const raw = localStorage.getItem('app.skyline.initiativeStrip');
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (stored?.campaignId !== campaignId) return null;
    return {
      battleStarted: !!stored.battleStarted,
      enabled: !!stored.enabled,
      currentTurnId: stored.currentTurnId ?? null,
      items: Array.isArray(stored.items)
        ? stored.items.map((x: any) => ({
            id: x.id,
            name: x.name,
            imageUrl: x.imageUrl ?? null,
            fullImageUrl: x.fullImageUrl ?? null,
            size: x.size ?? null,
            role: x.role,
          }))
        : [],
    };
  } catch { return null; }
}

function readSelectedDay(campaignId: string): string | null {
  try {
    const raw = localStorage.getItem('app.diary.selectedDay');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.campaignId === campaignId && typeof parsed.label === 'string') return parsed.label;
    return null;
  } catch { return null; }
}

function readShowDayInSkyline(): boolean {
  try {
    const raw = localStorage.getItem('diary_showSelectedDayInSkyline');
    return raw === null ? true : raw === 'true';
  } catch { return true; }
}

function readExtraSettings(): Partial<SkylineSettings> {
  const out: Partial<SkylineSettings> = {};
  try {
    const val = localStorage.getItem('app.combat.showCurrentTurnImage');
    if (val !== null) out.showCurrentTurnImage = val === 'true';
  } catch {}
  try {
    const val = localStorage.getItem('app.combat.currentTurnImagePosition');
    if (val) out.currentTurnImagePosition = val;
  } catch {}
  try {
    const val = localStorage.getItem('app.combat.currentTurnImageSizes');
    if (val) out.currentTurnImageSizes = JSON.parse(val);
  } catch {}
  return out;
}

function mergeStripItems(
  newItems: InitiativeItem[],
  prevItems: InitiativeItem[],
): InitiativeItem[] {
  return newItems.map((x) => {
    const prev = prevItems.find(p => p.id === x.id);
    return {
      ...x,
      fullImageUrl: x.fullImageUrl ?? prev?.fullImageUrl ?? null,
      size: x.size ?? prev?.size ?? null,
      role: x.role ?? prev?.role,
    };
  });
}

// ─── Character overlay (mirrors StackedCharacterOverlay from ProjectionSkylinePage) ──

/**
 * Renders the active skyline character illustration.
 * The box is absolutely positioned so `height: '60%'` resolves correctly
 * against the `SkylineViewportContent` root container (which is also
 * absolutely positioned with a definite height). `aspectRatio: '1 / 1'`
 * derives the width from the height to produce a square, matching the
 * `60vh × 60vh` box used in the real Skyline window.
 */
const CharacterOverlay: React.FC<{ src?: string | null; initials: string; bg: string }> = ({ src, initials, bg }) => {
  const imgSx = {
    position: 'absolute' as const,
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    height: '60%',
    aspectRatio: '1 / 1',
    overflow: 'hidden',
  };
  const avatarSx = {
    ...imgSx,
    borderRadius: 2,
    boxShadow: 4,
  };
  return src ? (
    <Box sx={{ ...imgSx, bgcolor: 'transparent' }}>
      <AuthImage
        src={src}
        alt={initials}
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', display: 'block' }}
      />
    </Box>
  ) : (
    <Avatar
      alt={initials}
      sx={{ ...avatarSx, border: '2px solid rgba(255,255,255,0.4)', bgcolor: bg, fontSize: '4vw' }}
    >
      {initials}
    </Avatar>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  /** Active campaign ID. */
  campaignId: string;
  /** Active map ID (null → "No active map" message). */
  mapId: string | null;
  /** Time-of-day key used for skyline image variant. */
  timeOfDay: string;
  /** Whether this map has a skyline image available (undefined = unknown). */
  hasSkyline?: boolean;
}

/**
 * Renders all Skyline projection window layers inside the currently mounted
 * container. Intended for use inside a CSS-transform–scaled preview box.
 */
const SkylineViewportContent: React.FC<Props> = ({ campaignId, mapId, timeOfDay, hasSkyline }) => {
  // ── state ───────────────────────────────────────────────────────────────
  const [character, setCharacter] = useState<CharacterPayload | null>(null);
  const [skylineItems, setSkylineItems] = useState<SkylineItemOverlay[]>([]);
  const [strip, setStrip] = useState<InitiativeStrip>(DEFAULT_STRIP);
  const [settings, setSettings] = useState<SkylineSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...readExtraSettings(),
  }));
  const [nowPlayingTitle, setNowPlayingTitle] = useState<string | null>(null);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string | null>(() => readSelectedDay(campaignId));
  const [showDayInSkyline, setShowDayInSkyline] = useState<boolean>(readShowDayInSkyline);
  const [hasDefaultSkylineImg, setHasDefaultSkylineImg] = useState(false);
  /** Tracks which overlay source was last activated; the last entry is the visible one. */
  const [overlayStack, setOverlayStack] = useState<Array<'character' | 'turnImage' | 'shopItem'>>([]);  /** Manual override written by SkylinePreviewOverlay. */
  const [forcedOverlay, setForcedOverlay] = useState<'character' | 'shopItem' | 'turnImage' | null>(() => {
    try {
      const val = localStorage.getItem('app.skyline.forcedOverlay');
      return (val as 'character' | 'shopItem' | 'turnImage') || null;
    } catch { return null; }
  });  // Timestamp of last BroadcastChannel / local update — blocks stale server overwrite
  const lastLocalUpdateRef = useRef<number>(0);
  const isFetchingRef = useRef(false);

  // ── hydrate from localStorage on mount ─────────────────────────────────
  useEffect(() => {
    const stored = readInitiativeStrip(campaignId);
    if (stored && stored.items.length > 0) {
      lastLocalUpdateRef.current = Date.now();
      setStrip(stored);
    }
    setSelectedDayLabel(readSelectedDay(campaignId));
    setShowDayInSkyline(readShowDayInSkyline());
    setSettings(prev => ({ ...prev, ...readExtraSettings() }));
  }, [campaignId]);

  // Check if campaign has a default skyline fallback image
  useEffect(() => {
    let cancelled = false;
    hasDefaultSkylinePublic(campaignId).then(v => { if (!cancelled) setHasDefaultSkylineImg(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [campaignId]);

  // ── data fetching ───────────────────────────────────────────────────────

  const loadCharacter = useCallback(async () => {
    try {
      const charId = await getActiveSkylineCharacterId(campaignId);
      if (!charId) { setCharacter(null); return; }
      const ch = await getCharacter(charId);
      setCharacter(ch);
    } catch { setCharacter(null); }
  }, [campaignId]);

  const loadItems = useCallback(async () => {
    try {
      const items = await getSkylineItems(campaignId);
      setSkylineItems(items);
    } catch { setSkylineItems([]); }
  }, [campaignId]);

  const loadSettings = useCallback(async () => {
    try {
      const s = await getSkylineOverlaySettingsPublic(campaignId);
      setSettings(prev => ({ ...prev, ...s }));
    } catch {}
  }, [campaignId]);

  const loadNowPlaying = useCallback(async () => {
    try {
      const r = await getCampaignNowPlayingTitlePublic(campaignId);
      setNowPlayingTitle(r.title || null);
    } catch {}
  }, [campaignId]);

  const loadBattleState = useCallback(async () => {
    try {
      const GRACE_MS = 5000;
      if ((Date.now() - lastLocalUpdateRef.current) < GRACE_MS) return;
      const res = await api.get<any>(`/campaigns/projection/${campaignId}/battle-state`);
      const bs = res.data;
      if (!bs?.started || !Array.isArray(bs.items) || bs.items.length === 0) return;
      setStrip(prev => {
        const newItems = mergeStripItems(
          bs.items.map((x: any) => ({
            id: x.id, name: x.name,
            imageUrl: x.imageUrl ?? null,
            fullImageUrl: x.fullImageUrl ?? null,
            size: x.size ?? null,
            role: x.role,
          })),
          prev.items,
        );
        const next: InitiativeStrip = {
          battleStarted: !!bs.started,
          enabled: settings.showInitiativeStrip,
          currentTurnId: bs.currentTurnId ?? null,
          items: newItems,
        };
        // Only update if changed
        if (prev.battleStarted === next.battleStarted && prev.currentTurnId === next.currentTurnId && prev.items.length === next.items.length) return prev;
        return next;
      });
    } catch {}
  }, [campaignId, settings.showInitiativeStrip]);

  /** Full poll: runs all fetches in parallel. */
  const poll = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      await Promise.allSettled([
        loadCharacter(),
        loadItems(),
        loadSettings(),
        loadNowPlaying(),
        loadBattleState(),
      ]);
    } finally { isFetchingRef.current = false; }
  }, [loadCharacter, loadItems, loadSettings, loadNowPlaying, loadBattleState]);

  // ── polling ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    poll();
    const id = setInterval(() => { if (!disposed && document.visibilityState !== 'hidden') poll(); }, POLL_MS);
    return () => { disposed = true; clearInterval(id); };
  }, [poll]);

  // ── BroadcastChannel ────────────────────────────────────────────────────
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      bc.onmessage = (e: MessageEvent) => {
        const data = e?.data;
        if (!data || data.campaignId !== campaignId) return;

        if (data.type === 'activeSkylineChanged') { loadCharacter(); return; }
        if (data.type === 'skylineItemsChanged') { loadItems(); return; }
        if (data.type === 'nowPlayingChanged') { loadNowPlaying(); return; }
        if (data.type === 'skylineSettingsChanged') {
          const st = data.settings;
          if (st) setSettings(prev => ({ ...prev, ...st }));
          return;
        }
        if (data.type === 'skylineOverlayForced') {
          setForcedOverlay((data.forcedOverlay as any) || null);
          return;
        }
        if (data.type === 'initiativeStripUpdated') {
          lastLocalUpdateRef.current = Date.now();
          const bcItems: InitiativeItem[] = Array.isArray(data.items)
            ? data.items.map((x: any) => ({
                id: x.id, name: x.name,
                imageUrl: x.imageUrl ?? null,
                fullImageUrl: x.fullImageUrl ?? null,
                size: x.size ?? null,
                role: x.role,
              }))
            : [];
          setStrip(prev => {
            const newItems = mergeStripItems(bcItems, prev.items);
            const next: InitiativeStrip = {
              battleStarted: !!data.battleStarted,
              enabled: !!data.enabled,
              currentTurnId: data.currentTurnId ?? null,
              items: newItems,
            };
            // Skip update if nothing changed
            if (prev.battleStarted === next.battleStarted &&
                prev.enabled === next.enabled &&
                prev.currentTurnId === next.currentTurnId &&
                prev.items.length === next.items.length &&
                prev.items.every((p, i) => {
                  const n = next.items[i];
                  return p.id === n.id && p.fullImageUrl === n.fullImageUrl;
                })) return prev;
            return next;
          });
        }
      };
    } catch {}
    return () => { try { bc?.close(); } catch {} };
  }, [campaignId, loadCharacter, loadItems, loadNowPlaying]);

  // ── storage events (cross-tab) ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'app.skyline.forcedOverlay') {
        setForcedOverlay((e.newValue as any) || null);
      }
      if (e.key === 'app.skyline.initiativeStrip') {
        const stored = readInitiativeStrip(campaignId);
        if (stored) {
          lastLocalUpdateRef.current = Date.now();
          setStrip(prev => {
            const newItems = mergeStripItems(stored.items, prev.items);
            return { ...stored, items: newItems };
          });
        }
      }
      if (e.key === 'app.skyline.activeCharacterUpdated') { loadCharacter(); }
      if (e.key === 'app.skyline.itemsUpdated') { loadItems(); }
      if (e.key === 'diary_showSelectedDayInSkyline') {
        setShowDayInSkyline(e.newValue === null ? true : e.newValue === 'true');
      }
      if (e.key === 'app.diary.selectedDay') {
        setSelectedDayLabel(readSelectedDay(campaignId));
      }
      if (e.key === 'app.combat.showCurrentTurnImage') {
        setSettings(prev => ({ ...prev, showCurrentTurnImage: e.newValue !== 'false' }));
      }
      if (e.key === 'app.combat.currentTurnImagePosition' && e.newValue) {
        setSettings(prev => ({ ...prev, currentTurnImagePosition: e.newValue! }));
      }
      if (e.key === 'app.combat.currentTurnImageSizes' && e.newValue) {
        try { setSettings(prev => ({ ...prev, currentTurnImageSizes: JSON.parse(e.newValue!) })); } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [campaignId, loadCharacter, loadItems]);

  // ── derived ─────────────────────────────────────────────────────────────

  const currentTurnParticipant = useMemo(() => {
    if (!strip.currentTurnId) return null;
    return strip.items.find(it => it.id === strip.currentTurnId) ?? null;
  }, [strip]);

  const charSrc = character?.characterImageUrl || character?.tokenImageUrl || null;
  const charInitials = character
    ? (character.name || '?').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const charBg = (character as any)?.tokenColor || '#263238';

  // ── current turn image position ─────────────────────────────────────────
  const turnImagePositionSx = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = { position: 'absolute' };
    switch (settings.currentTurnImagePosition) {
      case 'center-center': return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'center-right':  return { ...base, top: '50%', right: 32, transform: 'translateY(-50%)' };
      case 'center-left':   return { ...base, top: '50%', left: 32, transform: 'translateY(-50%)' };
      case 'top-center':    return { ...base, top: 32, left: '50%', transform: 'translateX(-50%)' };
      case 'top-right':     return { ...base, top: 32, right: 32 };
      case 'top-left':      return { ...base, top: 32, left: 32 };
      case 'bottom-center': return { ...base, bottom: 32, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right':  return { ...base, bottom: 32, right: 32 };
      case 'bottom-left':   return { ...base, bottom: 32, left: 32 };
      default:              return { ...base, top: '50%', right: 32, transform: 'translateY(-50%)' };
    }
  }, [settings.currentTurnImagePosition]);

  // ── render ──────────────────────────────────────────────────────────────
  const battleActive = strip.battleStarted;
  const showStrip = settings.showInitiativeStrip && battleActive && strip.enabled && strip.items.length > 0;
  const showTurnImage = settings.showCurrentTurnImage && !!currentTurnParticipant?.fullImageUrl && battleActive;

  // ── Overlay priority stack ──────────────────────────────────────────────
  // Mirrors the logic in ProjectionSkylinePage: last activated source is shown.
  const isCharacterActive = !!character;
  const isTurnImageActive = showTurnImage;
  const isShopItemActive = skylineItems.length > 0;

  useEffect(() => {
    setOverlayStack(prev => {
      const without = prev.filter(s => s !== 'shopItem');
      return isShopItemActive ? [...without, 'shopItem'] : without;
    });
  }, [isShopItemActive]);

  useEffect(() => {
    setOverlayStack(prev => {
      const without = prev.filter(s => s !== 'character');
      return isCharacterActive ? [...without, 'character'] : without;
    });
  }, [isCharacterActive]);

  useEffect(() => {
    setOverlayStack(prev => {
      const without = prev.filter(s => s !== 'turnImage');
      return isTurnImageActive ? [...without, 'turnImage'] : without;
    });
  }, [isTurnImageActive]);

  const activeOverlay = (() => {
    if (forcedOverlay) {
      const dataActive: Record<string, boolean> = {
        character: isCharacterActive,
        shopItem: isShopItemActive,
        turnImage: isTurnImageActive,
      };
      if (dataActive[forcedOverlay]) return forcedOverlay;
    }
    return overlayStack[overlayStack.length - 1] ?? null;
  })();

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* ── Background skyline image ─────────────────────────────────── */}
      {mapId ? (
        hasSkyline !== false ? (
          <AuthImage
            src={getMapSkylineUrlSized(mapId, 'full', { timeOfDay: timeOfDay as any, cacheBust: timeOfDay })}
            alt="Skyline"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : hasDefaultSkylineImg ? (
          <img
            src={getDefaultSkylinePublicUrl(campaignId)}
            alt="Skyline por defecto"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="white" variant="h6">Sin skyline para este mapa</Typography>
          </Box>
        )
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography color="white" variant="h6">Sin mapa activo</Typography>
        </Box>
      )}

      {/* ── Active skyline character ─────────────────────────────────── */}
      {activeOverlay === 'character' && character && (
        <CharacterOverlay src={charSrc} initials={charInitials} bg={charBg} />
      )}

      {/* ── Song title ───────────────────────────────────────────────── */}
      {settings.showSongTitle && nowPlayingTitle && (
        <Box sx={{ position: 'absolute', top: 16, left: 16, px: 1.5, py: 0.75, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1 }}>
          <Typography variant="subtitle1" color="white" noWrap title={nowPlayingTitle}>
            {nowPlayingTitle}
          </Typography>
        </Box>
      )}

      {/* ── Day label ────────────────────────────────────────────────── */}
      {showDayInSkyline && selectedDayLabel && (
        <Box sx={{ position: 'absolute', top: 16, right: 16, px: 1.5, py: 0.75, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1, maxWidth: '45%' }}>
          <Typography variant="subtitle1" color="white" noWrap title={selectedDayLabel}>
            {selectedDayLabel}
          </Typography>
        </Box>
      )}

      {/* ── Current turn image ───────────────────────────────────────── */}
      {activeOverlay === 'turnImage' && showTurnImage && currentTurnParticipant && (
        <Box
          sx={{
            ...turnImagePositionSx,
            // sizeVw% of container width mirrors the real Skyline window's vw constraint
            maxWidth: `${settings.currentTurnImageSizes[currentTurnParticipant.size || 'Medium'] ?? 30}%`,
            maxHeight: '90%',
            overflow: 'hidden',
          }}
        >
          <AuthImage
            src={currentTurnParticipant.fullImageUrl!}
            alt={currentTurnParticipant.name}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </Box>
      )}

      {/* ── Initiative strip ─────────────────────────────────────────── */}
      {showStrip && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            px: 1,
            py: 0.75,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
          }}
        >
          {strip.items.slice(0, 10).map((it) => {
            const isCurrent = strip.currentTurnId === it.id;
            const sz = isCurrent ? 100 : 24;
            const borderColor = it.role === 'foe' ? '#f44336' : '#4caf50';
            return (
              <Box
                key={it.id}
                sx={{ display: 'flex', alignItems: 'flex-end', bgcolor: 'rgba(0,0,0,0.56)', borderRadius: 4, gap: 0.5 }}
              >
                {it.imageUrl ? (
                  <Box sx={{ width: sz, height: sz, borderRadius: 4, border: `3px solid ${borderColor}`, overflow: 'hidden' }}>
                    <AuthImage
                      src={it.imageUrl}
                      alt={it.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ width: sz, height: sz, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.15)', border: `3px solid ${borderColor}` }} />
                )}
                <Typography variant="caption" color="white" noWrap sx={{ maxWidth: 120 }}>
                  {it.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ── QR code overlay ─────────────────────────────────────────── */}
      {settings.showQr && settings.qrUrl && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            bgcolor: 'white',
            p: 1,
            borderRadius: 1,
            boxShadow: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <QRCodeSVG value={settings.qrUrl} size={120} />
          <Typography variant="caption" sx={{ color: 'black', fontSize: '0.6rem', maxWidth: 120, textAlign: 'center', wordBreak: 'break-all' }}>
            {settings.qrUrl}
          </Typography>
        </Box>
      )}

      {/* ── Shop item overlays ────────────────────────────────────────── */}
      {activeOverlay === 'shopItem' && skylineItems.map((item) => {
        const token = localStorage.getItem('access_token') ?? '';
        const streamUrl = getCellStreamUrl(item.cellId);
        const fullUrl = `${streamUrl}?token=${encodeURIComponent(token)}`;
        return (
          <Box
            key={item.id}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '80%',
              maxHeight: '80%',
              zIndex: 1000 + item.order,
            }}
          >
            <AuthImage
              src={fullUrl}
              alt={item.label || 'Item'}
              style={{ width: 'auto', height: 'auto', maxWidth: '80%', maxHeight: '80%', objectFit: 'contain', display: 'block' }}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default SkylineViewportContent;
