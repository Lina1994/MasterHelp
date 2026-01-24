import type { GridSettings } from '../components/Map/MapGridOverlay';
import { getAdjacentCells } from './fogHelpers';

/**
 * Generates distinct token cell positions for bulk placement.
 *
 * If map bounds are provided (`widthPx`/`heightPx`), cells are chosen from the set of
 * valid grid cells that intersect the image area.
 *
 * When bounds are not available yet, it still returns distinct cells (simple line)
 * to avoid stacking everything in the same spot.
 */
export function allocateTokenCells(params: {
  gridSettings: GridSettings;
  count: number;
  occupiedCellKeys?: Iterable<string>;
  widthPx?: number | null;
  heightPx?: number | null;
  anchorCellKey?: string;
  /** Optional restriction in map pixel coordinates. */
  visibleRectPx?: { minX: number; minY: number; maxX: number; maxY: number } | null;
}): string[] {
  const { gridSettings, count } = params;
  const out: string[] = [];
  if (count <= 0) return out;

  const occupied = new Set<string>(params.occupiedCellKeys ?? []);

  // Fallback when we don't know bounds: distinct cells on a line.
  const widthPx = Number(params.widthPx);
  const heightPx = Number(params.heightPx);
  const hasBounds = Number.isFinite(widthPx) && Number.isFinite(heightPx) && widthPx > 0 && heightPx > 0;
  if (!hasBounds) {
    for (let i = 0; i < count; i++) {
      const key = `${i}:0`;
      out.push(key);
    }
    return out;
  }

  const rect = (() => {
    const r = params.visibleRectPx;
    if (!r) return null;
    const minX = Math.max(0, Math.min(widthPx, r.minX));
    const minY = Math.max(0, Math.min(heightPx, r.minY));
    const maxX = Math.max(0, Math.min(widthPx, r.maxX));
    const maxY = Math.max(0, Math.min(heightPx, r.maxY));
    if (maxX <= minX || maxY <= minY) return null;
    return { minX, minY, maxX, maxY };
  })();

  const isPointAllowed = (cx: number, cy: number) => {
    if (!(cx >= 0 && cx <= widthPx && cy >= 0 && cy <= heightPx)) return false;
    if (!rect) return true;
    return cx >= rect.minX && cx <= rect.maxX && cy >= rect.minY && cy <= rect.maxY;
  };

  const allowed = new Set<string>();
  const cellCenterByKey = new Map<string, { cx: number; cy: number }>();
  if (gridSettings.type === 'hex') {
    const r = Math.max(6, Math.floor(gridSettings.cellSize || 30));
    const hexR = r;
    const hexH = Math.sqrt(3) * hexR;
    const horizStep = 1.5 * hexR;
    const vertStep = hexH;

    const colMax = Math.ceil(widthPx / horizStep) + 2;
    const rowMax = Math.ceil(heightPx / vertStep) + 2;
    for (let col = 0; col <= colMax; col++) {
      const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
      for (let row = -1; row <= rowMax; row++) {
        const cx = col * horizStep + hexR;
        const cy = row * vertStep + hexH / 2 + yOffset;
        if (!isPointAllowed(cx, cy)) continue;
        const key = `${col}:${row}`;
        allowed.add(key);
        cellCenterByKey.set(key, { cx, cy });
      }
    }
  } else {
    const step = Math.max(4, Math.floor(gridSettings.cellSize || 40));
    const colMax = Math.max(0, Math.ceil(widthPx / step) - 1);
    const rowMax = Math.max(0, Math.ceil(heightPx / step) - 1);
    for (let col = 0; col <= colMax; col++) {
      for (let row = 0; row <= rowMax; row++) {
        const cx = (col + 0.5) * step;
        const cy = (row + 0.5) * step;
        if (!isPointAllowed(cx, cy)) continue;
        const key = `${col}:${row}`;
        allowed.add(key);
        cellCenterByKey.set(key, { cx, cy });
      }
    }
  }

  if (!allowed.size) {
    // If the visible rect is too small, fall back to whole-map allowed set.
    // (This happens when the map is panned/zoomed so far that the computed rect is empty.)
    return allocateTokenCells({
      ...params,
      visibleRectPx: null,
    });
  }

  const anchor = (() => {
    if (params.anchorCellKey && allowed.has(params.anchorCellKey)) return params.anchorCellKey;

    const centerX = rect ? (rect.minX + rect.maxX) / 2 : widthPx / 2;
    const centerY = rect ? (rect.minY + rect.maxY) / 2 : heightPx / 2;

    // Pick allowed cell whose center is closest to desired center.
    let bestKey: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const key of allowed) {
      const c = cellCenterByKey.get(key);
      if (!c) continue;
      const dx = c.cx - centerX;
      const dy = c.cy - centerY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; bestKey = key; }
    }
    return (bestKey || (allowed.values().next().value as string));
  })();

  const visited = new Set<string>();
  const queue: string[] = [anchor];

  while (queue.length && out.length < count) {
    const key = queue.shift() as string;
    if (visited.has(key)) continue;
    visited.add(key);

    if (allowed.has(key) && !occupied.has(key)) {
      out.push(key);
      occupied.add(key);
      if (out.length >= count) break;
    }

    const neighbors = getAdjacentCells(gridSettings, key, false);
    for (const n of neighbors) {
      if (!visited.has(n) && allowed.has(n)) queue.push(n);
    }
  }

  // If we run out of free cells, stack remaining at anchor.
  while (out.length < count) out.push(anchor);
  return out;
}
