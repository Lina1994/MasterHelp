import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapElement, MapElementType, MapWallElement, MapDoorElement, MapWindowElement, MapLightElement, TimeOfDayIntensity } from '../../api/mapElements';

export type ElementEditorTool = 'wall' | 'door' | 'window' | 'light' | 'select' | 'erase';

/**
 * MapElementsEditorLayer
 *
 * SVG overlay that lets the DM create, select and delete structural map
 * elements (walls, doors, windows, lights).
 *
 * Visible only when the elements-editing tool group is active.
 *
 * @param widthPx  Map natural width in pixels.
 * @param heightPx Map natural height in pixels.
 * @param elements Current list of map elements.
 * @param tool     Active editor sub-tool.
 * @param transform  Map visual transform (zoom, rotation).
 * @param previewScale  Preview panel scale factor.
 * @param onAddElement   Callback to add a new element.
 * @param onUpdateElement Callback to update an element by id.
 * @param onRemoveElement Callback to remove an element by id.
 * @param onSelectElement Callback when an element is selected.
 * @param newLightRadius  Default radius for new light elements.
 */
const MapElementsEditorLayer: React.FC<{
  widthPx: number;
  heightPx: number;
  elements: MapElement[];
  tool: ElementEditorTool;
  transform: { zoom: number; rotationDeg: number };
  previewScale: number;
  onAddElement: (el: MapElement) => void;
  onUpdateElement: (id: string, patch: Partial<MapElement>) => void;
  onRemoveElement: (id: string) => void;
  onSelectElement?: (el: MapElement | null) => void;
  newLightRadius?: number;
}> = ({
  widthPx,
  heightPx,
  elements,
  tool,
  transform,
  previewScale,
  onAddElement,
  onUpdateElement,
  onRemoveElement,
  onSelectElement,
  newLightRadius = 80,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [drawingOnWall, setDrawingOnWall] = useState<{
    wallId: string;
    segIndex: number;
    point: { x: number; y: number };
    t: number;
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Reset in-progress drawing when tool changes
  useEffect(() => {
    setDrawingPoints([]);
    setDrawingOnWall(null);
  }, [tool]);

  /** Generate a short unique id. */
  const uid = useCallback(() => `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, []);

  /**
   * Convert mouse event to normalised (0–1) map coordinates.
   * Uses the SVG's screen CTM to correctly invert any CSS transforms
   * (rotation, scale, translate) applied by ancestor elements.
   */
  const toNorm = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY);
    const svgPt = pt.matrixTransform(ctm.inverse());
    const x = svgPt.x / (widthPx || 1);
    const y = svgPt.y / (heightPx || 1);
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, [widthPx, heightPx]);

  /** Handle click on the SVG canvas to create new elements or interact. */
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const pt = toNorm(e);

    if (tool === 'light') {
      const defaultIntensity: TimeOfDayIntensity = { dawn: 1, morning: 1, afternoon: 1, night: 1 };
      onAddElement({
        id: uid(),
        type: 'light',
        position: pt,
        radius: newLightRadius,
        isOn: true,
        showInPreview: false,
        intensityByTimeOfDay: defaultIntensity,
      });
      return;
    }

    if (tool === 'erase') {
      // Find nearest element under cursor
      const hit = findHitElement(pt, elements, widthPx, heightPx);
      if (hit) onRemoveElement(hit.id);
      return;
    }

    if (tool === 'select') {
      const hit = findHitElement(pt, elements, widthPx, heightPx);
      onSelectElement?.(hit ?? null);
      return;
    }

    // Wall — 2 clicks (snap to existing wall endpoints for chaining)
    if (tool === 'wall') {
      let startPt = pt;
      if (drawingPoints.length === 0) {
        const snap = findNearestWallEndpoint(pt, elements, widthPx, heightPx);
        if (snap) startPt = snap;
      }
      const next = [...drawingPoints, startPt];
      if (next.length >= 2) {
        onAddElement({ id: uid(), type: 'wall', points: [next[0], next[1]] });
        setDrawingPoints([]);
        return;
      }
      setDrawingPoints(next);
      return;
    }

    // Door / Window — placed on an existing wall, splitting it
    if (tool === 'door' || tool === 'window') {
      const wallHit = findNearestWallSegment(pt, elements, widthPx, heightPx);
      if (!wallHit) return; // no wall nearby — ignore

      const a = wallHit.wall.points[wallHit.segIndex];
      const b = wallHit.wall.points[wallHit.segIndex + 1];
      const proj = projectOntoSegment(pt, a, b);

      if (!drawingOnWall) {
        // First click — mark start on wall
        setDrawingOnWall({ wallId: wallHit.wall.id, segIndex: wallHit.segIndex, point: proj.point, t: proj.t });
        return;
      }

      // Second click — must be on the same wall segment
      if (drawingOnWall.wallId !== wallHit.wall.id || drawingOnWall.segIndex !== wallHit.segIndex) {
        // Different wall/segment — restart
        setDrawingOnWall({ wallId: wallHit.wall.id, segIndex: wallHit.segIndex, point: proj.point, t: proj.t });
        return;
      }

      let t1 = drawingOnWall.t, t2 = proj.t;
      let p1 = drawingOnWall.point, p2 = proj.point;
      if (t1 > t2) { [t1, t2] = [t2, t1]; [p1, p2] = [p2, p1]; }
      if (t2 - t1 < 0.01) { setDrawingOnWall(null); return; } // too small

      // Create the door or window
      if (tool === 'door') {
        onAddElement({ id: uid(), type: 'door', points: [p1, p2] as [{ x: number; y: number }, { x: number; y: number }], isOpen: false });
      } else {
        onAddElement({ id: uid(), type: 'window', points: [p1, p2] as [{ x: number; y: number }, { x: number; y: number }], lightByTimeOfDay: { dawn: 0.3, morning: 1, afternoon: 0.7, night: 0 } });
      }

      // Split the wall around the door/window
      const wall = wallHit.wall;
      const si = wallHit.segIndex;
      onRemoveElement(wall.id);

      // Before: points[0..si] + p1
      const beforePts = [...wall.points.slice(0, si + 1), p1];
      const bFirst = beforePts[0];
      const bLast = beforePts[beforePts.length - 1];
      if (beforePts.length >= 2 && Math.hypot(bFirst.x - bLast.x, bFirst.y - bLast.y) > 0.003) {
        onAddElement({ id: uid(), type: 'wall', points: beforePts });
      }

      // After: p2 + points[si+1..end]
      const afterPts = [p2, ...wall.points.slice(si + 1)];
      const aFirst = afterPts[0];
      const aLast = afterPts[afterPts.length - 1];
      if (afterPts.length >= 2 && Math.hypot(aFirst.x - aLast.x, aFirst.y - aLast.y) > 0.003) {
        onAddElement({ id: uid(), type: 'wall', points: afterPts });
      }

      setDrawingOnWall(null);
      return;
    }
  }, [tool, drawingPoints, elements, widthPx, heightPx, onAddElement, onRemoveElement, onSelectElement, toNorm, uid, newLightRadius]);

  /** Double-click has no special behaviour currently. */
  const handleDblClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
  }, []);

  /** Right-click cancels the current drawing. */
  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (drawingPoints.length > 0) setDrawingPoints([]);
    if (drawingOnWall) setDrawingOnWall(null);
  }, [drawingPoints, drawingOnWall]);

  // Cursor style based on tool
  const cursor = useMemo(() => {
    if (tool === 'erase') return 'not-allowed';
    if (tool === 'select') return 'pointer';
    return 'crosshair';
  }, [tool]);

  const W = widthPx || 1;
  const H = heightPx || 1;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor, zIndex: 15, pointerEvents: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
      onContextMenu={handleContextMenu}
    >
      {/* Render existing elements */}
      {elements.map((el) => {
        const isHovered = el.id === hoveredId;
        if (el.type === 'wall') {
          // 2-point walls render as a line; legacy polyline walls (>2 points) use polyline
          if (el.points.length <= 2) {
            return (
              <line
                key={el.id}
                x1={el.points[0].x * W} y1={el.points[0].y * H}
                x2={(el.points[1] ?? el.points[0]).x * W} y2={(el.points[1] ?? el.points[0]).y * H}
                stroke={isHovered ? '#ff4444' : '#ffdd00'}
                strokeWidth={isHovered ? 4 : 3}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredId(el.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ pointerEvents: 'stroke' }}
              />
            );
          }
          return (
            <polyline
              key={el.id}
              points={el.points.map(p => `${p.x * W},${p.y * H}`).join(' ')}
              fill="none"
              stroke={isHovered ? '#ff4444' : '#ffdd00'}
              strokeWidth={isHovered ? 4 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              onMouseEnter={() => setHoveredId(el.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ pointerEvents: 'stroke' }}
            />
          );
        }
        if (el.type === 'door') {
          const stroke = el.isOpen ? '#44ff44' : '#ff8800';
          return (
            <line
              key={el.id}
              x1={el.points[0].x * W} y1={el.points[0].y * H}
              x2={el.points[1].x * W} y2={el.points[1].y * H}
              stroke={isHovered ? '#ff4444' : stroke}
              strokeWidth={isHovered ? 5 : 4}
              strokeLinecap="round"
              strokeDasharray={el.isOpen ? '8,6' : 'none'}
              onMouseEnter={() => setHoveredId(el.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ pointerEvents: 'stroke' }}
            />
          );
        }
        if (el.type === 'window') {
          return (
            <line
              key={el.id}
              x1={el.points[0].x * W} y1={el.points[0].y * H}
              x2={el.points[1].x * W} y2={el.points[1].y * H}
              stroke={isHovered ? '#ff4444' : '#44ddff'}
              strokeWidth={isHovered ? 5 : 4}
              strokeLinecap="round"
              strokeDasharray="4,4"
              onMouseEnter={() => setHoveredId(el.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ pointerEvents: 'stroke' }}
            />
          );
        }
        if (el.type === 'light') {
          const px = el.position.x * W;
          const py = el.position.y * H;
          return (
            <g key={el.id}
              onMouseEnter={() => setHoveredId(el.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Radius circle */}
              <circle
                cx={px} cy={py} r={el.radius}
                fill="none"
                stroke={el.isOn ? (el.color || '#ffee55') : '#888888'}
                strokeWidth={isHovered ? 2 : 1}
                strokeDasharray="6,4"
                opacity={0.5}
              />
              {/* Center point */}
              <circle
                cx={px} cy={py} r={isHovered ? 8 : 6}
                fill={el.isOn ? (el.color || '#ffee55') : '#888888'}
                stroke="#000"
                strokeWidth={1}
              />
              {el.label && (
                <text
                  x={px} y={py - 12}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={0.5}
                >
                  {el.label}
                </text>
              )}
            </g>
          );
        }
        return null;
      })}

      {/* In-progress start point while drawing walls */}
      {drawingPoints.length > 0 && (
        <circle
          cx={drawingPoints[0].x * W}
          cy={drawingPoints[0].y * H}
          r={5}
          fill="#00ff88"
          stroke="#000"
          strokeWidth={1}
          pointerEvents="none"
        />
      )}

      {/* In-progress first point while placing door/window on a wall */}
      {drawingOnWall && (
        <circle
          cx={drawingOnWall.point.x * W}
          cy={drawingOnWall.point.y * H}
          r={5}
          fill={tool === 'door' ? '#ff8800' : '#44ddff'}
          stroke="#000"
          strokeWidth={1}
          pointerEvents="none"
        />
      )}
    </svg>
  );
};

/**
 * Simple hit-test: find the element closest to the given normalised point.
 * For lines checks distance to each segment; for lights checks distance to center.
 */
function findHitElement(
  pt: { x: number; y: number },
  elements: MapElement[],
  mapW: number,
  mapH: number,
): MapElement | null {
  const hitThreshold = 15 / Math.max(mapW, mapH); // ~15px at natural size
  let best: MapElement | null = null;
  let bestDist = Infinity;

  for (const el of elements) {
    let dist = Infinity;
    if (el.type === 'light') {
      dist = Math.hypot(pt.x - el.position.x, pt.y - el.position.y);
    } else {
      const pts = el.type === 'wall' ? el.points : el.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = distToSegment(pt, pts[i], pts[i + 1]);
        if (d < dist) dist = d;
      }
      if (pts.length === 1) {
        dist = Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y);
      }
    }
    if (dist < hitThreshold && dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }
  return best;
}

/** Distance from point p to line segment a→b in normalised coords. */
function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export default MapElementsEditorLayer;

/**
 * Project a normalised point onto a line segment a→b.
 * Returns the projected point and the parametric t value (0–1).
 */
function projectOntoSegment(
  pt: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): { point: { x: number; y: number }; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: { ...a }, t: 0 };
  let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { point: { x: a.x + t * dx, y: a.y + t * dy }, t };
}

/**
 * Find the nearest wall segment to a normalised point.
 * Returns the wall element and the segment index, or null.
 */
function findNearestWallSegment(
  pt: { x: number; y: number },
  elements: MapElement[],
  mapW: number,
  mapH: number,
): { wall: MapWallElement; segIndex: number } | null {
  const threshold = 15 / Math.max(mapW, mapH);
  let best: { wall: MapWallElement; segIndex: number } | null = null;
  let bestDist = Infinity;
  for (const el of elements) {
    if (el.type !== 'wall') continue;
    for (let i = 0; i < el.points.length - 1; i++) {
      const d = distToSegment(pt, el.points[i], el.points[i + 1]);
      if (d < threshold && d < bestDist) {
        bestDist = d;
        best = { wall: el as MapWallElement, segIndex: i };
      }
    }
  }
  return best;
}

/**
 * Find the nearest endpoint of any existing wall within a snap threshold.
 * Returns the snapped normalised coordinate or null if nothing is close enough.
 */
function findNearestWallEndpoint(
  pt: { x: number; y: number },
  elements: MapElement[],
  mapW: number,
  mapH: number,
): { x: number; y: number } | null {
  const threshold = 12 / Math.max(mapW, mapH); // ~12px at natural size
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;

  for (const el of elements) {
    if (el.type !== 'wall') continue;
    for (const p of el.points) {
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < threshold && d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
  }
  return best;
}
