/**
 * @file sceneLayerUtils.ts
 * @description Utilities for layer positioning, normalisation and action data
 *   shaping used throughout the Scene editor and preview canvas.
 */

import type { SceneActionDto } from '../../../types/scenes';
import type { WindowSize } from '../../../hooks/useSecondaryWindowSizes';
import { WINDOW_ACTION_TYPES } from '../constants/actionTypes';
import { toNonNegativeMs, toPositiveDurationMs } from './sceneEditorUtils';

export type { WindowSize };

// ---------------------------------------------------------------------------
// Layer geometry constants
// ---------------------------------------------------------------------------

/** Minimum snap increment (percentage points) for layer drag moves. */
export const PREVIEW_LAYER_SNAP_STEP_PCT = 1;

/** Minimum layer dimension (%) to avoid zero-size layers. */
export const PREVIEW_LAYER_MIN_SIZE_PCT = 5;

/** Minimum coordinate (%) for layer placement inside the stage. */
export const PREVIEW_LAYER_STAGE_MIN_PCT = 0;

/** Maximum coordinate (%) for layer placement inside the stage. */
export const PREVIEW_LAYER_STAGE_MAX_PCT = 100;

// ---------------------------------------------------------------------------
// Preview window type
// ---------------------------------------------------------------------------

/** The three window kinds that can be used in the scene preview. */
export type ScenePreviewWindowKind = 'main' | 'projection' | 'skyline';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/**
 * Returns the value cast as a plain object, or `null` if it is not one.
 * @param value - Any unknown value.
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Reads a percentage that may be expressed as a 0-1 fraction or as 0-100.
 * Values in [0,1] are multiplied by 100; values outside that range are returned as-is.
 * @param raw - Raw value from an action payload.
 * @param fallback - Value to return when `raw` is not a finite number.
 */
