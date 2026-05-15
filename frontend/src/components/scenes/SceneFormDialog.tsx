import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Paper,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import UploadIcon from '@mui/icons-material/Upload';
import AuthImage from '../common/AuthImage';
import type { Scene, SceneActionDto, ScenePayload } from '../../types/scenes';
import type { SceneVideoAsset } from '../../types/scenes';
import { createSceneVideoSignedUrl, listSceneVideos, uploadSceneVideo } from '../../api/sceneVideos';
import { getMapImageUrlSized } from '../../api/maps';
import { useActiveMap } from '../Map/ActiveMapContext';
import { useTimeOfDay } from '../player/TimeOfDayContext';
import { useSecondaryWindowSizes, type WindowSize } from '../../hooks/useSecondaryWindowSizes';
import SkylineViewportContent from '../Skyline/SkylineViewportContent';
import ChromaKeyMedia from '../common/ChromaKeyMedia';
import SceneActionEditor from './SceneActionEditor';
import SceneTimelineEditor, { buildTimeline } from './SceneTimelineEditor';

const SCENE_MAX_ACTIONS = 48;
const WINDOW_ACTION_TYPES = new Set([
  'sendImageToWindow',
  'sendVideoToWindow',
  'setWindowBackground',
  'applyWindowFilter',
  'clearWindowFilter',
]);

type ScenePreviewWindowKind = 'main' | 'projection' | 'skyline';

const PROJECTION_SIZE_KEY = 'app.projection.size';
const SKYLINE_SIZE_KEY = 'app.projection.skyline.size';
const PREVIEW_FPS = 30;

function toPositiveDurationMs(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

function measureVideoDurationMs(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let finished = false;
    const timeoutId = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(undefined);
    }, 8000);

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      video.onloadedmetadata = null;
      video.onerror = null;
      window.clearTimeout(timeoutId);
    };

    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.onloadedmetadata = () => {
      if (finished) return;
      finished = true;
      const durationMs = toPositiveDurationMs(video.duration * 1000);
      cleanup();
      resolve(durationMs);
    };
    video.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(undefined);
    };
    video.src = url;
    video.load();
  });
}

function toNonNegativeMs(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

function emptyPayload(type: string): Record<string, unknown> {
  switch (type) {
    case 'playMusic':      return { songId: '', loop: false, volume: 80 };
    case 'stopMusic':      return { stopEffects: false };
    case 'playSound':      return { effectId: '', volume: 80, loopMode: 'once' };
    case 'setMusicVolume': return { value: 80 };
    case 'sendImageToWindow': return { imageUrl: '', title: '', opacity: 1, leftPct: 10, topPct: 10, widthPct: 80, heightPct: 80 };
    case 'sendVideoToWindow': return { loop: false, muted: false, opacity: 1, leftPct: 10, topPct: 10, widthPct: 80, heightPct: 80 };
    case 'setWindowBackground': return { imageUrl: '', sizing: 'cover' };
    case 'applyWindowFilter': return { filter: 'blur', intensity: 0.5, color: '' };
    case 'clearWindowFilter': return {};
    case 'setWeather':     return { preset: 'rain', intensity: 0.5, durationMs: 0 };
    case 'setNarrativeText': return { text: '', title: '', durationMs: 0 };
    case 'runShortcut':    return { shortcutId: '' };
    case 'delay':          return { durationMs: 1000 };
    case 'runScene':       return { sceneId: '' };
    default:               return {};
  }
}

function resolveSceneMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('/')) {
    return `${window.location.protocol}//${window.location.hostname}:3000${rawUrl}`;
  }
  return `${window.location.protocol}//${window.location.hostname}:3000/${rawUrl}`;
}

const VIDEO_ASSET_DND_PREFIX = 'scene-video-asset:';

function toVideoDragPayload(assetId: string): string {
  return `${VIDEO_ASSET_DND_PREFIX}${assetId}`;
}

function fromVideoDragPayload(raw: string): string | null {
  if (!raw.startsWith(VIDEO_ASSET_DND_PREFIX)) return null;
  const assetId = raw.slice(VIDEO_ASSET_DND_PREFIX.length).trim();
  return assetId || null;
}

function normalizeOpacity(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function normalizePercentage(value: unknown, fallback: number, min = 0, max = 100): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeFreePlacement(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-50, Math.min(150, n));
}

function readStoredWindowSize(key: string): WindowSize | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const width = Number((parsed as Record<string, unknown>).width);
    const height = Number((parsed as Record<string, unknown>).height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { width, height };
  } catch {
    return null;
  }
}

