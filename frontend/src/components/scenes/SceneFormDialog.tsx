import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { alpha } from '@mui/material/styles';
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
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import RepeatIcon from '@mui/icons-material/Repeat';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import UploadIcon from '@mui/icons-material/Upload';
import AuthImage from '../common/AuthImage';
import type { Scene, SceneActionDto, ScenePayload } from '../../types/scenes';
import type { SceneVideoAsset } from '../../types/scenes';
import {
  createSceneVideoClip,
  createSceneVideoSignedUrl,
  deleteSceneVideo,
  getSceneVideoDerivationStatus,
  listSceneVideos,
  updateSceneVideo,
  uploadSceneVideo,
} from '../../api/sceneVideos';
import { getMapImageUrlSized } from '../../api/maps';
import { useActiveMap } from '../Map/ActiveMapContext';
import { useTimeOfDay } from '../player/TimeOfDayContext';
import { useSecondaryWindowSizes, type WindowSize } from '../../hooks/useSecondaryWindowSizes';
import SkylineViewportContent from '../Skyline/SkylineViewportContent';
import ChromaKeyMedia from '../common/ChromaKeyMedia';
import SceneActionEditor from './SceneActionEditor';
import SceneTimelineEditor, { buildTimeline } from './SceneTimelineEditor';
import useSceneVideoMemoryWarmup from '../../hooks/useSceneVideoMemoryWarmup';
import ShortcutThumbnailPreview from '../shortcuts/ShortcutThumbnailPreview';
import EmojiPickerDialog from '../shortcuts/EmojiPickerDialog';
import { uploadShortcutIcon } from '../../api/shortcuts';

const SCENE_MAX_ACTIONS = 48;
const WINDOW_ACTION_TYPES = new Set([
  'sendImageToWindow',
  'sendVideoToWindow',
  'setWindowBackground',
  'applyWindowFilter',
  'clearWindowFilter',
  'setNarrativeText',
]);

const SPLITTABLE_ACTION_TYPES = new Set([
  'sendVideoToWindow',
  'sendImageToWindow',
  'playMusic',
  'playSound',
]);

const CLIP_METADATA_KEYS = [
  'splitGroupId',
  'splitIndex',
  'splitTotal',
  'parentActionId',
  'clipInSec',
  'clipOutSec',
  'clipDurationMs',
] as const;

type ScenePreviewWindowKind = 'main' | 'projection' | 'skyline';

const PROJECTION_SIZE_KEY = 'app.projection.size';
const SKYLINE_SIZE_KEY = 'app.projection.skyline.size';
const SCENE_EDITOR_MEMORY_WARMUP_KEY = 'app.sceneEditor.videoMemoryWarmup';
const PREVIEW_FPS = 30;
const DERIVATION_POLL_INTERVAL_MS = 1200;
const DERIVATION_MAX_POLLS = 45;
const PREVIEW_LAYER_SNAP_STEP_PCT = 1;
const PREVIEW_LAYER_MIN_SIZE_PCT = 5;
const PREVIEW_LAYER_STAGE_MIN_PCT = 0;
const PREVIEW_LAYER_STAGE_MAX_PCT = 100;

type LeftToolPanelMode = 'media' | 'text';

const NARRATIVE_TOOL_STYLE_PRESETS: Array<{
  id: string;
  label: string;
  subtitle: string;
  patch: Record<string, unknown>;
}> = [
    {
      id: 'title-cinematic',
      label: 'Titulo cinematografico',
      subtitle: 'Grande y centrado',
      patch: {
        title: 'Titulo',
        text: 'Escribe aqui tu narracion...',
        stylePresetId: 'cinematicTitle',
        leftPct: 12,
        topPct: 60,
        widthPct: 76,
        heightPct: 24,
        textAlign: 'center',
        fontFamily: 'Cinzel',
        fontSizePx: 42,
        fontWeight: 'bold',
        backgroundMode: 'none',
        backgroundOpacity: 0,
      },
    },
    {
      id: 'subtitle-card',
      label: 'Subtitulo',
      subtitle: 'Lectura limpia',
      patch: {
        title: '',
        text: 'Texto de apoyo o descripcion breve.',
        stylePresetId: 'subtitleCard',
        leftPct: 8,
        topPct: 70,
        widthPct: 84,
        heightPct: 20,
        textAlign: 'left',
        fontFamily: 'Merriweather',
        fontSizePx: 28,
        lineHeight: 1.45,
        backgroundMode: 'rect',
        backgroundColor: '#111111',
        backgroundOpacity: 0.62,
      },
    },
    {
      id: 'lower-third',
      label: 'Lower third',
      subtitle: 'Etiqueta inferior',
      patch: {
        title: 'Ubicacion',
        text: 'Detalle contextual',
        stylePresetId: 'lowerThird',
        leftPct: 6,
        topPct: 78,
        widthPct: 58,
        heightPct: 16,
        textAlign: 'left',
        fontFamily: 'Montserrat',
        fontSizePx: 24,
        fontWeight: 'bold',
        backgroundMode: 'capsule',
        backgroundColor: '#0b1f3a',
        backgroundOpacity: 0.74,
        borderRadiusPx: 18,
      },
    },
    {
      id: 'minimal-note',
      label: 'Nota minimal',
      subtitle: 'Sin fondo',
      patch: {
        title: '',
        text: 'Nota breve',
        stylePresetId: 'minimalNote',
        leftPct: 68,
        topPct: 12,
        widthPct: 26,
        heightPct: 14,
        textAlign: 'right',
        fontFamily: 'Lato',
        fontSizePx: 22,
        fontStyle: 'italic',
        backgroundMode: 'none',
        backgroundOpacity: 0,
      },
    },
  ];

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

function toNonNegativeSec(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function omitClipMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  for (const key of CLIP_METADATA_KEYS) {
    delete next[key];
  }
  return next;
}

