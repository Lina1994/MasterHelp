import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, IconButton, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { CampaignBackgroundDetail } from '../../api/backgrounds/backgroundsApi';

interface EditBackgroundDialogProps {
  open: boolean;
  backgroundData: CampaignBackgroundDetail | null;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

/**
 * Dialog for creating/editing a campaign background.
 */
export default function EditBackgroundDialog({ open, backgroundData, isCreate = false, onClose, onSave }: EditBackgroundDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skillProficiencies, setSkillProficiencies] = useState('');
  const [toolProficiencies, setToolProficiencies] = useState('');
  const [equipment, setEquipment] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [customOriginName, setCustomOriginName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (backgroundData) {
        setName(backgroundData.name || '');
        setDescription(backgroundData.description || '');
        setSkillProficiencies((backgroundData.skillProficiencies || []).join(', '));
        setToolProficiencies((backgroundData.toolProficiencies || []).join(', '));
        setEquipment((backgroundData.equipment || []).join(', '));
        setFeatureName(backgroundData.feature?.name || '');
        setFeatureDescription(backgroundData.feature?.description || '');
        setCustomOriginName(backgroundData.customOriginName || '');
      } else {
        setName('');
        setDescription('');
        setSkillProficiencies('');
        setToolProficiencies('');
        setEquipment('');
        setFeatureName('');
        setFeatureDescription('');
        setCustomOriginName('');
      }
      setError(null);
    }
  }, [open, backgroundData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        customData: {
          name,
          description: description || undefined,
          skillProficiencies: skillProficiencies.split(',').map((s) => s.trim()).filter(Boolean),
          toolProficiencies: toolProficiencies.split(',').map((s) => s.trim()).filter(Boolean),
          equipment: equipment.split(',').map((s) => s.trim()).filter(Boolean),
          feature: featureName ? { id: featureName.toLowerCase().replace(/\s+/g, '-'), name: featureName, description: featureDescription || undefined } : undefined,
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
        {isCreate ? t('new_background', 'Nuevo Trasfondo') : t('edit_background', 'Editar Trasfondo')}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} columns={12} sx={{ mt: 0 }}>
          <Grid size={12}>
            <TextField label={t('name', 'Nombre')} value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('description', 'Descripción')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('skill_proficiencies', 'Competencias en habilidades')}
              value={skillProficiencies}
              onChange={(e) => setSkillProficiencies(e.target.value)}
              fullWidth
              helperText={t('comma_separated', 'Separados por coma (ej: History, Persuasion)')}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('tool_proficiencies', 'Competencias en herramientas')}
              value={toolProficiencies}
              onChange={(e) => setToolProficiencies(e.target.value)}
              fullWidth
              helperText={t('comma_separated', 'Separados por coma')}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('equipment', 'Equipo')}
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              fullWidth
              helperText={t('comma_separated', 'Separados por coma')}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('feature_name', 'Nombre del rasgo')}
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('feature_description', 'Descripción del rasgo')}
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
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
