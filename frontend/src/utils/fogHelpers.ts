import type { GridSettings } from '../components/Map/MapGridOverlay';
import type { MapTokenPayload } from '../api/maps';
import type { MapElement, MapLightElement } from '../api/mapElements';

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
 * Respects blocking segments (walls, closed doors, windows) — a cell is only
 * cleared if a line from the ally's cell center to the target cell center does
 * not cross any blocker.
 *
 * @param grid Current grid settings.
 * @param tokens Map tokens array.
 * @param radius Non-negative integer radius to clear around allies.
 * @param elements Map elements (walls, doors, windows, lights).
 * @param timeOfDay Current time of day.
 * @param mapW Map natural width (px).
 * @param mapH Map natural height (px).
 */
export function computeClearedFogByAllies(
  grid: GridSettings,
  tokens: MapTokenPayload[],
  radius: number,
  elements: MapElement[],
  timeOfDay: string | null | undefined,
  mapW: number,
  mapH: number,
): Set<string> {
  const cleared = new Set<string>();
  const r = Math.max(0, Math.floor(radius || 0));
  if (r === 0) return cleared;

  const cellSize = Math.max(4, Math.floor(grid.cellSize || 40));
  const blockers = getBlockingSegments(elements, timeOfDay, mapW, mapH);

  for (const t of tokens || []) {
    if (t.type !== 'ally' || !t.cellKey) continue;

    // Compute ally cell center in pixels
    const allyPx = cellCenterPx(grid, t.cellKey, cellSize);
    const around = getCellsWithinRadius(grid, t.cellKey, r);

    for (const ck of around) {
      const targetPx = cellCenterPx(grid, ck, cellSize);

      // Line-of-sight check against blocking segments
      let blocked = false;
      for (const seg of blockers) {
        if (segmentsIntersect(allyPx.x, allyPx.y, targetPx.x, targetPx.y, seg.ax, seg.ay, seg.bx, seg.by)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) cleared.add(ck);
    }
  }
  return cleared;
}

/**
 * Compute virtual "reveal" strokes to clear organic fog around allied tokens.
 * Respects blocking segments — only reveals positions with clear line-of-sight
 * from the ally's center. When walls are present, generates a set of smaller
 * reveal circles covering the visible area instead of a single large circle.
 *
 * Points are normalised (0–1) relative to the map's natural dimensions.
 *
 * @param grid Current grid settings.
 * @param tokens Map tokens array.
 * @param radius Ally clear radius (in grid cells). 0 = disabled.
 * @param mapW Map natural width in pixels.
 * @param mapH Map natural height in pixels.
 * @param elements Map elements (walls, doors, windows, lights).
 * @param timeOfDay Current time of day.
 * @returns Array of virtual reveal strokes (empty when radius is 0 or no allies).
 */
export function computeAllyRevealStrokes(
  grid: GridSettings,
  tokens: MapTokenPayload[],
  radius: number,
  mapW: number,
  mapH: number,
  elements: MapElement[],
  timeOfDay: string | null | undefined,
): Array<{ points: { x: number; y: number }[]; radius: number; mode: 'reveal' | 'fog' }> {
  const r = Math.max(0, Math.floor(radius || 0));
  if (r === 0 || !mapW || !mapH) return [];
  const out: Array<{ points: { x: number; y: number }[]; radius: number; mode: 'reveal' | 'fog' }> = [];
  const cellSize = Math.max(4, Math.floor(grid.cellSize || 40));
  const blockers = getBlockingSegments(elements, timeOfDay, mapW, mapH);

  for (const t of tokens || []) {
    if (t.type !== 'ally' || !t.cellKey) continue;

    const allyPx = cellCenterPx(grid, t.cellKey, cellSize);
    // Pixel radius: cellSize * radius + half cellSize
    const pixelRadius = cellSize * r + cellSize / 2;

    if (blockers.length === 0) {
      // No walls — single large reveal circle (fast path)
      out.push({
        points: [{ x: allyPx.x / mapW, y: allyPx.y / mapH }],
        radius: pixelRadius,
        mode: 'reveal',
      });
      continue;
    }

    // With walls: sample points in a grid within the reveal radius
    // and only emit reveal circles where LOS is clear.
    const step = cellSize * 0.6; // sample spacing
    const smallR = step * 0.75;  // small circle radius to cover each sample

    for (let dy = -pixelRadius; dy <= pixelRadius; dy += step) {
      for (let dx = -pixelRadius; dx <= pixelRadius; dx += step) {
        if (dx * dx + dy * dy > pixelRadius * pixelRadius) continue;
        const px = allyPx.x + dx;
        const py = allyPx.y + dy;
        if (px < 0 || px > mapW || py < 0 || py > mapH) continue;

        let blocked = false;
        for (const seg of blockers) {
          if (segmentsIntersect(allyPx.x, allyPx.y, px, py, seg.ax, seg.ay, seg.bx, seg.by)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          out.push({
            points: [{ x: px / mapW, y: py / mapH }],
            radius: smallR,
            mode: 'reveal',
          });
        }
      }
    }
  }
  return out;
}

/**
 * Compute the pixel center of a grid cell.
 * @param grid Grid settings (square or hex).
 * @param cellKey Cell key "col:row".
 * @param cellSize Cell size in pixels.
 */
function cellCenterPx(grid: GridSettings, cellKey: string, cellSize: number): { x: number; y: number } {
  const [cStr, rStr] = cellKey.split(':');
  const col = parseInt(cStr, 10) || 0;
  const row = parseInt(rStr, 10) || 0;

  if (grid.type === 'square') {
    return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
  }
  // Flat-top hex grid
  const hexR = cellSize;
  const hexH = Math.sqrt(3) * hexR;
  const horizStep = 1.5 * hexR;
  const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
  return { x: col * horizStep + hexR, y: row * hexH + hexH / 2 + yOffset };
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

// ─── Light-source fog helpers ────────────────────────────────────────────────

/**
 * Resolve effective intensity for a light element given the current time of day.
 * Returns 0–1; defaults to 1 when no per-time-of-day config is set.
 * @param light Light element.
 * @param timeOfDay Current time of day (null = full intensity).
 */
export function getLightIntensity(
  light: MapLightElement,
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | string | null | undefined,
): number {
  if (!light.intensityByTimeOfDay) return 1;
  const key = timeOfDay as keyof typeof light.intensityByTimeOfDay;
  if (key && light.intensityByTimeOfDay[key] !== undefined) {
    return Math.max(0, Math.min(1, light.intensityByTimeOfDay[key]));
  }
  return 1;
}

/**
 * Collect all line segments that block light / fog propagation.
 * - Walls: all consecutive point pairs (always block).
 * - Doors (closed): the single 2-point segment (open doors allow passage).
 * - Windows: never block — they always allow fog and light through.
 *
 * Returns an array of segments [{ ax, ay, bx, by }] in pixel coordinates.
 *
 * @param elements All map elements.
 * @param timeOfDay Current time of day (reserved for future use).
 * @param mapW Map natural width (px).
 * @param mapH Map natural height (px).
 */
export function getBlockingSegments(
  elements: MapElement[],
  timeOfDay: string | null | undefined,
  mapW: number,
  mapH: number,
): Array<{ ax: number; ay: number; bx: number; by: number }> {
  const segs: Array<{ ax: number; ay: number; bx: number; by: number }> = [];
  for (const el of elements) {
    if (el.type === 'wall') {
      for (let i = 0; i < el.points.length - 1; i++) {
        segs.push({
          ax: el.points[i].x * mapW, ay: el.points[i].y * mapH,
          bx: el.points[i + 1].x * mapW, by: el.points[i + 1].y * mapH,
        });
      }
    } else if (el.type === 'door' && !el.isOpen) {
      segs.push({
        ax: el.points[0].x * mapW, ay: el.points[0].y * mapH,
        bx: el.points[1].x * mapW, by: el.points[1].y * mapH,
      });
    }
    // Windows never block — they allow fog and light propagation.
  }
  return segs;
}

/**
 * Test whether two line segments (p1→p2) and (p3→p4) intersect.
 * Uses the standard cross-product parametric approach.
 */
function segmentsIntersect(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number,
): boolean {
  const d1x = p2x - p1x, d1y = p2y - p1y;
  const d2x = p4x - p3x, d2y = p4y - p3y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((p3x - p1x) * d2y - (p3y - p1y) * d2x) / cross;
  const u = ((p3x - p1x) * d1y - (p3y - p1y) * d1x) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Compute virtual "reveal" strokes to clear organic fog around active light sources.
 * Respects blocking segments — only reveals positions with clear line-of-sight
 * from the light's center. When walls are present, generates a set of smaller
 * reveal circles covering the visible area instead of a single large circle.
 *
 * Points are normalised (0–1) relative to the map's natural dimensions.
 *
 * @param elements Map elements array.
 * @param timeOfDay Current time of day.
 * @param mapW Map natural width (px).
 * @param mapH Map natural height (px).
 * @returns Array of virtual reveal strokes.
 */
export function computeLightRevealStrokes(
  elements: MapElement[],
  timeOfDay: string | null | undefined,
  mapW: number,
  mapH: number,
): Array<{ points: { x: number; y: number }[]; radius: number; mode: 'reveal' | 'fog' }> {
  if (!mapW || !mapH) return [];
  const out: Array<{ points: { x: number; y: number }[]; radius: number; mode: 'reveal' | 'fog' }> = [];
  const blockers = getBlockingSegments(elements, timeOfDay, mapW, mapH);

  for (const el of elements) {
    if (el.type !== 'light') continue;
    if (!el.isOn) continue;
    const intensity = getLightIntensity(el, timeOfDay);
    if (intensity <= 0) continue;
    const effectiveRadius = el.radius * intensity;
    if (effectiveRadius < 1) continue;

    const lightPx = el.position.x * mapW;
    const lightPy = el.position.y * mapH;

    if (blockers.length === 0) {
      // No walls — single large reveal circle (fast path)
      out.push({
        points: [{ x: el.position.x, y: el.position.y }],
        radius: effectiveRadius,
        mode: 'reveal',
      });
      continue;
    }

    // With walls: sample points in a grid within the reveal radius
    // and only emit reveal circles where LOS is clear.
    const step = Math.max(8, effectiveRadius * 0.15);
    const smallR = step * 0.75;

    for (let dy = -effectiveRadius; dy <= effectiveRadius; dy += step) {
      for (let dx = -effectiveRadius; dx <= effectiveRadius; dx += step) {
        if (dx * dx + dy * dy > effectiveRadius * effectiveRadius) continue;
        const px = lightPx + dx;
        const py = lightPy + dy;
        if (px < 0 || px > mapW || py < 0 || py > mapH) continue;

        let blocked = false;
        for (const seg of blockers) {
          if (segmentsIntersect(lightPx, lightPy, px, py, seg.ax, seg.ay, seg.bx, seg.by)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          out.push({
            points: [{ x: px / mapW, y: py / mapH }],
            radius: smallR,
            mode: 'reveal',
          });
        }
      }
    }
  }
  return out;
}

/**
 * Compute which fog cells should be cleared by active light sources (grid-mode).
 * Each light clears cells within its effective radius. Considers time-of-day intensity
 * and performs line-of-sight checks against blocking segments (walls, closed doors).
 *
 * @param grid Grid settings.
 * @param elements Map elements.
 * @param timeOfDay Current time of day.
 * @param mapW Map natural width (px).
 * @param mapH Map natural height (px).
 * @returns Set of cell keys cleared by lights.
 */
export function computeClearedFogByLights(
  grid: GridSettings,
  elements: MapElement[],
  timeOfDay: string | null | undefined,
  mapW: number,
  mapH: number,
): Set<string> {
  const cleared = new Set<string>();
  if (!mapW || !mapH) return cleared;
  const cellSize = Math.max(4, Math.floor(grid.cellSize || 40));
  const blockers = getBlockingSegments(elements, timeOfDay, mapW, mapH);

  for (const el of elements) {
    if (el.type !== 'light' || !el.isOn) continue;
    const intensity = getLightIntensity(el, timeOfDay);
    if (intensity <= 0) continue;
    const effectiveRadius = el.radius * intensity;
    if (effectiveRadius < 1) continue;

    const lightPx = el.position.x * mapW;
    const lightPy = el.position.y * mapH;

    // Convert light pixel radius to grid-cell radius
    const gridRadius = Math.max(0, Math.ceil(effectiveRadius / cellSize));

    // Determine light's grid cell
    let lightCol: number;
    let lightRow: number;
    if (grid.type === 'square') {
      lightCol = Math.floor(lightPx / cellSize);
      lightRow = Math.floor(lightPy / cellSize);
    } else {
      const hexR = cellSize;
      const hexH = Math.sqrt(3) * hexR;
      const horizStep = 1.5 * hexR;
      lightCol = Math.round((lightPx - hexR) / horizStep);
      const yOffset = (lightCol % 2 === 0) ? 0 : hexH / 2;
      lightRow = Math.round((lightPy - hexH / 2 - yOffset) / hexH);
    }

    const lightCellKey = `${lightCol}:${lightRow}`;
    const cellsInRange = getCellsWithinRadius(grid, lightCellKey, gridRadius);

    for (const ck of cellsInRange) {
      const [cStr, rStr] = ck.split(':');
      const col = parseInt(cStr, 10) || 0;
      const row = parseInt(rStr, 10) || 0;

      let cx: number, cy: number;
      if (grid.type === 'square') {
        cx = col * cellSize + cellSize / 2;
        cy = row * cellSize + cellSize / 2;
      } else {
        const hexR = cellSize;
        const hexH = Math.sqrt(3) * hexR;
        const horizStep = 1.5 * hexR;
        const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
        cx = col * horizStep + hexR;
        cy = row * hexH + hexH / 2 + yOffset;
      }

      // Line-of-sight check: does any blocker intersect light→cell center?
      let blocked = false;
      for (const seg of blockers) {
        if (segmentsIntersect(lightPx, lightPy, cx, cy, seg.ax, seg.ay, seg.bx, seg.by)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) cleared.add(ck);
    }
  }
  return cleared;
}
