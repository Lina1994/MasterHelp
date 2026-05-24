import React from 'react';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { MotionKeyframe, MotionEasing } from '../../../types/scenes';

const EASING_OPTIONS: { value: MotionEasing; label: string }[] = [
  { value: 'linear', label: 'Lineal' },
  { value: 'easeIn', label: 'Entrada suave' },
  { value: 'easeOut', label: 'Salida suave' },
  { value: 'easeInOut', label: 'Entrada/Salida' },
  { value: 'bounce', label: 'Rebote' },
  { value: 'spring', label: 'Muelle' },
];

interface MotionPathEditorProps {
  keyframes: MotionKeyframe[];
  durationMs: number;
  onChange: (keyframes: MotionKeyframe[]) => void;
}

/**
 * Table editor for motion path keyframes.
 *
 * Lets users define position (X%, Y%) and optional rotation at specific time offsets,
 * with an easing curve from each point to the next. The action's starting position
 * (leftPct/topPct in payload) is implicitly the point at timeMs=0.
 *
 * @param props - Current keyframes, action duration, and change callback.
 */
export const MotionPathEditor: React.FC<MotionPathEditorProps> = ({
  keyframes,
  durationMs,
  onChange,
}) => {
  const gridTemplateColumns = '64px 54px 54px 64px 72px 56px 52px 52px minmax(108px, 1fr) 30px';

  const addKeyframe = () => {
    const lastKf = keyframes[keyframes.length - 1];
    const lastTime = lastKf?.timeMs ?? 0;
    const nextTime = Math.min(lastTime + Math.max(500, Math.round(durationMs / 3)), durationMs > 0 ? durationMs : 3000);
    onChange([
      ...keyframes,
      {
        timeMs: nextTime,
        leftPct: lastKf?.leftPct ?? 50,
        topPct: lastKf?.topPct ?? 50,
        holdMs: 0,
        pauseOscillationDuringHold: false,
        easing: 'linear',
      },
    ]);
  };

  const updateKeyframe = (index: number, patch: Partial<MotionKeyframe>) => {
    onChange(keyframes.map((kf, i) => (i === index ? { ...kf, ...patch } : kf)));
  };

  const removeKeyframe = (index: number) => {
    onChange(keyframes.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          Trayectoria ({keyframes.length} punto{keyframes.length !== 1 ? 's' : ''})
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={addKeyframe}
          sx={{ fontSize: '0.65rem', py: 0.25 }}
        >
          Añadir punto
        </Button>
      </Stack>

      {keyframes.length === 0 ? (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', textAlign: 'center', py: 1 }}
        >
          Sin movimiento. Añade puntos para definir la trayectoria.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          <Box sx={{ width: '100%', overflowX: 'auto', pb: 0.25 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: gridTemplateColumns,
                gap: 0.5,
                px: 0.25,
                minWidth: 690,
              }}
            >
              {['T(ms)', 'X%', 'Y%', 'Pausa', 'Osc. pausa', 'Rot°', 'Flip H', 'Flip V', 'Easing', ''].map((h) => (
                <Typography key={h} variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
                  {h}
                </Typography>
              ))}
            </Box>

            <Stack spacing={0.75} sx={{ mt: 0.5, minWidth: 690 }}>
              {keyframes.map((kf, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: gridTemplateColumns,
                    gap: 0.5,
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    type="number"
                    size="small"
                    value={kf.timeMs}
                    inputProps={{ min: 1, max: durationMs > 0 ? durationMs : 99999, step: 100 }}
                    onChange={(e) => updateKeyframe(i, { timeMs: Number(e.target.value) })}
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.7rem', px: 0.75, py: 0.5 } }}
                  />
                  <TextField
                    type="number"
                    size="small"
                    value={Number(kf.leftPct.toFixed(1))}
                    inputProps={{ min: -200, max: 200, step: 1 }}
                    onChange={(e) => updateKeyframe(i, { leftPct: Number(e.target.value) })}
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.7rem', px: 0.75, py: 0.5 } }}
                  />
                  <TextField
                    type="number"
                    size="small"
                    value={Number(kf.topPct.toFixed(1))}
                    inputProps={{ min: -200, max: 200, step: 1 }}
                    onChange={(e) => updateKeyframe(i, { topPct: Number(e.target.value) })}
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.7rem', px: 0.75, py: 0.5 } }}
                  />
                  <TextField
                    type="number"
                    size="small"
                    value={Number(kf.holdMs ?? 0)}
                    inputProps={{ min: 0, max: 60000, step: 100 }}
                    onChange={(e) => updateKeyframe(i, { holdMs: Math.max(0, Number(e.target.value)) })}
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.7rem', px: 0.75, py: 0.5 } }}
                  />
                  <FormControl size="small" fullWidth>
                    <Select
                      value={kf.pauseOscillationDuringHold ? 'yes' : 'no'}
                      onChange={(e) => updateKeyframe(i, { pauseOscillationDuringHold: e.target.value === 'yes' })}
                      sx={{ fontSize: '0.65rem' }}
                    >
                      <MenuItem value="no" sx={{ fontSize: '0.65rem' }}>No</MenuItem>
                      <MenuItem value="yes" sx={{ fontSize: '0.65rem' }}>Si</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    type="number"
                    size="small"
                    value={kf.rotation ?? ''}
                    placeholder="—"
                    inputProps={{ min: -360, max: 360, step: 1 }}
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : Number(e.target.value);
                      updateKeyframe(i, { rotation: v });
                    }}
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.7rem', px: 0.75, py: 0.5 } }}
                  />
                  <FormControl size="small" fullWidth>
                    <Select
                      value={kf.flipH ? 'yes' : 'no'}
                      onChange={(e) => updateKeyframe(i, { flipH: e.target.value === 'yes' })}
                      sx={{ fontSize: '0.65rem' }}
                    >
                      <MenuItem value="no" sx={{ fontSize: '0.65rem' }}>No</MenuItem>
                      <MenuItem value="yes" sx={{ fontSize: '0.65rem' }}>Si</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={kf.flipV ? 'yes' : 'no'}
                      onChange={(e) => updateKeyframe(i, { flipV: e.target.value === 'yes' })}
                      sx={{ fontSize: '0.65rem' }}
                    >
                      <MenuItem value="no" sx={{ fontSize: '0.65rem' }}>No</MenuItem>
                      <MenuItem value="yes" sx={{ fontSize: '0.65rem' }}>Si</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={kf.easing}
                      onChange={(e) => updateKeyframe(i, { easing: e.target.value as MotionEasing })}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {EASING_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.7rem' }}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Tooltip title="Eliminar punto">
                    <IconButton size="small" color="error" onClick={() => removeKeyframe(i)}>
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      )}
    </Box>
  );
};
