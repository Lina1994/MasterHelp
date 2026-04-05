import type { GridSettings } from '../components/Map/MapGridOverlay';
import type { MapTokenPayload } from '../api/maps';
import type { MapElement, MapLightElement, MapWindowElement } from '../api/mapElements';

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
): Array<{ points: { x: number; y: number }[]; radius: number; mode: 'reveal' | 'fog'; fill?: boolean }> {
  const r = Math.max(0, Math.floor(radius || 0));
  if (r === 0 || !mapW || !mapH) return [];
  const out: Array<{ points: { x: number; y: number }[]; radius: number; mode: 'reveal' | 'fog'; fill?: boolean }> = [];
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

    // Compute visibility polygon for smooth wall interaction
    const polygon = computeVisibilityPolygon(allyPx.x, allyPx.y, pixelRadius, blockers);
    if (polygon.length > 2) {
      out.push({
        points: polygon.map((p) => ({ x: p.x / mapW, y: p.y / mapH })),
        radius: pixelRadius,
        mode: 'reveal',
        fill: true,
      });
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
 * Resolve effective light passthrough intensity for a window element.
 * Returns 0–1 based on time of day.
 * @param win Window element.
 * @param timeOfDay Current time of day.
 */
export function getWindowLightIntensity(
  win: MapWindowElement,
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | string | null | undefined,
): number {
  if (win.covered) return 0;
  if (!win.lightByTimeOfDay) return 0;
  const key = timeOfDay as keyof typeof win.lightByTimeOfDay;
  if (key && win.lightByTimeOfDay[key] !== undefined) {
    return Math.max(0, Math.min(1, win.lightByTimeOfDay[key]));
  }
  return 0;
}

/** Default radius (in map pixels) used when a window acts as a light source. */
const WINDOW_LIGHT_RADIUS = 120;

/**
 * Offset distance (in map pixels) for each virtual window light source.
 * Sources are placed this far from the window midpoint, perpendicular to the
 * window segment, one on each side. Must be large enough that the source sits
 * clearly on one side of the wall so the visibility polygon doesn't leak.
 */
const WINDOW_SOURCE_OFFSET = 8;

/**
 * Compute the two virtual light source positions for a window.
 * Returns two points offset perpendicularly from the window midpoint,
 * one on each side of the wall.
 *
 * @param win Window element.
 * @param mapW Map natural width (px).
 * @param mapH Map natural height (px).
 * @returns Tuple of two {x,y} positions in pixel coordinates.
 */
function getWindowDualSources(
  win: MapWindowElement,
  mapW: number,
  mapH: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const ax = win.points[0].x * mapW;
  const ay = win.points[0].y * mapH;
  const bx = win.points[1].x * mapW;
  const by = win.points[1].y * mapH;

  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2;

  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) {
    return [{ x: midX, y: midY }, { x: midX, y: midY }];
  }

  // Perpendicular unit vector
  const nx = -dy / len;
  const ny = dx / len;

  return [
    { x: midX + nx * WINDOW_SOURCE_OFFSET, y: midY + ny * WINDOW_SOURCE_OFFSET },
    { x: midX - nx * WINDOW_SOURCE_OFFSET, y: midY - ny * WINDOW_SOURCE_OFFSET },
  ];
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
  /**
   * Small extension (px) applied to each end of every blocking segment.
   * Closes micro-gaps at T-junctions along the segment's own direction.
   */
  const PAD = 2;

  for (const el of elements) {
    if (el.type === 'wall') {
      for (let i = 0; i < el.points.length - 1; i++) {
        let ax = el.points[i].x * mapW,     ay = el.points[i].y * mapH;
        let bx = el.points[i + 1].x * mapW, by = el.points[i + 1].y * mapH;
        const dx = bx - ax, dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const ux = (dx / len) * PAD, uy = (dy / len) * PAD;
          ax -= ux; ay -= uy;
          bx += ux; by += uy;
        }
        segs.push({ ax, ay, bx, by });
      }
    } else if (el.type === 'door' && !el.isOpen) {
      let ax = el.points[0].x * mapW, ay = el.points[0].y * mapH;
      let bx = el.points[1].x * mapW, by = el.points[1].y * mapH;
      const dx = bx - ax, dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const ux = (dx / len) * PAD, uy = (dy / len) * PAD;
        ax -= ux; ay -= uy;
        bx += ux; by += uy;
      }
      segs.push({ ax, ay, bx, by });
    }
    // Windows never block — they allow fog and light propagation.
  }

  // ── T-junction snap ──────────────────────────────────────────────────
  // For each segment endpoint, project it onto every other segment. If the
  // perpendicular distance is small (< SNAP px) but non-zero, snap the
  // endpoint onto the other segment. This properly closes T-junctions
  // where a wall meets another wall mid-segment (not at an endpoint).
  const SNAP = 6;
  for (let i = 0; i < segs.length; i++) {
    for (const endKey of [0, 1] as const) {
      const px = endKey === 0 ? segs[i].ax : segs[i].bx;
      const py = endKey === 0 ? segs[i].ay : segs[i].by;
      let bestDist = SNAP;
      let bestX = px, bestY = py;

      for (let j = 0; j < segs.length; j++) {
        if (i === j) continue;
        const sax = segs[j].ax, say = segs[j].ay;
        const sbx = segs[j].bx, sby = segs[j].by;
        const sdx = sbx - sax, sdy = sby - say;
        const sLenSq = sdx * sdx + sdy * sdy;
        if (sLenSq < 1) continue;
        let t = ((px - sax) * sdx + (py - say) * sdy) / sLenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = sax + t * sdx;
        const projY = say + t * sdy;
        const d = Math.hypot(px - projX, py - projY);
        if (d > 0.1 && d < bestDist) {
          bestDist = d;
          bestX = projX;
          bestY = projY;
        }
      }

      if (bestDist < SNAP) {
        if (endKey === 0) { segs[i].ax = bestX; segs[i].ay = bestY; }
        else              { segs[i].bx = bestX; segs[i].by = bestY; }
      }
    }
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
 * Ray–segment intersection. Ray from (ox,oy) in unit direction (dx,dy).
 * Returns distance along the ray to the hit point, or null if no hit.
 */
function raySegmentIntersect(
  ox: number, oy: number,
  dx: number, dy: number,
  ax: number, ay: number,
  bx: number, by: number,
): number | null {
  const sdx = bx - ax;
  const sdy = by - ay;
  const denom = dx * sdy - dy * sdx;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((ax - ox) * sdy - (ay - oy) * sdx) / denom;
  const u = ((ax - ox) * dy - (ay - oy) * dx) / denom;
  if (t > 0 && u >= 0 && u <= 1) return t;
  return null;
}

/**
 * Compute a 2D visibility polygon from a point source bounded by a radius.
 * Casts rays at regular angular intervals and toward each blocker endpoint
 * (with slight offsets for corner precision). Returns ordered vertices in
 * pixel coordinates that form the revealed area.
 *
 * @param cx   Source X (px).
 * @param cy   Source Y (px).
 * @param radius Maximum reveal radius (px).
 * @param blockers Blocking segments in pixel coordinates.
 * @returns Polygon vertices ordered by angle.
 */
function computeVisibilityPolygon(
  cx: number,
  cy: number,
  radius: number,
  blockers: Array<{ ax: number; ay: number; bx: number; by: number }>,
): Array<{ x: number; y: number }> {
  const angles: number[] = [];

  // Regular angular sampling (~360 rays for smoother circle outline)
  const STEP_DEG = 1;
  for (let deg = 0; deg < 360; deg += STEP_DEG) {
    angles.push((deg * Math.PI) / 180);
  }

  // Targeted rays toward blocker endpoints for precise wall edges.
  // EPS is the angular spread on each side of the exact angle, large enough to
  // "peek" past T-junction corners with small floating-point gaps (~1-2 px).
  const EPS = 0.001;
  const rSq = (radius + 50) * (radius + 50);
  for (const seg of blockers) {
    for (const pt of [{ x: seg.ax, y: seg.ay }, { x: seg.bx, y: seg.by }]) {
      const ddx = pt.x - cx;
      const ddy = pt.y - cy;
      if (ddx * ddx + ddy * ddy > rSq) continue;
      const a = Math.atan2(ddy, ddx);
      angles.push(a - EPS, a, a + EPS);
    }
  }

  angles.sort((a, b) => a - b);

  // Deduplicate angles that are extremely close (< 1e-6 rad apart)
  // to avoid casting redundant rays.
  const uniqueAngles: number[] = [];
  for (let i = 0; i < angles.length; i++) {
    if (i === 0 || angles[i] - angles[i - 1] > 1e-6) {
      uniqueAngles.push(angles[i]);
    }
  }

  const points: Array<{ x: number; y: number }> = [];
  for (const angle of uniqueAngles) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    let dist = radius;
    for (const seg of blockers) {
      const t = raySegmentIntersect(cx, cy, dirX, dirY, seg.ax, seg.ay, seg.bx, seg.by);
      if (t !== null && t < dist) dist = t;
    }
    points.push({ x: cx + dirX * dist, y: cy + dirY * dist });
  }

  return points;
}

