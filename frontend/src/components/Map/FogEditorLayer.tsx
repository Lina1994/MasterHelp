import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GridSettings } from './MapGridOverlay';

export type FogTool = 'paint' | 'erase';

function squareCellFromPoint(x: number, y: number, step: number) {
  const c = Math.floor(x / step);
  const r = Math.floor(y / step);
  return `${c}:${r}`;
}

function hexCellFromPoint(x: number, y: number, r: number) {
  // Approximate flat-top hex grid mapping.
  const h = Math.sqrt(3) * r;
  const horizStep = 1.5 * r;
  const vertStep = h;
  const col = Math.round((x - r) / horizStep);
  const yOffset = (col % 2 === 0) ? 0 : h / 2;
  const row = Math.round((y - h / 2 - yOffset) / vertStep);
  return `${col}:${row}`;
}

const FogEditorLayer: React.FC<{
  grid: GridSettings;
  widthPx?: number;
  heightPx?: number;
  tool: FogTool;
  onToggleCell: (key: string, add: boolean) => void;
  transform?: { zoom?: number; rotationDeg?: number };
  previewScale?: number;
}>
= ({ grid, widthPx, heightPx, tool, onToggleCell, transform, previewScale }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<boolean>(false);

  const step = useMemo(() => Math.max(4, Math.floor(grid.cellSize || 40)), [grid.cellSize]);

  const handlePoint = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Coordinates relative to element's bounding box
    const qx = clientX - rect.left;
    const qy = clientY - rect.top;
    // Undo applied rotation/scale using bounding box center
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    let vx = qx - cx;
    let vy = qy - cy;
    const sPreview = Math.max(0.001, (previewScale ?? 1));
    const sActive = Math.max(0.001, (transform?.zoom ?? 1));
    const sTotal = sPreview * sActive;
    vx /= sTotal; vy /= sTotal;
    const theta = ((transform?.rotationDeg ?? 0) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rx = vx * cos + vy * sin;
    const ry = -vx * sin + vy * cos;
    const x = (widthPx ?? rect.width) / 2 + rx;
    const y = (heightPx ?? rect.height) / 2 + ry;
    let key: string | null = null;
    if (grid.type === 'square') key = squareCellFromPoint(x, y, step);
    else key = hexCellFromPoint(x, y, Math.max(6, Math.floor(grid.cellSize || 30)));
    if (key) onToggleCell(key, tool === 'paint');
  }, [grid.type, grid.cellSize, step, onToggleCell, tool]);

  const onMouseDown = (e: React.MouseEvent) => { if (!grid.enabled) return; setDragging(true); handlePoint(e.clientX, e.clientY); };
  const onMouseMove = (e: React.MouseEvent) => { if (!grid.enabled || !dragging) return; handlePoint(e.clientX, e.clientY); };
  const onMouseUp = () => setDragging(false);
  const onMouseLeave = () => setDragging(false);

  const style: React.CSSProperties = widthPx && heightPx
    ? { position: 'absolute', width: widthPx, height: heightPx, inset: 'auto', left: 0, top: 0, cursor: tool === 'paint' ? 'crosshair' : 'not-allowed' }
    : { position: 'absolute', inset: 0, cursor: tool === 'paint' ? 'crosshair' : 'not-allowed' };

  return (
    <div ref={ref} style={style} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} />
  );
};

export default FogEditorLayer;
