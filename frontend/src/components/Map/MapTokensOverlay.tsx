import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { GridSettings } from './MapGridOverlay';
import type { MapTokenPayload } from '../../api/maps';
import AuthImage from '../common/AuthImage';

export type TokenEditMode = 'none' | 'ally' | 'enemy' | 'erase';

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
  onAddToken?: (cellKey: string, type: 'ally' | 'enemy') => void;
  onMoveToken?: (id: string, cellKey: string) => void;
  onRemoveToken?: (id: string) => void;
  previewScale?: number; // for preview context where a CSS scale is applied
  transform?: { zoom?: number; rotationDeg?: number } | null; // active map transform
  getTokenImage?: (token: MapTokenPayload) => string | undefined;
  highlightIds?: Set<string> | null;
}> = ({ settings, widthPx, heightPx, tokens, editable = false, editMode = 'none', onAddToken, onMoveToken, onRemoveToken, previewScale = 1, transform, getTokenImage, highlightIds }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);

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

  const onTokenPointerDown = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    // erase mode via right click or explicit erase
    if (editMode === 'erase' || e.button === 2) {
      e.preventDefault();
      onRemoveToken && onRemoveToken(id);
      return;
    }
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    setDrag({ id, dx: 0, dy: 0 });
  };

  const onRootPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !drag) return;
    // we only update position on pointer up to snap to cell
    e.preventDefault();
  };

  const onRootPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !drag) return;
    const cellKey = getCellFromPoint(e.clientX, e.clientY);
    if (cellKey && onMoveToken) onMoveToken(drag.id, cellKey);
    setDrag(null);
  };

  const style: React.CSSProperties = widthPx && heightPx
    ? { position: 'absolute', width: widthPx, height: heightPx, inset: 'auto', left: 0, top: 0 }
    : { position: 'absolute', inset: 0 };

  return (
    <div ref={rootRef} style={style} onClick={onRootClick} onPointerMove={onRootPointerMove} onPointerUp={onRootPointerUp}>
      {/* Render tokens by cell with offsets */}
      {Array.from(grouped.entries()).map(([cellKey, arr]) => {
        const center = getCenterFromCell(cellKey);
        const offs = offsetsForCount(arr.length);
        return arr.map((t, idx) => {
          const off = offs[idx] || { dx: 0, dy: 0 };
          const size = Math.max(14, Math.round(r * 1.1));
          const color = t.type === 'ally' ? '#2e7d32' : '#c62828';
          const bg = t.color || color;
          const x = center.x + off.dx - size / 2;
          const y = center.y + off.dy - size / 2;
          const isHighlighted = !!(highlightIds && highlightIds.has(t.id));
          const imgUrl = getTokenImage ? getTokenImage(t) : undefined;
          return (
            <div
              key={t.id}
              onPointerDown={onTokenPointerDown(t.id)}
              onContextMenu={(ev) => { if (editable) { ev.preventDefault(); onRemoveToken && onRemoveToken(t.id); } }}
              style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: bg, border: '2px solid rgba(255,255,255,0.9)', boxShadow: (isHighlighted ? '0 0 0 3px #ffd54f, 0 0 12px #ffd54f' : '0 1px 3px rgba(0,0,0,0.5)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: Math.max(10, Math.round(size * 0.35)), userSelect: 'none', cursor: editable ? 'grab' : 'default', overflow: 'hidden' }}
              title={t.label || (t.type === 'ally' ? 'Aliado' : 'Enemigo')}
            >
              {imgUrl ? (
                <AuthImage src={imgUrl} alt={t.label || 'token'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (t.label ? t.label.slice(0, 2) : (t.type === 'ally' ? 'A' : 'E'))
              )}
            </div>
          );
        });
      })}
    </div>
  );
};

export default MapTokensOverlay;