/**
 * Compute virtual "reveal" strokes to clear organic fog around active light sources
 * and windows. Uses a visibility-polygon approach for clean wall edges instead of
 * grid-sampled circles.
 *
 * Points are normalised (0–1) relative to the map's natural dimensions.
 *
 * @param elements Map elements array.
 * @param timeOfDay Current time of day.
 * @param mapW Map natural width (px).
 * @param mapH Map natural height (px).
 * @returns Array of virtual reveal strokes (polygons or circles).
 */
export function computeLightRevealStrokes(
  elements: MapElement[],
  timeOfDay: string | null | undefined,
  mapW: number,
  mapH: number,
): Array<{ points: { x: number; y: number }[]; radius: number; mode: 'reveal' | 'fog'; fill?: boolean }> {
  if (!mapW || !mapH) return [];
  const out: Array<{ points: { x: number; y: number }[]; radius: number; mode: 'reveal' | 'fog'; fill?: boolean }> = [];
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
      out.push({
        points: [{ x: el.position.x, y: el.position.y }],
        radius: effectiveRadius,
        mode: 'reveal',
      });
      continue;
    }

    // Compute visibility polygon for smooth wall interaction
    const polygon = computeVisibilityPolygon(lightPx, lightPy, effectiveRadius, blockers);
    if (polygon.length > 2) {
      out.push({
        points: polygon.map((p) => ({ x: p.x / mapW, y: p.y / mapH })),
        radius: effectiveRadius,
        mode: 'reveal',
        fill: true,
      });
    }
  }

  // ── Windows acting as light sources ──────────────────────────────────
  // Each window emits from two virtual points offset to either side of the
  // wall so the visibility polygon respects the wall and doesn't leak.
  for (const el of elements) {
    if (el.type !== 'window') continue;
    const wIntensity = getWindowLightIntensity(el, timeOfDay);
    if (wIntensity <= 0) continue;
    const wRadius = WINDOW_LIGHT_RADIUS * wIntensity;
    if (wRadius < 1) continue;

    const [srcA, srcB] = getWindowDualSources(el, mapW, mapH);

    for (const src of [srcA, srcB]) {
      if (blockers.length === 0) {
        out.push({
          points: [{ x: src.x / mapW, y: src.y / mapH }],
          radius: wRadius,
          mode: 'reveal',
        });
        continue;
      }

      const polygon = computeVisibilityPolygon(src.x, src.y, wRadius, blockers);
      if (polygon.length > 2) {
        out.push({
          points: polygon.map((p) => ({ x: p.x / mapW, y: p.y / mapH })),
          radius: wRadius,
          mode: 'reveal',
          fill: true,
        });
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

  // ── Windows acting as light sources (grid mode) ──────────────────────
  // Each window uses two virtual sources offset to each side of the wall.
  for (const el of elements) {
    if (el.type !== 'window') continue;
    const wIntensity = getWindowLightIntensity(el, timeOfDay);
    if (wIntensity <= 0) continue;
    const wRadius = WINDOW_LIGHT_RADIUS * wIntensity;
    if (wRadius < 1) continue;

    const [srcA, srcB] = getWindowDualSources(el, mapW, mapH);

    for (const src of [srcA, srcB]) {
      const wGridRadius = Math.max(0, Math.ceil(wRadius / cellSize));

      let wCol: number;
      let wRow: number;
      if (grid.type === 'square') {
        wCol = Math.floor(src.x / cellSize);
        wRow = Math.floor(src.y / cellSize);
      } else {
        const hexR = cellSize;
        const hexH = Math.sqrt(3) * hexR;
        const horizStep = 1.5 * hexR;
        wCol = Math.round((src.x - hexR) / horizStep);
        const yOffset = (wCol % 2 === 0) ? 0 : hexH / 2;
        wRow = Math.round((src.y - hexH / 2 - yOffset) / hexH);
      }

      const wCellKey = `${wCol}:${wRow}`;
      const wCellsInRange = getCellsWithinRadius(grid, wCellKey, wGridRadius);

      for (const ck of wCellsInRange) {
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

        let wBlocked = false;
        for (const seg of blockers) {
          if (segmentsIntersect(src.x, src.y, cx, cy, seg.ax, seg.ay, seg.bx, seg.by)) {
            wBlocked = true;
            break;
          }
        }
        if (!wBlocked) cleared.add(ck);
      }
    }
  }

  return cleared;
}
