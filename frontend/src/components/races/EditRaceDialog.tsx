import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, IconButton, Typography, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { CampaignRaceDetail } from '../../api/races/racesApi';

interface EditRaceDialogProps {
  open: boolean;
  raceData: CampaignRaceDetail | null;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

const SIZE_OPTIONS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

/**
 * Dialog for creating/editing a campaign race.
 */
export default function EditRaceDialog({ open, raceData, isCreate = false, onClose, onSave }: EditRaceDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [size, setSize] = useState('Medium');
  const [walkSpeed, setWalkSpeed] = useState(30);
  const [languages, setLanguages] = useState('');
  const [customOriginName, setCustomOriginName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (raceData) {
        setName(raceData.name || '');
        setSize(raceData.size || 'Medium');
        setWalkSpeed(raceData.speed?.walk || 30);
        setLanguages((raceData.languages || []).join(', '));
        setCustomOriginName(raceData.customOriginName || '');
      } else {
        setName('');
        setSize('Medium');
        setWalkSpeed(30);
        setLanguages('');
        setCustomOriginName('');
      }
      setError(null);
    }
  }, [open, raceData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        customData: {
          name,
          size,
          speed: { walk: walkSpeed },
          languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
        },
      };
      if (isCreate) {
        payload.customOriginName = customOriginName || 'Homebrew';
      } else if (customOriginName) {
        payload.customOriginName = customOriginName;
      }
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {isCreate ? t('new_race', 'Nueva Raza') : t('edit_race', 'Editar Raza')}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} columns={12} sx={{ mt: 0 }}>
          <Grid size={12}>
            <TextField label={t('name', 'Nombre')} value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          </Grid>
          <Grid size={6}>
            <FormControl fullWidth>
              <InputLabel>{t('size', 'Tamaño')}</InputLabel>
              <Select value={size} label={t('size', 'Tamaño')} onChange={(e) => setSize(e.target.value)}>
                {SIZE_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={6}>
            <TextField
              label={t('walk_speed', 'Velocidad (pies)')}
              type="number"
              value={walkSpeed}
              onChange={(e) => setWalkSpeed(Number(e.target.value))}
              fullWidth
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('languages', 'Idiomas')}
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              fullWidth
              helperText={t('comma_separated', 'Separados por coma (ej: Common, Elvish)')}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('custom_origin', 'Nombre de origen')}
              value={customOriginName}
              onChange={(e) => setCustomOriginName(e.target.value)}
              fullWidth
              placeholder="Homebrew"
            />
          </Grid>
        </Grid>
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving || !name.trim()}>
          {saving ? t('saving', 'Guardando...') : t('save', 'Guardar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
