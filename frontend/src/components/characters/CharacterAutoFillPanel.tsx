import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShieldIcon from '@mui/icons-material/Shield';
import StarIcon from '@mui/icons-material/Star';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import TranslateIcon from '@mui/icons-material/Translate';
import CasinoIcon from '@mui/icons-material/Casino';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { getCampaignClass, CampaignClassDetail } from '../../api/classes/classesApi';
import { getCampaignRace, CampaignRaceDetail } from '../../api/races/racesApi';
import type { CharacterPayload } from '../../api/characters';

/* ────────────── Types ────────────── */

/** Minimal item with id+name to resolve autocomplete options. */
export interface OptionItem {
  id: string;
  name: string;
}

/** Summarised suggestions that the panel can propose. */
export interface AutoFillSuggestions {
  /** Hit die string, e.g. "1d10" */
  hitDice?: string;
  /** Max HP at current level (simplified calculation). */
  maxHp?: number;
  /** Proficiency bonus for the level. */
  proficiencyBonus?: number;
  /** Saving throw proficiency keys, e.g. ['str','con']. */
  savingThrows?: string[];
  /** Speed (from race), e.g. "30 ft". */
  speed?: string;
  /** Spellcasting ability key, e.g. 'cha'. */
  spellcastingAbility?: 'int' | 'wis' | 'cha' | null;
  /** Spell save DC (8 + profBonus + abilityMod). */
  spellSaveDC?: number;
  /** Spell attack bonus (profBonus + abilityMod). */
  spellAttackBonus?: number;
  /** Number of cantrips known. */
  cantripsKnown?: number;
  /** Number of spells known (non-cantrip). */
  knownSpellsCount?: number;
  /** Spell slots per level, e.g. { '1': 2, '2': 1 }. */
  spellSlots?: Record<string, number>;
  /** Class features earned up to this level (name + short description). */
  features?: { name: string; level: number; description: string }[];
  /** Race traits (name + description). */
  raceTraits?: { name: string; description: string }[];
  /** Proficiencies text lines to append. */
  proficienciesText?: string;
  /** Languages from race. */
  languages?: string[];
}

/* ────────────── Helpers ────────────── */

const abilityModNum = (score: number | undefined): number => {
  if (score === undefined || score === null) return 0;
  return Math.floor((score - 10) / 2);
};

const ABILITY_LABEL: Record<string, string> = {
  str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR',
};

/**
 * Builds the suggestions object from class + race detail data and current draft.
 */
