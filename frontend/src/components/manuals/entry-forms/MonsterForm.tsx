import { TextField, Grid, MenuItem, Typography, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface MonsterFormProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
  'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
];

/**
 * Form for monster entries with core D&D 5e stat block fields.
 */
export default function MonsterForm({ data, onChange }: MonsterFormProps) {
  const { t } = useTranslation();

  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

  const abilities = (data.abilities as Record<string, number>) ?? {};
  const setAbility = (ab: string, value: string) =>
    onChange({ ...data, abilities: { ...abilities, [ab]: Number(value) || 0 } });

  const ac = (data.armorClass as Record<string, any>) ?? {};
  const setAc = (key: string, value: any) =>
    onChange({ ...data, armorClass: { ...ac, [key]: value } });

  const hp = (data.hitPoints as Record<string, any>) ?? {};
  const setHp = (key: string, value: any) =>
    onChange({ ...data, hitPoints: { ...hp, [key]: value } });

  const speed = (data.speed as Record<string, any>) ?? {};
  const setSpeed = (key: string, value: string) =>
    onChange({ ...data, speed: { ...speed, [key]: value ? Number(value) : undefined } });

  return (
    <>
      {/* ── Basic Info ── */}
      <TextField
        label={t('manuals_entry_name')}
        value={data.name ?? ''}
        onChange={e => set('name', e.target.value)}
        fullWidth
        required
        sx={{ mb: 2 }}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            label={t('manuals_monster_size')}
            value={data.size ?? 'Medium'}
            onChange={e => set('size', e.target.value)}
            select
            fullWidth
          >
            {SIZES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            label={t('manuals_monster_type')}
            value={data.type ?? 'humanoid'}
            onChange={e => set('type', e.target.value)}
            select
            fullWidth
          >
            {TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            label={t('manuals_monster_alignment')}
            value={data.alignment ?? ''}
            onChange={e => set('alignment', e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            label={t('manuals_monster_cr')}
            value={data.challengeRating ?? '0'}
            onChange={e => set('challengeRating', e.target.value)}
            fullWidth
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* ── AC & HP ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 4 }}>
          <TextField
            label={t('manuals_monster_ac')}
            type="number"
            value={ac.value ?? 10}
            onChange={e => setAc('value', Number(e.target.value))}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 4 }}>
          <TextField
            label={t('manuals_monster_hp')}
            type="number"
            value={hp.average ?? 10}
            onChange={e => setHp('average', Number(e.target.value))}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 4 }}>
          <TextField
            label={t('manuals_monster_hp_roll')}
            value={hp.roll ?? ''}
            onChange={e => setHp('roll', e.target.value)}
            fullWidth
            placeholder="2d8+2"
          />
        </Grid>
      </Grid>

      {/* ── Speed ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_monster_speed')}</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {['walk', 'fly', 'swim', 'climb', 'burrow'].map(mode => (
          <Grid key={mode} size={{ xs: 4, sm: 2.4 }}>
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

      {/* ── Abilities ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_monster_abilities')}</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => (
          <Grid key={ab} size={{ xs: 4, sm: 2 }}>
            <TextField
              label={ab.toUpperCase()}
              type="number"
              value={abilities[ab] ?? 10}
              onChange={e => setAbility(ab, e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
        ))}
      </Grid>

      {/* ── Senses & Languages ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label={t('manuals_monster_senses')}
            value={data.senses ?? ''}
            onChange={e => set('senses', e.target.value)}
            fullWidth
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label={t('manuals_monster_languages')}
            value={data.languages ?? ''}
            onChange={e => set('languages', e.target.value)}
            fullWidth
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* ── Text blocks ── */}
      <TextField
        label={t('manuals_monster_traits')}
        value={data.traitsText ?? ''}
        onChange={e => set('traitsText', e.target.value)}
        fullWidth
        multiline
        minRows={3}
        helperText={t('manuals_monster_textblock_hint')}
        sx={{ mb: 2 }}
      />
      <TextField
        label={t('manuals_monster_actions')}
        value={data.actionsText ?? ''}
        onChange={e => set('actionsText', e.target.value)}
        fullWidth
        multiline
        minRows={3}
        helperText={t('manuals_monster_textblock_hint')}
        sx={{ mb: 2 }}
      />
      <TextField
        label={t('manuals_monster_reactions')}
        value={data.reactionsText ?? ''}
        onChange={e => set('reactionsText', e.target.value)}
        fullWidth
        multiline
        minRows={2}
        sx={{ mb: 2 }}
      />
      <TextField
        label={t('manuals_monster_legendary')}
        value={data.legendaryActionsText ?? ''}
        onChange={e => set('legendaryActionsText', e.target.value)}
        fullWidth
        multiline
        minRows={2}
      />
    </>
  );
}
