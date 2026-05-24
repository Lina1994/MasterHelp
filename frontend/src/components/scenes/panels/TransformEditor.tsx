import React from 'react';
import {
  Box,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import FlipIcon from '@mui/icons-material/Flip';
import RotateRightIcon from '@mui/icons-material/RotateRight';

interface TransformEditorProps {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  onChange: (patch: { rotation?: number; flipH?: boolean; flipV?: boolean }) => void;
}

/**
 * Editor for static layer transforms: rotation (°) and horizontal/vertical flip.
 *
 * @param props - Current transform values and change callback.
 * @returns Compact transform editor with rotation field and flip toggles.
 */
export const TransformEditor: React.FC<TransformEditorProps> = ({
  rotation,
  flipH,
  flipV,
  onChange,
}) => {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 500 }}>
        Transformación
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          label="Rotación (°)"
          type="number"
          size="small"
          sx={{ flex: 1 }}
          value={rotation}
          inputProps={{ min: -360, max: 360, step: 1 }}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          InputProps={{
            startAdornment: (
              <RotateRightIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
            ),
          }}
        />
        <Tooltip title={`Voltear horizontal${flipH ? ' (activo)' : ''}`}>
          <IconButton
            size="small"
            onClick={() => onChange({ flipH: !flipH })}
            sx={{
              bgcolor: flipH ? 'primary.main' : 'action.hover',
              color: flipH ? 'primary.contrastText' : 'text.secondary',
              '&:hover': { bgcolor: flipH ? 'primary.dark' : 'action.selected' },
              borderRadius: 1,
              px: 1,
              minWidth: 36,
            }}
          >
            <FlipIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={`Voltear vertical${flipV ? ' (activo)' : ''}`}>
          <IconButton
            size="small"
            onClick={() => onChange({ flipV: !flipV })}
            sx={{
              bgcolor: flipV ? 'primary.main' : 'action.hover',
              color: flipV ? 'primary.contrastText' : 'text.secondary',
              '&:hover': { bgcolor: flipV ? 'primary.dark' : 'action.selected' },
              borderRadius: 1,
              px: 1,
              minWidth: 36,
              transform: 'rotate(90deg)',
            }}
          >
            <FlipIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};
