import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AuthImage from '../common/AuthImage';
import { getMapImageUrlSized, hasMapImageForTod, uploadMapImageForTod } from '../../api/maps';
import { getFilterPreset, getVisualFilterCss, TimeOfDayFilterConfig, TimeOfDayFilterValue, VISUAL_FILTER_PRESET_OPTIONS, VisualFilterPreset } from '../../utils/mapVisualFilters';

type Props = {
  mapId: string;
  filters?: TimeOfDayFilterConfig;
  onFilterChange?: (timeOfDay: typeof TDS[number]['key'], value: TimeOfDayFilterValue | null) => void;
};

const TDS = [
  { key: 'dawn', label: 'Amanecer' },
  { key: 'morning', label: 'Mañana' },
  { key: 'afternoon', label: 'Tarde' },
  { key: 'night', label: 'Noche' },
] as const;

/**
 * MapTodImagesEditor
 *
 * Muestra 4 ranuras (dawn/morning/afternoon/night) con preview (variant preview)
 * y un botón para subir/actualizar cada imagen de forma independiente.
 */
const MapTodImagesEditor: React.FC<Props> = ({ mapId, filters, onFilterChange }) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [cacheBuster, setCacheBuster] = useState<number>(Date.now());
  const [presence, setPresence] = useState<Record<string, boolean>>({});

  const refreshPresence = async () => {
    const entries = await Promise.all(
      TDS.map(async ({ key }) => [key, await hasMapImageForTod(mapId, key as any, 'full')] as const)
    );
    setPresence(Object.fromEntries(entries));
  };

  useEffect(() => {
    void refreshPresence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  const onUpload = async (td: typeof TDS[number]['key'], file: File | null) => {
    if (!file) return;
    setBusyKey(td);
    try {
      await uploadMapImageForTod(mapId, file, td as any);
      // Fuerza recarga de la preview
      setCacheBuster(Date.now());
      await refreshPresence();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Imágenes por Momento del Día</Typography>
      <Grid container spacing={1.5} columns={12}>
        {TDS.map(({ key, label }) => (
          <Grid key={key} size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 120, height: 80, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AuthImage
                  src={getMapImageUrlSized(mapId, 'full', { timeOfDay: key as any, cacheBust: cacheBuster, strict: true })}
                  alt={`${label} preview`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: getVisualFilterCss(filters?.[key]) }}
                  onErrorIcon={<Typography variant="caption" color="text.secondary">Sin imagen</Typography>}
                />
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', flex: 1 }}>
                <Typography sx={{ minWidth: 86 }}>{label}</Typography>
                {!presence[key] && (
                  <Chip size="small" label="Sin imagen" variant="outlined" />
                )}
                <TextField
                  select
                  size="small"
                  label="Filtro"
                  value={getFilterPreset(filters?.[key]) ?? ''}
                  onChange={(e) => onFilterChange?.(key, (e.target.value || null) as VisualFilterPreset | null)}
                  sx={{ minWidth: 170 }}
                >
                  {VISUAL_FILTER_PRESET_OPTIONS.map((option) => (
                    <MenuItem key={option.label} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  disabled={busyKey === key}
                >
                  {busyKey === key ? 'Subiendo…' : 'Reemplazar'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0] || null;
                      try {
                        await onUpload(key, file);
                      } catch (err: any) {
                        // eslint-disable-next-line no-alert
                        alert(`Error al subir imagen (${label}): ${err?.response?.data?.message || err?.message || 'Desconocido'}`);
                      }
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />
                </Button>
              </Stack>
            </Stack>
          </Grid>
        ))}
      </Grid>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Consejo: Si no subes alguna franja, se usara la imagen base como fallback. El filtro es opcional y se aplica por franja.
      </Typography>
    </Box>
  );
};

export default MapTodImagesEditor;
