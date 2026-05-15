import React, { useCallback, useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
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
  const [shortcutTextOverlay, setShortcutTextOverlay] = useState<{ text: string; title?: string } | null>(null);
  const [shortcutFilterOverlay, setShortcutFilterOverlay] = useState<{ filter: string; color?: string; intensity?: number } | null>(null);
  const [shortcutVideoOverlay, setShortcutVideoOverlay] = useState<{
    src: string;
    loop: boolean;
    muted: boolean;
    opacity: number;
    chromaKey?: { enabled: boolean; color: string; tolerance: number };
    leftPct: number;
    topPct: number;
    widthPct: number;
    heightPct: number;
  } | null>(null);
  const shortcutTextTimeoutRef = React.useRef<number | null>(null);
  const shortcutVideoTimeoutRef = React.useRef<number | null>(null);
  const sceneCommandDedupRef = React.useRef<Set<string>>(new Set());
  const sceneCommandDedupOrderRef = React.useRef<string[]>([]);
  const sceneClockOffsetByExecutionRef = React.useRef<Map<string, number>>(new Map());
  const sceneExecutionOrderRef = React.useRef<string[]>([]);
  const sceneSkewSamplesRef = React.useRef<number[]>([]);
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
        const skewMs = (Date.now() + offsetMs) - target;
        recordSkew(skewMs);
        if (import.meta.env.DEV) {
          console.debug('[scene-sync][map]', label, { target, skewMs, receiveDeltaMs });
        }
        run();
      }, Math.max(0, delayMs));
      scheduledTimerIds.add(timerId);
    };

    const clearShortcutTextOverlay = () => {
      if (shortcutTextTimeoutRef.current !== null) {
        window.clearTimeout(shortcutTextTimeoutRef.current);
        shortcutTextTimeoutRef.current = null;
      }
      setShortcutTextOverlay(null);
    };

    const clearShortcutVideoOverlay = () => {
      if (shortcutVideoTimeoutRef.current !== null) {
        window.clearTimeout(shortcutVideoTimeoutRef.current);
        shortcutVideoTimeoutRef.current = null;
      }
      setShortcutVideoOverlay(null);
    };

    const setTimedShortcutTextOverlay = (next: { text: string; title?: string }, durationMs?: number) => {
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
      next: {
        src: string;
        loop: boolean;
        muted: boolean;
        opacity: number;
        chromaKey?: { enabled: boolean; color: string; tolerance: number };
        leftPct: number;
        topPct: number;
        widthPct: number;
        heightPct: number;
      },
      durationMs?: number,
    ) => {
      if (shortcutVideoTimeoutRef.current !== null) {
        window.clearTimeout(shortcutVideoTimeoutRef.current);
        shortcutVideoTimeoutRef.current = null;
      }
      setShortcutVideoOverlay(next);

      const ms = Number(durationMs);
      if (Number.isFinite(ms) && ms > 0) {
        shortcutVideoTimeoutRef.current = window.setTimeout(() => {
          setShortcutVideoOverlay(null);
          shortcutVideoTimeoutRef.current = null;
        }, ms);
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
        const loop = Boolean(body.loop);
        const muted = body.muted === undefined ? true : Boolean(body.muted);
        const opacity = Math.max(0, Math.min(1, Number(body.opacity ?? 1)));
        const chromaKey = parseChromaKey(body.chromaKey);
        const leftPct = Math.max(0, Math.min(100, Number(body.leftPct ?? 10)));
        const topPct = Math.max(0, Math.min(100, Number(body.topPct ?? 10)));
        const widthPct = Math.max(1, Math.min(100, Number(body.widthPct ?? 80)));
        const heightPct = Math.max(1, Math.min(100, Number(body.heightPct ?? 80)));
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          setTimedShortcutVideoOverlay(
            { src: resolveSceneMediaUrl(videoUrl), loop, muted, opacity, chromaKey, leftPct, topPct, widthPct, heightPct },
            durationMs,
          );
        }, 'window.sendVideo', getLateExecutionPolicy(sceneCommand, durationMs));
        return;
      }

      if (sceneCommand?.kind === 'narrative.setText') {
        const body = (sceneCommand.payload ?? {}) as Record<string, unknown>;
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!text) {
          clearShortcutTextOverlay();
          return;
        }
        const title = typeof body.title === 'string' ? body.title : undefined;
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          setTimedShortcutTextOverlay({ text, title }, durationMs);
        }, 'narrative.setText', getLateExecutionPolicy(sceneCommand, durationMs));
        return;
      }

      if (sceneCommand?.kind === 'window.clearFilter') {
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          setShortcutFilterOverlay(null);
        }, 'window.clearFilter');
        return;
      }

      if (sceneCommand?.kind === 'window.applyFilter') {
        const body = (sceneCommand.payload ?? {}) as Record<string, unknown>;
        const filter = typeof body.filter === 'string' ? body.filter : '';
        if (!filter) return;
        const color = typeof body.color === 'string' ? body.color : undefined;
        const intensity = typeof body.intensity === 'number' ? body.intensity : undefined;
        scheduleSceneExecution(sceneCommand, sceneCommand.executeAtMs, () => {
          setShortcutFilterOverlay({ filter, color, intensity });
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
        setShortcutFilterOverlay(null);
        return;
      }

      if (action.kind === 'window.applyFilter') {
        const filter = typeof body.filter === 'string' ? body.filter : '';
        if (!filter) return;
        const color = typeof body.color === 'string' ? body.color : undefined;
        const intensity = typeof body.intensity === 'number' ? body.intensity : undefined;
        setShortcutFilterOverlay({ filter, color, intensity });
        return;
      }

      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) return;
      const title = typeof body.title === 'string' ? body.title : undefined;
      const durationMs = typeof body.durationMs === 'number' ? body.durationMs : undefined;
      setTimedShortcutTextOverlay({ text, title }, durationMs);
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
      sceneCommandDedupRef.current.clear();
      sceneCommandDedupOrderRef.current = [];
      sceneClockOffsetByExecutionRef.current.clear();
      sceneExecutionOrderRef.current = [];
      sceneSkewSamplesRef.current = [];
      clearShortcutTextOverlay();
      clearShortcutVideoOverlay();
    };
  }, []);

  const shortcutFilterStyle = React.useMemo(() => {
    if (!shortcutFilterOverlay) return undefined;
    const name = shortcutFilterOverlay.filter.toLowerCase();
    const intensity = Math.max(0, Math.min(1, Number(shortcutFilterOverlay.intensity ?? 1)));
    const opacity = 0.08 + (0.32 * intensity);
    const color = shortcutFilterOverlay.color || 'transparent';

    const filterMap: Record<string, string> = {
      grayscale: `grayscale(${Math.round(intensity * 100)}%)`,
      sepia: `sepia(${Math.round(intensity * 100)}%)`,
      blur: `blur(${(intensity * 8).toFixed(1)}px)`,
      brightness: `brightness(${(0.6 + intensity).toFixed(2)})`,
      contrast: `contrast(${(1 + intensity).toFixed(2)})`,
      saturate: `saturate(${(1 + intensity * 1.5).toFixed(2)})`,
      hue: `hue-rotate(${Math.round(intensity * 180)}deg)`,
      hue_rotate: `hue-rotate(${Math.round(intensity * 180)}deg)`,
      invert: `invert(${Math.round(intensity * 100)}%)`,
    };

    const filterCss = filterMap[name] || '';
    return {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 7000,
      pointerEvents: 'none' as const,
      backdropFilter: filterCss || undefined,
      WebkitBackdropFilter: filterCss || undefined,
      backgroundColor: color === 'transparent' ? `rgba(0,0,0,${opacity.toFixed(3)})` : color,
      mixBlendMode: color === 'transparent' ? 'normal' as const : 'multiply' as const,
    };
  }, [shortcutFilterOverlay]);

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

          {shortcutFilterStyle ? <Box sx={shortcutFilterStyle} /> : null}

          {shortcutVideoOverlay ? (
            <Box
              sx={{
                position: 'absolute',
                left: `${shortcutVideoOverlay.leftPct}%`,
                top: `${shortcutVideoOverlay.topPct}%`,
                width: `${shortcutVideoOverlay.widthPct}%`,
                height: `${shortcutVideoOverlay.heightPct}%`,
                zIndex: 7800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChromaKeyMedia
                kind="video"
                src={shortcutVideoOverlay.src}
                autoPlay
                muted={shortcutVideoOverlay.muted}
                loop={shortcutVideoOverlay.loop}
                playsInline
                opacity={shortcutVideoOverlay.opacity}
                chromaKey={shortcutVideoOverlay.chromaKey}
                onVideoEnded={() => {
                  if (!shortcutVideoOverlay.loop) setShortcutVideoOverlay(null);
                }}
                onMediaError={() => setShortcutVideoOverlay(null)}
              />
            </Box>
          ) : null}

          {shortcutTextOverlay ? (
            <Box
              sx={{
                position: 'absolute',
                top: '10vh',
                left: '50%',
                transform: 'translateX(-50%)',
                maxWidth: '86vw',
                px: 2,
                py: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(0,0,0,0.62)',
                color: 'white',
                textAlign: 'center',
                zIndex: 8000,
                boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
              }}
            >
              {shortcutTextOverlay.title ? (
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                  {shortcutTextOverlay.title}
                </Typography>
              ) : null}
              <Typography variant="h5">{shortcutTextOverlay.text}</Typography>
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
