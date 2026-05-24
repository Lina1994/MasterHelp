/**
 * @file motionPathUtils.ts
 * @description Animation engine for scene layer motion paths, oscillation effects
 *   and CSS transform helpers. Used by the preview editor and the runtime skyline renderer.
 */

import type { MotionKeyframe, OscillationEffect } from '../../../types/scenes';

// ---------------------------------------------------------------------------
// Easing functions
// ---------------------------------------------------------------------------

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return t * (2 - t);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function bounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    const u = t - 1.5 / 2.75;
    return 7.5625 * u * u + 0.75;
  } else if (t < 2.5 / 2.75) {
    const u = t - 2.25 / 2.75;
    return 7.5625 * u * u + 0.9375;
  } else {
    const u = t - 2.625 / 2.75;
    return 7.5625 * u * u + 0.984375;
  }
}

function spring(t: number): number {
  return 1 - Math.cos(t * Math.PI * 3) * Math.exp(-t * 5);
}

function applyEasing(t: number, easing: MotionKeyframe['easing']): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'easeIn': return easeIn(clamped);
    case 'easeOut': return easeOut(clamped);
    case 'easeInOut': return easeInOut(clamped);
    case 'bounce': return bounce(clamped);
    case 'spring': return spring(clamped);
    default: return clamped; // linear
  }
}

// ---------------------------------------------------------------------------
// Motion path interpolation
// ---------------------------------------------------------------------------

export interface InterpolatedTransform {
  leftPct: number;
  topPct: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  oscillationElapsedMs: number;
}

/**
 * Interpolates a motion path at the given elapsed time.
 *
 * The origin point (timeMs=0) is always taken from the action's base position
 * (leftPct/topPct payload fields). Keyframes define subsequent positions.
 *
 * @param origin - Action's base position at timeMs=0.
 * @param keyframes - Sorted array of keyframes (timeMs > 0).
 * @param elapsedMs - Milliseconds since action start.
 * @param baseRotation - Static rotation to use when no keyframe rotation is defined.
 * @returns Interpolated position and rotation.
 */
