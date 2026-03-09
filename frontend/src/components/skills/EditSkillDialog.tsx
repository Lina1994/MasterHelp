import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, IconButton, Typography, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { CampaignSkillDetail } from '../../api/skills/skillsApi';

interface EditSkillDialogProps {
  open: boolean;
  skillData: CampaignSkillDetail | null;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

const ABILITY_OPTIONS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * Dialog for creating/editing a campaign skill.
 */
export default function EditSkillDialog({ open, skillData, isCreate = false, onClose, onSave }: EditSkillDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [ability, setAbility] = useState('dex');
  const [description, setDescription] = useState('');
  const [customOriginName, setCustomOriginName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (skillData) {
        setName(skillData.name || '');
        setAbility(skillData.ability || 'dex');
        setDescription(skillData.description || '');
        setCustomOriginName(skillData.customOriginName || '');
      } else {
        setName('');
        setAbility('dex');
        setDescription('');
        setCustomOriginName('');
      }
      setError(null);
    }
  }, [open, skillData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        customData: { name, ability, description },
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
        {isCreate ? t('new_skill', 'Nueva Habilidad') : t('edit_skill', 'Editar Habilidad')}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} columns={12} sx={{ mt: 0 }}>
          <Grid size={8}>
            <TextField label={t('name', 'Nombre')} value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          </Grid>
          <Grid size={4}>
            <FormControl fullWidth>
              <InputLabel>{t('ability', 'Característica')}</InputLabel>
              <Select value={ability} label={t('ability', 'Característica')} onChange={(e) => setAbility(e.target.value)}>
                {ABILITY_OPTIONS.map((a) => <MenuItem key={a} value={a}>{a.toUpperCase()}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('description', 'Descripción')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={3}
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
