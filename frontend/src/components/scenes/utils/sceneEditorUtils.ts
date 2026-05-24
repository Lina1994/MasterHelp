/**
 * @file sceneEditorUtils.ts
 * @description Pure utility functions and constants shared across the Scene editor:
 *   duration/time normalisation, payload factories, video drag helpers,
 *   media URL resolution and draft scaffolding.
 */

import { v4 as uuidv4 } from 'uuid';
import type { SceneActionDto, ScenePayload } from '../../../types/scenes';
import API_BASE_URL from '../../../apiBase';

// ---------------------------------------------------------------------------
// Editor-wide constants
// ---------------------------------------------------------------------------

/** Maximum number of actions allowed in a single scene. */
export const SCENE_MAX_ACTIONS = 48;

/** Keys injected into an action payload when it is part of a split group. */
export const CLIP_METADATA_KEYS = [
  'splitGroupId',
  'splitIndex',
  'splitTotal',
  'parentActionId',
  'clipInSec',
  'clipOutSec',
  'clipDurationMs',
] as const;

/** DnD payload prefix used when dragging a video asset onto the timeline. */
export const VIDEO_ASSET_DND_PREFIX = 'scene-video-asset:';

/** DnD payload prefix used when dragging an image asset onto the timeline. */
export const IMAGE_ASSET_DND_PREFIX = 'scene-image-asset:';

/** Frames per second used by the preview ticker. */
export const PREVIEW_FPS = 30;

/** Milliseconds between derivation status polls. */
export const DERIVATION_POLL_INTERVAL_MS = 1200;

/** Maximum number of derivation status polls before giving up. */
export const DERIVATION_MAX_POLLS = 45;

// ---------------------------------------------------------------------------
// Number normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Converts an unknown value to a strictly positive integer duration in ms.
 * @param value - Raw input value.
 * @returns Rounded positive integer, or `undefined` if invalid.
 */
