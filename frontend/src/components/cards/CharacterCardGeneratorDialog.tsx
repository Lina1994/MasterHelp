import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listCampaignCharactersLite,
  listCampaignSpells,
  listCampaignTraits,
  listCampaignFeats,
  type CampaignSpellListItem,
  type CampaignTraitListItem,
  type CampaignFeatListItem,
  type CharacterLite,
} from '../../api/cards/characterBundleApi';
import { getCampaignSpell } from '../../api/spells/spellsApi';
import { getCampaignTrait } from '../../api/traits/traitsApi';
import { getCampaignFeat } from '../../api/feats/featsApi';
import { getCharacter, type CharacterPayload } from '../../api/characters';
import type { CardEntityPayload, CardTemplate } from '../../types/cardTemplates';
import CardRenderer from './CardRenderer';
import { entityNormalisers } from './cardsFieldCatalog';
import { exportCardsAsPdf, printCardsViaBrowser } from '../../utils/cardExport';

/**
 * Builds the entity list for the chosen character: every selected trait, feat
 * and spell becomes one card. The character itself is only included when
 * `includeCharacterCard` is true so power users can opt out of the auto
 * character card when they only want the spell/trait/feat cards.
 */
function buildBundle({
  character,
  characterEntity,
  includeCharacterCard,
  enableSpells,
  enableTraits,
  enableFeats,
  visibleTraits,
  visibleFeats,
  visibleSpells,
  selectedSpells,
  selectedTraits,
  selectedFeats,
}: {
  character: CharacterLite | null;
  characterEntity: CardEntityPayload | null;
  includeCharacterCard: boolean;
  enableSpells: boolean; enableTraits: boolean; enableFeats: boolean;
  visibleTraits: CampaignTraitListItem[];
  visibleFeats: CampaignFeatListItem[];
  visibleSpells: CampaignSpellListItem[];
  selectedSpells: Set<string>;
  selectedTraits: Set<string>;
  selectedFeats: Set<string>;
}): CardEntityPayload[] {
  if (!character) return [];
  const out: CardEntityPayload[] = [];
  if (includeCharacterCard && characterEntity) out.unshift(characterEntity);
  if (enableTraits) visibleTraits.filter((t) => selectedTraits.has(t.id)).forEach((tr) => out.push(entityNormalisers.trait(tr)));
  if (enableFeats) visibleFeats.filter((f) => selectedFeats.has(f.id)).forEach((ft) => out.push(entityNormalisers.feat(ft)));
  if (enableSpells) visibleSpells.filter((s) => selectedSpells.has(s.id)).forEach((sp) => out.push(entityNormalisers.spell(sp)));
  return out;
}

/** Cache key for the per-entity enrichment map. */
function entityKey(e: Pick<CardEntityPayload, 'kind' | 'sourceId'>): string {
  return `${e.kind}:${e.sourceId}`;
}

/**
 * Clears the per-character "auto-mapped spells" tracker so the next
 * character-selection effect re-runs the name-to-id mapping. Centralised
 * so the open and character-detail paths can't drift.
 */
function resetAutoMappingRef(ref: MutableRefObject<string | null>) {
  ref.current = null;
}

/**
 * Fetches the full detail for an entity and runs it back through the
 * catalogue normaliser so the renderer sees the same payload shape as the
 * editor's live preview. The list endpoints intentionally omit heavy
 * `description` bodies, which is why we re-query per item before rendering.
 */
