import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TextField, Grid, Typography, Divider, Tabs, Tab, Box,
  IconButton, Button, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import type { ClassFeature, ClassLevelProgression } from '../../../types';
import ClassLevelProgressionEditor, {
  createDefaultLevelProgression,
  type LevelProgressionState,
  type LevelRowState,
  type FeatureEntry,
  SPELL_SLOT_LEVELS,
  DEFAULT_PB,
} from '../../classes/ClassLevelProgressionEditor';

interface ClassFormProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const HIT_DICE = [6, 8, 10, 12];
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const PROGRESSIONS = ['full', 'half', 'third', 'pact', 'none'];

/* ═══════════════ Subclass types ═══════════════ */

interface SubclassFeature {
  id: string;
  name: string;
  level: number;
  description: string;
}

interface SubclassState {
  id: string;
  name: string;
  grantedAtLevel: number;
  description: string;
  features: SubclassFeature[];
}

/* ═══════════════ Helpers: data ↔ editor state ═══════════════ */

/**
 * Initialises the level progression editor state from saved class data.
 * Mirrors the logic in EditClassDialog.initProgressionFromClassData.
 */
function dataToProgression(data: Record<string, any>): LevelProgressionState {
  const state = createDefaultLevelProgression();
  const levels: any[] = data.levels ?? [];
  if (!levels.length) return state;

  const featureMap = new Map<string, FeatureEntry>();
  ((data.features ?? []) as ClassFeature[]).forEach((f) => {
    if (f.id && f.name) featureMap.set(f.id, { name: f.name, description: f.description });
  });

  for (const lvlData of levels) {
    const lvl = lvlData.level;
    if (lvl < 1 || lvl > 20) continue;
    const featureEntries: FeatureEntry[] = (lvlData.features || [])
      .map((fid: string) => featureMap.get(fid) ?? { name: fid });

    const cantrips =
      lvlData.cantripsKnown != null ? String(lvlData.cantripsKnown)
      : lvlData.knownCantripsCount != null ? String(lvlData.knownCantripsCount)
      : '';

    state[lvl] = {
      proficiencyBonus: String(lvlData.proficiencyBonus ?? DEFAULT_PB[lvl]),
      features: featureEntries,
      cantripsKnown: cantrips,
      knownSpellsCount: lvlData.knownSpellsCount != null ? String(lvlData.knownSpellsCount) : '',
      spellSlots: Object.fromEntries(
        SPELL_SLOT_LEVELS.map((k) => [k, lvlData.spellSlots?.[k] != null ? String(lvlData.spellSlots[k]) : '']),
      ) as LevelRowState['spellSlots'],
    };
  }
  return state;
}

/**
 * Converts level progression editor state back into `levels` + `features` arrays
 * matching the CharacterClass schema.
 */
function progressionToData(state: LevelProgressionState): {
  levels: ClassLevelProgression[];
  features: ClassFeature[];
} {
  const allFeatures: ClassFeature[] = [];
  const levels: ClassLevelProgression[] = [];

  for (let lvl = 1; lvl <= 20; lvl++) {
    const row = state[lvl];
    const featureEntries = row.features.filter((e) => e.name.trim());
    const featureIds: string[] = featureEntries.map((entry, idx) => {
      const id = `lv${lvl}-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx}`;
      allFeatures.push({ id, name: entry.name, level: lvl, description: entry.description });
      return id;
    });

    const pb = parseInt(row.proficiencyBonus, 10);
    const cantrips = row.cantripsKnown !== '' ? parseInt(row.cantripsKnown, 10) : undefined;
    const spellsKnown = row.knownSpellsCount !== '' ? parseInt(row.knownSpellsCount, 10) : undefined;

    const slotsObj: Record<string, number> = {};
    let hasSlots = false;
    for (const k of SPELL_SLOT_LEVELS) {
      const num = row.spellSlots[k] !== '' ? (parseInt(row.spellSlots[k], 10) || 0) : 0;
      slotsObj[k] = num;
      if (num > 0) hasSlots = true;
    }

    const entry: ClassLevelProgression = {
      level: lvl,
      proficiencyBonus: isNaN(pb) ? DEFAULT_PB[lvl] : pb,
      features: featureIds,
    };
    if (cantrips != null && !isNaN(cantrips)) (entry as any).cantripsKnown = cantrips;
    if (spellsKnown != null && !isNaN(spellsKnown)) entry.knownSpellsCount = spellsKnown;
    if (hasSlots) entry.spellSlots = slotsObj as any;

    levels.push(entry);
  }
  return { levels, features: allFeatures };
}

