import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, IconButton, Box, Typography, FormControl, InputLabel, Select,
  MenuItem, Tab, Tabs,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { CampaignClassDetail } from '../../api/classes/classesApi';
import type { ClassFeature, ClassLevelProgression } from '../../types';
import ClassLevelProgressionEditor, {
  createDefaultLevelProgression,
  DEFAULT_PB,
  LevelProgressionState,
  SPELL_SLOT_LEVELS,
  SpellSlotLevel,
} from './ClassLevelProgressionEditor';

interface EditClassDialogProps {
  open: boolean;
  classData: CampaignClassDetail | null;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

/**
 * Initialises the level progression editor state from existing class data.
 * If the class has no level data, returns a default state with standard D&D 5e
 * proficiency bonuses and all optional fields blank.
 *
 * @param classData - Existing class detail, or null when creating a new class.
 * @returns A `LevelProgressionState` covering levels 1 through 20.
 */
function initProgressionFromClassData(classData: CampaignClassDetail | null): LevelProgressionState {
  const state = createDefaultLevelProgression();
  if (!classData?.levels?.length) return state;

  const featureMap = new Map<string, string>();
  (classData.features || []).forEach((f: any) => {
    if (f.id && f.name) featureMap.set(String(f.id), String(f.name));
  });

  for (const lvlData of classData.levels as ClassLevelProgression[]) {
    const lvl = lvlData.level;
    if (lvl < 1 || lvl > 20) continue;

    const featureNames = (lvlData.features || [])
      .map((fid: string) => featureMap.get(fid) ?? fid)
      .join(', ');

    const cantrips =
      lvlData.cantripsKnown != null
        ? String(lvlData.cantripsKnown)
        : lvlData.knownCantripsCount != null
        ? String(lvlData.knownCantripsCount)
        : '';

    state[lvl] = {
      proficiencyBonus: String(lvlData.proficiencyBonus ?? DEFAULT_PB[lvl]),
      features: featureNames,
      cantripsKnown: cantrips,
      knownSpellsCount: lvlData.knownSpellsCount != null ? String(lvlData.knownSpellsCount) : '',
      spellSlots: Object.fromEntries(
        SPELL_SLOT_LEVELS.map((k) => [k, lvlData.spellSlots?.[k] != null ? String(lvlData.spellSlots![k]) : '']),
      ) as Record<SpellSlotLevel, string>,
    };
  }
  return state;
}

/**
 * Converts the level progression UI state into `ClassLevelProgression[]` and
 * `ClassFeature[]` arrays to be embedded in `customData`.
 *
 * Features entered as comma-separated names per level row are converted to
 * auto-generated IDs and collected into a flat `ClassFeature[]` list.
 *
 * @param state - The editable level progression state (all 20 rows).
 * @returns Object with `levels` and `features` ready for the API payload.
 */
function buildProgressionPayload(state: LevelProgressionState): {
  levels: ClassLevelProgression[];
  features: ClassFeature[];
} {
  const allFeatures: ClassFeature[] = [];
  const levels: ClassLevelProgression[] = [];

  for (let lvl = 1; lvl <= 20; lvl++) {
    const row = state[lvl];

    const featureNames = row.features
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const featureIds: string[] = featureNames.map((name, idx) => {
      const id = `lv${lvl}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx}`;
      allFeatures.push({ id, name, level: lvl });
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
    if (cantrips != null && !isNaN(cantrips)) entry.cantripsKnown = cantrips;
    if (spellsKnown != null && !isNaN(spellsKnown)) entry.knownSpellsCount = spellsKnown;
    if (hasSlots) entry.spellSlots = slotsObj as Record<SpellSlotLevel, number>;

    levels.push(entry);
  }

  return { levels, features: allFeatures };
}

/**
 * Dialog for creating/editing a campaign class.
 *
 * Organised into two tabs:
 * 1. **Información básica** — name, hit die, saving throws, origin label.
 * 2. **Progresión por nivel** — editable table of per-level features, PB,
 *    cantrips/spells known and spell slots (levels 1–20).
 */
export default function EditClassDialog({
  open,
  classData,
  isCreate = false,
  onClose,
  onSave,
}: EditClassDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [name, setName] = useState('');
  const [hitDie, setHitDie] = useState(8);
  const [primaryAbilities, setPrimaryAbilities] = useState('');
  const [savingThrows, setSavingThrows] = useState('');
  const [customOriginName, setCustomOriginName] = useState('');
  const [levelProgression, setLevelProgression] = useState<LevelProgressionState>(
    createDefaultLevelProgression,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (classData) {
        setName(classData.name || '');
        setHitDie(classData.hitDie || 8);
        setPrimaryAbilities((classData.primaryAbilities || []).join(', '));
        setSavingThrows((classData.savingThrows || []).join(', '));
        setCustomOriginName(classData.customOriginName || '');
        setLevelProgression(initProgressionFromClassData(classData));
      } else {
        setName('');
        setHitDie(8);
        setPrimaryAbilities('');
        setSavingThrows('');
        setCustomOriginName('');
        setLevelProgression(createDefaultLevelProgression());
      }
      setActiveTab(0);
      setError(null);
    }
  }, [open, classData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { levels, features } = buildProgressionPayload(levelProgression);
      const payload: any = {
        customData: {
          name,
          hitDie,
          primaryAbilities: primaryAbilities.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
          savingThrows: savingThrows.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
          levels,
          features,
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
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {isCreate ? t('new_class', 'Nueva Clase') : t('edit_class', 'Editar Clase')}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab label={t('basic_info', 'Información básica')} />
        <Tab label={t('level_progression', 'Progresión por nivel')} />
      </Tabs>

      <DialogContent dividers>
        {/* ── Tab 0: Basic Info ── */}
        {activeTab === 0 && (
          <Box sx={{ maxWidth: 600, mx: 'auto' }}>
            <Grid container spacing={2} columns={12} sx={{ mt: 0 }}>
              <Grid size={12}>
                <TextField
                  label={t('name', 'Nombre')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('hit_die', 'Dado de golpe')}</InputLabel>
                  <Select
                    value={hitDie}
                    label={t('hit_die', 'Dado de golpe')}
                    onChange={(e) => setHitDie(Number(e.target.value))}
                  >
                    {[6, 8, 10, 12].map((d) => (
                      <MenuItem key={d} value={d}>d{d}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}>
                <TextField
                  label={t('custom_origin', 'Nombre de origen')}
                  value={customOriginName}
                  onChange={(e) => setCustomOriginName(e.target.value)}
                  fullWidth
                  placeholder="Homebrew"
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label={t('primary_abilities', 'Habilidades principales')}
                  value={primaryAbilities}
                  onChange={(e) => setPrimaryAbilities(e.target.value)}
                  fullWidth
                  helperText={t('comma_separated', 'Separadas por coma (ej: str, dex)')}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label={t('saving_throws', 'Tiradas de salvación')}
                  value={savingThrows}
                  onChange={(e) => setSavingThrows(e.target.value)}
                  fullWidth
                  helperText={t('comma_separated', 'Separadas por coma (ej: str, con)')}
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ── Tab 1: Level Progression ── */}
        {activeTab === 1 && (
          <ClassLevelProgressionEditor
            value={levelProgression}
            onChange={setLevelProgression}
          />
        )}

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || !name.trim()}
        >
          {saving ? t('saving', 'Guardando...') : t('save', 'Guardar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
