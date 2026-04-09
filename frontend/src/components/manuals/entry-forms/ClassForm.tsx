import { TextField, Grid, Typography, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ClassFormProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const HIT_DICE = [6, 8, 10, 12];

/**
 * Form for class entries.
 * Core fields are form-based; advanced structures (features, levels) use a JSON textarea.
 */
export default function ClassForm({ data, onChange }: ClassFormProps) {
  const { t } = useTranslation();

  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

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

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            label={t('manuals_class_hit_die')}
            value={data.hitDie ?? 8}
            onChange={e => set('hitDie', Number(e.target.value))}
            select
            fullWidth
            SelectProps={{ native: true }}
          >
            {HIT_DICE.map(d => <option key={d} value={d}>d{d}</option>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            label={t('manuals_class_primary_abilities')}
            value={data.primaryAbilities ?? ''}
            onChange={e => set('primaryAbilities', e.target.value)}
            fullWidth
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label={t('manuals_class_saving_throws')}
            value={data.savingThrows ?? ''}
            onChange={e => set('savingThrows', e.target.value)}
            fullWidth
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
      </Grid>

      <TextField
        label={t('manuals_class_proficiencies')}
        value={data.proficienciesText ?? ''}
        onChange={e => set('proficienciesText', e.target.value)}
        fullWidth
        multiline
        minRows={2}
        sx={{ mb: 2 }}
        helperText={t('manuals_class_proficiencies_hint')}
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('manuals_class_features_json')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {t('manuals_class_features_json_hint')}
      </Typography>
      <TextField
        value={
          typeof data.featuresJson === 'string'
            ? data.featuresJson
            : JSON.stringify(data.features ?? [], null, 2)
        }
        onChange={e => set('featuresJson', e.target.value)}
        fullWidth
        multiline
        minRows={8}
        sx={{
          '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 13 },
        }}
      />
    </>
  );
}
