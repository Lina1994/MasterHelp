/**
 * CharacterSheetModal.tsx
 *
 * Full-screen dialog that renders the complete D&D character sheet
 * for a given character. Designed to be opened from any context (e.g. from a
 * map marker) without navigating away from the current route.
 *
 * Props:
 *  - charId      : ID of the character to display.
 *  - campaignId  : ID of the active campaign (used for Skyline and spell lookup).
 *  - open        : Whether the dialog is visible.
 *  - onClose     : Callback to close the dialog.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ShieldIcon from '@mui/icons-material/Shield';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import Grid from '@mui/material/Grid';

import { getCharacter, CharacterPayload } from '../../api/characters';
import { CharacterEditorModal } from './CharacterEditorModal';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useCampaignsContext } from '../Campaign/CampaignContext';
import { setActiveSkylineCharacterId } from '../../api/campaigns/activeSkylineCharacter';
import { listCampaignSpells, getCampaignSpell, CampaignSpellDetail } from '../../api/spells/spellsApi';
import { listCampaignFeats, getCampaignFeat, CampaignFeatDetail } from '../../api/feats/featsApi';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import {
  ABILITY_KEYS,
  SKILL_DEFS,
  abilityMod,
  abilityModNum,
  formatMod,
  getInitials,
  AbilityBlock,
  StatBox,
  HpBar,
  SheetSection,
  SheetRow,
  ReadOnlyProficiencyRow,
  SpellInfoRow,
} from './charSheetShared';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  /** ID of the character to display. */
  charId: string;
  /** ID of the active campaign. */
  campaignId: string;
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the user closes the dialog. */
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * CharacterSheetModal
 *
 * Fetches a character by ID and renders the full sheet inside a fullscreen
 * dialog. Supports editing and Skyline projection, identical to the page view.
 */