export function toPositiveDurationMs(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

/**
 * Converts an unknown value to a non-negative integer in ms.
 * @param value - Raw input value.
 * @returns Rounded non-negative integer, or `undefined` if invalid.
 */
export function toNonNegativeMs(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

/**
 * Converts an unknown value to a non-negative float in seconds.
 * @param value - Raw input value.
 * @returns Non-negative float, or `undefined` if invalid.
 */
export function toNonNegativeSec(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

/**
 * Resolves after `ms` milliseconds.
 * @param ms - Number of milliseconds to wait.
 */
export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Measures the video duration by loading the metadata of a URL.
 * Times out after 8 seconds and resolves with `undefined`.
 * @param url - Video URL accessible by the browser.
 * @returns Duration in ms, or `undefined` on error / timeout.
 */
export function measureVideoDurationMs(url: string): Promise<number | undefined> {
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

// ---------------------------------------------------------------------------
// Payload helpers
// ---------------------------------------------------------------------------

/**
 * Removes split/clip metadata keys from an action payload copy.
 * @param payload - Original action payload.
 * @returns New object with clip metadata stripped.
 */
export function omitClipMetadata(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  for (const key of CLIP_METADATA_KEYS) {
    delete next[key];
  }
  return next;
}

/**
 * Returns a sensible default payload for a given action type.
 * @param type - SceneAction type string.
 * @returns Default payload object.
 */
export function emptyPayload(type: string): Record<string, unknown> {
  switch (type) {
    case 'playMusic':
      return { songId: '', loop: false, volume: 80 };
    case 'playPreset':
      return {
        presetId: '',
        volume: 100,
        playbackRate: 1,
        pitchSemitones: 0,
        echoEnabled: false,
        echoDelayMs: 300,
        echoFeedback: 0.3,
        filterType: 'none',
        filterFrequency: 1000,
        filterQ: 1,
      };
    case 'stopMusic':
      return { stopEffects: false };
    case 'playSound':
      return {
        effectId: '',
        volume: 80,
        loopMode: 'once',
        playbackRate: 1,
        pitchSemitones: 0,
        echoEnabled: false,
        echoDelayMs: 300,
        echoFeedback: 0.3,
        filterType: 'none',
        filterFrequency: 1000,
        filterQ: 1,
      };
    case 'setMusicVolume':
      return { value: 80 };
    case 'stopSound':
      return { effectId: '' };
    case 'setSoundVolume':
      return { value: 80, effectId: '' };
    case 'sendImageToWindow':
      return {
        imageUrl: '',
        title: '',
        opacity: 1,
        leftPct: 10,
        topPct: 10,
        widthPct: 80,
        heightPct: 80,
      };
    case 'sendVideoToWindow':
      return {
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
    case 'setWindowBackground':
      return { imageUrl: '', sizing: 'cover' };
    case 'applyWindowFilter':
      return { filter: 'blur', intensity: 0.5, color: '', durationMs: 2500 };
    case 'clearWindowFilter':
      return {};
    case 'setWeather':
      return { preset: 'rain', intensity: 0.5, durationMs: 0 };
    case 'setNarrativeText':
      return {
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
        voiceConfig: {
          mode: 'retroBeep',
          speed: 1,
          pitchRange: 8,
          tomodachi: {
            sampleSet: 'classic',
            consonantDensity: 1,
            humanize: 0.65,
          },
          qwen: {
            persona: 'male',
            pitchMul: 1,
            speedMs: 90,
            brightness: 1,
            volume: 0.7,
            jitter: 0.08,
            transitionMul: 0.3,
            vowelGlitch: 0.28,
          },
        },
        voiceTarget: 'both',
      };
    case 'runShortcut':
      return { shortcutId: '' };
    case 'delay':
      return { durationMs: 1000 };
    case 'runScene':
      return { sceneId: '' };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Media URL helpers
// ---------------------------------------------------------------------------

/**
 * Ensures a media URL is absolute, prepending the backend origin when needed.
 * @param rawUrl - URL as stored (may be relative).
 * @returns Absolute URL string.
 */
export function resolveSceneMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (/^(https?:|data:|blob:)/i.test(rawUrl)) return rawUrl;

  const base = String(API_BASE_URL ?? '').replace(/\/+$/, '');
  if (!base) return rawUrl;

  const normalizedPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${base}${normalizedPath}`;
}

// ---------------------------------------------------------------------------
// Video drag-and-drop payload encoding
// ---------------------------------------------------------------------------

/**
 * Encodes a video asset ID into a DnD data-transfer string.
 * @param assetId - Scene video asset ID.
 * @returns Encoded drag payload string.
 */
export function toVideoDragPayload(assetId: string): string {
  return `${VIDEO_ASSET_DND_PREFIX}${assetId}`;
}

/**
 * Decodes a DnD data-transfer string back to a video asset ID.
 * @param raw - Raw drag payload string.
 * @returns Asset ID, or `null` if the string is not a video drag payload.
 */
export function fromVideoDragPayload(raw: string): string | null {
  if (!raw.startsWith(VIDEO_ASSET_DND_PREFIX)) return null;
  const assetId = raw.slice(VIDEO_ASSET_DND_PREFIX.length).trim();
  return assetId || null;
}

/**
 * Encodes an image descriptor into a DnD data-transfer string.
 * @param image - Selected image metadata.
 * @returns Encoded drag payload string.
 */
export function toImageDragPayload(image: { url: string; label: string }): string {
  const payload = {
    url: String(image.url ?? '').trim(),
    label: String(image.label ?? '').trim(),
  };
  return `${IMAGE_ASSET_DND_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
}

/**
 * Decodes a DnD string back to an image descriptor.
 * @param raw - Raw drag payload string.
 * @returns Decoded image metadata, or `null` if invalid.
 */
export function fromImageDragPayload(raw: string): { url: string; label: string } | null {
  if (!raw.startsWith(IMAGE_ASSET_DND_PREFIX)) return null;
  const encoded = raw.slice(IMAGE_ASSET_DND_PREFIX.length).trim();
  if (!encoded) return null;

  try {
    const decoded = JSON.parse(decodeURIComponent(encoded)) as { url?: unknown; label?: unknown };
    const url = String(decoded?.url ?? '').trim();
    const label = String(decoded?.label ?? '').trim();
    if (!url) return null;
    return { url, label: label || 'Imagen' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Draft factories
// ---------------------------------------------------------------------------

/**
 * Creates a new empty SceneActionDto with a delay action as default.
 * @returns A blank SceneActionDto.
 */
export function defaultAction(): SceneActionDto {
  return { id: uuidv4(), type: 'delay', delay: 0, payload: { durationMs: 1000 } };
}

/**
 * Creates an empty ScenePayload draft for a new scene.
 * @param campaignId - Campaign to associate the scene with (null = global).
 * @returns A blank ScenePayload.
 */
export function blankDraft(campaignId?: string | null): ScenePayload {
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
    takeOverMusicOnStart: false,
    restorePreviousMusicOnFinish: true,
    scope: campaignId ? 'campaign' : 'global',
    campaignId: campaignId ?? null,
    actions: [],
  };
}
