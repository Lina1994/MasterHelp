import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, IconButton, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { CampaignFeatDetail } from '../../api/feats/featsApi';

interface EditFeatDialogProps {
  open: boolean;
  featData: CampaignFeatDetail | null;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

/**
 * Dialog for creating/editing a campaign feat.
 */
export default function EditFeatDialog({ open, featData, isCreate = false, onClose, onSave }: EditFeatDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [prerequisite, setPrerequisite] = useState('');
  const [description, setDescription] = useState('');
  const [customOriginName, setCustomOriginName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (featData) {
        setName(featData.name || '');
        setPrerequisite(featData.prerequisite || '');
        setDescription(featData.description || '');
        setCustomOriginName(featData.customOriginName || '');
      } else {
        setName('');
        setPrerequisite('');
        setDescription('');
        setCustomOriginName('');
      }
      setError(null);
    }
  }, [open, featData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        customData: { name, prerequisite: prerequisite || null, description },
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
        {isCreate ? t('new_feat', 'Nueva Dote') : t('edit_feat', 'Editar Dote')}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} columns={12} sx={{ mt: 0 }}>
          <Grid size={12}>
            <TextField label={t('name', 'Nombre')} value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('prerequisite', 'Requisito')}
              value={prerequisite}
              onChange={(e) => setPrerequisite(e.target.value)}
              fullWidth
              placeholder={t('prerequisite_placeholder', 'Ej: Strength 13 or higher')}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('description', 'Descripción')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={4}
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
