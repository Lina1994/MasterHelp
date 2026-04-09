import { TextField, Grid, Typography, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface RaceFormProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const SIZES = ['Small', 'Medium'];

/**
 * Form for race entries with core D&D fields.
 */
export default function RaceForm({ data, onChange }: RaceFormProps) {
  const { t } = useTranslation();

  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

  const bonuses = (data.abilityBonuses as Record<string, number>) ?? {};
  const setBonus = (ab: string, value: string) =>
    onChange({ ...data, abilityBonuses: { ...bonuses, [ab]: Number(value) || 0 } });

  const speed = (data.speed as Record<string, any>) ?? {};
  const setSpeed = (key: string, value: string) =>
    onChange({ ...data, speed: { ...speed, [key]: value ? Number(value) : undefined } });

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
        <Grid size={{ xs: 6 }}>
          <TextField
            label={t('manuals_monster_size')}
            value={data.size ?? 'Medium'}
            onChange={e => set('size', e.target.value)}
            select
            fullWidth
            SelectProps={{ native: true }}
          >
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={t('manuals_monster_languages')}
            value={data.languages ?? ''}
            onChange={e => set('languages', e.target.value)}
            fullWidth
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
      </Grid>

      {/* ── Speed ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_monster_speed')}</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {['walk', 'fly', 'swim', 'climb'].map(mode => (
          <Grid key={mode} size={{ xs: 3 }}>
            <TextField
              label={mode}
              type="number"
              value={speed[mode] ?? ''}
              onChange={e => setSpeed(mode, e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* ── Ability Bonuses ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_race_ability_bonuses')}</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => (
          <Grid key={ab} size={{ xs: 4, sm: 2 }}>
            <TextField
              label={ab.toUpperCase()}
              type="number"
              value={bonuses[ab] ?? 0}
              onChange={e => setBonus(ab, e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* ── Traits as text ── */}
      <TextField
        label={t('manuals_race_traits')}
        value={data.traitsText ?? ''}
        onChange={e => set('traitsText', e.target.value)}
        fullWidth
        multiline
        minRows={4}
        helperText={t('manuals_monster_textblock_hint')}
      />
    </>
  );
}
