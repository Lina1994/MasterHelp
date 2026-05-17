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

const asOptionalNonEmptyString = (value: unknown, field: string): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`Action field "${field}" must be a non-empty string`);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
};

const asOptionalLabel = (value: unknown, field: string, maxLength = 120): string | undefined => {
  const label = asOptionalNonEmptyString(value, field);
  if (!label) return undefined;
  if (label.length > maxLength) {
    throw new BadRequestException(`Action field "${field}" cannot exceed ${maxLength} characters`);
  }
  return label;
};

const asOptionalUuid = (value: unknown, field: string): string | undefined => {
  const normalized = asOptionalNonEmptyString(value, field);
  if (!normalized) return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new BadRequestException(`Action field "${field}" must be a valid UUID`);
  }
  return normalized;
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

const asOptionalNonNegativeNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const normalized = asNumber(value, field);
  if (normalized < 0) {
    throw new BadRequestException(`Action field "${field}" must be greater than or equal to 0`);
  }
  return normalized;
};

const asOptionalNonNegativeInt = (value: unknown, field: string): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const normalized = asNumber(value, field);
  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new BadRequestException(`Action field "${field}" must be an integer greater than or equal to 0`);
  }
  return normalized;
};

const asOpacity = (value: unknown, field: string): number => {
  const opacity = asNumber(value, field);
  if (opacity < 0 || opacity > 1) {
    throw new BadRequestException(`Action field "${field}" must be between 0 and 1`);
  }
  return opacity;
};

const asPercentage = (value: unknown, field: string): number => {
  const percentage = asNumber(value, field);
  if (percentage < 0 || percentage > 100) {
    throw new BadRequestException(`Action field "${field}" must be between 0 and 100`);
  }
  return percentage;
};

const asFreePercentage = (value: unknown, field: string, min: number, max: number): number => {
  const percentage = asNumber(value, field);
  if (percentage < min || percentage > max) {
    throw new BadRequestException(`Action field "${field}" must be between ${min} and ${max}`);
  }
  return percentage;
};

const asOptionalEnum = <T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined => {
  if (value === undefined || value === null) return undefined;
  const normalized = asString(value, field) as T;
  if (!allowed.includes(normalized)) {
    throw new BadRequestException(`Action field "${field}" must be one of: ${allowed.join(', ')}`);
  }
  return normalized;
};

const asOptionalHexColor = (value: unknown, field: string): string | undefined => {
  const normalized = asOptionalNonEmptyString(value, field);
  if (!normalized) return undefined;
  const color = normalized.startsWith('#') ? normalized : `#${normalized}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new BadRequestException(`Action field "${field}" must be a hex color like #112233`);
  }
  return color.toLowerCase();
};

const normalizeNarrativeRichTextDoc = (
  value: unknown,
): {
  blocks: Array<{
    segments: Array<{
      text: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      fontSizePx?: number;
      color?: string;
      fontFamily?: string;
    }>;
  }>;
} | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const doc = asObject(value, 'richTextDoc');
  const blocksRaw = doc.blocks;
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
    throw new BadRequestException('Action field "richTextDoc.blocks" must be a non-empty array');
  }

  const blocks = blocksRaw.map((blockValue, blockIndex) => {
    const block = asObject(blockValue, `richTextDoc.blocks[${blockIndex}]`);
    const segmentsRaw = block.segments;
    if (!Array.isArray(segmentsRaw) || segmentsRaw.length === 0) {
      throw new BadRequestException(`Action field "richTextDoc.blocks[${blockIndex}].segments" must be a non-empty array`);
    }
    const segments = segmentsRaw.map((segmentValue, segmentIndex) => {
      const segment = asObject(segmentValue, `richTextDoc.blocks[${blockIndex}].segments[${segmentIndex}]`);
      return {
        text: asString(segment.text, `richTextDoc.blocks[${blockIndex}].segments[${segmentIndex}].text`),
        ...(segment.bold === undefined ? {} : { bold: asBoolean(segment.bold, `richTextDoc.blocks[${blockIndex}].segments[${segmentIndex}].bold`) }),
        ...(segment.italic === undefined ? {} : { italic: asBoolean(segment.italic, `richTextDoc.blocks[${blockIndex}].segments[${segmentIndex}].italic`) }),
        ...(segment.underline === undefined ? {} : { underline: asBoolean(segment.underline, `richTextDoc.blocks[${blockIndex}].segments[${segmentIndex}].underline`) }),
        ...(segment.fontSizePx === undefined ? {} : { fontSizePx: asFreePercentage(segment.fontSizePx, `richTextDoc.blocks[${blockIndex}].segments[${segmentIndex}].fontSizePx`, 8, 220) }),
        ...(segment.color === undefined ? {} : { color: asOptionalHexColor(segment.color, `richTextDoc.blocks[${blockIndex}].segments[${segmentIndex}].color`) }),
        ...(segment.fontFamily === undefined ? {} : { fontFamily: asOptionalLabel(segment.fontFamily, `richTextDoc.blocks[${blockIndex}].segments[${segmentIndex}].fontFamily`, 120) }),
      };
    });
    return { segments };
  });

  return { blocks };
};

