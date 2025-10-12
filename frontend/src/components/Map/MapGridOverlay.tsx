import React, { useEffect, useMemo, useRef, useState } from 'react';

export type GridSettings = {
  enabled: boolean;
  type: 'square' | 'hex';
  cellSize: number; // in px
  color: string; // stroke color (e.g., '#FFFFFF')
  opacity: number; // 0..1
  lineWidth: number; // in CSS px
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * MapGridOverlay
 * Draws a square or hexagonal grid over its container using Canvas.
 * It scales with devicePixelRatio for crisp rendering.
 */
const MapGridOverlay: React.FC<{ settings: GridSettings; redrawKey?: unknown; widthPx?: number; heightPx?: number }> = ({ settings, redrawKey, widthPx, heightPx }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Observe size changes
  useEffect(() => {
    if (widthPx && heightPx) {
      setSize({ w: Math.floor(widthPx), h: Math.floor(heightPx) });
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(0, Math.floor(rect.width)), h: Math.max(0, Math.floor(rect.height)) });
    });
    ro.observe(el);
    // initial
    const rect = el.getBoundingClientRect();
    setSize({ w: Math.max(0, Math.floor(rect.width)), h: Math.max(0, Math.floor(rect.height)) });
    return () => ro.disconnect();
  }, [widthPx, heightPx]);

  // Force recompute on redrawKey changes (e.g., CSS transforms like preview zoom)
  useEffect(() => {
    if (widthPx && heightPx) {
      setSize({ w: Math.floor(widthPx), h: Math.floor(heightPx) });
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({ w: Math.max(0, Math.floor(rect.width)), h: Math.max(0, Math.floor(rect.height)) });
  }, [redrawKey, widthPx, heightPx]);

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = Math.max(1, Math.floor(size.w));
    const H = Math.max(1, Math.floor(size.h));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, W, H);
    if (!settings.enabled) return;

    const color = settings.color || '#FFFFFF';
    const opacity = clamp(settings.opacity ?? 0.4, 0, 1);
    const lw = clamp(settings.lineWidth ?? 1, 0.25, 4);
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lw;
    ctx.beginPath();

    if (settings.type === 'square') {
      const step = Math.max(4, Math.floor(settings.cellSize || 40));
      // vertical lines
      for (let x = 0; x <= W; x += step) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
      }
      // horizontal lines
      for (let y = 0; y <= H; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
      }
      ctx.stroke();
    } else if (settings.type === 'hex') {
      // Flat-top hex grid: staggered columns (odd columns shifted down by h/2)
      const r = Math.max(6, Math.floor(settings.cellSize || 30)); // hex radius (center to flat)
      const w = 2 * r; // hex width
      const h = Math.sqrt(3) * r; // hex height
      const horizStep = 1.5 * r; // center-to-center horizontally
      const vertStep = h; // center-to-center vertically

      // Compute bounding rows/cols with some padding to cover edges
      const cols = Math.ceil(W / horizStep) + 3;
      const rows = Math.ceil(H / vertStep) + 3;

      const drawHex = (cx: number, cy: number) => {
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx + r / 2, cy + h / 2);
        ctx.lineTo(cx - r / 2, cy + h / 2);
        ctx.lineTo(cx - r, cy);
        ctx.lineTo(cx - r / 2, cy - h / 2);
        ctx.lineTo(cx + r / 2, cy - h / 2);
        ctx.closePath();
      };

      for (let col = -1; col < cols; col++) {
        const cx = col * horizStep + r; // start near left
        const yOffset = (col % 2 === 0) ? 0 : h / 2; // shift odd columns down
        for (let row = -1; row < rows; row++) {
          const cy = row * vertStep + h / 2 + yOffset; // start near top
          // Quick cull
          if (cx + w < 0 || cx - w > W || cy + h < 0 || cy - h > H) continue;
          drawHex(cx, cy);
        }
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }, [size.w, size.h, settings.enabled, settings.type, settings.cellSize, settings.color, settings.opacity, settings.lineWidth, dpr]);

  const style: React.CSSProperties = widthPx && heightPx
    ? { position: 'absolute', width: widthPx, height: heightPx, inset: 'auto', left: 0, top: 0, pointerEvents: 'none' }
    : { position: 'absolute', inset: 0, pointerEvents: 'none' };

  return (
    <div ref={rootRef} style={style}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default MapGridOverlay;
