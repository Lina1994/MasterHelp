import { BadRequestException } from '@nestjs/common';
import {
  SCENE_ACTION_TYPES,
  SCENE_MAX_ACTIONS,
  SCENE_MAX_TOTAL_DELAY_MS,
  SCENE_WINDOW_TARGET_KINDS,
  type SceneActionDefinition,
  type SceneActionType,
  type SceneWindowTarget,
} from '../actionTypes';

type LooseSceneActionInput = {
  id?: unknown;
  type?: unknown;
  payload?: unknown;
  delay?: unknown;
  targetWindow?: unknown;
};

const WINDOW_ACTIONS = new Set<SceneActionType>([
  'sendImageToWindow',
  'sendVideoToWindow',
  'setWindowBackground',
  'applyWindowFilter',
  'clearWindowFilter',
]);

const asObject = (value: unknown, field = 'payload'): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`Action field "${field}" must be a non-empty string`);
  }
  return value.trim();
};

const asNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new BadRequestException(`Action field "${field}" must be a number`);
  }
  return value;
};

const asBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`Action field "${field}" must be a boolean`);
  }
  return value;
};

const normalizeDelay = (delay: unknown): number | undefined => {
  if (delay === undefined || delay === null) return undefined;
  if (typeof delay !== 'number' || !Number.isInteger(delay) || delay < 0 || delay > 600_000) {
    throw new BadRequestException('Action delay must be an integer between 0 and 600000');
  }
  return delay;
};

const normalizeTargetWindow = (value: unknown, actionType: SceneActionType): SceneWindowTarget | undefined => {
  if (value === undefined || value === null) {
    if (WINDOW_ACTIONS.has(actionType)) {
      throw new BadRequestException(`targetWindow is required for action type "${actionType}"`);
    }
    return undefined;
  }

  const target = asObject(value, 'targetWindow');
  const kind = asString(target.kind, 'targetWindow.kind') as SceneWindowTarget['kind'];
  if (!SCENE_WINDOW_TARGET_KINDS.includes(kind)) {
    throw new BadRequestException(`Invalid targetWindow.kind "${kind}"`);
  }

  const normalized: SceneWindowTarget = { kind };
  if (target.windowId !== undefined) normalized.windowId = asString(target.windowId, 'targetWindow.windowId');
  if (target.windowType !== undefined) normalized.windowType = asString(target.windowType, 'targetWindow.windowType');
  if (kind === 'instance' && !normalized.windowId) {
    throw new BadRequestException('targetWindow.windowId is required for instance targets');
  }
  if (kind === 'custom' && !normalized.windowType) {
    throw new BadRequestException('targetWindow.windowType is required for custom targets');
  }
  return normalized;
};