function getChromaFromPayload(payload: Record<string, unknown>): { enabled: boolean; color: string; tolerance: number } {
  const raw = payload.chromaKey ?? payload.chroma;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { enabled: false, color: '#00ff00', tolerance: 20 };
  }
  const chroma = raw as Record<string, unknown>;
  const color = typeof chroma.color === 'string' && chroma.color.trim() ? chroma.color : '#00ff00';
  return {
    enabled: Boolean(chroma.enabled),
    color,
    tolerance: normalizePercentage(chroma.tolerance, 20),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readLegacyPercentage(raw: unknown, fallback: number): number {
  const normalized = normalizePercentage(raw, Number.NaN);
  if (Number.isFinite(normalized)) {
    return normalized;
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (n >= 0 && n <= 1) {
    return normalizePercentage(n * 100, fallback);
  }
  return normalizePercentage(n, fallback);
}

function getPlacementFromPayload(payload: Record<string, unknown>): {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
} {
  const placement = asRecord(payload.placement) ?? asRecord(payload.position) ?? asRecord(payload.bounds);
  const leftRaw = payload.leftPct ?? payload.left ?? payload.xPct ?? payload.x ?? placement?.leftPct ?? placement?.left ?? placement?.xPct ?? placement?.x;
  const topRaw = payload.topPct ?? payload.top ?? payload.yPct ?? payload.y ?? placement?.topPct ?? placement?.top ?? placement?.yPct ?? placement?.y;
  const widthRaw = payload.widthPct ?? payload.width ?? placement?.widthPct ?? placement?.width;
  const heightRaw = payload.heightPct ?? payload.height ?? placement?.heightPct ?? placement?.height;

  return {
    leftPct: normalizeFreePlacement(readLegacyPercentage(leftRaw, 10), 10),
    topPct: normalizeFreePlacement(readLegacyPercentage(topRaw, 10), 10),
    widthPct: Math.max(1, normalizeFreePlacement(readLegacyPercentage(widthRaw, 80), 80)),
    heightPct: Math.max(1, normalizeFreePlacement(readLegacyPercentage(heightRaw, 80), 80)),
  };
}

function parseWindowKind(value: unknown): ScenePreviewWindowKind | null {
  if (value === 'main' || value === 'projection' || value === 'skyline') {
    return value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const target = value as Record<string, unknown>;
  if (target.kind === 'main' || target.kind === 'projection' || target.kind === 'skyline') {
    return target.kind;
  }
  if (target.targetWindow) {
    const nested = parseWindowKind(target.targetWindow);
    if (nested) return nested;
  }
  if (target.target) {
    const nested = parseWindowKind(target.target);
    if (nested) return nested;
  }
  if (target.windowKind === 'main' || target.windowKind === 'projection' || target.windowKind === 'skyline') {
    return target.windowKind;
  }
  if (target.windowType === 'main' || target.windowType === 'projection' || target.windowType === 'skyline') {
    return target.windowType;
  }
  if (target.id === 'main' || target.id === 'projection' || target.id === 'skyline') {
    return target.id;
  }
  return null;
}

function normalizeWindowTargetForEditor(action: SceneActionDto): SceneActionDto {
  if (!WINDOW_ACTION_TYPES.has(action.type)) {
    return { ...action, targetWindow: undefined };
  }

  const payload = asRecord(action.payload) ?? {};
  const parsedKind = parseWindowKind(action.targetWindow) ?? parseWindowKind(payload.targetWindow) ?? parseWindowKind(payload.target);
  return {
    ...action,
    targetWindow: { kind: parsedKind ?? 'projection' },
  };
}

function normalizeActionForEditor(action: SceneActionDto): SceneActionDto {
  const base = normalizeWindowTargetForEditor(action);
  if (base.type !== 'sendImageToWindow' && base.type !== 'sendVideoToWindow') {
    return base;
  }

  const payload = (base.payload ?? {}) as Record<string, unknown>;
  const placement = getPlacementFromPayload(payload);
  return {
    ...base,
    payload: {
      ...payload,
      leftPct: placement.leftPct,
      topPct: placement.topPct,
      widthPct: placement.widthPct,
      heightPct: placement.heightPct,
      chromaKey: getChromaFromPayload(payload),
    },
  };
}

function normalizeActionForSave(action: SceneActionDto): SceneActionDto {
  const base = normalizeWindowTargetForEditor(action);
  const payload = (base.payload ?? {}) as Record<string, unknown>;
  const layerOrder = Number(payload.layerOrder);
  const normalizedLayerOrder = Number.isFinite(layerOrder) ? Math.round(layerOrder) : undefined;

  const optionalText = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  if (base.type === 'sendImageToWindow') {
    const placement = getPlacementFromPayload(payload);
    const timelineStartMs = toNonNegativeMs(payload.timelineStartMs);
    const durationMs = toPositiveDurationMs(payload.durationMs);
    return {
      ...base,
      payload: {
        imageUrl: String(payload.imageUrl ?? '').trim(),
        ...(optionalText(payload.title) ? { title: optionalText(payload.title) } : {}),
        ...(payload.opacity !== undefined ? { opacity: normalizeOpacity(payload.opacity) } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        leftPct: placement.leftPct,
        topPct: placement.topPct,
        widthPct: placement.widthPct,
        heightPct: placement.heightPct,
        chromaKey: getChromaFromPayload(payload),
        ...(timelineStartMs !== undefined ? { timelineStartMs } : {}),
        ...(normalizedLayerOrder !== undefined ? { layerOrder: normalizedLayerOrder } : {}),
      },
    };
  }

  if (base.type === 'sendVideoToWindow') {
    const placement = getPlacementFromPayload(payload);
    const videoAssetId = optionalText(payload.videoAssetId);
    const videoUrl = optionalText(payload.videoUrl);
    const timelineStartMs = toNonNegativeMs(payload.timelineStartMs);
    const durationMs = toPositiveDurationMs(payload.durationMs);
    return {
      ...base,
      payload: {
        ...(videoAssetId ? { videoAssetId } : {}),
        ...(videoUrl ? { videoUrl } : {}),
        ...(payload.loop !== undefined ? { loop: Boolean(payload.loop) } : {}),
        ...(payload.muted !== undefined ? { muted: Boolean(payload.muted) } : {}),
        ...(payload.opacity !== undefined ? { opacity: normalizeOpacity(payload.opacity) } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        leftPct: placement.leftPct,
        topPct: placement.topPct,
        widthPct: placement.widthPct,
        heightPct: placement.heightPct,
        chromaKey: getChromaFromPayload(payload),
        ...(timelineStartMs !== undefined ? { timelineStartMs } : {}),
        ...(normalizedLayerOrder !== undefined ? { layerOrder: normalizedLayerOrder } : {}),
      },
    };
  }

  if (base.type === 'setWindowBackground') {
    return {
      ...base,
      payload: {
        imageUrl: String(payload.imageUrl ?? '').trim(),
        ...(optionalText(payload.sizing) ? { sizing: optionalText(payload.sizing) } : {}),
      },
    };
  }

  if (base.type === 'applyWindowFilter') {
    return {
      ...base,
      payload: {
        filter: String(payload.filter ?? '').trim(),
        ...(payload.intensity !== undefined && Number.isFinite(Number(payload.intensity))
          ? { intensity: Number(payload.intensity) }
          : {}),
        ...(optionalText(payload.color) ? { color: optionalText(payload.color) } : {}),
      },
    };
  }

  if (base.type === 'setNarrativeText') {
    return {
      ...base,
      payload: {
        text: String(payload.text ?? '').trim(),
        ...(optionalText(payload.title) ? { title: optionalText(payload.title) } : {}),
        ...(payload.durationMs !== undefined && Number.isFinite(Number(payload.durationMs))
          ? { durationMs: Number(payload.durationMs) }
          : {}),
      },
    };
  }

  if (base.type === 'playMusic') {
    return {
      ...base,
      payload: {
        ...(optionalText(payload.songId) ? { songId: optionalText(payload.songId) } : {}),
        ...(optionalText(payload.playlistId) ? { playlistId: optionalText(payload.playlistId) } : {}),
        ...(payload.loop !== undefined ? { loop: Boolean(payload.loop) } : {}),
        ...(payload.volume !== undefined && Number.isFinite(Number(payload.volume))
          ? { volume: Number(payload.volume) }
          : {}),
      },
    };
  }

  if (base.type === 'playSound') {
    return {
      ...base,
      payload: {
        effectId: String(payload.effectId ?? '').trim(),
        ...(payload.volume !== undefined && Number.isFinite(Number(payload.volume))
          ? { volume: Number(payload.volume) }
          : {}),
        ...(optionalText(payload.loopMode) ? { loopMode: optionalText(payload.loopMode) } : {}),
        ...(payload.waitMs !== undefined && Number.isFinite(Number(payload.waitMs))
          ? { waitMs: Number(payload.waitMs) }
          : {}),
        ...(payload.randomMinMs !== undefined && Number.isFinite(Number(payload.randomMinMs))
          ? { randomMinMs: Number(payload.randomMinMs) }
          : {}),
        ...(payload.randomMaxMs !== undefined && Number.isFinite(Number(payload.randomMaxMs))
          ? { randomMaxMs: Number(payload.randomMaxMs) }
          : {}),
      },
    };
  }

  if (base.type === 'runShortcut') {
    return {
      ...base,
      payload: { shortcutId: String(payload.shortcutId ?? '').trim() },
    };
  }

  if (base.type === 'runScene') {
    return {
      ...base,
      payload: { sceneId: String(payload.sceneId ?? '').trim() },
    };
  }

  return base;
}

function defaultAction(): SceneActionDto {
  return { id: uuidv4(), type: 'delay', delay: 0, payload: { durationMs: 1000 } };
}

function blankDraft(campaignId?: string | null): ScenePayload {
  return {
    name: '',
    description: '',
    scope: campaignId ? 'campaign' : 'global',
    campaignId: campaignId ?? null,
    actions: [],
  };
}

interface Props {
  open: boolean;
  /** Scene being edited; null means "create new" */
  editing: Scene | null;
  campaignId?: string | null;
  onClose: () => void;
  onSave: (payload: ScenePayload, id?: string) => Promise<void>;
}

/**
 * Dialog for creating or editing a Scene, including its action list.
 */
const SceneFormDialog: React.FC<Props> = ({ open, editing, campaignId, onClose, onSave }) => {
  const { activeMapId } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { mode: secondaryWindowMode, customSizes } = useSecondaryWindowSizes();
  const [draft, setDraft] = useState<ScenePayload>(blankDraft(campaignId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneVideoAssets, setSceneVideoAssets] = useState<SceneVideoAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [videoPreviewUrlsByActionId, setVideoPreviewUrlsByActionId] = useState<Record<string, string>>({});
  const [videoPreviewErrorsByActionId, setVideoPreviewErrorsByActionId] = useState<Record<string, string>>({});
  const [previewWindowKind, setPreviewWindowKind] = useState<ScenePreviewWindowKind>('projection');
  const [previewZoom, setPreviewZoom] = useState<number>(0.25);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [isPreviewLooping, setIsPreviewLooping] = useState<boolean>(true);
  const [currentTimelineTimeMs, setCurrentTimelineTimeMs] = useState<number>(0);
  const [previewSeekVersion, setPreviewSeekVersion] = useState<number>(0);
  const [projectionWindowSize, setProjectionWindowSize] = useState<WindowSize | null>(null);
  const [skylineWindowSize, setSkylineWindowSize] = useState<WindowSize | null>(null);
  const [chromaPickActionId, setChromaPickActionId] = useState<string | null>(null);
  const [dragOverActionId, setDragOverActionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const layerDragRef = useRef<{
    actionId: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    originLeftPct: number;
    originTopPct: number;
    originWidthPct: number;
    originHeightPct: number;
  } | null>(null);

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const resolvedCampaignId = editing.campaignId ?? ((editing as unknown as { campaign?: { id?: string | null } }).campaign?.id ?? null);
      setDraft({
        name: editing.name,
        description: editing.description ?? '',
        scope: editing.scope ?? 'campaign',
        campaignId: resolvedCampaignId,
        actions: (editing.actions ?? []).map(normalizeActionForEditor),
      });
    } else {
      setDraft(blankDraft(campaignId));
    }
    setError(null);
    setSelectedActionId(editing?.actions?.[0]?.id ?? null);
  }, [open, editing, campaignId]);

  useEffect(() => {
    if (!open) return;
    setLoadingAssets(true);
    listSceneVideos(campaignId ?? undefined)
      .then((items) => setSceneVideoAssets(items))
      .catch(() => setSceneVideoAssets([]))
      .finally(() => setLoadingAssets(false));
  }, [open, campaignId]);

  useEffect(() => {
    if (!draft.actions.length) {
      if (selectedActionId !== null) setSelectedActionId(null);
      return;
    }
    if (selectedActionId && draft.actions.some((action) => action.id === selectedActionId)) {
      return;
    }
    setSelectedActionId(draft.actions[0]?.id ?? null);
  }, [draft.actions, selectedActionId]);

  useEffect(() => {
    if (!open) return;

    const syncFromStorage = () => {
      setProjectionWindowSize(readStoredWindowSize(PROJECTION_SIZE_KEY));
      setSkylineWindowSize(readStoredWindowSize(SKYLINE_SIZE_KEY));
    };

    syncFromStorage();

    const onStorage = (event: StorageEvent) => {
      if (event.key === PROJECTION_SIZE_KEY || event.key === SKYLINE_SIZE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(syncFromStorage, 1200);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, [open]);

  useEffect(() => {
    if (!selectedActionId && chromaPickActionId) {
      setChromaPickActionId(null);
      return;
    }
    if (chromaPickActionId && chromaPickActionId !== selectedActionId) {
      setChromaPickActionId(null);
    }
  }, [selectedActionId, chromaPickActionId]);

  const timelineModel = useMemo(() => buildTimeline(draft.actions), [draft.actions]);
  const timelineEntriesByActionId = useMemo(() => {
    const map = new Map<string, { startMs: number; endMs: number; durationMs: number }>();
    for (const entry of timelineModel.entries) {
      map.set(entry.actionId, {
        startMs: entry.startMs,
        endMs: entry.endMs,
        durationMs: entry.durationMs,
      });
    }
    return map;
  }, [timelineModel.entries]);
  const timelineDurationMs = timelineModel.totalMs;

  useEffect(() => {
    if (!open) {
      setIsPreviewPlaying(false);
      setCurrentTimelineTimeMs(0);
      return;
    }
    setCurrentTimelineTimeMs((current) => Math.max(0, Math.min(timelineDurationMs, current)));
  }, [open, timelineDurationMs]);

  useEffect(() => {
    if (!open || !isPreviewPlaying) return;

    let rafId = 0;
    let lastFrame = performance.now();

    const step = (now: number) => {
      const delta = now - lastFrame;
      lastFrame = now;
      setCurrentTimelineTimeMs((current) => {
        const next = current + delta;
        if (next >= timelineDurationMs) {
          if (isPreviewLooping && timelineDurationMs > 0) {
            return next % timelineDurationMs;
          }
          setIsPreviewPlaying(false);
          return timelineDurationMs;
        }
        return next;
      });
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isPreviewPlaying, isPreviewLooping, open, timelineDurationMs]);

  useEffect(() => {
    if (!open) return;

    const isTextInputTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || Boolean(target.isContentEditable);
    };

    const frameStepMs = 1000 / PREVIEW_FPS;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        setIsPreviewPlaying((playing) => !playing);
        return;
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault();
        setIsPreviewPlaying(false);
        setCurrentTimelineTimeMs((current) => Math.min(timelineDurationMs, current + (event.shiftKey ? frameStepMs * 5 : frameStepMs)));
        return;
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        setIsPreviewPlaying(false);
        setCurrentTimelineTimeMs((current) => Math.max(0, current - (event.shiftKey ? frameStepMs * 5 : frameStepMs)));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, timelineDurationMs]);

  const set = <K extends keyof ScenePayload>(key: K, value: ScenePayload[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const addAction = () => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    const next = defaultAction();
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  };

  const addActionOfType = (type: string) => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    const next: SceneActionDto = {
      id: uuidv4(),
      type,
      delay: 0,
      targetWindow: WINDOW_ACTION_TYPES.has(type) ? { kind: 'projection' } : undefined,
      payload: emptyPayload(type),
    };
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  };

  const updateAction = (index: number, updated: SceneActionDto) => {
    setDraft((d) => {
      const actions = [...d.actions];
      actions[index] = updated;
      return { ...d, actions };
    });
  };

  const updateActionById = (actionId: string, updater: (action: SceneActionDto) => SceneActionDto) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((action) => (action.id === actionId ? updater(action) : action)),
    }));
  };

  const removeAction = (index: number) => {
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, i) => i !== index) }));
  };

  const handleSelectActionFromTimeline = (actionId: string) => {
    setSelectedActionId(actionId);
  };

  const handleChangeActionType = (index: number, type: string) => {
    updateAction(index, { ...draft.actions[index], type, payload: emptyPayload(type) });
  };

  const handleSave = async () => {
    if (!draft.name.trim()) { setError('El nombre es obligatorio.'); return; }
    const contextCampaignId = draft.campaignId
      ?? campaignId
      ?? editing?.campaignId
      ?? ((editing as unknown as { campaign?: { id?: string | null } })?.campaign?.id ?? null);

    const resolvedScope = draft.scope === 'campaign' && !contextCampaignId
      ? 'global'
      : draft.scope;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...draft,
        scope: resolvedScope,
        campaignId: resolvedScope === 'campaign' ? contextCampaignId : null,
        actions: draft.actions.map(normalizeActionForSave),
      }, editing?.id);
      onClose();
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const message = Array.isArray(backendMessage)
        ? backendMessage.join(' | ')
        : backendMessage;
      setError(message ?? err?.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadVideoClick = () => {
    fileInputRef.current?.click();
  };

  const handleVideoFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      await uploadSceneVideo(file, {
        campaignId: campaignId ?? undefined,
        name: file.name,
      });
      const refreshed = await listSceneVideos(campaignId ?? undefined);
      setSceneVideoAssets(refreshed);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al subir vídeo.');
    } finally {
      setUploadingVideo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedActionIndex = draft.actions.findIndex((action) => action.id === selectedActionId);
  const selectedAction = selectedActionIndex >= 0 ? draft.actions[selectedActionIndex] : null;

  const createVideoActionFromAsset = (assetId: string): SceneActionDto => {
    const assetDurationMs = toPositiveDurationMs(sceneVideoAssets.find((asset) => asset.id === assetId)?.durationMs);
    return {
      id: uuidv4(),
      type: 'sendVideoToWindow',
      delay: 0,
      targetWindow: { kind: 'projection' },
      payload: {
        videoAssetId: assetId,
        loop: false,
        muted: false,
        opacity: 1,
        leftPct: 10,
        topPct: 10,
        widthPct: 80,
        heightPct: 80,
        ...(assetDurationMs !== undefined ? { durationMs: assetDurationMs } : {}),
      },
    };
  };

  const assignVideoAssetToAction = (action: SceneActionDto, assetId: string): SceneActionDto => {
    const assetDurationMs = toPositiveDurationMs(sceneVideoAssets.find((asset) => asset.id === assetId)?.durationMs);
    const payload = { ...(action.payload ?? {}), videoAssetId: assetId } as Record<string, unknown>;
    delete payload.videoUrl;
    if (assetDurationMs !== undefined) {
      payload.durationMs = assetDurationMs;
    }
    return { ...action, payload };
  };

  useEffect(() => {
    if (!open || sceneVideoAssets.length === 0) return;

    const durationByAssetId = new Map<string, number>();
    for (const asset of sceneVideoAssets) {
      const durationMs = toPositiveDurationMs(asset.durationMs);
      if (durationMs !== undefined) durationByAssetId.set(asset.id, durationMs);
    }
    if (durationByAssetId.size === 0) return;

    setDraft((currentDraft) => {
      let changed = false;
      const nextActions = currentDraft.actions.map((action) => {
        if (action.type !== 'sendVideoToWindow') return action;
        const payload = (action.payload ?? {}) as Record<string, unknown>;
        const assetId = String(payload.videoAssetId ?? '').trim();
        if (!assetId) return action;
        const expectedDurationMs = durationByAssetId.get(assetId);
        if (expectedDurationMs === undefined) return action;

        const currentDurationMs = toPositiveDurationMs(payload.durationMs);
        if (currentDurationMs === expectedDurationMs) return action;

        changed = true;
        return {
          ...action,
          payload: {
            ...payload,
            durationMs: expectedDurationMs,
          },
        };
      });

      return changed ? { ...currentDraft, actions: nextActions } : currentDraft;
    });
  }, [open, sceneVideoAssets]);

  useEffect(() => {
    if (!open) return;

    const pendingActions = draft.actions.filter((action) => {
      if (action.type !== 'sendVideoToWindow') return false;
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      if (toPositiveDurationMs(payload.durationMs) !== undefined) return false;
      return Boolean(videoPreviewUrlsByActionId[action.id]);
    });

    if (pendingActions.length === 0) return;

    let cancelled = false;

    const syncDurations = async () => {
      const measuredByActionId = new Map<string, number>();
      for (const action of pendingActions) {
        const url = videoPreviewUrlsByActionId[action.id];
        if (!url) continue;
        const durationMs = await measureVideoDurationMs(url);
        if (cancelled || durationMs === undefined) continue;
        measuredByActionId.set(action.id, durationMs);
      }

      if (cancelled || measuredByActionId.size === 0) return;

      setDraft((currentDraft) => {
        let changed = false;
        const nextActions = currentDraft.actions.map((action) => {
          const measuredDurationMs = measuredByActionId.get(action.id);
          if (!measuredDurationMs || action.type !== 'sendVideoToWindow') return action;
          const payload = (action.payload ?? {}) as Record<string, unknown>;
          if (toPositiveDurationMs(payload.durationMs) !== undefined) return action;
          changed = true;
          return {
            ...action,
            payload: {
              ...payload,
              durationMs: measuredDurationMs,
            },
          };
        });
        return changed ? { ...currentDraft, actions: nextActions } : currentDraft;
      });
    };

    syncDurations();
    return () => {
      cancelled = true;
    };
  }, [open, draft.actions, videoPreviewUrlsByActionId]);

  const createActionByDroppingVideoAsset = (assetId: string) => {
    if (selectedAction && selectedAction.type === 'sendVideoToWindow' && selectedActionIndex >= 0) {
      updateAction(selectedActionIndex, assignVideoAssetToAction(selectedAction, assetId));
      return;
    }

    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    const next = createVideoActionFromAsset(assetId);
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  };

  const handleDropVideoAsset = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('text/plain');
    const assetId = fromVideoDragPayload(payload);
    if (!assetId) return;
    createActionByDroppingVideoAsset(assetId);
  };

  useEffect(() => {
    if (!selectedAction || !WINDOW_ACTION_TYPES.has(selectedAction.type)) return;
    const nextKind = (selectedAction.targetWindow?.kind ?? 'main') as ScenePreviewWindowKind;
    if (nextKind === 'main' || nextKind === 'projection' || nextKind === 'skyline') {
      setPreviewWindowKind(nextKind);
    }
  }, [selectedAction?.id, selectedAction?.type, selectedAction?.targetWindow?.kind]);

  useEffect(() => {
    let cancelled = false;

    const loadPreviewVideos = async () => {
      const videoActions = draft.actions.filter((action) => action.type === 'sendVideoToWindow');
      if (!videoActions.length) {
        setVideoPreviewUrlsByActionId({});
        setVideoPreviewErrorsByActionId({});
        return;
      }

      const resolvedUrls: Record<string, string> = {};
      const resolvedErrors: Record<string, string> = {};

      await Promise.all(videoActions.map(async (action) => {
        const payload = action.payload ?? {};
        const directVideoUrl = String(payload.videoUrl ?? '').trim();
        if (directVideoUrl) {
          resolvedUrls[action.id] = resolveSceneMediaUrl(directVideoUrl);
          return;
        }

        const videoAssetId = String(payload.videoAssetId ?? '').trim();
        if (!videoAssetId) {
          return;
        }

        try {
          const signed = await createSceneVideoSignedUrl(videoAssetId);
          resolvedUrls[action.id] = resolveSceneMediaUrl(signed.url);
        } catch (err: any) {
          resolvedErrors[action.id] = err?.message ?? 'No se pudo resolver el vídeo';
        }
      }));

      if (cancelled) return;
      setVideoPreviewUrlsByActionId(resolvedUrls);
      setVideoPreviewErrorsByActionId(resolvedErrors);
    };

    loadPreviewVideos();
    return () => {
      cancelled = true;
    };
  }, [draft.actions]);

  const moveSelectedAction = (direction: -1 | 1) => {
    if (selectedActionIndex < 0) return;
    const nextIndex = selectedActionIndex + direction;
    if (nextIndex < 0 || nextIndex >= draft.actions.length) return;
    setDraft((d) => {
      const nextActions = [...d.actions];
      const swap = nextActions[selectedActionIndex];
      nextActions[selectedActionIndex] = nextActions[nextIndex];
      nextActions[nextIndex] = swap;
      return { ...d, actions: nextActions };
    });
  };

  const removeSelectedAction = () => {
    if (selectedActionIndex < 0) return;
    setDraft((d) => {
      const nextActions = d.actions.filter((_, idx) => idx !== selectedActionIndex);
      return { ...d, actions: nextActions };
    });
  };

  const reorderActionsByIds = (draggedActionId: string, dropActionId: string) => {
    if (!draggedActionId || !dropActionId || draggedActionId === dropActionId) return;

    setDraft((d) => {
      const fromIndex = d.actions.findIndex((action) => action.id === draggedActionId);
      const toIndex = d.actions.findIndex((action) => action.id === dropActionId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return d;

      const nextActions = [...d.actions];
      const [moved] = nextActions.splice(fromIndex, 1);
      nextActions.splice(toIndex, 0, moved);
      return { ...d, actions: nextActions };
    });
  };

  const moveActionInTimeline = (actionId: string, nextStartMs: number) => {
    const snappedStartMs = Math.max(0, Math.round(nextStartMs / 100) * 100);
    updateActionById(actionId, (action) => ({
      ...action,
      payload: {
        ...(action.payload ?? {}),
        timelineStartMs: snappedStartMs,
      },
    }));
  };

  const setActionLayerOrder = (actionId: string, nextLayerOrder: number) => {
    const normalized = Math.round(nextLayerOrder);
    updateActionById(actionId, (action) => ({
      ...action,
      payload: {
        ...(action.payload ?? {}),
        layerOrder: normalized,
      },
    }));
  };

  const updateLayerPlacementByActionId = (
    actionId: string,
    next: { leftPct?: number; topPct?: number; widthPct?: number; heightPct?: number },
  ) => {
    setDraft((d) => {
      const actionIndex = d.actions.findIndex((action) => action.id === actionId);
      if (actionIndex < 0) return d;
      const action = d.actions[actionIndex];
      const payload = action.payload ?? {};
      const nextPayload = {
        ...payload,
        ...(next.leftPct !== undefined ? { leftPct: next.leftPct } : {}),
        ...(next.topPct !== undefined ? { topPct: next.topPct } : {}),
        ...(next.widthPct !== undefined ? { widthPct: next.widthPct } : {}),
        ...(next.heightPct !== undefined ? { heightPct: next.heightPct } : {}),
      };
      const nextActions = [...d.actions];
      nextActions[actionIndex] = { ...action, payload: nextPayload };
      return { ...d, actions: nextActions };
    });
  };

  const startLayerDrag = (action: SceneActionDto, mode: 'move' | 'resize', event: React.MouseEvent) => {
    if (event.button !== 0) return;
    const stageRect = previewStageRef.current?.getBoundingClientRect();
    if (!stageRect || stageRect.width <= 0 || stageRect.height <= 0) return;

    event.preventDefault();
    event.stopPropagation();

    const payload = action.payload ?? {};
    layerDragRef.current = {
      actionId: action.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originLeftPct: normalizeFreePlacement((payload as Record<string, unknown>).leftPct, 10),
      originTopPct: normalizeFreePlacement((payload as Record<string, unknown>).topPct, 10),
      originWidthPct: normalizeFreePlacement((payload as Record<string, unknown>).widthPct, 80),
      originHeightPct: normalizeFreePlacement((payload as Record<string, unknown>).heightPct, 80),
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const drag = layerDragRef.current;
      const rect = previewStageRef.current?.getBoundingClientRect();
      if (!drag || !rect || rect.width <= 0 || rect.height <= 0) return;

      const dxPct = ((moveEvent.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((moveEvent.clientY - drag.startY) / rect.height) * 100;

      if (drag.mode === 'move') {
        const widthPct = drag.originWidthPct;
        const heightPct = drag.originHeightPct;
        const leftPct = drag.originLeftPct + dxPct;
        const topPct = drag.originTopPct + dyPct;
        updateLayerPlacementByActionId(drag.actionId, { leftPct, topPct });
        return;
      }

      const leftPct = drag.originLeftPct;
      const topPct = drag.originTopPct;
      const widthPct = Math.max(5, drag.originWidthPct + dxPct);
      const heightPct = Math.max(5, drag.originHeightPct + dyPct);
      updateLayerPlacementByActionId(drag.actionId, { widthPct, heightPct });
    };

    const onMouseUp = () => {
      layerDragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const moveSelectedLayerToEdge = (edge: 'top' | 'bottom') => {
    if (selectedActionIndex < 0) return;
    setDraft((d) => {
      const nextActions = [...d.actions];
      const [moved] = nextActions.splice(selectedActionIndex, 1);
      if (!moved) return d;
      if (edge === 'top') {
        nextActions.push(moved);
      } else {
        nextActions.unshift(moved);
      }
      return { ...d, actions: nextActions };
    });
  };

  const handleSeekTimelineTime = (nextTimeMs: number) => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(Math.max(0, Math.min(timelineDurationMs, nextTimeMs)));
    setPreviewSeekVersion((v) => v + 1);
  };

  const frameStepMs = 1000 / PREVIEW_FPS;
  const stepPreviewFrame = (direction: -1 | 1) => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs((current) => {
      const next = current + direction * frameStepMs;
      return Math.max(0, Math.min(timelineDurationMs, next));
    });
    setPreviewSeekVersion((v) => v + 1);
  };

  const goToTimelineStart = () => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(0);
    setPreviewSeekVersion((v) => v + 1);
  };

  const goToTimelineEnd = () => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(timelineDurationMs);
    setPreviewSeekVersion((v) => v + 1);
  };

  const activeTimelineEntry = useMemo(() => {
    return timelineModel.entries.find((entry) => currentTimelineTimeMs >= entry.startMs && currentTimelineTimeMs < entry.endMs) ?? null;
  }, [currentTimelineTimeMs, timelineModel.entries]);

  const activeEntryLabel = activeTimelineEntry
    ? `${activeTimelineEntry.label} · ${formatPreviewClock(Math.max(0, currentTimelineTimeMs - activeTimelineEntry.startMs))}/${formatPreviewClock(activeTimelineEntry.durationMs)}`
    : 'Sin acción activa';

  const previewRenderableActions = draft.actions.filter((action) => {
    const timelineEntry = timelineEntriesByActionId.get(action.id);
    if (!timelineEntry) return false;

    const isActive = currentTimelineTimeMs >= timelineEntry.startMs && currentTimelineTimeMs < timelineEntry.endMs;
    if (!isActive) return false;

    if (action.type === 'setNarrativeText') return true;
    if (!WINDOW_ACTION_TYPES.has(action.type)) return false;

    const targetKind = action.targetWindow?.kind ?? 'main';
    return targetKind === previewWindowKind;
  });

  const effectiveProjectionSize = useMemo<WindowSize>(() => {
    if (secondaryWindowMode === 'custom') return customSizes.players;
    return projectionWindowSize ?? { width: 1920, height: 1080 };
  }, [secondaryWindowMode, customSizes.players, projectionWindowSize]);

  const effectiveSkylineSize = useMemo<WindowSize>(() => {
    if (secondaryWindowMode === 'custom') return customSizes.skyline;
    return skylineWindowSize ?? { width: 1920, height: 1080 };
  }, [secondaryWindowMode, customSizes.skyline, skylineWindowSize]);

  const previewWindowSize = useMemo<WindowSize>(() => {
    if (previewWindowKind === 'skyline') return effectiveSkylineSize;
    if (previewWindowKind === 'main') return { width: 1280, height: 720 };
    return effectiveProjectionSize;
  }, [previewWindowKind, effectiveProjectionSize, effectiveSkylineSize]);

  const previewScale = Number.isFinite(previewZoom) && previewZoom > 0 ? previewZoom : 0.25;

  const mapPreviewUrl = activeMapId
    ? getMapImageUrlSized(activeMapId, 'preview', { timeOfDay: timeOfDay as 'dawn' | 'morning' | 'afternoon' | 'night' })
    : null;

  const previewBaseContent = (() => {
    if (previewWindowKind === 'skyline') {
      if (!campaignId || !activeMapId) {
        return (
          <Stack sx={{ width: '100%', height: '100%' }} alignItems="center" justifyContent="center">
            <Typography variant="body2" color="text.secondary">
              Selecciona campaña y mapa activo para usar la base Skyline.
            </Typography>
          </Stack>
        );
      }
      return (
        <SkylineViewportContent
          campaignId={campaignId}
          mapId={activeMapId}
          timeOfDay={timeOfDay}
        />
      );
    }

    if (previewWindowKind === 'main') {
      return (
        <Stack sx={{ width: '100%', height: '100%' }} alignItems="center" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Vista de ventana main (placeholder funcional).
          </Typography>
        </Stack>
      );
    }

    if (!mapPreviewUrl) {
      return (
        <Stack sx={{ width: '100%', height: '100%' }} alignItems="center" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            No hay mapa activo para la ventana projection.
          </Typography>
        </Stack>
      );
    }

    return (
      <AuthImage
        src={mapPreviewUrl}
        alt="Projection base"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '96vw',
          maxWidth: '96vw',
          height: '92vh',
          maxHeight: '92vh',
        },
      }}
    >
      <DialogTitle>{editing ? 'Editar escena' : 'Nueva escena'}</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ height: '100%' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoFileSelected}
          />

          <Stack direction="row" spacing={1}>
            <TextField
              label="Nombre *"
              size="small"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              inputProps={{ maxLength: 80 }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ width: 180 }}>
              <InputLabel>Alcance</InputLabel>
              <Select
                value={draft.scope}
                label="Alcance"
                onChange={(e) => set('scope', e.target.value as 'global' | 'campaign')}
              >
                <MenuItem value="campaign">Campaña</MenuItem>
                <MenuItem value="global">Global</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <TextField
            label="Descripción"
            size="small"
            multiline
            rows={2}
            value={draft.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            inputProps={{ maxLength: 500 }}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '260px minmax(0, 1fr) 360px' },
              gap: 1.5,
              minHeight: 0,
              flex: 1,
            }}
          >
            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Herramientas</Typography>

              <Stack spacing={0.8}>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => addActionOfType('sendVideoToWindow')}>Añadir vídeo</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('sendImageToWindow')}>Añadir imagen</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('setNarrativeText')}>Añadir texto</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('playMusic')}>Añadir música</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('playSound')}>Añadir sonido</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('applyWindowFilter')}>Añadir filtro</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('delay')}>Añadir pausa</Button>
                <Button size="small" variant="text" onClick={addAction}>Acción vacía</Button>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Stack spacing={1} sx={{ minHeight: 0, flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Librería de vídeos</Typography>
                  <Button
                    size="small"
                    startIcon={<UploadIcon />}
                    onClick={handleUploadVideoClick}
                    disabled={uploadingVideo}
                  >
                    {uploadingVideo ? 'Subiendo…' : 'Subir'}
                  </Button>
                </Stack>

                {loadingAssets ? (
                  <Typography variant="caption" color="text.secondary">Cargando vídeos…</Typography>
                ) : sceneVideoAssets.length === 0 ? (
                  <Alert severity="info">No hay vídeos subidos todavía.</Alert>
                ) : (
                  <Stack spacing={0.7} sx={{ overflowY: 'auto', pr: 0.5 }}>
                    {sceneVideoAssets.map((asset) => (
                      <Chip
                        key={asset.id}
                        label={`${asset.name} (${Math.round(asset.size / (1024 * 1024))}MB)`}
                        size="small"
                        variant="outlined"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', toVideoDragPayload(asset.id));
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          createActionByDroppingVideoAsset(asset.id);
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">Previsualizador</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={goToTimelineStart}>
                    Inicio
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => stepPreviewFrame(-1)}>
                    -1 frame
                  </Button>
                  <Button size="small" variant="contained" onClick={() => setIsPreviewPlaying((playing) => !playing)}>
                    {isPreviewPlaying ? 'Pausar' : 'Reproducir'}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => stepPreviewFrame(1)}>
                    +1 frame
                  </Button>
                  <Button size="small" variant="outlined" onClick={goToTimelineEnd}>
                    Fin
                  </Button>
                  <Button size="small" variant={isPreviewLooping ? 'contained' : 'outlined'} onClick={() => setIsPreviewLooping((looping) => !looping)}>
                    Loop {isPreviewLooping ? 'ON' : 'OFF'}
                  </Button>
                  <Chip size="small" label={`${formatPreviewClock(currentTimelineTimeMs)} @ ${PREVIEW_FPS}fps`} />
                  <Chip size="small" variant="outlined" label={activeEntryLabel} />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Vista previa</InputLabel>
                    <Select
                      label="Vista previa"
                      value={previewWindowKind}
                      onChange={(event) => setPreviewWindowKind(event.target.value as ScenePreviewWindowKind)}
                    >
                      <MenuItem value="main">Principal</MenuItem>
                      <MenuItem value="projection">Mapas</MenuItem>
                      <MenuItem value="skyline">Skyline</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Escala</InputLabel>
                    <Select
                      label="Escala"
                      value={String(previewZoom)}
                      onChange={(event) => setPreviewZoom(Number(event.target.value))}
                    >
                      <MenuItem value="0.18">18%</MenuItem>
                      <MenuItem value="0.22">22%</MenuItem>
                      <MenuItem value="0.25">25%</MenuItem>
                      <MenuItem value="0.3">30%</MenuItem>
                      <MenuItem value="0.35">35%</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
              <Box
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDropVideoAsset}
                sx={{
                  borderRadius: 1,
                  bgcolor: '#0f1116',
                  border: '1px solid',
                  borderColor: 'divider',
                  minHeight: 280,
                  maxHeight: 460,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                    overflow: 'auto',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    zIndex: 2,
                    width: Math.max(1, Math.round(previewWindowSize.width * previewScale)),
                    height: Math.max(1, Math.round(previewWindowSize.height * previewScale)),
                    overflow: 'visible',
                  }}
                >
                  <Box
                    ref={previewStageRef}
                    sx={{
                      position: 'relative',
                      width: previewWindowSize.width,
                      height: previewWindowSize.height,
                      transform: `scale(${previewScale})`,
                      transformOrigin: 'top left',
                      overflow: 'visible',
                      background: 'linear-gradient(180deg, rgba(4, 5, 9, 0.08) 0%, rgba(4, 5, 9, 0.22) 100%)',
                    }}
                  >
                    <Box sx={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                      {previewBaseContent}
                    </Box>

                  {previewRenderableActions.length === 0 ? (
                    <Stack sx={{ width: '100%', height: '100%' }} alignItems="center" justifyContent="center">
                      <Typography variant="body2" color="text.secondary">
                        No hay capas para la ventana {previewWindowKind}.
                      </Typography>
                    </Stack>
                  ) : (
                    previewRenderableActions
                      .slice()
                      .sort((left, right) => {
                        const leftOrder = Number((left.payload ?? {}).layerOrder);
                        const rightOrder = Number((right.payload ?? {}).layerOrder);
                        const a = Number.isFinite(leftOrder) ? leftOrder : 0;
                        const b = Number.isFinite(rightOrder) ? rightOrder : 0;
                        if (a !== b) return a - b;
                        const leftIndex = draft.actions.findIndex((item) => item.id === left.id);
                        const rightIndex = draft.actions.findIndex((item) => item.id === right.id);
                        return leftIndex - rightIndex;
                      })
                      .map((action, layerIndex) => {
                      const payload = action.payload ?? {};
                      const opacity = normalizeOpacity((payload as Record<string, unknown>).opacity);
                      const leftPct = normalizeFreePlacement((payload as Record<string, unknown>).leftPct, 10);
                      const topPct = normalizeFreePlacement((payload as Record<string, unknown>).topPct, 10);
                      const widthPct = Math.max(1, normalizeFreePlacement((payload as Record<string, unknown>).widthPct, 80));
                      const heightPct = Math.max(1, normalizeFreePlacement((payload as Record<string, unknown>).heightPct, 80));
                      const selected = action.id === selectedActionId;
                      const key = `${action.id}-${layerIndex}`;
                      const payloadLayerOrder = Number((payload as Record<string, unknown>).layerOrder);
                      const zIndex = Number.isFinite(payloadLayerOrder) ? Math.round(payloadLayerOrder) : layerIndex + 1;

                      if (action.type === 'setWindowBackground') {
                        const imageUrl = String(payload.imageUrl ?? '').trim();
                        if (!imageUrl) return null;
                        const sizing = String(payload.sizing ?? 'cover');
                        return (
                          <Box
                            key={key}
                            component="img"
                            src={resolveSceneMediaUrl(imageUrl)}
                            alt="Layer background"
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: sizing === 'contain' ? 'contain' : sizing === 'stretch' ? 'fill' : 'cover',
                              opacity,
                              zIndex,
                              border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                              pointerEvents: 'none',
                            }}
                          />
                        );
                      }

                      if (action.type === 'sendImageToWindow') {
                        const imageUrl = String(payload.imageUrl ?? '').trim();
                        if (!imageUrl) return null;
                        const chroma = getChromaFromPayload(payload as Record<string, unknown>);
                        return (
                          <Box
                            key={key}
                            sx={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                              zIndex,
                              border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                              pointerEvents: selected ? 'auto' : 'none',
                              cursor: selected && chromaPickActionId !== action.id ? 'move' : 'default',
                            }}
                            onMouseDown={(event) => selected && chromaPickActionId !== action.id ? startLayerDrag(action, 'move', event) : undefined}
                          >
                            <ChromaKeyMedia
                              kind="image"
                              src={resolveSceneMediaUrl(imageUrl)}
                              opacity={opacity}
                              chromaKey={chroma}
                              pickColorEnabled={selected && chromaPickActionId === action.id}
                              onPickColor={(hexColor) => {
                                updateActionById(action.id, (currentAction) => ({
                                  ...currentAction,
                                  payload: {
                                    ...(currentAction.payload ?? {}),
                                    chromaKey: {
                                      ...getChromaFromPayload(currentAction.payload ?? {}),
                                      enabled: true,
                                      color: hexColor,
                                    },
                                  },
                                }));
                                setChromaPickActionId(null);
                              }}
                              onMediaError={() => {
                                setChromaPickActionId(null);
                              }}
                            />
                            {selected ? (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  right: -8,
                                  bottom: -8,
                                  width: 14,
                                  height: 14,
                                  borderRadius: '50%',
                                  bgcolor: 'primary.main',
                                  border: '2px solid #fff',
                                  cursor: 'nwse-resize',
                                  pointerEvents: 'auto',
                                }}
                                onMouseDown={(event) => {
                                  if (chromaPickActionId === action.id) return;
                                  startLayerDrag(action, 'resize', event);
                                }}
                              />
                            ) : null}
                          </Box>
                        );
                      }

                      if (action.type === 'sendVideoToWindow') {
                        const videoUrl = videoPreviewUrlsByActionId[action.id] ?? '';
                        const videoError = videoPreviewErrorsByActionId[action.id];
                        const chroma = getChromaFromPayload(payload as Record<string, unknown>);
                        const timelineEntry = timelineEntriesByActionId.get(action.id);
                        const mediaTimeSec = timelineEntry
                          ? Math.max(0, (currentTimelineTimeMs - timelineEntry.startMs) / 1000)
                          : 0;
                        if (videoError) {
                          return (
                            <Box key={key} sx={{ position: 'absolute', inset: 0, p: 2 }}>
                              <Typography variant="caption" color="error">
                                {videoError}
                              </Typography>
                            </Box>
                          );
                        }
                        if (!videoUrl) return null;
                        return (
                          <Box
                            key={key}
                            sx={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                              zIndex,
                              border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                              pointerEvents: selected ? 'auto' : 'none',
                              cursor: selected && chromaPickActionId !== action.id ? 'move' : 'default',
                            }}
                            onMouseDown={(event) => selected && chromaPickActionId !== action.id ? startLayerDrag(action, 'move', event) : undefined}
                          >
                            <ChromaKeyMedia
                              kind="video"
                              src={videoUrl}
                              autoPlay
                              muted
                              loop
                              opacity={opacity}
                              chromaKey={chroma}
                              isPlaying={isPreviewPlaying}
                              seekTimeSec={isPreviewPlaying ? undefined : mediaTimeSec}
                              seekVersion={previewSeekVersion}
                              pickColorEnabled={selected && chromaPickActionId === action.id}
                              onPickColor={(hexColor) => {
                                updateActionById(action.id, (currentAction) => ({
                                  ...currentAction,
                                  payload: {
                                    ...(currentAction.payload ?? {}),
                                    chromaKey: {
                                      ...getChromaFromPayload(currentAction.payload ?? {}),
                                      enabled: true,
                                      color: hexColor,
                                    },
                                  },
                                }));
                                setChromaPickActionId(null);
                              }}
                              onMediaError={() => {
                                setChromaPickActionId(null);
                              }}
                            />
                            {selected ? (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  right: -8,
                                  bottom: -8,
                                  width: 14,
                                  height: 14,
                                  borderRadius: '50%',
                                  bgcolor: 'primary.main',
                                  border: '2px solid #fff',
                                  cursor: 'nwse-resize',
                                  pointerEvents: 'auto',
                                }}
                                onMouseDown={(event) => {
                                  if (chromaPickActionId === action.id) return;
                                  startLayerDrag(action, 'resize', event);
                                }}
                              />
                            ) : null}
                          </Box>
                        );
                      }

                      if (action.type === 'applyWindowFilter') {
                        const filter = String(payload.filter ?? '').trim();
                        if (!filter) return null;
                        return (
                          <Box
                            key={key}
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              backdropFilter: filter,
                              opacity,
                              zIndex,
                              border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                              pointerEvents: 'none',
                            }}
                          />
                        );
                      }

                      if (action.type === 'setNarrativeText') {
                        return (
                          <Box
                            key={key}
                            sx={{
                              position: 'absolute',
                              left: '8%',
                              right: '8%',
                              bottom: '10%',
                              borderRadius: 1,
                              p: 1.5,
                              bgcolor: 'rgba(0, 0, 0, 0.58)',
                              opacity,
                              zIndex,
                              border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                              pointerEvents: 'none',
                            }}
                          >
                            <Typography variant="subtitle2" color="white" sx={{ mb: 0.5 }}>
                              {String(payload.title ?? 'Narrativa')}
                            </Typography>
                            <Typography variant="body2" color="white">
                              {String(payload.text ?? 'Sin texto')}
                            </Typography>
                          </Box>
                        );
                      }

                      return null;
                    })
                  )}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">
                    Timeline principal ({draft.actions.length}/{SCENE_MAX_ACTIONS})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Click para scrub | Espacio play/pause | Flechas frame a frame.
                  </Typography>
                </Stack>
                <Box onDragOver={(event) => event.preventDefault()} onDrop={handleDropVideoAsset}>
                  <SceneTimelineEditor
                    actions={draft.actions}
                    selectedActionId={selectedActionId}
                    onSelectAction={handleSelectActionFromTimeline}
                    onMoveActionInTime={moveActionInTimeline}
                    onChangeActionLayerOrder={setActionLayerOrder}
                    currentTimeMs={currentTimelineTimeMs}
                    onSeekTimeMs={handleSeekTimelineTime}
                  />
                </Box>
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Inspector y capas</Typography>
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    onClick={() => moveSelectedAction(-1)}
                    disabled={selectedActionIndex <= 0}
                    startIcon={<ArrowUpwardIcon />}
                  >
                    Subir
                  </Button>
                  <Button
                    size="small"
                    onClick={() => moveSelectedAction(1)}
                    disabled={selectedActionIndex < 0 || selectedActionIndex >= draft.actions.length - 1}
                    startIcon={<ArrowDownwardIcon />}
                  >
                    Bajar
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={removeSelectedAction}
                    disabled={selectedActionIndex < 0}
                    startIcon={<DeleteIcon />}
                  >
                    Eliminar
                  </Button>
                  <Button
                    size="small"
                    onClick={() => moveSelectedLayerToEdge('top')}
                    disabled={selectedActionIndex < 0 || selectedActionIndex === draft.actions.length - 1}
                  >
                    Al frente
                  </Button>
                  <Button
                    size="small"
                    onClick={() => moveSelectedLayerToEdge('bottom')}
                    disabled={selectedActionIndex <= 0}
                  >
                    Al fondo
                  </Button>
                </Stack>
              </Stack>

              <Paper variant="outlined" sx={{ p: 1, mb: 1, maxHeight: 180, overflowY: 'auto' }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Capas (arrastra para cambiar superposición). Última = más arriba.
                  </Typography>
                  {draft.actions.map((action, index) => {
                    const isSelected = selectedActionId === action.id;
                    const targetKind = action.targetWindow?.kind ?? 'main';
                    return (
                      <Paper
                        key={action.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', action.id);
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOverActionId(action.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverActionId === action.id) setDragOverActionId(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const draggedActionId = event.dataTransfer.getData('text/plain');
                          const draggedAssetId = fromVideoDragPayload(draggedActionId);
                          if (draggedAssetId && action.type === 'sendVideoToWindow') {
                            updateAction(index, assignVideoAssetToAction(action, draggedAssetId));
                            setSelectedActionId(action.id);
                            setDragOverActionId(null);
                            return;
                          }
                          reorderActionsByIds(draggedActionId, action.id);
                          setDragOverActionId(null);
                        }}
                        onClick={() => setSelectedActionId(action.id)}
                        sx={{
                          p: 0.75,
                          cursor: 'grab',
                          border: '1px solid',
                          borderColor: isSelected
                            ? 'primary.main'
                            : dragOverActionId === action.id
                              ? 'secondary.main'
                              : 'divider',
                          bgcolor: isSelected ? 'action.selected' : 'background.paper',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                              {index + 1}. {action.type}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              Ventana: {targetKind}
                            </Typography>
                          </Stack>
                          <Chip size="small" label={`z${index + 1}`} />
                        </Stack>
                      </Paper>
                    );
                  })}
                  {draft.actions.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      No hay acciones creadas.
                    </Typography>
                  ) : null}
                </Stack>
              </Paper>

              <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {selectedAction ? (
                  <DndContext>
                    <SortableContext items={[selectedAction.id]} strategy={verticalListSortingStrategy}>
                      <SceneActionEditor
                        action={selectedAction}
                        index={selectedActionIndex + 1}
                        highlighted
                        sceneVideoAssets={sceneVideoAssets}
                        onRequestUploadVideo={handleUploadVideoClick}
                        onStartChromaColorPick={() => {
                          if (selectedAction.type !== 'sendImageToWindow' && selectedAction.type !== 'sendVideoToWindow') {
                            return;
                          }
                          setChromaPickActionId((current) => (current === selectedAction.id ? null : selectedAction.id));
                        }}
                        isChromaColorPicking={chromaPickActionId === selectedAction.id}
                        onChange={(updated) => {
                          if (selectedActionIndex < 0) return;
                          if (updated.type !== draft.actions[selectedActionIndex].type) {
                            handleChangeActionType(selectedActionIndex, updated.type);
                          } else {
                            updateAction(selectedActionIndex, updated);
                          }
                        }}
                        onRemove={removeSelectedAction}
                      />
                    </SortableContext>
                  </DndContext>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Selecciona un bloque en timeline o en la lista del inspector.
                  </Typography>
                )}
              </Box>
            </Paper>
          </Box>

          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SceneFormDialog;

function formatPreviewClock(valueMs: number): string {
  const totalSeconds = Math.floor(valueMs / 1000);
  const frames = Math.floor((valueMs % 1000) / (1000 / PREVIEW_FPS));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}
