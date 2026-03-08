import React from 'react';
import {
  Box,
  Divider,
  FormControlLabel,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { WindowSize } from '../../hooks/useSecondaryWindowSizes';

interface Props {
  mode: 'dynamic' | 'custom';
  customSizes: { players: WindowSize; skyline: WindowSize };
  setMode: (m: 'dynamic' | 'custom') => void;
  setCustomSize: (window: 'players' | 'skyline', size: Partial<WindowSize>) => void;
  disabled?: boolean;
}

/**
 * SecondaryWindowSizesSettings
 *
 * Reusable settings panel that lets the DM choose between:
 *  - "dynamic": sizes reported by the secondary windows themselves (Electron IPC /
 *    localStorage) — works only when both windows run in the same Electron instance.
 *  - "custom": manually entered pixel dimensions — needed when secondary windows open
 *    from a different device or browser context.
 *
 * Default custom sizes are 1920×1080 per window.
 */
export const SecondaryWindowSizesSettings: React.FC<Props> = ({
  mode,
  customSizes,
  setMode,
  setCustomSize,
  disabled = false,
}) => {
  const handleInt = (
    win: 'players' | 'skyline',
    field: 'width' | 'height',
    raw: string,
  ) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) setCustomSize(win, { [field]: n });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>Dimensiones de ventanas secundarias</Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configura cómo se obtienen las dimensiones de la vista previa. Usa las medidas personalizadas
        cuando alguna ventana secundaria esté abierta desde un dispositivo o navegador diferente.
      </Typography>

      <RadioGroup
        value={mode}
        onChange={(_, v) => setMode(v as 'dynamic' | 'custom')}
        sx={{ mb: 2 }}
      >
        <FormControlLabel
          value="dynamic"
          control={<Radio disabled={disabled} />}
          label={
            <Box>
              <Typography variant="body2" fontWeight="medium">Dinámicas (por defecto)</Typography>
              <Typography variant="caption" color="text.secondary">
                Las dimensiones se obtienen automáticamente de las ventanas secundarias abiertas en la misma aplicación.
              </Typography>
            </Box>
          }
        />
        <FormControlLabel
          value="custom"
          control={<Radio disabled={disabled} />}
          label={
            <Box>
              <Typography variant="body2" fontWeight="medium">Personalizadas</Typography>
              <Typography variant="caption" color="text.secondary">
                Introduce los valores manualmente. Útil cuando las ventanas secundarias corren en otro dispositivo o desde el navegador.
              </Typography>
            </Box>
          }
          sx={{ mt: 1 }}
        />
      </RadioGroup>

      {mode === 'custom' && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            {/* Players window */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Ventana de jugadores</Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Ancho"
                  type="number"
                  size="small"
                  disabled={disabled}
                  value={customSizes.players.width}
                  onChange={(e) => handleInt('players', 'width', e.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                  sx={{ width: 160 }}
                />
                <TextField
                  label="Alto"
                  type="number"
                  size="small"
                  disabled={disabled}
                  value={customSizes.players.height}
                  onChange={(e) => handleInt('players', 'height', e.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                  sx={{ width: 160 }}
                />
              </Stack>
            </Box>

            {/* Skyline window */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Ventana Skyline</Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Ancho"
                  type="number"
                  size="small"
                  disabled={disabled}
                  value={customSizes.skyline.width}
                  onChange={(e) => handleInt('skyline', 'width', e.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                  sx={{ width: 160 }}
                />
                <TextField
                  label="Alto"
                  type="number"
                  size="small"
                  disabled={disabled}
                  value={customSizes.skyline.height}
                  onChange={(e) => handleInt('skyline', 'height', e.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                  sx={{ width: 160 }}
                />
              </Stack>
            </Box>
          </Stack>
        </>
      )}
    </Paper>
  );
};

export default SecondaryWindowSizesSettings;