function buildSuggestions(
  classDetail: CampaignClassDetail | null,
  raceDetail: CampaignRaceDetail | null,
  draft: CharacterPayload,
): AutoFillSuggestions | null {
  const level = draft.level ?? 1;
  const suggestions: AutoFillSuggestions = {};
  let hasSomething = false;

  /* ── Class-derived data ── */
  if (classDetail) {
    const hitDie = classDetail.hitDie;
    if (hitDie) {
      suggestions.hitDice = `${level}d${hitDie}`;
      hasSomething = true;

      // HP: at1stLevel = hitDie + CON mod; higher levels = avg(die/2+1) + CON mod
      const conMod = abilityModNum(draft.con);
      const hpLvl1 = hitDie + conMod;
      const avgRoll = Math.floor(hitDie / 2) + 1;
      const hpHigher = level > 1 ? (level - 1) * (avgRoll + conMod) : 0;
      suggestions.maxHp = Math.max(1, hpLvl1 + hpHigher);
    }

    // Saving throws
    if (classDetail.savingThrows?.length) {
      suggestions.savingThrows = classDetail.savingThrows;
      hasSomething = true;
    }

    // Level progression
    const levels: any[] = classDetail.levels || [];
    const currentLvl = levels.find((l: any) => l.level === level);
    if (currentLvl) {
      if (currentLvl.proficiencyBonus) {
        suggestions.proficiencyBonus = currentLvl.proficiencyBonus;
        hasSomething = true;
      }
      if (currentLvl.cantripsKnown !== undefined) {
        suggestions.cantripsKnown = currentLvl.cantripsKnown;
        hasSomething = true;
      }
      if (currentLvl.knownSpellsCount !== undefined) {
        suggestions.knownSpellsCount = currentLvl.knownSpellsCount;
        hasSomething = true;
      }
      if (currentLvl.spellSlots) {
        const nonZero = Object.fromEntries(
          Object.entries(currentLvl.spellSlots as Record<string, number>).filter(([, v]) => v > 0),
        );
        if (Object.keys(nonZero).length) {
          suggestions.spellSlots = nonZero;
          hasSomething = true;
        }
      }
    }

    // Spellcasting ability
    const sc = classDetail.spellcasting;
    if (sc?.ability) {
      suggestions.spellcastingAbility = sc.ability as 'int' | 'wis' | 'cha';
      const scAbilityMod = abilityModNum((draft as any)[sc.ability]);
      const pb = suggestions.proficiencyBonus ?? draft.proficiencyBonus ?? 2;
      suggestions.spellSaveDC = 8 + pb + scAbilityMod;
      suggestions.spellAttackBonus = pb + scAbilityMod;
      hasSomething = true;
    }

    // Features up to current level
    const features: any[] = classDetail.features || [];
    const relevantFeatures = features
      .filter((f: any) => f.level <= level)
      .map((f: any) => ({ name: f.name, level: f.level, description: f.description || '' }));
    if (relevantFeatures.length) {
      suggestions.features = relevantFeatures;
      hasSomething = true;
    }

    // Proficiencies
    const profParts: string[] = [];
    const cp = classDetail.proficiencies;
    if (cp?.armor?.length) profParts.push(`Armaduras: ${cp.armor.join(', ')}`);
    if (cp?.weapons?.length) profParts.push(`Armas: ${cp.weapons.join(', ')}`);
    if (cp?.tools?.length) profParts.push(`Herramientas: ${cp.tools.join(', ')}`);
    if (profParts.length) {
      suggestions.proficienciesText = profParts.join('\n');
      hasSomething = true;
    }
  }

  /* ── Race-derived data ── */
  if (raceDetail) {
    // Speed
    const walkSpeed = raceDetail.speed?.walk;
    if (walkSpeed) {
      suggestions.speed = `${walkSpeed} ft`;
      hasSomething = true;
    }

    // Languages
    if (raceDetail.languages?.length) {
      suggestions.languages = raceDetail.languages;
      hasSomething = true;
    }

    // Race traits
    const traits: any[] = raceDetail.traits || [];
    if (traits.length) {
      suggestions.raceTraits = traits.map((t: any) => ({
        name: t.name,
        description: t.description || '',
      }));
      hasSomething = true;
    }

    // Race proficiencies
    const rp = raceDetail.proficiencies;
    const raceProfParts: string[] = [];
    if (rp?.weapons?.length) raceProfParts.push(`Armas (raza): ${rp.weapons.join(', ')}`);
    if (rp?.armor?.length) raceProfParts.push(`Armaduras (raza): ${rp.armor.join(', ')}`);
    if (rp?.tools?.length) raceProfParts.push(`Herramientas (raza): ${rp.tools.join(', ')}`);
    if (raceProfParts.length) {
      const existing = suggestions.proficienciesText || '';
      suggestions.proficienciesText = [existing, ...raceProfParts].filter(Boolean).join('\n');
      hasSomething = true;
    }
  }

  return hasSomething ? suggestions : null;
}

/* ────────────── Component ────────────── */

export interface CharacterAutoFillPanelProps {
  draft: CharacterPayload;
  campaignId: string;
  /** Class list items fetched when modal opened (id + name). */
  classItems: OptionItem[];
  /** Race list items fetched when modal opened (id + name). */
  raceItems: OptionItem[];
  /** Callback to apply suggestions to the draft. */
  onApply: (patch: Partial<CharacterPayload>) => void;
  /**
   * The character's level as persisted in the database when the editor was opened.
   * `undefined` means the character has not been saved yet (new character).
   */
  savedLevel?: number;
}

