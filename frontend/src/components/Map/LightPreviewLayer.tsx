import React, { useCallback, useRef, useState } from 'react';
import { Popover, Stack, FormControlLabel, Switch, Typography } from '@mui/material';
import type { MapLightElement } from '../../api/mapElements';

/**
 * LightPreviewLayer
 *
 * SVG overlay that renders clickable icons for lights with
 * `showInPreview === true`. Shown outside of edit mode so the DM
 * can quickly toggle lights on/off from the map or combat preview.
 *
 * @param widthPx   Map natural width in pixels.
 * @param heightPx  Map natural height in pixels.
 * @param lights    Lights that should be visible in preview (showInPreview=true).
 * @param onToggle  Callback to toggle a light's isOn state by id.
 */
const LightPreviewLayer: React.FC<{
  widthPx: number;
  heightPx: number;
  lights: MapLightElement[];
  onToggle: (id: string) => void;
}> = ({ widthPx, heightPx, lights, onToggle }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [popover, setPopover] = useState<{
    lightId: string;
    anchorPosition: { top: number; left: number };
  } | null>(null);

  const W = widthPx || 1;
  const H = heightPx || 1;

  /** Open the toggle-popover at the light's screen position. */
  const handleLightClick = useCallback((e: React.MouseEvent, light: MapLightElement) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const px = light.position.x * (widthPx || 1);
    const py = light.position.y * (heightPx || 1);
    const screenPt = new DOMPoint(px, py).matrixTransform(ctm);
    setPopover({ lightId: light.id, anchorPosition: { top: screenPt.y, left: screenPt.x } });
  }, [widthPx, heightPx]);

  const activeLight = popover ? lights.find((l) => l.id === popover.lightId) ?? null : null;

  if (lights.length === 0) return null;

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
        {lights.map((light) => {
          const px = light.position.x * W;
          const py = light.position.y * H;
          const color = light.isOn ? (light.color || '#ffee55') : '#888888';
          return (
            <g
              key={light.id}
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              onClick={(e) => handleLightClick(e, light)}
            >
              {/* Glow backdrop */}
              <circle cx={px} cy={py} r={12} fill={color} opacity={0.25} />
              {/* Icon dot */}
              <circle cx={px} cy={py} r={6} fill={color} stroke="#000" strokeWidth={1} />
              {/* Label */}
              {light.label && (
                <text
                  x={px}
                  y={py - 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={0.4}
                  paintOrder="stroke"
                >
                  {light.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <Popover
        open={!!activeLight}
        anchorReference="anchorPosition"
        anchorPosition={popover?.anchorPosition}
        onClose={() => setPopover(null)}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { p: 2, minWidth: 180 } } }}
      >
        {activeLight && (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">
              {activeLight.label || `Luz ${activeLight.id.slice(-4)}`}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={activeLight.isOn}
                  onChange={() => onToggle(activeLight.id)}
                  size="small"
                />
              }
              label={activeLight.isOn ? 'Encendida' : 'Apagada'}
            />
          </Stack>
        )}
      </Popover>
    </>
  );
};

export default LightPreviewLayer;
