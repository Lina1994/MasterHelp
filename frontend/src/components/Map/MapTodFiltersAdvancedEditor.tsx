import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AuthImage from '../common/AuthImage';
import { getMapImageUrlSized, getMapSkylineUrlSized } from '../../api/maps';
import {
  ALL_MAP_TIMES_OF_DAY,
  getResolvedFilterValues,
  getVisualFilterCss,
  normalizeFilterValue,
  TimeOfDayFilterConfig,
  TimeOfDayFilterValue,
  VISUAL_FILTER_PRESET_OPTIONS,
  VisualFilterPreset,
} from '../../utils/mapVisualFilters';

type Props = {
  title: string;
  mapId: string;
  mapKind: 'image' | 'skyline';
  filters?: TimeOfDayFilterConfig;
  onFilterChange: (timeOfDay: typeof ALL_MAP_TIMES_OF_DAY[number], value: TimeOfDayFilterValue | null) => void;
  onApplyToAll: (value: TimeOfDayFilterValue | null) => void;
};

const TOD_LABELS: Record<typeof ALL_MAP_TIMES_OF_DAY[number], string> = {
  dawn: 'Amanecer',
  morning: 'Manana',
  afternoon: 'Tarde',
  night: 'Noche',
};

const SLIDERS: Array<{
  key: 'brightness' | 'contrast' | 'saturate' | 'hueRotateDeg' | 'sepia' | 'grayscale' | 'blurPx';
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}> = [
  { key: 'brightness', label: 'Brillo', min: 40, max: 180, step: 1, unit: '%' },
  { key: 'contrast', label: 'Contraste', min: 40, max: 180, step: 1, unit: '%' },
  { key: 'saturate', label: 'Saturacion', min: 0, max: 220, step: 1, unit: '%' },
  { key: 'hueRotateDeg', label: 'Matiz', min: -180, max: 180, step: 1, unit: 'deg' },
  { key: 'sepia', label: 'Sepia', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'grayscale', label: 'Escala de grises', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'blurPx', label: 'Desenfoque', min: 0, max: 6, step: 0.1, unit: 'px' },
];

const FALLBACK_VALUES = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotateDeg: 0,
  sepia: 0,
  grayscale: 0,
  blurPx: 0,
};

/**
 * Editor avanzado de filtros visuales por franja horaria.
 * Permite combinar preset base + ajuste fino por parametro.
 */
const MapTodFiltersAdvancedEditor: React.FC<Props> = ({ title, mapId, mapKind, filters, onFilterChange, onApplyToAll }) => {
  const [activeTod, setActiveTod] = useState<typeof ALL_MAP_TIMES_OF_DAY[number]>('morning');

  const activeRaw = filters?.[activeTod] ?? null;
  const activeNormalized = normalizeFilterValue(activeRaw);
  const activeResolved = getResolvedFilterValues(activeRaw);

  const previewSrc = useMemo(() => {
    if (mapKind === 'image') {
      return getMapImageUrlSized(mapId, 'preview', { timeOfDay: activeTod, strict: true });
    }
    // Keep this aligned with MapSkylineTodImagesEditor so both views show the same source image.
    return getMapSkylineUrlSized(mapId, 'full', { timeOfDay: activeTod, strict: true });
  }, [activeTod, mapId, mapKind]);

  const updateActiveFilter = (patch: Partial<Exclude<ReturnType<typeof normalizeFilterValue>, undefined>>) => {
    const current = normalizeFilterValue(filters?.[activeTod]) ?? {};
    const next = normalizeFilterValue({ ...current, ...patch });
    onFilterChange(activeTod, next ?? null);
  };

  const applyPurePreset = () => {
    const preset = activeNormalized?.preset;
    onFilterChange(activeTod, preset ? { preset } : null);
  };

  const applyCurrentToAll = () => {
    const value = normalizeFilterValue(filters?.[activeTod] ?? null) ?? null;
    onApplyToAll(value);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
          <Box
            sx={{
              width: '100%',
              height: 120,
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AuthImage
              src={previewSrc}
              alt={`${title} ${TOD_LABELS[activeTod]}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: getVisualFilterCss(activeRaw) }}
              onErrorIcon={<Typography variant="caption" color="text.secondary">Sin imagen</Typography>}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Vista previa de {TOD_LABELS[activeTod]}.
            {mapKind === 'skyline' ? ' Usa exactamente la misma imagen de "Skyline por Momento del Dia" para esta franja.' : ''}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={activeTod}
            onChange={(_e, value) => { if (value) setActiveTod(value); }}
            sx={{ mb: 1, flexWrap: 'wrap' }}
          >
            {ALL_MAP_TIMES_OF_DAY.map((timeOfDay) => (
              <ToggleButton key={timeOfDay} value={timeOfDay}>{TOD_LABELS[timeOfDay]}</ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <TextField
              select
              size="small"
              label="Preset base"
              value={activeNormalized?.preset ?? ''}
              onChange={(event) => updateActiveFilter({ preset: (event.target.value || undefined) as VisualFilterPreset | undefined })}
              sx={{ minWidth: 220 }}
            >
              {VISUAL_FILTER_PRESET_OPTIONS.map((option) => (
                <MenuItem key={option.label} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
            <Button size="small" onClick={applyPurePreset}>Aplicar preset puro</Button>
            <Button size="small" onClick={() => onFilterChange(activeTod, null)}>Quitar filtro</Button>
            <Button size="small" onClick={applyCurrentToAll}>Copiar esta franja a todas</Button>
          </Stack>

          <Divider sx={{ mb: 1 }} />

          <Stack spacing={1.5}>
            {SLIDERS.map((slider) => {
              const value = (activeResolved?.[slider.key] ?? FALLBACK_VALUES[slider.key]) as number;
              return (
                <Box key={slider.key}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
                    <Typography variant="body2">{slider.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{value}{slider.unit}</Typography>
                  </Stack>
                  <Slider
                    size="small"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={value}
                    onChange={(_event, nextValue) => updateActiveFilter({ [slider.key]: Number(nextValue) } as any)}
                  />
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

export default MapTodFiltersAdvancedEditor;
