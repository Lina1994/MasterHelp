import { TextField, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface BackgroundFormProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

/**
 * Form for background entries.
 */
export default function BackgroundForm({ data, onChange }: BackgroundFormProps) {
  const { t } = useTranslation();

  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

  const feature = (data.feature as Record<string, any>) ?? {};
  const setFeature = (key: string, value: string) =>
    onChange({ ...data, feature: { ...feature, [key]: value } });

  return (
    <>
      <TextField
        label={t('manuals_entry_name')}
        value={data.name ?? ''}
        onChange={e => set('name', e.target.value)}
        fullWidth
        required
        sx={{ mb: 2 }}
      />

      <TextField
        label={t('manuals_field_description')}
        value={data.description ?? ''}
        onChange={e => set('description', e.target.value)}
        fullWidth
        multiline
        minRows={3}
        sx={{ mb: 2 }}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label={t('manuals_bg_skill_proficiencies')}
            value={data.skillProficiencies ?? ''}
            onChange={e => set('skillProficiencies', e.target.value)}
            fullWidth
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label={t('manuals_bg_equipment')}
            value={data.equipment ?? ''}
            onChange={e => set('equipment', e.target.value)}
            fullWidth
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_bg_feature')}</Typography>
      <TextField
        label={t('manuals_entry_name')}
        value={feature.name ?? ''}
        onChange={e => setFeature('name', e.target.value)}
        fullWidth
        sx={{ mb: 1 }}
      />
      <TextField
        label={t('manuals_field_description')}
        value={feature.description ?? ''}
        onChange={e => setFeature('description', e.target.value)}
        fullWidth
        multiline
        minRows={3}
      />
    </>
  );
}
