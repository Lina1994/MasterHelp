import { useState } from 'react';
import {
  TextField, Grid, Typography, Divider, Box,
  IconButton, Button, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';

interface RaceFormProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const ALL_SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const SENSE_KEYS = ['darkvision', 'blindsight', 'tremorsense', 'truesight'] as const;

/**
 * Generates a URL-safe slug from text.
 */
function toSlug(text: string): string {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/* ═══════════════ Trait editor row ═══════════════ */

interface TraitState {
  id: string;
  name: string;
  description: string;
}

/**
 * Inline trait editor: name + description + delete button.
 */
function TraitRow({
  trait, onChange, onRemove, tName, tDesc,
}: {
  trait: TraitState;
  onChange: (patch: Partial<TraitState>) => void;
  onRemove: () => void;
  tName: string;
  tDesc: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
      <TextField
        label={tName}
        value={trait.name}
        onChange={(e) => onChange({ name: e.target.value, id: toSlug(e.target.value) })}
        size="small"
        sx={{ flex: 1 }}
      />
      <TextField
        label={tDesc}
        value={trait.description}
        onChange={(e) => onChange({ description: e.target.value })}
        size="small"
        multiline
        sx={{ flex: 2 }}
      />
      <IconButton size="small" color="error" onClick={onRemove} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

/* ═══════════════ Ability bonuses grid (reused for race + subraces) ═══════════════ */

function AbilityBonusesGrid({
  bonuses, onChange,
}: {
  bonuses: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  return (
    <Grid container spacing={1}>
      {ABILITY_KEYS.map((ab) => (
        <Grid key={ab} size={{ xs: 4, sm: 2 }}>
          <TextField
            label={ab.toUpperCase()}
            type="number"
            value={bonuses[ab] ?? 0}
            onChange={(e) => onChange({ ...bonuses, [ab]: Number(e.target.value) || 0 })}
            fullWidth
            size="small"
          />
        </Grid>
      ))}
    </Grid>
  );
}

/* ═══════════════ Subrace state ═══════════════ */

interface SubraceState {
  id: string;
  name: string;
  abilityBonuses: Record<string, number>;
  proficiencies: { weapons?: string[]; armor?: string[]; tools?: string[] };
  traits: TraitState[];
}

/* ═══════════════ Main component ═══════════════ */

/**
 * Structured form for race entries in custom manuals.
 * Produces data compatible with the Race schema (RacesBrowser).
 */
export default function RaceForm({ data, onChange }: RaceFormProps) {
  const { t } = useTranslation();

  /* ── Setter helpers ── */
  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

  const setNested = (parent: string, key: string, value: any) => {
    onChange({ ...data, [parent]: { ...(data[parent] ?? {}), [key]: value } });
  };

  const bonuses = (data.abilityBonuses as Record<string, number>) ?? {};
  const speed = (data.speed as Record<string, any>) ?? {};
  const senses = (data.senses as Record<string, number>) ?? {};

  const setSpeed = (key: string, value: string) =>
    onChange({ ...data, speed: { ...speed, [key]: value ? Number(value) : undefined } });

  const setSense = (key: string, value: string) =>
    onChange({ ...data, senses: { ...senses, [key]: value ? Number(value) : undefined } });

  const setProficiency = (key: string, raw: string) => {
    const arr = raw.split(',').map((s) => s.trim()).filter(Boolean);
    setNested('proficiencies', key, arr);
  };

  /* ── Traits state ── */
  const traits: TraitState[] = (data.traits ?? []).map((tr: any) => ({
    id: tr.id ?? toSlug(tr.name ?? ''),
    name: tr.name ?? '',
    description: tr.description ?? '',
  }));

  const syncTraits = (next: TraitState[]) => {
    onChange({
      ...data,
      traits: next.map((tr) => ({
        id: tr.id || toSlug(tr.name),
        name: tr.name,
        description: tr.description || undefined,
      })),
    });
  };

  /* ── Subraces state ── */
  const [subraces, setSubraces] = useState<SubraceState[]>(() =>
    (data.subraces ?? []).map((sr: any) => ({
      id: sr.id ?? toSlug(sr.name ?? ''),
      name: sr.name ?? '',
      abilityBonuses: sr.abilityBonuses ?? {},
      proficiencies: sr.proficiencies ?? {},
      traits: (sr.traits ?? []).map((tr: any) => ({
        id: tr.id ?? toSlug(tr.name ?? ''),
        name: tr.name ?? '',
        description: tr.description ?? '',
      })),
    })),
  );

  const syncSubraces = (srs: SubraceState[]) => {
    setSubraces(srs);
    onChange({
      ...data,
      subraces: srs.map((sr) => ({
        id: sr.id || toSlug(sr.name),
        name: sr.name,
        abilityBonuses: Object.keys(sr.abilityBonuses).length ? sr.abilityBonuses : undefined,
        proficiencies: Object.values(sr.proficiencies).some((a: any) => a?.length) ? sr.proficiencies : undefined,
        traits: sr.traits.length
          ? sr.traits.map((tr) => ({
              id: tr.id || toSlug(tr.name),
              name: tr.name,
              description: tr.description || undefined,
            }))
          : undefined,
      })),
    });
  };

  const addSubrace = () => {
    syncSubraces([...subraces, { id: '', name: '', abilityBonuses: {}, proficiencies: {}, traits: [] }]);
  };

  const removeSubrace = (idx: number) => syncSubraces(subraces.filter((_, i) => i !== idx));

  const updateSubrace = (idx: number, patch: Partial<SubraceState>) => {
    syncSubraces(subraces.map((sr, i) => (i === idx ? { ...sr, ...patch } : sr)));
  };

  /* ═══════════════ Render ═══════════════ */

  return (
    <>
      {/* ── Name + Size ── */}
      <TextField
        label={t('manuals_entry_name')}
        value={data.name ?? ''}
        onChange={(e) => set('name', e.target.value)}
        fullWidth
        required
        sx={{ mb: 2 }}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            label={t('manuals_monster_size')}
            value={data.size ?? 'Medium'}
            onChange={(e) => set('size', e.target.value)}
            select
            fullWidth
            SelectProps={{ native: true }}
          >
            {ALL_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 8 }}>
          <TextField
            label={t('manuals_monster_languages')}
            value={Array.isArray(data.languages) ? data.languages.join(', ') : (data.languages ?? '')}
            onChange={(e) => set('languages', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            fullWidth
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
      </Grid>

      {/* ── Speed ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_monster_speed')}</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {['walk', 'fly', 'swim', 'climb'].map((mode) => (
          <Grid key={mode} size={{ xs: 3 }}>
            <TextField
              label={mode}
              type="number"
              value={speed[mode] ?? ''}
              onChange={(e) => setSpeed(mode, e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* ── Ability Bonuses ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_race_ability_bonuses')}</Typography>
      <Box sx={{ mb: 2 }}>
        <AbilityBonusesGrid
          bonuses={bonuses}
          onChange={(next) => set('abilityBonuses', next)}
        />
      </Box>

      {/* ── Age ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_race_age')}</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={t('manuals_race_age_maturity')}
            type="number"
            value={data.age?.maturity ?? ''}
            onChange={(e) => setNested('age', 'maturity', e.target.value ? Number(e.target.value) : undefined)}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={t('manuals_race_age_max')}
            type="number"
            value={data.age?.max ?? ''}
            onChange={(e) => setNested('age', 'max', e.target.value ? Number(e.target.value) : undefined)}
            fullWidth
            size="small"
          />
        </Grid>
      </Grid>

      {/* ── Senses ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_race_senses')}</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {SENSE_KEYS.map((sk) => (
          <Grid key={sk} size={{ xs: 6, sm: 3 }}>
            <TextField
              label={sk.charAt(0).toUpperCase() + sk.slice(1)}
              type="number"
              value={senses[sk] ?? ''}
              onChange={(e) => setSense(sk, e.target.value)}
              fullWidth
              size="small"
              placeholder="ft"
            />
          </Grid>
        ))}
      </Grid>

      {/* ── Proficiencies ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_race_proficiencies')}</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label={t('manuals_race_prof_armor')}
            value={(data.proficiencies?.armor ?? []).join(', ')}
            onChange={(e) => setProficiency('armor', e.target.value)}
            fullWidth
            size="small"
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label={t('manuals_race_prof_weapons')}
            value={(data.proficiencies?.weapons ?? []).join(', ')}
            onChange={(e) => setProficiency('weapons', e.target.value)}
            fullWidth
            size="small"
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label={t('manuals_race_prof_tools')}
            value={(data.proficiencies?.tools ?? []).join(', ')}
            onChange={(e) => setProficiency('tools', e.target.value)}
            fullWidth
            size="small"
            helperText={t('manuals_comma_separated')}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* ── Traits ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_race_traits')}</Typography>
      {traits.map((tr, idx) => (
        <TraitRow
          key={idx}
          trait={tr}
          tName={t('manuals_race_trait_name')}
          tDesc={t('manuals_race_trait_desc')}
          onChange={(patch) => {
            const next = traits.map((t2, i) => (i === idx ? { ...t2, ...patch } : t2));
            syncTraits(next);
          }}
          onRemove={() => syncTraits(traits.filter((_, i) => i !== idx))}
        />
      ))}
      <Button startIcon={<AddIcon />} size="small" onClick={() => syncTraits([...traits, { id: '', name: '', description: '' }])}>
        {t('manuals_race_trait_add')}
      </Button>

      <Divider sx={{ my: 2 }} />

      {/* ── Subraces ── */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('manuals_race_subraces')}</Typography>
      {subraces.map((sr, srIdx) => (
        <Accordion key={srIdx} defaultExpanded={subraces.length === 1}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
              <Typography sx={{ flexGrow: 1 }}>
                {sr.name || `${t('manuals_race_subraces')} #${srIdx + 1}`}
              </Typography>
              <IconButton
                size="small"
                color="error"
                onClick={(e) => { e.stopPropagation(); removeSubrace(srIdx); }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              label={t('manuals_race_subrace_name')}
              value={sr.name}
              onChange={(e) => updateSubrace(srIdx, { name: e.target.value, id: toSlug(e.target.value) })}
              fullWidth
              required
              sx={{ mb: 2 }}
            />

            {/* Subrace ability bonuses */}
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
              {t('manuals_race_subrace_bonuses')}
            </Typography>
            <Box sx={{ mb: 2 }}>
              <AbilityBonusesGrid
                bonuses={sr.abilityBonuses}
                onChange={(next) => updateSubrace(srIdx, { abilityBonuses: next })}
              />
            </Box>

            {/* Subrace proficiencies */}
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid size={{ xs: 4 }}>
                <TextField
                  label={t('manuals_race_prof_armor')}
                  value={(sr.proficiencies.armor ?? []).join(', ')}
                  onChange={(e) => {
                    const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    updateSubrace(srIdx, { proficiencies: { ...sr.proficiencies, armor: arr } });
                  }}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField
                  label={t('manuals_race_prof_weapons')}
                  value={(sr.proficiencies.weapons ?? []).join(', ')}
                  onChange={(e) => {
                    const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    updateSubrace(srIdx, { proficiencies: { ...sr.proficiencies, weapons: arr } });
                  }}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField
                  label={t('manuals_race_prof_tools')}
                  value={(sr.proficiencies.tools ?? []).join(', ')}
                  onChange={(e) => {
                    const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    updateSubrace(srIdx, { proficiencies: { ...sr.proficiencies, tools: arr } });
                  }}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Subrace traits */}
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
              {t('manuals_race_subrace_traits')}
            </Typography>
            {sr.traits.map((tr, trIdx) => (
              <TraitRow
                key={trIdx}
                trait={tr}
                tName={t('manuals_race_trait_name')}
                tDesc={t('manuals_race_trait_desc')}
                onChange={(patch) => {
                  const nextTraits = sr.traits.map((t2, i) => (i === trIdx ? { ...t2, ...patch } : t2));
                  updateSubrace(srIdx, { traits: nextTraits });
                }}
                onRemove={() => {
                  updateSubrace(srIdx, { traits: sr.traits.filter((_, i) => i !== trIdx) });
                }}
              />
            ))}
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => updateSubrace(srIdx, { traits: [...sr.traits, { id: '', name: '', description: '' }] })}
            >
              {t('manuals_race_trait_add')}
            </Button>
          </AccordionDetails>
        </Accordion>
      ))}

      <Button startIcon={<AddIcon />} variant="outlined" onClick={addSubrace} sx={{ mt: 2 }}>
        {t('manuals_race_subrace_add')}
      </Button>
    </>
  );
}
