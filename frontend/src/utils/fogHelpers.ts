import type { GridSettings } from '../components/Map/MapGridOverlay';
import type { MapTokenPayload } from '../api/maps';

/** Parse a cell key like "col:row" into numeric coordinates. */
export function parseCellKey(key: string): { col: number; row: number } {
  const [c, r] = key.split(':');
  const col = parseInt(c, 10) || 0;
  const row = parseInt(r, 10) || 0;
  return { col, row };
}

/** Returns neighbor cell keys (square: 8-neighborhood; hex: 6-neighborhood) including self when includeSelf=true. */
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
  if (grid.type === 'square' && includeSelf === false) {
    // Already excluded (0,0) in the loop
  }
  // Deduplicate and stringify
  const set = new Set(out.map(([c, r]) => `${c}:${r}`));
  return Array.from(set);
}

/**
 * Compute which fog cells should be cleared (not drawn) due to allied tokens.
 * Clears the token's own cell and all adjacent cells.
 */
export function computeClearedFogByAllies(grid: GridSettings, tokens: MapTokenPayload[]): Set<string> {
  const cleared = new Set<string>();
  (tokens || []).forEach(t => {
    if (t.type !== 'ally' || !t.cellKey) return;
    const around = getAdjacentCells(grid, t.cellKey, true);
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