const normalizeChromaKey = (
  value: unknown,
): { enabled: boolean; color: string; tolerance: number } | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const body = asObject(value, 'chromaKey');
  const enabled = body.enabled === undefined ? false : asBoolean(body.enabled, 'chromaKey.enabled');
  const colorRaw = body.color === undefined ? '#00ff00' : asString(body.color, 'chromaKey.color');
  const color = colorRaw.startsWith('#') ? colorRaw : `#${colorRaw}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new BadRequestException('Action field "chromaKey.color" must be a hex color like #00ff00');
  }
  const tolerance = body.tolerance === undefined ? 20 : asPercentage(body.tolerance, 'chromaKey.tolerance');
  return { enabled, color: color.toLowerCase(), tolerance };
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

const normalizeClipMetadata = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const splitGroupId = asOptionalUuid(body.splitGroupId, 'splitGroupId');
  const splitIndex = asOptionalNonNegativeInt(body.splitIndex, 'splitIndex');
  const splitTotal = asOptionalNonNegativeInt(body.splitTotal, 'splitTotal');
  const parentActionId = asOptionalUuid(body.parentActionId, 'parentActionId');
  const clipInSec = asOptionalNonNegativeNumber(body.clipInSec, 'clipInSec');
  const clipOutSec = asOptionalNonNegativeNumber(body.clipOutSec, 'clipOutSec');
  const clipDurationMs = asOptionalNonNegativeInt(body.clipDurationMs, 'clipDurationMs');

  if (splitGroupId && (splitIndex === undefined || splitTotal === undefined)) {
    throw new BadRequestException('Action split metadata requires splitIndex and splitTotal when splitGroupId is provided');
  }

  if ((splitIndex !== undefined || splitTotal !== undefined) && !splitGroupId) {
    throw new BadRequestException('Action split metadata requires splitGroupId when splitIndex or splitTotal is provided');
  }

  if (splitTotal !== undefined && splitTotal < 2) {
    throw new BadRequestException('Action field "splitTotal" must be greater than or equal to 2');
  }

  if (
    splitIndex !== undefined
    && splitTotal !== undefined
    && splitIndex >= splitTotal
  ) {
    throw new BadRequestException('Action field "splitIndex" must be less than splitTotal');
  }

  if (clipInSec !== undefined && clipOutSec !== undefined && clipOutSec <= clipInSec) {
    throw new BadRequestException('Action clip metadata requires clipOutSec to be greater than clipInSec');
  }

  return {
    ...(splitGroupId ? { splitGroupId } : {}),
    ...(splitIndex !== undefined ? { splitIndex } : {}),
    ...(splitTotal !== undefined ? { splitTotal } : {}),
    ...(parentActionId ? { parentActionId } : {}),
    ...(clipInSec !== undefined ? { clipInSec } : {}),
    ...(clipOutSec !== undefined ? { clipOutSec } : {}),
    ...(clipDurationMs !== undefined ? { clipDurationMs } : {}),
  };
};

const normalizePayload = (type: SceneActionType, payload: unknown): Record<string, unknown> | undefined => {
  if (type === 'clearWindowFilter') {
    if (payload === undefined || payload === null) return undefined;
    return asObject(payload);
  }

  const body = asObject(payload);
  const displayName = asOptionalLabel(body.displayName, 'displayName');

  switch (type) {
    case 'playMusic':
      if (!body.songId && !body.playlistId) {
        throw new BadRequestException('playMusic requires songId or playlistId');
      }
      return {
        ...(displayName ? { displayName } : {}),
        songId: body.songId === undefined ? undefined : asString(body.songId, 'songId'),
        playlistId: body.playlistId === undefined ? undefined : asString(body.playlistId, 'playlistId'),
        loop: body.loop === undefined ? undefined : asBoolean(body.loop, 'loop'),
        volume: body.volume === undefined ? undefined : asNumber(body.volume, 'volume'),
        ...normalizeClipMetadata(body),
      };
    case 'stopMusic':
      return {
        ...(displayName ? { displayName } : {}),
        stopEffects: body.stopEffects === undefined ? undefined : asBoolean(body.stopEffects, 'stopEffects'),
      };
    case 'playSound':
      return {
        ...(displayName ? { displayName } : {}),
        effectId: asString(body.effectId, 'effectId'),
        volume: body.volume === undefined ? undefined : asNumber(body.volume, 'volume'),
        loopMode: body.loopMode === undefined ? undefined : asString(body.loopMode, 'loopMode'),
        waitMs: body.waitMs === undefined ? undefined : asNumber(body.waitMs, 'waitMs'),
        randomMinMs: body.randomMinMs === undefined ? undefined : asNumber(body.randomMinMs, 'randomMinMs'),
        randomMaxMs: body.randomMaxMs === undefined ? undefined : asNumber(body.randomMaxMs, 'randomMaxMs'),
        ...normalizeClipMetadata(body),
      };
    case 'setMusicVolume':
      return {
        ...(displayName ? { displayName } : {}),
        value: asNumber(body.value, 'value'),
      };
    case 'sendImageToWindow':
      return {
        ...(displayName ? { displayName } : {}),
        imageUrl: asString(body.imageUrl, 'imageUrl'),
        title: body.title === undefined ? undefined : asString(body.title, 'title'),
        opacity: body.opacity === undefined ? undefined : asOpacity(body.opacity, 'opacity'),
        durationMs: body.durationMs === undefined ? undefined : asNumber(body.durationMs, 'durationMs'),
        timelineStartMs: body.timelineStartMs === undefined ? undefined : asNumber(body.timelineStartMs, 'timelineStartMs'),
        chromaKey: normalizeChromaKey(body.chromaKey),
        leftPct: body.leftPct === undefined ? undefined : asFreePercentage(body.leftPct, 'leftPct', -50, 150),
        topPct: body.topPct === undefined ? undefined : asFreePercentage(body.topPct, 'topPct', -50, 150),
        widthPct: body.widthPct === undefined ? undefined : asFreePercentage(body.widthPct, 'widthPct', 1, 200),
        heightPct: body.heightPct === undefined ? undefined : asFreePercentage(body.heightPct, 'heightPct', 1, 200),
        ...normalizeClipMetadata(body),
      };
    case 'sendVideoToWindow':
      {
        const videoAssetId = asOptionalNonEmptyString(body.videoAssetId, 'videoAssetId');
        const videoUrl = asOptionalNonEmptyString(body.videoUrl, 'videoUrl');
        if (!videoAssetId && !videoUrl) {
          throw new BadRequestException('sendVideoToWindow requires videoAssetId or videoUrl');
        }
        return {
          ...(displayName ? { displayName } : {}),
          videoAssetId,
          videoUrl,
          videoAssetName: asOptionalLabel(body.videoAssetName, 'videoAssetName'),
          loop: body.loop === undefined ? undefined : asBoolean(body.loop, 'loop'),
          muted: body.muted === undefined ? undefined : asBoolean(body.muted, 'muted'),
          opacity: body.opacity === undefined ? undefined : asOpacity(body.opacity, 'opacity'),
          durationMs: body.durationMs === undefined ? undefined : asNumber(body.durationMs, 'durationMs'),
          timelineStartMs: body.timelineStartMs === undefined ? undefined : asNumber(body.timelineStartMs, 'timelineStartMs'),
          chromaKey: normalizeChromaKey(body.chromaKey),
          leftPct: body.leftPct === undefined ? undefined : asFreePercentage(body.leftPct, 'leftPct', -50, 150),
          topPct: body.topPct === undefined ? undefined : asFreePercentage(body.topPct, 'topPct', -50, 150),
          widthPct: body.widthPct === undefined ? undefined : asFreePercentage(body.widthPct, 'widthPct', 1, 200),
          heightPct: body.heightPct === undefined ? undefined : asFreePercentage(body.heightPct, 'heightPct', 1, 200),
          ...normalizeClipMetadata(body),
        };
      }
    case 'setWindowBackground':
      return {
        ...(displayName ? { displayName } : {}),
        imageUrl: asString(body.imageUrl, 'imageUrl'),
        sizing: body.sizing === undefined ? undefined : asString(body.sizing, 'sizing'),
      };
    case 'applyWindowFilter':
      return {
        ...(displayName ? { displayName } : {}),
        filter: asString(body.filter, 'filter'),
        intensity: body.intensity === undefined ? undefined : asNumber(body.intensity, 'intensity'),
        color: body.color === undefined ? undefined : asString(body.color, 'color'),
      };
    case 'setWeather':
      return {
        ...(displayName ? { displayName } : {}),
        preset: asString(body.preset, 'preset'),
        intensity: body.intensity === undefined ? undefined : asNumber(body.intensity, 'intensity'),
        durationMs: body.durationMs === undefined ? undefined : asNumber(body.durationMs, 'durationMs'),
      };
    case 'setNarrativeText':
      {
        const richTextDoc = normalizeNarrativeRichTextDoc(body.richTextDoc);
        const text = body.text === undefined ? undefined : asOptionalNonEmptyString(body.text, 'text');
        if (!text && !richTextDoc) {
          throw new BadRequestException('setNarrativeText requires text or richTextDoc');
        }
      return {
        ...(displayName ? { displayName } : {}),
        ...(text ? { text } : {}),
        title: body.title === undefined ? undefined : asString(body.title, 'title'),
        durationMs: body.durationMs === undefined ? undefined : asNumber(body.durationMs, 'durationMs'),
        ...(richTextDoc ? { richTextDoc } : {}),
        leftPct: body.leftPct === undefined ? undefined : asFreePercentage(body.leftPct, 'leftPct', -50, 150),
        topPct: body.topPct === undefined ? undefined : asFreePercentage(body.topPct, 'topPct', -50, 150),
        widthPct: body.widthPct === undefined ? undefined : asFreePercentage(body.widthPct, 'widthPct', 1, 200),
        heightPct: body.heightPct === undefined ? undefined : asFreePercentage(body.heightPct, 'heightPct', 1, 200),
        opacity: body.opacity === undefined ? undefined : asOpacity(body.opacity, 'opacity'),
        layerOrder: body.layerOrder === undefined ? undefined : asNumber(body.layerOrder, 'layerOrder'),
        fontFamily: asOptionalLabel(body.fontFamily, 'fontFamily', 120),
        fontSizePx: body.fontSizePx === undefined ? undefined : asFreePercentage(body.fontSizePx, 'fontSizePx', 8, 220),
        fontColor: asOptionalHexColor(body.fontColor, 'fontColor'),
        textAlign: asOptionalEnum(body.textAlign, 'textAlign', ['left', 'center', 'right', 'justify'] as const),
        lineHeight: body.lineHeight === undefined ? undefined : asFreePercentage(body.lineHeight, 'lineHeight', 0.8, 3),
        letterSpacingPx: body.letterSpacingPx === undefined
          ? undefined
          : asFreePercentage(body.letterSpacingPx, 'letterSpacingPx', -8, 20),
        fontWeight: asOptionalEnum(body.fontWeight, 'fontWeight', ['normal', 'bold'] as const),
        fontStyle: asOptionalEnum(body.fontStyle, 'fontStyle', ['normal', 'italic'] as const),
        textDecoration: asOptionalEnum(body.textDecoration, 'textDecoration', ['none', 'underline'] as const),
        backgroundMode: asOptionalEnum(body.backgroundMode, 'backgroundMode', ['none', 'rect', 'capsule'] as const),
        backgroundColor: asOptionalHexColor(body.backgroundColor, 'backgroundColor'),
        backgroundOpacity: body.backgroundOpacity === undefined ? undefined : asOpacity(body.backgroundOpacity, 'backgroundOpacity'),
        borderRadiusPx: body.borderRadiusPx === undefined ? undefined : asFreePercentage(body.borderRadiusPx, 'borderRadiusPx', 0, 128),
        paddingPx: body.paddingPx === undefined ? undefined : asFreePercentage(body.paddingPx, 'paddingPx', 0, 64),
      };
      }
    case 'runShortcut':
      return {
        ...(displayName ? { displayName } : {}),
        shortcutId: asString(body.shortcutId, 'shortcutId'),
      };
    case 'delay':
      return {
        ...(displayName ? { displayName } : {}),
        durationMs: asNumber(body.durationMs, 'durationMs'),
      };
    case 'runScene':
      return {
        ...(displayName ? { displayName } : {}),
        sceneId: asString(body.sceneId, 'sceneId'),
      };
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