import React, { useCallback, useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AuthImage from '../components/common/AuthImage';
import { getMapImageUrlSized, listMaps, listMapMarkers, MapMarkerDto } from '../api/maps';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../components/player/TimeOfDayContext';
import MapGridOverlay, { GridSettings } from '../components/Map/MapGridOverlay';
import FogOfWarOverlay from '../components/Map/FogOfWarOverlay';
import OrganicFogOverlay from '../components/Map/OrganicFogOverlay';
import { useFogOfWar } from '../hooks/useFogOfWar';
import { useOrganicFog } from '../hooks/useOrganicFog';
import { getGridOverlaySettings } from '../api/campaigns/gridOverlay';
import { getFogOfWarSettings } from '../api/campaigns/fogOfWar';
import type { FogMode } from '../api/campaigns/fogOfWar';
import { getCampaignBattleStatePublic } from '../api/campaigns/battleState';
import { useMapTokens } from '../hooks/useMapTokens';
import MapTokensOverlay from '../components/Map/MapTokensOverlay';
import ChromaKeyMedia from '../components/common/ChromaKeyMedia';
import { computeClearedFogByAllies, subtractClearedFog, computeAllyRevealStrokes, computeLightRevealStrokes, computeClearedFogByLights } from '../utils/fogHelpers';
import { useTokenImageResolver } from '../hooks/useTokenImageResolver';
import { useMapElements } from '../hooks/useMapElements';
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
import type { SceneRuntimeCommand } from '../types/scenes';

/** Parses campaignId from any URL form (search string or hash-router query). */
function parseCampaignIdFromUrl(): string | null {
  let cid = new URLSearchParams(window.location.search).get('campaignId');
  if (!cid) {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx !== -1) cid = new URLSearchParams(hash.slice(qIdx)).get('campaignId');
  }
  return cid;
}

type ShortcutFilterOverlay = {
  id: string;
  filter: string;
  color?: string;
  intensity?: number;
  layerOrder?: number;
};

/** Resolves relative backend media paths into absolute URLs for projection windows. */
function resolveSceneMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('/')) {
    return `${window.location.protocol}//${window.location.hostname}:3000${rawUrl}`;
  }
  return `${window.location.protocol}//${window.location.hostname}:3000/${rawUrl}`;
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
}