/**
 * Generates a slug from text.
 */
function toSlug(text: string): string {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/* ═══════════════ Component ═══════════════ */

/**
 * Structured form for class entries in custom manuals.
 * Three tabs: basic info, level progression, and subclasses.
 * Produces data compatible with the CharacterClass schema so ClassesBrowser
 * renders it with full richness (progression table, features, subclasses).
 */
export default function ClassForm({ data, onChange }: ClassFormProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  /** Ref to always access latest data in deferred callbacks without stale closures. */
  const dataRef = useRef(data);
  dataRef.current = data;

  /* ── Local state for level progression editor ── */
  const [levelProg, setLevelProg] = useState<LevelProgressionState>(() => dataToProgression(data));

  /* ── Local state for subclasses ── */
  const [subclasses, setSubclasses] = useState<SubclassState[]>(() =>
    (data.subclasses ?? []).map((sc: any) => ({
      id: sc.id ?? toSlug(sc.name ?? ''),
      name: sc.name ?? '',
      grantedAtLevel: sc.grantedAtLevel ?? 3,
      description: sc.description ?? '',
      features: (sc.features ?? []).map((f: any) => ({
        id: f.id ?? '',
        name: f.name ?? '',
        level: f.level ?? sc.grantedAtLevel ?? 3,
        description: f.description ?? '',
      })),
    })),
  );

  /* Reset local state when data prop changes externally (e.g. entry edit switch) */
  useEffect(() => {
    setLevelProg(dataToProgression(data));
    setSubclasses(
      (data.subclasses ?? []).map((sc: any) => ({
        id: sc.id ?? toSlug(sc.name ?? ''),
        name: sc.name ?? '',
        grantedAtLevel: sc.grantedAtLevel ?? 3,
        description: sc.description ?? '',
        features: (sc.features ?? []).map((f: any) => ({
          id: f.id ?? '',
          name: f.name ?? '',
          level: f.level ?? sc.grantedAtLevel ?? 3,
          description: f.description ?? '',
        })),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id]);

  /* ── Setter helpers ── */
  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

  const setNested = (parent: string, key: string, value: any) => {
    onChange({ ...data, [parent]: { ...(data[parent] ?? {}), [key]: value } });
  };

  const setProficiency = (key: string, raw: string) => {
    const arr = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    setNested('proficiencies', key, arr);
  };

  /* ── Sync level progression to parent on change ── */
  const handleLevelProgChange = useCallback(
    (next: LevelProgressionState | ((prev: LevelProgressionState) => LevelProgressionState)) => {
      setLevelProg((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        // Defer parent update to avoid setState-in-render
        queueMicrotask(() => {
          const { levels, features } = progressionToData(resolved);
          onChange({ ...dataRef.current, levels, features });
        });
        return resolved;
      });
    },
    [onChange],
  );

  /* ── Subclass handlers ── */
  const syncSubclasses = (scs: SubclassState[]) => {
    setSubclasses(scs);
    onChange({
      ...data,
      subclasses: scs.map((sc) => ({
        id: sc.id || toSlug(sc.name),
        name: sc.name,
        grantedAtLevel: sc.grantedAtLevel,
        description: sc.description || undefined,
        features: sc.features.map((f) => ({
          id: f.id || `${toSlug(sc.name)}-lv${f.level}-${toSlug(f.name)}`,
          name: f.name,
          level: f.level,
          description: f.description || undefined,
        })),
      })),
    });
  };

  const addSubclass = () => {
    syncSubclasses([...subclasses, { id: '', name: '', grantedAtLevel: 3, description: '', features: [] }]);
  };

  const removeSubclass = (idx: number) => {
    syncSubclasses(subclasses.filter((_, i) => i !== idx));
  };

  const updateSubclass = (idx: number, patch: Partial<SubclassState>) => {
    const next = subclasses.map((sc, i) => (i === idx ? { ...sc, ...patch } : sc));
    syncSubclasses(next);
  };

  const addSubclassFeature = (scIdx: number) => {
    const sc = subclasses[scIdx];
    updateSubclass(scIdx, {
      features: [...sc.features, { id: '', name: '', level: sc.grantedAtLevel, description: '' }],
    });
  };

  const removeSubclassFeature = (scIdx: number, fIdx: number) => {
    const sc = subclasses[scIdx];
    updateSubclass(scIdx, { features: sc.features.filter((_, i) => i !== fIdx) });
  };

  const updateSubclassFeature = (scIdx: number, fIdx: number, patch: Partial<SubclassFeature>) => {
    const sc = subclasses[scIdx];
    updateSubclass(scIdx, {
      features: sc.features.map((f, i) => (i === fIdx ? { ...f, ...patch } : f)),
    });
  };

  /* ═══════════════ Render ═══════════════ */

  return (
    <>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label={t('manuals_class_tab_basic')} />
        <Tab label={t('manuals_class_tab_levels')} />
        <Tab label={t('manuals_class_tab_subclasses')} />
      </Tabs>

      {/* ═══════════ Tab 0: Basic info ═══════════ */}
      {activeTab === 0 && (
        <Box>
          {/* Name + Hit Die */}
          <TextField
            label={t('manuals_entry_name')}
            value={data.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
          />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label={t('manuals_class_hit_die')}
                value={data.hitDie ?? 8}
                onChange={(e) => set('hitDie', Number(e.target.value))}
                select
                fullWidth
                SelectProps={{ native: true }}
              >
                {HIT_DICE.map((d) => <option key={d} value={d}>d{d}</option>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                label={t('manuals_class_primary_abilities')}
                value={Array.isArray(data.primaryAbilities) ? data.primaryAbilities.join(', ') : (data.primaryAbilities ?? '')}
                onChange={(e) => set('primaryAbilities', e.target.value.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean))}
                fullWidth
                helperText={t('manuals_comma_separated')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label={t('manuals_class_saving_throws')}
                value={Array.isArray(data.savingThrows) ? data.savingThrows.join(', ') : (data.savingThrows ?? '')}
                onChange={(e) => set('savingThrows', e.target.value.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean))}
                fullWidth
                helperText={t('manuals_comma_separated')}
              />
            </Grid>
          </Grid>

          {/* Hit Points */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('manuals_class_hp_dice')}
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label={t('manuals_class_hp_dice')}
                value={data.hitPoints?.hitDice ?? ''}
                onChange={(e) => setNested('hitPoints', 'hitDice', e.target.value)}
                fullWidth
                placeholder={t('manuals_class_hp_dice_placeholder')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t('manuals_class_hp_1st')}
                value={data.hitPoints?.at1stLevel ?? ''}
                onChange={(e) => setNested('hitPoints', 'at1stLevel', e.target.value)}
                fullWidth
                placeholder={t('manuals_class_hp_1st_placeholder')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t('manuals_class_hp_higher')}
                value={data.hitPoints?.atHigherLevels ?? ''}
                onChange={(e) => setNested('hitPoints', 'atHigherLevels', e.target.value)}
                fullWidth
                placeholder={t('manuals_class_hp_higher_placeholder')}
              />
            </Grid>
          </Grid>

          {/* Proficiencies */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('manuals_class_proficiencies')}
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t('manuals_class_prof_armor')}
                value={(data.proficiencies?.armor ?? []).join(', ')}
                onChange={(e) => setProficiency('armor', e.target.value)}
                fullWidth
                helperText={t('manuals_comma_separated')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t('manuals_class_prof_weapons')}
                value={(data.proficiencies?.weapons ?? []).join(', ')}
                onChange={(e) => setProficiency('weapons', e.target.value)}
                fullWidth
                helperText={t('manuals_comma_separated')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t('manuals_class_prof_tools')}
                value={(data.proficiencies?.tools ?? []).join(', ')}
                onChange={(e) => setProficiency('tools', e.target.value)}
                fullWidth
                helperText={t('manuals_comma_separated')}
              />
            </Grid>
          </Grid>

          {/* Skills */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 4, sm: 3 }}>
              <TextField
                label={t('manuals_class_skills_choose')}
                type="number"
                value={data.skills?.choose ?? 0}
                onChange={(e) => setNested('skills', 'choose', Math.max(0, Number(e.target.value)))}
                fullWidth
                inputProps={{ min: 0, max: 10 }}
              />
            </Grid>
            <Grid size={{ xs: 8, sm: 9 }}>
              <TextField
                label={t('manuals_class_skills_from')}
                value={(data.skills?.from ?? []).join(', ')}
                onChange={(e) => setNested('skills', 'from', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                fullWidth
                helperText={t('manuals_comma_separated')}
              />
            </Grid>
          </Grid>

          {/* Spellcasting */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Spellcasting
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={t('manuals_class_spellcasting_ability')}
                value={data.spellcasting?.ability ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val && !data.spellcasting?.progression) {
                    set('spellcasting', null);
                  } else {
                    setNested('spellcasting', 'ability', val || undefined);
                  }
                }}
                select
                fullWidth
                SelectProps={{ native: true }}
              >
                <option value="">—</option>
                {ABILITIES.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={t('manuals_class_spellcasting_progression')}
                value={data.spellcasting?.progression ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val && !data.spellcasting?.ability) {
                    set('spellcasting', null);
                  } else {
                    setNested('spellcasting', 'progression', val || undefined);
                  }
                }}
                select
                fullWidth
                SelectProps={{ native: true }}
              >
                <option value="">—</option>
                {PROGRESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </TextField>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ═══════════ Tab 1: Level Progression ═══════════ */}
      {activeTab === 1 && (
        <Box sx={{ mx: -2 }}>
          <ClassLevelProgressionEditor
            value={levelProg}
            onChange={handleLevelProgChange}
          />
        </Box>
      )}

      {/* ═══════════ Tab 2: Subclasses ═══════════ */}
      {activeTab === 2 && (
        <Box>
          {subclasses.map((sc, scIdx) => (
            <Accordion key={scIdx} defaultExpanded={subclasses.length === 1}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                  <Typography sx={{ flexGrow: 1 }}>
                    {sc.name || `${t('manuals_class_tab_subclasses')} #${scIdx + 1}`}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => { e.stopPropagation(); removeSubclass(scIdx); }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('manuals_class_subclass_name')}
                      value={sc.name}
                      onChange={(e) => updateSubclass(scIdx, { name: e.target.value, id: toSlug(e.target.value) })}
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('manuals_class_subclass_level')}
                      type="number"
                      value={sc.grantedAtLevel}
                      onChange={(e) => updateSubclass(scIdx, { grantedAtLevel: Math.max(1, Math.min(20, Number(e.target.value))) })}
                      fullWidth
                      inputProps={{ min: 1, max: 20 }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label={t('manuals_class_subclass_desc')}
                      value={sc.description}
                      onChange={(e) => updateSubclass(scIdx, { description: e.target.value })}
                      fullWidth
                      multiline
                      minRows={2}
                    />
                  </Grid>
                </Grid>

                {/* Subclass features */}
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('manuals_class_subclass_features')}
                </Typography>
                {sc.features.map((feat, fIdx) => (
                  <Box key={fIdx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
                    <TextField
                      label={t('manuals_class_feature_name')}
                      value={feat.name}
                      onChange={(e) => updateSubclassFeature(scIdx, fIdx, { name: e.target.value })}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label={t('manuals_class_feature_level')}
                      type="number"
                      value={feat.level}
                      onChange={(e) => updateSubclassFeature(scIdx, fIdx, { level: Number(e.target.value) })}
                      size="small"
                      sx={{ width: 80 }}
                      inputProps={{ min: 1, max: 20 }}
                    />
                    <TextField
                      label={t('manuals_class_feature_desc')}
                      value={feat.description}
                      onChange={(e) => updateSubclassFeature(scIdx, fIdx, { description: e.target.value })}
                      size="small"
                      multiline
                      sx={{ flex: 3 }}
                    />
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeSubclassFeature(scIdx, fIdx)}
                      sx={{ mt: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  size="small"
                  onClick={() => addSubclassFeature(scIdx)}
                >
                  {t('manuals_class_feature_add')}
                </Button>
              </AccordionDetails>
            </Accordion>
          ))}

          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={addSubclass}
            sx={{ mt: 2 }}
          >
            {t('manuals_class_subclass_add')}
          </Button>
        </Box>
      )}
    </>
  );
}
