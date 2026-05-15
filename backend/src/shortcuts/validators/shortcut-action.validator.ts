import { BadRequestException } from '@nestjs/common';
import {
  SHORTCUT_ACTION_KINDS,
  SHORTCUT_WINDOW_TARGET_KINDS,
  type ShortcutActionDefinition,
  type ShortcutActionKind,
  type ShortcutWindowTarget,
} from '../actionTypes';

type LooseActionInput = {
  kind: string;
  payload?: unknown;
  config?: unknown;
  delayMs?: unknown;
  targetWindow?: unknown;
  activeStateRule?: unknown;
};

const MOMENTS = new Set(['dawn', 'morning', 'afternoon', 'night', 'midnight']);

const hasOwn = (value: unknown, key: string): boolean => {
  return typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key);
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Action payload must be an object');
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`Action payload field "${field}" must be a non-empty string`);
  }
  return value.trim();
};

const asNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new BadRequestException(`Action payload field "${field}" must be a number`);
  }
  return value;
};

const asBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`Action payload field "${field}" must be a boolean`);
  }
  return value;
};

const validateTargetWindow = (value: unknown): ShortcutWindowTarget | undefined => {
  if (value === undefined || value === null) return undefined;
  const target = asObject(value);
  const kind = asString(target.kind, 'targetWindow.kind') as ShortcutWindowTarget['kind'];
  if (!SHORTCUT_WINDOW_TARGET_KINDS.includes(kind)) {
    throw new BadRequestException(`Invalid target window kind "${kind}"`);
  }
  const normalized: ShortcutWindowTarget = { kind };
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

const normalizeDelay = (delayMs: unknown): number | undefined => {
  if (delayMs === undefined || delayMs === null) return undefined;
  if (typeof delayMs !== 'number' || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 600_000) {
    throw new BadRequestException('Action delayMs must be an integer between 0 and 600000');
  }
  return delayMs;
};

const normalizePayload = (kind: ShortcutActionKind, payload: unknown): Record<string, unknown> | undefined => {
  if (kind === 'toggleState' || kind === 'audio.pause' || kind === 'audio.resume' || kind === 'audio.stop' || kind === 'time.advanceMoment' || kind === 'time.rewindMoment' || kind === 'combat.start' || kind === 'combat.escape' || kind === 'combat.end' || kind === 'combat.nextTurn' || kind === 'combat.previousTurn' || kind === 'window.clearFilter') {
    if (payload === undefined || payload === null) return undefined;
    return asObject(payload);
  }

  const body = asObject(payload);

  switch (kind) {
    case 'playSoundEffect':
      return {
        effectId: asString(body.effectId, 'effectId'),
        volume: body.volume === undefined ? undefined : asNumber(body.volume, 'volume'),
        loopMode: body.loopMode === undefined ? undefined : asString(body.loopMode, 'loopMode'),
        uniquePerEffect: body.uniquePerEffect === undefined ? undefined : asBoolean(body.uniquePerEffect, 'uniquePerEffect'),
      };
    case 'audio.playSong':
      return {
        songId: asString(body.songId, 'songId'),
        loop: body.loop === undefined ? undefined : asBoolean(body.loop, 'loop'),
        volume: body.volume === undefined ? undefined : asNumber(body.volume, 'volume'),
      };
    case 'audio.setVolume':
    case 'audio.adjustVolume':
      return { value: asNumber(body.value, 'value') };
    case 'audio.setMute':
      return { muted: asBoolean(body.muted, 'muted') };
    case 'audio.playPlaylist':
      return { playlistId: asString(body.playlistId, 'playlistId') };
    case 'audio.playPresetEffects':
      return { presetId: asString(body.presetId, 'presetId') };
    case 'time.advanceDay':
    case 'time.rewindDay':
      return {
        amount: body.amount === undefined ? undefined : asNumber(body.amount, 'amount'),
      };
    case 'time.setMoment': {
      const value = asString(body.value, 'value');
      if (!MOMENTS.has(value)) {
        throw new BadRequestException(`Unsupported moment value "${value}"`);
      }
      return { value };
    }
    case 'window.showCharacterImage':
    case 'window.showNpcImage':
    case 'window.showMonsterImage':
      return { entityId: asString(body.entityId, 'entityId') };
    case 'window.applyFilter':
      return {
        filter: asString(body.filter, 'filter'),
        intensity: body.intensity === undefined ? undefined : asNumber(body.intensity, 'intensity'),
        color: body.color === undefined ? undefined : asString(body.color, 'color'),
      };
    case 'window.showText':
      return {
        text: asString(body.text, 'text'),
        title: body.title === undefined ? undefined : asString(body.title, 'title'),
        durationMs: body.durationMs === undefined ? undefined : asNumber(body.durationMs, 'durationMs'),
      };
    case 'window.setActiveMap':
      return { mapId: asString(body.mapId, 'mapId') };
    case 'config.setLanguage':
      return { language: asString(body.language, 'language') };
    case 'config.setTheme':
      return { theme: asString(body.theme, 'theme') };
    case 'config.setFontScale':
      return { scale: asNumber(body.scale, 'scale') };
    case 'config.updateSettings':
      return {
        key: asString(body.key, 'key'),
        value: hasOwn(body, 'value') ? body.value : undefined,
      };
    case 'delay.wait':
      return { durationMs: asNumber(body.durationMs, 'durationMs') };
    case 'runScene':
      return { sceneId: asString(body.sceneId, 'sceneId') };
    default:
      return body;
  }
};

/**
 * Converts incoming shortcut actions (legacy or new format) into a validated shape.
 */
export const validateAndNormalizeShortcutActions = (input: LooseActionInput[]): ShortcutActionDefinition[] => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Shortcut must include at least one action');
  }

  return input.map((raw) => {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Each shortcut action must be an object');
    }
    const kind = raw.kind as ShortcutActionKind;
    if (!SHORTCUT_ACTION_KINDS.includes(kind)) {
      throw new BadRequestException(`Unsupported shortcut action kind "${String(raw.kind)}"`);
    }

    const payloadSource = raw.payload ?? raw.config;
    const payload = normalizePayload(kind, payloadSource);
    const delayMs = normalizeDelay(raw.delayMs);
    const targetWindow = validateTargetWindow(raw.targetWindow);

    // Default activeStateRule based on action kind
    const defaultActiveStateRule = kind.startsWith('playSoundEffect') || kind.startsWith('audio.') ? 'temporary' : 'never';
    const activeStateRuleValue = raw.activeStateRule ?? defaultActiveStateRule;

    return {
      kind,
      ...(payload !== undefined ? { payload } : {}),
      ...(delayMs !== undefined ? { delayMs } : {}),
      ...(targetWindow ? { targetWindow } : {}),
      ...(activeStateRuleValue ? { activeStateRule: activeStateRuleValue } : {}),
    } as ShortcutActionDefinition;
  });
};

/**
 * Normalizes a hotkey so conflict checks are deterministic across clients.
 */
export const normalizeHotkey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => {
      const order = ['ctrl', 'alt', 'shift', 'meta'];
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    })
    .join('+');

  return normalized || null;
};
