import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import AuthImage from '../common/AuthImage';
import { getMapSkylineUrlSized, hasMapSkylineForTod, uploadMapSkylineForTod } from '../../api/maps';

type Props = { mapId: string };

const TDS = [
  { key: 'dawn', label: 'Amanecer' },
  { key: 'morning', label: 'Mañana' },
  { key: 'afternoon', label: 'Tarde' },
  { key: 'night', label: 'Noche' },
] as const;

/**
 * MapSkylineTodImagesEditor
 * Editor de imágenes Skyline por momento del día (dawn/morning/afternoon/night).
 */
const MapSkylineTodImagesEditor: React.FC<Props> = ({ mapId }) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [cacheBuster, setCacheBuster] = useState<number>(Date.now());
  const [presence, setPresence] = useState<Record<string, boolean>>({});

  const refreshPresence = async () => {
    const entries = await Promise.all(
      TDS.map(async ({ key }) => [key, await hasMapSkylineForTod(mapId, key as any, 'full')] as const)
    );
    setPresence(Object.fromEntries(entries));
  };

  useEffect(() => { void refreshPresence(); }, [mapId]);

  const onUpload = async (td: typeof TDS[number]['key'], file: File | null) => {
    if (!file) return;
    setBusyKey(td);
    try {
      await uploadMapSkylineForTod(mapId, file, td as any);
      setCacheBuster(Date.now());
      await refreshPresence();
    } finally { setBusyKey(null); }
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Skyline por Momento del Día</Typography>
      <Grid container spacing={1.5} columns={12}>
        {TDS.map(({ key, label }) => (
          <Grid key={key} size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 120, height: 80, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AuthImage
                  src={getMapSkylineUrlSized(mapId, 'full', { timeOfDay: key as any, cacheBust: cacheBuster, strict: true })}
                  alt={`${label} skyline`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onErrorIcon={<Typography variant="caption" color="text.secondary">Sin imagen</Typography>}
                />
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                <Typography sx={{ minWidth: 86 }}>{label}</Typography>
                {!presence[key] && (<Chip size="small" label="Sin imagen" variant="outlined" />)}
                <Button component="label" variant="outlined" size="small" disabled={busyKey === key}>
                  {busyKey === key ? 'Subiendo…' : 'Reemplazar'}
                  <input type="file" hidden accept="image/*" onChange={async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0] || null;
                    try { await onUpload(key, file); } catch (err: any) { alert(`Error al subir skyline (${label}): ${err?.response?.data?.message || err?.message || 'Desconocido'}`); }
                    (e.target as HTMLInputElement).value = '';
                  }} />
                </Button>
              </Stack>
            </Stack>
          </Grid>
        ))}
      </Grid>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Consejo: Si no subes alguna franja, no habrá fallback automático; considera subir al menos una imagen base.
      </Typography>
    </Box>
  );
};

export default MapSkylineTodImagesEditor;
