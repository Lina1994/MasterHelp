import React, { useCallback, useRef, useState } from 'react';
import type { OrganicFogStroke } from '../../hooks/useOrganicFog';

export type OrganicFogTool = 'reveal' | 'fog';

/**
 * OrganicFogEditorLayer
 * Invisible overlay that captures pointer events and generates organic fog strokes.
 * While the user drags, points (normalised 0–1) are collected into a stroke.
 * On pointer-up the completed stroke is emitted via `onStrokeComplete`.
 *
 * @param widthPx - Map natural width in pixels.
 * @param heightPx - Map natural height in pixels.
 * @param tool - 'reveal' to cut fog, 'fog' to restore fog.
 * @param brushRadius - Brush radius in natural-size pixels.
 * @param onStrokeComplete - Called with the finished stroke on pointer-up.
 * @param transform - Current map transform (zoom, rotation) for coordinate correction.
 * @param previewScale - Additional scale from the preview container.
 */
const OrganicFogEditorLayer: React.FC<{
  widthPx?: number;
  heightPx?: number;
  tool: OrganicFogTool;
  brushRadius: number;
  onStrokeComplete: (stroke: OrganicFogStroke) => void;
  transform?: { zoom?: number; rotationDeg?: number };
  previewScale?: number;
}> = ({ widthPx, heightPx, tool, brushRadius, onStrokeComplete, transform, previewScale }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);

  const toNormalised = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const qx = clientX - rect.left;
    const qy = clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    let vx = qx - cx;
    let vy = qy - cy;
    const sPreview = Math.max(0.001, previewScale ?? 1);
    const sActive = Math.max(0.001, transform?.zoom ?? 1);
    const sTotal = sPreview * sActive;
    vx /= sTotal;
    vy /= sTotal;
    const theta = ((transform?.rotationDeg ?? 0) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rx = vx * cos + vy * sin;
    const ry = -vx * sin + vy * cos;
    const W = widthPx ?? rect.width;
    const H = heightPx ?? rect.height;
    const x = (W / 2 + rx) / W;
    const y = (H / 2 + ry) / H;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, [widthPx, heightPx, transform, previewScale]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    currentStrokeRef.current = [];
    const pt = toNormalised(e.clientX, e.clientY);
    if (pt) currentStrokeRef.current.push(pt);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const pt = toNormalised(e.clientX, e.clientY);
    if (pt) currentStrokeRef.current.push(pt);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const pts = currentStrokeRef.current;
    if (pts.length > 0) {
      onStrokeComplete({ points: pts, radius: brushRadius, mode: tool });
    }
    currentStrokeRef.current = [];
  };

  const style: React.CSSProperties = widthPx && heightPx
    ? { position: 'absolute', width: widthPx, height: heightPx, inset: 'auto', left: 0, top: 0, cursor: 'crosshair', touchAction: 'none' }
    : { position: 'absolute', inset: 0, cursor: 'crosshair', touchAction: 'none' };

  return (
    <div
      ref={ref}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
};

export default OrganicFogEditorLayer;
