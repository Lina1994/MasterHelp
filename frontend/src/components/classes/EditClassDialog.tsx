import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, IconButton, Box, Typography, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { CampaignClassDetail } from '../../api/classes/classesApi';

interface EditClassDialogProps {
  open: boolean;
  classData: CampaignClassDetail | null;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

/**
 * Dialog for creating/editing a campaign class.
 */
export default function EditClassDialog({ open, classData, isCreate = false, onClose, onSave }: EditClassDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [hitDie, setHitDie] = useState(8);
  const [primaryAbilities, setPrimaryAbilities] = useState('');
  const [savingThrows, setSavingThrows] = useState('');
  const [customOriginName, setCustomOriginName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (classData) {
        setName(classData.name || '');
        setHitDie(classData.hitDie || 8);
        setPrimaryAbilities((classData.primaryAbilities || []).join(', '));
        setSavingThrows((classData.savingThrows || []).join(', '));
        setCustomOriginName(classData.customOriginName || '');
      } else {
        setName('');
        setHitDie(8);
        setPrimaryAbilities('');
        setSavingThrows('');
        setCustomOriginName('');
      }
      setError(null);
    }
  }, [open, classData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        customData: {
          name,
          hitDie,
          primaryAbilities: primaryAbilities.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
          savingThrows: savingThrows.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
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
        {isCreate ? t('new_class', 'Nueva Clase') : t('edit_class', 'Editar Clase')}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} columns={12} sx={{ mt: 0 }}>
          <Grid size={12}>
            <TextField label={t('name', 'Nombre')} value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          </Grid>
          <Grid size={6}>
            <FormControl fullWidth>
              <InputLabel>{t('hit_die', 'Dado de golpe')}</InputLabel>
              <Select value={hitDie} label={t('hit_die', 'Dado de golpe')} onChange={(e) => setHitDie(Number(e.target.value))}>
                {[6, 8, 10, 12].map((d) => <MenuItem key={d} value={d}>d{d}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={6}>
            <TextField
              label={t('custom_origin', 'Nombre de origen')}
              value={customOriginName}
              onChange={(e) => setCustomOriginName(e.target.value)}
              fullWidth
              placeholder="Homebrew"
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('primary_abilities', 'Habilidades principales')}
              value={primaryAbilities}
              onChange={(e) => setPrimaryAbilities(e.target.value)}
              fullWidth
              helperText={t('comma_separated', 'Separadas por coma (ej: str, dex)')}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('saving_throws', 'Tiradas de salvación')}
              value={savingThrows}
              onChange={(e) => setSavingThrows(e.target.value)}
              fullWidth
              helperText={t('comma_separated', 'Separadas por coma (ej: str, con)')}
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
