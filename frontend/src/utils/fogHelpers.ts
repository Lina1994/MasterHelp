import type { GridSettings } from '../components/Map/MapGridOverlay';
import type { MapTokenPayload } from '../api/maps';

/**
 * Parse a cell key like "col:row" into numeric coordinates.
 * @param key Cell key string in the form "col:row".
 * @returns Object with numeric `col` and `row`.
 */
export function parseCellKey(key: string): { col: number; row: number } {
  const [c, r] = key.split(':');
  const col = parseInt(c, 10) || 0;
  const row = parseInt(r, 10) || 0;
  return { col, row };
}

/**
 * Returns neighbor cell keys (square: 8-neighborhood; hex: 6-neighborhood).
 * Optionally includes the center cell when `includeSelf` is true.
 * @param grid Current grid settings (type affects neighborhood).
 * @param cellKey Center cell key.
 * @param includeSelf Whether to include the center cell in the result.
 */
export function getAdjacentCells(grid: GridSettings, cellKey: string, includeSelf = true): string[] {
  const { col, row } = parseCellKey(cellKey);
  const out: Array<[number, number]> = [];
  if (grid.type === 'square') {
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (!includeSelf && dc === 0 && dr === 0) continue;
        out.push([col + dc, row + dr]);
      }
    }
  } else {
    // Flat-top hex grid using odd-q offset (odd columns shifted down)
    const isOdd = (col % 2) !== 0;
    if (isOdd) {
      out.push([col + 1, row]);     // E
      out.push([col + 1, row + 1]); // SE
      out.push([col, row + 1]);     // S
      out.push([col - 1, row + 1]); // SW
      out.push([col - 1, row]);     // W
      out.push([col, row - 1]);     // N
    } else {
      out.push([col + 1, row]);     // E
      out.push([col, row + 1]);     // SE
      out.push([col - 1, row]);     // W
      out.push([col - 1, row - 1]); // NW
      out.push([col, row - 1]);     // N
      out.push([col + 1, row - 1]); // NE
    }
    if (includeSelf) out.push([col, row]);
  }
  const set = new Set(out.map(([c, r]) => `${c}:${r}`));
  return Array.from(set);
}

/**
 * Returns all cell keys within a given radius from the center, using BFS over
 * the appropriate neighborhood (8-connected for square, 6-connected for hex).
 * Radius 0 returns only the center; radius 1 includes adjacent; etc.
 * @param grid Current grid settings.
 * @param centerKey Center cell key.
 * @param radius Non-negative integer radius.
 */
export function getCellsWithinRadius(grid: GridSettings, centerKey: string, radius: number): string[] {
  const r = Math.max(0, Math.floor(radius || 0));
  const visited = new Set<string>([centerKey]);
  let frontier = new Set<string>([centerKey]);
  for (let step = 1; step <= r; step++) {
    const next = new Set<string>();
    frontier.forEach(key => {
      const neigh = getAdjacentCells(grid, key, false);
      neigh.forEach(nk => { if (!visited.has(nk)) next.add(nk); });
    });
    next.forEach(nk => visited.add(nk));
    frontier = next;
    if (frontier.size === 0) break;
  }
  return Array.from(visited);
}

/**
 * Compute which fog cells should be cleared (not drawn) due to allied tokens.
 * Clears within `radius` around each allied token (including its own cell).
 * @param grid Current grid settings.
 * @param tokens Map tokens array.
 * @param radius Non-negative integer radius to clear around allies.
 */
export function computeClearedFogByAllies(grid: GridSettings, tokens: MapTokenPayload[], radius: number): Set<string> {
  const cleared = new Set<string>();
  const r = Math.max(0, Math.floor(radius || 0));
  (tokens || []).forEach(t => {
    if (t.type !== 'ally' || !t.cellKey) return;
    const around = r === 0 ? [t.cellKey] : getCellsWithinRadius(grid, t.cellKey, r);
    for (const k of around) cleared.add(k);
  });
  return cleared;
}

/** Returns a new Set with fog cells after subtracting cleared cells. */
export function subtractClearedFog(allFog: Set<string>, cleared: Set<string>): Set<string> {
  const out = new Set<string>();
  allFog.forEach(k => { if (!cleared.has(k)) out.add(k); });
  return out;
}

/**
 * Compute a full fog set that covers the entire map area for the given grid.
 *
 * This is used for actions like "Poner niebla en todo el mapa".
 * @param grid Current grid settings.
 * @param widthPx Map width in pixels (intrinsic image size).
 * @param heightPx Map height in pixels (intrinsic image size).
 */
export function computeAllFogCells(grid: GridSettings, widthPx: number, heightPx: number): Set<string> {
  const out = new Set<string>();
  const W = Math.max(0, Math.floor(widthPx || 0));
  const H = Math.max(0, Math.floor(heightPx || 0));
  if (!W || !H) return out;

  if (grid.type === 'square') {
    const step = Math.max(4, Math.floor(grid.cellSize || 40));
    const cols = Math.max(1, Math.ceil(W / step));
    const rows = Math.max(1, Math.ceil(H / step));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        out.add(`${c}:${r}`);
      }
    }
    return out;
  }

  // Flat-top hex grid (odd-q offset), consistent with FogOfWarOverlay/MapGridOverlay math.
  // Important: include negative cols/rows so edge-clipped hexes are still fogged.
  const r = Math.max(6, Math.floor(grid.cellSize || 30));
  const w = 2 * r;
  const h = Math.sqrt(3) * r;
  const horizStep = 1.5 * r;
  const vertStep = h;

  const cols = Math.ceil(W / horizStep) + 3;
  const rows = Math.ceil(H / vertStep) + 3;
  for (let col = -1; col < cols; col++) {
    const cx = col * horizStep + r;
    const yOffset = (col % 2 === 0) ? 0 : h / 2;
    for (let row = -1; row < rows; row++) {
      const cy = row * vertStep + h / 2 + yOffset;
      // Keep only hexes that intersect the canvas bounds (quick cull).
      if (cx + w < 0 || cx - w > W || cy + h < 0 || cy - h > H) continue;
      out.add(`${col}:${row}`);
    }
  }
  return out;
}
