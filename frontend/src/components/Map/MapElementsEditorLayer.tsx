import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, FormControlLabel, Popover, Stack, Switch, TextField, Typography } from '@mui/material';
import type { MapElement, MapElementType, MapWallElement, MapDoorElement, MapWindowElement, MapLightElement, MapSoundSourceElement, TimeOfDayIntensity } from '../../api/mapElements';

export type ElementEditorTool = 'wall' | 'door' | 'window' | 'light' | 'sound' | 'select' | 'erase' | 'room';

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
  newSoundRadius?: number;
  /** Callback to open the sound-source picker for the given element. */
  onPickSoundSource?: (elementId: string) => void;
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
  newSoundRadius = 200,
  onPickSoundSource,
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
  /** Element being edited inline via popover (id + screen anchor position). */
  const [editingElementPopover, setEditingElementPopover] = useState<{
    elementId: string;
    anchorPosition: { top: number; left: number };
  } | null>(null);
  /** Tracks the light whose radius is being dragged. */
  const [draggingRadiusId, setDraggingRadiusId] = useState<string | null>(null);
  /** Wall whose endpoints are shown (mouse is hovering over it). */
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  /** Tracks a wall endpoint being dragged: wall id + point index. */
  const [draggingWallPt, setDraggingWallPt] = useState<{
    wallId: string;
    ptIndex: number;
  } | null>(null);
  /** Room tool drag: start and current opposite corners of the rectangle. */
  const [roomDrag, setRoomDrag] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);

  // Reset in-progress drawing when tool changes
  useEffect(() => {
    setDrawingPoints([]);
    setDrawingOnWall(null);
    setEditingElementPopover(null);
    setRoomDrag(null);
  }, [tool]);

  /** Resolve the element currently being edited (keeps data fresh). */
  const editingElement = useMemo(() => {
    if (!editingElementPopover) return null;
    return elements.find((el) => el.id === editingElementPopover.elementId) ?? null;
  }, [editingElementPopover, elements]);

  /** Close the element-edit popover. */
  const closeElementPopover = useCallback(() => setEditingElementPopover(null), []);

  /**
   * Convert a native PointerEvent to SVG-space pixel coordinates.
   * Used for radius drag (not normalised – we need px distance).
   */
  const toSvgPx = useCallback((e: PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  /** Start dragging a light's radius ring. */
  const handleRadiusDragStart = useCallback((e: React.PointerEvent, lightId: string) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    setDraggingRadiusId(lightId);
  }, []);

  /** While dragging, update the light/sound radius to match pointer distance from center. */
  const handleRadiusDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRadiusId) return;
    const el = elements.find((el) => el.id === draggingRadiusId && (el.type === 'light' || el.type === 'sound'));
    if (!el || (el.type !== 'light' && el.type !== 'sound')) return;
    const W = widthPx || 1;
    const H = heightPx || 1;
    const svgPt = toSvgPx(e.nativeEvent);
    const cx = el.position.x * W;
    const cy = el.position.y * H;
    const newRadius = Math.max(10, Math.min(2000, Math.round(Math.hypot(svgPt.x - cx, svgPt.y - cy))));
    onUpdateElement(draggingRadiusId, { radius: newRadius } as any);
  }, [draggingRadiusId, elements, widthPx, heightPx, toSvgPx, onUpdateElement]);

  /** End radius drag. */
  const handleRadiusDragEnd = useCallback(() => {
    setDraggingRadiusId(null);
  }, []);

  /** Start dragging a wall endpoint. */
  const handleWallPtDragStart = useCallback((e: React.PointerEvent, wallId: string, ptIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    setDraggingWallPt({ wallId, ptIndex });
  }, []);

  /** While dragging, update the wall point to match the pointer. */
  const handleWallPtDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingWallPt) return;
    const wall = elements.find((el): el is MapWallElement => el.id === draggingWallPt.wallId && el.type === 'wall');
    if (!wall) return;
    const svgPt = toSvgPx(e.nativeEvent);
    const W = widthPx || 1;
    const H = heightPx || 1;
    const nx = Math.max(0, Math.min(1, svgPt.x / W));
    const ny = Math.max(0, Math.min(1, svgPt.y / H));

    // Snap to nearby wall endpoint (excluding the wall being dragged)
    const snapThreshold = 12 / Math.max(W, H);
    let snapped = { x: nx, y: ny };
    let bestDist = Infinity;
    for (const el of elements) {
      if (el.type !== 'wall' && el.type !== 'door' && el.type !== 'window') continue;
      if (el.id === draggingWallPt.wallId) continue;
      for (const p of el.points) {
        const d = Math.hypot(snapped.x - p.x, snapped.y - p.y);
        if (d < snapThreshold && d < bestDist) {
          bestDist = d;
          snapped = { x: p.x, y: p.y };
        }
      }
    }

    const newPoints = [...wall.points];
    newPoints[draggingWallPt.ptIndex] = snapped;
    onUpdateElement(draggingWallPt.wallId, { points: newPoints } as any);
  }, [draggingWallPt, elements, widthPx, heightPx, toSvgPx, onUpdateElement]);

  /** End wall point drag. */
  const handleWallPtDragEnd = useCallback(() => {
    setDraggingWallPt(null);
  }, []);

  /** Helper to open the element-edit popover anchored at a line element's midpoint. */
  const openElementPopover = useCallback((e: React.MouseEvent, el: MapElement) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const W = widthPx || 1;
    const H = heightPx || 1;
    let px: number, py: number;
    if (el.type === 'light' || el.type === 'sound') {
      px = el.position.x * W;
      py = el.position.y * H;
    } else if (el.type === 'door' || el.type === 'window') {
      px = ((el.points[0].x + el.points[1].x) / 2) * W;
      py = ((el.points[0].y + el.points[1].y) / 2) * H;
    } else {
      return;
    }
    const screenPt = new DOMPoint(px, py).matrixTransform(ctm);
    setEditingElementPopover({ elementId: el.id, anchorPosition: { top: screenPt.y, left: screenPt.x } });
    onSelectElement?.(el);
  }, [widthPx, heightPx, onSelectElement]);

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

    if (tool === 'sound') {
      onAddElement({
        id: uid(),
        type: 'sound',
        position: pt,
        radius: newSoundRadius,
        isOn: false,
        showInPreview: false,
        volume: 1,
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
  }, [tool, drawingPoints, drawingOnWall, elements, widthPx, heightPx, onAddElement, onRemoveElement, onSelectElement, toNorm, uid, newLightRadius]);

  /** Double-click has no special behaviour currently. */
  const handleDblClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
  }, []);

  /** Right-click cancels the current drawing. */
  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (drawingPoints.length > 0) setDrawingPoints([]);
    if (drawingOnWall) setDrawingOnWall(null);
    if (roomDrag) setRoomDrag(null);
  }, [drawingPoints, drawingOnWall, roomDrag]);

  /** Handle pointer-down on the SVG canvas (room tool drag start). */
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    if (tool === 'room' && e.button === 0) {
      e.preventDefault();
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      const pt = toNorm(e);
      const snap = findNearestWallEndpoint(pt, elements, widthPx, heightPx);
      const start = snap ?? pt;
      setRoomDrag({ start, current: start });
    }
  }, [tool, toNorm, elements, widthPx, heightPx]);

  /** Handle pointer-move on the SVG canvas (room tool drag preview). */
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (roomDrag) {
      const pt = toNorm(e);
      setRoomDrag((prev) => prev ? { ...prev, current: pt } : null);
    }
  }, [roomDrag, toNorm]);

  /** Handle pointer-up on the SVG canvas (room tool creation). */
  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (roomDrag) {
      const pt = toNorm(e);
      const snap = findNearestWallEndpoint(pt, elements, widthPx, heightPx);
      const finalEnd = snap ?? pt;
      const wallSegments = computeRoomWalls(roomDrag.start, finalEnd, elements);
      for (const [p1, p2] of wallSegments) {
        onAddElement({ id: uid(), type: 'wall', points: [p1, p2] });
      }
      setRoomDrag(null);
    }
  }, [roomDrag, toNorm, elements, widthPx, heightPx, uid, onAddElement]);

  // Cursor style based on tool
  const cursor = useMemo(() => {
    if (tool === 'erase') return 'not-allowed';
    if (tool === 'select') return 'pointer';
    return 'crosshair';
  }, [tool]);

  const W = widthPx || 1;
  const H = heightPx || 1;

  return (
    <>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor, zIndex: 15, pointerEvents: 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
      onContextMenu={handleContextMenu}
    >
      {/* Render existing elements */}
      {elements.map((el) => {
        const isHovered = el.id === hoveredId;
        if (el.type === 'wall') {
          const showHandles = tool === 'select' && (el.id === hoveredWallId || (draggingWallPt?.wallId === el.id));
          // 2-point walls render as a line; legacy polyline walls (>2 points) use polyline
          if (el.points.length <= 2) {
            return (
              <g key={el.id}>
                <line
                  x1={el.points[0].x * W} y1={el.points[0].y * H}
                  x2={(el.points[1] ?? el.points[0]).x * W} y2={(el.points[1] ?? el.points[0]).y * H}
                  stroke={isHovered ? '#ff4444' : '#ffdd00'}
                  strokeWidth={isHovered ? 4 : 3}
                  strokeLinecap="round"
                  onMouseEnter={() => { setHoveredId(el.id); if (tool === 'select') setHoveredWallId(el.id); }}
                  onMouseLeave={() => { if (!draggingWallPt || draggingWallPt.wallId !== el.id) { setHoveredId(null); setHoveredWallId(null); } }}
                  style={{ pointerEvents: 'stroke' }}
                />
                {showHandles && el.points.map((p, idx) => (
                  <circle
                    key={`${el.id}-pt-${idx}`}
                    cx={p.x * W} cy={p.y * H} r={7}
                    fill="#fff"
                    stroke="#ffdd00"
                    strokeWidth={2}
                    style={{ cursor: 'grab', pointerEvents: 'auto' }}
                    onPointerDown={(e) => handleWallPtDragStart(e, el.id, idx)}
                    onPointerMove={handleWallPtDragMove}
                    onPointerUp={handleWallPtDragEnd}
                  />
                ))}
              </g>
            );
          }
          return (
            <g key={el.id}>
              <polyline
                points={el.points.map(p => `${p.x * W},${p.y * H}`).join(' ')}
                fill="none"
                stroke={isHovered ? '#ff4444' : '#ffdd00'}
                strokeWidth={isHovered ? 4 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                onMouseEnter={() => { setHoveredId(el.id); if (tool === 'select') setHoveredWallId(el.id); }}
                onMouseLeave={() => { if (!draggingWallPt || draggingWallPt.wallId !== el.id) { setHoveredId(null); setHoveredWallId(null); } }}
                style={{ pointerEvents: 'stroke' }}
              />
              {showHandles && el.points.map((p, idx) => (
                <circle
                  key={`${el.id}-pt-${idx}`}
                  cx={p.x * W} cy={p.y * H} r={7}
                  fill="#fff"
                  stroke="#ffdd00"
                  strokeWidth={2}
                  style={{ cursor: 'grab', pointerEvents: 'auto' }}
                  onPointerDown={(e) => handleWallPtDragStart(e, el.id, idx)}
                  onPointerMove={handleWallPtDragMove}
                  onPointerUp={handleWallPtDragEnd}
                />
              ))}
            </g>
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
              style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              onClick={(e) => openElementPopover(e, el)}
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
              style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              onClick={(e) => openElementPopover(e, el)}
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
              style={{ cursor: 'pointer' }}
              onClick={(e) => openElementPopover(e, el)}
            >
              {/* Radius circle — draggable to resize */}
              <circle
                cx={px} cy={py} r={el.radius}
                fill="none"
                stroke={el.isOn ? (el.color || '#ffee55') : '#888888'}
                strokeWidth={draggingRadiusId === el.id ? 4 : isHovered ? 3 : 1}
                strokeDasharray="6,4"
                opacity={draggingRadiusId === el.id ? 0.9 : 0.5}
                style={{ cursor: 'ew-resize', pointerEvents: 'stroke' }}
                onPointerDown={(e) => handleRadiusDragStart(e, el.id)}
                onPointerMove={handleRadiusDragMove}
                onPointerUp={handleRadiusDragEnd}
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
        if (el.type === 'sound') {
          const px = el.position.x * W;
          const py = el.position.y * H;
          const color = el.isOn ? '#bb66ff' : '#888888';
          return (
            <g key={el.id}
              onMouseEnter={() => setHoveredId(el.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer' }}
              onClick={(e) => openElementPopover(e, el)}
            >
              {/* Radius circle — draggable to resize */}
              <circle
                cx={px} cy={py} r={el.radius}
                fill="none"
                stroke={color}
                strokeWidth={draggingRadiusId === el.id ? 4 : isHovered ? 3 : 1}
                strokeDasharray="6,4"
                opacity={draggingRadiusId === el.id ? 0.9 : 0.5}
                style={{ cursor: 'ew-resize', pointerEvents: 'stroke' }}
                onPointerDown={(e) => handleRadiusDragStart(e, el.id)}
                onPointerMove={handleRadiusDragMove}
                onPointerUp={handleRadiusDragEnd}
              />
              {/* Musical note icon */}
              <circle
                cx={px} cy={py} r={isHovered ? 10 : 8}
                fill={color}
                stroke="#000"
                strokeWidth={1}
                opacity={0.35}
              />
              <text
                x={px} y={py + 5}
                textAnchor="middle"
                fontSize={14}
                fill={color}
                stroke="#000"
                strokeWidth={0.4}
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                ♪
              </text>
              {el.label && (
                <text
                  x={px} y={py - 14}
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

      {/* Room tool: preview rectangle while dragging */}
      {roomDrag && (
        <rect
          x={Math.min(roomDrag.start.x, roomDrag.current.x) * W}
          y={Math.min(roomDrag.start.y, roomDrag.current.y) * H}
          width={Math.abs(roomDrag.current.x - roomDrag.start.x) * W}
          height={Math.abs(roomDrag.current.y - roomDrag.start.y) * H}
          fill="none"
          stroke="#00ff88"
          strokeWidth={2}
          strokeDasharray="8,4"
          pointerEvents="none"
        />
      )}
    </svg>

    {/* ─── Element-edit popover (doors, windows, lights) ─────────── */}
    <Popover
      open={!!editingElement}
      anchorReference="anchorPosition"
      anchorPosition={editingElementPopover?.anchorPosition}
      onClose={closeElementPopover}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{ paper: { sx: { p: 2, minWidth: 220 } } }}
    >
      {editingElement && editingElement.type === 'light' && (() => {
        const light = editingElement as MapLightElement;
        return (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Editar fuente de luz</Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={light.showInPreview}
                  onChange={(e) => onUpdateElement(light.id, { showInPreview: e.target.checked } as any)}
                  size="small"
                />
              }
              label="Visible fuera de edición"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={light.isOn}
                  onChange={(e) => onUpdateElement(light.id, { isOn: e.target.checked } as any)}
                  size="small"
                />
              }
              label="Encendida"
            />

            <TextField
              size="small"
              label="Nombre"
              value={light.label || ''}
              onChange={(e) => onUpdateElement(light.id, { label: e.target.value } as any)}
            />

            <TextField
              size="small"
              type="number"
              label="Radio de niebla (px)"
              value={light.radius}
              inputProps={{ min: 10, max: 2000, step: 10 }}
              onChange={(e) => onUpdateElement(light.id, { radius: Math.max(10, Number(e.target.value || 80)) } as any)}
            />

            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => {
                onRemoveElement(light.id);
                onSelectElement?.(null);
                closeElementPopover();
              }}
            >
              Eliminar luz
            </Button>
          </Stack>
        );
      })()}

      {editingElement && editingElement.type === 'door' && (() => {
        const door = editingElement as MapDoorElement;
        return (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Editar puerta</Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={!!door.showInPreview}
                  onChange={(e) => onUpdateElement(door.id, { showInPreview: e.target.checked } as any)}
                  size="small"
                />
              }
              label="Visible fuera de edición"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={door.isOpen}
                  onChange={(e) => onUpdateElement(door.id, { isOpen: e.target.checked } as any)}
                  size="small"
                />
              }
              label="Puerta abierta"
            />

            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => {
                onRemoveElement(door.id);
                onSelectElement?.(null);
                closeElementPopover();
              }}
            >
              Eliminar puerta
            </Button>
          </Stack>
        );
      })()}

      {editingElement && editingElement.type === 'window' && (() => {
        const win = editingElement as MapWindowElement;
        return (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Editar ventana</Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={!!win.showInPreview}
                  onChange={(e) => onUpdateElement(win.id, { showInPreview: e.target.checked } as any)}
                  size="small"
                />
              }
              label="Visible fuera de edición"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={!!win.covered}
                  onChange={(e) => onUpdateElement(win.id, { covered: e.target.checked } as any)}
                  size="small"
                />
              }
              label="Ventana tapada"
            />

            <Typography variant="caption" color="text.secondary">Luz pasante por momento del día</Typography>
            {(['dawn', 'morning', 'afternoon', 'night'] as const).map((tod) => (
              <TextField
                key={tod}
                size="small"
                type="number"
                label={tod === 'dawn' ? 'Madrugada' : tod === 'morning' ? 'Mañana' : tod === 'afternoon' ? 'Tarde' : 'Noche'}
                value={win.lightByTimeOfDay?.[tod] ?? 0}
                inputProps={{ min: 0, max: 1, step: 0.1 }}
                onChange={(e) => {
                  const prev = win.lightByTimeOfDay || { dawn: 0.3, morning: 1, afternoon: 0.7, night: 0 };
                  onUpdateElement(win.id, { lightByTimeOfDay: { ...prev, [tod]: Math.max(0, Math.min(1, Number(e.target.value || 0))) } } as any);
                }}
              />
            ))}

            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => {
                onRemoveElement(win.id);
                onSelectElement?.(null);
                closeElementPopover();
              }}
            >
              Eliminar ventana
            </Button>
          </Stack>
        );
      })()}

      {editingElement && editingElement.type === 'sound' && (() => {
        const snd = editingElement as MapSoundSourceElement;
        return (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Editar fuente de sonido</Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={snd.showInPreview}
                  onChange={(e) => onUpdateElement(snd.id, { showInPreview: e.target.checked } as any)}
                  size="small"
                />
              }
              label="Visible fuera de edición"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={snd.isOn}
                  onChange={(e) => onUpdateElement(snd.id, { isOn: e.target.checked } as any)}
                  size="small"
                />
              }
              label="Activada"
            />

            <TextField
              size="small"
              label="Nombre"
              value={snd.label || ''}
              onChange={(e) => onUpdateElement(snd.id, { label: e.target.value } as any)}
            />

            <TextField
              size="small"
              type="number"
              label="Radio de alcance (px)"
              value={snd.radius}
              inputProps={{ min: 10, max: 2000, step: 10 }}
              onChange={(e) => onUpdateElement(snd.id, { radius: Math.max(10, Number(e.target.value || 200)) } as any)}
            />

            <TextField
              size="small"
              type="number"
              label="Volumen base (%)"
              value={Math.round((snd.volume ?? 1) * 100)}
              inputProps={{ min: 0, max: 100, step: 5 }}
              onChange={(e) => onUpdateElement(snd.id, { volume: Math.max(0, Math.min(1, Number(e.target.value || 100) / 100)) } as any)}
            />

            {snd.sourceName && (
              <Typography variant="caption" color="text.secondary">
                Fuente: {snd.sourceName}
              </Typography>
            )}

            <Button
              size="small"
              variant="outlined"
              onClick={() => onPickSoundSource?.(snd.id)}
            >
              {snd.sourceId ? 'Cambiar fuente de audio' : 'Asignar fuente de audio'}
            </Button>

            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => {
                onRemoveElement(snd.id);
                onSelectElement?.(null);
                closeElementPopover();
              }}
            >
              Eliminar fuente de sonido
            </Button>
          </Stack>
        );
      })()}
    </Popover>
    </>
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
    if (el.type === 'light' || el.type === 'sound') {
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

/**
 * Compute wall segments needed to form a rectangular room, excluding
 * portions already covered by existing collinear walls.
 *
 * @param start  One corner of the rectangle (normalised 0–1 coords).
 * @param end    Opposite corner of the rectangle (normalised 0–1 coords).
 * @param elements  All current map elements.
 * @returns Array of [p1, p2] point pairs for new wall segments to create.
 */
function computeRoomWalls(
  start: { x: number; y: number },
  end: { x: number; y: number },
  elements: MapElement[],
): [{ x: number; y: number }, { x: number; y: number }][] {
  if (Math.abs(end.x - start.x) < 0.005 || Math.abs(end.y - start.y) < 0.005) return [];

  const a = { x: start.x, y: start.y };
  const b = { x: end.x, y: start.y };
  const c = { x: end.x, y: end.y };
  const d = { x: start.x, y: end.y };

  const sides: [{ x: number; y: number }, { x: number; y: number }][] = [
    [a, b], [b, c], [c, d], [d, a],
  ];

  const existingWalls = elements.filter((el): el is MapWallElement => el.type === 'wall');
  const result: [{ x: number; y: number }, { x: number; y: number }][] = [];

  for (const [p1, p2] of sides) {
    const uncovered = computeUncoveredIntervals(p1, p2, existingWalls);
    for (const [t1, t2] of uncovered) {
      result.push([
        { x: p1.x + t1 * (p2.x - p1.x), y: p1.y + t1 * (p2.y - p1.y) },
        { x: p1.x + t2 * (p2.x - p1.x), y: p1.y + t2 * (p2.y - p1.y) },
      ]);
    }
  }

  return result;
}

/**
 * For a desired wall segment p1→p2, find the parametric intervals NOT
 * already covered by existing collinear walls.
 *
 * @returns Array of [tStart, tEnd] intervals in the 0–1 parametric range.
 */
function computeUncoveredIntervals(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  walls: MapWallElement[],
): [number, number][] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [];

  const ux = dx / len;
  const uy = dy / len;
  const perpThreshold = 0.008; // max perpendicular distance in normalised coords

  const covered: [number, number][] = [];

  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const wa = wall.points[i];
      const wb = wall.points[i + 1];

      // Check collinearity via perpendicular distance to the line through p1–p2
      const perpA = Math.abs((wa.x - p1.x) * (-uy) + (wa.y - p1.y) * ux);
      const perpB = Math.abs((wb.x - p1.x) * (-uy) + (wb.y - p1.y) * ux);
      if (perpA > perpThreshold || perpB > perpThreshold) continue;

      // Project onto the side to get parametric t-values
      const tA = ((wa.x - p1.x) * ux + (wa.y - p1.y) * uy) / len;
      const tB = ((wb.x - p1.x) * ux + (wb.y - p1.y) * uy) / len;
      const tMin = Math.max(0, Math.min(tA, tB));
      const tMax = Math.min(1, Math.max(tA, tB));

      if (tMax > tMin + 0.001) {
        covered.push([tMin, tMax]);
      }
    }
  }

  if (covered.length === 0) return [[0, 1]];

  // Sort and merge overlapping intervals
  covered.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [covered[0]];
  for (let i = 1; i < covered.length; i++) {
    const last = merged[merged.length - 1];
    if (covered[i][0] <= last[1] + 0.001) {
      last[1] = Math.max(last[1], covered[i][1]);
    } else {
      merged.push(covered[i]);
    }
  }

  // Find uncovered gaps in [0, 1]
  const uncovered: [number, number][] = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor + 0.001) {
      uncovered.push([cursor, s]);
    }
    cursor = Math.max(cursor, e);
  }
  if (cursor < 1 - 0.001) {
    uncovered.push([cursor, 1]);
  }

  return uncovered;
}
