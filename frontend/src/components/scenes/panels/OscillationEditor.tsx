import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { OscillationEffect } from '../../../types/scenes';

/**
 * Returns a default (disabled) oscillation effect configuration.
 */
export function getDefaultOscillation(): OscillationEffect {
  return {
    enabled: false,
    type: 'bounce',
    axis: 'y',
    amplitudePct: 3,
    frequencyHz: 2,
    pauseDuringMotionHold: false,
  };
}

interface OscillationEditorProps {
  oscillation: OscillationEffect;
  onChange: (next: OscillationEffect) => void;
}

/**
 * Editor for secondary oscillation effects applied on top of a motion path.
 *
 * 'wave' produces a smooth sinusoidal motion (flying, floating).
 * 'bounce' produces an abrupt one-directional hop (walk cycle steps).
 *
 * @param props - Current oscillation config and change callback.
 */
export const OscillationEditor: React.FC<OscillationEditorProps> = ({ oscillation, onChange }) => {
  const update = (patch: Partial<OscillationEffect>) => onChange({ ...oscillation, ...patch });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          Oscilación secundaria
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.disabled">
            {oscillation.enabled ? 'Activa' : 'Inactiva'}
          </Typography>
          <Switch
            size="small"
            checked={oscillation.enabled}
            onChange={(_, checked) => update({ enabled: checked })}
          />
        </Stack>
      </Stack>

      {oscillation.enabled && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={oscillation.type}
                onChange={(e) => update({ type: e.target.value as OscillationEffect['type'] })}
                sx={{ fontSize: '0.75rem' }}
              >
                <MenuItem value="bounce" sx={{ fontSize: '0.75rem' }}>
                  Rebote (pasos)
                </MenuItem>
                <MenuItem value="wave" sx={{ fontSize: '0.75rem' }}>
                  Onda (flotación)
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Eje</InputLabel>
              <Select
                label="Eje"
                value={oscillation.axis}
                onChange={(e) => update({ axis: e.target.value as OscillationEffect['axis'] })}
                sx={{ fontSize: '0.75rem' }}
              >
                <MenuItem value="x" sx={{ fontSize: '0.75rem' }}>
                  Horizontal (X)
                </MenuItem>
                <MenuItem value="y" sx={{ fontSize: '0.75rem' }}>
                  Vertical (Y)
                </MenuItem>
                <MenuItem value="both" sx={{ fontSize: '0.75rem' }}>
                  Ambos
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Amplitud: {oscillation.amplitudePct.toFixed(1)}%
            </Typography>
            <Slider
              size="small"
              min={0}
              max={20}
              step={0.5}
              value={oscillation.amplitudePct}
              onChange={(_, v) => update({ amplitudePct: v as number })}
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Frecuencia: {oscillation.frequencyHz.toFixed(1)} Hz
            </Typography>
            <Slider
              size="small"
              min={0.1}
              max={10}
              step={0.1}
              value={oscillation.frequencyHz}
              onChange={(_, v) => update({ frequencyHz: v as number })}
            />
          </Box>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Pausar oscilación cuando hay pausa de trayectoria
            </Typography>
            <Switch
              size="small"
              checked={Boolean(oscillation.pauseDuringMotionHold)}
              onChange={(_, checked) => update({ pauseDuringMotionHold: checked })}
            />
          </Stack>
        </Stack>
      )}
    </Box>
  );
};
