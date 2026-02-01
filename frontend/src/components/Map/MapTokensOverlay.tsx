import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { GridSettings } from './MapGridOverlay';
import type { MapTokenPayload } from '../../api/maps';
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
}> = ({ settings, widthPx, heightPx, tokens, editable = false, editMode = 'none', renderTokenBody = true, renderLabel = true, renderFacing = true, zIndex, onSelectToken, onAddToken, onMoveToken, onUpdateToken, onRemoveToken, previewScale = 1, transform, getTokenImage, highlightIds }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);

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
      return;
    }
    const cellKey = getCellFromPoint(e.clientX, e.clientY);
    if (cellKey && onMoveToken) onMoveToken(drag.id, cellKey);
    setDrag(null);
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
          const isDataUrl = !!imgUrl && /^data:/i.test(imgUrl);
          const labelText = (t.label || (t.type === 'ally' ? 'Aliado' : 'Enemigo')) as string;
          const pad = Math.max(8, Math.round(size * 0.45));
          const box = size + pad * 2;
          const circleLeft = pad;
          const circleTop = pad;
          const cx = box / 2;
          const cy = box / 2;
          const rText = (size / 2) + Math.max(6, Math.round(size * 0.12));
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
                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
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
                      border: '2px solid rgba(255,255,255,0.9)',
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
    </div>
  );
};

export default MapTokensOverlay;
