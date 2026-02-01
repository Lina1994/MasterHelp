import React, { useEffect, useMemo, useRef } from 'react';
import type { GridSettings } from './MapGridOverlay';

export type FogMode = 'master' | 'players';

/** Draw fog cells over the map using Canvas. */
const FogOfWarOverlay: React.FC<{
  mode: FogMode;
  grid: GridSettings;
  widthPx?: number;
  heightPx?: number;
  cells: Set<string>;
  /** Optional: customize the master-preview shading (ignored in players mode). */
  masterColor?: string;
  /** Optional: customize the master-preview shading opacity (0..1, ignored in players mode). */
  masterOpacity?: number;
}>
= ({ mode, grid, widthPx, heightPx, cells, masterColor = '#000000', masterOpacity = 0.35 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const size = useMemo(() => ({ w: Math.max(1, Math.floor(widthPx || 0)), h: Math.max(1, Math.floor(heightPx || 0)) }), [widthPx, heightPx]);

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

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (mode === 'players') {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgb(0,0,0)';
    } else {
      ctx.globalAlpha = effectiveMasterOpacity;
      ctx.fillStyle = masterColor;
    }

    if (grid.type === 'square') {
      const step = Math.max(4, Math.floor(grid.cellSize || 40));
      for (const key of cells) {
        const [cs, rs] = key.split(':').map(n => parseInt(n, 10));
        const x = cs * step;
        const y = rs * step;
        ctx.fillRect(x, y, step, step);
      }
    } else {
      const r = Math.max(6, Math.floor(grid.cellSize || 30));
      const h = Math.sqrt(3) * r; // hex height
      const w = 2 * r;
      const horizStep = 1.5 * r;
      const vertStep = h;
      for (const key of cells) {
        const [col, row] = key.split(':').map(n => parseInt(n, 10));
        const cx = col * horizStep + r;
        const yOffset = (col % 2 === 0) ? 0 : h / 2;
        const cy = row * vertStep + h / 2 + yOffset;
        ctx.beginPath();
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx + r / 2, cy + h / 2);
        ctx.lineTo(cx - r / 2, cy + h / 2);
        ctx.lineTo(cx - r, cy);
        ctx.lineTo(cx - r / 2, cy - h / 2);
        ctx.lineTo(cx + r / 2, cy - h / 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }, [size.w, size.h, grid.enabled, grid.type, grid.cellSize, mode, cells, dpr, masterColor, effectiveMasterOpacity]);

  const style: React.CSSProperties = widthPx && heightPx
    ? { position: 'absolute', width: widthPx, height: heightPx, inset: 'auto', left: 0, top: 0, pointerEvents: 'none' }
    : { position: 'absolute', inset: 0, pointerEvents: 'none' };

  return (
    <div style={style}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default FogOfWarOverlay;
