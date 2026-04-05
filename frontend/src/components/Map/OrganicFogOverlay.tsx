import React, { useEffect, useMemo, useRef } from 'react';
import type { OrganicFogStroke } from '../../hooks/useOrganicFog';

export type OrganicFogMode = 'master' | 'players';

/**
 * OrganicFogOverlay
 * Canvas overlay that renders brush-based organic fog.
 * The entire map starts fogged; 'reveal' strokes cut holes and 'fog' strokes restore fog.
 *
 * @param mode - 'master' shows semi-transparent preview, 'players' shows opaque black.
 * @param widthPx - Map natural width in pixels.
 * @param heightPx - Map natural height in pixels.
 * @param strokes - Ordered array of organic fog strokes to replay.
 * @param masterColor - Fog colour for master preview (ignored in players mode).
 * @param masterOpacity - Fog opacity for master preview (ignored in players mode).
 */
const OrganicFogOverlay: React.FC<{
  mode: OrganicFogMode;
  widthPx?: number;
  heightPx?: number;
  strokes: OrganicFogStroke[];
  masterColor?: string;
  masterOpacity?: number;
}> = ({ mode, widthPx, heightPx, strokes, masterColor = '#000000', masterOpacity = 0.35 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const size = useMemo(
    () => ({ w: Math.max(1, Math.floor(widthPx || 0)), h: Math.max(1, Math.floor(heightPx || 0)) }),
    [widthPx, heightPx],
  );

  const effectiveMasterOpacity = useMemo(() => {
    const v = Number(masterOpacity);
    if (!Number.isFinite(v)) return 0.35;
    return Math.max(0, Math.min(1, v));
  }, [masterOpacity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = Math.max(1, size.w);
    const H = Math.max(1, size.h);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Start with full fog coverage
    if (mode === 'players') {
      ctx.fillStyle = 'rgb(0,0,0)';
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = masterColor;
      ctx.globalAlpha = effectiveMasterOpacity;
    }
    ctx.fillRect(0, 0, W, H);

    // Replay strokes
    for (const stroke of strokes) {
      const pts = stroke.points;
      const r = stroke.radius;

      if (pts.length === 0) continue;

      if (stroke.mode === 'reveal') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        // Soft feathered edge — smaller for filled polygons to keep wall precision
        const feather = stroke.fill
          ? Math.max(3, Math.min(14, Math.round(r * 0.035)))
          : Math.max(4, Math.round(r * 0.25));
        ctx.filter = `blur(${feather}px)`;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        if (mode === 'players') {
          ctx.fillStyle = 'rgb(0,0,0)';
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = masterColor;
          ctx.globalAlpha = effectiveMasterOpacity;
        }
      }

      // ── Filled polygon (visibility polygon from lights / allies) ───────
      if (stroke.fill && pts.length > 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * W, pts[0].y * H);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * W, pts[i].y * H);
        }
        ctx.closePath();
        ctx.fill();
        continue;
      }

      if (pts.length === 1) {
        // Single point: draw a circle
        ctx.beginPath();
        ctx.arc(pts[0].x * W, pts[0].y * H, r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // Draw thick line segments between consecutive points, then circles at each point
      ctx.lineWidth = r * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * W, pts[0].y * H);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * W, pts[i].y * H);
      }
      ctx.stroke();
    }

    // Reset composite operation & filter
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
  }, [size.w, size.h, mode, strokes, dpr, masterColor, effectiveMasterOpacity]);

  const style: React.CSSProperties = widthPx && heightPx
    ? { position: 'absolute', width: widthPx, height: heightPx, inset: 'auto', left: 0, top: 0, pointerEvents: 'none' }
    : { position: 'absolute', inset: 0, pointerEvents: 'none' };

  return (
    <div style={style}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default OrganicFogOverlay;
