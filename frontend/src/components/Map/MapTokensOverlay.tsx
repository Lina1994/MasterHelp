import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { GridSettings } from './MapGridOverlay';
import type { MapTokenPayload, TokenSize } from '../../api/maps';
import AuthImage from '../common/AuthImage';

export type TokenEditMode = 'none' | 'ally' | 'enemy' | 'erase' | 'rotate';

const normalizeDeg = (deg: number): number => {
  const d = Number(deg) || 0;
  return ((d % 360) + 360) % 360;
};

const hashStringToInt = (value: string): number => {
  // Deterministic small hash for animation phase staggering
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

/**
 * Get token size multiplier and scale based on creature size.
 * Returns: { scale: size relative to cell, gridSpan: cells occupied in one dimension }
 */
const getTokenSizeInfo = (size: TokenSize | undefined, cellSize: number, isSquare: boolean): { diameter: number; gridSpan: number } => {
  const tokenSize = size || 'medium';
  
  if (isSquare) {
    // Square grid sizing (increased 20% from original spec)
    switch (tokenSize) {
      case 'tiny':
        return { diameter: cellSize * 0.6, gridSpan: 1 };
      case 'small':
      case 'medium':
        return { diameter: cellSize * 0.84, gridSpan: 1 };
      case 'large':
        return { diameter: cellSize * 2 * 0.84, gridSpan: 2 };
      case 'huge':
        return { diameter: cellSize * 3 * 0.84, gridSpan: 3 };
      case 'gargantuan':
        return { diameter: cellSize * 4 * 0.84, gridSpan: 4 };
      default:
        return { diameter: cellSize * 0.84, gridSpan: 1 };
    }
  } else {
    // Hex grid sizing (increased 20% + additional 20% from original spec)
    // Huge and Gargantuan have an extra 10% increase
    // For hex grids, we use similar scaling to square grids with extra sizing
    switch (tokenSize) {
      case 'tiny':
        return { diameter: cellSize * 0.726, gridSpan: 1 };
      case 'small':
      case 'medium':
        return { diameter: cellSize * 1.0164, gridSpan: 1 };
      case 'large':
        // 3 hexes pattern - use 2x multiplier like square
        return { diameter: cellSize * 2 * 1.0164, gridSpan: 2 };
      case 'huge':
        // 7 hexes pattern - use 3x multiplier like square with +10% extra
        return { diameter: cellSize * 3 * 1.11804, gridSpan: 3 };
      case 'gargantuan':
        // 12 hexes pattern - use 4x multiplier like square with +10% extra
        return { diameter: cellSize * 4 * 1.11804, gridSpan: 4 };
      default:
        return { diameter: cellSize * 1.0164, gridSpan: 1 };
    }
  }
};

/**
 * Get the visual center for large tokens that span multiple cells.
 * For square grids: center is at the intersection of the NxN grid.
 * For hex grids: depends on the formation pattern.
 */
const getTokenCenter = (
  cellKey: string,
  tokenSize: TokenSize | undefined,
  isSquare: boolean,
  cellSize: number,
  orientation?: number
): { x: number; y: number } => {
  const [colStr, rowStr] = cellKey.split(':');
  const col = parseInt(colStr, 10) || 0;
  const row = parseInt(rowStr, 10) || 0;
  const size = tokenSize || 'medium';
  const r = cellSize;

  if (isSquare) {
    // For square grids, large tokens are centered at the intersection point
    const offset = (() => {
      switch (size) {
        case 'tiny':
        case 'small':
        case 'medium':
          return { dx: r / 2, dy: r / 2 }; // Center of single cell
        case 'large':
          return { dx: r, dy: r }; // Intersection of 2x2 (1 cell offset)
        case 'huge':
          return { dx: r * 1.5, dy: r * 1.5 }; // Intersection of 3x3 (1.5 cells)
        case 'gargantuan':
          return { dx: r * 2, dy: r * 2 }; // Intersection of 4x4 (2 cells)
        default:
          return { dx: r / 2, dy: r / 2 };
      }
    })();
    return { x: col * r + offset.dx, y: row * r + offset.dy };
  } else {
    // Hex grid (flat-top)
    const hexR = r;
    const hexH = Math.sqrt(3) * hexR;
    const horizStep = 1.5 * hexR;
    const vertStep = hexH;
    const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
    
    // For hex, center computation is more complex for large tokens
    // Simplified: use cell center with slight adjustment for multi-hex tokens
    const baseX = col * horizStep + hexR;
    const baseY = row * vertStep + hexH / 2 + yOffset;
    
    switch (size) {
      case 'tiny':
      case 'small':
      case 'medium':
        return { x: baseX, y: baseY };
      case 'large':
        // Center at the vertex where 3 hexes meet (forming a triangle)
        // Calculate based on the 3 hexagons that form the triangle
        const largeCells = getOccupiedCells(cellKey, 'large', false, orientation);
        if (largeCells.length === 3) {
          // Calculate centroid of the 3 hex centers
          let sumX = 0, sumY = 0;
          for (const cell of largeCells) {
            const [cStr, rStr] = cell.split(':');
            const c = parseInt(cStr, 10);
            const r = parseInt(rStr, 10);
            const yOff = (c % 2 === 0) ? 0 : hexH / 2;
            const cx = c * horizStep + hexR;
            const cy = r * vertStep + hexH / 2 + yOff;
            sumX += cx;
            sumY += cy;
          }
          // The vertex is at approximately the centroid
          return { x: sumX / 3, y: sumY / 3 };
        }
        // Fallback to default
        return { x: baseX + hexR / 2, y: baseY + hexH / 2 };
      case 'huge':
        // Center of 7-hex formation (already at center hex)
        return { x: baseX, y: baseY };
      case 'gargantuan':
        // For Gargantuan, calculate center based on the 3 central hexes (like Large)
        const gargantuanCells = getOccupiedCells(cellKey, 'gargantuan', false, orientation);
        // We need the 3 central hexes - they're the first 3 in the list
        if (gargantuanCells.length >= 3) {
          let sumX = 0, sumY = 0;
          // Calculate centroid of first 3 cells (the central triangle)
          for (let i = 0; i < 3; i++) {
            const cell = gargantuanCells[i];
            const [cStr, rStr] = cell.split(':');
            const c = parseInt(cStr, 10);
            const r = parseInt(rStr, 10);
            const yOff = (c % 2 === 0) ? 0 : hexH / 2;
            const cx = c * horizStep + hexR;
            const cy = r * vertStep + hexH / 2 + yOff;
            sumX += cx;
            sumY += cy;
          }
          return { x: sumX / 3, y: sumY / 3 };
        }
        // Fallback
        return { x: baseX, y: baseY };
      default:
        return { x: baseX, y: baseY };
    }
  }
};

/**
 * Get all possible triangle orientations for Large token in hex grid.
 * Returns array of neighbor offsets for the 6 possible orientations.
 */
const getLargeHexOrientations = (): Array<Array<{dc: number; dr: number; evenCol: boolean}>> => {
  // 6 possible orientations of a 3-hex triangle
  return [
    // Orientation 0: right and down-right (even col)
    [{ dc: 1, dr: 0, evenCol: true }, { dc: 1, dr: -1, evenCol: true }],
    // Orientation 1: right and down-right (odd col)
    [{ dc: 1, dr: 0, evenCol: false }, { dc: 1, dr: 1, evenCol: false }],
    // Orientation 2: left and down-left (even col)
    [{ dc: -1, dr: 0, evenCol: true }, { dc: -1, dr: -1, evenCol: true }],
    // Orientation 3: left and down-left (odd col)
    [{ dc: -1, dr: 0, evenCol: false }, { dc: -1, dr: 1, evenCol: false }],
    // Orientation 4: down and down-opposite (even col)
    [{ dc: 0, dr: 1, evenCol: true }, { dc: 1, dr: 0, evenCol: true }],
    // Orientation 5: up and up-opposite (even col)
    [{ dc: 0, dr: -1, evenCol: true }, { dc: 1, dr: -1, evenCol: true }],
  ];
};

/**
 * Get all cell keys occupied by a token at a given position.
 * Returns an array of cellKey strings representing the grid cells the token covers.
 */
const getOccupiedCells = (
  cellKey: string,
  tokenSize: TokenSize | undefined,
  isSquare: boolean,
  orientation?: number
): string[] => {
  const [colStr, rowStr] = cellKey.split(':');
  const col = parseInt(colStr, 10) || 0;
  const row = parseInt(rowStr, 10) || 0;
  const size = tokenSize || 'medium';
  
  // Small tokens only occupy their cell
  if (size === 'tiny' || size === 'small' || size === 'medium') {
    return [cellKey];
  }
  
  const cells: string[] = [];
  
  if (isSquare) {
    // For square grids, tokens are centered at intersections
    // So we need to return the cells around that intersection
    let gridSize = 1;
    switch (size) {
      case 'large': gridSize = 2; break;
      case 'huge': gridSize = 3; break;
      case 'gargantuan': gridSize = 4; break;
    }
    
    // The token is centered at the intersection, so we need the cells
    // in a gridSize x gridSize area starting from (col, row)
    for (let dc = 0; dc < gridSize; dc++) {
      for (let dr = 0; dr < gridSize; dr++) {
        cells.push(`${col + dc}:${row + dr}`);
      }
    }
  } else {
    // Hex grids - proper hex neighbor patterns
    // Hex coordinates have offset rows for odd columns
    const isEvenCol = col % 2 === 0;
    cells.push(cellKey);
    
    switch (size) {
      case 'large':
        // 3-hex triangle pattern with multiple possible orientations
        if (orientation !== undefined) {
          // Use specific orientation
          const orientations = getLargeHexOrientations();
          const config = orientations[orientation % orientations.length];
          for (const offset of config) {
            cells.push(`${col + offset.dc}:${row + offset.dr}`);
          }
        } else {
          // Default behavior based on even/odd column
          if (isEvenCol) {
            cells.push(`${col + 1}:${row}`);
            cells.push(`${col + 1}:${row - 1}`);
          } else {
            cells.push(`${col + 1}:${row}`);
            cells.push(`${col + 1}:${row + 1}`);
          }
        }
        break;
      case 'huge':
        // 7-hex flower pattern (center + 6 surrounding)
        // The 6 neighbors depend on whether we're in even or odd column
        if (isEvenCol) {
          cells.push(`${col - 1}:${row - 1}`); // upper-left
          cells.push(`${col}:${row - 1}`);     // upper
          cells.push(`${col + 1}:${row - 1}`); // upper-right
          cells.push(`${col + 1}:${row}`);     // right
          cells.push(`${col}:${row + 1}`);     // lower
          cells.push(`${col - 1}:${row}`);     // left
        } else {
          cells.push(`${col - 1}:${row}`);     // upper-left
          cells.push(`${col}:${row - 1}`);     // upper
          cells.push(`${col + 1}:${row}`);     // upper-right
          cells.push(`${col + 1}:${row + 1}`); // right
          cells.push(`${col}:${row + 1}`);     // lower
          cells.push(`${col - 1}:${row + 1}`); // left
        }
        break;
      case 'gargantuan':
        // 12-hex pattern with orientation support: 3 central hexes (like Large) + all 9 neighbors
        if (orientation !== undefined) {
          // Use the orientation parameter to define the 3 central hexes
          const orientations = getLargeHexOrientations();
          const config = orientations[orientation % orientations.length];
          
          // Build the 3 central hexes
          const centralCells = [cellKey];
          for (const offset of config) {
            centralCells.push(`${col + offset.dc}:${row + offset.dr}`);
          }
          
          // Helper function to get all 6 neighbors
          const getHexNeighbors = (c: number, r: number): string[] => {
            const isEven = c % 2 === 0;
            if (isEven) {
              return [
                `${c - 1}:${r - 1}`, `${c}:${r - 1}`, `${c + 1}:${r - 1}`,
                `${c + 1}:${r}`, `${c}:${r + 1}`, `${c - 1}:${r}`,
              ];
            } else {
              return [
                `${c - 1}:${r}`, `${c}:${r - 1}`, `${c + 1}:${r}`,
                `${c + 1}:${r + 1}`, `${c}:${r + 1}`, `${c - 1}:${r + 1}`,
              ];
            }
          };
          
          // Collect all unique neighbors
          const allNeighbors = new Set<string>();
          for (const cellStr of centralCells) {
            const [cStr, rStr] = cellStr.split(':');
            const neighbors = getHexNeighbors(parseInt(cStr, 10), parseInt(rStr, 10));
            neighbors.forEach(n => allNeighbors.add(n));
          }
          
          // Remove central hexes from neighbors
          const centralSet = new Set(centralCells);
          const peripheralCells: string[] = [];
          allNeighbors.forEach(n => {
            if (!centralSet.has(n)) {
              peripheralCells.push(n);
            }
          });
          
          // CRITICAL: Add central cells FIRST (for proper centroid calculation)
          // then peripheral cells
          for (let i = 1; i < centralCells.length; i++) {
            cells.push(centralCells[i]);
          }
          peripheralCells.forEach(n => cells.push(n));
        } else {
          // Default behavior - original Gargantuan logic
          const getHexNeighbors = (c: number, r: number): string[] => {
            const isEven = c % 2 === 0;
            if (isEven) {
              return [
                `${c - 1}:${r - 1}`, `${c}:${r - 1}`, `${c + 1}:${r - 1}`,
                `${c + 1}:${r}`, `${c}:${r + 1}`, `${c - 1}:${r}`,
              ];
            } else {
              return [
                `${c - 1}:${r}`, `${c}:${r - 1}`, `${c + 1}:${r}`,
                `${c + 1}:${r + 1}`, `${c}:${r + 1}`, `${c - 1}:${r + 1}`,
              ];
            }
          };
          
          const centralHexes: Array<{c: number; r: number}> = [{ c: col, r: row }];
          
          if (isEvenCol) {
            centralHexes.push({ c: col + 1, r: row });
            centralHexes.push({ c: col + 1, r: row - 1 });
          } else {
            centralHexes.push({ c: col + 1, r: row });
            centralHexes.push({ c: col + 1, r: row + 1 });
          }
          
          cells.push(`${centralHexes[1].c}:${centralHexes[1].r}`);
          cells.push(`${centralHexes[2].c}:${centralHexes[2].r}`);
          
          const allNeighbors = new Set<string>();
          for (const hex of centralHexes) {
            const neighbors = getHexNeighbors(hex.c, hex.r);
            neighbors.forEach(n => allNeighbors.add(n));
          }
          
          const centralSet = new Set(centralHexes.map(h => `${h.c}:${h.r}`));
          allNeighbors.forEach(n => {
            if (!centralSet.has(n)) {
              cells.push(n);
            }
          });
        }
        break;
    }
  }
  
  return cells;
};

/**
 * MapTokensOverlay
 * Renders tokens at grid cell centers with slight offsets for overlaps. Supports optional editing.
 */
const MapTokensOverlay: React.FC<{
  settings: GridSettings;
  widthPx?: number;
  heightPx?: number;
  tokens: MapTokenPayload[];
  editable?: boolean;
  editMode?: TokenEditMode;
  renderTokenBody?: boolean;
  renderLabel?: boolean;
  renderFacing?: boolean;
  zIndex?: number;
  onSelectToken?: (token: MapTokenPayload, anchor: { left: number; top: number }) => void;
  onAddToken?: (cellKey: string, type: 'ally' | 'enemy') => void;
  onMoveToken?: (id: string, cellKey: string) => void;
  onUpdateToken?: (id: string, patch: Partial<MapTokenPayload>) => void;
  onRemoveToken?: (id: string) => void;
  previewScale?: number; // for preview context where a CSS scale is applied
  transform?: { zoom?: number; rotationDeg?: number } | null; // active map transform
  getTokenImage?: (token: MapTokenPayload) => string | undefined;
  highlightIds?: Set<string> | null;
  showGuideDots?: boolean; // show guide dots for large token placement (default true)
  showCellShading?: boolean; // show cell shading preview for large tokens (default true)
}> = ({ settings, widthPx, heightPx, tokens, editable = false, editMode = 'none', renderTokenBody = true, renderLabel = true, renderFacing = true, zIndex, onSelectToken, onAddToken, onMoveToken, onUpdateToken, onRemoveToken, previewScale = 1, transform, getTokenImage, highlightIds, showGuideDots = true, showCellShading = true }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; moved: boolean; orientation?: number } | null>(null);
  const [dragPointer, setDragPointer] = useState<{ clientX: number; clientY: number } | null>(null);

  const tokenById = useMemo(() => {
    const map = new Map<string, MapTokenPayload>();
    (tokens || []).forEach((t) => map.set(t.id, t));
    return map;
  }, [tokens]);

  const square = settings.type === 'square';
  const r = settings.cellSize || 40;
  const hexR = r;
  const hexH = Math.sqrt(3) * hexR;
  const horizStep = 1.5 * hexR;
  const vertStep = hexH;

  const getCellFromPoint = useCallback((clientX: number, clientY: number): string | null => {
    const el = rootRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    // Compute point relative to element center, undo preview scale, map inverse of rotation+zoom
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // vector from center in screen space
    let dx = clientX - cx;
    let dy = clientY - cy;
    // Undo previewScale (uniform)
    const ps = previewScale || 1;
    if (ps && ps !== 1) { dx /= ps; dy /= ps; }
    // Undo map rotation
    const angle = -((transform?.rotationDeg || 0) * Math.PI / 180);
    if (angle) {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx; dy = ry;
    }
    // Undo map zoom (uniform)
    const z = transform?.zoom || 1;
    if (z && z !== 1) { dx /= z; dy /= z; }
    // Convert back from center-based to top-left coordinates of intrinsic content
    const x = dx + (widthPx || 0) / 2;
    const y = dy + (heightPx || 0) / 2;
    if (x < 0 || y < 0) return null;
    if (widthPx && x > widthPx) return null;
    if (heightPx && y > heightPx) return null;
    if (square) {
      const c = Math.floor(x / r);
      const rr = Math.floor(y / r);
      return `${c}:${rr}`;
    } else {
      // flat-top hex approx mapping
      const col = Math.round((x - hexR) / horizStep);
      const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
      const row = Math.round((y - (hexH / 2 + yOffset)) / vertStep);
      return `${col}:${row}`;
    }
  }, [heightPx, widthPx, r, square, hexR, hexH, horizStep, vertStep, previewScale, transform?.rotationDeg, transform?.zoom]);

  /**
   * Get the best cellKey for a token at a given point, considering token size.
   * For multi-cell tokens that center on vertices/intersections, this finds the
   * cellKey that produces the closest center to the target point.
   * 
   * @param currentOrientation - If provided, gives a small bias to this orientation to prevent flickering
   */
  const getCellFromPointForToken = useCallback((clientX: number, clientY: number, tokenSize: TokenSize | undefined, currentOrientation?: number): { cellKey: string | null; orientation?: number } => {
    const el = rootRef.current;
    if (!el) return { cellKey: null };
    const rect = el.getBoundingClientRect();
    // Convert to canvas coordinates (same transformation as getCellFromPoint)
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const ps = previewScale || 1;
    if (ps && ps !== 1) { dx /= ps; dy /= ps; }
    const angle = -((transform?.rotationDeg || 0) * Math.PI / 180);
    if (angle) {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx; dy = ry;
    }
    const z = transform?.zoom || 1;
    if (z && z !== 1) { dx /= z; dy /= z; }
    const x = dx + (widthPx || 0) / 2;
    const y = dy + (heightPx || 0) / 2;
    if (x < 0 || y < 0) return { cellKey: null };
    if (widthPx && x > widthPx) return { cellKey: null };
    if (heightPx && y > heightPx) return { cellKey: null };

    const size = tokenSize || 'medium';
    
    // For small tokens, use standard cell detection
    if (size === 'tiny' || size === 'small' || size === 'medium') {
      return { cellKey: getCellFromPoint(clientX, clientY) };
    }

    // For Huge (centers on hex), use standard logic
    if (!square && size === 'huge') {
      return { cellKey: getCellFromPoint(clientX, clientY) };
    }

    // For multi-cell tokens, find the cellKey that produces the closest center
    // Generate candidate cells in the area
    const baseCell = getCellFromPoint(clientX, clientY);
    if (!baseCell) return { cellKey: null };
    const [baseCol, baseRow] = baseCell.split(':').map(s => parseInt(s, 10));
    
    let bestCell: string | null = null;
    let bestOrientation: number | undefined = undefined;
    let bestDistance = Infinity;
    
    // For Large and Gargantuan in hex, try multiple orientations
    const orientationsToTry = (!square && (size === 'large' || size === 'gargantuan')) 
      ? getLargeHexOrientations().length 
      : 1;
    
    // Bias factor: give current orientation a small advantage (7%) to prevent flickering
    const biasFactor = 0.93;
    
    // Check surrounding cells - use larger area for hex grids to ensure we find all vertices
    const searchRadius = square ? 1 : 4; // 3x3 for square, 9x9 for hex (to cover all vertex types)
    for (let dc = -searchRadius; dc <= searchRadius; dc++) {
      for (let dr = -searchRadius; dr <= searchRadius; dr++) {
        const candidateKey = `${baseCol + dc}:${baseRow + dr}`;
        
        // Try each orientation
        for (let orient = 0; orient < orientationsToTry; orient++) {
          const center = getTokenCenter(candidateKey, size, square, r, square ? undefined : orient);
          let dist = Math.sqrt((center.x - x) ** 2 + (center.y - y) ** 2);
          
          // Apply bias to current orientation to stabilize and prevent flickering
          if (currentOrientation !== undefined && orient === currentOrientation) {
            dist *= biasFactor;
          }
          
          if (dist < bestDistance) {
            bestDistance = dist;
            bestCell = candidateKey;
            bestOrientation = (orientationsToTry > 1) ? orient : undefined;
          }
        }
      }
    }
    
    return { cellKey: bestCell, orientation: bestOrientation };
  }, [getCellFromPoint, square, r, previewScale, transform, widthPx, heightPx]);

  const getCenterFromCell = useCallback((cellKey: string): { x: number; y: number } => {
    const [colStr, rowStr] = cellKey.split(':');
    const col = parseInt(colStr, 10) || 0;
    const row = parseInt(rowStr, 10) || 0;
    if (square) {
      return { x: col * r + r / 2, y: row * r + r / 2 };
    } else {
      const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
      const cx = col * horizStep + hexR;
      const cy = row * vertStep + hexH / 2 + yOffset;
      return { x: cx, y: cy };
    }
  }, [square, r, hexR, hexH, horizStep, vertStep]);

  const grouped = useMemo(() => {
    const map = new Map<string, MapTokenPayload[]>();
    (tokens || []).forEach(t => {
      const arr = map.get(t.cellKey) || [];
      arr.push(t);
      map.set(t.cellKey, arr);
    });
    return map;
  }, [tokens]);

  const offsetsForCount = (count: number): Array<{ dx: number; dy: number }> => {
    const delta = Math.max(6, Math.round(r * 0.15));
    if (count <= 1) return [{ dx: 0, dy: 0 }];
    if (count === 2) return [{ dx: -delta, dy: -delta }, { dx: delta, dy: delta }];
    if (count === 3) return [{ dx: -delta, dy: -delta }, { dx: delta, dy: delta }, { dx: -delta, dy: delta }];
    // 4 or more → small cross
    return [
      { dx: -delta, dy: -delta },
      { dx: delta, dy: delta },
      { dx: -delta, dy: delta },
      { dx: delta, dy: -delta },
      ...Array(Math.max(0, count - 4)).fill(0).map((_v, i) => ({ dx: 0, dy: (i + 1) * (delta * 0.6) })),
    ];
  };

  const onRootClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editable) return;
    if (editMode === 'ally' || editMode === 'enemy') {
      const cellKey = getCellFromPoint(e.clientX, e.clientY);
      if (cellKey && onAddToken) onAddToken(cellKey, editMode);
    }
  }, [editable, editMode, getCellFromPoint, onAddToken]);

  const onTokenPointerDown = (t: MapTokenPayload) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;

    // rotate mode: left click rotates +step, right click rotates -step
    if (editMode === 'rotate') {
      e.preventDefault();
      const step = e.shiftKey ? 15 : 45;
      const current = normalizeDeg((t as any).rotationDeg ?? 0);
      const next = normalizeDeg(current + (e.button === 2 ? -step : step));
      onUpdateToken && onUpdateToken(t.id, { rotationDeg: next });
      return;
    }

    // view/drag mode: right click rotates (instead of deleting)
    if (editMode === 'none' && e.button === 2) {
      e.preventDefault();
      const step = e.shiftKey ? 15 : 45;
      const current = normalizeDeg((t as any).rotationDeg ?? 0);
      const next = normalizeDeg(current + step);
      onUpdateToken && onUpdateToken(t.id, { rotationDeg: next });
      return;
    }

    // erase mode: any click deletes
    if (editMode === 'erase') {
      e.preventDefault();
      onRemoveToken && onRemoveToken(t.id);
      return;
    }

    // view/drag mode: left click selects (on release), dragging moves
    if (editMode === 'none' && e.button === 0) {
      e.preventDefault();
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
      setDrag({ id: t.id, startX: e.clientX, startY: e.clientY, moved: false });
      return;
    }

    // default drag behavior (e.g., rotate mode is handled above)
    if (e.button === 0) {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
      setDrag({ id: t.id, startX: e.clientX, startY: e.clientY, moved: true });
    }
  };

  const onRootPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !drag) return;
    
    // Update drag pointer position for preview
    setDragPointer({ clientX: e.clientX, clientY: e.clientY });
    
    // Update orientation in drag state if dragging large/gargantuan token
    const draggedToken = tokenById.get(drag.id);
    if (draggedToken && drag.moved) {
      // Pass current orientation to getCellFromPointForToken for stability
      const result = getCellFromPointForToken(e.clientX, e.clientY, draggedToken.size, drag.orientation);
      if (result.orientation !== undefined && result.orientation !== drag.orientation) {
        setDrag({ ...drag, orientation: result.orientation });
      }
    }
    
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!drag.moved && dist > 6) {
      setDrag((prev) => (prev ? { ...prev, moved: true } : prev));
    }
    // we only update position on pointer up to snap to cell
    e.preventDefault();
  };

  const onRootPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !drag) return;
    if (!drag.moved) {
      const t = tokenById.get(drag.id);
      if (t && onSelectToken) onSelectToken(t, { left: e.clientX, top: e.clientY });
      setDrag(null);
      setDragPointer(null);
      return;
    }
    const movedToken = tokenById.get(drag.id);
    const result = movedToken ? getCellFromPointForToken(e.clientX, e.clientY, movedToken.size) : { cellKey: getCellFromPoint(e.clientX, e.clientY) };
    const cellKey = result.cellKey;
    if (cellKey && onMoveToken) {
      onMoveToken(drag.id, cellKey);
      
      // Update orientation if it changed
      if (result.orientation !== undefined && onUpdateToken) {
        onUpdateToken(drag.id, { orientation: result.orientation });
      }
      
      // Auto-rotate token to face nearest rival
      if (movedToken && onUpdateToken) {
        const movedCenter = getTokenCenter(cellKey, movedToken.size, square, r, result.orientation);
        
        // Find nearest rival (ally looks for enemies, enemy looks for allies)
        const targetType = movedToken.type === 'ally' ? 'enemy' : 'ally';
        let nearestRival: { token: MapTokenPayload; distance: number } | null = null;
        
        for (const rival of tokens) {
          if (rival.id === drag.id) continue; // Skip self
          if (rival.type !== targetType) continue; // Skip same type
          
          const rivalCenter = getTokenCenter(rival.cellKey, rival.size, square, r, rival.orientation);
          const dx = rivalCenter.x - movedCenter.x;
          const dy = rivalCenter.y - movedCenter.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (!nearestRival || distance < nearestRival.distance) {
            nearestRival = { token: rival, distance };
          }
        }
        
        // If found a rival, calculate angle and update rotation
        if (nearestRival) {
          const rivalCenter = getTokenCenter(nearestRival.token.cellKey, nearestRival.token.size, square, r, nearestRival.token.orientation);
          const dx = rivalCenter.x - movedCenter.x;
          const dy = rivalCenter.y - movedCenter.y;
          // Calculate angle in degrees (0° = up/north, 90° = right/east)
          const angleRad = Math.atan2(dx, -dy);
          const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
          onUpdateToken(drag.id, { rotationDeg: angleDeg });
        }
      }
    }
    setDrag(null);
    setDragPointer(null);
  };

  const style: React.CSSProperties = widthPx && heightPx
    ? { position: 'absolute', width: widthPx, height: heightPx, inset: 'auto', left: 0, top: 0, overflow: 'hidden' }
    : { position: 'absolute', inset: 0, overflow: 'hidden' };
  if (typeof zIndex === 'number') style.zIndex = zIndex;
  // In read-only overlays (projection), avoid intercepting pointer events.
  if (!editable) style.pointerEvents = 'none';

  return (
    <div ref={rootRef} style={style} onClick={onRootClick} onPointerMove={onRootPointerMove} onPointerUp={onRootPointerUp}>
      {/* Render tokens by cell with offsets */}
      {Array.from(grouped.entries()).map(([cellKey, arr]) => {
        const offs = offsetsForCount(arr.length);
        return arr.map((t, idx) => {
          const off = offs[idx] || { dx: 0, dy: 0 };
          const sizeInfo = getTokenSizeInfo(t.size, r, square);
          const size = sizeInfo.diameter;
          const center = getTokenCenter(cellKey, t.size, square, r, t.orientation);
          const color = t.type === 'ally' ? '#2e7d32' : '#c62828';
          const bg = t.color || color;
          const x = center.x + off.dx - size / 2;
          const y = center.y + off.dy - size / 2;
          const isHighlighted = !!(highlightIds && highlightIds.has(t.id));
          const imgUrl = getTokenImage ? getTokenImage(t) : undefined;
          const isDataUrl = !!imgUrl && /^data:/i.test(imgUrl);
          const labelText = (t.label || (t.type === 'ally' ? 'Aliado' : 'Enemigo')) as string;
          
          // For tiny tokens, use larger padding to ensure label doesn't get cut off
          const tokenSize = t.size || 'medium';
          const basePad = Math.max(8, Math.round(size * 0.45));
          const pad = tokenSize === 'tiny' ? Math.max(basePad, 14) : basePad;
          
          const box = size + pad * 2;
          const circleLeft = pad;
          const circleTop = pad;
          const cx = box / 2;
          const cy = box / 2;
          
          // For tiny tokens, increase text radius to prevent clipping
          const baseRText = (size / 2) + Math.max(6, Math.round(size * 0.12));
          const rText = tokenSize === 'tiny' ? baseRText + 4 : baseRText;
          
          const fontSize = Math.max(10, Math.round(size * 0.22));
          const safeLabel = labelText.length > 22 ? `${labelText.slice(0, 22)}…` : labelText;
          const arcId = `token-arc-${String(t.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
          const rotationDeg = normalizeDeg((t as any).rotationDeg ?? 0);
          const labelPhaseSec = (Math.abs(hashStringToInt(String(t.id))) % 8000) / 1000; // 0..8s
          return (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                left: x - pad,
                top: y - pad,
                width: box,
                height: box,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
              title={labelText}
            >
              {renderLabel && (
                <>
                  {/* Curved label around the token (bottom arc) */}
                  <svg
                    width={box}
                    height={box}
                    viewBox={`0 0 ${box} ${box}`}
                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
                  >
                    <defs>
                      <path
                        id={arcId}
                        d={`M ${cx - rText} ${cy} A ${rText} ${rText} 0 1 1 ${cx + rText} ${cy} A ${rText} ${rText} 0 1 1 ${cx - rText} ${cy}`}
                      />
                    </defs>
                    <g>
                      <text
                        fontSize={fontSize}
                        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
                        fill="#ffffff"
                        stroke="rgba(0,0,0,0.85)"
                        strokeWidth={Math.max(2, Math.round(fontSize * 0.25))}
                        paintOrder="stroke"
                      >
                        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
                          {safeLabel}
                        </textPath>
                      </text>
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${cx} ${cy}`}
                        to={`360 ${cx} ${cy}`}
                        dur="28s"
                        repeatCount="indefinite"
                        begin={`-${labelPhaseSec}s`}
                      />
                    </g>
                  </svg>
                </>
              )}

              {renderTokenBody && (
                <>
                  {/* Token circle */}
                  <div
                    onPointerDown={onTokenPointerDown(t)}
                    onContextMenu={(ev) => {
                      if (!editable) return;
                      ev.preventDefault();
                      // Deletion is only allowed in explicit erase mode.
                      if (editMode !== 'erase') return;
                      onRemoveToken && onRemoveToken(t.id);
                    }}
                    style={{
                      position: 'absolute',
                      left: circleLeft,
                      top: circleTop,
                      width: size,
                      height: size,
                      borderRadius: '50%',
                      background: bg,
                      border: imgUrl 
                        ? `4px solid ${t.type === 'ally' ? '#4caf50' : '#f44336'}` 
                        : '2px solid rgba(255,255,255,0.9)',
                      boxShadow: (isHighlighted ? '0 0 0 3px #ffd54f, 0 0 12px #ffd54f' : '0 1px 3px rgba(0,0,0,0.5)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      cursor: !editable ? 'default' : (editMode === 'rotate' ? 'pointer' : 'grab'),
                      pointerEvents: 'auto',
                    }}
                  >
                    {imgUrl ? (
                      isDataUrl ? (
                        // data: URLs cannot be fetched through AuthImage (axios) and should be used directly
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <img
                          src={imgUrl}
                          alt={labelText}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
                        />
                      ) : (
                        <AuthImage
                          src={imgUrl}
                          alt={labelText}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
                        />
                      )
                    ) : (
                      <span
                        style={{
                          color: '#fff',
                          fontSize: Math.max(10, Math.round(size * 0.35)),
                          lineHeight: 1,
                          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                        }}
                      >
                        {(t.label ? t.label.slice(0, 2) : (t.type === 'ally' ? 'A' : 'E'))}
                      </span>
                    )}
                  </div>
                </>
              )}

              {renderFacing && (
                <>
                  {/* Facing indicator (arrow) */}
                  <div
                    style={{
                      position: 'absolute',
                      left: circleLeft,
                      top: circleTop,
                      width: size,
                      height: size,
                      transform: `rotate(${rotationDeg}deg)`,
                      transformOrigin: 'center center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: -Math.max(6, Math.round(size * 0.12)),
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: `${Math.max(5, Math.round(size * 0.12))}px solid transparent`,
                        borderRight: `${Math.max(5, Math.round(size * 0.12))}px solid transparent`,
                        borderBottom: `${Math.max(8, Math.round(size * 0.18))}px solid rgba(255,213,79,0.95)`,
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        });
      })}
      
      {/* Shaded cells preview when dragging large tokens */}
      {showCellShading && drag && dragPointer && (() => {
        const draggedToken = tokenById.get(drag.id);
        if (!draggedToken) return null;
        const tokenSize = draggedToken.size || 'medium';
        
        // Only show for multi-cell tokens
        if (tokenSize === 'tiny' || tokenSize === 'small' || tokenSize === 'medium') {
          return null;
        }
        
        // Get the cell where the pointer currently is
        const result = getCellFromPointForToken(dragPointer.clientX, dragPointer.clientY, tokenSize);
        const hoverCellKey = result.cellKey;
        if (!hoverCellKey) return null;
        
        // Get all cells occupied by this token at this position, using the orientation from drag state
        const occupiedCells = getOccupiedCells(hoverCellKey, tokenSize, square, drag.orientation);
        
        if (square) {
          // Square cell overlays
          return (
            <>
              {occupiedCells.map((cellKey) => {
                const center = getCenterFromCell(cellKey);
                return (
                  <div
                    key={`shade-${cellKey}`}
                    style={{
                      position: 'absolute',
                      left: center.x - r / 2,
                      top: center.y - r / 2,
                      width: r,
                      height: r,
                      backgroundColor: 'rgba(100, 150, 255, 0.3)',
                      border: '1px solid rgba(100, 150, 255, 0.5)',
                      pointerEvents: 'none',
                    }}
                  />
                );
              })}
            </>
          );
        } else {
          // Hex cell overlays - draw actual hexagons using single SVG
          const hexRadius = hexR;
          const angle = Math.PI / 3; // 60 degrees
          
          return (
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: widthPx || '100%',
                height: heightPx || '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              {occupiedCells.map((cellKey) => {
                const center = getCenterFromCell(cellKey);
                const points: string[] = [];
                for (let i = 0; i < 6; i++) {
                  const a = angle * i;
                  const px = center.x + hexRadius * Math.cos(a);
                  const py = center.y + hexRadius * Math.sin(a);
                  points.push(`${px},${py}`);
                }
                
                return (
                  <polygon
                    key={`shade-${cellKey}`}
                    points={points.join(' ')}
                    fill="rgba(100, 150, 255, 0.3)"
                    stroke="rgba(100, 150, 255, 0.5)"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          );
        }
      })()}
      
      {/* Guide dots when dragging large tokens */}
      {showGuideDots && drag && dragPointer && (() => {
        const draggedToken = tokenById.get(drag.id);
        if (!draggedToken) return null;
        const tokenSize = draggedToken.size || 'medium';
        
        // Only show guide dots for multi-cell tokens
        if (tokenSize === 'tiny' || tokenSize === 'small' || tokenSize === 'medium') {
          return null;
        }
        
        // Get cursor position in canvas coordinates
        const el = rootRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = dragPointer.clientX - cx;
        let dy = dragPointer.clientY - cy;
        const ps = previewScale || 1;
        if (ps && ps !== 1) { dx /= ps; dy /= ps; }
        const angle = -((transform?.rotationDeg || 0) * Math.PI / 180);
        if (angle) {
          const cos = Math.cos(angle), sin = Math.sin(angle);
          const rx = dx * cos - dy * sin;
          const ry = dx * sin + dy * cos;
          dx = rx; dy = ry;
        }
        const z = transform?.zoom || 1;
        if (z && z !== 1) { dx /= z; dy /= z; }
        const cursorX = dx + (widthPx || 0) / 2;
        const cursorY = dy + (heightPx || 0) / 2;
        
        // Calculate grid dimensions
        const maxCol = widthPx ? Math.ceil(widthPx / (square ? r : horizStep)) + 1 : 20;
        const maxRow = heightPx ? Math.ceil(heightPx / (square ? r : vertStep)) + 1 : 20;
        
        const guideDots: Array<{ x: number; y: number; key: string; distance: number }> = [];
        
        if (square) {
          // For square grids, show intersection points
          for (let col = 0; col <= maxCol; col++) {
            for (let row = 0; row <= maxRow; row++) {
              const cellKey = `${col}:${row}`;
              const center = getTokenCenter(cellKey, tokenSize, true, r);
              const dist = Math.sqrt((center.x - cursorX) ** 2 + (center.y - cursorY) ** 2);
              guideDots.push({ x: center.x, y: center.y, key: cellKey, distance: dist });
            }
          }
        } else {
          // For hex grids - generate all valid positions based on token size
          const seenPositions = new Set<string>();
          
          if (tokenSize === 'large' || tokenSize === 'gargantuan') {
            // For Large and Gargantuan, we need to generate all vertices where 3 hexes meet
            // Iterate over all hex cells and generate vertices for each
            for (let col = -1; col <= maxCol + 1; col++) {
              for (let row = -1; row <= maxRow + 1; row++) {
                // For flat-top hex, each hex has 6 vertices
                // The vertices where 3 hexes meet are at specific positions
                const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
                const hexCenterX = col * horizStep + hexR;
                const hexCenterY = row * vertStep + hexH / 2 + yOffset;
                
                // Generate the 6 vertices of this hex
                // Flat-top: vertices at angles 0°, 60°, 120°, 180°, 240°, 300°
                const angle = Math.PI / 3; // 60 degrees
                for (let i = 0; i < 6; i++) {
                  const a = angle * i;
                  const vx = hexCenterX + hexR * Math.cos(a);
                  const vy = hexCenterY + hexR * Math.sin(a);
                  
                  const posKey = `${Math.round(vx * 10)},${Math.round(vy * 10)}`;
                  if (!seenPositions.has(posKey)) {
                    seenPositions.add(posKey);
                    
                    const dist = Math.sqrt((vx - cursorX) ** 2 + (vy - cursorY) ** 2);
                    
                    // For Large, all vertices are valid centers
                    // For Gargantuan, we also use vertices as valid positions
                    // (the actual center will be calculated by getTokenCenter via getCellFromPointForToken)
                    guideDots.push({ x: vx, y: vy, key: `${col}:${row}-v${i}`, distance: dist });
                  }
                }
              }
            }
          } else {
            // For Huge (center of hex)
            for (let col = 0; col <= maxCol; col++) {
              for (let row = 0; row <= maxRow; row++) {
                const cellKey = `${col}:${row}`;
                const center = getTokenCenter(cellKey, tokenSize, false, r);
                const posKey = `${Math.round(center.x * 10)},${Math.round(center.y * 10)}`;
                if (!seenPositions.has(posKey)) {
                  seenPositions.add(posKey);
                  const dist = Math.sqrt((center.x - cursorX) ** 2 + (center.y - cursorY) ** 2);
                  guideDots.push({ x: center.x, y: center.y, key: cellKey, distance: dist });
                }
              }
            }
          }
        }
        
        // Calculate intensity based on distance
        // Find max distance for normalization
        const maxDistance = Math.max(...guideDots.map(d => d.distance), 1);
        
        return (
          <>
            {guideDots.map((dot, idx) => {
              // Normalize distance: 0 (closest) to 1 (farthest)
              const normalizedDist = dot.distance / maxDistance;
              
              // Calculate opacity: closest = 0.8, farthest = 0.05
              const opacity = 0.8 - normalizedDist * 0.75;
              
              // Calculate size: closest = 7px, farthest = 2px
              const size = 7 - normalizedDist * 5;
              const halfSize = size / 2;
              
              // Calculate glow intensity: closest = 0.8, farthest = 0.05
              const glowOpacity = 0.8 - normalizedDist * 0.75;
              
              return (
                <div
                  key={`guide-${dot.key}-${idx}`}
                  style={{
                    position: 'absolute',
                    left: dot.x - halfSize,
                    top: dot.y - halfSize,
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    backgroundColor: `rgba(255, 215, 0, ${opacity})`,
                    border: '1px solid rgba(0, 0, 0, 0.5)',
                    pointerEvents: 'none',
                    boxShadow: `0 0 ${3 + (1 - normalizedDist) * 5}px rgba(255, 215, 0, ${glowOpacity})`,
                  }}
                />
              );
            })}
          </>
        );
      })()}
    </div>
  );
};

export default MapTokensOverlay;