function emptyPayload(type: string): Record<string, unknown> {
  switch (type) {
    case 'playMusic': return { songId: '', loop: false, volume: 80 };
    case 'stopMusic': return { stopEffects: false };
    case 'playSound': return { effectId: '', volume: 80, loopMode: 'once' };
    case 'setMusicVolume': return { value: 80 };
    case 'sendImageToWindow': return { imageUrl: '', title: '', opacity: 1, leftPct: 10, topPct: 10, widthPct: 80, heightPct: 80 };
    case 'sendVideoToWindow': return {
      loop: false,
      muted: false,
      opacity: 1,
      leftPct: 10,
      topPct: 10,
      widthPct: 80,
      heightPct: 80,
      loopSegmentEnabled: false,
      playIntroOncePerSceneExecution: true,
    };
    case 'setWindowBackground': return { imageUrl: '', sizing: 'cover' };
    case 'applyWindowFilter': return { filter: 'blur', intensity: 0.5, color: '' };
    case 'clearWindowFilter': return {};
    case 'setWeather': return { preset: 'rain', intensity: 0.5, durationMs: 0 };
    case 'setNarrativeText': return {
      text: '',
      title: '',
      durationMs: 0,
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
    };
    case 'runShortcut': return { shortcutId: '' };
    case 'delay': return { durationMs: 1000 };
    case 'runScene': return { sceneId: '' };
    default: return {};
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

function snapPct(value: number): number {
  return Math.round(value / PREVIEW_LAYER_SNAP_STEP_PCT) * PREVIEW_LAYER_SNAP_STEP_PCT;
}

function clampLayerMoveInsideStage(
  leftPct: number,
  topPct: number,
  widthPct: number,
  heightPct: number,
): { leftPct: number; topPct: number } {
  const maxLeft = Math.max(PREVIEW_LAYER_STAGE_MIN_PCT, PREVIEW_LAYER_STAGE_MAX_PCT - widthPct);
  const maxTop = Math.max(PREVIEW_LAYER_STAGE_MIN_PCT, PREVIEW_LAYER_STAGE_MAX_PCT - heightPct);
  return {
    leftPct: Math.max(PREVIEW_LAYER_STAGE_MIN_PCT, Math.min(maxLeft, leftPct)),
    topPct: Math.max(PREVIEW_LAYER_STAGE_MIN_PCT, Math.min(maxTop, topPct)),
  };
}

function clampLayerSizeInsideStage(
  widthPct: number,
  heightPct: number,
  leftPct: number,
  topPct: number,
): { widthPct: number; heightPct: number } {
  const maxWidth = Math.max(PREVIEW_LAYER_MIN_SIZE_PCT, PREVIEW_LAYER_STAGE_MAX_PCT - leftPct);
  const maxHeight = Math.max(PREVIEW_LAYER_MIN_SIZE_PCT, PREVIEW_LAYER_STAGE_MAX_PCT - topPct);
  return {
    widthPct: Math.max(PREVIEW_LAYER_MIN_SIZE_PCT, Math.min(maxWidth, widthPct)),
    heightPct: Math.max(PREVIEW_LAYER_MIN_SIZE_PCT, Math.min(maxHeight, heightPct)),
  };
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
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (n >= 0 && n <= 1) {
    return n * 100;
  }
  return n;
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
  const blocks = Array.isArray(richTextDoc?.blocks) ? richTextDoc?.blocks : [];
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
    const blockSegments = Array.isArray(blockRecord?.segments) ? blockRecord?.segments : [];
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

  if (segments.length > 0) {
    return segments;
  }

  const fallbackText = String(payload.text ?? '').trim();
  if (!fallbackText) return [];
  return [{ text: fallbackText }];
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
  const displayName = optionalText(payload.displayName);

  if (base.type === 'sendImageToWindow') {
    const placement = getPlacementFromPayload(payload);
    const timelineStartMs = toNonNegativeMs(payload.timelineStartMs);
    const durationMs = toPositiveDurationMs(payload.durationMs);
    return {
      ...base,
      payload: {
        imageUrl: String(payload.imageUrl ?? '').trim(),
        ...(displayName ? { displayName } : {}),
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
    const loopSegmentEnabled = Boolean(payload.loopSegmentEnabled);
    const loopSegmentStartMs = toNonNegativeMs(payload.loopSegmentStartMs);
    const loopSegmentEndMs = toNonNegativeMs(payload.loopSegmentEndMs);
    const hasValidLoopSegment = loopSegmentEnabled
      && loopSegmentStartMs !== undefined
      && (loopSegmentEndMs === undefined || loopSegmentEndMs > loopSegmentStartMs);
    const shouldLoopVideo = hasValidLoopSegment ? true : Boolean(payload.loop);
    return {
      ...base,
      payload: {
        ...(videoAssetId ? { videoAssetId } : {}),
        ...(videoUrl ? { videoUrl } : {}),
        ...(displayName ? { displayName } : {}),
        ...(optionalText(payload.videoAssetName) ? { videoAssetName: optionalText(payload.videoAssetName) } : {}),
        ...(payload.loop !== undefined || hasValidLoopSegment ? { loop: shouldLoopVideo } : {}),
        ...(payload.muted !== undefined ? { muted: Boolean(payload.muted) } : {}),
        ...(hasValidLoopSegment ? { loopSegmentEnabled: true } : {}),
        ...(hasValidLoopSegment ? { loopSegmentStartMs } : {}),
        ...(hasValidLoopSegment && loopSegmentEndMs !== undefined ? { loopSegmentEndMs } : {}),
        ...(hasValidLoopSegment
          ? { playIntroOncePerSceneExecution: payload.playIntroOncePerSceneExecution !== false }
          : {}),
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
        ...(displayName ? { displayName } : {}),
        ...(optionalText(payload.sizing) ? { sizing: optionalText(payload.sizing) } : {}),
      },
    };
  }

  if (base.type === 'applyWindowFilter') {
    return {
      ...base,
      payload: {
        filter: String(payload.filter ?? '').trim(),
        ...(displayName ? { displayName } : {}),
        ...(payload.intensity !== undefined && Number.isFinite(Number(payload.intensity))
          ? { intensity: Number(payload.intensity) }
          : {}),
        ...(optionalText(payload.color) ? { color: optionalText(payload.color) } : {}),
      },
    };
  }

  if (base.type === 'setNarrativeText') {
    const placement = getPlacementFromPayload(payload);
    const backgroundMode = String(payload.backgroundMode ?? 'rect').trim();
    const normalizedBackgroundMode = backgroundMode === 'none' || backgroundMode === 'capsule' ? backgroundMode : 'rect';
    const richTextDoc = asRecord(payload.richTextDoc);
    return {
      ...base,
      payload: {
        text: String(payload.text ?? '').trim(),
        ...(displayName ? { displayName } : {}),
        ...(optionalText(payload.title) ? { title: optionalText(payload.title) } : {}),
        ...(payload.durationMs !== undefined && Number.isFinite(Number(payload.durationMs))
          ? { durationMs: Number(payload.durationMs) }
          : {}),
        ...(richTextDoc ? { richTextDoc } : {}),
        leftPct: placement.leftPct,
        topPct: placement.topPct,
        widthPct: placement.widthPct,
        heightPct: placement.heightPct,
        ...(payload.opacity !== undefined ? { opacity: normalizeOpacity(payload.opacity) } : {}),
        ...(normalizedLayerOrder !== undefined ? { layerOrder: normalizedLayerOrder } : {}),
        ...(optionalText(payload.fontFamily) ? { fontFamily: optionalText(payload.fontFamily) } : {}),
        ...(payload.fontSizePx !== undefined && Number.isFinite(Number(payload.fontSizePx))
          ? { fontSizePx: Math.max(8, Math.min(220, Number(payload.fontSizePx))) }
          : {}),
        ...(optionalText(payload.fontColor) ? { fontColor: optionalText(payload.fontColor) } : {}),
        ...(optionalText(payload.textAlign) ? { textAlign: optionalText(payload.textAlign) } : {}),
        ...(payload.lineHeight !== undefined && Number.isFinite(Number(payload.lineHeight))
          ? { lineHeight: Math.max(0.8, Math.min(3, Number(payload.lineHeight))) }
          : {}),
        ...(payload.letterSpacingPx !== undefined && Number.isFinite(Number(payload.letterSpacingPx))
          ? { letterSpacingPx: Math.max(-8, Math.min(20, Number(payload.letterSpacingPx))) }
          : {}),
        ...(optionalText(payload.fontWeight) ? { fontWeight: optionalText(payload.fontWeight) } : {}),
        ...(optionalText(payload.fontStyle) ? { fontStyle: optionalText(payload.fontStyle) } : {}),
        ...(optionalText(payload.textDecoration) ? { textDecoration: optionalText(payload.textDecoration) } : {}),
        backgroundMode: normalizedBackgroundMode,
        ...(optionalText(payload.backgroundColor) ? { backgroundColor: optionalText(payload.backgroundColor) } : {}),
        ...(payload.backgroundOpacity !== undefined && Number.isFinite(Number(payload.backgroundOpacity))
          ? { backgroundOpacity: normalizeOpacity(payload.backgroundOpacity) }
          : {}),
        ...(payload.borderRadiusPx !== undefined && Number.isFinite(Number(payload.borderRadiusPx))
          ? { borderRadiusPx: Math.max(0, Math.min(128, Number(payload.borderRadiusPx))) }
          : {}),
        ...(payload.paddingPx !== undefined && Number.isFinite(Number(payload.paddingPx))
          ? { paddingPx: Math.max(0, Math.min(64, Number(payload.paddingPx))) }
          : {}),
      },
    };
  }

  if (base.type === 'playMusic') {
    return {
      ...base,
      payload: {
        ...(displayName ? { displayName } : {}),
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
        ...(displayName ? { displayName } : {}),
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
      payload: {
        ...(displayName ? { displayName } : {}),
        shortcutId: String(payload.shortcutId ?? '').trim(),
      },
    };
  }

  if (base.type === 'runScene') {
    return {
      ...base,
      payload: {
        ...(displayName ? { displayName } : {}),
        sceneId: String(payload.sceneId ?? '').trim(),
      },
    };
  }

  if (base.type === 'setMusicVolume') {
    return {
      ...base,
      payload: {
        ...(displayName ? { displayName } : {}),
        value: Number(payload.value ?? 80),
      },
    };
  }

  if (base.type === 'stopMusic') {
    return {
      ...base,
      payload: {
        ...(displayName ? { displayName } : {}),
        ...(payload.stopEffects !== undefined ? { stopEffects: Boolean(payload.stopEffects) } : {}),
      },
    };
  }

  if (base.type === 'delay') {
    return {
      ...base,
      payload: {
        ...(displayName ? { displayName } : {}),
        durationMs: Number(payload.durationMs ?? 1000),
      },
    };
  }

  if (base.type === 'setWeather') {
    return {
      ...base,
      payload: {
        ...(displayName ? { displayName } : {}),
        preset: String(payload.preset ?? '').trim(),
        ...(payload.intensity !== undefined && Number.isFinite(Number(payload.intensity))
          ? { intensity: Number(payload.intensity) }
          : {}),
        ...(payload.durationMs !== undefined && Number.isFinite(Number(payload.durationMs))
          ? { durationMs: Number(payload.durationMs) }
          : {}),
      },
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
    icon: null,
    imageUrl: null,
    loop: false,
    loopDelayMs: null,
    loopDelayRandomMinMs: null,
    loopDelayRandomMaxMs: null,
    loopWindowStartMs: null,
    loopWindowEndMs: null,
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
  const [previewLoopMode, setPreviewLoopMode] = useState<'full' | 'partial'>('full');
  const [currentTimelineTimeMs, setCurrentTimelineTimeMs] = useState<number>(0);
  const [previewSeekVersion, setPreviewSeekVersion] = useState<number>(0);
  const [previewLoopCycleIndex, setPreviewLoopCycleIndex] = useState<number>(0);
  const [projectionWindowSize, setProjectionWindowSize] = useState<WindowSize | null>(null);
  const [skylineWindowSize, setSkylineWindowSize] = useState<WindowSize | null>(null);
  const [chromaPickActionId, setChromaPickActionId] = useState<string | null>(null);
  const [dragOverActionId, setDragOverActionId] = useState<string | null>(null);
  const [leftToolPanelMode, setLeftToolPanelMode] = useState<LeftToolPanelMode>('media');
  const [videoLibraryQuery, setVideoLibraryQuery] = useState<string>('');
  const [renamingVideoId, setRenamingVideoId] = useState<string | null>(null);
  const [renamingVideoName, setRenamingVideoName] = useState<string>('');
  const [renamingVideoSubmitting, setRenamingVideoSubmitting] = useState<boolean>(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [derivingClipActionId, setDerivingClipActionId] = useState<string | null>(null);
  const [derivingClipErrorByActionId, setDerivingClipErrorByActionId] = useState<Record<string, string>>({});
  const [narrativeCanvasEditActionId, setNarrativeCanvasEditActionId] = useState<string | null>(null);
  const [narrativeCanvasDraft, setNarrativeCanvasDraft] = useState<{
    title: string;
    text: string;
    fontSizePx: number;
    fontColor: string;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline';
  } | null>(null);
  const [isPreviewMemoryWarmupEnabled, setIsPreviewMemoryWarmupEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SCENE_EDITOR_MEMORY_WARMUP_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const [iconPickerOpen, setIconPickerOpen] = useState<boolean>(false);
  const [uploadingIcon, setUploadingIcon] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iconFileInputRef = useRef<HTMLInputElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const signedVideoUrlCacheRef = useRef<Map<string, { url: string; expiresAtMs: number }>>(new Map());
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
  const [activeLayerDragPlacement, setActiveLayerDragPlacement] = useState<{
    actionId: string;
    leftPct: number;
    topPct: number;
    widthPct: number;
    heightPct: number;
  } | null>(null);

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const resolvedCampaignId = editing.campaignId ?? ((editing as unknown as { campaign?: { id?: string | null } }).campaign?.id ?? null);
      setDraft({
        name: editing.name,
        description: editing.description ?? '',
        icon: editing.icon ?? null,
        imageUrl: editing.imageUrl ?? null,
        loop: Boolean(editing.loop),
        loopDelayMs: editing.loopDelayMs ?? null,
        loopDelayRandomMinMs: editing.loopDelayRandomMinMs ?? null,
        loopDelayRandomMaxMs: editing.loopDelayRandomMaxMs ?? null,
        loopWindowStartMs: editing.loopWindowStartMs ?? null,
        loopWindowEndMs: editing.loopWindowEndMs ?? null,
        scope: editing.scope ?? 'campaign',
        campaignId: resolvedCampaignId,
        actions: (editing.actions ?? []).map(normalizeActionForEditor),
      });
    } else {
      setDraft(blankDraft(campaignId));
    }
    setError(null);
    setSelectedActionId(editing?.actions?.[0]?.id ?? null);
    setLeftToolPanelMode('media');
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
    try {
      localStorage.setItem(SCENE_EDITOR_MEMORY_WARMUP_KEY, isPreviewMemoryWarmupEnabled ? 'on' : 'off');
    } catch {
      // Ignore localStorage write failures in restricted environments.
    }
  }, [isPreviewMemoryWarmupEnabled]);

  useEffect(() => {
    if (!selectedActionId && chromaPickActionId) {
      setChromaPickActionId(null);
      return;
    }
    if (chromaPickActionId && chromaPickActionId !== selectedActionId) {
      setChromaPickActionId(null);
    }
  }, [selectedActionId, chromaPickActionId]);

  useEffect(() => {
    if (!narrativeCanvasEditActionId) return;
    if (!selectedActionId || selectedActionId !== narrativeCanvasEditActionId) {
      setNarrativeCanvasEditActionId(null);
      setNarrativeCanvasDraft(null);
      return;
    }
    const active = draft.actions.find((action) => action.id === narrativeCanvasEditActionId);
    if (!active || active.type !== 'setNarrativeText') {
      setNarrativeCanvasEditActionId(null);
      setNarrativeCanvasDraft(null);
    }
  }, [selectedActionId, narrativeCanvasEditActionId, draft.actions]);

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
  const hasValidLoopWindow = useMemo(() => {
    const startMs = Number(draft.loopWindowStartMs);
    const endMs = Number(draft.loopWindowEndMs);
    return Boolean(
      draft.loop
      && Number.isFinite(startMs)
      && Number.isFinite(endMs)
      && startMs >= 0
      && endMs > startMs,
    );
  }, [draft.loop, draft.loopWindowEndMs, draft.loopWindowStartMs]);
  const effectivePreviewLoopMode = previewLoopMode === 'partial' && hasValidLoopWindow ? 'partial' : 'full';
  const previewLoopWindow = useMemo(() => {
    if (effectivePreviewLoopMode !== 'partial' || !hasValidLoopWindow) return null;

    const startMs = Math.max(0, Math.round(Number(draft.loopWindowStartMs ?? 0)));
    const endMs = Math.min(
      timelineDurationMs,
      Math.max(startMs + 1, Math.round(Number(draft.loopWindowEndMs ?? timelineDurationMs))),
    );
    if (endMs <= startMs) return null;

    return {
      startMs,
      endMs,
      durationMs: endMs - startMs,
    };
  }, [effectivePreviewLoopMode, hasValidLoopWindow, draft.loopWindowStartMs, draft.loopWindowEndMs, timelineDurationMs]);

  useEffect(() => {
    if (!open || !draft.loop) return;
    if (hasValidLoopWindow) return;
    if (!Number.isFinite(timelineDurationMs) || timelineDurationMs <= 0) return;

    setDraft((currentDraft) => {
      if (!currentDraft.loop) return currentDraft;
      const startMs = Number(currentDraft.loopWindowStartMs);
      const endMs = Number(currentDraft.loopWindowEndMs);
      const alreadyValid = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs >= 0 && endMs > startMs;
      if (alreadyValid) return currentDraft;
      return {
        ...currentDraft,
        loopWindowStartMs: 0,
        loopWindowEndMs: Math.max(1, Math.round(timelineDurationMs)),
      };
    });
  }, [open, draft.loop, hasValidLoopWindow, timelineDurationMs]);

  useEffect(() => {
    if (!open) {
      setIsPreviewPlaying(false);
      setCurrentTimelineTimeMs(0);
      setPreviewLoopCycleIndex(0);
      return;
    }
    setCurrentTimelineTimeMs((current) => Math.max(0, Math.min(timelineDurationMs, current)));
  }, [open, timelineDurationMs]);

  useEffect(() => {
    if (!open) return;
    setPreviewLoopCycleIndex(0);
  }, [open, editing?.id, effectivePreviewLoopMode]);

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
            if (previewLoopWindow) {
              const overflowMs = Math.max(0, next - timelineDurationMs);
              setPreviewLoopCycleIndex((cycle) => Math.max(1, cycle + 1));
              setPreviewSeekVersion((version) => version + 1);
              return previewLoopWindow.startMs + (overflowMs % previewLoopWindow.durationMs);
            }
            return next % timelineDurationMs;
          }
          setIsPreviewPlaying(false);
          return timelineDurationMs;
        }

        if (isPreviewLooping && previewLoopWindow && previewLoopCycleIndex > 0) {
          if (next < previewLoopWindow.startMs) {
            return previewLoopWindow.startMs;
          }
          if (next >= previewLoopWindow.endMs) {
            return previewLoopWindow.startMs + ((next - previewLoopWindow.startMs) % previewLoopWindow.durationMs);
          }
        }
        return next;
      });
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    isPreviewPlaying,
    isPreviewLooping,
    open,
    timelineDurationMs,
    previewLoopWindow,
    previewLoopCycleIndex,
  ]);

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
      if (narrativeCanvasEditActionId) return;

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
  }, [open, timelineDurationMs, narrativeCanvasEditActionId]);

  const set = <K extends keyof ScenePayload>(key: K, value: ScenePayload[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const loopDelayMode = useMemo<'immediate' | 'fixed' | 'random'>(() => {
    if ((draft.loopDelayRandomMinMs ?? null) !== null || (draft.loopDelayRandomMaxMs ?? null) !== null) {
      return 'random';
    }
    if ((draft.loopDelayMs ?? null) !== null) {
      return 'fixed';
    }
    return 'immediate';
  }, [draft.loopDelayMs, draft.loopDelayRandomMaxMs, draft.loopDelayRandomMinMs]);

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

  const beginNarrativeCanvasEdit = (action: SceneActionDto) => {
    if (action.type !== 'setNarrativeText') return;
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const textAlignRaw = String(payload.textAlign ?? 'left').trim();
    const textAlign: 'left' | 'center' | 'right' | 'justify' =
      textAlignRaw === 'center' || textAlignRaw === 'right' || textAlignRaw === 'justify'
        ? textAlignRaw
        : 'left';
    setNarrativeCanvasEditActionId(action.id);
    setNarrativeCanvasDraft({
      title: String(payload.title ?? ''),
      text: String(payload.text ?? ''),
      fontSizePx: Number.isFinite(Number(payload.fontSizePx)) ? Math.max(8, Math.min(220, Number(payload.fontSizePx))) : 28,
      fontColor: String(payload.fontColor ?? '#ffffff').trim() || '#ffffff',
      textAlign,
      fontWeight: String(payload.fontWeight ?? 'normal').trim() === 'bold' ? 'bold' : 'normal',
      fontStyle: String(payload.fontStyle ?? 'normal').trim() === 'italic' ? 'italic' : 'normal',
      textDecoration: String(payload.textDecoration ?? 'none').trim() === 'underline' ? 'underline' : 'none',
    });
    setIsPreviewPlaying(false);
  };

  const createNarrativeActionAndStartEdit = (presetPatch?: Record<string, unknown>) => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;

    const basePayload = emptyPayload('setNarrativeText');
    const payload = {
      ...basePayload,
      ...(presetPatch ?? {}),
    } as Record<string, unknown>;

    const next: SceneActionDto = {
      id: uuidv4(),
      type: 'setNarrativeText',
      delay: 0,
      payload,
    };

    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
    setLeftToolPanelMode('text');
    beginNarrativeCanvasEdit(next);
  };

  const finishNarrativeCanvasEdit = (mode: 'save' | 'cancel') => {
    if (!narrativeCanvasEditActionId) return;
    if (mode === 'save' && narrativeCanvasDraft) {
      const title = narrativeCanvasDraft.title.trim();
      const text = narrativeCanvasDraft.text;
      updateActionById(narrativeCanvasEditActionId, (action) => ({
        ...action,
        payload: {
          ...(action.payload ?? {}),
          text,
          ...(title ? { title } : { title: '' }),
          fontSizePx: narrativeCanvasDraft.fontSizePx,
          fontColor: narrativeCanvasDraft.fontColor,
          textAlign: narrativeCanvasDraft.textAlign,
          fontWeight: narrativeCanvasDraft.fontWeight,
          fontStyle: narrativeCanvasDraft.fontStyle,
          textDecoration: narrativeCanvasDraft.textDecoration,
        },
      }));
    }
    setNarrativeCanvasEditActionId(null);
    setNarrativeCanvasDraft(null);
  };

  const removeAction = (index: number) => {
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, i) => i !== index) }));
  };

  const handleSelectActionFromTimeline = (actionId: string) => {
    selectActionAndSeekToStart(actionId);
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

  const handlePickEmoji = (emoji: string) => {
    setDraft((d) => ({
      ...d,
      icon: emoji || null,
      imageUrl: null,
    }));
  };

  const handleUploadSceneIconClick = () => {
    iconFileInputRef.current?.click();
  };

  const handleIconFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingIcon(true);
    try {
      const iconUrl = await uploadShortcutIcon(file);
      setDraft((d) => ({ ...d, imageUrl: iconUrl, icon: null }));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al subir el icono.');
    } finally {
      setUploadingIcon(false);
      if (event.target) event.target.value = '';
    }
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

  const handleStartRenameVideo = (asset: SceneVideoAsset) => {
    setRenamingVideoId(asset.id);
    setRenamingVideoName(asset.name);
  };

  const handleCancelRenameVideo = () => {
    setRenamingVideoId(null);
    setRenamingVideoName('');
  };

  const handleConfirmRenameVideo = async (assetId: string) => {
    const nextName = renamingVideoName.trim();
    if (!nextName) {
      setError('El nombre del video no puede estar vacio.');
      return;
    }

    setRenamingVideoSubmitting(true);
    try {
      await updateSceneVideo(assetId, { name: nextName });
      const refreshed = await listSceneVideos(campaignId ?? undefined);
      setSceneVideoAssets(refreshed);
      setRenamingVideoId(null);
      setRenamingVideoName('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al renombrar video.');
    } finally {
      setRenamingVideoSubmitting(false);
    }
  };

  const handleDeleteVideoAsset = async (asset: SceneVideoAsset) => {
    const confirmed = window.confirm(`¿Eliminar el video "${asset.name}"?`);
    if (!confirmed) return;

    setDeletingVideoId(asset.id);
    try {
      await deleteSceneVideo(asset.id);
      const refreshed = await listSceneVideos(campaignId ?? undefined);
      setSceneVideoAssets(refreshed);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al eliminar video.');
    } finally {
      setDeletingVideoId(null);
    }
  };

  const selectedActionIndex = draft.actions.findIndex((action) => action.id === selectedActionId);
  const selectedAction = selectedActionIndex >= 0 ? draft.actions[selectedActionIndex] : null;
  const lockPreviewInteractionToSelectedNarrative = Boolean(
    selectedAction
    && selectedAction.type === 'setNarrativeText'
    && (leftToolPanelMode === 'text' || narrativeCanvasEditActionId === selectedAction.id),
  );
  const selectedPreviewGuidePlacement = useMemo(() => {
    if (!selectedAction) return null;
    if (!['sendImageToWindow', 'sendVideoToWindow', 'setNarrativeText'].includes(selectedAction.type)) {
      return null;
    }
    const payload = (selectedAction.payload ?? {}) as Record<string, unknown>;
    if (selectedAction.type === 'setNarrativeText') {
      const placement = getPlacementFromPayload(payload);
      return {
        actionId: selectedAction.id,
        leftPct: placement.leftPct,
        topPct: placement.topPct,
        widthPct: placement.widthPct,
        heightPct: placement.heightPct,
      };
    }

    return {
      actionId: selectedAction.id,
      leftPct: normalizeFreePlacement(payload.leftPct, 10),
      topPct: normalizeFreePlacement(payload.topPct, 10),
      widthPct: Math.max(1, normalizeFreePlacement(payload.widthPct, 80)),
      heightPct: Math.max(1, normalizeFreePlacement(payload.heightPct, 80)),
    };
  }, [selectedAction]);
  const activePreviewGuidePlacement = activeLayerDragPlacement
    && selectedActionId
    && activeLayerDragPlacement.actionId === selectedActionId
    ? activeLayerDragPlacement
    : selectedPreviewGuidePlacement;
  const selectedTimelineEntry = selectedAction ? timelineEntriesByActionId.get(selectedAction.id) : undefined;
  const canSplitSelectedAction = Boolean(
    selectedAction
    && selectedTimelineEntry
    && SPLITTABLE_ACTION_TYPES.has(selectedAction.type)
    && currentTimelineTimeMs > selectedTimelineEntry.startMs
    && currentTimelineTimeMs < selectedTimelineEntry.endMs,
  );
  const canJoinSelectedWithNext = useMemo(() => {
    if (!selectedAction || selectedActionIndex < 0) return false;
    const nextAction = draft.actions[selectedActionIndex + 1];
    if (!nextAction) return false;
    if (selectedAction.type !== nextAction.type) return false;

    const currentPayload = (selectedAction.payload ?? {}) as Record<string, unknown>;
    const nextPayload = (nextAction.payload ?? {}) as Record<string, unknown>;
    const currentGroupId = typeof currentPayload.splitGroupId === 'string' ? currentPayload.splitGroupId : '';
    const nextGroupId = typeof nextPayload.splitGroupId === 'string' ? nextPayload.splitGroupId : '';
    if (!currentGroupId || currentGroupId !== nextGroupId) return false;

    const currentEntry = timelineEntriesByActionId.get(selectedAction.id);
    const nextEntry = timelineEntriesByActionId.get(nextAction.id);
    if (!currentEntry || !nextEntry) return false;
    if (Math.abs(nextEntry.startMs - currentEntry.endMs) > 50) return false;

    const sameTargetWindow = JSON.stringify(selectedAction.targetWindow ?? null) === JSON.stringify(nextAction.targetWindow ?? null);
    if (!sameTargetWindow) return false;

    return JSON.stringify(omitClipMetadata(currentPayload)) === JSON.stringify(omitClipMetadata(nextPayload));
  }, [draft.actions, selectedAction, selectedActionIndex, timelineEntriesByActionId]);
  const filteredSceneVideoAssets = useMemo(() => {
    const query = videoLibraryQuery.trim().toLowerCase();
    if (!query) return sceneVideoAssets;
    return sceneVideoAssets.filter((asset) => {
      const haystack = `${asset.name} ${asset.originalFilename}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [sceneVideoAssets, videoLibraryQuery]);
  const videoActionSources = useMemo(() => {
    return draft.actions
      .filter((action) => action.type === 'sendVideoToWindow')
      .map((action) => {
        const payload = (action.payload ?? {}) as Record<string, unknown>;
        const directVideoUrl = String(payload.videoUrl ?? '').trim();
        const videoAssetId = String(payload.videoAssetId ?? '').trim();
        return {
          actionId: action.id,
          directVideoUrl,
          videoAssetId,
        };
      });
  }, [draft.actions]);
  const prioritizedVideoActionIds = useMemo(() => {
    const ids = videoActionSources.map((source) => source.actionId);
    if (!selectedActionId || !ids.includes(selectedActionId)) {
      return ids;
    }
    return [selectedActionId, ...ids.filter((id) => id !== selectedActionId)];
  }, [selectedActionId, videoActionSources]);
  const {
    resolvedUrlsByActionId: previewMediaUrlsByActionId,
    warmedActionCount,
    targetedActionCount,
  } = useSceneVideoMemoryWarmup({
    open,
    enabled: isPreviewMemoryWarmupEnabled,
    urlsByActionId: videoPreviewUrlsByActionId,
    prioritizedActionIds: prioritizedVideoActionIds,
  });

  const createVideoActionFromAsset = (assetId: string): SceneActionDto => {
    const asset = sceneVideoAssets.find((item) => item.id === assetId);
    const assetDurationMs = toPositiveDurationMs(asset?.durationMs);
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
        ...(asset?.name ? { videoAssetName: asset.name } : {}),
        ...(assetDurationMs !== undefined ? { durationMs: assetDurationMs } : {}),
      },
    };
  };

  const assignVideoAssetToAction = (action: SceneActionDto, assetId: string): SceneActionDto => {
    const asset = sceneVideoAssets.find((item) => item.id === assetId);
    const assetDurationMs = toPositiveDurationMs(asset?.durationMs);
    const payload = { ...(action.payload ?? {}), videoAssetId: assetId } as Record<string, unknown>;
    delete payload.videoUrl;
    if (asset?.name) {
      payload.videoAssetName = asset.name;
    }
    if (assetDurationMs !== undefined) {
      payload.durationMs = assetDurationMs;
    }
    return { ...action, payload };
  };

  useEffect(() => {
    if (!open || sceneVideoAssets.length === 0) return;

    const metadataByAssetId = new Map<string, { durationMs?: number; name?: string }>();
    for (const asset of sceneVideoAssets) {
      const durationMs = toPositiveDurationMs(asset.durationMs);
      metadataByAssetId.set(asset.id, {
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(asset.name ? { name: asset.name } : {}),
      });
    }
    if (metadataByAssetId.size === 0) return;

    setDraft((currentDraft) => {
      let changed = false;
      const nextActions = currentDraft.actions.map((action) => {
        if (action.type !== 'sendVideoToWindow') return action;
        const payload = (action.payload ?? {}) as Record<string, unknown>;
        const assetId = String(payload.videoAssetId ?? '').trim();
        if (!assetId) return action;
        const metadata = metadataByAssetId.get(assetId);
        if (!metadata) return action;

        const currentDurationMs = toPositiveDurationMs(payload.durationMs);
        const currentAssetName = typeof payload.videoAssetName === 'string' ? payload.videoAssetName.trim() : '';
        const expectedDurationMs = metadata.durationMs;
        const expectedAssetName = metadata.name ?? '';

        const durationChanged = expectedDurationMs !== undefined && currentDurationMs !== expectedDurationMs;
        const nameChanged = expectedAssetName !== '' && currentAssetName !== expectedAssetName;
        if (!durationChanged && !nameChanged) return action;

        changed = true;
        return {
          ...action,
          payload: {
            ...payload,
            ...(durationChanged ? { durationMs: expectedDurationMs } : {}),
            ...(nameChanged ? { videoAssetName: expectedAssetName } : {}),
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
      return Boolean(previewMediaUrlsByActionId[action.id]);
    });

    if (pendingActions.length === 0) return;

    let cancelled = false;

    const syncDurations = async () => {
      const measuredByActionId = new Map<string, number>();
      for (const action of pendingActions) {
        const url = previewMediaUrlsByActionId[action.id];
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
  }, [open, draft.actions, previewMediaUrlsByActionId]);

  const createActionByDroppingVideoAsset = (assetId: string) => {
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
    if (!open) {
      setVideoPreviewUrlsByActionId({});
      setVideoPreviewErrorsByActionId({});
      setDerivingClipActionId(null);
      setDerivingClipErrorByActionId({});
      return;
    }

    let cancelled = false;

    const loadPreviewVideos = async () => {
      if (!videoActionSources.length) {
        setVideoPreviewUrlsByActionId({});
        setVideoPreviewErrorsByActionId({});
        return;
      }

      const resolvedUrls: Record<string, string> = {};
      const resolvedErrors: Record<string, string> = {};
      const pendingByAssetId = new Map<string, Promise<string>>();

      await Promise.all(videoActionSources.map(async ({ actionId, directVideoUrl, videoAssetId }) => {
        if (directVideoUrl) {
          resolvedUrls[actionId] = resolveSceneMediaUrl(directVideoUrl);
          return;
        }

        if (!videoAssetId) {
          return;
        }

        const now = Date.now();
        const cached = signedVideoUrlCacheRef.current.get(videoAssetId);
        if (cached && cached.expiresAtMs - now > 30_000) {
          resolvedUrls[actionId] = cached.url;
          return;
        }

        let pending = pendingByAssetId.get(videoAssetId);
        if (!pending) {
          pending = (async () => {
            const signed = await createSceneVideoSignedUrl(videoAssetId);
            const resolvedUrl = resolveSceneMediaUrl(signed.url);
            const expiresAtMs = Number(signed.expiresAt) * 1000;
            signedVideoUrlCacheRef.current.set(videoAssetId, {
              url: resolvedUrl,
              expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now() + 60_000,
            });
            return resolvedUrl;
          })();
          pendingByAssetId.set(videoAssetId, pending);
        }

        try {
          resolvedUrls[actionId] = await pending;
        } catch (err: any) {
          resolvedErrors[actionId] = err?.message ?? 'No se pudo resolver el video';
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
  }, [open, videoActionSources]);

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

  const splitSelectedActionAtPlayhead = () => {
    if (!selectedAction || selectedActionIndex < 0) return;
    if (!SPLITTABLE_ACTION_TYPES.has(selectedAction.type)) return;

    const timelineEntry = timelineEntriesByActionId.get(selectedAction.id);
    if (!timelineEntry) return;

    const splitAtMs = Math.round(Math.max(timelineEntry.startMs + 1, Math.min(timelineEntry.endMs - 1, currentTimelineTimeMs)));
    if (splitAtMs <= timelineEntry.startMs || splitAtMs >= timelineEntry.endMs) return;

    const leftDurationMs = splitAtMs - timelineEntry.startMs;
    const rightDurationMs = timelineEntry.endMs - splitAtMs;
    if (leftDurationMs <= 0 || rightDurationMs <= 0) return;

    const payload = { ...(selectedAction.payload ?? {}) } as Record<string, unknown>;
    const basePayload = omitClipMetadata(payload);
    const clipInSec = toNonNegativeSec(payload.clipInSec) ?? 0;
    const explicitClipOutSec = toNonNegativeSec(payload.clipOutSec);
    const fallbackClipOutSec = clipInSec + (timelineEntry.durationMs / 1000);
    const clipOutSec = explicitClipOutSec !== undefined && explicitClipOutSec > clipInSec
      ? explicitClipOutSec
      : fallbackClipOutSec;

    const leftClipOutSec = Math.min(clipOutSec, clipInSec + (leftDurationMs / 1000));
    const rightClipInSec = leftClipOutSec;
    const splitGroupId = uuidv4();

    const leftAction: SceneActionDto = {
      ...selectedAction,
      payload: {
        ...basePayload,
        durationMs: leftDurationMs,
        clipDurationMs: leftDurationMs,
        clipInSec,
        clipOutSec: leftClipOutSec,
        splitGroupId,
        splitIndex: 0,
        splitTotal: 2,
        parentActionId: selectedAction.id,
      },
    };

    const rightAction: SceneActionDto = {
      ...selectedAction,
      id: uuidv4(),
      payload: {
        ...basePayload,
        timelineStartMs: splitAtMs,
        durationMs: rightDurationMs,
        clipDurationMs: rightDurationMs,
        clipInSec: rightClipInSec,
        clipOutSec,
        splitGroupId,
        splitIndex: 1,
        splitTotal: 2,
        parentActionId: selectedAction.id,
      },
    };

    setDraft((currentDraft) => {
      const nextActions = [...currentDraft.actions];
      nextActions[selectedActionIndex] = leftAction;
      nextActions.splice(selectedActionIndex + 1, 0, rightAction);
      return {
        ...currentDraft,
        actions: nextActions,
      };
    });
    setSelectedActionId(rightAction.id);
  };

  const selectedClipDerivationCandidate = useMemo(() => {
    if (!selectedAction || selectedAction.type !== 'sendVideoToWindow' || !selectedTimelineEntry) {
      return null;
    }

    const payload = (selectedAction.payload ?? {}) as Record<string, unknown>;
    const videoAssetId = String(payload.videoAssetId ?? '').trim();
    if (!videoAssetId) {
      return null;
    }

    const startSec = toNonNegativeSec(payload.clipInSec) ?? 0;
    const explicitEndSec = toNonNegativeSec(payload.clipOutSec);
    const fallbackEndSec = startSec + (selectedTimelineEntry.durationMs / 1000);
    const endSec = explicitEndSec !== undefined && explicitEndSec > startSec
      ? explicitEndSec
      : fallbackEndSec;
    if (!Number.isFinite(endSec) || endSec <= startSec) {
      return null;
    }

    const sourceAsset = sceneVideoAssets.find((asset) => asset.id === videoAssetId);
    return {
      actionId: selectedAction.id,
      videoAssetId,
      startSec,
      endSec,
      sourceAssetName: sourceAsset?.name ?? 'Clip',
    };
  }, [selectedAction, selectedTimelineEntry, sceneVideoAssets]);

  const canCreateDerivedClip = Boolean(selectedClipDerivationCandidate) && derivingClipActionId !== selectedActionId;

  const createDerivedClipFromSelectedAction = async () => {
    if (!selectedAction || !selectedClipDerivationCandidate) return;

    const { actionId, videoAssetId, startSec, endSec, sourceAssetName } = selectedClipDerivationCandidate;
    setDerivingClipActionId(actionId);
    setDerivingClipErrorByActionId((current) => {
      const next = { ...current };
      delete next[actionId];
      return next;
    });

    try {
      const initialClip = await createSceneVideoClip(videoAssetId, {
        startSec,
        endSec,
        name: `${sourceAssetName} (clip ${startSec.toFixed(2)}-${endSec.toFixed(2)})`,
      });

      setSceneVideoAssets((current) => {
        const existingIndex = current.findIndex((item) => item.id === initialClip.id);
        if (existingIndex < 0) return [initialClip, ...current];
        const next = [...current];
        next[existingIndex] = initialClip;
        return next;
      });

      let derivedAsset = initialClip;
      let completed = false;
      for (let i = 0; i < DERIVATION_MAX_POLLS; i += 1) {
        const status = await getSceneVideoDerivationStatus(initialClip.id);
        if (status.processingStatus === 'ready') {
          const refreshedAssets = await listSceneVideos(campaignId ?? undefined);
          setSceneVideoAssets(refreshedAssets);
          const refreshed = refreshedAssets.find((asset) => asset.id === initialClip.id);
          if (refreshed) {
            derivedAsset = refreshed;
          }
          completed = true;
          break;
        }

        if (status.processingStatus === 'failed') {
          throw new Error(status.processingError || 'No se pudo procesar el clip derivado.');
        }

        await waitMs(DERIVATION_POLL_INTERVAL_MS);
      }

      if (!completed) {
        throw new Error('El clip sigue procesandose. Reintenta en unos segundos.');
      }

      updateActionById(actionId, (action) => {
        if (action.type !== 'sendVideoToWindow') return action;
        const payload = omitClipMetadata((action.payload ?? {}) as Record<string, unknown>);
        delete payload.videoUrl;
        return {
          ...action,
          payload: {
            ...payload,
            videoAssetId: derivedAsset.id,
            videoAssetName: derivedAsset.name,
            ...(toPositiveDurationMs(derivedAsset.durationMs) !== undefined
              ? { durationMs: toPositiveDurationMs(derivedAsset.durationMs) }
              : {}),
          },
        };
      });
    } catch (err: any) {
      const message = String(err?.response?.data?.message || err?.message || 'Error al crear clip derivado.');
      setDerivingClipErrorByActionId((current) => ({ ...current, [actionId]: message }));
      setError(message);
    } finally {
      setDerivingClipActionId((current) => (current === actionId ? null : current));
    }
  };

  const joinSelectedWithNextAction = () => {
    if (!selectedAction || selectedActionIndex < 0) return;
    const nextAction = draft.actions[selectedActionIndex + 1];
    if (!nextAction) return;
    if (selectedAction.type !== nextAction.type) return;

    const currentPayload = (selectedAction.payload ?? {}) as Record<string, unknown>;
    const nextPayload = (nextAction.payload ?? {}) as Record<string, unknown>;
    const currentGroupId = typeof currentPayload.splitGroupId === 'string' ? currentPayload.splitGroupId : '';
    const nextGroupId = typeof nextPayload.splitGroupId === 'string' ? nextPayload.splitGroupId : '';
    if (!currentGroupId || currentGroupId !== nextGroupId) return;

    const currentEntry = timelineEntriesByActionId.get(selectedAction.id);
    const nextEntry = timelineEntriesByActionId.get(nextAction.id);
    if (!currentEntry || !nextEntry) return;
    if (Math.abs(nextEntry.startMs - currentEntry.endMs) > 50) return;

    const sameTargetWindow = JSON.stringify(selectedAction.targetWindow ?? null) === JSON.stringify(nextAction.targetWindow ?? null);
    if (!sameTargetWindow) return;

    const currentComparable = JSON.stringify(omitClipMetadata(currentPayload));
    const nextComparable = JSON.stringify(omitClipMetadata(nextPayload));
    if (currentComparable !== nextComparable) return;

    const mergedPayload = {
      ...omitClipMetadata(currentPayload),
      timelineStartMs: currentEntry.startMs,
      durationMs: currentEntry.durationMs + nextEntry.durationMs,
      clipDurationMs: currentEntry.durationMs + nextEntry.durationMs,
      clipInSec: toNonNegativeSec(currentPayload.clipInSec) ?? 0,
      clipOutSec: toNonNegativeSec(nextPayload.clipOutSec)
        ?? ((toNonNegativeSec(currentPayload.clipInSec) ?? 0) + ((currentEntry.durationMs + nextEntry.durationMs) / 1000)),
    } as Record<string, unknown>;

    const mergedAction: SceneActionDto = {
      ...selectedAction,
      payload: mergedPayload,
    };

    setDraft((currentDraft) => {
      const nextActions = [...currentDraft.actions];
      nextActions[selectedActionIndex] = mergedAction;
      nextActions.splice(selectedActionIndex + 1, 1);
      return {
        ...currentDraft,
        actions: nextActions,
      };
    });
    setSelectedActionId(mergedAction.id);
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

  const changeActionDurationInTimeline = (actionId: string, nextDurationMs: number, nextStartMs?: number) => {
    const snappedDurationMs = Math.max(200, Math.round(nextDurationMs / 100) * 100);
    updateActionById(actionId, (action) => {
      const payload: Record<string, any> = {
        ...(action.payload ?? {}),
        durationMs: snappedDurationMs,
      };
      if (nextStartMs !== undefined) {
        payload.timelineStartMs = Math.max(0, Math.round(nextStartMs / 100) * 100);
      }
      return {
        ...action,
        payload,
      };
    });
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
    setActiveLayerDragPlacement({
      actionId: action.id,
      leftPct: normalizeFreePlacement((payload as Record<string, unknown>).leftPct, 10),
      topPct: normalizeFreePlacement((payload as Record<string, unknown>).topPct, 10),
      widthPct: Math.max(PREVIEW_LAYER_MIN_SIZE_PCT, normalizeFreePlacement((payload as Record<string, unknown>).widthPct, 80)),
      heightPct: Math.max(PREVIEW_LAYER_MIN_SIZE_PCT, normalizeFreePlacement((payload as Record<string, unknown>).heightPct, 80)),
    });

    const onMouseMove = (moveEvent: MouseEvent) => {
      const drag = layerDragRef.current;
      const rect = previewStageRef.current?.getBoundingClientRect();
      if (!drag || !rect || rect.width <= 0 || rect.height <= 0) return;

      const dxPct = ((moveEvent.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((moveEvent.clientY - drag.startY) / rect.height) * 100;

      if (drag.mode === 'move') {
        const widthPct = drag.originWidthPct;
        const heightPct = drag.originHeightPct;
        const snappedLeft = snapPct(drag.originLeftPct + dxPct);
        const snappedTop = snapPct(drag.originTopPct + dyPct);
        const { leftPct, topPct } = clampLayerMoveInsideStage(snappedLeft, snappedTop, widthPct, heightPct);
        updateLayerPlacementByActionId(drag.actionId, { leftPct, topPct });
        setActiveLayerDragPlacement({
          actionId: drag.actionId,
          leftPct,
          topPct,
          widthPct,
          heightPct,
        });
        return;
      }

      const leftPct = drag.originLeftPct;
      const topPct = drag.originTopPct;
      const snappedWidth = snapPct(drag.originWidthPct + dxPct);
      const snappedHeight = snapPct(drag.originHeightPct + dyPct);
      const { widthPct, heightPct } = clampLayerSizeInsideStage(snappedWidth, snappedHeight, leftPct, topPct);
      updateLayerPlacementByActionId(drag.actionId, { widthPct, heightPct });
      setActiveLayerDragPlacement({
        actionId: drag.actionId,
        leftPct,
        topPct,
        widthPct,
        heightPct,
      });
    };

    const onMouseUp = () => {
      layerDragRef.current = null;
      setActiveLayerDragPlacement(null);
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
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  };

  const selectActionAndSeekToStart = useCallback((actionId: string) => {
    setSelectedActionId(actionId);
    const selectedAction = draft.actions.find((action) => action.id === actionId);
    if (selectedAction?.type === 'setNarrativeText') {
      setLeftToolPanelMode('text');
    }

    const timelineEntry = timelineEntriesByActionId.get(actionId);
    const startMs = timelineEntry?.startMs ?? 0;
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(Math.max(0, Math.min(timelineDurationMs, startMs)));
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  }, [draft.actions, timelineDurationMs, timelineEntriesByActionId]);

  const handleSetLoopWindow = useCallback((nextStartMs: number, nextEndMs: number) => {
    setDraft((currentDraft) => {
      if (!currentDraft.loop) return currentDraft;
      return {
        ...currentDraft,
        loopWindowStartMs: Math.max(0, Math.round(nextStartMs)),
        loopWindowEndMs: Math.max(Math.round(nextStartMs) + 1, Math.round(nextEndMs)),
      };
    });
  }, []);

  const frameStepMs = 1000 / PREVIEW_FPS;
  const stepPreviewFrame = (direction: -1 | 1) => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs((current) => {
      const next = current + direction * frameStepMs;
      return Math.max(0, Math.min(timelineDurationMs, next));
    });
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  };

  const goToTimelineStart = () => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(0);
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  };

  const goToTimelineEnd = () => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(timelineDurationMs);
    setPreviewLoopCycleIndex(0);
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

    if (
      previewLoopWindow
      && previewLoopCycleIndex > 0
      && timelineEntry.endMs <= previewLoopWindow.startMs
    ) {
      return false;
    }

    const isActive = currentTimelineTimeMs >= timelineEntry.startMs && currentTimelineTimeMs < timelineEntry.endMs;
    if (!isActive) return false;

    if (!WINDOW_ACTION_TYPES.has(action.type)) return false;

    const targetKind = action.targetWindow?.kind ?? (action.type === 'setNarrativeText' ? 'projection' : 'main');
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
      <DialogTitle sx={{ py: 1.5, px: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Box sx={{ flexShrink: 0 }}>
            <ShortcutThumbnailPreview
              icon={draft.icon}
              imageUrl={draft.imageUrl}
              name={draft.name || 'Escena'}
              onClick={() => setIconPickerOpen(true)}
              hideLabel={true}
            />
          </Box>
          <Stack spacing={1.25} sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                label="Nombre *"
                size="small"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                inputProps={{ maxLength: 80 }}
                sx={{ flex: 1 }}
              />
              <FormControl size="small" sx={{ width: 150 }}>
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
              placeholder="Descripción breve de la escena..."
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
            />
          </Stack>
          {uploadingIcon ? (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 1 }}>
              Subiendo…
            </Typography>
          ) : null}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={1.25} sx={{ height: '100%' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoFileSelected}
          />
          <input
            ref={iconFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleIconFileSelected}
          />

          <EmojiPickerDialog
            open={iconPickerOpen}
            value={draft.icon ?? ''}
            imageUrl={draft.imageUrl}
            onClose={() => setIconPickerOpen(false)}
            onSelect={handlePickEmoji}
            onUploadImage={handleUploadSceneIconClick}
            isUploadingImage={uploadingIcon}
          />

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{
              bgcolor: 'background.paper',
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              flexWrap: 'wrap',
            }}
          >
            <FormControlLabel
              control={(
                <Switch
                  checked={Boolean(draft.loop)}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setDraft((d) => ({
                      ...d,
                      loop: enabled,
                      loopDelayMs: enabled ? d.loopDelayMs : null,
                      loopDelayRandomMinMs: enabled ? d.loopDelayRandomMinMs : null,
                      loopDelayRandomMaxMs: enabled ? d.loopDelayRandomMaxMs : null,
                      loopWindowStartMs: enabled ? (d.loopWindowStartMs ?? 0) : null,
                      loopWindowEndMs: enabled ? (d.loopWindowEndMs ?? Math.max(1, Math.round(timelineDurationMs))) : null,
                    }));
                  }}
                />
              )}
              label="Escena en loop"
              sx={{ mr: 1 }}
            />

            {draft.loop ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 280, flexWrap: 'wrap', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Reinicio loop</InputLabel>
                  <Select
                    value={loopDelayMode}
                    label="Reinicio loop"
                    onChange={(event) => {
                      const mode = event.target.value as 'immediate' | 'fixed' | 'random';
                      setDraft((d) => {
                        if (mode === 'immediate') {
                          return {
                            ...d,
                            loopDelayMs: null,
                            loopDelayRandomMinMs: null,
                            loopDelayRandomMaxMs: null,
                          };
                        }
                        if (mode === 'fixed') {
                          return {
                            ...d,
                            loopDelayMs: d.loopDelayMs ?? 1000,
                            loopDelayRandomMinMs: null,
                            loopDelayRandomMaxMs: null,
                          };
                        }
                        return {
                          ...d,
                          loopDelayMs: null,
                          loopDelayRandomMinMs: d.loopDelayRandomMinMs ?? 500,
                          loopDelayRandomMaxMs: d.loopDelayRandomMaxMs ?? 1500,
                        };
                      });
                    }}
                  >
                    <MenuItem value="immediate">Inmediato</MenuItem>
                    <MenuItem value="fixed">Delay fijo</MenuItem>
                    <MenuItem value="random">Delay aleatorio</MenuItem>
                  </Select>
                </FormControl>

                {loopDelayMode === 'fixed' ? (
                  <TextField
                    size="small"
                    type="number"
                    label="Delay loop (ms)"
                    value={draft.loopDelayMs ?? 0}
                    onChange={(event) => set('loopDelayMs', Math.max(0, Number(event.target.value || 0)))}
                    inputProps={{ min: 0, step: 100 }}
                    sx={{ width: 140 }}
                  />
                ) : null}

                {loopDelayMode === 'random' ? (
                  <>
                    <TextField
                      size="small"
                      type="number"
                      label="Delay min (ms)"
                      value={draft.loopDelayRandomMinMs ?? 0}
                      onChange={(event) => set('loopDelayRandomMinMs', Math.max(0, Number(event.target.value || 0)))}
                      inputProps={{ min: 0, step: 100 }}
                      sx={{ width: 130 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Delay max (ms)"
                      value={draft.loopDelayRandomMaxMs ?? 0}
                      onChange={(event) => set('loopDelayRandomMaxMs', Math.max(0, Number(event.target.value || 0)))}
                      inputProps={{ min: 0, step: 100 }}
                      sx={{ width: 130 }}
                    />
                  </>
                ) : null}

                <Typography variant="caption" color="text.secondary">
                  El loop parcial se edita visualmente en el timeline (caja inferior).
                </Typography>
              </Stack>
            ) : null}
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: '240px minmax(0, 1fr)',
                lg: '250px minmax(0, 1fr) 320px',
                xl: '260px minmax(0, 1fr) 360px',
              },
              gap: 1.5,
              minHeight: 0,
              flex: 1,
            }}
          >
            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Herramientas</Typography>

              <Stack spacing={0.8}>
                <Button size="small" variant="contained" startIcon={<MovieCreationIcon />} onClick={() => addActionOfType('sendVideoToWindow')}>Añadir vídeo</Button>
                <Button size="small" variant="outlined" startIcon={<ImageIcon />} onClick={() => addActionOfType('sendImageToWindow')}>Añadir imagen</Button>
                <Button
                  size="small"
                  variant={leftToolPanelMode === 'text' ? 'contained' : 'outlined'}
                  startIcon={<TextFieldsIcon />}
                  onClick={() => {
                    setLeftToolPanelMode('text');
                    createNarrativeActionAndStartEdit();
                  }}
                >
                  Añadir texto
                </Button>
                <Button size="small" variant="outlined" startIcon={<MusicNoteIcon />} onClick={() => addActionOfType('playMusic')}>Añadir música</Button>
                <Button size="small" variant="outlined" startIcon={<VolumeUpIcon />} onClick={() => addActionOfType('playSound')}>Añadir sonido</Button>
                <Button size="small" variant="outlined" startIcon={<FilterAltIcon />} onClick={() => addActionOfType('applyWindowFilter')}>Añadir filtro</Button>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
                <Button
                  size="small"
                  variant={leftToolPanelMode === 'media' ? 'contained' : 'outlined'}
                  onClick={() => setLeftToolPanelMode('media')}
                >
                  Media
                </Button>
                <Button
                  size="small"
                  variant={leftToolPanelMode === 'text' ? 'contained' : 'outlined'}
                  onClick={() => setLeftToolPanelMode('text')}
                >
                  Texto
                </Button>
              </Stack>

              <Stack spacing={1} sx={{ minHeight: 0, flex: 1 }}>
                {leftToolPanelMode === 'text' ? (
                  <Stack spacing={0.8} sx={{ minHeight: 0, overflowY: 'auto', pr: 0.4 }}>
                    <Typography variant="subtitle2">Estilos de texto</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Elige un estilo para crear texto y escribir directamente en el previsualizador.
                    </Typography>
                    {NARRATIVE_TOOL_STYLE_PRESETS.map((preset) => (
                      <Paper
                        key={preset.id}
                        variant="outlined"
                        sx={{ p: 0.9, cursor: 'pointer', borderColor: 'divider' }}
                        onClick={() => createNarrativeActionAndStartEdit(preset.patch)}
                      >
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {preset.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {preset.subtitle}
                          </Typography>
                          <Box
                            sx={{
                              borderRadius: 1,
                              px: 0.8,
                              py: 0.55,
                              bgcolor: 'rgba(15, 18, 28, 0.5)',
                              border: '1px solid rgba(148, 163, 184, 0.24)',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#f6f7fb',
                                fontFamily: String(preset.patch.fontFamily ?? 'Merriweather'),
                                fontSize: Math.max(12, Number(preset.patch.fontSizePx ?? 20) * 0.48),
                                fontWeight: String(preset.patch.fontWeight ?? 'normal') === 'bold' ? 700 : 400,
                                textAlign: String(preset.patch.textAlign ?? 'left') as 'left' | 'center' | 'right' | 'justify',
                                display: 'block',
                              }}
                            >
                              {String(preset.patch.title ?? '') || 'Texto de ejemplo'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <>
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
                      <Stack spacing={0.8} sx={{ minHeight: 0 }}>
                        <TextField
                          size="small"
                          placeholder="Buscar por nombre o archivo..."
                          value={videoLibraryQuery}
                          onChange={(event) => setVideoLibraryQuery(event.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                        />

                        {filteredSceneVideoAssets.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">
                            No hay resultados para la búsqueda actual.
                          </Typography>
                        ) : (
                          <Stack spacing={0.7} sx={{ overflowY: 'auto', overflowX: 'hidden', pr: 0.5, minWidth: 0 }}>
                            {filteredSceneVideoAssets.map((asset) => {
                              const isRenaming = renamingVideoId === asset.id;
                              return (
                                <Paper key={asset.id} variant="outlined" sx={{ p: 0.75, minWidth: 0, overflow: 'hidden' }}>
                                  <Stack spacing={0.6}>
                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                                      <Chip
                                        label={`${asset.name} (${Math.round(asset.size / (1024 * 1024))}MB)`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ maxWidth: '100%' }}
                                        draggable
                                        onDragStart={(event) => {
                                          event.dataTransfer.setData('text/plain', toVideoDragPayload(asset.id));
                                          event.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onClick={() => {
                                          createActionByDroppingVideoAsset(asset.id);
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleStartRenameVideo(asset)}
                                        aria-label="Renombrar vídeo"
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteVideoAsset(asset)}
                                        disabled={deletingVideoId === asset.id}
                                        aria-label="Eliminar vídeo"
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Stack>

                                    {isRenaming ? (
                                      <Stack direction="row" spacing={0.75} alignItems="center">
                                        <TextField
                                          size="small"
                                          value={renamingVideoName}
                                          onChange={(event) => setRenamingVideoName(event.target.value)}
                                          sx={{ flex: 1 }}
                                        />
                                        <Button
                                          size="small"
                                          variant="contained"
                                          onClick={() => handleConfirmRenameVideo(asset.id)}
                                          disabled={renamingVideoSubmitting}
                                        >
                                          Guardar
                                        </Button>
                                        <Button size="small" onClick={handleCancelRenameVideo}>
                                          Cancelar
                                        </Button>
                                      </Stack>
                                    ) : null}

                                    <Typography variant="caption" color="text.secondary">
                                      Archivo: {asset.originalFilename}
                                    </Typography>
                                  </Stack>
                                </Paper>
                              );
                            })}
                          </Stack>
                        )}
                      </Stack>
                    )}
                  </>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">Previsualizador</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <FormControl size="small" sx={{ minWidth: 162 }}>
                    <InputLabel>Modo loop preview</InputLabel>
                    <Select
                      label="Modo loop preview"
                      value={effectivePreviewLoopMode}
                      onChange={(event) => setPreviewLoopMode(event.target.value as 'full' | 'partial')}
                    >
                      <MenuItem value="full">Loop completo</MenuItem>
                      <MenuItem value="partial" disabled={!hasValidLoopWindow}>Loop parcial</MenuItem>
                    </Select>
                  </FormControl>
                  <Chip
                    size="small"
                    clickable
                    color={isPreviewMemoryWarmupEnabled ? 'success' : 'default'}
                    variant={isPreviewMemoryWarmupEnabled ? 'filled' : 'outlined'}
                    label={isPreviewMemoryWarmupEnabled
                      ? `Preload memoria ON (${warmedActionCount}/${targetedActionCount})`
                      : 'Preload memoria OFF'}
                    onClick={() => setIsPreviewMemoryWarmupEnabled((current) => !current)}
                  />
                  <Chip size="small" label={`${formatPreviewClock(currentTimelineTimeMs)} @ ${PREVIEW_FPS}fps`} />
                  <Chip size="small" variant="outlined" label={activeEntryLabel} />
                  {selectedActionId && derivingClipErrorByActionId[selectedActionId] ? (
                    <Chip
                      size="small"
                      color="error"
                      variant="outlined"
                      label={derivingClipErrorByActionId[selectedActionId]}
                    />
                  ) : null}
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
                      <MenuItem value="0.4">40%</MenuItem>
                      <MenuItem value="0.45">45%</MenuItem>
                      <MenuItem value="0.5">50%</MenuItem>
                      <MenuItem value="0.55">55%</MenuItem>
                      <MenuItem value="0.6">60%</MenuItem>
                      <MenuItem value="0.65">65%</MenuItem>
                      <MenuItem value="0.7">70%</MenuItem>
                      <MenuItem value="0.75">75%</MenuItem>
                      <MenuItem value="0.8">80%</MenuItem>
                      <MenuItem value="0.85">85%</MenuItem>
                      <MenuItem value="0.9">90%</MenuItem>
                      <MenuItem value="0.95">95%</MenuItem>
                      <MenuItem value="1">100%</MenuItem>
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

                    {activePreviewGuidePlacement && !narrativeCanvasEditActionId ? (
                      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9000 }}>
                        {activeLayerDragPlacement ? (
                          <>
                            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pct) => (
                              <Box
                                key={`drag-v-guide-${pct}`}
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: `${pct}%`,
                                  width: '1px',
                                  bgcolor: pct === 50 ? 'rgba(121, 134, 255, 0.7)' : 'rgba(121, 134, 255, 0.28)',
                                }}
                              />
                            ))}
                            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pct) => (
                              <Box
                                key={`drag-h-guide-${pct}`}
                                sx={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  top: `${pct}%`,
                                  height: '1px',
                                  bgcolor: pct === 50 ? 'rgba(121, 134, 255, 0.7)' : 'rgba(121, 134, 255, 0.28)',
                                }}
                              />
                            ))}
                          </>
                        ) : null}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: `${activePreviewGuidePlacement.leftPct}%`,
                            top: `${activePreviewGuidePlacement.topPct}%`,
                            width: `${activePreviewGuidePlacement.widthPct}%`,
                            height: `${activePreviewGuidePlacement.heightPct}%`,
                            border: '1px dashed rgba(121, 134, 255, 0.95)',
                            borderRadius: 0.5,
                            boxShadow: 'inset 0 0 0 1px rgba(121, 134, 255, 0.45)',
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              transform: 'translateY(-100%)',
                              px: 0.5,
                              py: 0.2,
                              bgcolor: 'rgba(10, 14, 26, 0.88)',
                              border: '1px solid rgba(121, 134, 255, 0.9)',
                              borderRadius: 0.5,
                            }}
                          >
                            <Typography sx={{ fontSize: 10, lineHeight: 1.1, color: 'rgba(230, 236, 255, 0.95)' }}>
                              L {activePreviewGuidePlacement.leftPct.toFixed(0)}% | T {activePreviewGuidePlacement.topPct.toFixed(0)}% | W {activePreviewGuidePlacement.widthPct.toFixed(0)}% | H {activePreviewGuidePlacement.heightPct.toFixed(0)}%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    ) : null}

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
                                  pointerEvents: lockPreviewInteractionToSelectedNarrative && !selected ? 'none' : 'auto',
                                  cursor: !selected ? 'pointer' : selected && chromaPickActionId !== action.id ? 'move' : 'default',
                                }}
                                onMouseDown={(event) => {
                                  if (lockPreviewInteractionToSelectedNarrative && !selected) return;
                                  if (chromaPickActionId === action.id) return;
                                  if (!selected) {
                                    selectActionAndSeekToStart(action.id);
                                    return;
                                  }
                                  startLayerDrag(action, 'move', event);
                                }}
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
                            const videoUrl = previewMediaUrlsByActionId[action.id] ?? '';
                            const videoError = videoPreviewErrorsByActionId[action.id];
                            const payloadRecord = payload as Record<string, unknown>;
                            const chroma = getChromaFromPayload(payloadRecord);
                            const loopSegmentEnabled = Boolean(payloadRecord.loopSegmentEnabled);
                            const loopSegmentStartMs = toNonNegativeMs(payloadRecord.loopSegmentStartMs);
                            const loopSegmentEndMs = toNonNegativeMs(payloadRecord.loopSegmentEndMs);
                            const clipInSec = toNonNegativeSec(payloadRecord.clipInSec) ?? 0;
                            const clipOutSec = toNonNegativeSec(payloadRecord.clipOutSec);
                            const hasLoopSegment = loopSegmentEnabled
                              && loopSegmentStartMs !== undefined
                              && (loopSegmentEndMs === undefined || loopSegmentEndMs > loopSegmentStartMs);
                            const timelineEntry = timelineEntriesByActionId.get(action.id);
                            const mediaTimeSec = timelineEntry
                              ? Math.max(clipInSec, clipInSec + ((currentTimelineTimeMs - timelineEntry.startMs) / 1000))
                              : 0;
                            const hasScenePartialLoop = Boolean(previewLoopWindow && previewLoopCycleIndex > 0);
                            const actionStartsBeforeLoopWindow = Boolean(previewLoopWindow && timelineEntry && timelineEntry.startMs < previewLoopWindow.startMs);
                            const sceneLoopStartOffsetSec = (previewLoopWindow && timelineEntry)
                              ? Math.max(0, (previewLoopWindow.startMs - timelineEntry.startMs) / 1000)
                              : undefined;
                            const sceneStartAtSec = hasScenePartialLoop && actionStartsBeforeLoopWindow
                              ? sceneLoopStartOffsetSec
                              : undefined;

                            const startAtSec = sceneStartAtSec !== undefined
                              ? Math.max(clipInSec, sceneStartAtSec)
                              : clipInSec;

                            const loopSegmentStartSec = hasLoopSegment ? Number(loopSegmentStartMs) / 1000 : undefined;
                            const loopSegmentEndSec = hasLoopSegment && loopSegmentEndMs !== undefined ? Number(loopSegmentEndMs) / 1000 : undefined;
                            const effectiveLoopRangeStartSec = loopSegmentStartSec !== undefined
                              ? Math.max(clipInSec, loopSegmentStartSec)
                              : (clipInSec > 0 ? clipInSec : undefined);
                            const effectiveLoopRangeEndSec = (() => {
                              if (loopSegmentEndSec !== undefined && clipOutSec !== undefined) {
                                return Math.min(loopSegmentEndSec, clipOutSec);
                              }
                              if (loopSegmentEndSec !== undefined) {
                                return loopSegmentEndSec;
                              }
                              if (clipOutSec !== undefined) {
                                return clipOutSec;
                              }
                              return undefined;
                            })();
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
                                  pointerEvents: lockPreviewInteractionToSelectedNarrative && !selected ? 'none' : 'auto',
                                  cursor: !selected ? 'pointer' : selected && chromaPickActionId !== action.id ? 'move' : 'default',
                                }}
                                onMouseDown={(event) => {
                                  if (lockPreviewInteractionToSelectedNarrative && !selected) return;
                                  if (chromaPickActionId === action.id) return;
                                  if (!selected) {
                                    selectActionAndSeekToStart(action.id);
                                    return;
                                  }
                                  startLayerDrag(action, 'move', event);
                                }}
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
                                  seekTimeSec={mediaTimeSec}
                                  seekVersion={previewSeekVersion}
                                  startAtSec={startAtSec}
                                  loopRangeStartSec={effectiveLoopRangeStartSec}
                                  loopRangeEndSec={effectiveLoopRangeEndSec}
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
                            const placement = getPlacementFromPayload(payload);
                            const title = String(payload.title ?? '').trim();
                            const segments = getNarrativeSegments(payload);
                            const isNarrativeCanvasEditing = narrativeCanvasEditActionId === action.id && selected;
                            const fontFamily = String(payload.fontFamily ?? 'Merriweather').trim() || 'Merriweather';
                            const fontSizePx = isNarrativeCanvasEditing
                              ? (narrativeCanvasDraft?.fontSizePx ?? 28)
                              : (Number.isFinite(Number(payload.fontSizePx)) ? Math.max(8, Math.min(220, Number(payload.fontSizePx))) : 28);
                            const fontColor = isNarrativeCanvasEditing
                              ? (narrativeCanvasDraft?.fontColor ?? '#ffffff')
                              : (String(payload.fontColor ?? '#ffffff').trim() || '#ffffff');
                            const textAlignRaw = String(payload.textAlign ?? 'left').trim();
                            const textAlign = isNarrativeCanvasEditing
                              ? (narrativeCanvasDraft?.textAlign ?? 'left')
                              : (textAlignRaw === 'center' || textAlignRaw === 'right' || textAlignRaw === 'justify' ? textAlignRaw : 'left');
                            const lineHeight = Number.isFinite(Number(payload.lineHeight)) ? Math.max(0.8, Math.min(3, Number(payload.lineHeight))) : 1.35;
                            const letterSpacingPx = Number.isFinite(Number(payload.letterSpacingPx))
                              ? Math.max(-8, Math.min(20, Number(payload.letterSpacingPx)))
                              : 0;
                            const fontWeightRaw = String(payload.fontWeight ?? 'normal').trim();
                            const fontWeight = isNarrativeCanvasEditing
                              ? (narrativeCanvasDraft?.fontWeight === 'bold' ? 700 : 400)
                              : (fontWeightRaw === 'bold' ? 700 : 400);
                            const fontStyle = isNarrativeCanvasEditing
                              ? (narrativeCanvasDraft?.fontStyle ?? 'normal')
                              : (String(payload.fontStyle ?? 'normal').trim() === 'italic' ? 'italic' : 'normal');
                            const textDecoration = isNarrativeCanvasEditing
                              ? (narrativeCanvasDraft?.textDecoration ?? 'none')
                              : (String(payload.textDecoration ?? 'none').trim() === 'underline' ? 'underline' : 'none');
                            const backgroundModeRaw = String(payload.backgroundMode ?? 'rect').trim();
                            const backgroundMode = backgroundModeRaw === 'none' || backgroundModeRaw === 'capsule' ? backgroundModeRaw : 'rect';
                            const backgroundColor = String(payload.backgroundColor ?? '#000000').trim() || '#000000';
                            const backgroundOpacity = Number.isFinite(Number(payload.backgroundOpacity))
                              ? normalizeOpacity(payload.backgroundOpacity)
                              : 0.58;
                            const borderRadiusPx = Number.isFinite(Number(payload.borderRadiusPx))
                              ? Math.max(0, Math.min(128, Number(payload.borderRadiusPx)))
                              : 12;
                            const paddingPx = Number.isFinite(Number(payload.paddingPx))
                              ? Math.max(0, Math.min(64, Number(payload.paddingPx)))
                              : 16;
                            const hasContent = Boolean(title) || segments.length > 0;
                            const narrativeCanvasWidthPx = (placement.widthPct / 100) * previewWindowSize.width * previewScale;
                            const narrativeCanvasHeightPx = (placement.heightPct / 100) * previewWindowSize.height * previewScale;
                            const narrativeToolbarCompact = narrativeCanvasWidthPx < 460 || narrativeCanvasHeightPx < 220;
                            const shouldRenderNarrative = hasContent || selected || isNarrativeCanvasEditing;

                            if (!shouldRenderNarrative) {
                              return null;
                            }

                            return (
                              <Box
                                key={key}
                                sx={{
                                  position: 'absolute',
                                  left: `${placement.leftPct}%`,
                                  top: `${placement.topPct}%`,
                                  width: `${placement.widthPct}%`,
                                  height: `${placement.heightPct}%`,
                                  opacity,
                                  zIndex,
                                  border: selected ? '2px solid rgba(255,255,255,0.9)' : 'none',
                                  borderRadius: selected ? 1 : 0,
                                  pointerEvents: lockPreviewInteractionToSelectedNarrative && !selected ? 'none' : 'auto',
                                  display: 'flex',
                                  alignItems: 'stretch',
                                  boxSizing: 'border-box',
                                  cursor: !selected
                                    ? 'pointer'
                                    : selected && !isNarrativeCanvasEditing && leftToolPanelMode !== 'text'
                                      ? 'move'
                                      : 'text',
                                }}
                                onMouseDown={(event) => {
                                  if (!selected) {
                                    selectActionAndSeekToStart(action.id);
                                    return;
                                  }
                                  if (isNarrativeCanvasEditing) return;
                                  if (leftToolPanelMode === 'text') {
                                    return;
                                  }
                                }}
                                onClick={(event) => {
                                  if (!selected || isNarrativeCanvasEditing) return;
                                  if (leftToolPanelMode !== 'text') return;
                                  event.stopPropagation();
                                }}
                                onDoubleClick={() => {
                                  if (!selected) return;
                                  beginNarrativeCanvasEdit(action);
                                }}
                              >
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    overflow: isNarrativeCanvasEditing ? 'visible' : 'hidden',
                                    p: `${paddingPx}px`,
                                    borderRadius: backgroundMode === 'capsule' ? 999 : `${borderRadiusPx}px`,
                                    bgcolor: backgroundMode === 'none' ? 'transparent' : alpha(backgroundColor, backgroundOpacity),
                                    color: fontColor,
                                    fontFamily,
                                    fontSize: `${fontSizePx}px`,
                                    textAlign,
                                    lineHeight,
                                    letterSpacing: `${letterSpacingPx}px`,
                                    fontWeight,
                                    fontStyle,
                                    textDecoration,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-start',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  {isNarrativeCanvasEditing ? (
                                    <Stack
                                      spacing={narrativeToolbarCompact ? 0.5 : 0.75}
                                      sx={{ width: '100%', height: '100%' }}
                                      onMouseDown={(event) => event.stopPropagation()}
                                    >
                                      {!narrativeToolbarCompact || Boolean(narrativeCanvasDraft?.title ?? title) ? (
                                        <TextField
                                          size="small"
                                          label="Título"
                                          value={narrativeCanvasDraft?.title ?? title}
                                          onChange={(event) => {
                                            const nextTitle = event.target.value;
                                            setNarrativeCanvasDraft((current) => ({
                                              ...(current ?? {
                                                title: String(payload.title ?? ''),
                                                text: String(payload.text ?? ''),
                                                fontSizePx,
                                                fontColor,
                                                textAlign: textAlign as 'left' | 'center' | 'right' | 'justify',
                                                fontWeight: (fontWeightRaw === 'bold' ? 'bold' : 'normal') as 'normal' | 'bold',
                                                fontStyle: (String(payload.fontStyle ?? 'normal').trim() === 'italic' ? 'italic' : 'normal') as 'normal' | 'italic',
                                                textDecoration: (String(payload.textDecoration ?? 'none').trim() === 'underline' ? 'underline' : 'none') as 'none' | 'underline',
                                              }),
                                              title: nextTitle,
                                            }));
                                          }}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Escape') {
                                              event.preventDefault();
                                              finishNarrativeCanvasEdit('cancel');
                                            }
                                          }}
                                          InputLabelProps={{ shrink: true }}
                                        />
                                      ) : null}
                                      <TextField
                                        size="small"
                                        label="Texto"
                                        multiline
                                        minRows={narrativeToolbarCompact ? 2 : 3}
                                        value={narrativeCanvasDraft?.text ?? String(payload.text ?? '')}
                                        onChange={(event) => {
                                          const nextText = event.target.value;
                                          setNarrativeCanvasDraft((current) => ({
                                            ...(current ?? {
                                              title: String(payload.title ?? ''),
                                              text: String(payload.text ?? ''),
                                              fontSizePx,
                                              fontColor,
                                              textAlign: textAlign as 'left' | 'center' | 'right' | 'justify',
                                              fontWeight: (fontWeightRaw === 'bold' ? 'bold' : 'normal') as 'normal' | 'bold',
                                              fontStyle: (String(payload.fontStyle ?? 'normal').trim() === 'italic' ? 'italic' : 'normal') as 'normal' | 'italic',
                                              textDecoration: (String(payload.textDecoration ?? 'none').trim() === 'underline' ? 'underline' : 'none') as 'none' | 'underline',
                                            }),
                                            text: nextText,
                                          }));
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Escape') {
                                            event.preventDefault();
                                            finishNarrativeCanvasEdit('cancel');
                                          }
                                          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
                                            event.preventDefault();
                                            setNarrativeCanvasDraft((current) => {
                                              if (!current) return current;
                                              return {
                                                ...current,
                                                fontWeight: current.fontWeight === 'bold' ? 'normal' : 'bold',
                                              };
                                            });
                                          }
                                          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
                                            event.preventDefault();
                                            setNarrativeCanvasDraft((current) => {
                                              if (!current) return current;
                                              return {
                                                ...current,
                                                fontStyle: current.fontStyle === 'italic' ? 'normal' : 'italic',
                                              };
                                            });
                                          }
                                          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'u') {
                                            event.preventDefault();
                                            setNarrativeCanvasDraft((current) => {
                                              if (!current) return current;
                                              return {
                                                ...current,
                                                textDecoration: current.textDecoration === 'underline' ? 'none' : 'underline',
                                              };
                                            });
                                          }
                                          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                                            event.preventDefault();
                                            finishNarrativeCanvasEdit('save');
                                          }
                                        }}
                                        sx={{ flex: 1 }}
                                        InputLabelProps={{ shrink: true }}
                                      />
                                    </Stack>
                                  ) : (
                                    <>
                                      {!hasContent ? (
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: 'rgba(255,255,255,0.82)',
                                            fontStyle: 'italic',
                                          }}
                                        >
                                          Haz clic para editar texto...
                                        </Typography>
                                      ) : null}
                                      {title ? (
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
                                          {title}
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
                                        {segments.map((segment, segmentIndex) => (
                                          <Box
                                            key={`${action.id ?? key}-seg-${segmentIndex}`}
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
                                    </>
                                  )}
                                </Box>
                                {selected && !isNarrativeCanvasEditing ? (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      left: -8,
                                      top: -8,
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      bgcolor: 'info.main',
                                      border: '2px solid #fff',
                                      cursor: 'move',
                                      pointerEvents: 'auto',
                                    }}
                                    onMouseDown={(event) => {
                                      startLayerDrag(action, 'move', event);
                                    }}
                                  />
                                ) : null}
                                {selected && !isNarrativeCanvasEditing ? (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    sx={{
                                      position: 'absolute',
                                      right: 6,
                                      top: 6,
                                      minWidth: 0,
                                      px: 1,
                                      py: 0.25,
                                      textTransform: 'none',
                                      fontSize: 11,
                                      zIndex: 2,
                                    }}
                                    onMouseDown={(event) => {
                                      event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      beginNarrativeCanvasEdit(action);
                                    }}
                                  >
                                    Editar texto
                                  </Button>
                                ) : null}
                                {selected && isNarrativeCanvasEditing ? (
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                    sx={{
                                      flexWrap: 'wrap',
                                      rowGap: 0.5,
                                      position: 'absolute',
                                      left: 0,
                                      right: 0,
                                      bottom: '100%',
                                      mb: 0.6,
                                      zIndex: 4,
                                      p: 0.4,
                                      borderRadius: 0.8,
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      bgcolor: 'rgba(12, 14, 20, 0.92)',
                                      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
                                    }}
                                    onMouseDown={(event) => event.stopPropagation()}
                                  >
                                    <Button
                                      size="small"
                                      variant={narrativeCanvasDraft?.fontWeight === 'bold' ? 'contained' : 'outlined'}
                                      sx={{ minWidth: 34, px: 0.85 }}
                                      onClick={() => {
                                        setNarrativeCanvasDraft((current) => {
                                          if (!current) return current;
                                          return {
                                            ...current,
                                            fontWeight: current.fontWeight === 'bold' ? 'normal' : 'bold',
                                          };
                                        });
                                      }}
                                    >
                                      B
                                    </Button>
                                    <Button
                                      size="small"
                                      variant={narrativeCanvasDraft?.fontStyle === 'italic' ? 'contained' : 'outlined'}
                                      sx={{ minWidth: 34, px: 0.85 }}
                                      onClick={() => {
                                        setNarrativeCanvasDraft((current) => {
                                          if (!current) return current;
                                          return {
                                            ...current,
                                            fontStyle: current.fontStyle === 'italic' ? 'normal' : 'italic',
                                          };
                                        });
                                      }}
                                    >
                                      I
                                    </Button>
                                    <Button
                                      size="small"
                                      variant={narrativeCanvasDraft?.textDecoration === 'underline' ? 'contained' : 'outlined'}
                                      sx={{ minWidth: 34, px: 0.85 }}
                                      onClick={() => {
                                        setNarrativeCanvasDraft((current) => {
                                          if (!current) return current;
                                          return {
                                            ...current,
                                            textDecoration: current.textDecoration === 'underline' ? 'none' : 'underline',
                                          };
                                        });
                                      }}
                                    >
                                      U
                                    </Button>
                                    <TextField
                                      size="small"
                                      label="Color"
                                      type="color"
                                      sx={{ width: 88 }}
                                      value={narrativeCanvasDraft?.fontColor ?? '#ffffff'}
                                      onChange={(event) => {
                                        const next = event.target.value;
                                        setNarrativeCanvasDraft((current) => {
                                          if (!current) return current;
                                          return { ...current, fontColor: next };
                                        });
                                      }}
                                      InputLabelProps={{ shrink: true }}
                                    />
                                    <TextField
                                      size="small"
                                      label="Tam"
                                      type="number"
                                      sx={{ width: 84 }}
                                      value={narrativeCanvasDraft?.fontSizePx ?? 28}
                                      inputProps={{ min: 8, max: 220, step: 1 }}
                                      onChange={(event) => {
                                        const raw = Number(event.target.value);
                                        setNarrativeCanvasDraft((current) => {
                                          if (!current) return current;
                                          return {
                                            ...current,
                                            fontSizePx: Number.isFinite(raw) ? Math.max(8, Math.min(220, raw)) : current.fontSizePx,
                                          };
                                        });
                                      }}
                                      InputLabelProps={{ shrink: true }}
                                    />
                                    <FormControl size="small" sx={{ minWidth: 116 }}>
                                      <InputLabel>Alineación</InputLabel>
                                      <Select
                                        label="Alineación"
                                        value={narrativeCanvasDraft?.textAlign ?? 'left'}
                                        onChange={(event) => {
                                          const value = event.target.value as 'left' | 'center' | 'right' | 'justify';
                                          setNarrativeCanvasDraft((current) => {
                                            if (!current) return current;
                                            return { ...current, textAlign: value };
                                          });
                                        }}
                                      >
                                        <MenuItem value="left">Left</MenuItem>
                                        <MenuItem value="center">Center</MenuItem>
                                        <MenuItem value="right">Right</MenuItem>
                                        <MenuItem value="justify">Justify</MenuItem>
                                      </Select>
                                    </FormControl>
                                    <Stack direction="row" spacing={0.5} sx={{ marginLeft: 'auto' }}>
                                      <Button size="small" variant="outlined" onClick={() => finishNarrativeCanvasEdit('cancel')}>
                                        Cancelar
                                      </Button>
                                      <Button size="small" variant="contained" onClick={() => finishNarrativeCanvasEdit('save')}>
                                        Guardar
                                      </Button>
                                    </Stack>
                                  </Stack>
                                ) : null}
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
                                      if (isNarrativeCanvasEditing) return;
                                      startLayerDrag(action, 'resize', event);
                                    }}
                                  />
                                ) : null}
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
                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="subtitle2">
                      Timeline principal ({draft.actions.length}/{SCENE_MAX_ACTIONS})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Click para scrub | Espacio play/pause | Flechas frame a frame.
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ flexWrap: 'wrap', rowGap: 0.5, width: '100%' }}>
                    <Tooltip title="Ir al inicio">
                      <span>
                        <IconButton size="small" onClick={goToTimelineStart} aria-label="Ir al inicio">
                          <FirstPageIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Frame anterior">
                      <span>
                        <IconButton size="small" onClick={() => stepPreviewFrame(-1)} aria-label="Frame anterior">
                          <SkipPreviousIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={isPreviewPlaying ? 'Pausar' : 'Reproducir'}>
                      <span>
                        <IconButton
                          size="small"
                          color={isPreviewPlaying ? 'primary' : 'default'}
                          onClick={() => setIsPreviewPlaying((playing) => !playing)}
                          aria-label={isPreviewPlaying ? 'Pausar' : 'Reproducir'}
                        >
                          {isPreviewPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Frame siguiente">
                      <span>
                        <IconButton size="small" onClick={() => stepPreviewFrame(1)} aria-label="Frame siguiente">
                          <SkipNextIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Ir al final">
                      <span>
                        <IconButton size="small" onClick={goToTimelineEnd} aria-label="Ir al final">
                          <LastPageIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={isPreviewLooping ? 'Loop ON' : 'Loop OFF'}>
                      <span>
                        <IconButton
                          size="small"
                          color={isPreviewLooping ? 'primary' : 'default'}
                          onClick={() => setIsPreviewLooping((looping) => !looping)}
                          aria-label={isPreviewLooping ? 'Desactivar loop' : 'Activar loop'}
                        >
                          <RepeatIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Cortar clip en playhead">
                      <span>
                        <IconButton
                          size="small"
                          onClick={splitSelectedActionAtPlayhead}
                          disabled={!canSplitSelectedAction}
                          aria-label="Cortar clip"
                        >
                          <ContentCutIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ flexWrap: 'wrap', rowGap: 0.5, width: '100%' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<MovieCreationIcon fontSize="small" />}
                      onClick={createDerivedClipFromSelectedAction}
                      disabled={!canCreateDerivedClip}
                    >
                      {derivingClipActionId === selectedActionId ? 'Renderizando clip…' : 'Renderizar clip derivado'}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CallMergeIcon fontSize="small" />}
                      onClick={joinSelectedWithNextAction}
                      disabled={!canJoinSelectedWithNext}
                    >
                      Unir siguiente
                    </Button>
                  </Stack>
                </Stack>
                <Box onDragOver={(event) => event.preventDefault()} onDrop={handleDropVideoAsset}>
                  <SceneTimelineEditor
                    actions={draft.actions}
                    selectedActionId={selectedActionId}
                    narrativeEditingActionId={narrativeCanvasEditActionId}
                    onSelectAction={handleSelectActionFromTimeline}
                    onMoveActionInTime={moveActionInTimeline}
                    onChangeActionLayerOrder={setActionLayerOrder}
                    onChangeActionDuration={changeActionDurationInTimeline}
                    currentTimeMs={currentTimelineTimeMs}
                    onSeekTimeMs={handleSeekTimelineTime}
                    loopEnabled={Boolean(draft.loop)}
                    loopWindowStartMs={draft.loopWindowStartMs ?? null}
                    loopWindowEndMs={draft.loopWindowEndMs ?? null}
                    onSetLoopWindow={handleSetLoopWindow}
                  />
                </Box>
              </Box>
            </Paper>

            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minHeight: 0,
                minWidth: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                gridColumn: {
                  xs: 'span 1',
                  md: 'span 2',
                  lg: 'span 1',
                },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                <Typography variant="subtitle2">Inspector y capas</Typography>
                <Stack direction="row" spacing={0.4} sx={{ flexWrap: 'wrap' }}>
                  <Tooltip title="Subir">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => moveSelectedAction(-1)}
                        disabled={selectedActionIndex <= 0}
                        aria-label="Subir"
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Bajar">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => moveSelectedAction(1)}
                        disabled={selectedActionIndex < 0 || selectedActionIndex >= draft.actions.length - 1}
                        aria-label="Bajar"
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={removeSelectedAction}
                        disabled={selectedActionIndex < 0}
                        aria-label="Eliminar"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Enviar al frente">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => moveSelectedLayerToEdge('top')}
                        disabled={selectedActionIndex < 0 || selectedActionIndex === draft.actions.length - 1}
                        aria-label="Enviar al frente"
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Enviar al fondo">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => moveSelectedLayerToEdge('bottom')}
                        disabled={selectedActionIndex <= 0}
                        aria-label="Enviar al fondo"
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              <Paper variant="outlined" sx={{ p: 1.1, maxHeight: 210, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    Capas (arrastra para cambiar superposición). Última = más arriba.
                  </Typography>
                  {draft.actions.map((action, index) => {
                    const isSelected = selectedActionId === action.id;
                    const targetKind = action.targetWindow?.kind ?? 'main';
                    const payload = (action.payload ?? {}) as Record<string, unknown>;
                    const isNarrative = action.type === 'setNarrativeText';
                    const narrativeEditing = narrativeCanvasEditActionId === action.id;
                    const narrativeHasRichText = isNarrative && (() => {
                      const richTextDoc = payload.richTextDoc;
                      if (!richTextDoc || typeof richTextDoc !== 'object' || Array.isArray(richTextDoc)) return false;
                      const blocks = (richTextDoc as Record<string, unknown>).blocks;
                      if (!Array.isArray(blocks)) return false;
                      return blocks.some((block) => {
                        if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
                        const segments = (block as Record<string, unknown>).segments;
                        return Array.isArray(segments) && segments.length > 0;
                      });
                    })();
                    const narrativeHasStyle = isNarrative && [
                      'fontFamily',
                      'fontSizePx',
                      'fontColor',
                      'textAlign',
                      'lineHeight',
                      'fontWeight',
                      'fontStyle',
                      'textDecoration',
                      'backgroundMode',
                      'backgroundColor',
                      'backgroundOpacity',
                      'borderRadiusPx',
                      'paddingPx',
                    ].some((field) => payload[field] !== undefined && payload[field] !== null && payload[field] !== '');
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
                        onClick={() => {
                          selectActionAndSeekToStart(action.id);
                        }}
                        sx={{
                          p: 0.9,
                          borderRadius: 1,
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
                          <Stack direction="row" spacing={0.4} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <Chip size="small" label={`z${index + 1}`} />
                            {narrativeHasRichText ? <Chip size="small" color="info" variant="outlined" label="rich" /> : null}
                            {narrativeHasStyle ? <Chip size="small" color="secondary" variant="outlined" label="style" /> : null}
                            {narrativeEditing ? <Chip size="small" color="warning" label="editando" /> : null}
                          </Stack>
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

              <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', pr: 0.5 }}>
                {selectedAction ? (
                  <Stack spacing={0.75}>
                    <Typography variant="caption" color="text.secondary">
                      Editor de la capa seleccionada.
                    </Typography>
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
                  </Stack>
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