const ProjectionMapPage: React.FC = () => {
  const { activeMapId, refreshFromServer } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { setActiveCampaignId, activeCampaign } = useActiveCampaign();
  // Parsed synchronously so it's available before activeCampaign loads from the API.
  const rawCampaignId = React.useRef<string | null>(parseCampaignIdFromUrl()).current;
  const KEY_SIZE = 'app.projection.size';
  const [activeTransform, setActiveTransform] = useState<{ zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number } | null>(null);
  const [gridSettings, setGridSettings] = useState<GridSettings>({ enabled: false, type: 'square', cellSize: 40, color: '#FFFFFF', opacity: 0.4, lineWidth: 1 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const { cells } = useFogOfWar(activeCampaign?.id, activeMapId || undefined, gridSettings);
  const { strokes: organicStrokes } = useOrganicFog(activeCampaign?.id, activeMapId || undefined);
  const [fogMode, setFogMode] = useState<FogMode>(() => {
    try { const v = localStorage.getItem('app.map.fogMode'); return v === 'organic' ? 'organic' : 'grid'; } catch { return 'grid'; }
  });
  const [fogEnabled, setFogEnabled] = useState<boolean>(false);
  const [forceFogByDefault, setForceFogByDefault] = useState<boolean>(false);
  const { tokens } = useMapTokens(activeCampaign?.id, activeMapId || undefined);
  const { elements } = useMapElements(activeCampaign?.id, activeMapId || undefined);
  const { resolver: tokenImageResolver } = useTokenImageResolver(activeCampaign?.id, { pollMs: 5000 });
  const sceneClockSync = useSceneClockSync({ enabled: true, pollMs: 60000 });
  const sceneBaseClockOffsetRef = React.useRef<number>(0);
  const sceneClockSyncStateRef = React.useRef(sceneClockSync);
  useEffect(() => {
    sceneBaseClockOffsetRef.current = sceneClockSync.clockOffsetMs;
  }, [sceneClockSync.clockOffsetMs]);
  useEffect(() => {
    sceneClockSyncStateRef.current = sceneClockSync;
  }, [sceneClockSync]);

  // ─── Visible markers ─────────────────────────────────────────────────
  const [visibleMarkers, setVisibleMarkers] = useState<MapMarkerDto[]>([]);

  const loadVisibleMarkers = useCallback(async () => {
    if (!activeMapId || !activeCampaign?.id) { setVisibleMarkers([]); return; }
    try {
      const all = await listMapMarkers(activeMapId, activeCampaign.id);
      setVisibleMarkers(all.filter(m => m.visibleToPlayers));
    } catch { setVisibleMarkers([]); }
  }, [activeMapId, activeCampaign?.id]);

  useEffect(() => {
    loadVisibleMarkers();
    const id = window.setInterval(loadVisibleMarkers, 5000);
    return () => window.clearInterval(id);
  }, [loadVisibleMarkers]);

  // Initialize synchronously from localStorage so the correct turn is highlighted from frame 1.
  // useSkylineInitiativeSync writes 'app.skyline.initiativeStrip' synchronously on every turn change,
  // so this is always fresher than anything the server could return.
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('app.skyline.initiativeStrip');
      if (!raw) return null;
      const strip = JSON.parse(raw);
      if (strip?.campaignId !== parseCampaignIdFromUrl()) return null;
      if (!strip?.battleStarted) return null;
      return typeof strip.currentTurnId === 'string' ? strip.currentTurnId : null;
    } catch { return null; }
  });
  const [battleStateItems, setBattleStateItems] = useState<Array<{ id: string; name: string; imageUrl: string | null }>>([]);
  const [allyClearRadius, setAllyClearRadius] = useState<number>(() => {
    try { const raw = localStorage.getItem('app.map.allyClearRadius'); const n = raw ? parseInt(raw, 10) : 1; return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 1; } catch { return 1; }
  });
  const [shortcutTextOverlay, setShortcutTextOverlay] = useState<NarrativeTextOverlay | null>(null);
  const shortcutTextExecutionIdRef = React.useRef<string | null>(null);
  const [shortcutFilterOverlays, setShortcutFilterOverlays] = useState<ShortcutFilterOverlay[]>([]);
  const [shortcutVideoOverlays, setShortcutVideoOverlays] = useState<TimedVideoOverlay[]>([]);
  const shortcutTextTimeoutRef = React.useRef<number | null>(null);
  const narrationHandlesByExecutionRef = React.useRef<Map<string, Set<NarratorPlaybackHandle>>>(new Map());
  const shortcutVideoTimeoutsRef = React.useRef<Map<string, number>>(new Map());
  const shortcutFilterTimeoutsRef = React.useRef<Map<string, number>>(new Map());
  const introPlayedActionsByExecutionRef = React.useRef<Map<string, Set<string>>>(new Map());
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
  const sceneCommandDedupRef = React.useRef<Set<string>>(new Set());
  const sceneCommandDedupOrderRef = React.useRef<string[]>([]);
  const sceneClockOffsetByExecutionRef = React.useRef<Map<string, number>>(new Map());
  const sceneExecutionOrderRef = React.useRef<string[]>([]);
  const sceneSkewSamplesRef = React.useRef<number[]>([]);
  const [sceneSyncDiagnosticsVisible] = useState<boolean>(() => {
    try { return localStorage.getItem('app.sceneSync.showDiagnostics') === 'true'; } catch { return false; }
  });

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

  // Keep a ref to the effective campaign ID for use inside stable BC handler closures.
  // Initialized from the URL immediately (before activeCampaign loads from API) so that
  // BroadcastChannel messages are never dropped due to a late-loading context.
  const campaignIdRef = React.useRef<string | null | undefined>(rawCampaignId);
  useEffect(() => { campaignIdRef.current = activeCampaign?.id ?? rawCampaignId; }, [activeCampaign?.id]);
  const activeMapIdRef = React.useRef<string | null>(activeMapId);
  useEffect(() => { activeMapIdRef.current = activeMapId; }, [activeMapId]);
  const forceFogByDefaultRef = React.useRef<boolean>(false);
  useEffect(() => { forceFogByDefaultRef.current = forceFogByDefault; }, [forceFogByDefault]);
  // Set to non-zero if we already have live data from localStorage or BC.
  // The server poll will NEVER override currentTurnId once this is set.
  const lastBcTurnUpdateRef = React.useRef<number>((() => {
    // If we initialized from localStorage above, consider it as having received live data.
    try {
      const raw = localStorage.getItem('app.skyline.initiativeStrip');
      if (raw) {
        const strip = JSON.parse(raw);
        if (strip?.campaignId === parseCampaignIdFromUrl() && strip?.battleStarted) return 1;
      }
    } catch {}
    return 0;
  })());

  // Load FoW settings from server so this web window matches Electron even across origins.
  useEffect(() => {
    const scheduledTimerIds = new Set<number>();
    const executionTimerIdsRef = new Map<string, Set<number>>();
    const executionVideoOverlayKeysRef = new Map<string, Set<string>>();
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
        console.debug('[scene-sync][map][stats]', { count: samples.length, p50, p95 });
      }
    };

    const getLateExecutionPolicy = (command: SceneRuntimeCommand, durationMs?: number): { dropIfLateOverMs?: number } => {
      if (command.kind === 'window.applyFilter' || command.kind === 'window.clearFilter') {
        return {};
      }

      const fallbackDurationMs = command.kind === 'window.sendVideo' ? 6000 : 6000;
      const effectiveDurationMs = Number.isFinite(durationMs)
        ? Number(durationMs)
        : fallbackDurationMs;

      if (command.kind === 'window.sendVideo' || command.kind === 'narrative.setText') {
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
            console.debug('[scene-sync][map][drop-late]', label, { target, skewMs, receiveDeltaMs });
          }
          return;
        }
        if (import.meta.env.DEV && skewMs > SKEW_WARN_MS) {
          console.debug('[scene-sync][map][late]', label, { target, skewMs, receiveDeltaMs });
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
          console.debug('[scene-sync][map]', label, { target, skewMs, receiveDeltaMs });
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

    const registerExecutionVideoOverlayKey = (executionId: string | undefined, overlayKey: string) => {
      if (!executionId) return;
      const keys = executionVideoOverlayKeysRef.get(executionId) ?? new Set<string>();
      keys.add(overlayKey);
      executionVideoOverlayKeysRef.set(executionId, keys);
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

    const handleWindowShortcutAction = (
      payload: { action?: ShortcutActionDefinition } | ShortcutActionDefinition,
    ) => {
      const sceneCommand = parseSceneRuntimeCommand(payload);
      if (sceneCommand?.targetWindow && sceneCommand.targetWindow.kind !== 'projection') {
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
        registerExecutionVideoOverlayKey(sceneCommand.executionId, overlayKey);
        const loop = Boolean(body.loop);
        const muted = body.muted === undefined ? true : Boolean(body.muted);
        const opacity = Math.max(0, Math.min(1, Number(body.opacity ?? 1)));
        const chromaKey = parseChromaKey(body.chromaKey);
        const leftPct = clampFreePlacement(body.leftPct ?? 10, 10);
        const topPct = clampFreePlacement(body.topPct ?? 10, 10);
        const widthPct = clampFreeSize(body.widthPct ?? 80, 80);
        const heightPct = clampFreeSize(body.heightPct ?? 80, 80);
        const layerOrder = Number.isFinite(Number(body.layerOrder)) ? Math.round(Number(body.layerOrder)) : 0;
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
          clearShortcutTextOverlay();
        }
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
      if (action.kind !== 'window.showText' && action.kind !== 'window.applyFilter' && action.kind !== 'window.clearFilter') {
        return;
      }
      const body = (action.payload ?? (action as any).config ?? {}) as Record<string, unknown>;

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
    };

    const unsubscribe = window.electronAPI?.onShortcutWindowAction?.((payload: any) => {
      handleWindowShortcutAction(payload);
    });

    const browserEventHandler = (event: Event) => {
      const custom = event as CustomEvent<{ action?: ShortcutActionDefinition } | ShortcutActionDefinition>;
      handleWindowShortcutAction(custom.detail);
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
      introPlayedActionsByExecutionRef.current.clear();
      sceneCommandDedupRef.current.clear();
      sceneCommandDedupOrderRef.current = [];
      sceneClockOffsetByExecutionRef.current.clear();
      sceneExecutionOrderRef.current = [];
      sceneSkewSamplesRef.current = [];
      clearShortcutTextOverlay();
      clearShortcutVideoOverlay();
      shortcutFilterTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
      shortcutFilterTimeoutsRef.current.clear();
      shortcutVideoTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
      shortcutVideoTimeoutsRef.current.clear();
      narrationHandlesByExecutionRef.current.forEach((handles) => {
        handles.forEach((handle) => handle.stop());
      });
      narrationHandlesByExecutionRef.current.clear();
      clearWarmupCache();
    };
  }, [clearWarmupCache, preloadVideoForOverlay, releaseOverlayVideo]);

  const shortcutFilterStyle = React.useMemo(() => {
    if (!shortcutFilterOverlays.length) return undefined;
    return shortcutFilterOverlays
      .slice()
      .sort((left, right) => (left.layerOrder ?? 100) - (right.layerOrder ?? 100) || left.id.localeCompare(right.id))
      .map((overlay) => ({
      position: 'absolute' as const,
      inset: 0,
      zIndex: 9000 + (overlay.layerOrder ?? 100),
      pointerEvents: 'none' as const,
      ...buildWindowFilterBackdropStyle(overlay.filter, overlay.intensity, overlay.color),
    }));
  }, [shortcutFilterOverlays]);

  // Load FoW settings from server so this web window matches Electron even across origins.
  useEffect(() => {
    let cancelled = false;
    const apply = async () => {
      try {
        if (!activeCampaign?.id) return;
        const s = await getFogOfWarSettings(activeCampaign.id);
        if (cancelled) return;
        const v = Number.isFinite(s?.allyClearRadius as any) ? Math.max(0, Math.min(10, Math.floor(Number((s as any).allyClearRadius)))) : 1;
        setAllyClearRadius(v);
        try { localStorage.setItem('app.map.allyClearRadius', String(v)); } catch {}
        // Sync fogMode
        if (s?.fogMode === 'organic' || s?.fogMode === 'grid') {
          setFogMode(s.fogMode);
          try { localStorage.setItem('app.map.fogMode', s.fogMode); } catch {}
        }
      } catch {
        // ignore
      }
    };
    apply();
    const id = window.setInterval(apply, 2000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [activeCampaign?.id]);

  // React to radius updates from preview or other tabs; also react to initiative strip changes
  useEffect(() => {
    const FOG_ENABLED_KEY = 'app.map.fog.enabled';
    const KEY = 'app.map.allyClearRadius';
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n)) setAllyClearRadius(Math.max(0, Math.min(10, n)));
      }
    } catch {}
    try {
      const cid = campaignIdRef.current;
      const mid = activeMapIdRef.current;
      const raw = localStorage.getItem(FOG_ENABLED_KEY);
      if (cid && mid && raw) {
        const obj = JSON.parse(raw);
        const v = obj?.[`${cid}:${mid}`];
        if (typeof v === 'boolean') setFogEnabled(v);
      }
    } catch {}
    // Also load fogMode from localStorage on mount
    try {
      const lm = localStorage.getItem('app.map.fogMode');
      if (lm === 'organic' || lm === 'grid') setFogMode(lm);
    } catch {}
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === KEY && ev.newValue) {
        const n = parseInt(ev.newValue, 10);
        if (Number.isFinite(n)) setAllyClearRadius(Math.max(0, Math.min(10, n)));
      }
      if (ev.key === 'app.map.fogMode' && ev.newValue) {
        if (ev.newValue === 'organic' || ev.newValue === 'grid') setFogMode(ev.newValue);
      }
      if (ev.key === FOG_ENABLED_KEY && ev.newValue) {
        try {
          const cid = campaignIdRef.current;
          const mid = activeMapIdRef.current;
          if (!cid || !mid) return;
          const obj = JSON.parse(ev.newValue);
          const v = obj?.[`${cid}:${mid}`];
          if (typeof v === 'boolean') {
            if (forceFogByDefaultRef.current && !v) {
              setFogEnabled(true);
            } else {
              setFogEnabled(v);
            }
          }
        } catch {}
      }
      // React to initiative strip written by useSkylineInitiativeSync (cross-window via storage event)
      if (ev.key === 'app.skyline.initiativeStrip' && ev.newValue) {
        try {
          const strip = JSON.parse(ev.newValue);
          if (strip?.campaignId && strip.campaignId === campaignIdRef.current) {
            lastBcTurnUpdateRef.current = Date.now();
            if (!strip.battleStarted) {
              setCurrentTurnId(null);
            } else if (typeof strip.currentTurnId === 'string' || strip.currentTurnId === null) {
              setCurrentTurnId(strip.currentTurnId ?? null);
            }
            if (Array.isArray(strip.items)) {
              setBattleStateItems(strip.items.map((x: any) => ({ id: x.id, name: x.name || '', imageUrl: x.imageUrl ?? null })));
            }
          }
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      bc.addEventListener('message', (e: MessageEvent) => {
        const data = e?.data;
        if (data?.type === 'ally-clear-radius-updated') {
          const v = data?.value;
          if (Number.isFinite(v)) setAllyClearRadius(Math.max(0, Math.min(10, Number(v))));
        }
        if (data?.type === 'fog-mode-updated') {
          if (data?.fogMode === 'organic' || data?.fogMode === 'grid') setFogMode(data.fogMode);
        }
        if (data?.type === 'fog-enabled-updated') {
          const cid = campaignIdRef.current;
          const mid = activeMapIdRef.current;
          if (data?.campaignId === cid && data?.mapId === mid && typeof data?.fogEnabled === 'boolean') {
            if (forceFogByDefaultRef.current && !data.fogEnabled) {
              setFogEnabled(true);
            } else {
              setFogEnabled(data.fogEnabled);
            }
          }
        }
        // React to turn changes broadcast by useSkylineInitiativeSync / applyTurnNav
        if (data?.type === 'initiativeStripUpdated' && data?.campaignId === campaignIdRef.current) {
          lastBcTurnUpdateRef.current = Date.now();
          if (!data.battleStarted) {
            setCurrentTurnId(null);
          } else if (typeof data.currentTurnId === 'string' || data.currentTurnId === null) {
            setCurrentTurnId(data.currentTurnId ?? null);
          }
          if (Array.isArray(data.items)) {
            setBattleStateItems(data.items.map((x: any) => ({ id: x.id, name: x.name || '', imageUrl: x.imageUrl ?? null })));
          }
        }
      });
    } catch {}
    return () => { window.removeEventListener('storage', onStorage); try { bc?.close(); } catch {} };
  }, []);

  // Compute fog after clearing around allied tokens and active lights
  const effectiveFogCells = React.useMemo(() => {
    try {
      const mapW = naturalSize?.w || 0;
      const mapH = naturalSize?.h || 0;
      const cleared = computeClearedFogByAllies(gridSettings, tokens || [], allyClearRadius, elements, timeOfDay, mapW, mapH);
      const lightCleared = computeClearedFogByLights(gridSettings, elements, timeOfDay, mapW, mapH);
      const combined = new Set([...cleared, ...lightCleared]);
      return subtractClearedFog(cells, combined);
    } catch {
      return cells;
    }
  }, [cells, tokens, gridSettings, allyClearRadius, elements, timeOfDay, naturalSize]);

  // Compute organic fog strokes with ally-clearing and light reveal circles appended
  const effectiveOrganicStrokes = React.useMemo(() => {
    const mapW = naturalSize?.w || 0;
    const mapH = naturalSize?.h || 0;
    const allyReveals = computeAllyRevealStrokes(gridSettings, tokens || [], allyClearRadius, mapW, mapH, elements, timeOfDay);
    const lightReveals = computeLightRevealStrokes(elements, timeOfDay, mapW, mapH);
    const extra = [...allyReveals, ...lightReveals];
    if (extra.length === 0) return organicStrokes;
    return [...organicStrokes, ...extra];
  }, [organicStrokes, tokens, gridSettings, allyClearRadius, naturalSize, elements, timeOfDay]);

  const visibleTokensForLabels = React.useMemo(() => {
    return (tokens || []).filter((t) => !effectiveFogCells.has(t.cellKey));
  }, [tokens, effectiveFogCells]);

  // Current turn highlight (poll campaign battle state; projection-safe public endpoint)
  useEffect(() => {
    let disposed = false;
    const tick = async () => {
      if (disposed) return;
      const cid = activeCampaign?.id ?? rawCampaignId;
      try {
        if (!cid) {
          setCurrentTurnId(null);
          setBattleStateItems([]);
          return;
        }
        const s = await getCampaignBattleStatePublic(cid);
        if (disposed) return;
        // Only trust the server poll for the initial state (when no BC/localStorage data
        // has been received yet). Once live data arrives via BC or localStorage,
        // the server is permanently bypassed for currentTurnId — it is always stale
        // relative to the synchronous localStorage writes from useSkylineInitiativeSync.
        if (lastBcTurnUpdateRef.current === 0) {
          setCurrentTurnId(typeof s?.currentTurnId === 'string' ? s.currentTurnId : null);
          setBattleStateItems(Array.isArray(s?.items) ? s.items : []);
        }
      } catch {
        // ignore
      }
    };
    tick();
    const id = window.setInterval(tick, 800);
    return () => { disposed = true; window.clearInterval(id); };
  }, [activeCampaign?.id]);

  const highlightIds = React.useMemo(() => {
    if (!currentTurnId) return null;
    const token = (tokens || []).find(t => t.id === currentTurnId);
    if (!token) return null;
    // Do not highlight enemies that are currently covered by fog.
    const coveredByFog = effectiveFogCells.has(token.cellKey);
    if (token.type === 'enemy' && coveredByFog) return null;
    return new Set([currentTurnId]);
  }, [currentTurnId, tokens, effectiveFogCells]);

  // Build a map of participant ID -> imageUrl from battle state (active combat participants)
  const battleParticipantImageMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of battleStateItems) {
      if (item.imageUrl) {
        map.set(item.id, item.imageUrl);
      }
    }
    return map;
  }, [battleStateItems]);

  // Enhanced token resolver: first check battle participants (active combat), then fallback to character/monster bestiary
  const enhancedTokenImageResolver = React.useCallback((tokenId: string): string | undefined => {
    // Priority 1: Check if this token is a participant in active combat (battle state)
    const battleImage = battleParticipantImageMap.get(tokenId);
    if (battleImage) return battleImage;
    // Priority 2: Fallback to character/monster bestiary resolver
    return tokenImageResolver(tokenId);
  }, [battleParticipantImageMap, tokenImageResolver]);

  // Sync the parsed campaign ID into the shared context so other hooks (FoW, tokens, etc.) can use it.
  useEffect(() => {
    if (rawCampaignId) {
      // eslint-disable-next-line no-console
      console.log('[Projection] parsed campaignId from URL', { cid: rawCampaignId, href: window.location.href });
      setActiveCampaignId(rawCampaignId);
    }
  }, [setActiveCampaignId]);

  // Nota: dejamos de usar override por IPC. La proyección sigue el activeMapId sincronizado con servidor.

  // Debug: log changes to diagnose mismatches
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[Projection] state', { activeMapId, timeOfDay });
  }, [activeMapId, timeOfDay]);

  // Listen to electron projection-poke to refresh immediately (when available)
  useEffect(() => {
    try {
      const dispose = window.electronAPI?.onProjectionPoke?.(async () => {
        await refreshFromServer();
      });
      return () => { if (typeof dispose === 'function') dispose(); };
    } catch {}
  }, [refreshFromServer]);

  // Load transform for active map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!activeMapId) { setActiveTransform(null); return; }
        const maps = await listMaps({ campaignId: activeCampaign?.id });
        const m = maps.find(x => x.id === activeMapId);
        if (!cancelled) setActiveTransform((m as any)?.transform || null);
      } catch { if (!cancelled) setActiveTransform(null); }
    })();
    return () => { cancelled = true; };
  }, [activeMapId, activeCampaign?.id]);

  // Resolve fog enabled state for current map:
  // If map has fogEnabledByDefault=true, fog is always forced ON.
  // Otherwise runtime override from localStorage is used.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cid = activeCampaign?.id;
      const mid = activeMapId;
      if (!cid || !mid) {
        if (!cancelled) setForceFogByDefault(false);
        if (!cancelled) setFogEnabled(false);
        return;
      }
      try {
        const maps = await listMaps({ campaignId: cid });
        if (cancelled) return;
        const current = maps.find((m) => m.id === mid);
        const forceDefault = !!current?.fogEnabledByDefault;
        setForceFogByDefault(forceDefault);
        if (forceDefault) {
          setFogEnabled(true);
          return;
        }
      } catch {
        if (!cancelled) setForceFogByDefault(false);
      }

      const storageKey = 'app.map.fog.enabled';
      const scopedKey = `${cid}:${mid}`;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const obj = JSON.parse(raw);
          const v = obj?.[scopedKey];
          if (typeof v === 'boolean') {
            if (!cancelled) setFogEnabled(v);
            return;
          }
        }
      } catch {}
      if (!cancelled) setFogEnabled(false);
    })();
    return () => { cancelled = true; };
  }, [activeCampaign?.id, activeMapId]);

  // Reset natural size on map change so stale dimensions don't linger
  useEffect(() => { setNaturalSize(null); }, [activeMapId, timeOfDay]);

  // Grid settings: load from server, mirror to localStorage, and react to storage/broadcast updates
  useEffect(() => {
    const KEY = 'app.map.grid.settings';
    let cancelled = false;
    // Load from server for cross-device sync
    (async () => {
      try {
        if (!activeCampaign?.id) return;
        const srv = await getGridOverlaySettings(activeCampaign.id);
        if (cancelled) return;
        setGridSettings(srv);
        try { localStorage.setItem(KEY, JSON.stringify(srv)); } catch {}
      } catch {
        // Fallback to localStorage on error
        try {
          const raw = localStorage.getItem(KEY);
          if (raw) setGridSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
        } catch {}
      }
    })();
    // Initial from localStorage if present (helps first paint)
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setGridSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {}
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === KEY && ev.newValue) {
        try { const parsed = JSON.parse(ev.newValue); setGridSettings((prev) => ({ ...prev, ...parsed })); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      bc.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type === 'map-grid-updated') {
          try {
            const raw = localStorage.getItem(KEY);
            if (raw) setGridSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
          } catch {}
        }
      });
    } catch {}
    return () => { cancelled = true; window.removeEventListener('storage', onStorage); try { bc?.close(); } catch {} };
  }, [activeCampaign?.id]);

  // Periodically refresh from server to catch updates coming from other devices (pure web)
  useEffect(() => {
    let disposed = false;
    const KEY = 'app.map.grid.settings';
    const tick = async () => {
      if (disposed) return;
      try {
        if (!activeCampaign?.id) return;
        const srv = await getGridOverlaySettings(activeCampaign.id);
        if (disposed) return;
        setGridSettings((prev) => {
          const changed = JSON.stringify(prev) !== JSON.stringify(srv);
          if (changed) {
            try { localStorage.setItem(KEY, JSON.stringify(srv)); } catch {}
          }
          return changed ? srv : prev;
        });
      } catch {}
    };
    const id = window.setInterval(tick, 2000);
    return () => { disposed = true; window.clearInterval(id); };
  }, [activeCampaign?.id]);

  // Periodically refresh fog from server (pure web) to avoid manual reloads
  useEffect(() => {
    let disposed = false;
    const STORAGE_KEY = 'app.map.fog.cells';
    const tick = async () => {
      if (disposed) return;
      try {
        if (!activeCampaign?.id || !activeMapId) return;
        const startedAt = Date.now();
        // If a local push is pending (from another tab), skip applying server to avoid flicker
        const pendingPush = localStorage.getItem('app.fog.pendingPush') === '1';
        if (pendingPush) return;
        const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/maps/${activeMapId}/fog?campaignId=${activeCampaign.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverCells: string[] = Array.isArray(data?.cells) ? data.cells : [];
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
        const keyId = `${activeCampaign.id}:${activeMapId}`;
        const localArr = obj[keyId] || [];
        const lastLocalUpdate = Number(localStorage.getItem('app.lastFogUpdate') || '0');
        if (lastLocalUpdate > startedAt) {
          // A newer local change occurred while polling; skip applying server state
          return;
        }
        const serverJson = JSON.stringify(serverCells);
        const localJson = JSON.stringify(localArr);
        if (serverJson !== localJson) {
          obj[keyId] = serverCells;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch {}
          try { localStorage.setItem('app.lastFogUpdate', String(Date.now())); } catch {}
          try {
            const bc = new BroadcastChannel('campaign-sync');
            bc.postMessage({ type: 'map-fog-updated', campaignId: activeCampaign.id, mapId: activeMapId, cells: serverCells, at: Date.now() });
            bc.close();
          } catch {}
        }
      } catch {}
    };
    const id = window.setInterval(tick, 2000);
    return () => { disposed = true; window.clearInterval(id); };
  }, [activeCampaign?.id, activeMapId]);

  // Periodically refresh organic fog from server (pure web)
  useEffect(() => {
    let disposed = false;
    const OF_STORAGE_KEY = 'app.map.organicFog.strokes';
    const tick = async () => {
      if (disposed) return;
      try {
        if (!activeCampaign?.id || !activeMapId) return;
        const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/maps/${activeMapId}/organic-fog?campaignId=${activeCampaign.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverStrokes = Array.isArray(data?.strokes) ? data.strokes : [];
        const raw = localStorage.getItem(OF_STORAGE_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        const keyId = `${activeCampaign.id}:${activeMapId}`;
        const localJson = JSON.stringify(obj[keyId] || []);
        const serverJson = JSON.stringify(serverStrokes);
        if (serverJson !== localJson) {
          obj[keyId] = serverStrokes;
          try { localStorage.setItem(OF_STORAGE_KEY, JSON.stringify(obj)); } catch {}
          try { localStorage.setItem('app.lastOrganicFogUpdate', String(Date.now())); } catch {}
          try {
            const bc = new BroadcastChannel('campaign-sync');
            bc.postMessage({ type: 'map-organic-fog-updated', campaignId: activeCampaign.id, mapId: activeMapId, strokes: serverStrokes, at: Date.now() });
            bc.close();
          } catch {}
        }
      } catch {}
    };
    const id = window.setInterval(tick, 2000);
    return () => { disposed = true; window.clearInterval(id); };
  }, [activeCampaign?.id, activeMapId]);

  // React to external transform updates via BroadcastChannel and electron poke
  useEffect(() => {
    let disposed = false;
    const refreshTransform = async () => {
      if (disposed) return;
      try {
        if (!activeMapId) return;
        const maps = await listMaps({ campaignId: activeCampaign?.id });
        const m = maps.find(x => x.id === activeMapId);
        setActiveTransform((m as any)?.transform || null);
      } catch {}
    };
    try {
      const bc = new BroadcastChannel('campaign-sync');
      const onMsg = (e: MessageEvent) => {
        const data = e.data || {};
        if (data?.type === 'map-transform-updated') {
          refreshTransform();
        }
      };
      bc.addEventListener('message', onMsg);
      const cleanup = () => { bc.removeEventListener('message', onMsg); bc.close(); };
      // Also hook into electron poke to refresh
      const disposePoke = window.electronAPI?.onProjectionPoke?.(refreshTransform);
      // Fallback: listen to storage pings
      const onStorage = (ev: StorageEvent) => {
        if (ev.key === 'app.lastMapTransformUpdate') refreshTransform();
      };
      window.addEventListener('storage', onStorage);
      return () => { disposed = true; cleanup(); if (typeof disposePoke === 'function') disposePoke(); window.removeEventListener('storage', onStorage); };
    } catch {
      // Fallback: listen only to electron poke
      const disposePoke = window.electronAPI?.onProjectionPoke?.(refreshTransform);
      return () => { disposed = true; if (typeof disposePoke === 'function') disposePoke(); };
    }
  }, [activeMapId, activeCampaign?.id]);

  // As safety net for cross-device updates in pure web, poll transform every 1s while projection is open
  useEffect(() => {
    let disposed = false;
    const tick = async () => {
      if (disposed) return;
      try {
        if (!activeMapId) return;
        const maps = await listMaps({ campaignId: activeCampaign?.id });
        const m = maps.find(x => x.id === activeMapId);
        const next = ((m as any)?.transform || null) as any;
        setActiveTransform(prev => {
          const changed = JSON.stringify(prev) !== JSON.stringify(next);
          return changed ? next : prev;
        });
      } catch {}
    };
    const id = window.setInterval(tick, 1000);
    return () => { disposed = true; window.clearInterval(id); };
  }, [activeMapId, activeCampaign?.id]);

  // Reportar tamaño de la ventana de proyección (Electron) y guardarlo en localStorage (Web también puede leerlo)
  useEffect(() => {
    // Medir el contenedor real de la imagen para mayor precisión
    const el = document.getElementById('projection-root');
    const report = () => {
      const rect = el?.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Para representar tamaño “lógico” (CSS px) mantenemos rect.width/height; si se desea absoluto físico, multiplicar por dpr.
      const payload = { width: Math.round(rect?.width || window.innerWidth), height: Math.round(rect?.height || window.innerHeight), dpr };
      try { window.electronAPI?.projectionReportSize?.(payload); } catch {}
      try { localStorage.setItem(KEY_SIZE, JSON.stringify(payload)); } catch {}
    };
    report();
    window.addEventListener('resize', report);
    return () => window.removeEventListener('resize', report);
  }, []);

  return (
    <Box id="projection-root" sx={{ width: '100vw', height: '100vh', bgcolor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {activeMapId ? (
        <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          {/* Shared transform layer so image and grid move together */}
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${activeTransform?.translateXPct ?? 0}%, ${activeTransform?.translateYPct ?? 0}%) rotate(${activeTransform?.rotationDeg ?? 0}deg) scale(${activeTransform?.zoom ?? 1})`,
              transformOrigin: 'center center',
            }}
          >
            <Box sx={{ position: 'relative', width: naturalSize?.w || 'auto', height: naturalSize?.h || 'auto' }}>
              <AuthImage
                src={getMapImageUrlSized(activeMapId, 'full', { timeOfDay, cacheBust: timeOfDay })}
                alt="Mapa proyectado"
                style={{ display: 'block' }}
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const w = img.naturalWidth || img.width;
                  const h = img.naturalHeight || img.height;
                  if (w && h) setNaturalSize({ w, h });
                }}
              />
              {gridSettings.enabled && (
                <MapGridOverlay settings={gridSettings} widthPx={naturalSize?.w} heightPx={naturalSize?.h} />
              )}
              {/* Tokens overlay (read-only in projection) */}
              {naturalSize?.w && naturalSize?.h && (
                <MapTokensOverlay
                  settings={gridSettings}
                  widthPx={naturalSize.w}
                  heightPx={naturalSize.h}
                  tokens={tokens}
                  editable={false}
                  renderLabel={false}
                  renderFacing={false}
                  highlightIds={highlightIds}
                  getTokenImage={(t) => enhancedTokenImageResolver(t.id)}
                />
              )}
              {/* Fog overlay (players: black) above everything to truly mask hidden areas */}
              {fogEnabled && fogMode === 'grid' && (
                <FogOfWarOverlay mode="players" grid={gridSettings} widthPx={naturalSize?.w} heightPx={naturalSize?.h} cells={effectiveFogCells} />
              )}
              {fogEnabled && fogMode === 'organic' && (
                <OrganicFogOverlay mode="players" widthPx={naturalSize?.w} heightPx={naturalSize?.h} strokes={effectiveOrganicStrokes} />
              )}

              {/* Labels + facing above fog, but only for visible tokens */}
              {naturalSize?.w && naturalSize?.h && visibleTokensForLabels.length > 0 && (
                <MapTokensOverlay
                  settings={gridSettings}
                  widthPx={naturalSize.w}
                  heightPx={naturalSize.h}
                  tokens={visibleTokensForLabels}
                  editable={false}
                  renderTokenBody={false}
                  renderLabel={true}
                  renderFacing={true}
                  zIndex={50}
                />
              )}

              {/* Visible markers overlay (above fog so players always see them) */}
              {naturalSize?.w && naturalSize?.h && visibleMarkers.length > 0 && (
                <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60 }}>
                  {visibleMarkers.map((m) => (
                    <Box
                      key={m.id}
                      sx={{
                        position: 'absolute',
                        left: `${m.x}%`,
                        top: `${m.y}%`,
                        transform: 'translate(-50%, -100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      <Paper elevation={4} sx={{
                        px: 0.75, py: 0.25, borderRadius: 2,
                        bgcolor: 'background.paper',
                        border: '2px solid', borderColor: 'primary.main',
                        minWidth: 32, textAlign: 'center', lineHeight: 1,
                      }}>
                        <Typography variant="body1" component="span" sx={{ fontSize: '1.25rem' }}>
                          {m.icon}
                        </Typography>
                      </Paper>
                      <Box sx={{ width: 2, height: 8, bgcolor: 'primary.main' }} />
                      <Typography variant="caption" sx={{
                        color: 'white',
                        textShadow: '0 0 4px black, 0 0 4px black',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        mt: 0.25,
                      }}>
                        {m.name}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {(shortcutFilterStyle ?? []).map((style, index) => (
            <Box key={index} sx={style} />
          ))}

          {shortcutVideoOverlays
            .slice()
            .sort((a, b) => a.layerOrder - b.layerOrder || a.createdAtMs - b.createdAtMs)
            .map((overlay, index) => (
              <Box
                key={overlay.key}
                sx={{
                  position: 'absolute',
                  left: `${overlay.leftPct}%`,
                  top: `${overlay.topPct}%`,
                  width: `${overlay.widthPct}%`,
                  height: `${overlay.heightPct}%`,
                  zIndex: 9000 + (overlay.layerOrder ?? 100),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
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
              </Box>
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
                      key={`map-text-seg-${index}`}
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
                minWidth: 230,
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                scene sync map
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
        </Box>
      ) : (
        <Typography variant="h4" color="white">Sin mapa activo</Typography>
      )}
    </Box>
  );
};

export default ProjectionMapPage;
