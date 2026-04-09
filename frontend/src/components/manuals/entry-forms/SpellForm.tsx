import { TextField, MenuItem, FormControlLabel, Checkbox, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface SpellFormProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const SCHOOLS = [
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
];

const LEVELS = Array.from({ length: 10 }, (_, i) => i); // 0-9

/**
 * Form for spell entries with all relevant D&D spell fields.
 */
export default function SpellForm({ data, onChange }: SpellFormProps) {
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
            label={t('manuals_spell_level')}
            value={data.level ?? 0}
            onChange={e => set('level', Number(e.target.value))}
            select
            fullWidth
          >
            {LEVELS.map(l => (
              <MenuItem key={l} value={l}>
                {l === 0 ? t('manuals_spell_cantrip') : `${l}`}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            label={t('manuals_spell_school')}
            value={data.school ?? ''}
            onChange={e => set('school', e.target.value)}
            select
            fullWidth
          >
            {SCHOOLS.map(s => (
              <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label={t('manuals_spell_casting_time')}
            value={data.castingTime ?? ''}
            onChange={e => set('castingTime', e.target.value)}
            fullWidth
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={t('manuals_spell_range')}
            value={data.range ?? ''}
            onChange={e => set('range', e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={t('manuals_spell_duration')}
            value={data.duration ?? ''}
            onChange={e => set('duration', e.target.value)}
            fullWidth
          />
        </Grid>
      </Grid>

      <TextField
        label={t('manuals_spell_components')}
        value={data.components ?? ''}
        onChange={e => set('components', e.target.value)}
        fullWidth
        sx={{ mb: 1 }}
      />
      <TextField
        label={t('manuals_spell_materials')}
        value={data.materials ?? ''}
        onChange={e => set('materials', e.target.value)}
        fullWidth
        sx={{ mb: 1 }}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!data.concentration}
                onChange={e => set('concentration', e.target.checked)}
              />
            }
            label={t('manuals_spell_concentration')}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!data.ritual}
                onChange={e => set('ritual', e.target.checked)}
              />
            }
            label={t('manuals_spell_ritual')}
          />
        </Grid>
      </Grid>

      <TextField
        label={t('manuals_spell_classes')}
        value={data.classes ?? ''}
        onChange={e => set('classes', e.target.value)}
        fullWidth
        helperText={t('manuals_spell_classes_hint')}
        sx={{ mb: 2 }}
      />

      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('manuals_field_description')}</Typography>
      <TextField
        value={data.description ?? ''}
        onChange={e => set('description', e.target.value)}
        fullWidth
        multiline
        minRows={5}
      />
    </>
  );
}
