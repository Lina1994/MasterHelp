import React, { useCallback, useRef, useState } from 'react';
import { Button, FormControlLabel, Popover, Stack, Switch, TextField, Typography } from '@mui/material';
import type { MapElement, MapLightElement, MapDoorElement, MapWindowElement, MapSoundSourceElement } from '../../api/mapElements';

/**
 * Subset of elements eligible for preview outside edit mode.
 */
type PreviewElement = MapLightElement | MapDoorElement | MapWindowElement | MapSoundSourceElement;

/**
 * ElementsPreviewLayer
 *
 * SVG overlay that renders clickable icons for lights, doors and windows
 * with `showInPreview === true`. Shown outside of edit mode so the DM
 * can quickly toggle element state from the map or combat preview.
 *
 * @param widthPx    Map natural width in pixels.
 * @param heightPx   Map natural height in pixels.
 * @param elements   Elements that should be visible in preview (showInPreview=true).
 * @param onUpdate   Callback to update an element by id.
 */
const ElementsPreviewLayer: React.FC<{
  widthPx: number;
  heightPx: number;
  elements: PreviewElement[];
  onUpdate: (id: string, patch: Partial<MapElement>) => void;
  /** Callback to open the sound-source picker for the given element. */
  onPickSoundSource?: (elementId: string) => void;
}> = ({ widthPx, heightPx, elements, onUpdate, onPickSoundSource }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [popover, setPopover] = useState<{
    elementId: string;
    anchorPosition: { top: number; left: number };
  } | null>(null);

  const W = widthPx || 1;
  const H = heightPx || 1;

  /** Compute screen position from SVG coordinates and open popover. */
  const openPopover = useCallback((e: React.MouseEvent, el: PreviewElement) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    let px: number, py: number;
    if (el.type === 'light' || el.type === 'sound') {
      px = el.position.x * (widthPx || 1);
      py = el.position.y * (heightPx || 1);
    } else {
      px = ((el.points[0].x + el.points[1].x) / 2) * (widthPx || 1);
      py = ((el.points[0].y + el.points[1].y) / 2) * (heightPx || 1);
    }
    const screenPt = new DOMPoint(px, py).matrixTransform(ctm);
    setPopover({ elementId: el.id, anchorPosition: { top: screenPt.y, left: screenPt.x } });
  }, [widthPx, heightPx]);

  const activeElement = popover ? elements.find((el) => el.id === popover.elementId) ?? null : null;

  if (elements.length === 0) return null;

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 14,
        }}
      >
        {elements.map((el) => {
          if (el.type === 'light') {
            const px = el.position.x * W;
            const py = el.position.y * H;
            const color = el.isOn ? (el.color || '#ffee55') : '#888888';
            return (
              <g
                key={el.id}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={(e) => openPopover(e, el)}
              >
                <circle cx={px} cy={py} r={12} fill={color} opacity={0.25} />
                <circle cx={px} cy={py} r={6} fill={color} stroke="#000" strokeWidth={1} />
                {el.label && (
                  <text
                    x={px} y={py - 14}
                    textAnchor="middle" fontSize={11}
                    fill="#fff" stroke="#000" strokeWidth={0.4} paintOrder="stroke"
                  >
                    {el.label}
                  </text>
                )}
              </g>
            );
          }

          if (el.type === 'door') {
            const color = el.isOpen ? '#44ff44' : '#ff8800';
            return (
              <line
                key={el.id}
                x1={el.points[0].x * W} y1={el.points[0].y * H}
                x2={el.points[1].x * W} y2={el.points[1].y * H}
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={el.isOpen ? '8,6' : 'none'}
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onClick={(e) => openPopover(e, el)}
              />
            );
          }

          if (el.type === 'window') {
            return (
              <line
                key={el.id}
                x1={el.points[0].x * W} y1={el.points[0].y * H}
                x2={el.points[1].x * W} y2={el.points[1].y * H}
                stroke="#44ddff"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="4,4"
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onClick={(e) => openPopover(e, el)}
              />
            );
          }

          if (el.type === 'sound') {
            const px = el.position.x * W;
            const py = el.position.y * H;
            const color = el.isOn ? '#bb66ff' : '#888888';
            return (
              <g
                key={el.id}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={(e) => openPopover(e, el)}
              >
                <circle cx={px} cy={py} r={12} fill={color} opacity={0.25} />
                <text
                  x={px} y={py + 5}
                  textAnchor="middle" fontSize={14}
                  fill={color} stroke="#000" strokeWidth={0.4} paintOrder="stroke"
                  style={{ pointerEvents: 'none' }}
                >
                  ♪
                </text>
                {el.label && (
                  <text
                    x={px} y={py - 14}
                    textAnchor="middle" fontSize={11}
                    fill="#fff" stroke="#000" strokeWidth={0.4} paintOrder="stroke"
                  >
                    {el.label}
                  </text>
                )}
              </g>
            );
          }

          return null;
        })}
      </svg>

      <Popover
        open={!!activeElement}
        anchorReference="anchorPosition"
        anchorPosition={popover?.anchorPosition}
        onClose={() => setPopover(null)}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { p: 2, minWidth: 180 } } }}
      >
        {/* ── Light ────────────────────────────────────────── */}
        {activeElement?.type === 'light' && (() => {
          const light = activeElement as MapLightElement;
          return (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">
                {light.label || `Luz ${light.id.slice(-4)}`}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={light.isOn}
                    onChange={() => onUpdate(light.id, { isOn: !light.isOn } as any)}
                    size="small"
                  />
                }
                label={light.isOn ? 'Encendida' : 'Apagada'}
              />
            </Stack>
          );
        })()}

        {/* ── Door ─────────────────────────────────────────── */}
        {activeElement?.type === 'door' && (() => {
          const door = activeElement as MapDoorElement;
          return (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Puerta</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={door.isOpen}
                    onChange={() => onUpdate(door.id, { isOpen: !door.isOpen } as any)}
                    size="small"
                  />
                }
                label={door.isOpen ? 'Abierta' : 'Cerrada'}
              />
            </Stack>
          );
        })()}

        {/* ── Window ───────────────────────────────────────── */}
        {activeElement?.type === 'window' && (() => {
          const win = activeElement as MapWindowElement;
          return (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Ventana</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!win.covered}
                    onChange={(e) => onUpdate(win.id, { covered: e.target.checked } as any)}
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
                    onUpdate(win.id, { lightByTimeOfDay: { ...prev, [tod]: Math.max(0, Math.min(1, Number(e.target.value || 0))) } } as any);
                  }}
                />
              ))}
            </Stack>
          );
        })()}

        {/* ── Sound source ──────────────────────────────────── */}
        {activeElement?.type === 'sound' && (() => {
          const snd = activeElement as MapSoundSourceElement;
          return (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">
                {snd.label || `Sonido ${snd.id.slice(-4)}`}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={snd.isOn}
                    onChange={() => onUpdate(snd.id, { isOn: !snd.isOn } as any)}
                    size="small"
                  />
                }
                label={snd.isOn ? 'Activada' : 'Desactivada'}
              />
              {snd.sourceName && (
                <Typography variant="caption" color="text.secondary">
                  {snd.sourceName}
                </Typography>
              )}
              <Button
                size="small"
                variant="outlined"
                onClick={() => onPickSoundSource?.(snd.id)}
              >
                {snd.sourceId ? 'Cambiar fuente de audio' : 'Asignar fuente de audio'}
              </Button>
            </Stack>
          );
        })()}
      </Popover>
    </>
  );
};

export default ElementsPreviewLayer;