/**
 * Side panel for the character editor that analyses race, class, and level
 * to suggest auto-fill values (HP, hit dice, proficiencies, spellcasting, traits, etc.).
 * The user reviews the suggestions and clicks "Aplicar" to apply them.
 */
export const CharacterAutoFillPanel: React.FC<CharacterAutoFillPanelProps> = ({
  draft,
  campaignId,
  classItems,
  raceItems,
  onApply,
  savedLevel,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AutoFillSuggestions | null>(null);
  const [classDetail, setClassDetail] = useState<CampaignClassDetail | null>(null);
  const [raceDetail, setRaceDetail] = useState<CampaignRaceDetail | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [applied, setApplied] = useState(false);

  const lang = useMemo(() => (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es', []);

  /** Resolve class name → class id from the option items. */
  const matchedClassId = useMemo(() => {
    if (!draft.className) return null;
    const lower = draft.className.toLowerCase();
    return classItems.find(c => c.name.toLowerCase() === lower)?.id ?? null;
  }, [draft.className, classItems]);

  /** Resolve race name → race id from the option items. */
  const matchedRaceId = useMemo(() => {
    if (!draft.race) return null;
    const lower = draft.race.toLowerCase();
    return raceItems.find(r => r.name.toLowerCase() === lower)?.id ?? null;
  }, [draft.race, raceItems]);

  /** Fetch full class/race detail when the matched ids change. */
  const fetchDetails = useCallback(async () => {
    if (!campaignId) return;
    if (!matchedClassId && !matchedRaceId) {
      setClassDetail(null);
      setRaceDetail(null);
      setSuggestions(null);
      return;
    }

    setLoading(true);
    setApplied(false);
    try {
      const [cd, rd] = await Promise.all([
        matchedClassId ? getCampaignClass(campaignId, matchedClassId, lang) : Promise.resolve(null),
        matchedRaceId ? getCampaignRace(campaignId, matchedRaceId, lang) : Promise.resolve(null),
      ]);
      setClassDetail(cd);
      setRaceDetail(rd);
    } catch (err) {
      console.error('[AutoFill] Error fetching details:', err);
      setClassDetail(null);
      setRaceDetail(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, matchedClassId, matchedRaceId, lang]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  /** Re-compute suggestions when detail data or relevant draft fields change. */
  useEffect(() => {
    const s = buildSuggestions(classDetail, raceDetail, draft);
    setSuggestions(s);
    setApplied(false);
  }, [classDetail, raceDetail, draft.level, draft.con, draft.str, draft.dex, draft.int, draft.wis, draft.cha, draft.proficiencyBonus]);

  /* ── HP interactive calculator state ── */
  const [hpRollMethod, setHpRollMethod] = useState<'fixed' | 'random' | 'manual'>('fixed');
  const [hpManualInputStr, setHpManualInputStr] = useState<string>('');
  const [hpRandomRolls, setHpRandomRolls] = useState<number[]>([]);

  /* HP derived values */
  const hitDie = classDetail?.hitDie;
  const conMod = abilityModNum(draft.con);
  const hpLevel = draft.level ?? 1;
  const hpAtLevel1 = hitDie ? hitDie + conMod : 0;
  const avgRollPerLevel = hitDie ? Math.floor(hitDie / 2) + 1 : 0;

  /**
   * Auto-detect whether this is a new character or an existing one gaining levels.
   * - isNewCharacter: no id yet, or no savedLevel recorded → full calculation from L1
   * - levelsGained: difference between draft level and DB level (0 if unchanged/lowered)
   * - hpMode: 'levelup' only when existing character gains at least one level
   */
  const isNewCharacter = !draft.id || savedLevel === undefined || savedLevel <= 0;
  const levelsGained = isNewCharacter ? 0 : Math.max(0, hpLevel - (savedLevel ?? 0));
  const hpMode: 'full' | 'levelup' = (!isNewCharacter && levelsGained > 0) ? 'levelup' : 'full';
  const levelsToRoll = hpMode === 'full' ? Math.max(0, hpLevel - 1) : levelsGained;

  /** Reset random rolls when relevant parameters change. */
  useEffect(() => {
    setHpRandomRolls([]);
    setHpManualInputStr('');
  }, [hitDie, hpLevel, levelsGained, hpMode]);

  /**
   * Computes the resulting HP based on current mode, method, and inputs.
   * Returns null if the user hasn't completed the required input.
   */
  const computedHp = useMemo((): number | null => {
    if (!hitDie) return null;

    if (hpMode === 'full') {
      const rolls = Math.max(0, hpLevel - 1);
      if (rolls === 0) return Math.max(1, hpAtLevel1);
      let hpFromLevels = 0;

      if (hpRollMethod === 'fixed') {
        hpFromLevels = rolls * (avgRollPerLevel + conMod);
      } else if (hpRollMethod === 'random') {
        if (hpRandomRolls.length < rolls) return null;
        hpFromLevels = hpRandomRolls.slice(0, rolls).reduce((sum, r) => sum + r + conMod, 0);
      } else {
        const parsedManual = parseInt(hpManualInputStr, 10);
        if (!parsedManual || parsedManual <= 0) return null;
        hpFromLevels = parsedManual + rolls * conMod;
      }

      return Math.max(1, hpAtLevel1 + hpFromLevels);
    }

    /* Level-up mode: add HP for the automatically detected new levels */
    const existingHp = draft.maxHp ?? 0;
    let delta = 0;

    if (hpRollMethod === 'fixed') {
      delta = levelsGained * (avgRollPerLevel + conMod);
    } else if (hpRollMethod === 'random') {
      if (hpRandomRolls.length < levelsGained) return null;
      delta = hpRandomRolls.slice(0, levelsGained).reduce((sum, r) => sum + r + conMod, 0);
    } else {
      const parsedManual = parseInt(hpManualInputStr, 10);
      if (!parsedManual || parsedManual <= 0) return null;
      delta = parsedManual + levelsGained * conMod;
    }

    return Math.max(1, existingHp + delta);
  }, [hitDie, hpMode, hpRollMethod, hpRandomRolls, hpManualInputStr,
      levelsGained, hpLevel, conMod, hpAtLevel1, avgRollPerLevel, draft.maxHp]);

  /** Roll random dice for HP calculation. */
  const handleRollHp = () => {
    if (!hitDie) return;
    const rolls = Array.from({ length: levelsToRoll }, () =>
      Math.floor(Math.random() * hitDie) + 1,
    );
    setHpRandomRolls(rolls);
  };

  /** Build the CharacterPayload patch from the suggestions. */
  const handleApply = () => {
    if (!suggestions) return;
    const patch: Partial<CharacterPayload> = {};

    if (suggestions.hitDice) patch.hitDice = suggestions.hitDice;
    const hpValue = computedHp ?? suggestions.maxHp;
    if (hpValue !== undefined && hpValue !== null) {
      if (hpMode === 'levelup' && draft.maxHp) {
        const delta = hpValue - draft.maxHp;
        patch.maxHp = hpValue;
        patch.currentHp = Math.max(1, (draft.currentHp ?? draft.maxHp) + delta);
      } else {
        patch.maxHp = hpValue;
        patch.currentHp = hpValue;
      }
    }
    if (suggestions.proficiencyBonus !== undefined) patch.proficiencyBonus = suggestions.proficiencyBonus;
    if (suggestions.speed) patch.speed = suggestions.speed;
    if (suggestions.spellcastingAbility !== undefined) patch.spellcastingAbility = suggestions.spellcastingAbility;
    if (suggestions.spellSaveDC !== undefined) patch.spellSaveDC = suggestions.spellSaveDC;
    if (suggestions.spellAttackBonus !== undefined) patch.spellAttackBonus = suggestions.spellAttackBonus;

    // Saving throws
    if (suggestions.savingThrows?.length) {
      const stProfs: Record<string, boolean> = {};
      suggestions.savingThrows.forEach(k => { stProfs[k] = true; });
      patch.savingThrowProficiencies = stProfs;
    }

    // Traits: collect names for selectedTraits array + descriptions for traitsAndFeatures text
    const traitNames: string[] = [];
    const traitLines: string[] = [];
    if (suggestions.features?.length) {
      traitLines.push('── ' + t('class_features', 'Rasgos de Clase') + ' ──');
      suggestions.features.forEach(f => {
        traitNames.push(f.name);
        traitLines.push(`• ${f.name}`);
      });
    }
    if (suggestions.raceTraits?.length) {
      traitLines.push('');
      traitLines.push('── ' + t('race_traits', 'Rasgos Raciales') + ' ──');
      suggestions.raceTraits.forEach(rt => {
        traitNames.push(rt.name);
        traitLines.push(`• ${rt.name}`);
      });
    }
    if (traitNames.length) {
      const existing = draft.selectedTraits ?? [];
      const merged = [...existing];
      for (const name of traitNames) {
        if (!merged.some(e => e.toLowerCase() === name.toLowerCase())) {
          merged.push(name);
        }
      }
      patch.selectedTraits = merged;
    }
    if (traitLines.length) {
      const existing = draft.traitsAndFeatures?.trim() ?? '';
      // Strip any previous assistant-generated block (everything from the first '──' marker
      // onwards), keeping only user-typed content that appears before it.
      const markerIdx = existing.indexOf('──');
      const userContent = markerIdx > 0
        ? existing.slice(0, markerIdx).trim()
        : markerIdx === 0 ? '' : existing;
      patch.traitsAndFeatures = userContent
        ? userContent + '\n\n' + traitLines.join('\n')
        : traitLines.join('\n');
    }

    // Proficiencies & languages text
    const profLines: string[] = [];
    if (suggestions.proficienciesText) profLines.push(suggestions.proficienciesText);
    if (suggestions.languages?.length) {
      profLines.push(`Idiomas: ${suggestions.languages.join(', ')}`);
    }
    if (profLines.length) {
      patch.otherProficienciesAndLanguages = profLines.join('\n');
    }

    onApply(patch);
    setApplied(true);
  };

  /* ── Render ── */

  const hasInput = !!(draft.className || draft.race);

  if (!hasInput) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <AutoFixHighIcon sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {t('autofill_hint', 'Selecciona una clase y/o raza para obtener sugerencias automáticas.')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoFixHighIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
            {t('autofill_assistant', 'Asistente de Ficha')}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>

      {/* Status chips */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        {draft.className && (
          <Chip
            size="small"
            label={draft.className}
            color={matchedClassId ? 'primary' : 'default'}
            variant={matchedClassId ? 'filled' : 'outlined'}
            sx={{ fontSize: '0.7rem' }}
          />
        )}
        {draft.race && (
          <Chip
            size="small"
            label={draft.race}
            color={matchedRaceId ? 'secondary' : 'default'}
            variant={matchedRaceId ? 'filled' : 'outlined'}
            sx={{ fontSize: '0.7rem' }}
          />
        )}
        <Chip size="small" label={`Nv. ${draft.level ?? 1}`} variant="outlined" sx={{ fontSize: '0.7rem' }} />
      </Stack>

      {!matchedClassId && draft.className && (
        <Alert severity="info" sx={{ mb: 1, py: 0, '& .MuiAlert-message': { fontSize: '0.7rem' } }}>
          {t('class_not_in_campaign', 'Clase no encontrada en la campaña. Añádela al compendio para obtener sugerencias.')}
        </Alert>
      )}
      {!matchedRaceId && draft.race && (
        <Alert severity="info" sx={{ mb: 1, py: 0, '& .MuiAlert-message': { fontSize: '0.7rem' } }}>
          {t('race_not_in_campaign', 'Raza no encontrada en la campaña. Añádela al compendio para obtener sugerencias.')}
        </Alert>
      )}

      {loading && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      <Collapse in={expanded && !loading}>
        {suggestions ? (
          <>
            {/* ── Interactive HP calculator ── */}
            {hitDie && (
              <Box sx={{ mb: 1.5, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <FavoriteIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    {t('hit_points', 'Puntos de Golpe')}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {t('hit_die', 'Dado de golpe')}: d{hitDie} &nbsp;|&nbsp; Mod CON: {conMod >= 0 ? '+' : ''}{conMod}
                </Typography>

                {/* Auto-detected level context — replaces the old manual mode toggle */}
                <Box sx={{ mb: 0.5, px: 0.5, py: 0.25, bgcolor: 'action.selected', borderRadius: 1 }}>
                  {isNewCharacter ? (
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                      {t('new_character_hp_info', 'Personaje nuevo — calculando desde nivel 1 hasta nivel')} <b>{hpLevel}</b>
                    </Typography>
                  ) : hpMode === 'levelup' ? (
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'success.main' }}>
                      {t('levelup_hp_info', 'Subiendo de nivel')} <b>{savedLevel}</b> → <b>{hpLevel}</b>{' '}
                      (+{levelsGained} {levelsGained === 1 ? t('level', 'nivel') : t('levels', 'niveles')})
                      &nbsp;· HP actual: <b>{draft.maxHp ?? 0}</b>
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                      {t('recalc_hp_info', 'Nivel sin cambios (BD: {saved} → Draft: {draft}) — recalculando HP completo').replace('{saved}', String(savedLevel ?? '?')).replace('{draft}', String(hpLevel))}
                    </Typography>
                  )}
                </Box>

                {/* Level 1 base (only in full calc mode) */}
                {hpMode === 'full' && (
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.3, fontSize: '0.7rem' }}>
                    Nv.1: {hitDie} + ({conMod >= 0 ? '+' : ''}{conMod}) = <b>{hpAtLevel1}</b>
                  </Typography>
                )}

                {/* Method picker: only if there are levels to roll */}
                {levelsToRoll > 0 && (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.3, fontSize: '0.65rem' }}>
                      {hpMode === 'full'
                        ? `${t('levels', 'Niveles')} 2\u2013${hpLevel}:`
                        : `${levelsGained} ${levelsGained === 1 ? 'nivel' : 'niveles'}:`
                      }{' '}
                      {levelsToRoll}d{hitDie}
                    </Typography>
                    <ToggleButtonGroup
                      value={hpRollMethod}
                      exclusive
                      onChange={(_, v) => {
                        if (!v) return;
                        setHpRollMethod(v);
                        setHpRandomRolls([]);
                        setHpManualInputStr('');
                      }}
                      size="small"
                      fullWidth
                      sx={{ mb: 0.5, '& .MuiToggleButton-root': { fontSize: '0.6rem', py: 0.2, textTransform: 'none' } }}
                    >
                      <ToggleButton value="fixed">
                        {t('fixed_value', 'Fijo')} ({avgRollPerLevel})
                      </ToggleButton>
                      <ToggleButton value="random">
                        {t('random_roll', 'Aleatorio')}
                      </ToggleButton>
                      <ToggleButton value="manual">
                        {t('manual_entry', 'Manual')}
                      </ToggleButton>
                    </ToggleButtonGroup>

                    {/* Fixed breakdown */}
                    {hpRollMethod === 'fixed' && (
                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', color: 'text.secondary' }}>
                        {levelsToRoll} x ({avgRollPerLevel} + {conMod}) = <b>{levelsToRoll * (avgRollPerLevel + conMod)}</b>
                      </Typography>
                    )}

                    {/* Random dice roll */}
                    {hpRollMethod === 'random' && (
                      <Box>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CasinoIcon sx={{ fontSize: 14 }} />}
                          onClick={handleRollHp}
                          sx={{ fontSize: '0.65rem', py: 0.2, mb: 0.3, textTransform: 'none' }}
                        >
                          {hpRandomRolls.length > 0 ? t('reroll', 'Volver a tirar') : t('roll_dice', 'Tirar dados')}
                        </Button>
                        {hpRandomRolls.length > 0 && (
                          <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem' }}>
                            {hpRandomRolls.join(' + ')} = {hpRandomRolls.reduce((a, b) => a + b, 0)}
                            {conMod !== 0 && ` (+ CON x${levelsToRoll})`}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Manual input */}
                    {hpRollMethod === 'manual' && (
                      <TextField
                        type="text"
                        size="small"
                        label={
                          levelsToRoll === 1
                            ? `${t('your_roll', 'Tu tirada')} (d${hitDie})`
                            : `${t('dice_total', 'Suma de tus tiradas')} (${levelsToRoll}d${hitDie})`
                        }
                        value={hpManualInputStr}
                        onChange={(e) => setHpManualInputStr(e.target.value.replace(/[^0-9]/g, ''))}
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                        fullWidth
                        sx={{ '& input': { py: 0.5, fontSize: '0.8rem' } }}
                        helperText={
                          conMod !== 0
                            ? `+ CON (${conMod >= 0 ? '+' : ''}${conMod})${levelsToRoll > 1 ? ` x${levelsToRoll}` : ''}`
                            : undefined
                        }
                        FormHelperTextProps={{ sx: { fontSize: '0.6rem', mx: 0 } }}
                      />
                    )}
                  </>
                )}

                {/* Computed HP result */}
                {computedHp !== null && (
                  <Box sx={{ mt: 0.5, py: 0.5, bgcolor: 'action.hover', borderRadius: 1, textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main', lineHeight: 1.2, fontSize: '1.1rem' }}>
                      {computedHp} HP
                    </Typography>
                    {hpMode === 'levelup' && draft.maxHp != null && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                        ({draft.maxHp} + {computedHp - draft.maxHp})
                      </Typography>
                    )}
                    {suggestions?.hitDice && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.6rem' }}>
                        {t('hit_dice', 'Dados de Golpe')}: {suggestions.hitDice}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}

            <List dense disablePadding sx={{ '& .MuiListItemText-primary': { fontSize: '0.8rem' }, '& .MuiListItemText-secondary': { fontSize: '0.7rem' } }}>
              {/* Proficiency Bonus */}
              {suggestions.proficiencyBonus !== undefined && (
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${t('proficiency_bonus', 'Competencia')}: +${suggestions.proficiencyBonus}`}
                  />
                </ListItem>
              )}

              {/* Speed */}
              {suggestions.speed && (
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <ShieldIcon sx={{ fontSize: 16, color: 'info.main' }} />
                  </ListItemIcon>
                  <ListItemText primary={`${t('speed', 'Velocidad')}: ${suggestions.speed}`} />
                </ListItem>
              )}

              {/* Saving Throws */}
              {suggestions.savingThrows?.length ? (
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <ShieldIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('saving_throws', 'Tiradas de Salvación')}
                    secondary={suggestions.savingThrows.map(k => ABILITY_LABEL[k] || k.toUpperCase()).join(', ')}
                  />
                </ListItem>
              ) : null}

              {/* Spellcasting */}
              {suggestions.spellcastingAbility && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <FlashOnIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${t('spellcasting_ability', 'Aptitud Mágica')}: ${ABILITY_LABEL[suggestions.spellcastingAbility] || suggestions.spellcastingAbility.toUpperCase()}`}
                      secondary={[
                        suggestions.spellSaveDC !== undefined ? `CD: ${suggestions.spellSaveDC}` : null,
                        suggestions.spellAttackBonus !== undefined ? `Ataque: +${suggestions.spellAttackBonus}` : null,
                      ].filter(Boolean).join(' | ')}
                    />
                  </ListItem>
                  {suggestions.cantripsKnown !== undefined && (
                    <ListItem disableGutters sx={{ pl: 3.5 }}>
                      <ListItemText
                        primary={`${t('cantrips', 'Trucos')}: ${suggestions.cantripsKnown}`}
                      />
                    </ListItem>
                  )}
                  {suggestions.knownSpellsCount !== undefined && (
                    <ListItem disableGutters sx={{ pl: 3.5 }}>
                      <ListItemText
                        primary={`${t('spells_known', 'Conjuros conocidos')}: ${suggestions.knownSpellsCount}`}
                      />
                    </ListItem>
                  )}
                  {suggestions.spellSlots && (
                    <ListItem disableGutters sx={{ pl: 3.5 }}>
                      <ListItemText
                        primary={t('spell_slots', 'Espacios de Conjuro')}
                        secondary={Object.entries(suggestions.spellSlots).map(([lvl, n]) => `Nv.${lvl}: ${n}`).join(', ')}
                      />
                    </ListItem>
                  )}
                </>
              )}

              {/* Class Features */}
              {suggestions.features?.length ? (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <MenuBookIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${t('class_features', 'Rasgos de Clase')} (${suggestions.features.length})`}
                    />
                  </ListItem>
                  {suggestions.features.map((f, i) => (
                    <ListItem key={i} disableGutters sx={{ pl: 3.5 }}>
                      <ListItemText
                        primary={`${f.name} (Nv. ${f.level})`}
                        secondary={f.description.length > 120 ? f.description.slice(0, 120) + '…' : f.description}
                      />
                    </ListItem>
                  ))}
                </>
              ) : null}

              {/* Race Traits */}
              {suggestions.raceTraits?.length ? (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <MenuBookIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${t('race_traits', 'Rasgos Raciales')} (${suggestions.raceTraits.length})`}
                    />
                  </ListItem>
                  {suggestions.raceTraits.map((rt, i) => (
                    <ListItem key={i} disableGutters sx={{ pl: 3.5 }}>
                      <ListItemText
                        primary={rt.name}
                        secondary={rt.description.length > 120 ? rt.description.slice(0, 120) + '…' : rt.description}
                      />
                    </ListItem>
                  ))}
                </>
              ) : null}

              {/* Proficiencies & Languages */}
              {(suggestions.proficienciesText || suggestions.languages?.length) ? (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <TranslateIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={t('proficiencies_and_languages', 'Competencias e Idiomas')}
                      secondary={[
                        suggestions.proficienciesText || '',
                        suggestions.languages?.length ? `Idiomas: ${suggestions.languages.join(', ')}` : '',
                      ].filter(Boolean).join('\n')}
                      secondaryTypographyProps={{ whiteSpace: 'pre-line' }}
                    />
                  </ListItem>
                </>
              ) : null}
            </List>

            {/* Apply button */}
            <Box sx={{ mt: 2 }}>
              {applied ? (
                <Button
                  fullWidth
                  variant="outlined"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  disabled
                  size="small"
                >
                  {t('applied', 'Aplicado')}
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AutoFixHighIcon />}
                  onClick={handleApply}
                  size="small"
                >
                  {t('apply_suggestions', 'Aplicar sugerencias')}
                </Button>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center', fontSize: '0.65rem' }}>
              {t('autofill_warning', 'Sobrescribirá los campos correspondientes de la ficha.')}
            </Typography>
          </>
        ) : (
          !loading && (matchedClassId || matchedRaceId) && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              {t('no_suggestions', 'No se han podido generar sugerencias con los datos disponibles.')}
            </Typography>
          )
        )}
      </Collapse>
    </Box>
  );
};
