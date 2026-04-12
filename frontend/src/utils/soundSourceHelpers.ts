import type { MapSoundSourceElement } from '../api/mapElements';
import type { MapTokenPayload } from '../api/maps';

/**
 * Computed volume for a single sound source based on allied-token proximity.
 */
export interface SoundSourceVolume {
  /** Element ID of the sound source. */
  id: string;
  /** Final volume to apply (0–1). 0 means out of range / no allies nearby. */
  volume: number;
}

/**
 * computeSoundSourceVolumes
 *
 * For each active sound source, compute the effective playback volume by
 * finding the nearest allied token and applying linear distance attenuation.
 *
 * Formula:  effectiveVolume = baseVolume × max(0, 1 − minAllyDistance / radius)
 *
 * @param sources     Sound-source elements (only those with isOn === true are considered).
 * @param tokens      Current map tokens (only allies contribute).
 * @param mapW        Map natural width in pixels.
 * @param mapH        Map natural height in pixels.
 * @param cellSize    Grid cell size in pixels (used to convert cellKey to px coords).
 * @param gridType    Grid type ('square' | 'hex').
 * @returns Map of sourceId → computed volume (0–1).
 */
export function computeSoundSourceVolumes(
  sources: MapSoundSourceElement[],
  tokens: MapTokenPayload[],
  mapW: number,
  mapH: number,
  cellSize: number,
  gridType: 'square' | 'hex',
): Map<string, number> {
  const result = new Map<string, number>();
  if (!mapW || !mapH) return result;

  const allies = (tokens || []).filter((t) => t.type === 'ally' && t.cellKey);
  if (allies.length === 0) {
    for (const s of sources) result.set(s.id, 0);
    return result;
  }

  // Pre-compute ally pixel positions
  const allyPositions = allies.map((t) => cellCenterPx(t.cellKey, cellSize, gridType));

  for (const src of sources) {
    if (!src.isOn) {
      result.set(src.id, 0);
      continue;
    }

    const sPx = { x: src.position.x * mapW, y: src.position.y * mapH };
    const radius = Math.max(1, src.radius);

    let minDist = Infinity;
    for (const ap of allyPositions) {
      const d = Math.hypot(ap.x - sPx.x, ap.y - sPx.y);
      if (d < minDist) minDist = d;
    }

    const attenuation = Math.max(0, 1 - minDist / radius);
    const baseVolume = src.volume ?? 1;
    result.set(src.id, baseVolume * attenuation);
  }

  return result;
}

/**
 * Convert a cellKey ("col:row") to a pixel center coordinate.
 * @param cellKey Cell key string in the form "col:row".
 * @param cellSize Cell size in pixels.
 * @param gridType Grid type.
 * @returns Pixel centre {x,y}.
 */
function cellCenterPx(
  cellKey: string,
  cellSize: number,
  gridType: 'square' | 'hex',
): { x: number; y: number } {
  const [cStr, rStr] = cellKey.split(':');
  const col = parseInt(cStr, 10) || 0;
  const row = parseInt(rStr, 10) || 0;

  if (gridType === 'square') {
    return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
  }
  // Flat-top hex grid (odd-q offset)
  const hexR = cellSize;
  const hexH = Math.sqrt(3) * hexR;
  const horizStep = 1.5 * hexR;
  const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
  return { x: col * horizStep + hexR, y: row * hexH + hexH / 2 + yOffset };
}
