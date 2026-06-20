import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CARD_SIZE_PRESETS } from '../../utils/cardSizes';
import type { CardOrientation, CardSizePreset } from '../../types/cardTemplates';

/**
 * Editor for the physical size + orientation of a template.
 *
 * When the preset is `CUSTOM` we expose raw width/height inputs so the
 * user can dial in arbitrary dimensions; for any other preset the inputs
 * remain ready to inspect but follow the preset values.
 */
export default function CardSizeSelector({
  sizePreset,
  orientation,
  widthMm,
  heightMm,
  onChange,
}: {
  sizePreset: CardSizePreset;
  orientation: CardOrientation;
  widthMm: number;
  heightMm: number;
  onChange: (next: {
    sizePreset: CardSizePreset;
    orientation: CardOrientation;
    widthMm: number;
    heightMm: number;
  }) => void;
}) {
  const { t } = useTranslation();
  const isCustom = sizePreset === 'CUSTOM';

  const handlePresetChange = (next: CardSizePreset) => {
    const def = CARD_SIZE_PRESETS.find((d) => d.key === next);
    onChange({
      sizePreset: next,
      orientation,
      widthMm: def?.widthMm ?? widthMm,
      heightMm: def?.heightMm ?? heightMm,
    });
  };

  const handleDimChange = (dim: 'w' | 'h') => (e: any) => {
    const raw = e.target.value;
    if (raw === '' || raw == null) {
      onChange({ sizePreset: 'CUSTOM', orientation, widthMm, heightMm });
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    onChange({
      sizePreset: 'CUSTOM',
      orientation,
      widthMm: dim === 'w' ? num : widthMm,
      heightMm: dim === 'h' ? num : heightMm,
    });
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }} flexWrap="wrap">
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>{t('cards_size_preset', 'Tamaño preestablecido')}</InputLabel>
        <Select
          label={t('cards_size_preset', 'Tamaño preestablecido')}
          value={sizePreset}
          onChange={(e) => handlePresetChange(e.target.value as CardSizePreset)}
        >
          {CARD_SIZE_PRESETS.map((preset) => (
            <MenuItem key={preset.key} value={preset.key}>
              {preset.label} ({preset.widthMm}×{preset.heightMm} mm)
            </MenuItem>
          ))}
          <MenuItem value="CUSTOM">{t('cards_size_custom', 'Personalizado…')}</MenuItem>
        </Select>
      </FormControl>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={orientation}
        onChange={(_, v) => v && onChange({ sizePreset, orientation: v as CardOrientation, widthMm, heightMm })}
      >
        <ToggleButton value="portrait">{t('cards_orientation_portrait', 'Vertical')}</ToggleButton>
        <ToggleButton value="landscape">{t('cards_orientation_landscape', 'Horizontal')}</ToggleButton>
      </ToggleButtonGroup>

      <TextField
        size="small"
        type="number"
        label={t('cards_width_mm', 'Ancho (mm)')}
        value={widthMm}
        onChange={handleDimChange('w')}
        disabled={!isCustom}
        sx={{ width: 120 }}
        inputProps={{ min: 20, max: 300 }}
      />
      <TextField
        size="small"
        type="number"
        label={t('cards_height_mm', 'Alto (mm)')}
        value={heightMm}
        onChange={handleDimChange('h')}
        disabled={!isCustom}
        sx={{ width: 120 }}
        inputProps={{ min: 20, max: 300 }}
      />

      <Box sx={{ ml: { sm: 'auto' } }}>
        <Typography variant="caption" color="text.secondary">
          {CARD_SIZE_PRESETS.find((p) => p.key === sizePreset)?.description ?? t('cards_size_custom_hint', 'Introduce el tamaño exacto en mm.')}
        </Typography>
      </Box>
    </Stack>
  );
}
