import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Breadcrumbs,
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
  Avatar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Grid from '@mui/material/Grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShieldIcon from '@mui/icons-material/Shield';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { getCharacter, CharacterPayload } from '../api/characters';
import { CharacterEditorModal } from '../components/characters/CharacterEditorModal';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useTranslation } from 'react-i18next';
import { setActiveSkylineCharacterId } from '../api/campaigns/activeSkylineCharacter';
import { useCampaignsContext } from '../components/Campaign/CampaignContext';
import { listCampaignSpells, getCampaignSpell, CampaignSpellDetail } from '../api/spells/spellsApi';
import i18n from '../i18n';

/* ───────────────────────── helpers ───────────────────────── */

/** Computes the ability modifier for a given score. */
const abilityMod = (score: number | undefined): string => {
  if (score === undefined || score === null) return '+0';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const getInitials = (name: string | undefined | null): string => {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
  return (a + b).toUpperCase();
};

/* ──────────────────── sub-components ─────────────────────── */

/**
 * Renders one ability score in the classic D&D vertical style:
 * abbreviation on top, modifier large, score small below.
 */
const AbilityBlock: React.FC<{ label: string; score: number | undefined }> = ({ label, score }) => (
  <Paper
    variant="outlined"
    sx={{
      width: 72,
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
    <Paper
      variant="outlined"
      sx={{
        width: 32,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        mt: 0.25,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
        {score ?? '—'}
      </Typography>
    </Paper>
  </Paper>
);

/**
 * A compact stat box used for AC / Initiative / Speed.
 */
const StatBox: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <Paper
    variant="outlined"
    sx={{
      flex: 1,
      textAlign: 'center',
      py: 1.5,
      px: 1,
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.5,
    }}
  >
    {icon}
    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{value ?? '—'}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: 0.5 }}>
      {label}
    </Typography>
  </Paper>
);

/**
 * Horizontal HP bar showing current / max, plus temp HP if any.
 */
const HpBar: React.FC<{ current?: number; max?: number; temp?: number }> = ({ current, max, temp }) => {
  const cur = current ?? 0;
  const mx = max ?? 1;
  const pct = Math.max(0, Math.min(100, (cur / mx) * 100));
  const color = pct > 50 ? 'success.main' : pct > 25 ? 'warning.main' : 'error.main';
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <FavoriteIcon sx={{ fontSize: 16, color: 'error.main' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Hit Points
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {cur} / {mx}
          {(temp ?? 0) > 0 && (
            <Typography component="span" variant="body2" color="info.main" sx={{ ml: 0.5 }}>
              (+{temp} temp)
            </Typography>
          )}
        </Typography>
      </Stack>
      <Box sx={{ width: '100%', height: 8, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 1, transition: 'width .3s' }} />
      </Box>
    </Paper>
  );
};

/**
 * A labeled section card with a title highlight stripe.
 */
const SheetSection: React.FC<{ title: string; children?: React.ReactNode; noPadding?: boolean }> = ({ title, children, noPadding }) => (
  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
    <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
        {title}
      </Typography>
    </Box>
    <Box sx={noPadding ? {} : { p: 1.5 }}>
      {children}
    </Box>
  </Paper>
);

/**
 * A simple key→value row for the sheet.
 */
const SheetRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Stack direction="row" spacing={1} sx={{ py: 0.25 }}>
    <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 600 }} color="text.secondary">{label}</Typography>
    <Typography variant="body2">{value || '—'}</Typography>
  </Stack>
);

/* ───────────────────────── PAGE ──────────────────────────── */

const CharacterDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (id && activeCampaign?.id) {
          const ch = await getCharacter(id);
          if (mounted) setData(ch);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, activeCampaign?.id]);

  // Compute campaignPlayers and isMaster for modal
  const currentUser = (activeCampaign && activeCampaign.owner) ? activeCampaign.owner : null;
  const isMaster = !!(activeCampaign && currentUser && activeCampaign.owner?.id === currentUser.id);
  const campaignPlayers = React.useMemo(() => {
    if (!activeCampaign) return [] as { id: number; label: string }[];
    const owner = activeCampaign.owner ? [{ id: activeCampaign.owner.id, label: `${activeCampaign.owner.username} (Master)` }] : [];
    const players = (activeCampaign.players || [])
      .filter(p => p.status === 'active')
      .map(p => ({ id: p.user.id, label: p.user.username }));
    // Deduplicate if owner also appears as player role
    const map = new Map<number, string>();
    [...owner, ...players].forEach(({ id, label }) => { if (!map.has(id)) map.set(id, label); });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [activeCampaign]);

  if (!activeCampaign) {
    return (
      <Box sx={{ p: 2 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography color="text.secondary">Selecciona una campaña para ver la ficha del personaje.</Typography>
          <Button variant="contained" onClick={() => navigate('/campaigns')}>{t('go_to_campaigns','Ir a campañas')}</Button>
        </Stack>
      </Box>
    );
  }

  if (loading) {
    return <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }
  if (!data) {
    return <Box sx={{ p: 2 }}><Typography color="error">{t('not_found','No encontrado')}</Typography></Box>;
  }

const initials = (data.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const avatarBg = data.tokenColor || '#607d8b';
  const isActiveInSkyline = activeCampaign?.activeSkylineCharacter?.id === data.id;

  const handleSkylineToggle = async () => {
    if (!activeCampaign?.id || !id) return;
    setSettingSkyline(true);
    try {
      const nextValue = isActiveInSkyline ? null : id;
      await setActiveSkylineCharacterId(activeCampaign.id, nextValue);
      await fetchCampaigns();
      try {
        localStorage.setItem('app.skyline.activeCharacterUpdated', JSON.stringify({ campaignId: activeCampaign.id, at: Date.now() }));
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('campaign-sync');
          bc.postMessage({ type: 'activeSkylineChanged', campaignId: activeCampaign.id });
          bc.close();
        }
        try { (window as any).electronAPI?.projectionPoke?.({ kind: 'activeSkylineChanged', campaignId: activeCampaign.id }); } catch {}
      } catch {}
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Error al actualizar Skyline');
    } finally {
      setSettingSkyline(false);
    }
  };

  /**
   * Opens the spell detail dialog. Searches the campaign catalogue by exact
   * name match; if not found the dialog shows a "not in catalogue" message.
   */
  const handleSpellClick = async (spellName: string) => {
    setSpellDialogName(spellName);
    setSpellDialogData(null);
    setSpellDialogOpen(true);
    setSpellDialogLoading(true);
    try {
      const cId = activeCampaign?.id;
      if (!cId) { setSpellDialogLoading(false); return; }
      const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';
      /* Search for the spell by name to obtain its ID */
      const res = await listCampaignSpells(cId, { q: spellName, pageSize: 50 }, lang);
      const items = res.items ?? [];
      const match = items.find((s: { name: string }) => s.name.toLowerCase() === spellName.toLowerCase());
      if (!match) { setSpellDialogData(null); return; }
      /* Fetch full detail (includes description, classes, savingThrow, etc.) */
      const detail = await getCampaignSpell(cId, match.id, lang);
      setSpellDialogData(detail);
    } catch {
      setSpellDialogData(null);
    } finally {
      setSpellDialogLoading(false);
    }
  };

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
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 1200, mx: 'auto' }}>
      {/* ── toolbar ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>{t('back', 'Volver')}</Button>
          <Breadcrumbs>
            <Typography color="text.secondary">{t('characters', 'Personajes')}</Typography>
            <Typography>{data.name}</Typography>
          </Breadcrumbs>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<EditIcon />} onClick={() => setEditorOpen(true)}>{t('edit', 'Editar')}</Button>
          {activeCampaign?.id && isMaster && (
            <Button
              variant={isActiveInSkyline ? 'outlined' : 'contained'}
              color={isActiveInSkyline ? 'warning' : 'primary'}
              disabled={settingSkyline}
              onClick={handleSkylineToggle}
            >
              {isActiveInSkyline ? 'Quitar de Skyline' : 'Enviar a Skyline'}
            </Button>
          )}
        </Stack>
      </Stack>

      <CharacterEditorModal
        open={editorOpen}
        initialDraft={data}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); setLoading(true); getCharacter(id!).then(setData).finally(() => setLoading(false)); }}
        campaignPlayers={campaignPlayers}
        isMaster={isMaster}
      />

      {/* ═══════════════ D&D-STYLE SHEET ═══════════════════ */}
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
          {/* Avatar / Token */}
          {data.tokenKind === 'image' && data.tokenImageUrl ? (
            <Avatar src={data.tokenImageUrl} alt={data.name} sx={{ width: 64, height: 64, border: '2px solid', borderColor: 'primary.contrastText' }} />
          ) : (
            <Avatar sx={{ bgcolor: avatarBg, width: 64, height: 64, fontSize: 24, fontWeight: 700, border: '2px solid', borderColor: 'primary.contrastText' }}>
              {initials}
            </Avatar>
          )}

          {/* Name + meta */}
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

          {/* Quick badges */}
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {data.kind && <Chip size="small" label={data.kind.toUpperCase()} sx={{ bgcolor: 'rgba(255,255,255,.2)', color: 'inherit' }} />}
            <Chip
              size="small"
              label={data.visibleToPlayers ? t('visible', 'Visible') : t('hidden', 'Oculto')}
              color={data.visibleToPlayers ? 'success' : 'default'}
            />
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

            {/* ═══ LEFT COLUMN: Abilities ═══ */}
            <Grid size={{ xs: 12, md: 2 }}>
              <Stack spacing={1} alignItems="center">
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k) => (
                  <AbilityBlock key={k} label={abilityLabels[k]} score={(data as any)[k]} />
                ))}
              </Stack>

              {/* Proficiency bonus below abilities */}
              <Paper
                variant="outlined"
                sx={{ mt: 2, textAlign: 'center', py: 1, borderRadius: 2 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  +{data.proficiencyBonus ?? 2}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                  {t('proficiency_bonus', 'Competencia')}
                </Typography>
              </Paper>
            </Grid>

            {/* ═══ CENTER COLUMN: Combat + Equipment + Spells ═══ */}
            <Grid size={{ xs: 12, md: 5 }}>

              {/* AC / Initiative / Speed row */}
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

              {/* HP bar */}
              <Box sx={{ mb: 2 }}>
                <HpBar current={data.currentHp} max={data.maxHp} temp={data.tempHp} />
              </Box>

              {/* Hit Dice */}
              <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mb: 2 }}>
                <SheetRow label={t('hit_dice', 'Dados de Golpe')} value={data.hitDice} />
              </Paper>

              {/* Experience Points */}
              <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mb: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 0.5 }}>
                  {t('experience_points', 'Puntos de Experiencia')}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {(data.experiencePoints ?? 0).toLocaleString()}
                </Typography>
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
                      sx={{
                        width: 56,
                        textAlign: 'center',
                        py: 1,
                        borderRadius: 2,
                        borderColor: color,
                        borderWidth: 2,
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {(data as any)[key] ?? 0}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', color }}>{label}</Typography>
                    </Paper>
                  ))}
                </Stack>
              </SheetSection>

              {/* Equipment */}
              <SheetSection title={t('equipment', 'Equipo')}>
                {data.equipment ? (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.equipment}</Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">—</Typography>
                )}
              </SheetSection>

              {/* Proficiencies & Languages */}
              <SheetSection title={t('other_proficiencies', 'Otras Competencias e Idiomas')}>
                {data.otherProficienciesAndLanguages ? (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.otherProficienciesAndLanguages}</Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">—</Typography>
                )}
              </SheetSection>

              {/* ── Spellcasting ── */}
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
                        {spells.map((s) => (
                          <Chip key={`${lvl}-${s}`} size="small" label={s} onClick={() => handleSpellClick(s)} sx={{ cursor: 'pointer' }} />
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </SheetSection>
              )}
            </Grid>

            {/* ═══ RIGHT COLUMN: Traits, Description, Image ═══ */}
            <Grid size={{ xs: 12, md: 5 }}>

              {/* Character illustration */}
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

              {/* Traits & Features */}
              <SheetSection title={t('traits_and_features', 'Rasgos y Características')}>
                {data.traitsAndFeatures ? (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.traitsAndFeatures}</Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">—</Typography>
                )}
              </SheetSection>

              {/* Physical description */}
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

              {/* Token preview */}
              <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    Token
                  </Typography>
                  {data.tokenKind === 'image' && data.tokenImageUrl ? (
                    <Avatar src={data.tokenImageUrl} alt={data.name} sx={{ width: 40, height: 40 }} />
                  ) : (
                    <Avatar sx={{ bgcolor: avatarBg, width: 40, height: 40 }}>{getInitials(data.name)}</Avatar>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {data.tokenKind === 'image' ? t('image', 'Imagen') : data.tokenKind === 'color' ? t('color', 'Color') : t('none', 'Ninguno')}
                    {data.tokenKind === 'color' && data.tokenColor ? ` (${data.tokenColor})` : ''}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Box>
        )}

        {/* ── PAGE 2: STORY & BACKSTORY ── */}
        {sheetPage === 1 && (
        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          <Grid container spacing={2}>
            {/* Left column: Character image + appearance */}
            <Grid size={{ xs: 12, md: 5 }}>
              {/* Character illustration (larger on this page) */}
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

              {/* Physical description */}
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

            {/* Right column: Backstory, Allies, Treasure */}
            <Grid size={{ xs: 12, md: 7 }}>
              {/* Backstory */}
              <SheetSection title={t('backstory', 'Historia del Personaje')}>
                {data.backstory ? (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.backstory}</Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">—</Typography>
                )}
              </SheetSection>

              {/* Allies & Organizations */}
              <SheetSection title={t('allies_orgs', 'Aliados y Organizaciones')}>
                {data.alliesAndOrganizations ? (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{data.alliesAndOrganizations}</Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">—</Typography>
                )}
              </SheetSection>

              {/* Treasure */}
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

      {/* ── Spell detail dialog ── */}
      <Dialog open={spellDialogOpen} onClose={() => setSpellDialogOpen(false)} maxWidth="sm" fullWidth>
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
    </Box>
  );
};

/* ─────────── Spell detail dialog (rendered inside the page) ─────────── */
/**
 * Renders a small informational dialog with the spell details fetched
 * from the campaign catalogue, or a "not found" message for custom spells.
 */
const SpellInfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ py: 0.25 }}>
      <Typography variant="body2" sx={{ minWidth: 130, fontWeight: 600 }} color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
};

export default CharacterDetailPage;