const CharacterSheetModal: React.FC<Props> = ({ charId, campaignId, open, onClose }) => {
  const { t } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const { fetchCampaigns } = useCampaignsContext();

  const [data, setData] = useState<CharacterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [settingSkyline, setSettingSkyline] = useState(false);
  /** 0 = Stats sheet, 1 = Story / backstory page */
  const [sheetPage, setSheetPage] = useState(0);

  /* Spell detail dialog state */
  const [spellDialogOpen, setSpellDialogOpen] = useState(false);
  const [spellDialogLoading, setSpellDialogLoading] = useState(false);
  const [spellDialogData, setSpellDialogData] = useState<CampaignSpellDetail | null>(null);
  const [spellDialogName, setSpellDialogName] = useState('');

  /* Feat detail dialog state */
  const [featDialogOpen, setFeatDialogOpen] = useState(false);
  const [featDialogLoading, setFeatDialogLoading] = useState(false);
  const [featDialogData, setFeatDialogData] = useState<CampaignFeatDetail | null>(null);
  const [featDialogName, setFeatDialogName] = useState('');

  /* Fetch character whenever the dialog opens or charId changes */
  useEffect(() => {
    if (!open || !charId) return;
    let alive = true;
    setLoading(true);
    setData(null);
    getCharacter(charId)
      .then((ch) => { if (alive) setData(ch); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [charId, open]);

  /* Derive master / players list from context */
  const currentUser = activeCampaign?.owner ?? null;
  const isMaster = !!(activeCampaign && currentUser && activeCampaign.owner?.id === currentUser.id);

  const campaignPlayers = useMemo(() => {
    if (!activeCampaign) return [] as { id: number; label: string }[];
    const owner = activeCampaign.owner ? [{ id: activeCampaign.owner.id, label: `${activeCampaign.owner.username} (Master)` }] : [];
    const players = (activeCampaign.players || [])
      .filter((p) => p.status === 'active')
      .map((p) => ({ id: p.user.id, label: p.user.username }));
    const map = new Map<number, string>();
    [...owner, ...players].forEach(({ id, label }) => { if (!map.has(id)) map.set(id, label); });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [activeCampaign]);

  const isActiveInSkyline = activeCampaign?.activeSkylineCharacter?.id === data?.id;

  /**
   * Toggles the active Skyline character for the campaign.
   */
  const handleSkylineToggle = async () => {
    if (!campaignId || !charId) return;
    setSettingSkyline(true);
    try {
      const nextValue = isActiveInSkyline ? null : charId;
      await setActiveSkylineCharacterId(campaignId, nextValue);
      await fetchCampaigns();
      try {
        localStorage.setItem('app.skyline.activeCharacterUpdated', JSON.stringify({ campaignId, at: Date.now() }));
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('campaign-sync');
          bc.postMessage({ type: 'activeSkylineChanged', campaignId });
          bc.close();
        }
        try { (window as any).electronAPI?.projectionPoke?.({ kind: 'activeSkylineChanged', campaignId }); } catch {}
      } catch {}
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Error al actualizar Skyline');
    } finally {
      setSettingSkyline(false);
    }
  };

  /**
   * Opens the spell detail inline dialog. Searches the campaign catalogue by
   * exact name match; shows "not in catalogue" if not found.
   */
  const handleSpellClick = async (spellName: string) => {
    setSpellDialogName(spellName);
    setSpellDialogData(null);
    setSpellDialogOpen(true);
    setSpellDialogLoading(true);
    try {
      const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';
      const res = await listCampaignSpells(campaignId, { q: spellName, pageSize: 50 }, lang);
      const match = (res.items ?? []).find((s: { name: string }) => s.name.toLowerCase() === spellName.toLowerCase());
      if (!match) return;
      const detail = await getCampaignSpell(campaignId, match.id, lang);
      setSpellDialogData(detail);
    } catch {
      setSpellDialogData(null);
    } finally {
      setSpellDialogLoading(false);
    }
  };

  /**
   * Opens the feat detail inline dialog. Searches the campaign catalogue by
   * exact name match; shows "not in catalogue" if not found.
   */
  const handleFeatClick = async (featName: string) => {
    setFeatDialogName(featName);
    setFeatDialogData(null);
    setFeatDialogOpen(true);
    setFeatDialogLoading(true);
    try {
      const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';
      const res = await listCampaignFeats(campaignId, { q: featName, pageSize: 50 }, lang);
      const match = (res.items ?? []).find((f: { name: string }) => f.name.toLowerCase() === featName.toLowerCase());
      if (!match) return;
      const detail = await getCampaignFeat(campaignId, match.id, lang);
      setFeatDialogData(detail);
    } catch {
      setFeatDialogData(null);
    } finally {
      setFeatDialogLoading(false);
    }
  };

  /** Ability labels (localised abbreviations). */
  const abilityLabels: Record<string, string> = {
    str: t('str', 'FUE'),
    dex: t('dex', 'DES'),
    con: t('con', 'CON'),
    int: t('int', 'INT'),
    wis: t('wis', 'SAB'),
    cha: t('cha', 'CAR'),
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      /* Sit above MapMarkerDetail (z-index 1400) */
      sx={{ zIndex: 1500 }}
      PaperProps={{ sx: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      {/* ── Dialog header ── */}
      <DialogTitle
        component="div"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
      >
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
          {loading ? 'Cargando…' : (data?.name ?? 'Ficha de personaje')}
        </Typography>

        {/* Edit button */}
        {!loading && data && (
          <Button startIcon={<EditIcon />} onClick={() => setEditorOpen(true)} size="small">
            {t('edit', 'Editar')}
          </Button>
        )}

        {/* Skyline button (master only) */}
        {!loading && data && isMaster && (
          <Button
            variant={isActiveInSkyline ? 'outlined' : 'contained'}
            color={isActiveInSkyline ? 'warning' : 'primary'}
            disabled={settingSkyline}
            onClick={handleSkylineToggle}
            size="small"
          >
            {isActiveInSkyline ? 'Quitar de Skyline' : 'Enviar a Skyline'}
          </Button>
        )}

        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* ── Content ── */}
      <DialogContent sx={{ p: 0, overflow: 'auto', flex: 1 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && !data && (
          <Box sx={{ p: 3 }}>
            <Typography color="error">{t('not_found', 'No encontrado')}</Typography>
          </Box>
        )}

        {!loading && data && (() => {
          const initials = getInitials(data.name);
          const avatarBg = data.tokenColor || '#607d8b';

          return (
            <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 1400, mx: 'auto' }}>
              {/* ═══════════════ CHARACTER SHEET ═══════════════════ */}
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>

                {/* ── HEADER BAR ── */}
                <Box
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 2,
                  }}
                >
                  {data.tokenKind === 'image' && data.tokenImageUrl ? (
                    <Avatar src={data.tokenImageUrl} alt={data.name} sx={{ width: 64, height: 64, border: '2px solid', borderColor: 'primary.contrastText' }} />
                  ) : (
                    <Avatar sx={{ bgcolor: avatarBg, width: 64, height: 64, fontSize: 24, fontWeight: 700, border: '2px solid', borderColor: 'primary.contrastText' }}>
                      {initials}
                    </Avatar>
                  )}

                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{data.name}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {[
                        data.race,
                        data.className && data.level ? `${data.className} ${data.level}` : data.className,
                        data.alignment,
                        data.background,
                      ].filter(Boolean).join(' · ')}
                    </Typography>
                    {data.playerName && (
                      <Typography variant="caption" sx={{ opacity: 0.75 }}>
                        {t('player_name', 'Jugador')}: {data.playerName}
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="column" spacing={0.5} alignItems="flex-end">
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {data.kind && (
                        <Chip size="small" label={data.kind === 'pc' ? t('pc', 'PC') : t('npc', 'NPC')} sx={{ bgcolor: 'rgba(255,255,255,.2)', color: 'inherit' }} />
                      )}
                      <Chip
                        size="small"
                        label={data.visibleToPlayers ? t('visible', 'Visible') : t('hidden', 'Oculto')}
                        color={data.visibleToPlayers ? 'success' : 'default'}
                      />
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="caption" sx={{ opacity: 0.75, textTransform: 'uppercase', fontWeight: 700, fontSize: '0.6rem' }}>
                        {t('experience_points', 'XP')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {(data.experiencePoints ?? 0).toLocaleString()}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                {/* ── PAGE TABS ── */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs value={sheetPage} onChange={(_, v) => setSheetPage(v)} variant="fullWidth">
                    <Tab label={t('sheet', 'Ficha')} />
                    <Tab label={t('story', 'Historia y Trasfondo')} />
                  </Tabs>
                </Box>

                {/* ── PAGE 1: STATS ── */}
                {sheetPage === 0 && (
                  <Box sx={{ p: { xs: 1, sm: 2 } }}>
                    <Grid container spacing={2}>

                      {/* ═══ COLS 1+2: Abilities + Proficiency / Saves / Skills ═══ */}
                      <Grid size={{ xs: 12, md: 3 }}>
                        <Grid container spacing={0.5}>
                          {/* COL 1: Ability Scores */}
                          <Grid size={{ xs: 4 }}>
                            <Stack spacing={1}>
                              {ABILITY_KEYS.map((k) => (
                                <AbilityBlock key={k} label={abilityLabels[k]} score={(data as any)[k]} />
                              ))}
                            </Stack>
                          </Grid>

                          {/* COL 2: Proficiency Bonus + Saves + Skills */}
                          <Grid size={{ xs: 8 }}>
                            <Paper variant="outlined" sx={{ textAlign: 'center', py: 1, borderRadius: 2, mb: 2 }}>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                +{data.proficiencyBonus ?? 2}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                {t('proficiency_bonus', 'Competencia')}
                              </Typography>
                            </Paper>

                            <SheetSection title={t('saving_throws', 'Tiradas de Salvación')}>
                              {ABILITY_KEYS.map((k) => {
                                const prof = !!(data.savingThrowProficiencies || {})[k];
                                const mod = abilityModNum((data as any)[k]) + (prof ? (data.proficiencyBonus ?? 2) : 0);
                                return (
                                  <ReadOnlyProficiencyRow key={k} label={abilityLabels[k]} proficient={prof} modifier={mod} />
                                );
                              })}
                            </SheetSection>

                            <SheetSection title={t('skills', 'Habilidades')}>
                              {SKILL_DEFS.map(({ key, labelKey, fallback, ability }) => {
                                const prof = !!(data.skillProficiencies || {})[key];
                                const mod = abilityModNum((data as any)[ability]) + (prof ? (data.proficiencyBonus ?? 2) : 0);
                                return (
                                  <ReadOnlyProficiencyRow
                                    key={key}
                                    label={`${t(labelKey, fallback)} (${abilityLabels[ability]})`}
                                    proficient={prof}
                                    modifier={mod}
                                  />
                                );
                              })}
                            </SheetSection>
                          </Grid>
                        </Grid>
                      </Grid>

                      {/* ═══ COL 3: Combat + Attacks + Spells ═══ */}
                      <Grid size={{ xs: 12, md: 5 }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                          <StatBox
                            label={t('armor_class', 'Clase de Armadura')}
                            value={data.armorClass}
                            icon={<ShieldIcon sx={{ fontSize: 20, color: 'text.secondary' }} />}
                          />
                          <StatBox
                            label={t('initiative', 'Iniciativa')}
                            value={data.initiative !== undefined && data.initiative !== null
                              ? (data.initiative >= 0 ? `+${data.initiative}` : data.initiative)
                              : '—'}
                          />
                          <StatBox
                            label={t('speed', 'Velocidad')}
                            value={data.speed}
                            icon={<DirectionsRunIcon sx={{ fontSize: 20, color: 'text.secondary' }} />}
                          />
                        </Stack>

                        <Box sx={{ mb: 2 }}>
                          <HpBar current={data.currentHp} max={data.maxHp} temp={data.tempHp} />
                        </Box>

                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mb: 2 }}>
                          <SheetRow label={t('hit_dice', 'Dados de Golpe')} value={data.hitDice} />
                        </Paper>

                        {((data.attacks && data.attacks.length > 0) || data.attacksNotes) && (
                          <SheetSection title={t('attacks_and_spellcasting', 'Ataques y Lanzamiento de Conjuros')}>
                            {data.attacks && data.attacks.length > 0 && (
                              <Box sx={{ mb: data.attacksNotes ? 1.5 : 0 }}>
                                <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
                                  <Typography variant="caption" sx={{ flex: 2, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                    {t('attack_name', 'Nombre')}
                                  </Typography>
                                  <Typography variant="caption" sx={{ flex: 1, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                    {t('attack_bonus', 'Bonificador')}
                                  </Typography>
                                  <Typography variant="caption" sx={{ flex: 2, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                    {t('attack_damage', 'Daño/Tipo')}
                                  </Typography>
                                </Stack>
                                <Divider sx={{ mb: 0.5 }} />
                                {data.attacks.map((atk, idx) => (
                                  <Stack key={idx} direction="row" spacing={1} sx={{ py: 0.25 }}>
                                    <Typography variant="body2" sx={{ flex: 2, fontWeight: 600 }}>{atk.name || '—'}</Typography>
                                    <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', fontWeight: 700 }}>{atk.bonus || '—'}</Typography>
                                    <Typography variant="body2" sx={{ flex: 2 }}>{atk.damage || '—'}</Typography>
                                  </Stack>
                                ))}
                              </Box>
                            )}
                            {data.attacksNotes && (
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.attacksNotes}</Typography>
                            )}
                          </SheetSection>
                        )}

                        {(data.spellcastingAbility || (data.cantrips && data.cantrips.length > 0) || (data.spellsByLevel && Object.keys(data.spellsByLevel).length > 0)) && (
                          <SheetSection title={t('magic', 'Magia')}>
                            <Stack direction="row" spacing={2} sx={{ mb: 1 }} flexWrap="wrap">
                              {data.spellcastingAbility && (
                                <Chip size="small" variant="outlined" label={`${t('spellcasting_ability', 'Aptitud')}: ${data.spellcastingAbility.toUpperCase()}`} />
                              )}
                              {data.spellSaveDC !== undefined && data.spellSaveDC !== null && (
                                <Chip size="small" variant="outlined" label={`${t('spell_save_dc', 'CD Salvación')}: ${data.spellSaveDC}`} />
                              )}
                              {data.spellAttackBonus !== undefined && data.spellAttackBonus !== null && (
                                <Chip size="small" variant="outlined" label={`${t('spell_attack_bonus', 'Ataque')}: +${data.spellAttackBonus}`} />
                              )}
                            </Stack>

                            {data.cantrips && data.cantrips.length > 0 && (
                              <>
                                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                                  {t('cantrips', 'Trucos')}
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5, mb: 1 }}>
                                  {data.cantrips.map((c) => (
                                    <Chip key={c} size="small" label={c} onClick={() => handleSpellClick(c)} sx={{ cursor: 'pointer' }} />
                                  ))}
                                </Stack>
                              </>
                            )}

                            {data.spellsByLevel && Object.entries(data.spellsByLevel).map(([lvl, spells]) => (
                              <Box key={lvl} sx={{ mb: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                                  {t('spells_level', 'Nivel')} {lvl}
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                  {(spells as string[]).map((s) => (
                                    <Chip key={`${lvl}-${s}`} size="small" label={s} onClick={() => handleSpellClick(s)} sx={{ cursor: 'pointer' }} />
                                  ))}
                                </Stack>
                              </Box>
                            ))}
                          </SheetSection>
                        )}
                      </Grid>

                      {/* ═══ COL 4: Image + Traits + Money + Equipment + Proficiencies ═══ */}
                      <Grid size={{ xs: 12, md: 4 }}>
                        {data.characterImageUrl && (
                          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                            <Box
                              component="img"
                              src={data.characterImageUrl}
                              alt={data.name}
                              sx={{ width: '100%', maxHeight: 320, objectFit: 'contain', display: 'block', bgcolor: 'action.hover' }}
                            />
                          </Paper>
                        )}

                        <SheetSection title={t('traits_and_features', 'Rasgos y Características')}>
                          {data.selectedTraits?.length ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: data.traitsAndFeatures ? 1 : 0 }}>
                              {data.selectedTraits.map((trait, i) => (
                                <Chip key={i} size="small" label={trait} variant="outlined" />
                              ))}
                            </Stack>
                          ) : null}
                          {data.selectedFeats?.length ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: data.traitsAndFeatures ? 1 : 0 }}>
                              {data.selectedFeats.map((feat, i) => (
                                <Chip key={i} size="small" label={feat} color="secondary" variant="outlined" onClick={() => handleFeatClick(feat)} sx={{ cursor: 'pointer' }} />
                              ))}
                            </Stack>
                          ) : null}
                          {data.traitsAndFeatures ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.traitsAndFeatures}</Typography>
                          ) : (
                            !data.selectedTraits?.length && !data.selectedFeats?.length && <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </SheetSection>

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
                                sx={{ width: 56, textAlign: 'center', py: 1, borderRadius: 2, borderColor: color, borderWidth: 2 }}
                              >
                                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                  {(data as any)[key] ?? 0}
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', color }}>{label}</Typography>
                              </Paper>
                            ))}
                          </Stack>
                        </SheetSection>

                        <SheetSection title={t('equipment', 'Equipo')}>
                          {data.equipment ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.equipment}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </SheetSection>

                        <SheetSection title={t('other_proficiencies', 'Otras Competencias e Idiomas')}>
                          {data.otherProficienciesAndLanguages ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.otherProficienciesAndLanguages}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </SheetSection>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* ── PAGE 2: STORY & BACKSTORY ── */}
                {sheetPage === 1 && (
                  <Box sx={{ p: { xs: 1, sm: 2 } }}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 5 }}>
                        {data.characterImageUrl && (
                          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                            <Box
                              component="img"
                              src={data.characterImageUrl}
                              alt={data.name}
                              sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block', bgcolor: 'action.hover' }}
                            />
                          </Paper>
                        )}

                        <SheetSection title={t('appearance', 'Apariencia')}>
                          <Grid container spacing={1}>
                            {[
                              { label: t('age', 'Edad'), value: data.age },
                              { label: t('height', 'Altura'), value: data.height },
                              { label: t('weight', 'Peso'), value: data.weight },
                              { label: t('eyes', 'Ojos'), value: data.eyes },
                              { label: t('skin', 'Piel'), value: data.skin },
                              { label: t('hair', 'Pelo'), value: data.hair },
                            ].map(({ label, value }) => (
                              <Grid key={label} size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                  {label}
                                </Typography>
                                <Typography variant="body2">{value || '—'}</Typography>
                              </Grid>
                            ))}
                          </Grid>
                        </SheetSection>
                      </Grid>

                      <Grid size={{ xs: 12, md: 7 }}>
                        <SheetSection title={t('backstory', 'Historia del Personaje')}>
                          {data.backstory ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.backstory}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </SheetSection>

                        <SheetSection title={t('allies_orgs', 'Aliados y Organizaciones')}>
                          {data.alliesAndOrganizations ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.alliesAndOrganizations}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </SheetSection>

                        <SheetSection title={t('treasure', 'Tesoro')}>
                          {data.treasure ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.treasure}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </SheetSection>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Paper>
            </Box>
          );
        })()}
      </DialogContent>

      {/* ── Character editor modal ── */}
      {data && (
        <CharacterEditorModal
          open={editorOpen}
          initialDraft={data}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            setLoading(true);
            getCharacter(charId).then(setData).finally(() => setLoading(false));
          }}
          campaignPlayers={campaignPlayers}
          isMaster={isMaster}
        />
      )}

      {/* ── Feat detail dialog ── */}
      <Dialog open={featDialogOpen} onClose={() => setFeatDialogOpen(false)} maxWidth="sm" fullWidth sx={{ zIndex: 1600 }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{featDialogName}</Typography>
          <IconButton onClick={() => setFeatDialogOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {featDialogLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
          )}
          {!featDialogLoading && !featDialogData && (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t('feat_not_in_catalogue', 'Esta dote no se encuentra en el catálogo de la campaña.')}
            </Typography>
          )}
          {!featDialogLoading && featDialogData && (() => {
            const ft = featDialogData;
            return (
              <Stack spacing={1}>
                {ft.prerequisite && (
                  <Typography variant="caption" color="text.secondary">
                    <b>{t('prerequisite', 'Requisito')}:</b> {ft.prerequisite}
                  </Typography>
                )}
                {ft.origin && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={ft.origin === 'homebrew' ? t('homebrew', 'Homebrew') : t('manual', 'Manual')}
                  />
                )}
                {ft.description && (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ft.description}</Typography>
                )}
              </Stack>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Spell detail dialog ── */}
      <Dialog open={spellDialogOpen} onClose={() => setSpellDialogOpen(false)} maxWidth="sm" fullWidth sx={{ zIndex: 1600 }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{spellDialogName}</Typography>
          <IconButton onClick={() => setSpellDialogOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {spellDialogLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
          )}
          {!spellDialogLoading && !spellDialogData && (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t('spell_not_in_catalogue', 'Este conjuro no se encuentra en el catálogo de la campaña.')}
            </Typography>
          )}
          {!spellDialogLoading && spellDialogData && (() => {
            const sp = spellDialogData;
            return (
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                  <Chip size="small" label={`${t('spells_level', 'Nivel')} ${sp.level}`} />
                  {sp.school && <Chip size="small" variant="outlined" label={sp.school} />}
                  {sp.isConcentration && <Chip size="small" color="warning" label={t('concentration', 'Concentración')} />}
                  {sp.isRitual && <Chip size="small" color="info" label={t('ritual', 'Ritual')} />}
                </Stack>
                <Divider />
                <SpellInfoRow label={t('casting_time', 'Tiempo de lanzamiento')} value={sp.castingTime} />
                <SpellInfoRow label={t('range', 'Alcance')} value={sp.range} />
                <SpellInfoRow label={t('components', 'Componentes')} value={sp.components} />
                {sp.materials && <SpellInfoRow label={t('materials', 'Materiales')} value={sp.materials} />}
                <SpellInfoRow label={t('duration', 'Duración')} value={sp.duration} />
                {sp.areaOfEffect && <SpellInfoRow label={t('area_of_effect', 'Área de efecto')} value={sp.areaOfEffect} />}
                {sp.savingThrow && <SpellInfoRow label={t('saving_throw', 'Tirada de salvación')} value={sp.savingThrow} />}
                {sp.classes && sp.classes.length > 0 && (
                  <SpellInfoRow label={t('classes', 'Clases')} value={sp.classes.join(', ')} />
                )}
                {sp.description && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{sp.description}</Typography>
                  </>
                )}
              </Stack>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default CharacterSheetModal;
