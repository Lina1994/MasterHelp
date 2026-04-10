import React, { useMemo, useState } from 'react';
import { CharacterPayload, updateCharacter, createCharacter } from '../../api/characters';
import { listMaps, MapItemDto } from '../../api/maps';
import { listCampaignClasses } from '../../api/classes/classesApi';
import { listCampaignRaces } from '../../api/races/racesApi';
import { listCampaignBackgrounds } from '../../api/backgrounds/backgroundsApi';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import {
  Avatar,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  Fab,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slide,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import ShieldIcon from '@mui/icons-material/Shield';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { ImageUploader } from '../Campaign/ImageUploader';
import { TokenImageCropDialog } from './TokenImageCropDialog';
import { SpellAutocomplete } from './SpellAutocomplete';
import { TraitAutocomplete } from './TraitAutocomplete';
import { FeatAutocomplete } from './FeatAutocomplete';
import { CharacterAutoFillPanel, OptionItem } from './CharacterAutoFillPanel';
import CharacterRelationsSection from './CharacterRelationsSection';
import { useManualNames } from '../../hooks/useManualNames';

/** Option entry that carries the source manual for disambiguation. */
interface LabeledOption { name: string; sourceManual?: string | null }

/* ──────────────────── helpers ──────────────────── */

/**
 * Returns the initials (first + last) of a given name string.
 * @param name - Character name.
 * @returns Uppercase initials (1‑2 chars) or '?'.
 */
const getInitials = (name: string | undefined | null): string => {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
  return (a + b).toUpperCase();
};

/**
 * Computes the ability modifier string for a given ability score.
 * @param score - Ability score (e.g. 10, 14, 8).
 * @returns Formatted modifier string (e.g. "+0", "+2", "-1").
 */
const abilityMod = (score: number | undefined): string => {
  if (score === undefined || score === null) return '+0';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

/* ──────────────────── constants ──────────────────── */

/** The six ability keys used for saving throws. */
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/**
 * D&D 5e skill definitions: internal key, i18n label key with Spanish fallback,
 * and the governing ability.
 */
const SKILL_DEFS: { key: string; labelKey: string; fallback: string; ability: typeof ABILITY_KEYS[number] }[] = [
  { key: 'acrobatics',      labelKey: 'skill_acrobatics',      fallback: 'Acrobacias',         ability: 'dex' },
  { key: 'athletics',       labelKey: 'skill_athletics',       fallback: 'Atletismo',          ability: 'str' },
  { key: 'arcana',          labelKey: 'skill_arcana',          fallback: 'C. Arcano',          ability: 'int' },
  { key: 'deception',       labelKey: 'skill_deception',       fallback: 'Engaño',             ability: 'cha' },
  { key: 'history',         labelKey: 'skill_history',         fallback: 'Historia',           ability: 'int' },
  { key: 'performance',     labelKey: 'skill_performance',     fallback: 'Interpretación',     ability: 'cha' },
  { key: 'intimidation',    labelKey: 'skill_intimidation',    fallback: 'Intimidación',       ability: 'cha' },
  { key: 'investigation',   labelKey: 'skill_investigation',   fallback: 'Investigación',      ability: 'int' },
  { key: 'sleightOfHand',   labelKey: 'skill_sleight_of_hand', fallback: 'Juego de Manos',     ability: 'dex' },
  { key: 'medicine',        labelKey: 'skill_medicine',        fallback: 'Medicina',           ability: 'wis' },
  { key: 'nature',          labelKey: 'skill_nature',          fallback: 'Naturaleza',         ability: 'int' },
  { key: 'perception',      labelKey: 'skill_perception',      fallback: 'Percepción',         ability: 'wis' },
  { key: 'insight',         labelKey: 'skill_insight',         fallback: 'Perspicacia',        ability: 'wis' },
  { key: 'persuasion',      labelKey: 'skill_persuasion',      fallback: 'Persuasión',         ability: 'cha' },
  { key: 'religion',        labelKey: 'skill_religion',        fallback: 'Religión',           ability: 'int' },
  { key: 'stealth',         labelKey: 'skill_stealth',         fallback: 'Sigilo',             ability: 'dex' },
  { key: 'survival',        labelKey: 'skill_survival',        fallback: 'Supervivencia',      ability: 'wis' },
  { key: 'animalHandling',  labelKey: 'skill_animal_handling', fallback: 'T. con Animales',    ability: 'wis' },
];

/**
 * Computes a numeric ability modifier for a given score.
 * @param score - Ability score (e.g. 10, 14, 8).
 * @returns Numeric modifier (e.g. 0, 2, -1).
 */
const abilityModNum = (score: number | undefined): number => {
  if (score === undefined || score === null) return 0;
  return Math.floor((score - 10) / 2);
};

/**
 * Formats a numeric modifier with a sign prefix.
 * @param mod - Numeric modifier.
 * @returns Formatted string (e.g. "+2", "-1", "+0").
 */
const formatMod = (mod: number): string => (mod >= 0 ? `+${mod}` : `${mod}`);

/* ──────────────────── sub-components ──────────────────── */

/**
 * Editable ability score block matching the D&D character sheet style.
 * Shows the abbreviation, auto-calculated modifier, and a small number input.
 */
const EditableAbilityBlock: React.FC<{
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => {
  const score = value ?? 10;
  return (
    <Paper
      variant="outlined"
      sx={{
        width: 80,
        textAlign: 'center',
        py: 1,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {abilityMod(score)}
      </Typography>
      <TextField
        type="number"
        value={score}
        onChange={(e) => onChange(Number(e.target.value))}
        size="small"
        sx={{
          width: 48,
          '& .MuiOutlinedInput-root': { borderRadius: '50%' },
          '& .MuiInputBase-input': { textAlign: 'center', p: '4px', fontSize: '0.75rem', fontWeight: 600 },
        }}
      />
    </Paper>
  );
};

/**
 * Editable stat box for AC / Initiative / Speed.
 * Mirrors the read-only StatBox from the detail page but with an input field.
 */
const EditableStatBox: React.FC<{
  label: string;
  value: string | number | undefined | null;
  onChange: (v: string) => void;
  type?: string;
  icon?: React.ReactNode;
}> = ({ label, value, onChange, type = 'text', icon }) => (
  <Paper
    variant="outlined"
    sx={{
      flex: 1,
      textAlign: 'center',
      py: 1,
      px: 1,
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.5,
    }}
  >
    {icon}
    <TextField
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      size="small"
      sx={{
        width: 72,
        '& .MuiInputBase-input': { textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' },
      }}
    />
    <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: 0.5 }}>
      {label}
    </Typography>
  </Paper>
);

/**
 * Labeled section card with a title highlight stripe.
 * Identical to the one used on CharacterDetailPage for visual consistency.
 */
const SheetSection: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
    <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
        {title}
      </Typography>
    </Box>
    <Box sx={{ p: 1.5 }}>
      {children}
    </Box>
  </Paper>
);

/**
 * A single row in the saving-throws / skills list: proficiency checkbox,
 * auto-calculated modifier, and label.
 */
const ProficiencyRow: React.FC<{
  label: string;
  proficient: boolean;
  modifier: number;
  onToggle: () => void;
}> = ({ label, proficient, modifier, onToggle }) => (
  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ py: 0.15 }}>
    <Checkbox
      size="small"
      checked={proficient}
      onChange={onToggle}
      sx={{ p: 0.25 }}
    />
    <Typography
      variant="body2"
      sx={{ width: 32, textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'monospace' }}
    >
      {formatMod(modifier)}
    </Typography>
    <Typography variant="body2" sx={{ fontSize: '0.8rem', ml: 0.5 }}>
      {label}
    </Typography>
  </Stack>
);



/* ──────────────────── main component ──────────────────── */

export interface CharacterEditorModalProps {
  open: boolean;
  initialDraft: CharacterPayload | null;
  onClose: () => void;
  onSaved?: (updated: CharacterPayload) => void;
  campaignPlayers: { id: number; label: string }[];
  isMaster: boolean;
}

/**
 * Full-screen–style character editor modal styled to match the D&D character
 * sheet layout used by `CharacterDetailPage`.  All fields are editable inline
 * within the familiar sheet columns and SheetSection cards.
 */
export const CharacterEditorModal: React.FC<CharacterEditorModalProps> = ({
  open,
  initialDraft,
  onClose,
  onSaved,
  campaignPlayers,
  isMaster,
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CharacterPayload | null>(initialDraft);
  const [tab, setTab] = useState(0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [maps, setMaps] = useState<MapItemDto[]>([]);
  const [classOptions, setClassOptions] = useState<LabeledOption[]>([]);
  const [classItems, setClassItems] = useState<OptionItem[]>([]);
  const [raceOptions, setRaceOptions] = useState<LabeledOption[]>([]);
  const [raceItems, setRaceItems] = useState<OptionItem[]>([]);
  const [backgroundOptions, setBackgroundOptions] = useState<LabeledOption[]>([]);
  const { getManualName } = useManualNames();

  React.useEffect(() => {
    setDraft(initialDraft);
    setTab(0);
    setErrorText(null);
    // Load maps + class/race/background options when opening the editor
    if (open && initialDraft?.campaignId) {
      const cId = initialDraft.campaignId;
      console.log('[CharacterEditorModal] Opening editor for campaign:', cId);
      (async () => {
        try {
          const data = await listMaps({ campaignId: cId });
          console.log('[CharacterEditorModal] Loaded maps:', data.length, data);
          setMaps(data);
        } catch (err) {
          console.error('[CharacterEditorModal] loadMaps failed:', err);
          setMaps([]);
        }
      })();
      const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';
      // Load class names
      listCampaignClasses(cId, { pageSize: 500 }, lang)
        .then(res => {
          const items = res.items || [];
          setClassOptions(items.map((c: any) => ({ name: c.name, sourceManual: c.sourceManual ?? null })).filter((c: LabeledOption) => c.name));
          setClassItems(items.map((c: any) => ({ id: c.id, name: c.name })).filter((c: OptionItem) => c.id && c.name));
        })
        .catch(() => { setClassOptions([]); setClassItems([]); });
      // Load race names
      listCampaignRaces(cId, { pageSize: 500 }, lang)
        .then(res => {
          const items = res.items || [];
          setRaceOptions(items.map((r: any) => ({ name: r.name, sourceManual: r.sourceManual ?? null })).filter((r: LabeledOption) => r.name));
          setRaceItems(items.map((r: any) => ({ id: r.id, name: r.name })).filter((r: OptionItem) => r.id && r.name));
        })
        .catch(() => { setRaceOptions([]); setRaceItems([]); });
      // Load background names
      listCampaignBackgrounds(cId, { pageSize: 500 }, lang)
        .then(res => setBackgroundOptions((res.items || []).map((b: any) => ({ name: b.name, sourceManual: b.sourceManual ?? null })).filter((b: LabeledOption) => b.name)))
        .catch(() => setBackgroundOptions([]));
    } else {
      setMaps([]);
      setClassOptions([]);
      setClassItems([]);
      setRaceOptions([]);
      setRaceItems([]);
      setBackgroundOptions([]);
    }
  }, [initialDraft, open]);

  /**
   * Persists the current draft to the backend (create or update).
   * Strips read-only / relational fields before sending.
   */
  const onSave = async () => {
    if (!draft) return;
    const { ownerPlayer, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, createdBy: _createdBy, campaign: _campaign, ...rest } = draft as any;
    const payload: Partial<CharacterPayload> = { ...rest };
    delete (payload as any).ownerPlayer;
    if (payload.ownerPlayerId === undefined && (draft as any).ownerPlayer?.id !== undefined) {
      payload.ownerPlayerId = (draft as any).ownerPlayer?.id ?? null;
    }
    if (payload.ownerPlayerId === ('' as any)) {
      payload.ownerPlayerId = null;
    }
    if ((payload as any).spellcastingAbility === '' || (payload as any).spellcastingAbility === null) {
      delete (payload as any).spellcastingAbility;
    }
    if ((payload as any).spellSaveDC === '' || (payload as any).spellSaveDC === null) {
      delete (payload as any).spellSaveDC;
    }
    if ((payload as any).spellAttackBonus === '' || (payload as any).spellAttackBonus === null) {
      delete (payload as any).spellAttackBonus;
    }
    if (!(payload as any).tokenKind) {
      delete (payload as any).tokenKind;
    }
    try {
      let updated: CharacterPayload;
      if (draft.id) {
        updated = await updateCharacter(draft.id, payload);
      } else {
        updated = await createCharacter(payload as CharacterPayload);
      }
      setErrorText(null);
      onClose();
      if (onSaved) onSaved(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al guardar';
      setErrorText(Array.isArray(msg) ? msg.join(', ') : String(msg));
      console.error('[CharacterEditorModal] Save failed:', err?.response?.data || err);
    }
  };

  /** Whether the token image crop dialog can be opened. */
  const canCropToken = useMemo(() => {
    return draft?.tokenKind === 'image' && typeof draft?.tokenImageUrl === 'string' && draft.tokenImageUrl.trim().length > 0;
  }, [draft?.tokenKind, draft?.tokenImageUrl]);

  if (!draft) return null;

  /** Ability labels localised. */
  const abilityLabels: Record<string, string> = {
    str: t('str', 'FUE'),
    dex: t('dex', 'DES'),
    con: t('con', 'CON'),
    int: t('int', 'INT'),
    wis: t('wis', 'SAB'),
    cha: t('cha', 'CAR'),
  };

  return (
    <>
      {/* ═══════════════ AUTOFILL PANEL — outside Dialog ═══════════════ */}
      {open && (
        <Box
          sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            zIndex: (theme) => theme.zIndex.modal + 1,
            display: { xs: 'none', md: 'flex' },
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Positioning wrapper aligned to Dialog top-left */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              maxWidth: (theme) => theme.breakpoints.values.xl,
              height: '90vh',
              pointerEvents: 'none',
            }}
          >
            {/* Collapsed FAB */}
            {!assistantOpen && (
              <Fab
                size="small"
                color="primary"
                onClick={() => setAssistantOpen(true)}
                sx={{
                  position: 'absolute',
                  left: -52,
                  top: 12,
                  pointerEvents: 'auto',
                  zIndex: 1,
                }}
              >
                <AutoFixHighIcon fontSize="small" />
              </Fab>
            )}

            {/* Expanded panel */}
            <Slide direction="right" in={assistantOpen} mountOnEnter unmountOnExit>
              <Paper
                elevation={6}
                sx={{
                  position: 'absolute',
                  left: -310,
                  top: 0,
                  width: 300,
                  height: '100%',
                  overflow: 'auto',
                  pointerEvents: 'auto',
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 0.5 }}>
                  <IconButton size="small" onClick={() => setAssistantOpen(false)}>
                    <AutoFixHighIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <CharacterAutoFillPanel
                    draft={draft}
                    campaignId={draft.campaignId}
                    classItems={classItems}
                    raceItems={raceItems}
                    onApply={(patch) => setDraft({ ...draft, ...patch })}
                    savedLevel={initialDraft?.id ? (initialDraft.level ?? 0) : undefined}
                  />
                </Box>
              </Paper>
            </Slide>
          </Box>
        </Box>
      )}

    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth disableEnforceFocus>
      <DialogContent sx={{ p: 0 }}>
        <Stack direction="row" sx={{ minHeight: 0 }}>

        {/* ═══════════════ D&D-STYLE EDITOR SHEET ═══════════════ */}
        <Box sx={{ flex: 1, minWidth: 0 }}>

        {/* ── TITLE STRIP ── */}
        <Box sx={{ bgcolor: 'primary.dark', color: 'primary.contrastText', px: 2, py: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            {draft.id ? t('edit_character', 'Editar personaje') : t('new_character', 'Nuevo personaje')}
          </Typography>
        </Box>

        {/* ── HEADER FIELDS (normal background for readability) ── */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          {/* Row: Avatar + Name + Kind + Visibility */}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5 }}>
            {draft.tokenKind === 'image' && draft.tokenImageUrl ? (
              <Avatar src={draft.tokenImageUrl} alt={draft.name} sx={{ width: 56, height: 56, border: '2px solid', borderColor: 'primary.main' }} />
            ) : (
              <Avatar sx={{ bgcolor: draft.tokenColor || '#607d8b', width: 56, height: 56, fontSize: 20, fontWeight: 700, border: '2px solid', borderColor: 'primary.main' }}>
                {getInitials(draft.name)}
              </Avatar>
            )}
            <TextField
              variant="outlined"
              size="small"
              label={t('name', 'Nombre')}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              sx={{ flex: 1, minWidth: 180, '& .MuiInputBase-input': { fontSize: '1.2rem', fontWeight: 700 } }}
            />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={draft.kind}
              onChange={(_, val) => val && setDraft({ ...draft, kind: val })}
            >
              <ToggleButton value="pc">{t('pc', 'PC')}</ToggleButton>
              <ToggleButton value="npc">{t('npc', 'NPC')}</ToggleButton>
            </ToggleButtonGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!draft.visibleToPlayers}
                  onChange={(e) => setDraft({ ...draft, visibleToPlayers: e.target.checked })}
                  disabled={!isMaster}
                />
              }
              label={<Typography variant="caption">{t('visible', 'Visible')}</Typography>}
            />
          </Stack>

          {/* Row: Meta fields */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Autocomplete
              freeSolo
              size="small"
              options={classOptions}
              getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
              isOptionEqualToValue={(opt, val) => (typeof opt === 'string' ? opt : opt.name) === (typeof val === 'string' ? val : val.name)}
              filterOptions={(options, state) => options.filter(o => o.name.toLowerCase().includes(state.inputValue.toLowerCase()))}
              renderOption={(props, opt) => {
                const o = typeof opt === 'string' ? { name: opt } as LabeledOption : opt;
                return <li {...props} key={`${o.name}-${o.sourceManual ?? ''}`}>{o.name}{o.sourceManual ? <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({getManualName(o.sourceManual)})</Typography> : null}</li>;
              }}
              value={draft.className || ''}
              onInputChange={(_e, val) => setDraft({ ...draft, className: val })}
              renderInput={(params) => <TextField {...params} label={t('class', 'Clase')} />}
              sx={{ width: 180 }}
            />
            <TextField size="small" type="number" label={t('level', 'Nivel')} value={draft.level ?? 1} onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })} sx={{ width: 70 }} />
            <Autocomplete
              freeSolo
              size="small"
              options={raceOptions}
              getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
              isOptionEqualToValue={(opt, val) => (typeof opt === 'string' ? opt : opt.name) === (typeof val === 'string' ? val : val.name)}
              filterOptions={(options, state) => options.filter(o => o.name.toLowerCase().includes(state.inputValue.toLowerCase()))}
              renderOption={(props, opt) => {
                const o = typeof opt === 'string' ? { name: opt } as LabeledOption : opt;
                return <li {...props} key={`${o.name}-${o.sourceManual ?? ''}`}>{o.name}{o.sourceManual ? <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({getManualName(o.sourceManual)})</Typography> : null}</li>;
              }}
              value={draft.race || ''}
              onInputChange={(_e, val) => setDraft({ ...draft, race: val })}
              renderInput={(params) => <TextField {...params} label={t('race', 'Raza')} />}
              sx={{ width: 180 }}
            />
            <Autocomplete
              freeSolo
              size="small"
              options={backgroundOptions}
              getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
              isOptionEqualToValue={(opt, val) => (typeof opt === 'string' ? opt : opt.name) === (typeof val === 'string' ? val : val.name)}
              filterOptions={(options, state) => options.filter(o => o.name.toLowerCase().includes(state.inputValue.toLowerCase()))}
              renderOption={(props, opt) => {
                const o = typeof opt === 'string' ? { name: opt } as LabeledOption : opt;
                return <li {...props} key={`${o.name}-${o.sourceManual ?? ''}`}>{o.name}{o.sourceManual ? <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({getManualName(o.sourceManual)})</Typography> : null}</li>;
              }}
              value={draft.background || ''}
              onInputChange={(_e, val) => setDraft({ ...draft, background: val })}
              renderInput={(params) => <TextField {...params} label={t('background', 'Trasfondo')} />}
              sx={{ width: 200 }}
            />
            <TextField size="small" label={t('alignment', 'Alineamiento')} value={draft.alignment || ''} onChange={(e) => setDraft({ ...draft, alignment: e.target.value })} sx={{ width: 130 }} />
            {draft.kind === 'pc' && (
              <TextField size="small" label={t('player_name', 'Jugador')} value={draft.playerName || ''} onChange={(e) => setDraft({ ...draft, playerName: e.target.value })} sx={{ width: 130 }} />
            )}
            {isMaster && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>{t('owner', 'Propietario')}</InputLabel>
                <Select
                  label={t('owner', 'Propietario')}
                  value={draft.ownerPlayerId != null ? String(draft.ownerPlayerId) : ''}
                  onChange={(e) => {
                    const raw = String(e.target.value);
                    setDraft({ ...draft, ownerPlayerId: raw === '' ? null : Number(raw) });
                  }}
                >
                  <MenuItem value="">{t('unassigned', 'Sin asignar')}</MenuItem>
                  {campaignPlayers.map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>{p.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {/* Map associations */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            <Autocomplete
              multiple
              size="small"
              options={['__ALL__', ...maps.map(m => m.id)]}
              getOptionLabel={(opt) => {
                if (opt === '__ALL__') return t('all_maps', 'Todos los mapas');
                return maps.find(m => m.id === opt)?.name || opt;
              }}
              value={draft.associatedMapIds || []}
              onChange={(_e, newValue) => {
                // If "__ALL__" is selected, clear others and keep only "__ALL__"
                if (newValue.includes('__ALL__')) {
                  setDraft({ ...draft, associatedMapIds: ['__ALL__'] });
                } else {
                  setDraft({ ...draft, associatedMapIds: newValue });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('associated_maps', 'Mapas asociados')}
                  placeholder={t('select_maps', 'Selecciona mapas')}
                />
              )}
              sx={{ minWidth: 320, flex: 1 }}
            />
            {/* Primary map selector — shown whenever at least one specific map is selected */}
            {(draft.associatedMapIds || []).filter(id => id !== '__ALL__').length > 0 && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>{t('primary_map', 'Mapa principal')}</InputLabel>
                <Select
                  value={draft.primaryMapId || ''}
                  label={t('primary_map', 'Mapa principal')}
                  onChange={(e) => setDraft({ ...draft, primaryMapId: e.target.value || null })}
                >
                  <MenuItem value="">{t('none', 'Ninguno')}</MenuItem>
                  {(draft.associatedMapIds || [])
                    .filter(id => id !== '__ALL__')
                    .map(id => (
                      <MenuItem key={id} value={id}>
                        {maps.find(m => m.id === id)?.name || id}
                      </MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
            )}
          </Stack>

          {/* Experience Points inline */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
              {t('experience_points', 'Puntos de Experiencia')}
            </Typography>
            <TextField
              type="number"
              value={draft.experiencePoints ?? 0}
              onChange={(e) => setDraft({ ...draft, experiencePoints: Math.max(0, Number(e.target.value)) })}
              size="small"
              sx={{ width: 140, '& .MuiInputBase-input': { fontWeight: 700 } }}
            />
          </Stack>
        </Box>

        {/* Error display */}
        {errorText && (
          <Typography color="error" sx={{ px: 2, py: 1 }}>{errorText}</Typography>
        )}

        {/* ── PAGE TABS ── */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
            <Tab label={t('sheet', 'Ficha')} />
            <Tab label={t('story', 'Historia y Trasfondo')} />
          </Tabs>
        </Box>

        {/* ═══ TAB 0: STATS (D&D sheet layout) ═══ */}
        {tab === 0 && (
          <Box sx={{ p: { xs: 1, sm: 2 } }}>
            <Grid container spacing={2}>

              {/* ─── COLS 1+2: Abilities + Proficiency / Saves / Skills (nested, tight) ─── */}
              <Grid size={{ xs: 12, md: 3 }}>
                <Grid container spacing={0.5}>
                  {/* COL 1: Ability Scores */}
                  <Grid size={{ xs: 4 }}>
                    <Stack spacing={1}>
                      {(ABILITY_KEYS).map((k) => (
                        <EditableAbilityBlock
                          key={k}
                          label={abilityLabels[k]}
                          value={(draft as any)[k]}
                          onChange={(v) => setDraft({ ...draft, [k]: v } as any)}
                        />
                      ))}
                    </Stack>
                  </Grid>

                  {/* COL 2: Proficiency, Saving Throws, Skills */}
                  <Grid size={{ xs: 8 }}>
                    {/* Proficiency bonus */}
                    <Paper variant="outlined" sx={{ textAlign: 'center', py: 1, borderRadius: 2, mb: 2 }}>
                      <TextField
                        type="number"
                        value={draft.proficiencyBonus ?? 2}
                        onChange={(e) => setDraft({ ...draft, proficiencyBonus: Number(e.target.value) })}
                        size="small"
                        sx={{ width: 56, '& .MuiInputBase-input': { textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' } }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', display: 'block' }}>
                        {t('proficiency_bonus', 'Competencia')}
                      </Typography>
                    </Paper>

                    {/* ── Saving Throws ── */}
                    <SheetSection title={t('saving_throws', 'Tiradas de Salvación')}>
                      {ABILITY_KEYS.map((k) => {
                        const prof = !!(draft.savingThrowProficiencies || {})[k];
                        const mod = abilityModNum((draft as any)[k]) + (prof ? (draft.proficiencyBonus ?? 2) : 0);
                        return (
                          <ProficiencyRow
                            key={k}
                            label={abilityLabels[k]}
                            proficient={prof}
                            modifier={mod}
                            onToggle={() =>
                              setDraft({
                                ...draft,
                                savingThrowProficiencies: {
                                  ...(draft.savingThrowProficiencies || {}),
                                  [k]: !prof,
                                },
                              })
                            }
                          />
                        );
                      })}
                    </SheetSection>

                    {/* ── Skills ── */}
                    <SheetSection title={t('skills', 'Habilidades')}>
                      {SKILL_DEFS.map(({ key, labelKey, fallback, ability }) => {
                        const prof = !!(draft.skillProficiencies || {})[key];
                        const mod = abilityModNum((draft as any)[ability]) + (prof ? (draft.proficiencyBonus ?? 2) : 0);
                        return (
                          <ProficiencyRow
                            key={key}
                            label={`${t(labelKey, fallback)} (${abilityLabels[ability]})`}
                            proficient={prof}
                            modifier={mod}
                            onToggle={() =>
                              setDraft({
                                ...draft,
                                skillProficiencies: {
                                  ...(draft.skillProficiencies || {}),
                                  [key]: !prof,
                                },
                              })
                            }
                          />
                        );
                      })}
                    </SheetSection>
                  </Grid>
                </Grid>
              </Grid>

              {/* ─── COL 3: Combat + Attacks + Spells ─── */}
              <Grid size={{ xs: 12, md: 5 }}>

                {/* AC / Initiative / Speed */}
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <EditableStatBox
                    label={t('armor_class', 'CA')}
                    value={draft.armorClass ?? 10}
                    onChange={(v) => setDraft({ ...draft, armorClass: Number(v) })}
                    type="number"
                    icon={<ShieldIcon sx={{ fontSize: 20, color: 'text.secondary' }} />}
                  />
                  <EditableStatBox
                    label={t('initiative', 'Iniciativa')}
                    value={draft.initiative ?? 0}
                    onChange={(v) => setDraft({ ...draft, initiative: Number(v) })}
                    type="number"
                  />
                  <EditableStatBox
                    label={t('speed', 'Velocidad')}
                    value={draft.speed || ''}
                    onChange={(v) => setDraft({ ...draft, speed: v })}
                    icon={<DirectionsRunIcon sx={{ fontSize: 20, color: 'text.secondary' }} />}
                  />
                </Stack>

                {/* HP fields */}
                <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mb: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                    <FavoriteIcon sx={{ fontSize: 16, color: 'error.main' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      Hit Points
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <TextField size="small" type="number" label={t('max_hp', 'PG Máx.')} value={draft.maxHp ?? 8} onChange={(e) => setDraft({ ...draft, maxHp: Number(e.target.value) })} sx={{ width: 90 }} />
                    <TextField size="small" type="number" label={t('hp', 'PG')} value={draft.currentHp ?? 8} onChange={(e) => setDraft({ ...draft, currentHp: Number(e.target.value) })} sx={{ width: 80 }} />
                    <TextField size="small" type="number" label={t('temp_hp', 'PG Temp.')} value={draft.tempHp ?? 0} onChange={(e) => setDraft({ ...draft, tempHp: Number(e.target.value) })} sx={{ width: 90 }} />
                    <TextField size="small" label={t('hit_dice', 'Dados de Golpe')} value={draft.hitDice || ''} onChange={(e) => setDraft({ ...draft, hitDice: e.target.value })} sx={{ flex: 1, minWidth: 100 }} />
                  </Stack>
                </Paper>

                {/* ── Attacks & Spellcasting ── */}
                <SheetSection title={t('attacks_and_spellcasting', 'Ataques y Lanzamiento de Conjuros')}>
                  {/* Attacks table */}
                  <Stack spacing={0.5} sx={{ mb: 1 }}>
                    {/* Header */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="caption" sx={{ flex: 2, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                        {t('attack_name', 'Nombre')}
                      </Typography>
                      <Typography variant="caption" sx={{ flex: 1, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                        {t('attack_bonus', 'Bonificador')}
                      </Typography>
                      <Typography variant="caption" sx={{ flex: 2, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                        {t('attack_damage', 'Daño/Tipo')}
                      </Typography>
                      <Box sx={{ width: 32 }} />
                    </Stack>
                    {/* Rows */}
                    {(draft.attacks || []).map((atk, idx) => (
                      <Stack key={idx} direction="row" spacing={0.5} alignItems="center">
                        <TextField
                          size="small"
                          value={atk.name}
                          onChange={(e) => {
                            const next = [...(draft.attacks || [])];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setDraft({ ...draft, attacks: next });
                          }}
                          sx={{ flex: 2 }}
                        />
                        <TextField
                          size="small"
                          value={atk.bonus}
                          onChange={(e) => {
                            const next = [...(draft.attacks || [])];
                            next[idx] = { ...next[idx], bonus: e.target.value };
                            setDraft({ ...draft, attacks: next });
                          }}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          size="small"
                          value={atk.damage}
                          onChange={(e) => {
                            const next = [...(draft.attacks || [])];
                            next[idx] = { ...next[idx], damage: e.target.value };
                            setDraft({ ...draft, attacks: next });
                          }}
                          sx={{ flex: 2 }}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            const next = (draft.attacks || []).filter((_, i) => i !== idx);
                            setDraft({ ...draft, attacks: next.length ? next : null });
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          attacks: [...(draft.attacks || []), { name: '', bonus: '', damage: '' }],
                        })
                      }
                    >
                      {t('add_attack', 'Añadir ataque')}
                    </Button>
                  </Stack>
                  {/* Notes */}
                  <TextField
                    value={draft.attacksNotes || ''}
                    onChange={(e) => setDraft({ ...draft, attacksNotes: e.target.value })}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                    placeholder={t('attacks_notes', 'Notas')}
                  />
                </SheetSection>

                {/* ── Spellcasting ── */}
                <SheetSection title={t('magic', 'Magia')}>
                  <Stack spacing={1.5}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t('spellcasting_ability', 'Aptitud Mágica')}</InputLabel>
                      <Select
                        label={t('spellcasting_ability', 'Aptitud Mágica')}
                        value={draft.spellcastingAbility || ''}
                        onChange={(e) => setDraft({ ...draft, spellcastingAbility: (e.target.value || null) as any })}
                      >
                        <MenuItem value="">{t('none', 'Ninguna')}</MenuItem>
                        <MenuItem value="int">INT</MenuItem>
                        <MenuItem value="wis">WIS</MenuItem>
                        <MenuItem value="cha">CHA</MenuItem>
                      </Select>
                    </FormControl>
                    <Stack direction="row" spacing={1}>
                      <TextField size="small" type="number" label={t('spell_save_dc', 'CD Salvación')} value={draft.spellSaveDC ?? ''} onChange={(e) => setDraft({ ...draft, spellSaveDC: e.target.value === '' ? null : Number(e.target.value) })} sx={{ flex: 1 }} />
                      <TextField size="small" type="number" label={t('spell_attack_bonus', 'Bonif. Ataque')} value={draft.spellAttackBonus ?? ''} onChange={(e) => setDraft({ ...draft, spellAttackBonus: e.target.value === '' ? null : Number(e.target.value) })} sx={{ flex: 1 }} />
                    </Stack>
                    <SpellAutocomplete
                      campaignId={draft.campaignId}
                      spellLevel={0}
                      value={draft.cantrips || []}
                      onChange={(spells) => setDraft({ ...draft, cantrips: spells })}
                      label={t('cantrips', 'Trucos')}
                    />
                    {(['1', '2', '3', '4', '5', '6', '7', '8'] as const).map((lvl) => (
                      <SpellAutocomplete
                        key={lvl}
                        campaignId={draft.campaignId}
                        spellLevel={Number(lvl)}
                        value={(draft.spellsByLevel || {})[lvl] || []}
                        onChange={(spells) => setDraft({ ...draft, spellsByLevel: { ...(draft.spellsByLevel || {}), [lvl]: spells } })}
                        label={`${t('spells_level', 'Nivel')} ${lvl}`}
                      />
                    ))}
                  </Stack>
                </SheetSection>
              </Grid>

              {/* ─── COL 4: Image + Traits + Money + Equipment + Proficiencies ─── */}
              <Grid size={{ xs: 12, md: 4 }}>

                {/* Character illustration upload */}
                <SheetSection title={t('character_image', 'Imagen del Personaje')}>
                  <ImageUploader initialValue={draft.characterImageUrl} onChange={(v) => setDraft({ ...draft, characterImageUrl: v })} />
                </SheetSection>

                {/* Traits & Features */}
                <SheetSection title={t('traits_and_features', 'Rasgos y Características')}>
                  <TraitAutocomplete
                    campaignId={draft.campaignId}
                    value={draft.selectedTraits || []}
                    onChange={(traits) => setDraft({ ...draft, selectedTraits: traits })}
                    label={t('traits_select', 'Seleccionar rasgos')}
                  />
                  <FeatAutocomplete
                    campaignId={draft.campaignId}
                    value={draft.selectedFeats || []}
                    onChange={(feats) => setDraft({ ...draft, selectedFeats: feats })}
                    label={t('feats_select', 'Seleccionar dotes')}
                  />
                  <TextField
                    value={draft.traitsAndFeatures || ''}
                    onChange={(e) => setDraft({ ...draft, traitsAndFeatures: e.target.value })}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                    placeholder={t('traits_notes_placeholder', 'Notas adicionales sobre rasgos...')}
                    sx={{ mt: 1 }}
                  />
                </SheetSection>

                {/* Money */}
                <SheetSection title={t('money', 'Dinero')}>
                  <Stack direction="row" spacing={1} justifyContent="space-around" flexWrap="wrap">
                    {[
                      { key: 'pp', label: 'PP', color: '#b0bec5' },
                      { key: 'gp', label: 'GP', color: '#fdd835' },
                      { key: 'ep', label: 'EP', color: '#90a4ae' },
                      { key: 'sp', label: 'SP', color: '#cfd8dc' },
                      { key: 'cp', label: 'CP', color: '#bf8040' },
                    ].map(({ key, label, color }) => (
                      <Paper
                        key={key}
                        variant="outlined"
                        sx={{ width: 64, textAlign: 'center', py: 0.5, borderRadius: 2, borderColor: color, borderWidth: 2 }}
                      >
                        <TextField
                          type="number"
                          value={(draft as any)[key] ?? 0}
                          onChange={(e) => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) } as any)}
                          size="small"
                          sx={{ width: 52, '& .MuiInputBase-input': { textAlign: 'center', fontWeight: 700, p: '4px' } }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', color }}>{label}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                </SheetSection>

                {/* Equipment */}
                <SheetSection title={t('equipment', 'Equipo')}>
                  <TextField
                    value={draft.equipment || ''}
                    onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                  />
                </SheetSection>

                {/* Proficiencies & Languages */}
                <SheetSection title={t('other_proficiencies', 'Otras Competencias e Idiomas')}>
                  <TextField
                    value={draft.otherProficienciesAndLanguages || ''}
                    onChange={(e) => setDraft({ ...draft, otherProficienciesAndLanguages: e.target.value })}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                  />
                </SheetSection>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ═══ TAB 1: STORY & BACKSTORY ═══ */}
        {tab === 1 && (
          <Box sx={{ p: { xs: 1, sm: 2 } }}>
            <Grid container spacing={2}>
              {/* Left: Image preview + Appearance + Token */}
              <Grid size={{ xs: 12, md: 5 }}>
                {draft.characterImageUrl && (
                  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                    <Box
                      component="img"
                      src={draft.characterImageUrl}
                      alt={draft.name}
                      sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block', bgcolor: 'action.hover' }}
                    />
                  </Paper>
                )}

                {/* Appearance */}
                <SheetSection title={t('appearance', 'Apariencia')}>
                  <Grid container spacing={1}>
                    {[
                      { key: 'age', label: t('age', 'Edad') },
                      { key: 'height', label: t('height', 'Altura') },
                      { key: 'weight', label: t('weight', 'Peso') },
                      { key: 'eyes', label: t('eyes', 'Ojos') },
                      { key: 'skin', label: t('skin', 'Piel') },
                      { key: 'hair', label: t('hair', 'Pelo') },
                    ].map(({ key, label }) => (
                      <Grid key={key} size={{ xs: 6, sm: 4 }}>
                        <TextField
                          size="small"
                          label={label}
                          value={(draft as any)[key] || ''}
                          onChange={(e) => setDraft({ ...draft, [key]: e.target.value } as any)}
                          fullWidth
                        />
                      </Grid>
                    ))}
                  </Grid>
                </SheetSection>

                {/* Token configuration */}
                <SheetSection title={t('token', 'Token')}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="body2" color="text.secondary">{t('token_current', 'Token actual')}</Typography>
                      {draft.tokenKind === 'image' && draft.tokenImageUrl ? (
                        <Avatar src={draft.tokenImageUrl} alt={draft.name} sx={{ width: 40, height: 40 }} />
                      ) : (
                        <Avatar sx={{ width: 40, height: 40, bgcolor: draft.tokenColor || '#607d8b' }}>
                          {getInitials(draft.name)}
                        </Avatar>
                      )}
                    </Stack>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={draft.tokenKind || null}
                      onChange={(_, val) => val && setDraft({ ...draft, tokenKind: val })}
                    >
                      <ToggleButton value="color">{t('color', 'Color')}</ToggleButton>
                      <ToggleButton value="image">{t('image', 'Imagen')}</ToggleButton>
                    </ToggleButtonGroup>
                    {draft.tokenKind === 'color' && (
                      <Stack direction="row" spacing={2} alignItems="center">
                        <TextField size="small" label={t('token_color', 'Color del token')} value={draft.tokenColor || '#ff0000'} onChange={(e) => setDraft({ ...draft, tokenColor: e.target.value })} />
                        <input type="color" value={draft.tokenColor || '#ff0000'} onChange={(e) => setDraft({ ...draft, tokenColor: e.target.value })} />
                      </Stack>
                    )}
                    {draft.tokenKind === 'image' && (
                      <>
                        <ImageUploader initialValue={draft.tokenImageUrl || ''} onChange={(v) => setDraft({ ...draft, tokenImageUrl: v })} />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setCropOpen(true)}
                          disabled={!canCropToken}
                        >
                          {t('crop_token', 'Recortar token…')}
                        </Button>
                      </>
                    )}
                    {draft.tokenKind === 'image' && draft.tokenImageUrl && (
                      <TokenImageCropDialog
                        open={cropOpen}
                        imageSrc={draft.tokenImageUrl}
                        title="Recortar token (centrar cara)"
                        onClose={() => setCropOpen(false)}
                        onApply={(cropped) => {
                          setDraft({ ...draft, tokenKind: 'image', tokenImageUrl: cropped });
                          setCropOpen(false);
                        }}
                      />
                    )}
                  </Stack>
                </SheetSection>
              </Grid>

              {/* Right: Editable backstory, allies, treasure */}
              <Grid size={{ xs: 12, md: 7 }}>
                <SheetSection title={t('backstory', 'Historia del Personaje')}>
                  <TextField
                    value={draft.backstory || ''}
                    onChange={(e) => setDraft({ ...draft, backstory: e.target.value })}
                    fullWidth
                    multiline
                    minRows={4}
                    size="small"
                  />
                </SheetSection>
                <SheetSection title={t('allies_orgs', 'Aliados y Organizaciones')}>
                  <TextField
                    value={draft.alliesAndOrganizations || ''}
                    onChange={(e) => setDraft({ ...draft, alliesAndOrganizations: e.target.value })}
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                  />
                </SheetSection>
                <SheetSection title={t('treasure', 'Tesoro')}>
                  <TextField
                    value={draft.treasure || ''}
                    onChange={(e) => setDraft({ ...draft, treasure: e.target.value })}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                  />
                </SheetSection>
                {draft.id && (
                  <CharacterRelationsSection
                    charId={draft.id}
                    campaignId={draft.campaignId!}
                    isMaster={isMaster}
                  />
                )}
              </Grid>
            </Grid>
          </Box>
        )}
        </Box>{/* end right column */}
        </Stack>{/* end row */}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
        <Button onClick={onSave} variant="contained">{t('save', 'Guardar')}</Button>
      </DialogActions>
    </Dialog>
    </>
  );
};