async function enrichEntity(
  campaignId: string,
  lang: 'en' | 'es',
  brief: CardEntityPayload,
): Promise<CardEntityPayload> {
  try {
    if (brief.kind === 'character') {
      const full = await getCharacter(brief.sourceId);
      return entityNormalisers.character(full);
    }
    if (brief.kind === 'spell') {
      const full = await getCampaignSpell(campaignId, brief.sourceId, lang);
      return entityNormalisers.spell(full);
    }
    if (brief.kind === 'trait') {
      const full = await getCampaignTrait(campaignId, brief.sourceId, lang);
      return entityNormalisers.trait(full);
    }
    if (brief.kind === 'feat') {
      const full = await getCampaignFeat(campaignId, brief.sourceId, lang);
      return entityNormalisers.feat(full);
    }
  } catch (err) {
    // Best-effort: fall back to the source-list payload so we still render
    // something useful (e.g. name + level) and surface the bind to the user.
    // eslint-disable-next-line no-console
    console.warn('[cards] detail fetch failed; using brief entity', brief.kind, brief.sourceId, err);
  }
  return brief;
}

/**
 * Sets of selected trait/feat IDs and spell names parsed from a
 * CharacterPayload. The character stores spell names (as freeform strings),
 * which is why the lookup against the campaign spell list happens at render
 * time rather than storing spell IDs on the character.
 */
interface CharacterSelection {
  traitIds: Set<string>;
  featIds: Set<string>;
  spellNames: Set<string>;
}

function selectionFromCharacter(c: CharacterPayload | null): CharacterSelection {
  const traitIds = new Set<string>(c?.selectedTraits ?? []);
  const featIds = new Set<string>(c?.selectedFeats ?? []);
  const spellNames = new Set<string>([
    ...(c?.cantrips ?? []),
    ...Object.values(c?.spellsByLevel ?? {}).flat(),
  ]);
  return { traitIds, featIds, spellNames };
}

