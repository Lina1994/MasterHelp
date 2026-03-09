import { useCallback, useEffect, useState } from 'react';
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
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShieldIcon from '@mui/icons-material/Shield';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { useTranslation } from 'react-i18next';
import { getCharacter, type CharacterPayload } from '../../api/characters';
import { getCampaignMonster, type CampaignMonsterDetail } from '../../api/bestiary/bestiaryApi';
import { listCampaignSpells, getCampaignSpell, type CampaignSpellDetail } from '../../api/spells/spellsApi';
import { SpellInfoRow } from '../characters/charSheetShared';
import { listMaps, getMapImageUrlSized, getMapSkylineUrlSized, hasMapSkylineForTod, type MapItemDto } from '../../api/maps';
import { getShop, type Shop } from '../../api/shops';
import { listSongsForCampaign, listPlaylists, type SongLite, type PlaylistLite } from '../../api/soundtrack';
import { getQuest, type QuestPayload } from '../../api/quests';
import { listEncounters, type EncounterSummary } from '../../api/encounters';
import { setActiveSkylineCharacterId } from '../../api/campaigns/activeSkylineCharacter';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useCampaignsContext } from '../Campaign/CampaignContext';
import { MonsterStatBlock } from '../bestiary/MonsterStatBlock';
import { SpellStatBlock } from '../spells/SpellStatBlock';
import AuthImage from '../common/AuthImage';

interface Props {
  open: boolean;
  entityType: string | null;
  entityId: string | null;
  campaignId: string;
  onClose: () => void;
  /** Optional sx forwarded to the root Dialog — e.g. to raise z-index when nested inside another dialog. */
  dialogSx?: object;
}

/* ───────────────────────── helpers ───────────────────────── */

/** Computes the ability modifier for a given score. */
const abilityMod = (score: number | undefined): string => {
  if (score === undefined || score === null) return '+0';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

/** Numeric ability modifier. */
const abilityModNum = (score: number | undefined): number => {
  if (score === undefined || score === null) return 0;
  return Math.floor((score - 10) / 2);
};

/** Formats a numeric modifier with a sign prefix. */
const formatMod = (mod: number): string => (mod >= 0 ? `+${mod}` : `${mod}`);

/** The six ability keys. */
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/** Skill definitions. */
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

/* ──────── Character sub-components (read-only) ──────── */

const AbilityBlock: React.FC<{ label: string; score: number | undefined }> = ({ label, score }) => (
  <Paper
    variant="outlined"
    sx={{ width: 72, textAlign: 'center', py: 1, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}
  >
    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.65rem' }}>{label}</Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>{abilityMod(score)}</Typography>
    <Paper variant="outlined" sx={{ width: 32, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', mt: 0.25 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{score ?? '—'}</Typography>
    </Paper>
  </Paper>
);

const StatBox: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <Paper variant="outlined" sx={{ flex: 1, textAlign: 'center', py: 1.5, px: 1, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
    {icon}
    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{value ?? '—'}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: 0.5 }}>{label}</Typography>
  </Paper>
);

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
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>Hit Points</Typography>
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {cur} / {mx}
          {(temp ?? 0) > 0 && <Typography component="span" variant="body2" color="info.main" sx={{ ml: 0.5 }}>(+{temp} temp)</Typography>}
        </Typography>
      </Stack>
      <Box sx={{ width: '100%', height: 8, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 1, transition: 'width .3s' }} />
      </Box>
    </Paper>
  );
};

const SheetSection: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
    <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>{title}</Typography>
    </Box>
    <Box sx={{ p: 1.5 }}>{children}</Box>
  </Paper>
);

const ProficiencyRow: React.FC<{ label: string; proficient: boolean; modifier: number }> = ({ label, proficient, modifier }) => (
  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ py: 0.15 }}>
    <Box sx={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid', borderColor: 'text.secondary', bgcolor: proficient ? 'text.primary' : 'transparent', flexShrink: 0 }} />
    <Typography variant="body2" sx={{ width: 32, textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'monospace' }}>{formatMod(modifier)}</Typography>
    <Typography variant="body2" sx={{ fontSize: '0.8rem', ml: 0.5 }}>{label}</Typography>
  </Stack>
);

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */

/**
 * A centered dialog that displays a detailed preview of an app entity
 * referenced from a Worldpedia note link.
 *
 * Reuses `MonsterStatBlock` and `SpellStatBlock` for monsters and spells,
 * and renders a full D&D-style character sheet for characters.
 *
 * Supported entity types: `character`, `monster`, `spell`, `map`, `shop`,
 * `quest`, `encounter`.
 */
export default function WorldpediaEntityViewer({
  open,
  entityType,
  entityId,
  campaignId,
  onClose,
  dialogSx,
}: Props) {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const { fetchCampaigns } = useCampaignsContext();

  /** Resolved UI language narrowed to the two supported API locales. */
  const lang: 'en' | 'es' = (i18n.language?.startsWith('es') ? 'es' : 'en');

  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  /** Extra map data: which skyline ToDs are available + resolved music names. */
  const [mapSkylineTods, setMapSkylineTods] = useState<('dawn' | 'morning' | 'afternoon' | 'night')[]>([]);
  /** Resolved music entries from musicConfig: { tod, situation, name }[]. */
  const [mapMusicEntries, setMapMusicEntries] = useState<{ tod: string; situation: string; name: string }[]>([]);

  /* ── Fetch entity when dialog opens ────────────────────────────── */

  useEffect(() => {
    if (!open || !entityType || !entityId) {
      setEntity(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let data: any = null;

        switch (entityType) {
          case 'character':
            data = await getCharacter(entityId);
            break;
          case 'monster':
            data = await getCampaignMonster(campaignId, entityId, lang);
            break;
          case 'spell':
            data = await getCampaignSpell(campaignId, entityId, lang);
            break;
          case 'map': {
            const maps = await listMaps({ campaignId });
            data = maps.find((m) => m.id === entityId) ?? null;
            /* Resolve skyline availability per ToD */
            if (data) {
              const tods: ('dawn' | 'morning' | 'afternoon' | 'night')[] = ['dawn', 'morning', 'afternoon', 'night'];
              const checks = await Promise.all(tods.map((td) => hasMapSkylineForTod(entityId, td, 'full').catch(() => false)));
              if (!cancelled) setMapSkylineTods(tods.filter((_, i) => checks[i]));
              /* Resolve music config → human-readable names */
              const mc = (data as MapItemDto).musicConfig as Record<string, Record<string, { type: 'song' | 'playlist'; id: string }>> | undefined;
              if (mc && Object.keys(mc).length > 0) {
                try {
                  const [{ associated, reusable }, pls] = await Promise.all([
                    listSongsForCampaign(campaignId),
                    listPlaylists(campaignId),
                  ]);
                  const songMap = new Map<string, string>();
                  [...associated, ...reusable].forEach((s) => songMap.set(s.id, s.name));
                  const plMap = new Map<string, string>();
                  pls.forEach((p) => plMap.set(p.id, p.name));
                  const entries: { tod: string; situation: string; name: string }[] = [];
                  for (const [tod, situationMap] of Object.entries(mc)) {
                    for (const [situation, ref] of Object.entries(situationMap)) {
                      const resolved = ref.type === 'playlist' ? plMap.get(ref.id) : songMap.get(ref.id);
                      if (resolved) entries.push({ tod, situation, name: resolved });
                    }
                  }
                  if (!cancelled) setMapMusicEntries(entries);
                } catch { /* non-critical */ }
              } else if (!cancelled) {
                setMapMusicEntries([]);
              }
            } else {
              if (!cancelled) { setMapSkylineTods([]); setMapMusicEntries([]); }
            }
            break;
          }
          case 'shop':
            data = await getShop(entityId);
            break;
          case 'quest':
            data = await getQuest(entityId);
            break;
          case 'encounter': {
            const encounters = await listEncounters(campaignId);
            data = encounters.find((e) => e.id === entityId) ?? null;
            break;
          }
        }

        if (!cancelled) setEntity(data);
      } catch {
        if (!cancelled) setError(t('worldpedia_entity_load_error', 'Failed to load entity'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, entityType, entityId, campaignId, lang, t]);

  /* ── Send / remove character from Skyline ───────────────────────── */

  const [settingSkyline, setSettingSkyline] = useState(false);

  /* ── Spell detail dialog ──────────────────────────────────────── */

  const [spellDialogOpen, setSpellDialogOpen] = useState(false);
  const [spellDialogLoading, setSpellDialogLoading] = useState(false);
  const [spellDialogData, setSpellDialogData] = useState<CampaignSpellDetail | null>(null);
  const [spellDialogName, setSpellDialogName] = useState('');

  /**
   * Opens the spell detail sub-dialog. Searches the campaign catalogue by
   * exact name match; shows a "not in catalogue" message if not found.
   *
   * @param spellName - The display name of the spell to look up.
   */
  const handleSpellClick = useCallback(async (spellName: string) => {
    setSpellDialogName(spellName);
    setSpellDialogData(null);
    setSpellDialogOpen(true);
    setSpellDialogLoading(true);
    try {
      const searchLang: 'en' | 'es' = lang;
      const res = await listCampaignSpells(campaignId, { q: spellName, pageSize: 50 }, searchLang);
      const match = (res.items ?? []).find((s: { name: string }) => s.name.toLowerCase() === spellName.toLowerCase());
      if (!match) return;
      const detail = await getCampaignSpell(campaignId, match.id, searchLang);
      setSpellDialogData(detail);
    } catch {
      setSpellDialogData(null);
    } finally {
      setSpellDialogLoading(false);
    }
  }, [campaignId, lang]);

  /** True when this character is the one currently projected on Skyline. */
  const isActiveInSkyline =
    entityType === 'character' &&
    !!activeCampaign?.activeSkylineCharacter?.id &&
    activeCampaign.activeSkylineCharacter.id === entityId;

  /**
   * Toggles the active Skyline character.
   * If this character is already active, clears it (null). Otherwise sets it.
   */
  const handleSkylineToggle = useCallback(async () => {
    if (!activeCampaign?.id || !entityId) return;
    setSettingSkyline(true);
    try {
      const nextValue = isActiveInSkyline ? null : entityId;
      await setActiveSkylineCharacterId(activeCampaign.id, nextValue);
      await fetchCampaigns();
      localStorage.setItem(
        'app.skyline.activeCharacterUpdated',
        JSON.stringify({ campaignId: activeCampaign.id, characterId: nextValue, ts: Date.now() }),
      );
      try {
        new BroadcastChannel('campaign-sync').postMessage({ type: 'activeSkylineChanged', campaignId: activeCampaign.id });
      } catch { /* BroadcastChannel not supported */ }
      try {
        (window as any).electronAPI?.projectionPoke?.({ kind: 'activeSkylineChanged', campaignId: activeCampaign.id });
      } catch { /* electron not present */ }
    } catch { /* silent */ } finally {
      setSettingSkyline(false);
    }
  }, [activeCampaign?.id, entityId, isActiveInSkyline]);

  /* ── Ability labels (translated) ───────────────────────────────── */

  const abilityLabels: Record<string, string> = {
    str: t('str', 'FUE'), dex: t('dex', 'DES'), con: t('con', 'CON'),
    int: t('int', 'INT'), wis: t('wis', 'SAB'), cha: t('cha', 'CAR'),
  };

  /* ── Render: Character (full sheet) ────────────────────────────── */

  const renderCharacter = (ch: CharacterPayload) => {
    const initials = (ch.name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
    const avatarBg = ch.tokenColor || '#607d8b';

    return (
      <Box>
        {/* Header bar */}
        <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 2, py: 1.5, borderRadius: 1, mb: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
          {ch.tokenKind === 'image' && ch.tokenImageUrl ? (
            <Avatar src={ch.tokenImageUrl} alt={ch.name} sx={{ width: 64, height: 64, border: '2px solid', borderColor: 'primary.contrastText' }} />
          ) : (
            <Avatar sx={{ bgcolor: avatarBg, width: 64, height: 64, fontSize: 24, fontWeight: 700, border: '2px solid', borderColor: 'primary.contrastText' }}>{initials}</Avatar>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{ch.name}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {[ch.race, ch.className && ch.level ? `${ch.className} ${ch.level}` : ch.className, ch.alignment, ch.background].filter(Boolean).join(' · ')}
            </Typography>
            {ch.playerName && <Typography variant="caption" sx={{ opacity: 0.75 }}>{t('player_name', 'Jugador')}: {ch.playerName}</Typography>}
          </Box>
          {ch.characterImageUrl && (
            <Box component="img" src={ch.characterImageUrl} alt={ch.name} sx={{ maxHeight: 80, borderRadius: 1, objectFit: 'contain' }} />
          )}
        </Box>

        <Grid container spacing={2}>
          {/* Col 1: Abilities + proficiency + saves + skills */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Grid container spacing={0.5}>
              <Grid size={{ xs: 4 }}>
                <Stack spacing={1}>
                  {ABILITY_KEYS.map((k) => <AbilityBlock key={k} label={abilityLabels[k]} score={(ch as any)[k]} />)}
                </Stack>
              </Grid>
              <Grid size={{ xs: 8 }}>
                <Paper variant="outlined" sx={{ textAlign: 'center', py: 1, borderRadius: 2, mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>+{ch.proficiencyBonus ?? 2}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem' }}>{t('proficiency_bonus', 'Competencia')}</Typography>
                </Paper>

                <SheetSection title={t('saving_throws', 'Tiradas de Salvación')}>
                  {ABILITY_KEYS.map((k) => {
                    const prof = !!(ch.savingThrowProficiencies || {})[k];
                    const mod = abilityModNum((ch as any)[k]) + (prof ? (ch.proficiencyBonus ?? 2) : 0);
                    return <ProficiencyRow key={k} label={abilityLabels[k]} proficient={prof} modifier={mod} />;
                  })}
                </SheetSection>

                <SheetSection title={t('skills', 'Habilidades')}>
                  {SKILL_DEFS.map(({ key, labelKey, fallback, ability }) => {
                    const prof = !!(ch.skillProficiencies || {})[key];
                    const mod = abilityModNum((ch as any)[ability]) + (prof ? (ch.proficiencyBonus ?? 2) : 0);
                    return <ProficiencyRow key={key} label={`${t(labelKey, fallback)} (${abilityLabels[ability]})`} proficient={prof} modifier={mod} />;
                  })}
                </SheetSection>
              </Grid>
            </Grid>
          </Grid>

          {/* Col 2: Combat stats + attacks + spells */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <StatBox label={t('armor_class', 'CA')} value={ch.armorClass} icon={<ShieldIcon sx={{ fontSize: 20, color: 'text.secondary' }} />} />
              <StatBox label={t('initiative', 'Iniciativa')} value={ch.initiative != null ? (ch.initiative >= 0 ? `+${ch.initiative}` : ch.initiative) : '—'} />
              <StatBox label={t('speed', 'Velocidad')} value={ch.speed} icon={<DirectionsRunIcon sx={{ fontSize: 20, color: 'text.secondary' }} />} />
            </Stack>

            <Box sx={{ mb: 2 }}>
              <HpBar current={ch.currentHp} max={ch.maxHp} temp={ch.tempHp} />
            </Box>

            {ch.attacks && ch.attacks.length > 0 && (
              <SheetSection title={t('attacks', 'Ataques')}>
                {ch.attacks.map((a, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                    <Typography variant="body2">{a.bonus} | {a.damage}</Typography>
                  </Stack>
                ))}
                {ch.attacksNotes && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>{ch.attacksNotes}</Typography>}
              </SheetSection>
            )}

            {ch.spellsByLevel && Object.keys(ch.spellsByLevel).length > 0 && (
              <SheetSection title={t('spells', 'Hechizos')}>
                {ch.spellcastingAbility && (
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
                    <Chip size="small" label={`${t('spellcasting_ability', 'Aptitud')}: ${abilityLabels[ch.spellcastingAbility] ?? ch.spellcastingAbility}`} />
                    {ch.spellSaveDC != null && <Chip size="small" label={`DC ${ch.spellSaveDC}`} />}
                    {ch.spellAttackBonus != null && <Chip size="small" label={`Atk ${ch.spellAttackBonus >= 0 ? '+' : ''}${ch.spellAttackBonus}`} />}
                  </Stack>
                )}
                {ch.cantrips && ch.cantrips.length > 0 && (
                  <Box sx={{ mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{t('cantrips', 'Trucos')}</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.25 }}>
                      {ch.cantrips.map((c: string) => (
                        <Chip key={c} size="small" label={c} onClick={() => handleSpellClick(c)} sx={{ cursor: 'pointer' }} />
                      ))}
                    </Stack>
                  </Box>
                )}
                {Object.entries(ch.spellsByLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([lvl, spells]) => (
                  <Box key={lvl} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{t('level', 'Nivel')} {lvl}</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.25 }}>
                      {(spells as string[]).map((s: string) => (
                        <Chip key={`${lvl}-${s}`} size="small" label={s} onClick={() => handleSpellClick(s)} sx={{ cursor: 'pointer' }} />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </SheetSection>
            )}
          </Grid>

          {/* Col 3: Traits, equipment, proficiencies */}
          <Grid size={{ xs: 12, md: 4 }}>
            {ch.traitsAndFeatures && (
              <SheetSection title={t('traits_and_features', 'Rasgos y Características')}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ch.traitsAndFeatures}</Typography>
              </SheetSection>
            )}
            {ch.equipment && (
              <SheetSection title={t('equipment', 'Equipo')}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ch.equipment}</Typography>
              </SheetSection>
            )}
            {ch.otherProficienciesAndLanguages && (
              <SheetSection title={t('proficiencies_and_languages', 'Competencias e Idiomas')}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ch.otherProficienciesAndLanguages}</Typography>
              </SheetSection>
            )}

            {/* Currency */}
            {(ch.cp || ch.sp || ch.ep || ch.gp || ch.pp) && (
              <SheetSection title={t('currency', 'Moneda')}>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {ch.cp != null && ch.cp > 0 && <Chip size="small" label={`${ch.cp} CP`} />}
                  {ch.sp != null && ch.sp > 0 && <Chip size="small" label={`${ch.sp} SP`} />}
                  {ch.ep != null && ch.ep > 0 && <Chip size="small" label={`${ch.ep} EP`} />}
                  {ch.gp != null && ch.gp > 0 && <Chip size="small" label={`${ch.gp} GP`} />}
                  {ch.pp != null && ch.pp > 0 && <Chip size="small" label={`${ch.pp} PP`} />}
                </Stack>
              </SheetSection>
            )}

            {ch.backstory && (
              <SheetSection title={t('backstory', 'Trasfondo')}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ch.backstory}</Typography>
              </SheetSection>
            )}
          </Grid>
        </Grid>

        {/* Skyline button */}
        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Button
            variant={isActiveInSkyline ? 'outlined' : 'contained'}
            color={isActiveInSkyline ? 'warning' : 'primary'}
            size="small"
            disabled={settingSkyline}
            onClick={handleSkylineToggle}
          >
            {settingSkyline
              ? '…'
              : isActiveInSkyline
                ? t('remove_from_skyline', 'Quitar de Skyline')
                : t('send_to_skyline', 'Enviar a Skyline')}
          </Button>
        </Box>
      </Box>
    );
  };

  /* ── Render: Map ───────────────────────────────────────────────── */

  /** Translates a ToD key to a human label. */
  const todLabel = (tod: string): string => {
    const map: Record<string, string> = { dawn: t('tod_dawn', 'Amanecer'), morning: t('tod_morning', 'Mañana'), afternoon: t('tod_afternoon', 'Tarde'), night: t('tod_night', 'Noche') };
    return map[tod] ?? tod;
  };

  /** Translates a music situation key. */
  const situationLabel = (s: string): string => {
    const map: Record<string, string> = { base: 'Base', battleEasy: t('battle_easy', 'Batalla (Fácil)'), battleMedium: t('battle_medium', 'Batalla (Media)'), battleHard: t('battle_hard', 'Batalla (Difícil)'), battleDeadly: t('battle_deadly', 'Batalla (Letal)') };
    return map[s] ?? s;
  };

  const renderMap = (m: MapItemDto) => (
    <Box>
      {/* Main map image */}
      {m.imageAvailable && (
        <Box sx={{ mb: 2 }}>
          <AuthImage src={getMapImageUrlSized(m.id, 'preview')} alt={m.name} style={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 4 }} />
        </Box>
      )}

      {/* Description and meta */}
      {m.description && <Typography variant="body2" sx={{ mb: 2 }}>{m.description}</Typography>}
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        {Array.isArray(m.group) && m.group.map((g: string) => <Chip key={g} label={g} size="small" variant="outlined" />)}
        {m.timeOfDay && <Chip label={todLabel(m.timeOfDay)} size="small" color="info" variant="outlined" />}
        {m.isWorldMap && <Chip label={t('world_map', 'Mapa del Mundo')} size="small" color="primary" variant="outlined" />}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Skyline scenes */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('skyline_scenes', 'Escenas de Skyline')}</Typography>
      {mapSkylineTods.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{t('no_skyline_scenes', 'No hay escenas de skyline configuradas para este mapa.')}</Typography>
      ) : (
        <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 1 }}>
          {mapSkylineTods.map((td) => (
            <Box key={td} sx={{ textAlign: 'center' }}>
              <AuthImage
                src={getMapSkylineUrlSized(m.id, 'preview', { timeOfDay: td })}
                alt={`Skyline ${todLabel(td)}`}
                style={{ width: 200, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(0,0,0,0.12)' }}
              />
              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 600 }}>{todLabel(td)}</Typography>
            </Box>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Associated music */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('associated_music', 'Música Asociada')}</Typography>
      {mapMusicEntries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{t('no_associated_music', 'No hay música configurada para este mapa.')}</Typography>
      ) : (
        <Stack spacing={0.5}>
          {mapMusicEntries.map((entry, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <Chip label={todLabel(entry.tod)} size="small" variant="outlined" sx={{ minWidth: 80 }} />
              <Chip label={situationLabel(entry.situation)} size="small" color="info" variant="outlined" sx={{ minWidth: 100 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{entry.name}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );

  /* ── Render: Shop ──────────────────────────────────────────────── */

  const renderShop = (shop: Shop) => (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{shop.name}</Typography>
      {shop.description && <Typography variant="body2" sx={{ mb: 2 }}>{shop.description}</Typography>}
      {shop.sections.map((section) => (
        <Box key={section.id} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{section.name}</Typography>
          <Divider sx={{ my: 0.5 }} />
          {section.entries.map((entry) => (
            <Stack key={entry.id} direction="row" spacing={1} sx={{ py: 0.25 }}>
              {entry.cells.filter((c) => c.column.cellType === 'text').map((c) => (
                <Typography key={c.id} variant="body2">{c.textValue ?? ''}</Typography>
              ))}
            </Stack>
          ))}
        </Box>
      ))}
    </Box>
  );

  /* ── Render: Quest ─────────────────────────────────────────────── */

  const renderQuest = (q: QuestPayload) => {
    const statusColors: Record<string, 'default' | 'warning' | 'success'> = { not_accepted: 'default', accepted: 'warning', completed: 'success' };
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{q.title}</Typography>
        <Chip label={t(`quest_status_${q.status}`, q.status)} size="small" color={statusColors[q.status] ?? 'default'} sx={{ mb: 1 }} />
        {q.description && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{q.description}</Typography>}
        <Stack spacing={0.5} sx={{ mt: 2 }}>
          {q.createdBy && <Typography variant="body2"><strong>{t('created_by', 'Created by')}:</strong> {q.createdBy.username}</Typography>}
          {q.prerequisiteQuest && <Typography variant="body2"><strong>{t('prerequisite', 'Prerequisite')}:</strong> {q.prerequisiteQuest.title}</Typography>}
          <Typography variant="body2" color="text.secondary">{new Date(q.createdAt).toLocaleDateString()}</Typography>
        </Stack>
      </Box>
    );
  };

  /* ── Render: Encounter ─────────────────────────────────────────── */

  const renderEncounter = (enc: EncounterSummary) => (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{enc.name}</Typography>
      <Chip
        label={enc.difficulty}
        size="small"
        color={enc.difficulty === 'Mortal' ? 'error' : enc.difficulty === 'Difícil' ? 'warning' : enc.difficulty === 'Medio' ? 'info' : 'default'}
        sx={{ mb: 1 }}
      />
      {enc.participants.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('participants', 'Participants')}</Typography>
          <Divider sx={{ mb: 0.5 }} />
          {enc.participants.map((p) => (
            <Stack key={p.id} direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
              <Typography variant="body2">{p.name} <Typography component="span" variant="caption" color="text.secondary">({p.kind})</Typography></Typography>
              <Typography variant="body2" color="text.secondary">{p.maxHp != null ? `HP ${p.currentHp ?? '?'}/${p.maxHp}` : ''}{p.cr != null ? ` CR ${p.cr}` : ''}</Typography>
            </Stack>
          ))}
        </Box>
      )}
    </Box>
  );

  /* ── Render: Fallback ──────────────────────────────────────────── */

  const renderFallback = () => (
    <Box>
      <Typography variant="body2" color="text.secondary">{entityType}: {entityId}</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>{t('worldpedia_entity_preview_unavailable', 'Preview not available for this entity type yet.')}</Typography>
    </Box>
  );

  /* ── Resolve dialog title ──────────────────────────────────────── */

  const dialogTitle = (() => {
    if (entity) {
      switch (entityType) {
        case 'character': return (entity as CharacterPayload).name;
        case 'monster': return (entity as CampaignMonsterDetail).name;
        case 'spell': return (entity as CampaignSpellDetail).name;
        case 'map': return (entity as MapItemDto).name;
        case 'shop': return (entity as Shop).name;
        case 'quest': return (entity as QuestPayload).title;
        case 'encounter': return (entity as EncounterSummary).name;
      }
    }
    return entityType ? entityType.charAt(0).toUpperCase() + entityType.slice(1) : 'Entity';
  })();

  /* ── Determine max dialog width based on entity type ───────────── */

  const maxWidth: 'sm' | 'md' | 'lg' = entityType === 'character' ? 'lg' : entityType === 'monster' ? 'md' : 'md';

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { maxHeight: '90vh' } }}
      sx={dialogSx}
    >
      <DialogTitle sx={{ m: 0, pr: 6, fontWeight: 700 }}>
        {loading ? t('loading', 'Cargando...') : dialogTitle}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'grey.500' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Typography color="error">{error}</Typography>}

        {!loading && !error && entity && (
          <>
            {entityType === 'character' && renderCharacter(entity)}
            {entityType === 'monster' && <MonsterStatBlock monster={entity} />}
            {entityType === 'spell' && <SpellStatBlock spell={entity} />}
            {entityType === 'map' && renderMap(entity)}
            {entityType === 'shop' && renderShop(entity)}
            {entityType === 'quest' && renderQuest(entity)}
            {entityType === 'encounter' && renderEncounter(entity)}
            {!['character', 'monster', 'spell', 'map', 'shop', 'quest', 'encounter'].includes(entityType ?? '') && renderFallback()}
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* ── Spell detail sub-dialog ──────────────────────────────────── */}
    <Dialog
      open={spellDialogOpen}
      onClose={() => setSpellDialogOpen(false)}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: 1700 }}
    >
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
    </>
  );
}