export function interpolateMotionPath(
  origin: { leftPct: number; topPct: number },
  keyframes: MotionKeyframe[],
  elapsedMs: number,
  baseTransform: number | { rotation?: number; flipH?: boolean; flipV?: boolean } = 0,
  options?: { defaultPauseOscillationDuringHold?: boolean },
): InterpolatedTransform {
  const baseRotation = typeof baseTransform === 'number'
    ? baseTransform
    : (Number(baseTransform.rotation) || 0);
  const baseFlipH = typeof baseTransform === 'number' ? false : Boolean(baseTransform.flipH);
  const baseFlipV = typeof baseTransform === 'number' ? false : Boolean(baseTransform.flipV);

  if (!keyframes || keyframes.length === 0) {
    return {
      leftPct: origin.leftPct,
      topPct: origin.topPct,
      rotation: baseRotation,
      flipH: baseFlipH,
      flipV: baseFlipV,
      oscillationElapsedMs: Math.max(0, elapsedMs),
    };
  }

  // Build full path including the synthetic origin point at t=0
  const fullPath: MotionKeyframe[] = [
    {
      timeMs: 0,
      leftPct: origin.leftPct,
      topPct: origin.topPct,
      rotation: baseRotation,
      flipH: baseFlipH,
      flipV: baseFlipV,
      easing: 'linear',
    },
    ...keyframes,
  ];

  // Effective timeline adds dwell pauses (holdMs) before each outgoing segment.
  const effectiveTimes: number[] = [0];
  const oscillationTimes: number[] = [0];
  for (let i = 1; i < fullPath.length; i += 1) {
    const prev = fullPath[i - 1];
    const current = fullPath[i];
    const baseDelta = Math.max(0, Number(current.timeMs) - Number(prev.timeMs));
    const holdMs = Math.max(0, Number(prev.holdMs ?? 0));
    const holdPausesOscillation = prev.pauseOscillationDuringHold !== undefined
      ? Boolean(prev.pauseOscillationDuringHold)
      : Boolean(options?.defaultPauseOscillationDuringHold);
    effectiveTimes[i] = effectiveTimes[i - 1] + holdMs + baseDelta;
    oscillationTimes[i] = oscillationTimes[i - 1] + (holdPausesOscillation ? 0 : holdMs) + baseDelta;
  }

  if (elapsedMs <= 0) {
    return {
      leftPct: origin.leftPct,
      topPct: origin.topPct,
      rotation: baseRotation,
      flipH: baseFlipH,
      flipV: baseFlipV,
      oscillationElapsedMs: 0,
    };
  }

  const lastIndex = fullPath.length - 1;
  const lastKf = fullPath[lastIndex];
  if (elapsedMs >= effectiveTimes[lastIndex]) {
    return {
      leftPct: lastKf.leftPct,
      topPct: lastKf.topPct,
      rotation: lastKf.rotation ?? baseRotation,
      flipH: lastKf.flipH ?? baseFlipH,
      flipV: lastKf.flipV ?? baseFlipV,
      oscillationElapsedMs: Math.max(0, Number(lastKf.timeMs)),
    };
  }

  for (let i = 0; i < fullPath.length - 1; i++) {
    const from = fullPath[i];
    const to = fullPath[i + 1];
    const fromEffectiveTime = effectiveTimes[i];
    const fromOscillationTime = oscillationTimes[i];
    const holdFromMs = Math.max(0, Number(from.holdMs ?? 0));
    const holdPausesOscillation = from.pauseOscillationDuringHold !== undefined
      ? Boolean(from.pauseOscillationDuringHold)
      : Boolean(options?.defaultPauseOscillationDuringHold);
    const moveStartMs = fromEffectiveTime + holdFromMs;
    const moveStartOscillationMs = fromOscillationTime + (holdPausesOscillation ? 0 : holdFromMs);
    const moveEndMs = effectiveTimes[i + 1];

    if (elapsedMs >= fromEffectiveTime && elapsedMs <= moveStartMs) {
      return {
        leftPct: from.leftPct,
        topPct: from.topPct,
        rotation: from.rotation ?? baseRotation,
        flipH: from.flipH ?? baseFlipH,
        flipV: from.flipV ?? baseFlipV,
        oscillationElapsedMs: holdPausesOscillation
          ? Math.max(0, Number(fromOscillationTime))
          : Math.max(0, Number(fromOscillationTime) + (elapsedMs - fromEffectiveTime)),
      };
    }

    if (elapsedMs >= moveStartMs && elapsedMs <= moveEndMs) {
      const segmentDuration = moveEndMs - moveStartMs;
      if (segmentDuration <= 0) {
        return {
          leftPct: to.leftPct,
          topPct: to.topPct,
          rotation: to.rotation ?? baseRotation,
          flipH: to.flipH ?? from.flipH ?? baseFlipH,
          flipV: to.flipV ?? from.flipV ?? baseFlipV,
          oscillationElapsedMs: Math.max(0, Number(oscillationTimes[i + 1])),
        };
      }
      const raw = (elapsedMs - moveStartMs) / segmentDuration;
      const t = applyEasing(raw, from.easing);
      const fromRot = from.rotation ?? baseRotation;
      const toRot = to.rotation ?? baseRotation;
      const fromFlipH = from.flipH ?? baseFlipH;
      const fromFlipV = from.flipV ?? baseFlipV;
      const toFlipH = to.flipH ?? fromFlipH;
      const toFlipV = to.flipV ?? fromFlipV;
      return {
        leftPct: from.leftPct + (to.leftPct - from.leftPct) * t,
        topPct: from.topPct + (to.topPct - from.topPct) * t,
        rotation: fromRot + (toRot - fromRot) * t,
        flipH: raw < 1 ? fromFlipH : toFlipH,
        flipV: raw < 1 ? fromFlipV : toFlipV,
        oscillationElapsedMs: Math.max(0, Number(moveStartOscillationMs + (moveEndMs - moveStartMs) * raw)),
      };
    }
  }

  return {
    leftPct: origin.leftPct,
    topPct: origin.topPct,
    rotation: baseRotation,
    flipH: baseFlipH,
    flipV: baseFlipV,
    oscillationElapsedMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Oscillation effect
// ---------------------------------------------------------------------------

/**
 * Applies a secondary oscillation effect on top of a base position.
 *
 * 'wave' produces a smooth sinusoidal offset (flying, floating).
 * 'bounce' produces an abrupt upward-only sawtooth (walk cycle).
 *
 * @param base - Position from motion path interpolation.
 * @param effect - Oscillation settings.
 * @param elapsedMs - Milliseconds since action start.
 */
export function applyOscillation(
  base: { leftPct: number; topPct: number },
  effect: OscillationEffect | undefined,
  elapsedMs: number,
): { leftPct: number; topPct: number } {
  if (!effect || !effect.enabled || effect.amplitudePct <= 0 || effect.frequencyHz <= 0) {
    return base;
  }

  const t = elapsedMs / 1000;
  const omega = 2 * Math.PI * effect.frequencyHz;

  let rawOffset: number;
  if (effect.type === 'wave') {
    rawOffset = Math.sin(omega * t) * effect.amplitudePct;
  } else {
    // Bounce: absolute-value cosine → only moves in one direction (upward)
    rawOffset = (1 - Math.abs(Math.cos(omega * t))) * effect.amplitudePct;
  }

  let offsetX = 0;
  let offsetY = 0;
  if (effect.axis === 'x' || effect.axis === 'both') offsetX = rawOffset;
  if (effect.axis === 'y' || effect.axis === 'both') offsetY = rawOffset;

  return {
    leftPct: base.leftPct + offsetX,
    topPct: base.topPct + offsetY,
  };
}

// ---------------------------------------------------------------------------
// CSS transform builder
// ---------------------------------------------------------------------------

/**
 * Builds a CSS transform string from rotation and flip values.
 *
 * @param rotation - Degrees of rotation (0 = no rotation).
 * @param flipH - Flip horizontally (mirror on Y axis).
 * @param flipV - Flip vertically (mirror on X axis).
 * @returns CSS transform string, or 'none'.
 */
export function buildTransformCss(rotation: number, flipH: boolean, flipV: boolean): string {
  const parts: string[] = [];
  if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
  const scaleX = flipH ? -1 : 1;
  const scaleY = flipV ? -1 : 1;
  if (scaleX !== 1 || scaleY !== 1) parts.push(`scale(${scaleX}, ${scaleY})`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

// ---------------------------------------------------------------------------
// Payload readers
// ---------------------------------------------------------------------------

/**
 * Reads static transform fields (rotation, flipH, flipV) from an action payload.
 *
 * @param payload - Raw action payload record.
 * @returns Normalized transform values with safe defaults.
 */
export function getTransformFromPayload(payload: Record<string, unknown>): {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
} {
  const rotation = Number(payload.rotation);
  return {
    rotation: Number.isFinite(rotation) ? rotation : 0,
    flipH: Boolean(payload.flipH),
    flipV: Boolean(payload.flipV),
  };
}

/**
 * Reads and validates a motion path array from an action payload.
 *
 * @param payload - Raw action payload record.
 * @returns Array of valid MotionKeyframe objects sorted by timeMs.
 */
export function getMotionPathFromPayload(payload: Record<string, unknown>): MotionKeyframe[] {
  const raw = payload.motionPath;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((item): item is MotionKeyframe => {
      if (!item || typeof item !== 'object') return false;
      const kf = item as Record<string, unknown>;
      return (
        typeof kf.timeMs === 'number' &&
        typeof kf.leftPct === 'number' &&
        typeof kf.topPct === 'number'
      );
    })
    .map((item) => ({
      ...item,
      ...(item.holdMs !== undefined && Number.isFinite(Number(item.holdMs))
        ? { holdMs: Math.max(0, Number(item.holdMs)) }
        : {}),
      ...(item.pauseOscillationDuringHold !== undefined
        ? { pauseOscillationDuringHold: Boolean(item.pauseOscillationDuringHold) }
        : {}),
      ...(item.flipH !== undefined ? { flipH: Boolean(item.flipH) } : {}),
      ...(item.flipV !== undefined ? { flipV: Boolean(item.flipV) } : {}),
    }))
    .sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Reads and validates an oscillation effect from an action payload.
 *
 * @param payload - Raw action payload record.
 * @returns OscillationEffect if enabled, or undefined.
 */
export function getOscillationFromPayload(payload: Record<string, unknown>): OscillationEffect | undefined {
  const raw = payload.oscillation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (!o.enabled) return undefined;
  return {
    enabled: true,
    type: o.type === 'wave' ? 'wave' : 'bounce',
    axis: (o.axis === 'x' || o.axis === 'both' ? o.axis : 'y') as 'x' | 'y' | 'both',
    amplitudePct: Number.isFinite(Number(o.amplitudePct)) ? Number(o.amplitudePct) : 3,
    frequencyHz: Number.isFinite(Number(o.frequencyHz)) ? Number(o.frequencyHz) : 2,
    pauseDuringMotionHold: Boolean(o.pauseDuringMotionHold),
  };
}