export default function CharacterCardGeneratorDialog({
  open,
  onClose,
  campaignId,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  templates: CardTemplate[];
}) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';

  const [characters, setCharacters] = useState<CharacterLite[]>([]);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [enableSpells, setEnableSpells] = useState(true);
  const [enableTraits, setEnableTraits] = useState(true);
  const [enableFeats, setEnableFeats] = useState(true);
  // When a character is selected, lists default to the items that character
  // knows. Toggling "Mostrar todos los disponibles" reveals every entry in
  // the campaign so the user can mix and match.
  const [showAllTraits, setShowAllTraits] = useState(false);
  const [showAllFeats, setShowAllFeats] = useState(false);
  const [showAllSpells, setShowAllSpells] = useState(false);
  // Optional character card: when OFF the first "Personaje" page is dropped.
  const [includeCharacterCard, setIncludeCharacterCard] = useState(true);

  const [spells, setSpells] = useState<CampaignSpellListItem[]>([]);
  const [traits, setTraits] = useState<CampaignTraitListItem[]>([]);
  const [feats, setFeats] = useState<CampaignFeatListItem[]>([]);
  const [selectedSpells, setSelectedSpells] = useState<Set<string>>(new Set());
  const [selectedTraits, setSelectedTraits] = useState<Set<string>>(new Set());
  const [selectedFeats, setSelectedFeats] = useState<Set<string>>(new Set());
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Full character detail (used to filter lists by what the character owns).
  const [fullCharacter, setFullCharacter] = useState<CharacterPayload | null>(null);

  // Per-entity enrichment cache + tick so toggling one checkbox doesn't
  // refetch every previously selected card. Selection toggles use the cache;
  // language/campaign changes clear it.
  const enrichedCacheRef = useRef(new Map<string, CardEntityPayload>());
  const [enrichedTick, setEnrichedTick] = useState(0);
  // We only auto-pick the character's spells once per character, when both
  // the character detail and the campaign spell list are available.
  const autoMappedSpellsForRef = useRef<string | null>(null);

  const loadCharacters = useCallback(async () => {
    try {
      const list = await listCampaignCharactersLite(campaignId);
      setCharacters(list as CharacterLite[]);
    } catch { /* ignore */ }
  }, [campaignId]);

  useEffect(() => {
    if (!open) return;
    setCharacterId(null);
    setSelectedSpells(new Set());
    setSelectedTraits(new Set());
    setSelectedFeats(new Set());
    setShowAllTraits(false);
    setShowAllFeats(false);
    setShowAllSpells(false);
    setFullCharacter(null);
    resetAutoMappingRef(autoMappedSpellsForRef);
    enrichedCacheRef.current.clear();
    setEnrichedTick((t) => t + 1);
    loadCharacters();
  }, [open, loadCharacters]);

  useEffect(() => {
    if (!campaignId) return;
    if (enableSpells) listCampaignSpells(campaignId, { page: 1, pageSize: 1000 }, lang).then((res) => setSpells(res.items || [])).catch(() => setSpells([]));
    if (enableTraits) listCampaignTraits(campaignId, { page: 1, pageSize: 1000 }, lang).then((res) => setTraits(res.items || [])).catch(() => setTraits([]));
    if (enableFeats) listCampaignFeats(campaignId, { page: 1, pageSize: 1000 }, lang).then((res) => setFeats(res.items || [])).catch(() => setFeats([]));
  }, [campaignId, enableSpells, enableTraits, enableFeats, lang]);

  // Fetch full character detail when the user picks one. The full payload is
  // what carries selectedTraits / selectedFeats / cantrips / spellsByLevel —
  // everything we need to filter the lists below.
  //
  // We deliberately do NOT include `lang` in the deps: the backend character
  // endpoint doesn't accept a language query param, so refetching would
  // yield identical stored spell names. The cross-language mismatch (es
  // character + en list) is surfaced below as in-dialog Alert/info instead
  // — mitigating it properly would require the backend to return spell IDs
  // instead of free-text names (or a translate-on-demand endpoint).
  useEffect(() => {
    if (!characterId) {
      setFullCharacter(null);
      resetAutoMappingRef(autoMappedSpellsForRef);
      return;
    }
    let cancelled = false;
    getCharacter(characterId)
      .then((full) => {
        if (cancelled) return;
        setFullCharacter(full);
        const sel = selectionFromCharacter(full);
        setSelectedTraits(sel.traitIds);
        setSelectedFeats(sel.featIds);
        // Spell selection will be filled in once the spell list arrives and
        // matches the character's known spell names to their IDs.
        setSelectedSpells(new Set());
        resetAutoMappingRef(autoMappedSpellsForRef);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[cards] could not load character detail for filter', err);
      });
    return () => { cancelled = true; };
  }, [characterId]);

  // Map the character's known spell names to spell IDs from the campaign list.
  // Only runs once per character so the user can still toggle individual
  // spells afterwards without us clobbering their choices.
  useEffect(() => {
    if (!fullCharacter) return;
    if (autoMappedSpellsForRef.current === fullCharacter.id) return;
    if (spells.length === 0) return;
    const sel = selectionFromCharacter(fullCharacter);
    const ids = new Set<string>();
    for (const sp of spells) {
      if (sel.spellNames.has(sp.name)) ids.add(sp.id);
    }
    setSelectedSpells(ids);
    // CharacterPayload.id is technically optional in the API type; coa­
    // lesce to null so the ref keeps its `string | null` shape.
    autoMappedSpellsForRef.current = fullCharacter.id ?? null;
  }, [fullCharacter, spells]);

  useEffect(() => {
    enrichedCacheRef.current.clear();
    setEnrichedTick((t) => t + 1);
  }, [campaignId, lang]);

  // The character filter only applies while we have a character detail and
  // each "Mostrar todos" toggle is OFF. When the toggle is ON we render the
  // full campaign list. Otherwise the list is filtered by what the character
  // owns per kind (IDs for traits/feats, names for spells).
  const visibleTraits = useMemo(() => {
    if (showAllTraits || !fullCharacter) return traits;
    const sel = selectionFromCharacter(fullCharacter);
    return traits.filter((t) => sel.traitIds.has(t.id));
  }, [traits, fullCharacter, showAllTraits]);

  const visibleFeats = useMemo(() => {
    if (showAllFeats || !fullCharacter) return feats;
    const sel = selectionFromCharacter(fullCharacter);
    return feats.filter((f) => sel.featIds.has(f.id));
  }, [feats, fullCharacter, showAllFeats]);

  const visibleSpells = useMemo(() => {
    if (showAllSpells || !fullCharacter) return spells;
    const sel = selectionFromCharacter(fullCharacter);
    return spells.filter((s) => sel.spellNames.has(s.name));
  }, [spells, fullCharacter, showAllSpells]);

  const character = useMemo(() => characters.find((c) => c.id === characterId) ?? null, [characters, characterId]);
  const characterEntity = useMemo<CardEntityPayload | null>(() => {
    if (!character) return null;
    return entityNormalisers.character({
      id: character.id,
      name: character.name,
      // CharacterLite.kind is optional; default to 'pc' so the normaliser
      // (which types kind as required) is happy when the lite listing omits it.
      kind: character.kind ?? 'pc',
    });
  }, [character]);

  const selectedTemplate = useMemo(() => templates.find((tpl) => tpl.id === templateId) ?? null, [templates, templateId]);

  const buildEntities = useCallback((): CardEntityPayload[] => buildBundle({
    character, characterEntity,
    includeCharacterCard,
    enableSpells, enableTraits, enableFeats,
    visibleTraits, visibleFeats, visibleSpells,
    selectedSpells, selectedTraits, selectedFeats,
  }), [character, characterEntity, includeCharacterCard, enableSpells, enableTraits, enableFeats, visibleTraits, visibleFeats, visibleSpells, selectedSpells, selectedTraits, selectedFeats]);

  // Memoised so toggling switches or error state doesn't regenerate the
  // entity array (and therefore re-mount every <CardRenderer /> child) on
  // every render.
  const entities = useMemo(buildEntities, [buildEntities]);

  // Eagerly enrich visible entities so the right-hand preview shows the
  // description binding the same way the editor's live preview does.
  useEffect(() => {
    if (entities.length === 0) return;
    let cancelled = false;
    const missing = entities.filter((e) => !enrichedCacheRef.current.has(entityKey(e)));
    if (missing.length === 0) {
      setEnrichedTick((t) => t + 1);
      return;
    }
    Promise.all(missing.map((e) => enrichEntity(campaignId, lang, e)))
      .then((res) => {
        if (cancelled) return;
        res.forEach((r, i) => {
          enrichedCacheRef.current.set(entityKey(missing[i]), r);
        });
        setEnrichedTick((t) => t + 1);
      })
      .catch(() => { /* errors already logged per-entity */ });
    return () => { cancelled = true; };
  }, [entities, campaignId, lang]);

  // Used by both the live preview grid and the export/print handlers.
  const displayEntities = useMemo(
    () => entities.map((e) => enrichedCacheRef.current.get(entityKey(e)) ?? e),
    // enrichedTick is the cache version; deps ignored intentionally to keep
    // the array aligned with the loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, enrichedTick],
  );

  // Cross-language mismatch detection. Fires after the auto-mapping effect
  // ran for the current character: if the character stores n spell names but
  // none of them line up with the campaign spell list (the names are
  // independent strings the user authored), surface a soft warning so the
  // user knows the empty selection is not their fault.
  const characterKnownSpellCount = useMemo(() => {
    if (!fullCharacter) return 0;
    const cantrips = fullCharacter.cantrips?.length ?? 0;
    const byLevel = Object.values(fullCharacter.spellsByLevel ?? {}).flat().length;
    return cantrips + byLevel;
  }, [fullCharacter]);
  const crossLangSpellMismatch =
    !!fullCharacter &&
    autoMappedSpellsForRef.current !== null &&
    autoMappedSpellsForRef.current === (fullCharacter.id ?? null) &&
    characterKnownSpellCount > 0 &&
    selectedSpells.size === 0;

  const ensureAllEnriched = useCallback(async (): Promise<CardEntityPayload[]> => {
    const cached: CardEntityPayload[] = [];
    const missing: CardEntityPayload[] = [];
    for (const e of entities) {
      const hit = enrichedCacheRef.current.get(entityKey(e));
      if (hit) cached.push(hit);
      else missing.push(e);
    }
    if (missing.length === 0) return cached;
    const fetched = await Promise.all(missing.map((e) => enrichEntity(campaignId, lang, e)));
    fetched.forEach((r, i) => {
      const key = entityKey(missing[i]);
      enrichedCacheRef.current.set(key, r);
      cached.push(r);
    });
    setEnrichedTick((t) => t + 1);
    return cached;
  }, [entities, campaignId, lang]);

  const handleExport = async () => {
    if (!selectedTemplate) return;
    setExportingPdf(true);
    setError(null);
    try {
      const built = await ensureAllEnriched();
      if (built.length === 0) { setError(t('cards_generator_no_entities', 'Selecciona al menos un elemento para generar cartas.')); return; }
      const filename = `cartas-${character?.name?.replace(/\s+/g, '_') ?? 'personaje'}-${Date.now()}.pdf`;
      await exportCardsAsPdf(selectedTemplate, built, { filename });
    } catch (e: any) {
      setError(e?.message ?? t('cards_export_error', 'Error al exportar el PDF.'));
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedTemplate) return;
    setError(null);
    try {
      const built = await ensureAllEnriched();
      if (built.length === 0) { setError(t('cards_generator_no_entities', 'Selecciona al menos un elemento para generar cartas.')); return; }
      printCardsViaBrowser(selectedTemplate, built);
    } catch (e: any) {
      setError(e?.message ?? t('cards_export_error', 'Error al exportar el PDF.'));
    }
  };

  const totalSelected =
    (includeCharacterCard && character ? 1 : 0) +
    (enableSpells ? selectedSpells.size : 0) +
    (enableTraits ? selectedTraits.size : 0) +
    (enableFeats ? selectedFeats.size : 0);

  // Detection of in-flight enrichment: any currently visible entity missing
  // from the cache is being loaded.
  const isEnriching = entities.length > 0 && entities.some((e) => !enrichedCacheRef.current.has(entityKey(e)));

  const toggleAllTraits = () => {
    if (selectedTraits.size === visibleTraits.length && visibleTraits.length > 0) {
      setSelectedTraits(new Set());
    } else {
      setSelectedTraits(new Set(visibleTraits.map((t) => t.id)));
    }
  };
  const toggleAllFeats = () => {
    if (selectedFeats.size === visibleFeats.length && visibleFeats.length > 0) {
      setSelectedFeats(new Set());
    } else {
      setSelectedFeats(new Set(visibleFeats.map((f) => f.id)));
    }
  };
  const toggleAllSpells = () => {
    if (selectedSpells.size === visibleSpells.length && visibleSpells.length > 0) {
      setSelectedSpells(new Set());
    } else {
      setSelectedSpells(new Set(visibleSpells.map((s) => s.id)));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{t('cards_generator_title', 'Generar cartas del personaje')}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, gap: 2 }}>
          {/* Left column – pickers */}
          <Box>
            <Stack spacing={2}>
              <Autocomplete
                options={characters}
                getOptionLabel={(o) => o?.name ?? ''}
                value={character}
                onChange={(_, v) => setCharacterId(v?.id ?? null)}
                renderInput={(params) => <TextField {...params} label={t('cards_generator_character', 'Personaje')} size="small" />}
              />
              <Autocomplete
                options={templates}
                getOptionLabel={(o) => o?.name ?? ''}
                value={selectedTemplate}
                onChange={(_, v) => setTemplateId(v?.id ?? null)}
                renderInput={(params) => <TextField {...params} label={t('cards_generator_template', 'Plantilla')} size="small" />}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                <FormControlLabel control={<Switch size="small" checked={enableTraits} onChange={(_, v) => setEnableTraits(v)} />} label={t('cards_generator_traits', 'Incluir rasgos')} />
                <FormControlLabel control={<Switch size="small" checked={enableFeats} onChange={(_, v) => setEnableFeats(v)} />} label={t('cards_generator_feats', 'Incluir dotes')} />
                <FormControlLabel control={<Switch size="small" checked={enableSpells} onChange={(_, v) => setEnableSpells(v)} />} label={t('cards_generator_spells', 'Incluir conjuros')} />
                <FormControlLabel control={<Switch size="small" checked={includeCharacterCard} onChange={(_, v) => setIncludeCharacterCard(v)} />} label={t('cards_generator_include_character', 'Incluir carta de personaje')} />
              </Stack>
              {enableTraits && (
                <CharFilteredList
                  title={t('cards_generator_traits', 'Rasgos')}
                  hint={fullCharacter && !showAllTraits ? t('cards_generator_filtered_hint', 'Solo los del personaje') : null}
                  emptyMessage={t('no_results', 'Sin resultados.')}
                  items={visibleTraits}
                  selected={selectedTraits}
                  onToggle={(id) => setSelectedTraits((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  onToggleAll={toggleAllTraits}
                  showAll={showAllTraits}
                  onToggleShowAll={() => setShowAllTraits((v) => !v)}
                  showAllAvailable={!!fullCharacter}
                  renderItem={(tr) => tr.name}
                />
              )}
              {enableFeats && (
                <CharFilteredList
                  title={t('cards_generator_feats', 'Dotes')}
                  hint={fullCharacter && !showAllFeats ? t('cards_generator_filtered_hint', 'Solo los del personaje') : null}
                  emptyMessage={t('no_results', 'Sin resultados.')}
                  items={visibleFeats}
                  selected={selectedFeats}
                  onToggle={(id) => setSelectedFeats((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  onToggleAll={toggleAllFeats}
                  showAll={showAllFeats}
                  onToggleShowAll={() => setShowAllFeats((v) => !v)}
                  showAllAvailable={!!fullCharacter}
                  renderItem={(ft) => ft.name}
                />
              )}
              {enableSpells && (
                <>
                  {crossLangSpellMismatch && (
                    <Alert severity="info" sx={{ py: 0.5 }}>
                      {t('cards_generator_cross_lang_warning', {
                        count: characterKnownSpellCount,
                        defaultValue:
                          `El personaje tiene ${characterKnownSpellCount} conjuro(s) guardado(s) pero ninguno coincide con el listado de la campaña. Verifica que el personaje y la lista estén en el mismo idioma, o activa "Mostrar todos los disponibles".`,
                      })}
                    </Alert>
                  )}
                  <CharFilteredList
                    title={t('cards_generator_spells', 'Conjuros')}
                    hint={fullCharacter && !showAllSpells ? t('cards_generator_filtered_hint', 'Solo los del personaje') : null}
                    emptyMessage={t('no_results', 'Sin resultados.')}
                    items={visibleSpells}
                    selected={selectedSpells}
                    onToggle={(id) => setSelectedSpells((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                    onToggleAll={toggleAllSpells}
                    showAll={showAllSpells}
                    onToggleShowAll={() => setShowAllSpells((v) => !v)}
                    showAllAvailable={!!fullCharacter}
                    renderItem={(sp) => `${sp.level === 0 ? t('manuals_spell_cantrip', 'Truco') : `${t('cards_level', 'Nv')} ${sp.level}`} — ${sp.name}`}
                  />
                </>
              )}
            </Stack>
          </Box>

          {/* Right column – grid preview of ALL cards */}
          <Box>
            <Paper variant="outlined" sx={{ p: 1.5, height: '60vh', overflow: 'auto', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.default' : 'grey.50' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">
                  {t('cards_grid_title', 'Vista previa de todas las cartas')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {totalSelected === 0
                    ? t('cards_grid_empty', 'Selecciona personaje, plantilla y elementos para previsualizar.')
                    : isEnriching
                      ? t('cards_grid_enriching', 'Cargando detalles de las cartas…')
                      // Modern i18next expects the default value + interpolation
                      // values to sit inside the options object so the locale's
                      // `{{count}}` placeholder is honoured.
                      : t('cards_grid_count', { count: totalSelected, defaultValue: `${totalSelected} carta(s) — esta es exactamente la exportación` })}
                </Typography>
              </Stack>
              {!selectedTemplate ? (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">{t('cards_grid_pick_template', 'Elige una plantilla arriba para empezar.')}</Typography>
                </Box>
              ) : displayEntities.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">{t('cards_grid_no_entities', 'No hay cartas que mostrar todavía. Marca rasgos, dotes o conjuros en el panel izquierdo.')}</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5 }}>
                  {displayEntities.map((ent, idx) => (
                    <Box key={`${ent.kind}-${ent.sourceId}-${idx}`} sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>
                        {indexLabel(ent, idx, t)}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <CardRenderer
                          template={selectedTemplate}
                          entity={ent}
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
        <Button onClick={handlePrint} disabled={!selectedTemplate || !character || isEnriching}>
          {t('cards_action_print', 'Imprimir')}
        </Button>
        <Button onClick={handleExport} variant="contained" disabled={!selectedTemplate || !character || exportingPdf || entities.length === 0 || isEnriching}>
          {exportingPdf ? t('cards_exporting', 'Exportando…') : t('cards_action_download_pdf', `Descargar PDF (${Math.max(entities.length, 0)})`)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Compact list panel used for traits / feats / spells. Provides a
 * "Seleccionar todo / Limpiar" button, an optional "Mostrar todos los
 * disponibles" toggle, and the per-item checkboxes.
 */
function CharFilteredList<T extends { id: string }>({
  title,
  hint,
  emptyMessage,
  items,
  selected,
  onToggle,
  onToggleAll,
  showAll,
  onToggleShowAll,
  showAllAvailable,
  renderItem,
}: {
  title: string;
  hint: string | null;
  emptyMessage: string;
  items: T[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  showAllAvailable: boolean;
  renderItem: (item: T) => string;
}) {
  const { t } = useTranslation();
  const allSelected = items.length > 0 && selected.size >= items.length;
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {title}{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            ({selected.size}/{items.length})
          </Typography>
        </Typography>
        <Tooltip title={allSelected ? t('cards_generator_clear', 'Limpiar') : t('cards_generator_select_all', 'Seleccionar todo')}>
          <span>
            <IconButton size="small" onClick={onToggleAll} disabled={items.length === 0}>
              {allSelected ? <DeselectIcon fontSize="small" /> : <SelectAllIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        {showAllAvailable && (
          <Tooltip title={showAll ? t('cards_generator_show_only_character', 'Solo del personaje') : t('cards_generator_show_all', 'Mostrar todos los disponibles')}>
            <span>
              <IconButton size="small" color={showAll ? 'primary' : 'default'} onClick={onToggleShowAll}>
                {showAll ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {hint}
        </Typography>
      )}
      <Box sx={{ maxHeight: 160, overflow: 'auto' }}>
        {items.length === 0 ? (
          <Typography variant="caption" color="text.secondary">{emptyMessage}</Typography>
        ) : (
          items.map((item) => (
            <FormControlLabel
              key={item.id}
              control={<Checkbox size="small" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />}
              label={renderItem(item)}
            />
          ))
        )}
      </Box>
    </Paper>
  );
}

function indexLabel(entity: CardEntityPayload, idx: number, t: (k: string, fallback: string) => string): string {
  const num = `${idx + 1}.`;
  switch (entity.kind) {
    case 'character': return `${num} ${t('cards_grid_kind_character', 'Personaje')}`;
    case 'spell': return `${num} ${t('cards_grid_kind_spell', 'Conjuro')}`;
    case 'trait': return `${num} ${t('cards_grid_kind_trait', 'Rasgo')}`;
    case 'feat': return `${num} ${t('cards_grid_kind_feat', 'Dote')}`;
    case 'monster': return `${num} ${t('cards_grid_kind_monster', 'Monstruo')}`;
    default: return `${num}`;
  }
}
