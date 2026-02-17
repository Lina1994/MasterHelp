import React, { useMemo, useState } from 'react';
import { CharacterPayload, updateCharacter, createCharacter } from '../../api/characters';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { ImageUploader } from '../Campaign/ImageUploader';
import { TokenImageCropDialog } from './TokenImageCropDialog';
import { SpellAutocomplete } from './SpellAutocomplete';

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
  const [errorText, setErrorText] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  React.useEffect(() => {
    setDraft(initialDraft);
    setTab(0);
    setErrorText(null);
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
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogContent sx={{ p: 0 }}>
        {/* ═══════════════ D&D-STYLE EDITOR SHEET ═══════════════ */}

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
            <TextField size="small" label={t('class', 'Clase')} value={draft.className || ''} onChange={(e) => setDraft({ ...draft, className: e.target.value })} sx={{ width: 120 }} />
            <TextField size="small" type="number" label={t('level', 'Nivel')} value={draft.level ?? 1} onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })} sx={{ width: 70 }} />
            <TextField size="small" label={t('race', 'Raza')} value={draft.race || ''} onChange={(e) => setDraft({ ...draft, race: e.target.value })} sx={{ width: 120 }} />
            <TextField size="small" label={t('background', 'Trasfondo')} value={draft.background || ''} onChange={(e) => setDraft({ ...draft, background: e.target.value })} sx={{ width: 120 }} />
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

              {/* ─── LEFT COLUMN: Abilities ─── */}
              <Grid size={{ xs: 12, md: 2 }}>
                <Stack spacing={1} alignItems="center">
                  {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k) => (
                    <EditableAbilityBlock
                      key={k}
                      label={abilityLabels[k]}
                      value={(draft as any)[k]}
                      onChange={(v) => setDraft({ ...draft, [k]: v } as any)}
                    />
                  ))}
                </Stack>

                {/* Proficiency bonus */}
                <Paper variant="outlined" sx={{ mt: 2, textAlign: 'center', py: 1, borderRadius: 2 }}>
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
              </Grid>

              {/* ─── CENTER COLUMN: Combat + Equipment + Spells ─── */}
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

                {/* Experience Points */}
                <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mb: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 0.5 }}>
                    {t('experience_points', 'Puntos de Experiencia')}
                  </Typography>
                  <TextField
                    type="number"
                    value={draft.experiencePoints ?? 0}
                    onChange={(e) => setDraft({ ...draft, experiencePoints: Math.max(0, Number(e.target.value)) })}
                    size="small"
                    fullWidth
                    sx={{ mt: 0.5, '& .MuiInputBase-input': { textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' } }}
                  />
                </Paper>

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

              {/* ─── RIGHT COLUMN: Image + Traits + Appearance + Token ─── */}
              <Grid size={{ xs: 12, md: 5 }}>

                {/* Character illustration upload */}
                <SheetSection title={t('character_image', 'Imagen del Personaje')}>
                  <ImageUploader initialValue={draft.characterImageUrl} onChange={(v) => setDraft({ ...draft, characterImageUrl: v })} />
                </SheetSection>

                {/* Traits & Features */}
                <SheetSection title={t('traits_and_features', 'Rasgos y Características')}>
                  <TextField
                    value={draft.traitsAndFeatures || ''}
                    onChange={(e) => setDraft({ ...draft, traitsAndFeatures: e.target.value })}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                  />
                </SheetSection>

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
            </Grid>
          </Box>
        )}

        {/* ═══ TAB 1: STORY & BACKSTORY ═══ */}
        {tab === 1 && (
          <Box sx={{ p: { xs: 1, sm: 2 } }}>
            <Grid container spacing={2}>
              {/* Left: Image preview */}
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
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
        <Button onClick={onSave} variant="contained">{t('save', 'Guardar')}</Button>
      </DialogActions>
    </Dialog>
  );
};