const normalizePayload = (type: SceneActionType, payload: unknown): Record<string, unknown> | undefined => {
  if (type === 'clearWindowFilter') {
    if (payload === undefined || payload === null) return undefined;
    return asObject(payload);
  }

  const body = asObject(payload);

  switch (type) {
    case 'playMusic':
      if (!body.songId && !body.playlistId) {
        throw new BadRequestException('playMusic requires songId or playlistId');
      }
      return {
        songId: body.songId === undefined ? undefined : asString(body.songId, 'songId'),
        playlistId: body.playlistId === undefined ? undefined : asString(body.playlistId, 'playlistId'),
        loop: body.loop === undefined ? undefined : asBoolean(body.loop, 'loop'),
        volume: body.volume === undefined ? undefined : asNumber(body.volume, 'volume'),
      };
    case 'stopMusic':
      return {
        stopEffects: body.stopEffects === undefined ? undefined : asBoolean(body.stopEffects, 'stopEffects'),
      };
    case 'playSound':
      return {
        effectId: asString(body.effectId, 'effectId'),
        volume: body.volume === undefined ? undefined : asNumber(body.volume, 'volume'),
        loopMode: body.loopMode === undefined ? undefined : asString(body.loopMode, 'loopMode'),
        waitMs: body.waitMs === undefined ? undefined : asNumber(body.waitMs, 'waitMs'),
        randomMinMs: body.randomMinMs === undefined ? undefined : asNumber(body.randomMinMs, 'randomMinMs'),
        randomMaxMs: body.randomMaxMs === undefined ? undefined : asNumber(body.randomMaxMs, 'randomMaxMs'),
      };
    case 'setMusicVolume':
      return { value: asNumber(body.value, 'value') };
    case 'sendImageToWindow':
      return {
        imageUrl: asString(body.imageUrl, 'imageUrl'),
        title: body.title === undefined ? undefined : asString(body.title, 'title'),
      };
    case 'sendVideoToWindow':
      if (!body.videoAssetId && !body.videoUrl) {
        throw new BadRequestException('sendVideoToWindow requires videoAssetId or videoUrl');
      }
      return {
        videoAssetId: body.videoAssetId === undefined ? undefined : asString(body.videoAssetId, 'videoAssetId'),
        videoUrl: body.videoUrl === undefined ? undefined : asString(body.videoUrl, 'videoUrl'),
        loop: body.loop === undefined ? undefined : asBoolean(body.loop, 'loop'),
        muted: body.muted === undefined ? undefined : asBoolean(body.muted, 'muted'),
      };
    case 'setWindowBackground':
      return {
        imageUrl: asString(body.imageUrl, 'imageUrl'),
        sizing: body.sizing === undefined ? undefined : asString(body.sizing, 'sizing'),
      };
    case 'applyWindowFilter':
      return {
        filter: asString(body.filter, 'filter'),
        intensity: body.intensity === undefined ? undefined : asNumber(body.intensity, 'intensity'),
        color: body.color === undefined ? undefined : asString(body.color, 'color'),
      };
    case 'setWeather':
      return {
        preset: asString(body.preset, 'preset'),
        intensity: body.intensity === undefined ? undefined : asNumber(body.intensity, 'intensity'),
        durationMs: body.durationMs === undefined ? undefined : asNumber(body.durationMs, 'durationMs'),
      };
    case 'setNarrativeText':
      return {
        text: asString(body.text, 'text'),
        title: body.title === undefined ? undefined : asString(body.title, 'title'),
        durationMs: body.durationMs === undefined ? undefined : asNumber(body.durationMs, 'durationMs'),
      };
    case 'runShortcut':
      return { shortcutId: asString(body.shortcutId, 'shortcutId') };
    case 'delay':
      return { durationMs: asNumber(body.durationMs, 'durationMs') };
    case 'runScene':
      return { sceneId: asString(body.sceneId, 'sceneId') };
    default:
      return body;
  }
};

/**
 * Converts incoming scene actions into a validated internal shape.
 */
export const validateAndNormalizeSceneActions = (input: LooseSceneActionInput[]): SceneActionDefinition[] => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Scene must include at least one action');
  }
  if (input.length > SCENE_MAX_ACTIONS) {
    throw new BadRequestException(`Scene cannot exceed ${SCENE_MAX_ACTIONS} actions`);
  }

  const seenIds = new Set<string>();
  let totalDelayBudget = 0;

  return input.map((raw) => {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Each scene action must be an object');
    }

    const id = asString(raw.id, 'id');
    if (seenIds.has(id)) {
      throw new BadRequestException(`Duplicate scene action id "${id}"`);
    }
    seenIds.add(id);

    const type = asString(raw.type, 'type') as SceneActionType;
    if (!SCENE_ACTION_TYPES.includes(type)) {
      throw new BadRequestException(`Unsupported scene action type "${type}"`);
    }

    const delay = normalizeDelay(raw.delay);
    const payload = normalizePayload(type, raw.payload);
    const targetWindow = normalizeTargetWindow(raw.targetWindow, type);

    totalDelayBudget += delay ?? 0;
    if (type === 'delay') {
      totalDelayBudget += Number((payload as { durationMs?: number } | undefined)?.durationMs ?? 0);
    }
    if (totalDelayBudget > SCENE_MAX_TOTAL_DELAY_MS) {
      throw new BadRequestException(`Scene total delay budget cannot exceed ${SCENE_MAX_TOTAL_DELAY_MS}ms`);
    }

    return {
      id,
      type,
      payload: payload ?? {},
      ...(delay !== undefined ? { delay } : {}),
      ...(targetWindow ? { targetWindow } : {}),
    } as SceneActionDefinition;
  });
};