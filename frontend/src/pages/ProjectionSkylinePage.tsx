import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QRCodeSVG } from 'qrcode.react';
import AuthImage from '../components/common/AuthImage';
import { getMapSkylineUrlSized, listMaps } from '../api/maps';
import { getVisualFilterCss, TimeOfDayFilterConfig } from '../utils/mapVisualFilters';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../components/player/TimeOfDayContext';
import { getCharacter, CharacterPayload } from '../api/characters';
import { getActiveSkylineCharacterInfo } from '../api/campaigns/activeSkylineCharacter';
import { getCampaignMonster } from '../api/bestiary/bestiaryApi';
import { getActiveEncounterId } from '../api/campaigns/activeEncounter';
import { getCampaignBattleStatePublic } from '../api/campaigns/battleState';
import { getSkylineOverlaySettingsPublic } from '../api/campaigns/skylineOverlay';
import { getCampaignNowPlayingTitlePublic } from '../api/soundtrack/nowPlaying';
import { getSkylineItems, SkylineItemOverlay } from '../api/campaigns/skylineItems';
import { hasDefaultSkylinePublic, getDefaultSkylinePublicUrl } from '../api/campaigns/defaultSkyline';
import { getCellStreamUrl } from '../api/shops';
import ChromaKeyMedia from '../components/common/ChromaKeyMedia';
import { useSceneClockSync } from '../hooks/useSceneClockSync';
import { useRuntimeSceneVideoWarmup } from '../hooks/useRuntimeSceneVideoWarmup';
import { buildWindowFilterBackdropStyle } from '../components/scenes/utils/sceneLayerUtils';
import {
  normalizeNarratorVoiceConfig,
  normalizeNarratorVoiceTarget,
  playNarration,
  type NarratorPlaybackHandle,
} from '../components/scenes/utils/narratorPlayback';
import type { ShortcutActionDefinition } from '../types/actionTypes';
import type { MotionKeyframe, OscillationEffect, SceneRuntimeCommand } from '../types/scenes';
import { applyOscillation, buildTransformCss, interpolateMotionPath } from '../components/scenes/utils/motionPathUtils';
import { getAuthHeaders } from '../utils/auth';
import API_BASE_URL from '../apiBase';

const SHOW_DAY_IN_SKYLINE_KEY = 'diary_showSelectedDayInSkyline';
const SELECTED_DAY_KEY = 'app.diary.selectedDay';

type DiarySelectedDayPayload = {
  label: string;
  campaignId: string;
} | null;

type ShortcutFilterOverlay = {
  id: string;
  filter: string;
  color?: string;
  intensity?: number;
  layerOrder?: number;
};

function loadShowSelectedDayInSkyline(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_DAY_IN_SKYLINE_KEY);
    if (raw === null) return true; // default
    return raw === 'true';
  } catch {
    return true;
  }
}

function loadSelectedDayPayload(): DiarySelectedDayPayload {
  try {
    const raw = localStorage.getItem(SELECTED_DAY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.label !== 'string') return null;
    if (typeof parsed.campaignId !== 'string') return null;
    return { label: parsed.label, campaignId: parsed.campaignId };
  } catch {
    return null;
  }
}