export function readLegacyPercentage(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (n >= 0 && n <= 1) {
    return n * 100;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Numeric normalisation
// ---------------------------------------------------------------------------

/**
 * Clamps an opacity value to [0, 1].
 * @param value - Raw opacity.
 * @returns Clamped opacity, defaulting to 1 if invalid.
 */
export function normalizeOpacity(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

/**
 * Clamps a percentage value to [min, max], defaulting to `fallback` when invalid.
 * @param value - Raw value.
 * @param fallback - Value used when `value` is not a finite number.
 * @param min - Minimum boundary (default 0).
 * @param max - Maximum boundary (default 100).
 */
export function normalizePercentage(
  value: unknown,
  fallback: number,
  min = 0,
  max = 100,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Clamps a free-placement percentage to [-50, 150], allowing partial overflow.
 * @param value - Raw value.
 * @param fallback - Value used when `value` is not finite.
 */
export function normalizeFreePlacement(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-50, Math.min(150, n));
}

/**
 * Snaps a percentage coordinate to the nearest `PREVIEW_LAYER_SNAP_STEP_PCT`.
 * @param value - Percentage value to snap.
 */
export function snapPct(value: number): number {
  return Math.round(value / PREVIEW_LAYER_SNAP_STEP_PCT) * PREVIEW_LAYER_SNAP_STEP_PCT;
}

// ---------------------------------------------------------------------------
// Layer geometry clamping
// ---------------------------------------------------------------------------

/**
 * Clamps a layer's position so it stays fully inside the stage.
 * @param leftPct - Requested left coordinate (%).
 * @param topPct - Requested top coordinate (%).
 * @param widthPct - Layer width (%).
 * @param heightPct - Layer height (%).
 * @returns Clamped `{ leftPct, topPct }`.
 */
export function clampLayerMoveInsideStage(
  leftPct: number,
  topPct: number,
  widthPct: number,
  heightPct: number,
): { leftPct: number; topPct: number } {
  const maxLeft = Math.max(
    PREVIEW_LAYER_STAGE_MIN_PCT,
    PREVIEW_LAYER_STAGE_MAX_PCT - widthPct,
  );
  const maxTop = Math.max(
    PREVIEW_LAYER_STAGE_MIN_PCT,
    PREVIEW_LAYER_STAGE_MAX_PCT - heightPct,
  );
  return {
    leftPct: Math.max(PREVIEW_LAYER_STAGE_MIN_PCT, Math.min(maxLeft, leftPct)),
    topPct: Math.max(PREVIEW_LAYER_STAGE_MIN_PCT, Math.min(maxTop, topPct)),
  };
}

/**
 * Clamps a layer's size so it fits inside the stage from the current anchor position.
 * @param widthPct - Requested width (%).
 * @param heightPct - Requested height (%).
 * @param leftPct - Current left anchor (%).
 * @param topPct - Current top anchor (%).
 * @returns Clamped `{ widthPct, heightPct }`.
 */
export function clampLayerSizeInsideStage(
  widthPct: number,
  heightPct: number,
  leftPct: number,
  topPct: number,
): { widthPct: number; heightPct: number } {
  const maxWidth = Math.max(
    PREVIEW_LAYER_MIN_SIZE_PCT,
    PREVIEW_LAYER_STAGE_MAX_PCT - leftPct,
  );
  const maxHeight = Math.max(
    PREVIEW_LAYER_MIN_SIZE_PCT,
    PREVIEW_LAYER_STAGE_MAX_PCT - topPct,
  );
  return {
    widthPct: Math.max(PREVIEW_LAYER_MIN_SIZE_PCT, Math.min(maxWidth, widthPct)),
    heightPct: Math.max(PREVIEW_LAYER_MIN_SIZE_PCT, Math.min(maxHeight, heightPct)),
  };
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

/**
 * Reads and validates a WindowSize object from localStorage.
 * @param key - localStorage key to read from.
 * @returns A valid `WindowSize`, or `null` if absent or malformed.
 */
export function readStoredWindowSize(key: string): WindowSize | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const width = Number((parsed as Record<string, unknown>).width);
    const height = Number((parsed as Record<string, unknown>).height);
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) return null;
    return { width, height };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Payload field extraction
// ---------------------------------------------------------------------------

/**
 * Extracts chroma key settings from an action payload.
 * @param payload - Action payload record.
 * @returns Chroma key config with safe defaults.
 */
export function getChromaFromPayload(
  payload: Record<string, unknown>,
): { enabled: boolean; color: string; tolerance: number } {
  const raw = payload.chromaKey ?? payload.chroma;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { enabled: false, color: '#00ff00', tolerance: 20 };
  }
  const chroma = raw as Record<string, unknown>;
  const color =
    typeof chroma.color === 'string' && chroma.color.trim()
      ? chroma.color
      : '#00ff00';
  return {
    enabled: Boolean(chroma.enabled),
    color,
    tolerance: normalizePercentage(chroma.tolerance, 20),
  };
}

/**
 * Reads and normalises layer placement (leftPct, topPct, widthPct, heightPct)
 * from a payload that may store it under several legacy key patterns.
 * @param payload - Action payload record.
 * @returns Normalised placement object.
 */
export function getPlacementFromPayload(payload: Record<string, unknown>): {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
} {
  const placement =
    asRecord(payload.placement) ??
    asRecord(payload.position) ??
    asRecord(payload.bounds);
  const leftRaw =
    payload.leftPct ?? payload.left ?? payload.xPct ?? payload.x ??
    placement?.leftPct ?? placement?.left ?? placement?.xPct ?? placement?.x;
  const topRaw =
    payload.topPct ?? payload.top ?? payload.yPct ?? payload.y ??
    placement?.topPct ?? placement?.top ?? placement?.yPct ?? placement?.y;
  const widthRaw =
    payload.widthPct ?? payload.width ??
    placement?.widthPct ?? placement?.width;
  const heightRaw =
    payload.heightPct ?? payload.height ??
    placement?.heightPct ?? placement?.height;

  return {
    leftPct: normalizeFreePlacement(readLegacyPercentage(leftRaw, 10), 10),
    topPct: normalizeFreePlacement(readLegacyPercentage(topRaw, 10), 10),
    widthPct: Math.max(
      1,
      normalizeFreePlacement(readLegacyPercentage(widthRaw, 80), 80),
    ),
    heightPct: Math.max(
      1,
      normalizeFreePlacement(readLegacyPercentage(heightRaw, 80), 80),
    ),
  };
}

/**
 * Extracts a flat list of text segments from a rich-text narrative payload,
 * falling back to the plain `text` field when no rich-text doc is present.
 * @param payload - Narrative action payload.
 * @returns Array of text segments with optional formatting.
 */
export function getNarrativeSegments(payload: Record<string, unknown>): Array<{
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
    const blockSegments = Array.isArray(blockRecord?.segments)
      ? blockRecord?.segments
      : [];
    for (const segment of blockSegments) {
      const segmentRecord = asRecord(segment);
      const text =
        typeof segmentRecord?.text === 'string' ? segmentRecord.text : '';
      if (!text) continue;
      segments.push({
        text,
        ...(segmentRecord?.bold !== undefined
          ? { bold: Boolean(segmentRecord.bold) }
          : {}),
        ...(segmentRecord?.italic !== undefined
          ? { italic: Boolean(segmentRecord.italic) }
          : {}),
        ...(segmentRecord?.underline !== undefined
          ? { underline: Boolean(segmentRecord.underline) }
          : {}),
        ...(Number.isFinite(Number(segmentRecord?.fontSizePx))
          ? { fontSizePx: Number(segmentRecord?.fontSizePx) }
          : {}),
        ...(typeof segmentRecord?.color === 'string'
          ? { color: segmentRecord.color }
          : {}),
        ...(typeof segmentRecord?.fontFamily === 'string'
          ? { fontFamily: segmentRecord.fontFamily }
          : {}),
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

// ---------------------------------------------------------------------------
// Action normalisation
// ---------------------------------------------------------------------------

/**
 * Parses a window kind from an action or nested target-window value.
 * @param value - Any value that may contain a window kind.
 * @returns The parsed `ScenePreviewWindowKind`, or `null` if not found.
 */
export function parseWindowKind(value: unknown): ScenePreviewWindowKind | null {
  if (value === 'main' || value === 'projection' || value === 'skyline') {
    return value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const target = value as Record<string, unknown>;
  if (
    target.kind === 'main' ||
    target.kind === 'projection' ||
    target.kind === 'skyline'
  ) {
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
  if (
    target.windowKind === 'main' ||
    target.windowKind === 'projection' ||
    target.windowKind === 'skyline'
  ) {
    return target.windowKind;
  }
  if (
    target.windowType === 'main' ||
    target.windowType === 'projection' ||
    target.windowType === 'skyline'
  ) {
    return target.windowType;
  }
  if (
    target.id === 'main' ||
    target.id === 'projection' ||
    target.id === 'skyline'
  ) {
    return target.id;
  }
  return null;
}

/**
 * Normalises the `targetWindow` field of an action for use inside the editor.
 * Non-window actions have their `targetWindow` cleared; window actions get a
 * canonical `{ kind }` object, defaulting to `'projection'`.
 * @param action - The raw action from storage or a form state.
 * @returns A new action with a normalised `targetWindow`.
 */
export function normalizeWindowTargetForEditor(
  action: SceneActionDto,
): SceneActionDto {
  if (!WINDOW_ACTION_TYPES.has(action.type)) {
    return { ...action, targetWindow: undefined };
  }

  const payload = asRecord(action.payload) ?? {};
  const parsedKind =
    parseWindowKind(action.targetWindow) ??
    parseWindowKind(payload.targetWindow) ??
    parseWindowKind(payload.target);
  return {
    ...action,
    targetWindow: { kind: parsedKind ?? 'projection' },
  };
}

/**
 * Normalises an action's payload for rendering inside the editor
 * (expands compressed placement/chroma fields, etc.).
 * @param action - Raw action.
 * @returns Editor-ready action with normalised payload fields.
 */
export function normalizeActionForEditor(action: SceneActionDto): SceneActionDto {
  const base = normalizeWindowTargetForEditor(action);
  if (
    base.type !== 'sendImageToWindow' &&
    base.type !== 'sendVideoToWindow'
  ) {
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

/**
 * Normalises an action's payload for saving to the API
 * (removes editor-only keys, coerces types, enforces required fields).
 * @param action - Editor action to save.
 * @returns API-ready action.
 */
export function normalizeActionForSave(action: SceneActionDto): SceneActionDto {
  const base = normalizeWindowTargetForEditor(action);
  const payload = (base.payload ?? {}) as Record<string, unknown>;
  const layerOrder = Number(payload.layerOrder);
  const normalizedLayerOrder = Number.isFinite(layerOrder)
    ? Math.round(layerOrder)
    : undefined;

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
        ...(payload.opacity !== undefined
          ? { opacity: normalizeOpacity(payload.opacity) }
          : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        leftPct: placement.leftPct,
        topPct: placement.topPct,
        widthPct: placement.widthPct,
        heightPct: placement.heightPct,
        chromaKey: getChromaFromPayload(payload),
        ...(timelineStartMs !== undefined ? { timelineStartMs } : {}),
        ...(normalizedLayerOrder !== undefined
          ? { layerOrder: normalizedLayerOrder }
          : {}),
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
    const hasValidLoopSegment =
      loopSegmentEnabled &&
      loopSegmentStartMs !== undefined &&
      (loopSegmentEndMs === undefined || loopSegmentEndMs > loopSegmentStartMs);
    const shouldLoopVideo = hasValidLoopSegment
      ? true
      : Boolean(payload.loop);
    return {
      ...base,
      payload: {
        ...(videoAssetId ? { videoAssetId } : {}),
        ...(videoUrl ? { videoUrl } : {}),
        ...(displayName ? { displayName } : {}),
        ...(optionalText(payload.videoAssetName)
          ? { videoAssetName: optionalText(payload.videoAssetName) }
          : {}),
        ...(payload.loop !== undefined || hasValidLoopSegment
          ? { loop: shouldLoopVideo }
          : {}),
        ...(payload.muted !== undefined ? { muted: Boolean(payload.muted) } : {}),
        ...(hasValidLoopSegment ? { loopSegmentEnabled: true } : {}),
        ...(hasValidLoopSegment ? { loopSegmentStartMs } : {}),
        ...(hasValidLoopSegment && loopSegmentEndMs !== undefined
          ? { loopSegmentEndMs }
          : {}),
        ...(hasValidLoopSegment
          ? {
              playIntroOncePerSceneExecution:
                payload.playIntroOncePerSceneExecution !== false,
            }
          : {}),
        ...(payload.opacity !== undefined
          ? { opacity: normalizeOpacity(payload.opacity) }
          : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        leftPct: placement.leftPct,
        topPct: placement.topPct,
        widthPct: placement.widthPct,
        heightPct: placement.heightPct,
        chromaKey: getChromaFromPayload(payload),
        ...(timelineStartMs !== undefined ? { timelineStartMs } : {}),
        ...(normalizedLayerOrder !== undefined
          ? { layerOrder: normalizedLayerOrder }
          : {}),
      },
    };
  }

  if (base.type === 'setWindowBackground') {
    return {
      ...base,
      payload: {
        imageUrl: String(payload.imageUrl ?? '').trim(),
        ...(displayName ? { displayName } : {}),
        ...(optionalText(payload.sizing)
          ? { sizing: optionalText(payload.sizing) }
          : {}),
      },
    };
  }

  if (base.type === 'applyWindowFilter') {
    return {
      ...base,
      payload: {
        filter: String(payload.filter ?? '').trim(),
        ...(displayName ? { displayName } : {}),
        ...(payload.intensity !== undefined &&
        Number.isFinite(Number(payload.intensity))
          ? { intensity: Number(payload.intensity) }
          : {}),
        ...(optionalText(payload.color) ? { color: optionalText(payload.color) } : {}),
      },
    };
  }

  if (base.type === 'setNarrativeText') {
    const placement = getPlacementFromPayload(payload);
    const backgroundMode = String(payload.backgroundMode ?? 'rect').trim();
    const normalizedBackgroundMode =
      backgroundMode === 'none' || backgroundMode === 'capsule'
        ? backgroundMode
        : 'rect';
    const richTextDoc = asRecord(payload.richTextDoc);
    return {
      ...base,
      payload: {
        text: String(payload.text ?? '').trim(),
        ...(displayName ? { displayName } : {}),
        ...(optionalText(payload.title)
          ? { title: optionalText(payload.title) }
          : {}),
        ...(payload.durationMs !== undefined &&
        Number.isFinite(Number(payload.durationMs))
          ? { durationMs: Number(payload.durationMs) }
          : {}),
        ...(richTextDoc ? { richTextDoc } : {}),
        leftPct: placement.leftPct,
        topPct: placement.topPct,
        widthPct: placement.widthPct,
        heightPct: placement.heightPct,
        ...(payload.opacity !== undefined
          ? { opacity: normalizeOpacity(payload.opacity) }
          : {}),
        ...(normalizedLayerOrder !== undefined
          ? { layerOrder: normalizedLayerOrder }
          : {}),
        ...(optionalText(payload.fontFamily)
          ? { fontFamily: optionalText(payload.fontFamily) }
          : {}),
        ...(payload.fontSizePx !== undefined &&
        Number.isFinite(Number(payload.fontSizePx))
          ? {
              fontSizePx: Math.max(
                8,
                Math.min(220, Number(payload.fontSizePx)),
              ),
            }
          : {}),
        ...(optionalText(payload.fontColor)
          ? { fontColor: optionalText(payload.fontColor) }
          : {}),
        ...(optionalText(payload.textAlign)
          ? { textAlign: optionalText(payload.textAlign) }
          : {}),
        ...(payload.lineHeight !== undefined &&
        Number.isFinite(Number(payload.lineHeight))
          ? {
              lineHeight: Math.max(0.8, Math.min(3, Number(payload.lineHeight))),
            }
          : {}),
        ...(payload.letterSpacingPx !== undefined &&
        Number.isFinite(Number(payload.letterSpacingPx))
          ? {
              letterSpacingPx: Math.max(
                -8,
                Math.min(20, Number(payload.letterSpacingPx)),
              ),
            }
          : {}),
        ...(optionalText(payload.fontWeight)
          ? { fontWeight: optionalText(payload.fontWeight) }
          : {}),
        ...(optionalText(payload.fontStyle)
          ? { fontStyle: optionalText(payload.fontStyle) }
          : {}),
        ...(optionalText(payload.textDecoration)
          ? { textDecoration: optionalText(payload.textDecoration) }
          : {}),
        backgroundMode: normalizedBackgroundMode,
        ...(optionalText(payload.backgroundColor)
          ? { backgroundColor: optionalText(payload.backgroundColor) }
          : {}),
        ...(payload.backgroundOpacity !== undefined &&
        Number.isFinite(Number(payload.backgroundOpacity))
          ? { backgroundOpacity: normalizeOpacity(payload.backgroundOpacity) }
          : {}),
        ...(payload.borderRadiusPx !== undefined &&
        Number.isFinite(Number(payload.borderRadiusPx))
          ? {
              borderRadiusPx: Math.max(
                0,
                Math.min(128, Number(payload.borderRadiusPx)),
              ),
            }
          : {}),
        ...(payload.paddingPx !== undefined &&
        Number.isFinite(Number(payload.paddingPx))
          ? {
              paddingPx: Math.max(0, Math.min(64, Number(payload.paddingPx))),
            }
          : {}),
      },
    };
  }

  if (base.type === 'playMusic') {
    return {
      ...base,
      payload: {
        ...(displayName ? { displayName } : {}),
        ...(optionalText(payload.songId)
          ? { songId: optionalText(payload.songId) }
          : {}),
        ...(optionalText(payload.playlistId)
          ? { playlistId: optionalText(payload.playlistId) }
          : {}),
        ...(payload.loop !== undefined ? { loop: Boolean(payload.loop) } : {}),
        ...(payload.volume !== undefined &&
        Number.isFinite(Number(payload.volume))
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
        ...(payload.volume !== undefined &&
        Number.isFinite(Number(payload.volume))
          ? { volume: Number(payload.volume) }
          : {}),
        ...(optionalText(payload.loopMode)
          ? { loopMode: optionalText(payload.loopMode) }
          : {}),
        ...(payload.waitMs !== undefined && Number.isFinite(Number(payload.waitMs))
          ? { waitMs: Number(payload.waitMs) }
          : {}),
        ...(payload.randomMinMs !== undefined &&
        Number.isFinite(Number(payload.randomMinMs))
          ? { randomMinMs: Number(payload.randomMinMs) }
          : {}),
        ...(payload.randomMaxMs !== undefined &&
        Number.isFinite(Number(payload.randomMaxMs))
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
        ...(payload.stopEffects !== undefined
          ? { stopEffects: Boolean(payload.stopEffects) }
          : {}),
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
        ...(payload.intensity !== undefined &&
        Number.isFinite(Number(payload.intensity))
          ? { intensity: Number(payload.intensity) }
          : {}),
        ...(payload.durationMs !== undefined &&
        Number.isFinite(Number(payload.durationMs))
          ? { durationMs: Number(payload.durationMs) }
          : {}),
      },
    };
  }

  return base;
}