/** Resolves relative backend media paths into absolute URLs for projection windows. */
function resolveSceneMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (/^(https?:|data:|blob:)/i.test(rawUrl)) return rawUrl;

  const base = String(API_BASE_URL ?? '').replace(/\/+$/, '');
  if (!base) return rawUrl;

  const normalizedPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${base}${normalizedPath}`;
}

function parseChromaKey(value: unknown): { enabled: boolean; color: string; tolerance: number } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  const color = typeof body.color === 'string' && body.color.trim() ? body.color : '#00ff00';
  const tolerance = Number(body.tolerance);
  return {
    enabled: Boolean(body.enabled),
    color,
    tolerance: Number.isFinite(tolerance) ? Math.max(0, Math.min(100, tolerance)) : 20,
  };
}

function clampFreePlacement(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-50, Math.min(150, n));
}

function clampFreeSize(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(200, n));
}

function clampOpacity(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function parseMotionPath(value: unknown): MotionKeyframe[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const path = value
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const timeMs = Number(row.timeMs);
      const leftPct = Number(row.leftPct);
      const topPct = Number(row.topPct);
      const holdMs = Number(row.holdMs);
      const pauseOscillationDuringHold = row.pauseOscillationDuringHold === undefined
        ? undefined
        : Boolean(row.pauseOscillationDuringHold);
      if (!Number.isFinite(timeMs) || !Number.isFinite(leftPct) || !Number.isFinite(topPct)) {
        return null;
      }
      const rotation = Number(row.rotation);
      const flipH = row.flipH === undefined ? undefined : Boolean(row.flipH);
      const flipV = row.flipV === undefined ? undefined : Boolean(row.flipV);
      const easingRaw = typeof row.easing === 'string' ? row.easing : 'linear';
      const easing = (
        easingRaw === 'linear'
        || easingRaw === 'easeIn'
        || easingRaw === 'easeOut'
        || easingRaw === 'easeInOut'
        || easingRaw === 'bounce'
        || easingRaw === 'spring'
      ) ? easingRaw : 'linear';
      return {
        timeMs: Math.max(0, timeMs),
        leftPct,
        topPct,
        ...(Number.isFinite(holdMs) ? { holdMs: Math.max(0, holdMs) } : {}),
        ...(pauseOscillationDuringHold !== undefined ? { pauseOscillationDuringHold } : {}),
        ...(Number.isFinite(rotation) ? { rotation } : {}),
        ...(flipH !== undefined ? { flipH } : {}),
        ...(flipV !== undefined ? { flipV } : {}),
        easing,
      } as MotionKeyframe;
    })
    .filter((item): item is MotionKeyframe => Boolean(item))
    .sort((a, b) => a.timeMs - b.timeMs);
  return path.length > 0 ? path : undefined;
}

function parseOscillation(value: unknown): OscillationEffect | undefined {
  const body = asRecord(value);
  if (!body || !body.enabled) return undefined;
  const amplitudePct = Number(body.amplitudePct);
  const frequencyHz = Number(body.frequencyHz);
  return {
    enabled: true,
    type: body.type === 'wave' ? 'wave' : 'bounce',
    axis: body.axis === 'x' || body.axis === 'both' ? body.axis : 'y',
    amplitudePct: Number.isFinite(amplitudePct) ? Math.max(0, Math.min(50, amplitudePct)) : 3,
    frequencyHz: Number.isFinite(frequencyHz) ? Math.max(0.1, Math.min(20, frequencyHz)) : 2,
    pauseDuringMotionHold: Boolean(body.pauseDuringMotionHold),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getNarrativeSegments(payload: Record<string, unknown>): Array<{
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSizePx?: number;
  color?: string;
  fontFamily?: string;
}> {
  const richTextDoc = asRecord(payload.richTextDoc);
  const blocks = Array.isArray(richTextDoc?.blocks) ? richTextDoc.blocks : [];
  const segments: Array<{
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSizePx?: number;
    color?: string;
    fontFamily?: string;
  }> = [];
  for (const block of blocks) {
    const blockRecord = asRecord(block);
    const blockSegments = Array.isArray(blockRecord?.segments) ? blockRecord.segments : [];
    for (const segment of blockSegments) {
      const segmentRecord = asRecord(segment);
      const text = typeof segmentRecord?.text === 'string' ? segmentRecord.text : '';
      if (!text) continue;
      segments.push({
        text,
        ...(segmentRecord?.bold !== undefined ? { bold: Boolean(segmentRecord.bold) } : {}),
        ...(segmentRecord?.italic !== undefined ? { italic: Boolean(segmentRecord.italic) } : {}),
        ...(segmentRecord?.underline !== undefined ? { underline: Boolean(segmentRecord.underline) } : {}),
        ...(Number.isFinite(Number(segmentRecord?.fontSizePx)) ? { fontSizePx: Number(segmentRecord?.fontSizePx) } : {}),
        ...(typeof segmentRecord?.color === 'string' ? { color: segmentRecord.color } : {}),
        ...(typeof segmentRecord?.fontFamily === 'string' ? { fontFamily: segmentRecord.fontFamily } : {}),
      });
    }
  }

  if (segments.length > 0) return segments;
  const fallbackText = typeof payload.text === 'string' ? payload.text.trim() : '';
  return fallbackText ? [{ text: fallbackText }] : [];
}

interface NarrativeTextOverlay {
  text: string;
  title?: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  opacity: number;
  layerOrder: number;
  fontFamily: string;
  fontSizePx: number;
  fontColor: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacingPx: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  backgroundMode: 'none' | 'rect' | 'capsule';
  backgroundColor: string;
  backgroundOpacity: number;
  borderRadiusPx: number;
  paddingPx: number;
  segments: Array<{
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSizePx?: number;
    color?: string;
    fontFamily?: string;
  }>;
}

interface TimedImageOverlay {
  key: string;
  src: string;
  name: string;
  opacity: number;
  chromaKey?: { enabled: boolean; color: string; tolerance: number };
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  layerOrder: number;
  createdAtMs: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  motionPath?: MotionKeyframe[];
  oscillation?: OscillationEffect;
  startedAtMs?: number;
}

interface TimedVideoOverlay {
  key: string;
  src: string;
  loop: boolean;
  startAtSec?: number;
  loopRangeStartSec?: number;
  loopRangeEndSec?: number;
  muted: boolean;
  opacity: number;
  chromaKey?: { enabled: boolean; color: string; tolerance: number };
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  layerOrder: number;
  createdAtMs: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  motionPath?: MotionKeyframe[];
  oscillation?: OscillationEffect;
  startedAtMs?: number;
}

interface AnimatedSceneOverlayProps {
  overlay: Pick<
    TimedImageOverlay,
    | 'leftPct'
    | 'topPct'
    | 'widthPct'
    | 'heightPct'
    | 'layerOrder'
    | 'createdAtMs'
    | 'startedAtMs'
    | 'rotation'
    | 'flipH'
    | 'flipV'
    | 'motionPath'
    | 'oscillation'
  >;
  zBase?: number;
  children: React.ReactNode;
}

/**
 * Runtime overlay container that applies transform/motion updates using rAF and direct DOM writes.
 */
const AnimatedSceneOverlay: React.FC<AnimatedSceneOverlayProps> = ({
  overlay,
  zBase = 9000,
  children,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const baseRotation = Number.isFinite(Number(overlay.rotation)) ? Number(overlay.rotation) : 0;
    const flipH = Boolean(overlay.flipH);
    const flipV = Boolean(overlay.flipV);
    const path = Array.isArray(overlay.motionPath) ? overlay.motionPath : [];
    const oscillation = overlay.oscillation;
    const startedAtMs = Number.isFinite(Number(overlay.startedAtMs))
      ? Number(overlay.startedAtMs)
      : Number(overlay.createdAtMs);

    let rafId = 0;
    const tick = () => {
      const elapsedMs = Math.max(0, Date.now() - startedAtMs);
      const motion = path.length > 0
        ? interpolateMotionPath(
          { leftPct: overlay.leftPct, topPct: overlay.topPct },
          path,
          elapsedMs,
          { rotation: baseRotation, flipH, flipV },
          { defaultPauseOscillationDuringHold: Boolean(oscillation?.pauseDuringMotionHold) },
        )
        : {
          leftPct: overlay.leftPct,
          topPct: overlay.topPct,
          rotation: baseRotation,
          flipH,
          flipV,
          oscillationElapsedMs: elapsedMs,
        };
      const oscillated = applyOscillation(
        { leftPct: motion.leftPct, topPct: motion.topPct },
        oscillation,
        Math.max(0, Number(motion.oscillationElapsedMs ?? elapsedMs)),
      );
      host.style.left = `${oscillated.leftPct}%`;
      host.style.top = `${oscillated.topPct}%`;
      host.style.transform = buildTransformCss(motion.rotation, motion.flipH, motion.flipV);
      rafId = window.requestAnimationFrame(tick);
    };

    tick();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [
    overlay.createdAtMs,
    overlay.flipH,
    overlay.flipV,
    overlay.heightPct,
    overlay.layerOrder,
    overlay.leftPct,
    overlay.motionPath,
    overlay.oscillation,
    overlay.rotation,
    overlay.startedAtMs,
    overlay.topPct,
    overlay.widthPct,
  ]);

  return (
    <Box
      ref={hostRef}
      sx={{
        position: 'absolute',
        left: `${overlay.leftPct}%`,
        top: `${overlay.topPct}%`,
        width: `${overlay.widthPct}%`,
        height: `${overlay.heightPct}%`,
        zIndex: zBase + (overlay.layerOrder ?? 100),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        transformOrigin: 'center center',
        willChange: 'left, top, transform',
      }}
    >
      {children}
    </Box>
  );
};

const ProjectionSkylinePage: React.FC = () => {
  const { activeMapId, refreshFromServer } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { setActiveCampaignId, activeCampaign, activeCampaignId: rawCampaignId } = useActiveCampaign();
  const [hasSkyline, setHasSkyline] = useState<boolean>(true);
  const [activeSkylineFilters, setActiveSkylineFilters] = useState<TimeOfDayFilterConfig | null>(null);
  const [hasDefaultSkylineImg, setHasDefaultSkylineImg] = useState(false);
  // Initialize synchronously from URL so that the first render already has the campaign ID.
  // In HashRouter, ?campaignId=X is part of the hash (e.g. #/projection/skyline?campaignId=abc),
  // so window.location.search is empty — we parse both locations.
  const [campaignIdFromQuery, setCampaignIdFromQuery] = useState<string | null>(() => {
    let cid = new URLSearchParams(window.location.search).get('campaignId');
    if (!cid) {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) cid = new URLSearchParams(hash.slice(qIdx)).get('campaignId');
    }
    return cid;
  });
  const [skylineCharacter, setSkylineCharacter] = useState<CharacterPayload | null>(null);
  const [skylineCharacterImageUrlOverride, setSkylineCharacterImageUrlOverride] = useState<string | null>(null);
  const [showSongTitle, setShowSongTitle] = useState<boolean>(false);
  const [showInitiativeStrip, setShowInitiativeStrip] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [showCurrentTurnImage, setShowCurrentTurnImage] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('app.combat.showCurrentTurnImage');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });
  const [currentTurnImagePosition, setCurrentTurnImagePosition] = useState<string>(() => {
    try {
      return localStorage.getItem('app.combat.currentTurnImagePosition') || 'center-right';
    } catch {
      return 'center-right';
    }
  });
  const [imageSizes, setImageSizes] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('app.combat.currentTurnImageSizes');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      Tiny: 15,
      Small: 20,
      Medium: 30,
      Large: 40,
      Huge: 50,
      Gargantuan: 60,
    };
  });
  const [initiativeStrip, setInitiativeStrip] = useState<{ battleStarted: boolean; enabled: boolean; currentTurnId: string | null; items: Array<{ id: string; name: string; imageUrl: string | null; fullImageUrl?: string | null; size?: string | null; role?: 'ally' | 'foe' }> }>({ battleStarted: false, enabled: false, currentTurnId: null, items: [] });
  const [battleStateStarted, setBattleStateStarted] = useState<boolean>(false);
  const [nowPlayingTitle, setNowPlayingTitle] = useState<string | null>(null);
  const [showSelectedDayInSkyline, setShowSelectedDayInSkyline] = useState<boolean>(loadShowSelectedDayInSkyline);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string | null>(null);
  const [skylineItems, setSkylineItems] = useState<SkylineItemOverlay[]>([]);
  /** Tracks which overlay source was last activated; the last entry is the visible one. */
  const [overlayStack, setOverlayStack] = useState<Array<'character' | 'turnImage' | 'shopItem'>>([]);
  /** Manual overlay source pinned by the user (null = use auto-stack priority). */
  const [forcedOverlay, setForcedOverlay] = useState<'character' | 'shopItem' | 'turnImage' | null>(() => {
    try {
      const val = localStorage.getItem('app.skyline.forcedOverlay');
      return (val as 'character' | 'shopItem' | 'turnImage') || null;
    } catch { return null; }
  });
  const [connectionError, setConnectionError] = useState<boolean>(false);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<number>(Date.now());
  const [shortcutImageOverlays, setShortcutImageOverlays] = useState<TimedImageOverlay[]>([]);
  const [shortcutTextOverlay, setShortcutTextOverlay] = useState<NarrativeTextOverlay | null>(null);
  const shortcutTextExecutionIdRef = useRef<string | null>(null);
  const [shortcutFilterOverlays, setShortcutFilterOverlays] = useState<ShortcutFilterOverlay[]>([]);
  const [shortcutVideoOverlays, setShortcutVideoOverlays] = useState<TimedVideoOverlay[]>([]);
  const shortcutImageTimeoutsRef = useRef<Map<string, number>>(new Map());
  const shortcutImageObjectUrlsRef = useRef<Map<string, string>>(new Map());
  const shortcutTextTimeoutRef = useRef<number | null>(null);
  const narrationHandlesByExecutionRef = useRef<Map<string, Set<NarratorPlaybackHandle>>>(new Map());
  const shortcutVideoTimeoutsRef = useRef<Map<string, number>>(new Map());
  const shortcutFilterTimeoutsRef = useRef<Map<string, number>>(new Map());
  const introPlayedActionsByExecutionRef = useRef<Map<string, Set<string>>>(new Map());
  const {
    preloadVideoForOverlay,
    resolveVideoSrc,
    releaseOverlayVideo,
    clearWarmupCache,
  } = useRuntimeSceneVideoWarmup({
    enabled: true,
    maxItems: 2,
    maxTotalBytes: 180 * 1024 * 1024,
    fetchTimeoutMs: 8000,
  });
  const sceneClockSync = useSceneClockSync({ enabled: true, pollMs: 60000 });
  const sceneBaseClockOffsetRef = useRef<number>(0);
  const sceneClockSyncStateRef = useRef(sceneClockSync);
  useEffect(() => {
    sceneBaseClockOffsetRef.current = sceneClockSync.clockOffsetMs;
  }, [sceneClockSync.clockOffsetMs]);
  useEffect(() => {
    sceneClockSyncStateRef.current = sceneClockSync;
  }, [sceneClockSync]);

  const clearShortcutFilterOverlays = useCallback(() => {
    shortcutFilterTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    shortcutFilterTimeoutsRef.current.clear();
    setShortcutFilterOverlays([]);
  }, []);

  const upsertShortcutFilterOverlay = useCallback((overlay: ShortcutFilterOverlay & { durationMs?: number }) => {
    const overlayId = overlay.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextOverlay: ShortcutFilterOverlay = {
      id: overlayId,
      filter: overlay.filter,
      ...(overlay.color !== undefined ? { color: overlay.color } : {}),
      ...(overlay.intensity !== undefined ? { intensity: overlay.intensity } : {}),
      ...(overlay.layerOrder !== undefined ? { layerOrder: overlay.layerOrder } : {}),
    };

    const existingTimeoutId = shortcutFilterTimeoutsRef.current.get(overlayId);
    if (existingTimeoutId !== undefined) {
      window.clearTimeout(existingTimeoutId);
      shortcutFilterTimeoutsRef.current.delete(overlayId);
    }

    setShortcutFilterOverlays((current) => {
      const nextWithoutCurrent = current.filter((item) => item.id !== overlayId);
      return [...nextWithoutCurrent, nextOverlay];
    });

    const durationMs = Math.max(0, Number(overlay.durationMs ?? 0));
    if (durationMs > 0) {
      const timeoutId = window.setTimeout(() => {
        shortcutFilterTimeoutsRef.current.delete(overlayId);
        setShortcutFilterOverlays((current) => current.filter((item) => item.id !== overlayId));
      }, durationMs);
      shortcutFilterTimeoutsRef.current.set(overlayId, timeoutId);
    }
  }, []);
  const sceneCommandDedupRef = useRef<Set<string>>(new Set());
  const sceneCommandDedupOrderRef = useRef<string[]>([]);
  const sceneClockOffsetByExecutionRef = useRef<Map<string, number>>(new Map());
  const sceneExecutionOrderRef = useRef<string[]>([]);
  const sceneSkewSamplesRef = useRef<number[]>([]);
  const [sceneSyncDiagnosticsVisible] = useState<boolean>(() => {
    try { return localStorage.getItem('app.sceneSync.showDiagnostics') === 'true'; } catch { return false; }
  });
  const [sceneSyncDiagnostics, setSceneSyncDiagnostics] = useState<{
    samples: number;
    p50: number;
    p95: number;
    late: number;
    dropped: number;
    lastReceiveDeltaMs: number | null;
    baseOffsetMs: number;
    lastSyncAtMs: number | null;
    lastRoundTripMs: number | null;
    syncError: boolean;
  }>({ samples: 0, p50: 0, p95: 0, late: 0, dropped: 0, lastReceiveDeltaMs: null, baseOffsetMs: 0, lastSyncAtMs: null, lastRoundTripMs: null, syncError: false });
  // Tracks when the initiative strip was last updated via BroadcastChannel/localStorage
  // to prevent polling from overwriting with stale server data.
  const lastBroadcastStripUpdateRef = useRef<number>(0);

  // Sync campaignId from URL into the shared context (for other consumers like ActiveMapContext).
  // Also handles edge cases where the URL might only be available after mount.
  useEffect(() => {
    const scheduledTimerIds = new Set<number>();
    const executionTimerIdsRef = new Map<string, Set<number>>();
    const executionVideoOverlayKeysRef = new Map<string, Set<string>>();
    const executionImageOverlayKeysRef = new Map<string, Set<string>>();
    const DEDUP_MAX_KEYS = 1200;
    const DEDUP_KEEP_KEYS = 800;
    const EXECUTION_OFFSET_MAX_KEYS = 256;
    const SKEW_WARN_MS = 100;
    const metricsRef = { late: 0, dropped: 0, lastReceiveDeltaMs: null as number | null };

    const publishDiagnostics = () => {
      if (!sceneSyncDiagnosticsVisible) return;
      const samples = sceneSkewSamplesRef.current;
      const sorted = [...samples].sort((a, b) => a - b);
      const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] ?? 0 : 0;
      const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] ?? 0 : 0;
      const syncState = sceneClockSyncStateRef.current;
      setSceneSyncDiagnostics({
        samples: samples.length,
        p50,
        p95,
        late: metricsRef.late,
        dropped: metricsRef.dropped,
        lastReceiveDeltaMs: metricsRef.lastReceiveDeltaMs,
        baseOffsetMs: syncState.clockOffsetMs,
        lastSyncAtMs: syncState.lastSyncAtMs,
        lastRoundTripMs: syncState.lastRoundTripMs,
        syncError: syncState.syncError,
      });
    };

    const rememberCommandKey = (key: string): boolean => {
      if (sceneCommandDedupRef.current.has(key)) {
        return false;
      }

      sceneCommandDedupRef.current.add(key);
      sceneCommandDedupOrderRef.current.push(key);

      if (sceneCommandDedupOrderRef.current.length > DEDUP_MAX_KEYS) {
        const overflow = sceneCommandDedupOrderRef.current.length - DEDUP_KEEP_KEYS;
        const expired = sceneCommandDedupOrderRef.current.splice(0, overflow);
        for (const staleKey of expired) {
          sceneCommandDedupRef.current.delete(staleKey);
        }
      }

      return true;
    };

    const commandKey = (command: SceneRuntimeCommand): string => {
      const executionId = typeof command.executionId === 'string' ? command.executionId : 'legacy';
      const sequence = Number.isFinite(command.sequence) ? String(command.sequence) : command.actionId;
      return `${executionId}:${sequence}:${command.kind}`;
    };

    const getExecutionOffsetMs = (command: SceneRuntimeCommand): number => {
      const executionId = typeof command.executionId === 'string' ? command.executionId : null;
      const serverNowMs = Number(command.serverNowMs);

      if (!executionId || !Number.isFinite(serverNowMs)) {
        return sceneBaseClockOffsetRef.current;
      }

      if (!sceneClockOffsetByExecutionRef.current.has(executionId)) {
        sceneClockOffsetByExecutionRef.current.set(executionId, serverNowMs - Date.now());
        sceneExecutionOrderRef.current.push(executionId);

        if (sceneExecutionOrderRef.current.length > EXECUTION_OFFSET_MAX_KEYS) {
          const overflow = sceneExecutionOrderRef.current.length - EXECUTION_OFFSET_MAX_KEYS;
          const expired = sceneExecutionOrderRef.current.splice(0, overflow);
          for (const staleExecutionId of expired) {
            sceneClockOffsetByExecutionRef.current.delete(staleExecutionId);
          }
        }
      }

      return sceneClockOffsetByExecutionRef.current.get(executionId) ?? sceneBaseClockOffsetRef.current;
    };

    const recordSkew = (skewMs: number) => {
      const samples = sceneSkewSamplesRef.current;
      samples.push(skewMs);
      if (samples.length > 200) {
        samples.splice(0, samples.length - 200);
      }
      publishDiagnostics();
      if (import.meta.env.DEV && samples.length % 10 === 0) {
        const sorted = [...samples].sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
        console.debug('[scene-sync][skyline][stats]', { count: samples.length, p50, p95 });
      }
    };

    const getLateExecutionPolicy = (command: SceneRuntimeCommand, durationMs?: number): { dropIfLateOverMs?: number } => {
      if (command.kind === 'window.applyFilter' || command.kind === 'window.clearFilter') {
        return {};
      }

      const fallbackDurationMs = command.kind === 'window.sendImage' ? 8000 : 6000;
      const effectiveDurationMs = Number.isFinite(durationMs)
        ? Number(durationMs)
        : fallbackDurationMs;

      if (command.kind === 'window.sendVideo' || command.kind === 'window.sendImage' || command.kind === 'narrative.setText') {
        return { dropIfLateOverMs: Math.max(250, effectiveDurationMs) };
      }

      return {};
    };

    const scheduleSceneExecution = (
      command: SceneRuntimeCommand,
      executeAtMs: number | undefined,
      run: () => void,
      label: string,
      options?: { dropIfLateOverMs?: number },
    ) => {
      if (!Number.isFinite(executeAtMs)) {
        run();
        return;
      }

      const target = Number(executeAtMs);
      const offsetMs = getExecutionOffsetMs(command);
      const adjustedNowMs = Date.now() + offsetMs;
      const delayMs = target - adjustedNowMs;
      const dispatchLatencyMs = Number(command.dispatchedAtMs);
      const receiveDeltaMs = Number.isFinite(dispatchLatencyMs)
        ? Math.max(0, Date.now() - dispatchLatencyMs)
        : undefined;

      if (Number.isFinite(receiveDeltaMs)) {
        metricsRef.lastReceiveDeltaMs = Number(receiveDeltaMs);
      }

      if (delayMs <= 0) {
        const skewMs = adjustedNowMs - target;
        if (Number.isFinite(options?.dropIfLateOverMs) && skewMs > Number(options?.dropIfLateOverMs)) {
          metricsRef.dropped += 1;
          publishDiagnostics();
          if (import.meta.env.DEV) {
            console.debug('[scene-sync][skyline][drop-late]', label, { target, skewMs, receiveDeltaMs });
          }
          return;
        }
        if (import.meta.env.DEV && skewMs > SKEW_WARN_MS) {
          console.debug('[scene-sync][skyline][late]', label, { target, skewMs, receiveDeltaMs });
        }
        if (skewMs > SKEW_WARN_MS) {
          metricsRef.late += 1;
        }
        recordSkew(skewMs);
        run();
        return;
      }

      const timerId = window.setTimeout(() => {
        scheduledTimerIds.delete(timerId);
        if (command.executionId) {
          const timers = executionTimerIdsRef.get(command.executionId);
          if (timers) {
            timers.delete(timerId);
            if (timers.size === 0) executionTimerIdsRef.delete(command.executionId);
          }
        }
        const skewMs = (Date.now() + offsetMs) - target;
        recordSkew(skewMs);
        if (import.meta.env.DEV) {
          console.debug('[scene-sync][skyline]', label, { target, skewMs, receiveDeltaMs });
        }
        run();
      }, Math.max(0, delayMs));
      scheduledTimerIds.add(timerId);
      if (command.executionId) {
        const timers = executionTimerIdsRef.get(command.executionId) ?? new Set<number>();
        timers.add(timerId);
        executionTimerIdsRef.set(command.executionId, timers);
      }
    };

    const registerExecutionOverlayKey = (
      map: Map<string, Set<string>>,
      executionId: string | undefined,
      overlayKey: string,
    ) => {
      if (!executionId) return;
      const keys = map.get(executionId) ?? new Set<string>();
      keys.add(overlayKey);
      map.set(executionId, keys);
    };

    const stopSceneExecutionRuntime = (executionId: string) => {
      const timers = executionTimerIdsRef.get(executionId);
      if (timers) {
        timers.forEach((timerId) => {
          window.clearTimeout(timerId);
          scheduledTimerIds.delete(timerId);
        });
        executionTimerIdsRef.delete(executionId);
      }

      const videoKeys = executionVideoOverlayKeysRef.get(executionId);
      if (videoKeys) {
        videoKeys.forEach((overlayKey) => clearShortcutVideoOverlay(overlayKey));
        executionVideoOverlayKeysRef.delete(executionId);
      }

      const imageKeys = executionImageOverlayKeysRef.get(executionId);
      if (imageKeys) {
        imageKeys.forEach((overlayKey) => clearShortcutImageOverlay(overlayKey));
        executionImageOverlayKeysRef.delete(executionId);
      }

      if (shortcutTextExecutionIdRef.current === executionId) {
        clearShortcutTextOverlay();
      }

      const narrationHandles = narrationHandlesByExecutionRef.current.get(executionId);
      if (narrationHandles) {
        narrationHandles.forEach((handle) => handle.stop());
        narrationHandlesByExecutionRef.current.delete(executionId);
      }

      introPlayedActionsByExecutionRef.current.delete(executionId);
    };

    const registerNarrationHandle = (executionId: string | undefined, handle: NarratorPlaybackHandle) => {
      if (!executionId) return;
      const set = narrationHandlesByExecutionRef.current.get(executionId) ?? new Set<NarratorPlaybackHandle>();
      set.add(handle);
      narrationHandlesByExecutionRef.current.set(executionId, set);
      void handle.finished.finally(() => {
        const currentSet = narrationHandlesByExecutionRef.current.get(executionId);
        if (!currentSet) return;
        currentSet.delete(handle);
        if (currentSet.size === 0) {
          narrationHandlesByExecutionRef.current.delete(executionId);
        }
      });
    };

    const hasIntroBeenPlayed = (executionId: string, actionId: string): boolean => {
      const actions = introPlayedActionsByExecutionRef.current.get(executionId);
      return actions?.has(actionId) ?? false;
    };

    const markIntroAsPlayed = (executionId: string, actionId: string) => {
      const actions = introPlayedActionsByExecutionRef.current.get(executionId) ?? new Set<string>();
      actions.add(actionId);
      introPlayedActionsByExecutionRef.current.set(executionId, actions);
    };

    const clearShortcutImageOverlay = (overlayKey?: string) => {
      const revokeObjectUrlForKey = (key: string) => {
        const objectUrl = shortcutImageObjectUrlsRef.current.get(key);
        if (!objectUrl) return;
        URL.revokeObjectURL(objectUrl);
        shortcutImageObjectUrlsRef.current.delete(key);
      };

      if (!overlayKey) {
        shortcutImageTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
        shortcutImageTimeoutsRef.current.clear();
        shortcutImageObjectUrlsRef.current.forEach((objectUrl) => {
          URL.revokeObjectURL(objectUrl);
        });
        shortcutImageObjectUrlsRef.current.clear();
        setShortcutImageOverlays([]);
        return;
      }

      const timerId = shortcutImageTimeoutsRef.current.get(overlayKey);
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
        shortcutImageTimeoutsRef.current.delete(overlayKey);
      }
      revokeObjectUrlForKey(overlayKey);
      setShortcutImageOverlays((current) => current.filter((overlay) => overlay.key !== overlayKey));
    };

    const clearShortcutTextOverlay = () => {
      if (shortcutTextTimeoutRef.current !== null) {
        window.clearTimeout(shortcutTextTimeoutRef.current);
        shortcutTextTimeoutRef.current = null;
      }
      shortcutTextExecutionIdRef.current = null;
      setShortcutTextOverlay(null);
    };

    const clearShortcutVideoOverlay = (overlayKey?: string) => {
      if (!overlayKey) {
        shortcutVideoTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
        shortcutVideoTimeoutsRef.current.clear();
        setShortcutVideoOverlays((current) => {
          current.forEach((overlay) => releaseOverlayVideo(overlay.key));
          return [];
        });
        return;
      }

      const timerId = shortcutVideoTimeoutsRef.current.get(overlayKey);
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
        shortcutVideoTimeoutsRef.current.delete(overlayKey);
      }
      releaseOverlayVideo(overlayKey);
      setShortcutVideoOverlays((current) => current.filter((overlay) => overlay.key !== overlayKey));
    };

    const setTimedShortcutImageOverlay = (
      overlayKey: string,
      next: Omit<TimedImageOverlay, 'key' | 'createdAtMs'>,
      durationMs?: number,
    ) => {
      const ms = Number(durationMs);
      const timeout = Number.isFinite(ms) && ms > 0 ? ms : 8000;
      const previousTimerId = shortcutImageTimeoutsRef.current.get(overlayKey);
      if (previousTimerId !== undefined) {
        window.clearTimeout(previousTimerId);
      }

      const previousObjectUrl = shortcutImageObjectUrlsRef.current.get(overlayKey);
      if (previousObjectUrl && previousObjectUrl !== next.src) {
        URL.revokeObjectURL(previousObjectUrl);
        shortcutImageObjectUrlsRef.current.delete(overlayKey);
      }

      if (next.src.startsWith('blob:')) {
        shortcutImageObjectUrlsRef.current.set(overlayKey, next.src);
      }

      setShortcutImageOverlays((current) => {
        const withoutCurrent = current.filter((overlay) => overlay.key !== overlayKey);
        return [
          ...withoutCurrent,
          {
            ...next,
            key: overlayKey,
            createdAtMs: Date.now(),
          },
        ];
      });

      const timeoutId = window.setTimeout(() => {
        const objectUrl = shortcutImageObjectUrlsRef.current.get(overlayKey);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          shortcutImageObjectUrlsRef.current.delete(overlayKey);
        }
        setShortcutImageOverlays((current) => current.filter((overlay) => overlay.key !== overlayKey));
        shortcutImageTimeoutsRef.current.delete(overlayKey);
      }, timeout);
      shortcutImageTimeoutsRef.current.set(overlayKey, timeoutId);
    };

    const resolveAuthenticatedImageOverlaySrc = async (rawUrl: string): Promise<string> => {
      const resolvedUrl = resolveSceneMediaUrl(rawUrl);
      try {
        const authHeaders = getAuthHeaders();
        const headers: Record<string, string> = {};
        if (typeof authHeaders.Authorization === 'string' && authHeaders.Authorization.length > 0) {
          headers.Authorization = authHeaders.Authorization;
        }
        const response = await fetch(resolvedUrl, {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Image fetch failed (${response.status})`);
        }
        const blob = await response.blob();
        if (!blob.size) return resolvedUrl;
        return URL.createObjectURL(blob);
      } catch {
        return resolvedUrl;
      }
    };

    const setTimedShortcutTextOverlay = (next: NarrativeTextOverlay, durationMs?: number) => {
      const ms = Number(durationMs);
      const timeout = Number.isFinite(ms) && ms > 0 ? ms : 6000;
      if (shortcutTextTimeoutRef.current !== null) {
        window.clearTimeout(shortcutTextTimeoutRef.current);
      }
      setShortcutTextOverlay(next);
      shortcutTextTimeoutRef.current = window.setTimeout(() => {
        setShortcutTextOverlay(null);
        shortcutTextTimeoutRef.current = null;
      }, timeout);
    };

    const setTimedShortcutVideoOverlay = (
      overlayKey: string,
      next: Omit<TimedVideoOverlay, 'key' | 'createdAtMs'>,
      durationMs?: number,
    ) => {
      const previousTimerId = shortcutVideoTimeoutsRef.current.get(overlayKey);
      if (previousTimerId !== undefined) {
        window.clearTimeout(previousTimerId);
        shortcutVideoTimeoutsRef.current.delete(overlayKey);
      }

      setShortcutVideoOverlays((current) => {
        const withoutCurrent = current.filter((overlay) => overlay.key !== overlayKey);
        return [
          ...withoutCurrent,
          {
            ...next,
            key: overlayKey,
            createdAtMs: Date.now(),
          },
        ];
      });

      const ms = Number(durationMs);
      if (Number.isFinite(ms) && ms > 0) {
        const timeoutId = window.setTimeout(() => {
          releaseOverlayVideo(overlayKey);
          setShortcutVideoOverlays((current) => current.filter((overlay) => overlay.key !== overlayKey));
          shortcutVideoTimeoutsRef.current.delete(overlayKey);
        }, ms);
        shortcutVideoTimeoutsRef.current.set(overlayKey, timeoutId);
      }
    };

    const parseShortcutAction = (
      payload: { action?: ShortcutActionDefinition } | ShortcutActionDefinition,
    ): ShortcutActionDefinition | null => {
      if (!payload) return null;
      if ('kind' in (payload as any)) return payload as ShortcutActionDefinition;
      return (payload as { action?: ShortcutActionDefinition }).action || null;
    };

    const parseSceneRuntimeCommand = (
      payload: { action?: ShortcutActionDefinition } | ShortcutActionDefinition,
    ): SceneRuntimeCommand | null => {
      const action = parseShortcutAction(payload);
      if (!action || (action as any).kind !== 'scene.runtime') return null;
      const command = (action.payload as any)?.command;
      if (!command || typeof command !== 'object') return null;
      const envelope = payload as { dispatchedAtMs?: unknown };
      const dispatchedAtMs = Number(envelope?.dispatchedAtMs);
      return {
        ...(command as SceneRuntimeCommand),
        ...(Number.isFinite(dispatchedAtMs) ? { dispatchedAtMs } : {}),
      } as SceneRuntimeCommand;
    };

    const handleWindowShortcutAction = async (
      payload: { action?: ShortcutActionDefinition } | ShortcutActionDefinition,
    ) => {
      const sceneCommand = parseSceneRuntimeCommand(payload);
      if (sceneCommand?.targetWindow && sceneCommand.targetWindow.kind !== 'skyline') {
        return;
      }
      if (sceneCommand) {
        const key = commandKey(sceneCommand);
        if (!rememberCommandKey(key)) {
          return;
        }
      }

      if (sceneCommand?.kind === 'window.sendVideo') {
        const body = (sceneCommand.payload ?? {}) as Record<string, unknown>;
        const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
        if (!videoUrl) {
          clearShortcutVideoOverlay();
          return;
        }
        const overlayKey = sceneCommand.actionId || commandKey(sceneCommand);
        registerExecutionOverlayKey(executionVideoOverlayKeysRef, sceneCommand.executionId, overlayKey);
        const loop = Boolean(body.loop);
        const muted = body.muted === undefined ? true : Boolean(body.muted);
        const opacity = Math.max(0, Math.min(1, Number(body.opacity ?? 1)));
        const chromaKey = parseChromaKey(body.chromaKey);
        const leftPct = clampFreePlacement(body.leftPct ?? 10, 10);
        const topPct = clampFreePlacement(body.topPct ?? 10, 10);
        const widthPct = clampFreeSize(body.widthPct ?? 80, 80);
        const heightPct = clampFreeSize(body.heightPct ?? 80, 80);
        const rotation = Number.isFinite(Number(body.rotation)) ? Number(body.rotation) : 0;
        const flipH = Boolean(body.flipH);
        const flipV = Boolean(body.flipV);
        const motionPath = parseMotionPath(body.motionPath);
        const oscillation = parseOscillation(body.oscillation);
        const sequenceLayerOrder = Number(sceneCommand.sequence);
        const layerOrder = Number.isFinite(Number(body.layerOrder))
          ? Math.round(Number(body.layerOrder))
          : (Number.isFinite(sequenceLayerOrder) ? Math.round(sequenceLayerOrder) : 0);
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
        const explicitStartAtSec = Number(body.startAtSec);
        const clipInSecRaw = Number(body.clipInSec);
        const clipOutSecRaw = Number(body.clipOutSec);
        const hasClipInSec = Number.isFinite(clipInSecRaw) && clipInSecRaw >= 0;
        const hasClipOutSec = Number.isFinite(clipOutSecRaw) && clipOutSecRaw > (hasClipInSec ? clipInSecRaw : 0);
        const clipInSec = hasClipInSec ? clipInSecRaw : undefined;
        const clipOutSec = hasClipOutSec ? clipOutSecRaw : undefined;
        const loopSegmentEnabled = Boolean(body.loopSegmentEnabled);
        const loopSegmentStartMs = Number(body.loopSegmentStartMs);
        const loopSegmentEndMs = Number(body.loopSegmentEndMs);
        const hasLoopSegmentStart = Number.isFinite(loopSegmentStartMs) && loopSegmentStartMs >= 0;
        const hasLoopSegmentEnd = Number.isFinite(loopSegmentEndMs) && loopSegmentEndMs > loopSegmentStartMs;
        const hasLoopSegment = loopSegmentEnabled && hasLoopSegmentStart;
        const playIntroOncePerSceneExecution = body.playIntroOncePerSceneExecution !== false;
        const logicalExecutionId = typeof sceneCommand.logicalExecutionId === 'string' && sceneCommand.logicalExecutionId
          ? sceneCommand.logicalExecutionId
          : sceneCommand.executionId;
        const introActionId = sceneCommand.actionId;
        const shouldTrackIntro = Boolean(hasLoopSegment && playIntroOncePerSceneExecution && logicalExecutionId && introActionId);
        const introAlreadyPlayed = shouldTrackIntro
          ? hasIntroBeenPlayed(logicalExecutionId as string, introActionId)
          : false;
        const resolvedVideoUrl = resolveSceneMediaUrl(videoUrl);
        preloadVideoForOverlay(overlayKey, resolvedVideoUrl);
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          if (shouldTrackIntro && !introAlreadyPlayed) {
            markIntroAsPlayed(logicalExecutionId as string, introActionId);
          }

          const loopSegmentStartSec = hasLoopSegment ? loopSegmentStartMs / 1000 : undefined;
          const loopSegmentEndSec = hasLoopSegment && hasLoopSegmentEnd ? loopSegmentEndMs / 1000 : undefined;

          let resolvedLoopRangeStartSec = loopSegmentStartSec;
          if (resolvedLoopRangeStartSec === undefined && loop && clipInSec !== undefined) {
            resolvedLoopRangeStartSec = clipInSec;
          }
          if (resolvedLoopRangeStartSec !== undefined && clipInSec !== undefined) {
            resolvedLoopRangeStartSec = Math.max(resolvedLoopRangeStartSec, clipInSec);
          }

          let resolvedLoopRangeEndSec = loopSegmentEndSec;
          if (resolvedLoopRangeEndSec === undefined && loop && clipOutSec !== undefined) {
            resolvedLoopRangeEndSec = clipOutSec;
          }
          if (resolvedLoopRangeEndSec !== undefined && clipOutSec !== undefined) {
            resolvedLoopRangeEndSec = Math.min(resolvedLoopRangeEndSec, clipOutSec);
          }
          if (
            resolvedLoopRangeStartSec !== undefined
            && resolvedLoopRangeEndSec !== undefined
            && resolvedLoopRangeEndSec <= resolvedLoopRangeStartSec
          ) {
            resolvedLoopRangeEndSec = undefined;
          }

          let resolvedStartAtSec = hasLoopSegment && introAlreadyPlayed
            ? loopSegmentStartSec
            : (Number.isFinite(explicitStartAtSec) && explicitStartAtSec >= 0 ? explicitStartAtSec : clipInSec);
          if (resolvedStartAtSec !== undefined && clipInSec !== undefined) {
            resolvedStartAtSec = Math.max(resolvedStartAtSec, clipInSec);
          }
          if (resolvedStartAtSec !== undefined && clipOutSec !== undefined && resolvedStartAtSec >= clipOutSec) {
            resolvedStartAtSec = clipInSec;
          }

          setTimedShortcutVideoOverlay(
            overlayKey,
            {
              src: resolvedVideoUrl,
              loop,
              ...(resolvedLoopRangeStartSec !== undefined ? { loopRangeStartSec: resolvedLoopRangeStartSec } : {}),
              ...(resolvedLoopRangeEndSec !== undefined ? { loopRangeEndSec: resolvedLoopRangeEndSec } : {}),
              ...(resolvedStartAtSec !== undefined ? { startAtSec: resolvedStartAtSec } : {}),
              muted,
              opacity,
              chromaKey,
              leftPct,
              topPct,
              widthPct,
              heightPct,
              layerOrder,
              rotation,
              flipH,
              flipV,
              ...(motionPath ? { motionPath } : {}),
              ...(oscillation ? { oscillation } : {}),
              startedAtMs: Date.now(),
            },
            loop ? undefined : durationMs,
          );
        }, 'window.sendVideo', getLateExecutionPolicy(sceneCommand, durationMs));
        return;
      }

      if (sceneCommand?.kind === 'scene.stopExecution') {
        const stopExecutionId = typeof sceneCommand.payload?.executionId === 'string'
          ? sceneCommand.payload.executionId
          : sceneCommand.executionId;
        if (stopExecutionId) {
          stopSceneExecutionRuntime(stopExecutionId);
        } else {
          clearShortcutVideoOverlay();
          clearShortcutImageOverlay();
          clearShortcutTextOverlay();
        }
        return;
      }

      if (sceneCommand?.kind === 'window.sendImage') {
        const body = (sceneCommand.payload ?? {}) as Record<string, unknown>;
        const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
        if (!imageUrl) {
          clearShortcutImageOverlay();
          return;
        }
        const overlayKey = sceneCommand.actionId || commandKey(sceneCommand);
        registerExecutionOverlayKey(executionImageOverlayKeysRef, sceneCommand.executionId, overlayKey);
        const name = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '';
        const opacity = Math.max(0, Math.min(1, Number(body.opacity ?? 1)));
        const chromaKey = parseChromaKey(body.chromaKey);
        const leftPct = clampFreePlacement(body.leftPct ?? 10, 10);
        const topPct = clampFreePlacement(body.topPct ?? 10, 10);
        const widthPct = clampFreeSize(body.widthPct ?? 80, 80);
        const heightPct = clampFreeSize(body.heightPct ?? 80, 80);
        const rotation = Number.isFinite(Number(body.rotation)) ? Number(body.rotation) : 0;
        const flipH = Boolean(body.flipH);
        const flipV = Boolean(body.flipV);
        const motionPath = parseMotionPath(body.motionPath);
        const oscillation = parseOscillation(body.oscillation);
        const sequenceLayerOrder = Number(sceneCommand.sequence);
        const layerOrder = Number.isFinite(Number(body.layerOrder))
          ? Math.round(Number(body.layerOrder))
          : (Number.isFinite(sequenceLayerOrder) ? Math.round(sequenceLayerOrder) : 0);
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          void (async () => {
            const runtimeImageSrc = await resolveAuthenticatedImageOverlaySrc(imageUrl);
            setTimedShortcutImageOverlay(
              overlayKey,
              {
                src: runtimeImageSrc,
                name,
                opacity,
                chromaKey,
                leftPct,
                topPct,
                widthPct,
                heightPct,
                layerOrder,
                rotation,
                flipH,
                flipV,
                ...(motionPath ? { motionPath } : {}),
                ...(oscillation ? { oscillation } : {}),
                startedAtMs: Date.now(),
              },
              durationMs,
            );
          })();
        }, 'window.sendImage', getLateExecutionPolicy(sceneCommand, durationMs));
        return;
      }

      if (sceneCommand?.kind === 'narrative.setText') {
        const body = (sceneCommand.payload ?? {}) as Record<string, unknown>;
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        const segments = getNarrativeSegments(body);
        if (!text && segments.length === 0) {
          clearShortcutTextOverlay();
          return;
        }
        const title = typeof body.title === 'string' ? body.title.trim() || undefined : undefined;
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
        const textAlignRaw = typeof body.textAlign === 'string' ? body.textAlign : 'left';
        const textAlign: 'left' | 'center' | 'right' | 'justify' =
          textAlignRaw === 'center' || textAlignRaw === 'right' || textAlignRaw === 'justify'
            ? textAlignRaw
            : 'left';
        const backgroundModeRaw = typeof body.backgroundMode === 'string' ? body.backgroundMode : 'rect';
        const backgroundMode: 'none' | 'rect' | 'capsule' =
          backgroundModeRaw === 'none' || backgroundModeRaw === 'capsule'
            ? backgroundModeRaw
            : 'rect';
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          shortcutTextExecutionIdRef.current = sceneCommand.executionId ?? null;
          setTimedShortcutTextOverlay({
            text,
            title,
            leftPct: clampFreePlacement(body.leftPct ?? 8, 8),
            topPct: clampFreePlacement(body.topPct ?? 68, 68),
            widthPct: clampFreeSize(body.widthPct ?? 84, 84),
            heightPct: clampFreeSize(body.heightPct ?? 22, 22),
            opacity: clampOpacity(body.opacity, 1),
            layerOrder: Number.isFinite(Number(body.layerOrder)) ? Math.round(Number(body.layerOrder)) : 100,
            fontFamily: typeof body.fontFamily === 'string' && body.fontFamily.trim() ? body.fontFamily.trim() : 'Merriweather',
            fontSizePx: Number.isFinite(Number(body.fontSizePx)) ? Math.max(8, Math.min(220, Number(body.fontSizePx))) : 28,
            fontColor: typeof body.fontColor === 'string' && body.fontColor.trim() ? body.fontColor.trim() : '#ffffff',
            textAlign,
            lineHeight: Number.isFinite(Number(body.lineHeight)) ? Math.max(0.8, Math.min(3, Number(body.lineHeight))) : 1.35,
            letterSpacingPx: Number.isFinite(Number(body.letterSpacingPx)) ? Math.max(-8, Math.min(20, Number(body.letterSpacingPx))) : 0,
            fontWeight: body.fontWeight === 'bold' ? 'bold' : 'normal',
            fontStyle: body.fontStyle === 'italic' ? 'italic' : 'normal',
            textDecoration: body.textDecoration === 'underline' ? 'underline' : 'none',
            backgroundMode,
            backgroundColor: typeof body.backgroundColor === 'string' && body.backgroundColor.trim() ? body.backgroundColor.trim() : '#000000',
            backgroundOpacity: clampOpacity(body.backgroundOpacity, 0.58),
            borderRadiusPx: Number.isFinite(Number(body.borderRadiusPx)) ? Math.max(0, Math.min(128, Number(body.borderRadiusPx))) : 12,
            paddingPx: Number.isFinite(Number(body.paddingPx)) ? Math.max(0, Math.min(64, Number(body.paddingPx))) : 16,
            segments,
          }, durationMs);

          const voiceTarget = normalizeNarratorVoiceTarget(body.voiceTarget);
          const shouldPlayProjectionVoice = voiceTarget === 'projection' || voiceTarget === 'both';
          if (shouldPlayProjectionVoice && text) {
            void playNarration({
              text,
              voiceConfig: normalizeNarratorVoiceConfig(body.voiceConfig as Record<string, unknown>),
              locale: navigator.language,
            }).then((handle) => {
              registerNarrationHandle(sceneCommand.executionId, handle);
            }).catch(() => {});
          }
        }, 'narrative.setText', getLateExecutionPolicy(sceneCommand, durationMs));
        return;
      }

      if (sceneCommand?.kind === 'window.clearFilter') {
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          clearShortcutFilterOverlays();
        }, 'window.clearFilter');
        return;
      }

      if (sceneCommand?.kind === 'window.applyFilter') {
        const body = (sceneCommand.payload ?? {}) as Record<string, unknown>;
        const filter = typeof body.filter === 'string' ? body.filter : '';
        if (!filter) return;
        const color = typeof body.color === 'string' ? body.color : undefined;
        const intensity = typeof body.intensity === 'number' ? body.intensity : undefined;
        const layerOrder = Number.isFinite(Number(body.layerOrder)) ? Math.round(Number(body.layerOrder)) : undefined;
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          upsertShortcutFilterOverlay({
            id: sceneCommand.actionId || `${sceneCommand.kind}-${sceneCommand.executeAtMs ?? Date.now()}`,
            filter,
            color,
            intensity,
            ...(layerOrder !== undefined ? { layerOrder } : {}),
            ...(durationMs !== undefined ? { durationMs } : {}),
          });
        }, 'window.applyFilter');
        return;
      }

      const action = parseShortcutAction(payload);
      if (!action) return;
      if (
        action.kind !== 'window.showCharacterImage'
        && action.kind !== 'window.showNpcImage'
        && action.kind !== 'window.showMonsterImage'
        && action.kind !== 'window.showText'
        && action.kind !== 'window.applyFilter'
        && action.kind !== 'window.clearFilter'
      ) {
        return;
      }

      const body = (action.payload ?? action.config ?? {}) as Record<string, unknown>;

      if (action.kind === 'window.clearFilter') {
        clearShortcutFilterOverlays();
        return;
      }

      if (action.kind === 'window.applyFilter') {
        const filter = typeof body.filter === 'string' ? body.filter : '';
        if (!filter) return;
        const color = typeof body.color === 'string' ? body.color : undefined;
        const intensity = typeof body.intensity === 'number' ? body.intensity : undefined;
        const layerOrder = Number.isFinite(Number(body.layerOrder)) ? Math.round(Number(body.layerOrder)) : undefined;
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
        upsertShortcutFilterOverlay({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          filter,
          color,
          intensity,
          ...(layerOrder !== undefined ? { layerOrder } : {}),
          ...(durationMs !== undefined ? { durationMs } : {}),
        });
        return;
      }

      if (action.kind === 'window.showText') {
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!text) return;
        const title = typeof body.title === 'string' ? body.title : undefined;
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
        setTimedShortcutTextOverlay({
          text,
          title,
          leftPct: 8,
          topPct: 68,
          widthPct: 84,
          heightPct: 22,
          opacity: 1,
          layerOrder: 100,
          fontFamily: 'Merriweather',
          fontSizePx: 28,
          fontColor: '#ffffff',
          textAlign: 'left',
          lineHeight: 1.35,
          letterSpacingPx: 0,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          backgroundMode: 'rect',
          backgroundColor: '#000000',
          backgroundOpacity: 0.58,
          borderRadiusPx: 12,
          paddingPx: 16,
          segments: [{ text }],
        }, durationMs);
        return;
      }

      const entityId = typeof body.entityId === 'string' ? body.entityId : '';
      if (!entityId) return;
      const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
      const opacity = Math.max(0, Math.min(1, Number(body.opacity ?? 1)));
      const chromaKey = parseChromaKey(body.chromaKey);
      const leftPct = clampFreePlacement(body.leftPct ?? 10, 10);
      const topPct = clampFreePlacement(body.topPct ?? 10, 10);
      const widthPct = clampFreeSize(body.widthPct ?? 80, 80);
      const heightPct = clampFreeSize(body.heightPct ?? 80, 80);
      const layerOrder = Number.isFinite(Number(body.layerOrder)) ? Math.round(Number(body.layerOrder)) : 0;

      try {
        if (action.kind === 'window.showMonsterImage') {
          const cid = activeCampaign?.id || campaignIdFromQuery || rawCampaignId;
          if (!cid) return;
          const monster = await getCampaignMonster(cid, entityId, 'es').catch(() => getCampaignMonster(cid, entityId, 'en'));
          const src = monster.imageUrls?.high || monster.imageUrls?.medium || monster.imageUrls?.low || monster.tokenImageUrl;
          if (!src) return;
          const overlayKey = `legacy:${action.kind}:${entityId}`;
          setTimedShortcutImageOverlay(
            overlayKey,
            { src, name: monster.name || 'Monster', opacity, chromaKey, leftPct, topPct, widthPct, heightPct, layerOrder },
            durationMs,
          );
          return;
        }

        const character = await getCharacter(entityId);
        const src = character.characterImageUrl || character.tokenImageUrl;
        if (!src) return;
        const name = character.name || (action.kind === 'window.showNpcImage' ? 'NPC' : 'Character');
        const overlayKey = `legacy:${action.kind}:${entityId}`;
        setTimedShortcutImageOverlay(
          overlayKey,
          { src, name, opacity, chromaKey, leftPct, topPct, widthPct, heightPct, layerOrder },
          durationMs,
        );
      } catch {
        // Ignore runtime lookup failures to avoid breaking projection polling loop.
      }
    };

    const unsubscribe = window.electronAPI?.onShortcutWindowAction?.((payload: any) => {
      void handleWindowShortcutAction(payload);
    });

    const browserEventHandler = (event: Event) => {
      const custom = event as CustomEvent<{ action?: ShortcutActionDefinition } | ShortcutActionDefinition>;
      void handleWindowShortcutAction(custom.detail);
    };
    window.addEventListener('shortcut:action', browserEventHandler as EventListener);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('shortcut:action', browserEventHandler as EventListener);
      for (const timerId of scheduledTimerIds) {
        window.clearTimeout(timerId);
      }
      scheduledTimerIds.clear();
      executionTimerIdsRef.clear();
      executionVideoOverlayKeysRef.clear();
      executionImageOverlayKeysRef.clear();
      introPlayedActionsByExecutionRef.current.clear();
      sceneCommandDedupRef.current.clear();
      sceneCommandDedupOrderRef.current = [];
      sceneClockOffsetByExecutionRef.current.clear();
      sceneExecutionOrderRef.current = [];
      sceneSkewSamplesRef.current = [];
      clearShortcutImageOverlay();
      clearShortcutTextOverlay();
      clearShortcutVideoOverlay();
      shortcutFilterTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
      shortcutFilterTimeoutsRef.current.clear();
      shortcutImageTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
      shortcutImageTimeoutsRef.current.clear();
      shortcutVideoTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
      shortcutVideoTimeoutsRef.current.clear();
      narrationHandlesByExecutionRef.current.forEach((handles) => {
        handles.forEach((handle) => handle.stop());
      });
      narrationHandlesByExecutionRef.current.clear();
      clearWarmupCache();
    };
  }, [
    activeCampaign?.id,
    campaignIdFromQuery,
    clearWarmupCache,
    preloadVideoForOverlay,
    rawCampaignId,
    releaseOverlayVideo,
  ]);

  useEffect(() => {
    let cid = new URLSearchParams(window.location.search).get('campaignId');
    if (!cid) {
      // Hash-router path: '#/projection/skyline?campaignId=abc'
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) cid = new URLSearchParams(hash.slice(qIdx)).get('campaignId');
    }
    if (cid) {
      setCampaignIdFromQuery(cid);
      setActiveCampaignId(cid);
    }
  }, [setActiveCampaignId]);

  // Load selected day label (if any) for this campaign.
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery || rawCampaignId;
    if (!cid) {
      setSelectedDayLabel(null);
      return;
    }
    const payload = loadSelectedDayPayload();
    if (payload?.campaignId === cid) setSelectedDayLabel(payload.label);
    else setSelectedDayLabel(null);
  }, [activeCampaign?.id, campaignIdFromQuery, rawCampaignId]);

  const refreshSkylineMapVisualConfig = useCallback(async () => {
    const cid = activeCampaign?.id || campaignIdFromQuery || rawCampaignId || undefined;
    if (!activeMapId) {
      setHasSkyline(false);
      setActiveSkylineFilters(null);
      return;
    }
    const maps = await listMaps({ campaignId: cid });
    const m = maps.find(x => x.id === activeMapId);
    setHasSkyline(Boolean((m as any)?.skylineAvailable));
    setActiveSkylineFilters((m as any)?.skylineFilters || null);
  }, [activeCampaign?.id, campaignIdFromQuery, rawCampaignId, activeMapId]);

  useEffect(() => {
    try {
      const d = (window as any).electronAPI?.onProjectionPoke?.(async () => {
        await refreshFromServer();
        try { await refreshSkylineMapVisualConfig(); } catch {}
      });
      return () => { if (typeof d === 'function') d(); };
    } catch {}
  }, [refreshFromServer, refreshSkylineMapVisualConfig]);

  const loadSkylineCharacter = useCallback(async () => {
    const effectiveCampaignId = campaignIdFromQuery || rawCampaignId || activeCampaign?.id;
    let charId: string | null | undefined = activeCampaign?.activeSkylineCharacter?.id;
    let activeImageUrl: string | null = activeCampaign?.activeSkylineImageUrl ?? null;

    if (effectiveCampaignId) {
      try {
        const fetched = await getActiveSkylineCharacterInfo(effectiveCampaignId);
        charId = fetched.characterId;
        activeImageUrl = fetched.activeSkylineImageUrl ?? null;
        setConnectionError(false); // Clear error on successful request
      } catch (err: any) {
        // Check if it's a network/connection error
        if (!err?.response) {
          setConnectionError(true);
          setLastConnectionAttempt(Date.now());
        }
      }
    }

    if (!charId) {
      setSkylineCharacter(null);
      setSkylineCharacterImageUrlOverride(null);
      return;
    }

    try {
      const ch = await getCharacter(charId);
      setSkylineCharacter(ch);
      setSkylineCharacterImageUrlOverride(activeImageUrl);
      setConnectionError(false); // Clear error on successful request
    } catch (err: any) {
      setSkylineCharacter(null);
      setSkylineCharacterImageUrlOverride(null);
      // Check if it's a network/connection error
      if (!err?.response) {
        setConnectionError(true);
        setLastConnectionAttempt(Date.now());
      }
    }
  }, [activeCampaign?.activeSkylineCharacter?.id, activeCampaign?.activeSkylineImageUrl, activeCampaign?.id, campaignIdFromQuery, rawCampaignId]);

  const loadSkylineSettings = useCallback(async () => {
    const cid = campaignIdFromQuery || rawCampaignId || activeCampaign?.id;
    if (!cid) return;
    try {
      const settings = await getSkylineOverlaySettingsPublic(cid);
      setShowSongTitle(!!settings.showSongTitle);
      setShowInitiativeStrip(!!settings.showInitiativeStrip);
      setShowQr(!!settings.showQr);
      setQrUrl(settings.qrUrl || '');
    } catch {}
  }, [activeCampaign?.id, campaignIdFromQuery, rawCampaignId]);

  const loadSkylineItems = useCallback(async () => {
    const cid = campaignIdFromQuery || rawCampaignId || activeCampaign?.id;
    if (!cid) {
      setSkylineItems([]);
      return;
    }
    try {
      const items = await getSkylineItems(cid);
      setSkylineItems(items);
      setConnectionError(false); // Clear error on successful request
    } catch (err: any) {
      console.error('[ProjectionSkyline] Failed to load skyline items:', err);
      setSkylineItems([]);
      // Check if it's a network/connection error
      if (!err?.response) {
        setConnectionError(true);
        setLastConnectionAttempt(Date.now());
      }
    }
  }, [activeCampaign?.id, campaignIdFromQuery, rawCampaignId]);

  // Auto-retry connection when there's a connection error
  useEffect(() => {
    if (!connectionError) return;
    
    const retryInterval = setInterval(() => {
      console.log('[ProjectionSkyline] Attempting to reconnect...');
      // Trigger a reload which will clear the error on success
      loadSkylineCharacter().catch(() => {});
      loadSkylineItems().catch(() => {});
    }, 5000); // Retry every 5 seconds

    return () => clearInterval(retryInterval);
  }, [connectionError, loadSkylineCharacter, loadSkylineItems]);

  // Load active skyline character when campaign context or query changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await loadSkylineCharacter(); };
    run();
    return () => { cancelled = true; };
  }, [loadSkylineCharacter]);

  // Load skyline overlay settings when campaign context or query changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await loadSkylineSettings(); };
    run();
    return () => { cancelled = true; };
  }, [loadSkylineSettings]);

  // Load skyline items when campaign context or query changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await loadSkylineItems(); };
    run();
    return () => { cancelled = true; };
  }, [loadSkylineItems]);

  // Listen to storage events (other window toggled skyline) and reload
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'app.skyline.forcedOverlay') {
        setForcedOverlay((e.newValue as any) || null);
        return;
      }
      if (e.key !== 'app.skyline.activeCharacterUpdated') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        // Only reload if same campaign as this window
        if (cid === (activeCampaign?.id || campaignIdFromQuery || rawCampaignId)) {
          loadSkylineCharacter();
        }
      } catch {
        // ignore parse errors
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery, rawCampaignId, loadSkylineCharacter]);

  // Listen to storage events for skyline items updates
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'app.skyline.itemsUpdated') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        if (cid === (activeCampaign?.id || campaignIdFromQuery || rawCampaignId)) {
          loadSkylineItems();
        }
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery, rawCampaignId, loadSkylineItems]);

  // Fast-sync via BroadcastChannel
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('campaign-sync');
        bc.onmessage = (e: MessageEvent) => {
          const data = e?.data;
          if (data?.type === 'activeSkylineChanged' && data?.campaignId === cid) {
            loadSkylineCharacter();
          }
          if (data?.type === 'map-transform-updated') {
            // Map editor save event; includes visual filters for map/skyline.
            refreshSkylineMapVisualConfig().catch(() => {});
          }
          if (data?.type === 'skylineItemsChanged' && data?.campaignId === cid) {
            loadSkylineItems();
          }
          if (data?.type === 'nowPlayingChanged' && data?.campaignId === cid) {
            // Cross-context robust update: re-fetch via public endpoint
            getCampaignNowPlayingTitlePublic(cid).then(r => setNowPlayingTitle(r.title || null)).catch(() => {});
          }
          if (data?.type === 'skylineSettingsChanged' && data?.campaignId === cid) {
            const st = data?.settings;
            if (typeof st?.showSongTitle === 'boolean') setShowSongTitle(!!st.showSongTitle);
            if (typeof st?.showInitiativeStrip === 'boolean') setShowInitiativeStrip(!!st.showInitiativeStrip);
            if (typeof st?.showCurrentTurnImage === 'boolean') setShowCurrentTurnImage(!!st.showCurrentTurnImage);
            if (typeof st?.currentTurnImagePosition === 'string') setCurrentTurnImagePosition(st.currentTurnImagePosition);
            if (st?.currentTurnImageSizes && typeof st.currentTurnImageSizes === 'object') setImageSizes(st.currentTurnImageSizes);
            if (typeof st?.showQr === 'boolean') setShowQr(!!st.showQr);
            if (typeof st?.qrUrl === 'string') setQrUrl(st.qrUrl || '');
          }
          if (data?.type === 'skylineOverlayForced' && data?.campaignId === cid) {
            setForcedOverlay((data.forcedOverlay as any) || null);
          }
          if (data?.type === 'initiativeStripUpdated' && data?.campaignId === cid) {
            // Mark this as a fresh BroadcastChannel update so polling skips
            // overwriting with potentially stale server data.
            lastBroadcastStripUpdateRef.current = Date.now();
            const payload = data as any;
            const newStrip = { 
              battleStarted: !!payload.battleStarted, 
              enabled: !!payload.enabled, 
              currentTurnId: payload.currentTurnId || null, 
              items: (payload.items || []).map((x: any) => ({ 
                id: x.id, 
                name: x.name, 
                imageUrl: x.imageUrl ?? null, 
                fullImageUrl: x.fullImageUrl ?? null,
                size: x.size ?? null,
                role: x.role 
              })) 
            };
            // Also update battleStateStarted to stay in sync
            setBattleStateStarted(!!payload.battleStarted);
            // Only update if the content actually changed to prevent unnecessary re-renders and image flickering
            setInitiativeStrip(prev => {
              // Quick comparison: count, enabled, battleStarted, currentTurn
              if (prev.items.length !== newStrip.items.length) return newStrip;
              if (prev.enabled !== newStrip.enabled) return newStrip;
              if (prev.battleStarted !== newStrip.battleStarted) return newStrip;
              if (prev.currentTurnId !== newStrip.currentTurnId) return newStrip;
              // Deep comparison of items (id, name, imageUrl, fullImageUrl, size, role)
              for (let i = 0; i < prev.items.length; i++) {
                const p = prev.items[i];
                const n = newStrip.items[i];
                if (p.id !== n.id || p.name !== n.name || p.imageUrl !== n.imageUrl || p.fullImageUrl !== n.fullImageUrl || p.size !== n.size || p.role !== n.role) {
                  return newStrip;
                }
              }
              // No changes detected, keep previous reference
              return prev;
            });
          }
        };
      }
    } catch {}
    return () => { try { bc?.close(); } catch {} };
  }, [activeCampaign?.id, campaignIdFromQuery, loadSkylineCharacter, loadSkylineItems, refreshSkylineMapVisualConfig]);

  // Poll server periodically to reflect remote changes (multi-device control).
  // Uses a ref to avoid restarting the interval when callbacks change,
  // and a guard flag to prevent concurrent poll runs.
  const pollFnRef = useRef<() => Promise<void>>();
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery || rawCampaignId;
    pollFnRef.current = async () => {
      if (!cid) return;
      await loadSkylineCharacter();
      // Fetch settings – capture value locally so the strip update below
      // uses the *freshly-fetched* showInitiativeStrip rather than the
      // (potentially stale) closure-captured React state.
      let fetchedShowInitiativeStrip = showInitiativeStrip;
      try {
        const settings = await getSkylineOverlaySettingsPublic(cid);
        setShowSongTitle(!!settings.showSongTitle);
        setShowInitiativeStrip(!!settings.showInitiativeStrip);
        setShowQr(!!settings.showQr);
        setQrUrl(settings.qrUrl || '');
        fetchedShowInitiativeStrip = !!settings.showInitiativeStrip;
      } catch {}
      try {
        const r = await getCampaignNowPlayingTitlePublic(cid);
        setNowPlayingTitle(r.title || null);
      } catch {}
      try {
        const bs = await getCampaignBattleStatePublic(cid);
        // Skip overwriting ALL initiative-related state if a
        // BroadcastChannel / storage-event / LS-hydration update was
        // received recently – that local data is fresher than the server
        // data because the server PATCH arrives with a 250 ms delay.
        const GRACE_MS = 5000;
        const lastLocalUpdate = lastBroadcastStripUpdateRef.current;
        const withinGrace = lastLocalUpdate > 0 && (Date.now() - lastLocalUpdate) < GRACE_MS;
        if (!withinGrace) {
          // Server says battle is active and has items → apply update.
          // Server says battle NOT active → only reset if we have never
          // received a BC/LS update (lastLocalUpdate === 0).  When BC is
          // active, the "battle ended" signal arrives via BC instantly;
          // stale server data should never erase a locally-valid strip.
          const serverHasActiveData = !!bs.started && Array.isArray(bs.items) && bs.items.length > 0;
          const neverReceivedLocalUpdate = lastLocalUpdate === 0;

          if (serverHasActiveData || neverReceivedLocalUpdate) {
            setBattleStateStarted(!!bs.started);
          }
          if (serverHasActiveData) {
            setInitiativeStrip(prev => {
              // Build the new items merging server data with in-memory rich data.
              // Server intentionally omits fullImageUrl/size (stripped to avoid
              // 10 MB+ payloads with base64 images). Preserve them from the
              // previous strip, which was populated via BroadcastChannel.
              const newItems = bs.items.map((x) => {
                const prevItem = prev.items.find(p => p.id === x.id);
                return {
                  id: x.id,
                  name: x.name,
                  imageUrl: x.imageUrl ?? null,
                  fullImageUrl: (x as any).fullImageUrl ?? prevItem?.fullImageUrl ?? null,
                  size: (x as any).size ?? prevItem?.size ?? null,
                  role: (x as any).role ?? prevItem?.role,
                };
              });
              const newStrip = {
                battleStarted: !!bs.started,
                enabled: fetchedShowInitiativeStrip,
                currentTurnId: bs.currentTurnId || null,
                items: newItems,
              };
              // Deep comparison — only update reference if something actually changed
              if (prev.items.length !== newStrip.items.length) return newStrip;
              if (prev.enabled !== newStrip.enabled) return newStrip;
              if (prev.battleStarted !== newStrip.battleStarted) return newStrip;
              if (prev.currentTurnId !== newStrip.currentTurnId) return newStrip;
              for (let i = 0; i < prev.items.length; i++) {
                const p = prev.items[i];
                const n = newStrip.items[i];
                if (p.id !== n.id || p.name !== n.name || p.imageUrl !== n.imageUrl || p.fullImageUrl !== n.fullImageUrl || p.size !== n.size || p.role !== n.role) {
                  return newStrip;
                }
              }
              return prev;
            });
          } else if (neverReceivedLocalUpdate && Array.isArray(bs.items)) {
            // Server says battle inactive and we have no local data → clear
            setInitiativeStrip({ battleStarted: false, enabled: false, currentTurnId: null, items: [] });
          }
        }
      } catch {}
    };
  });

  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery || rawCampaignId;
    if (!cid) return;
    let disposed = false;
    let polling = false;
    const intervalMs = 2000;
    const doPoll = async () => {
      if (disposed || polling) return;
      // Skip polling when the page is hidden (browser throttles timers anyway)
      if (document.visibilityState === 'hidden') return;
      polling = true;
      try {
        await pollFnRef.current?.();
      } catch (err) {
        console.error('[ProjectionSkyline] poll error:', err);
      } finally {
        polling = false;
      }
    };
    // Immediate poll once
    doPoll();
    const interval = setInterval(doPoll, intervalMs);
    return () => { disposed = true; clearInterval(interval); };
  }, [activeCampaign?.id, campaignIdFromQuery, rawCampaignId]);

  // Recover when the page becomes visible again (e.g. after sleep/hibernate/tab switch)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        console.log('[ProjectionSkyline] Page became visible, refreshing all data...');
        refreshFromServer();
        loadSkylineCharacter();
        loadSkylineSettings();
        loadSkylineItems();
        // Do NOT call pollFnRef.current here — the next scheduled
        // poll interval will pick it up.  Calling it immediately would
        // bypass the interval's concurrency guard and could double-fire.
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [refreshFromServer, loadSkylineCharacter, loadSkylineSettings, loadSkylineItems]);

  // Recover when network comes back online
  useEffect(() => {
    const handler = () => {
      console.log('[ProjectionSkyline] Network online, refreshing all data...');
      setConnectionError(false);
      refreshFromServer();
      loadSkylineCharacter();
      loadSkylineSettings();
      loadSkylineItems();
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [refreshFromServer, loadSkylineCharacter, loadSkylineSettings, loadSkylineItems]);

  // On mount or campaign change, read last-known initiative strip from localStorage.
  // Also sets battleStateStarted and marks lastBroadcastStripUpdateRef so the
  // immediate first poll does NOT overwrite with potentially default server data.
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    try {
      const raw = localStorage.getItem('app.skyline.initiativeStrip');
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload?.campaignId === cid) {
          const newStrip = { 
            battleStarted: !!payload.battleStarted, 
            enabled: !!payload.enabled, 
            currentTurnId: payload.currentTurnId || null, 
            items: (payload.items || []).map((x: any) => ({ 
              id: x.id, 
              name: x.name, 
              imageUrl: x.imageUrl ?? null, 
              fullImageUrl: x.fullImageUrl ?? null,
              size: x.size ?? null,
              role: x.role 
            })) 
          };
          // Protect this hydrated data from being overwritten by the first
          // poll cycle — mark as if a BC update just arrived.
          if (newStrip.items.length > 0) {
            lastBroadcastStripUpdateRef.current = Date.now();
            setBattleStateStarted(!!payload.battleStarted);
          }
          setInitiativeStrip(prev => {
            if (prev.items.length !== newStrip.items.length) return newStrip;
            if (prev.enabled !== newStrip.enabled) return newStrip;
            if (prev.battleStarted !== newStrip.battleStarted) return newStrip;
            if (prev.currentTurnId !== newStrip.currentTurnId) return newStrip;
            for (let i = 0; i < prev.items.length; i++) {
              const p = prev.items[i];
              const n = newStrip.items[i];
              if (p.id !== n.id || p.name !== n.name || p.imageUrl !== n.imageUrl || p.fullImageUrl !== n.fullImageUrl || p.size !== n.size || p.role !== n.role) {
                return newStrip;
              }
            }
            return prev;
          });
        }
      }
    } catch {}
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // On mount or campaign change, read last-known skyline settings from localStorage
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    try {
      const raw = localStorage.getItem('app.skyline.settingsUpdated');
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload?.campaignId === cid) {
          if (typeof payload.showSongTitle === 'boolean') setShowSongTitle(!!payload.showSongTitle);
          if (typeof payload.showInitiativeStrip === 'boolean') setShowInitiativeStrip(!!payload.showInitiativeStrip);
          if (typeof payload.showQr === 'boolean') setShowQr(!!payload.showQr);
          if (typeof payload.qrUrl === 'string') setQrUrl(payload.qrUrl || '');
        }
      }
    } catch {}
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Rehydrate battle state from localStorage based on active encounter.
  // Respects the BroadcastChannel grace period to avoid overriding fresh
  // BC data with stale or absent localStorage values.
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    let disposed = false;
    (async () => {
      try {
        const encId = await getActiveEncounterId(cid);
        if (!encId) {
          // Only clear if no recent BroadcastChannel update
          if (!disposed && (Date.now() - lastBroadcastStripUpdateRef.current) > 5000) {
            setBattleStateStarted(false);
          }
          return;
        }
        const key = `battle.state:${cid}:${encId}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const obj = JSON.parse(raw);
            if (!disposed && (Date.now() - lastBroadcastStripUpdateRef.current) > 5000) {
              setBattleStateStarted(!!obj?.started);
            }
          }
        } catch {
          if (!disposed && (Date.now() - lastBroadcastStripUpdateRef.current) > 5000) {
            setBattleStateStarted(false);
          }
        }
        const handler = (e: StorageEvent) => {
          if (e.key !== key) return;
          try {
            const obj = e.newValue ? JSON.parse(e.newValue) : null;
            if (!obj) return;
            setBattleStateStarted(!!obj.started);
          } catch {}
        };
        window.addEventListener('storage', handler);
        return () => { window.removeEventListener('storage', handler); };
      } catch {
        if (!disposed && (Date.now() - lastBroadcastStripUpdateRef.current) > 5000) {
          setBattleStateStarted(false);
        }
      }
    })();
    return () => { disposed = true; };
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Keep skyline availability and filters synced for the active map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshSkylineMapVisualConfig();
      } catch {
        if (!cancelled) {
          setHasSkyline(false);
          setActiveSkylineFilters(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [refreshSkylineMapVisualConfig]);

  // Poll as fallback so visual filter changes are reflected even without explicit events.
  useEffect(() => {
    let disposed = false;
    const tick = async () => {
      if (disposed) return;
      try { await refreshSkylineMapVisualConfig(); } catch {}
    };
    const id = window.setInterval(tick, 2000);
    return () => { disposed = true; window.clearInterval(id); };
  }, [refreshSkylineMapVisualConfig]);

  // Check if campaign has a default skyline fallback image
  useEffect(() => {
    let cancelled = false;
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) { setHasDefaultSkylineImg(false); return; }
    hasDefaultSkylinePublic(cid).then(v => { if (!cancelled) setHasDefaultSkylineImg(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Reportar tamaño de la ventana Skyline (Electron) y guardarlo en localStorage
  useEffect(() => {
    const KEY_SIZE = 'app.projection.skyline.size';
    const el = document.getElementById('projection-skyline-root');
    const report = () => {
      const rect = el?.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const payload = { width: Math.round(rect?.width || window.innerWidth), height: Math.round(rect?.height || window.innerHeight), dpr };
      try { (window as any).electronAPI?.skylineProjectionReportSize?.(payload); } catch {}
      try { localStorage.setItem(KEY_SIZE, JSON.stringify(payload)); } catch {}
    };
    report();
    window.addEventListener('resize', report);
    return () => window.removeEventListener('resize', report);
  }, []);

  // Listen to storage events for now-playing changes cross-window
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'app.skyline.nowPlaying') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        if (cid === (activeCampaign?.id || campaignIdFromQuery)) {
          setNowPlayingTitle(payload.title || null);
        }
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Listen to storage events for skyline settings changes cross-window
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'app.skyline.settingsUpdated') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        if (cid === (activeCampaign?.id || campaignIdFromQuery)) {
          if (typeof payload.showSongTitle === 'boolean') setShowSongTitle(!!payload.showSongTitle);
          if (typeof payload.showInitiativeStrip === 'boolean') setShowInitiativeStrip(!!payload.showInitiativeStrip);
          if (typeof payload.showQr === 'boolean') setShowQr(!!payload.showQr);
          if (typeof payload.qrUrl === 'string') setQrUrl(payload.qrUrl || '');
        }
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Listen to storage events for initiative strip updates cross-window
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'app.skyline.initiativeStrip') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        if (cid === (activeCampaign?.id || campaignIdFromQuery)) {
          // Mark as fresh local update to protect from stale poll data
          lastBroadcastStripUpdateRef.current = Date.now();
          setBattleStateStarted(!!payload.battleStarted);
          const newStrip = { 
            battleStarted: !!payload.battleStarted, 
            enabled: !!payload.enabled, 
            currentTurnId: payload.currentTurnId || null, 
            items: (payload.items || []).map((x: any) => ({ 
              id: x.id, 
              name: x.name, 
              imageUrl: x.imageUrl ?? null, 
              fullImageUrl: x.fullImageUrl ?? null,
              size: x.size ?? null,
              role: x.role 
            })) 
          };
          // Only update if content changed to prevent flickering
          setInitiativeStrip(prev => {
            if (prev.items.length !== newStrip.items.length) return newStrip;
            if (prev.enabled !== newStrip.enabled) return newStrip;
            if (prev.battleStarted !== newStrip.battleStarted) return newStrip;
            if (prev.currentTurnId !== newStrip.currentTurnId) return newStrip;
            for (let i = 0; i < prev.items.length; i++) {
              const p = prev.items[i];
              const n = newStrip.items[i];
              if (p.id !== n.id || p.name !== n.name || p.imageUrl !== n.imageUrl || p.fullImageUrl !== n.fullImageUrl || p.size !== n.size || p.role !== n.role) {
                return newStrip;
              }
            }
            return prev;
          });
        }
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Listen to diary storage events cross-window (selected day + preference)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      const cid = activeCampaign?.id || campaignIdFromQuery;
      if (!cid) return;

      if (e.key === SHOW_DAY_IN_SKYLINE_KEY) {
        if (e.newValue === null) setShowSelectedDayInSkyline(true);
        else setShowSelectedDayInSkyline(e.newValue === 'true');
        return;
      }

      if (e.key !== SELECTED_DAY_KEY) return;

      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) {
          setSelectedDayLabel(null);
          return;
        }
        if (payload.campaignId === cid && typeof payload.label === 'string') {
          setSelectedDayLabel(payload.label);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  const skylineAvatar = useMemo(() => {
    if (!skylineCharacter) return null;
    const initials = (skylineCharacter.name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
    const avatarBg = skylineCharacter.tokenColor || '#263238';
    const src = skylineCharacterImageUrlOverride || skylineCharacter.characterImageUrl || skylineCharacter.tokenImageUrl || undefined;
    return (
      <StackedCharacterOverlay src={src} initials={initials} bg={avatarBg} />
    );
  }, [skylineCharacter, skylineCharacterImageUrlOverride]);

  // Calculate current turn participant for image display
  const currentTurnParticipant = React.useMemo(() => {
    if (!initiativeStrip?.currentTurnId) return null;
    return initiativeStrip.items.find(it => it.id === initiativeStrip.currentTurnId) || null;
  }, [initiativeStrip]);

  // ── Overlay priority stack ──────────────────────────────────────────────
  // Effects declared in default-priority order (lowest → highest): shopItem < character < turnImage.
  // Each effect appends its source to the END of the stack when it becomes active and removes it
  // when it deactivates. The last element of the stack is the only one rendered.
  const isCharacterActive = !!skylineCharacter;
  const isTurnImageActive = showCurrentTurnImage && !!currentTurnParticipant?.fullImageUrl && (initiativeStrip?.battleStarted || battleStateStarted);
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

  /** The overlay source currently displayed (the most recently activated one). */
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
    <Box id="projection-skyline-root" sx={{ width: '100vw', height: '100vh', bgcolor: 'black', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Connection error overlay */}
      {connectionError && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            px: 4,
            py: 3,
            borderRadius: 2,
            zIndex: 10000,
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            ⚠️ Error de Conexión
          </Typography>
          <Typography variant="body1">
            No se puede conectar con el servidor backend.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
            Intentando reconectar automáticamente...
          </Typography>
        </Box>
      )}

      {activeMapId ? (
        hasSkyline ? (
          <AuthImage
            src={getMapSkylineUrlSized(activeMapId, 'full', { timeOfDay, cacheBust: timeOfDay })}
            alt="Skyline proyectado"
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: getVisualFilterCss(activeSkylineFilters?.[timeOfDay]) }}
          />
        ) : hasDefaultSkylineImg && (activeCampaign?.id || campaignIdFromQuery) ? (
          <img
            src={getDefaultSkylinePublicUrl((activeCampaign?.id || campaignIdFromQuery)!)}
            alt="Skyline por defecto"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Typography variant="h4" color="white">Sin skyline para este mapa</Typography>
        )
      ) : (
        <Typography variant="h4" color="white">Sin mapa activo</Typography>
      )}

      {shortcutFilterOverlays
        .slice()
        .sort((left, right) => (left.layerOrder ?? 100) - (right.layerOrder ?? 100) || left.id.localeCompare(right.id))
        .map((overlay) => (
        <Box
          key={overlay.id}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 9000 + (overlay.layerOrder ?? 100),
            pointerEvents: 'none',
            ...buildWindowFilterBackdropStyle(overlay.filter, overlay.intensity, overlay.color),
          }}
        />
      ))}

      {shortcutTextOverlay ? (
        <Box
          sx={{
            position: 'absolute',
            left: `${shortcutTextOverlay.leftPct}%`,
            top: `${shortcutTextOverlay.topPct}%`,
            width: `${shortcutTextOverlay.widthPct}%`,
            height: `${shortcutTextOverlay.heightPct}%`,
            zIndex: 9000 + (shortcutTextOverlay.layerOrder ?? 100),
            opacity: shortcutTextOverlay.opacity,
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              p: `${shortcutTextOverlay.paddingPx}px`,
              borderRadius: shortcutTextOverlay.backgroundMode === 'capsule'
                ? '999px'
                : `${shortcutTextOverlay.borderRadiusPx}px`,
              bgcolor: shortcutTextOverlay.backgroundMode === 'none'
                ? 'transparent'
                : alpha(shortcutTextOverlay.backgroundColor, shortcutTextOverlay.backgroundOpacity),
              color: shortcutTextOverlay.fontColor,
              fontFamily: shortcutTextOverlay.fontFamily,
              fontSize: `${shortcutTextOverlay.fontSizePx}px`,
              textAlign: shortcutTextOverlay.textAlign,
              lineHeight: shortcutTextOverlay.lineHeight,
              letterSpacing: `${shortcutTextOverlay.letterSpacingPx}px`,
              fontWeight: shortcutTextOverlay.fontWeight === 'bold' ? 700 : 400,
              fontStyle: shortcutTextOverlay.fontStyle,
              textDecoration: shortcutTextOverlay.textDecoration,
              boxSizing: 'border-box',
            }}
          >
            {shortcutTextOverlay.title ? (
              <Typography
                variant="subtitle2"
                sx={{
                  mb: 0.5,
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontStyle: 'inherit',
                  textDecoration: 'inherit',
                }}
              >
                {shortcutTextOverlay.title}
              </Typography>
            ) : null}
            <Typography
              component="div"
              sx={{
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                fontStyle: 'inherit',
                textDecoration: 'inherit',
                lineHeight: 'inherit',
                textAlign: 'inherit',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {shortcutTextOverlay.segments.map((segment, index) => (
                <Box
                  key={`skyline-text-seg-${index}`}
                  component="span"
                  sx={{
                    fontWeight: segment.bold ? 700 : undefined,
                    fontStyle: segment.italic ? 'italic' : undefined,
                    textDecoration: segment.underline ? 'underline' : undefined,
                    fontSize: segment.fontSizePx ? `${segment.fontSizePx}px` : undefined,
                    color: segment.color,
                    fontFamily: segment.fontFamily,
                  }}
                >
                  {segment.text}
                </Box>
              ))}
            </Typography>
          </Box>
        </Box>
      ) : null}

      {sceneSyncDiagnosticsVisible ? (
        <Box
          sx={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            zIndex: 8100,
            px: 1.2,
            py: 0.8,
            borderRadius: 1.5,
            bgcolor: 'rgba(0,0,0,0.65)',
            color: 'white',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            minWidth: 240,
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
            scene sync skyline
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            samples: {sceneSyncDiagnostics.samples}  p50: {Math.round(sceneSyncDiagnostics.p50)}ms  p95: {Math.round(sceneSyncDiagnostics.p95)}ms
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            late: {sceneSyncDiagnostics.late}  dropped: {sceneSyncDiagnostics.dropped}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            transit: {sceneSyncDiagnostics.lastReceiveDeltaMs !== null ? `${Math.round(sceneSyncDiagnostics.lastReceiveDeltaMs)}ms` : 'n/a'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            base: {Math.round(sceneSyncDiagnostics.baseOffsetMs)}ms  sync: {sceneSyncDiagnostics.lastSyncAtMs ? new Date(sceneSyncDiagnostics.lastSyncAtMs).toLocaleTimeString() : 'n/a'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            rtt: {sceneSyncDiagnostics.lastRoundTripMs !== null ? `${Math.round(sceneSyncDiagnostics.lastRoundTripMs)}ms` : 'n/a'}  {sceneSyncDiagnostics.syncError ? 'sync error' : 'ok'}
          </Typography>
        </Box>
      ) : null}

      {activeOverlay === 'character' && skylineAvatar}

      {shortcutImageOverlays
        .slice()
        .sort((a, b) => a.layerOrder - b.layerOrder || a.createdAtMs - b.createdAtMs)
        .map((overlay) => (
          <AnimatedSceneOverlay key={overlay.key} overlay={overlay}>
            <Box
              sx={{
                width: '100%',
                height: '100%',
              }}
            >
              <ChromaKeyMedia
                kind="image"
                src={overlay.src}
                opacity={overlay.opacity}
                chromaKey={overlay.chromaKey}
                onMediaError={() => {
                  const timerId = shortcutImageTimeoutsRef.current.get(overlay.key);
                  if (timerId !== undefined) {
                    window.clearTimeout(timerId);
                    shortcutImageTimeoutsRef.current.delete(overlay.key);
                  }
                  setShortcutImageOverlays((current) => current.filter((item) => item.key !== overlay.key));
                }}
              />
              {overlay.name ? (
                <Typography
                  variant="subtitle2"
                  color="white"
                  sx={{
                    mt: 0.75,
                    textAlign: 'center',
                    textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                    pointerEvents: 'none',
                  }}
                >
                  {overlay.name}
                </Typography>
              ) : null}
            </Box>
          </AnimatedSceneOverlay>
        ))}

      {shortcutVideoOverlays
        .slice()
        .sort((a, b) => a.layerOrder - b.layerOrder || a.createdAtMs - b.createdAtMs)
        .map((overlay) => (
          <AnimatedSceneOverlay key={overlay.key} overlay={overlay}>
            <ChromaKeyMedia
              kind="video"
              src={resolveVideoSrc(overlay.key, overlay.src)}
              autoPlay
              muted={overlay.muted}
              loop={overlay.loop}
              startAtSec={overlay.startAtSec}
              loopRangeStartSec={overlay.loopRangeStartSec}
              loopRangeEndSec={overlay.loopRangeEndSec}
              playsInline
              opacity={overlay.opacity}
              chromaKey={overlay.chromaKey}
              onVideoEnded={() => {
                if (!overlay.loop) {
                  const timerId = shortcutVideoTimeoutsRef.current.get(overlay.key);
                  if (timerId !== undefined) {
                    window.clearTimeout(timerId);
                    shortcutVideoTimeoutsRef.current.delete(overlay.key);
                  }
                  releaseOverlayVideo(overlay.key);
                  setShortcutVideoOverlays((current) => current.filter((item) => item.key !== overlay.key));
                }
              }}
              onMediaError={() => {
                const timerId = shortcutVideoTimeoutsRef.current.get(overlay.key);
                if (timerId !== undefined) {
                  window.clearTimeout(timerId);
                  shortcutVideoTimeoutsRef.current.delete(overlay.key);
                }
                releaseOverlayVideo(overlay.key);
                setShortcutVideoOverlays((current) => current.filter((item) => item.key !== overlay.key));
              }}
            />
          </AnimatedSceneOverlay>
        ))}

      {showSongTitle && nowPlayingTitle ? (
        <Box sx={{ position: 'absolute', top: 16, left: 16, px: 1.5, py: 0.75, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1 }}>
          <Typography variant="subtitle1" color="white" noWrap title={nowPlayingTitle}>{nowPlayingTitle}</Typography>
        </Box>
      ) : null}

      {showSelectedDayInSkyline && selectedDayLabel ? (
        <Box sx={{ position: 'absolute', top: 16, right: 16, px: 1.5, py: 0.75, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1, maxWidth: '45vw' }}>
          <Typography variant="subtitle1" color="white" noWrap title={selectedDayLabel}>{selectedDayLabel}</Typography>
        </Box>
      ) : null}

      {/* QR code overlay */}
      {showQr && qrUrl && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            bgcolor: 'white',
            p: 1.5,
            borderRadius: 1,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <QRCodeSVG value={qrUrl} size={180} />
          <Typography
            variant="caption"
            sx={{ color: 'black', fontSize: '0.7rem', maxWidth: 180, textAlign: 'center', wordBreak: 'break-all' }}
          >
            {qrUrl}
          </Typography>
        </Box>
      )}

      {/* Current turn image overlay */}
      {activeOverlay === 'turnImage' && showCurrentTurnImage && currentTurnParticipant && currentTurnParticipant.fullImageUrl && (initiativeStrip?.battleStarted || battleStateStarted) ? (() => {
        // Get size category (default to Medium if not specified)
        const sizeCategory = currentTurnParticipant.size || 'Medium';
        const sizeVw = imageSizes[sizeCategory] || imageSizes['Medium'] || 30;
        
        // Calculate position based on currentTurnImagePosition
        let positionSx: any = { position: 'absolute' };
        switch (currentTurnImagePosition) {
          case 'center-center':
            positionSx = { ...positionSx, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
            break;
          case 'center-right':
            positionSx = { ...positionSx, top: '50%', right: 32, transform: 'translateY(-50%)' };
            break;
          case 'center-left':
            positionSx = { ...positionSx, top: '50%', left: 32, transform: 'translateY(-50%)' };
            break;
          case 'top-center':
            positionSx = { ...positionSx, top: 32, left: '50%', transform: 'translateX(-50%)' };
            break;
          case 'top-right':
            positionSx = { ...positionSx, top: 32, right: 32 };
            break;
          case 'top-left':
            positionSx = { ...positionSx, top: 32, left: 32 };
            break;
          case 'bottom-center':
            positionSx = { ...positionSx, bottom: 32, left: '50%', transform: 'translateX(-50%)' };
            break;
          case 'bottom-right':
            positionSx = { ...positionSx, bottom: 32, right: 32 };
            break;
          case 'bottom-left':
            positionSx = { ...positionSx, bottom: 32, left: 32 };
            break;
          default:
            positionSx = { ...positionSx, top: '50%', right: 32, transform: 'translateY(-50%)' };
        }
        
        return (
          <Box sx={{ ...positionSx }}>
            <AuthImage
              src={currentTurnParticipant.fullImageUrl}
              alt=""
              style={{ 
                display: 'block',
                maxWidth: `${sizeVw}vw`,
                maxHeight: '90vh',
                width: 'auto',
                height: 'auto',
              }}
            />
          </Box>
        );
      })() : null}

      {showInitiativeStrip && (initiativeStrip?.battleStarted || battleStateStarted) && initiativeStrip?.enabled && (initiativeStrip.items?.length > 0) ? (
        <Box sx={{ position: 'absolute', bottom: 16, left: 16, px: 1, py: 0.75, bgcolor: 'rgba(0, 0, 0, 0)', borderRadius: 1, display: 'flex', alignItems: 'end', gap: 1 }}>
          {initiativeStrip.items.slice(0, 10).map((it) => {
            const isCurrent = initiativeStrip.currentTurnId === it.id;
            const sz = isCurrent ? 100 : 24;
            const borderColor = it.role === 'foe' ? '#f44336' : '#4caf50';
            return (
              <Box key={it.id} sx={{ display: 'flex', alignItems: 'end', bgcolor: 'rgba(0, 0, 0, 0.56)', borderRadius: 4, gap: 0.5 }}>
                {it.imageUrl ? (
                  <Box
                    sx={{
                      width: sz,
                      height: sz,
                      borderRadius: 4,
                      border: `3px solid ${borderColor}`,
                      overflow: 'hidden',
                    }}
                  >
                    <AuthImage
                      src={it.imageUrl}
                      alt={it.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ width: sz, height: sz, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.15)', border: `3px solid ${borderColor}` }} />
                )}
                <Typography variant="caption" color="white" noWrap sx={{ maxWidth: 120 }}>{it.name}</Typography>
              </Box>
            );
          })}
        </Box>
      ) : null}

      {/* Skyline Item Overlays - rendered in order, stacked on top of everything */}
      {activeOverlay === 'shopItem' && skylineItems.map((item) => {
        const token = localStorage.getItem('access_token');
        const streamUrl = getCellStreamUrl(item.cellId);
        const fullUrl = `${streamUrl}?token=${token}`;
        
        return (
          <Box 
            key={item.id}
            sx={{ 
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '80vw',
              maxHeight: '80vh',
              zIndex: 1000 + item.order, // Ensure items are on top, ordered by their order field
            }}
          >
            <AuthImage
              src={fullUrl}
              alt={item.label || 'Shop item'}
              style={{ 
                width: 'auto', 
                height: 'auto',
                maxWidth: '80vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
};

const StackedCharacterOverlay: React.FC<{ src?: string; initials: string; bg: string }> = ({ src, initials, bg }) => {
  const size = '60vh';
  return (
    <Box sx={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      {src ? (
        <Box sx={{ width: size, height: size, overflow: 'hidden', border: 'none', bgcolor: 'transparent' }}>
          <AuthImage
            src={src}
            alt={initials}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', display: 'block' }}
          />
        </Box>
      ) : (
        <Avatar
          alt={initials}
          sx={{ width: size, height: size, borderRadius: 2, border: '2px solid rgba(255,255,255,0.4)', boxShadow: 6, bgcolor: bg, fontSize: 64 }}
        >
          {initials}
        </Avatar>
      )}
    </Box>
  );
};

export default ProjectionSkylinePage;