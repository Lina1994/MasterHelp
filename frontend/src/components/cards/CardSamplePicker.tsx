import { Alert, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../apiBase';
import { entityNormalisers } from './cardsFieldCatalog';
import { DEFAULT_MANUAL } from './sharedSampleCache';
import type { CardEntityKind, CardEntityPayload } from '../../types/cardTemplates';

/** Resolve the app's current language to the manuals API 'lang' parameter. */
function resolveAppLang(i18nLanguage: string | undefined): 'en' | 'es' {
  return (i18nLanguage?.slice(0, 2) === 'es' ? 'es' : 'en');
}

/** Maps our internal entity kind to the URL slug the manuals API expects. */
function kindToPath(kind: CardEntityKind): string {
  switch (kind) {
    case 'spell': return 'spells';
    case 'trait': return 'traits';
    case 'feat': return 'feats';
    case 'monster': return 'monsters';
    case 'character': return 'characters';
    case 'shop-item': return 'shops';
    default: return 'spells';
  }
}

/**
 * Two-selector dropdown that lets the editor pick a real example of a
 * character, trait, feat or spell from `DEFAULT_MANUAL` so the
 * live preview renders against authentic content rather than the
 * synthetic fallback that {@link CardPreview} ships by default.
 *
 * Layout (the user explicitly asked for "two selectors"):
 *   • kind (Tipo)    —  first `<Select>`. Restricted to the four
 *                       kinds the user listed (spell/trait/feat /
 *                       character); `monster` and `shop-item` remain
 *                       part of the `CardEntityKind` type system for
 *                       other consumers (e.g. `CardTemplateList.tsx`)
 *                       but are intentionally NOT exposed here, since
 *                       the picker is meant to surface example data
 *                       that fits a typical NPC / spell / trait card
 *                       rather than stat-heavy monsters.
 *   • entity         —  second `<Select>`. Lists the real entities
 *                       (by `name`) for the active kind, fetched from
 *                       `/manuals/{id}/{kindPath}` and detail-loaded
 *                       via `/manuals/{id}/{kindPath}/{entityId}`.
 *                       Both fetches share an `AbortController` so a
 *                       slow kind-switch response can't overwrite a
 *                       newer pick.
 *
 * Lifetime:
 *   • Mount → `fetchItems` fires (initial spell list).
 *   • Kind change → `selectedId` is cleared so the entity `Select`
 *     falls back to its placeholder rather than silently retaining a
 *     pick from the previous kind.
 *   • Entity selection → `fetchAndApply` aborts any in-flight detail
 *     request via the shared controller, then fires a single detail
 *     fetch whose result is normalised and pushed upstream via
 *     `onChange`.
 *
 * The component used to also expose a programmatic list of hardcoded
 * preset buttons (`BUILTIN_SAMPLES`) and a manual `<Select>`. Those
 * were removed in earlier iterations: the buttons because they were
 * made-up data, and the manual `<Select>` because it would have made
 * three controls instead of the two requested here.
 */
export default function CardSamplePicker({
  value,
  onChange,
}: {
  value: CardEntityPayload | null;
  onChange: (entity: CardEntityPayload | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = resolveAppLang(i18n.language);

  const [activeKind, setActiveKind] = useState<CardEntityKind>('spell');
  const [loadingList, setLoadingList] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Single shared abort controller so the new call invalidates any
  // in-flight listing or detail fetch from the previous kind/pick.
  // `finally` blocks on the fetches reference `inflightRef.current`
  // by identity to decide whether to flip their `loading*` booleans,
  // so leaving the dead reference alive (rather than nulling it
  // here) is deliberate — see CardSamplePicker history.
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);

  // Fetch top items for the chosen kind whenever the active kind
  // (or language) changes.
  const fetchItems = useCallback(async () => {
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    setLoadingList(true);
    setLoadError(null);
    try {
      const url = `/manuals/${encodeURIComponent(DEFAULT_MANUAL)}/${kindToPath(activeKind)}`;
      const res = await api.get(url, {
        params: { page: 1, pageSize: 60, sortBy: 'name', sortDir: 'asc', lang },
        signal: ctrl.signal,
      });
      const raw = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setItems(raw.map((it: any) => ({ id: it.id, label: it.name ?? it.title ?? it.id })));
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError') return;
      setLoadError(e?.response?.data?.message ?? t('cards_sample_load_error', 'No se pudieron cargar muestras del manual.'));
      setItems([]);
    } finally {
      if (inflightRef.current === ctrl) setLoadingList(false);
    }
  }, [activeKind, lang, t]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Detail fetch when the user picks a specific entity. Returns the
  // normalised payload to the parent so the preview re-renders
  // against real data without any further glue in `CardPreview`.
  const fetchAndApply = useCallback(async (id: string) => {
    if (!id) return;
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    setLoadingDetail(true);
    setLoadError(null);
    try {
      const url = `/manuals/${encodeURIComponent(DEFAULT_MANUAL)}/${kindToPath(activeKind)}/${encodeURIComponent(id)}`;
      const res = await api.get(url, { params: { lang }, signal: ctrl.signal });
      const raw = res.data;
      const normaliser = entityNormalisers[activeKind];
      onChange(normaliser(raw));
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError') return;
      setLoadError(e?.response?.data?.message ?? t('cards_sample_detail_error', 'No se pudo cargar el detalle de la muestra.'));
    } finally {
      if (inflightRef.current === ctrl) setLoadingDetail(false);
    }
  }, [activeKind, lang, onChange, t]);

  const onKindChange = (next: CardEntityKind) => {
    // Sync the parent with the picker BEFORE changing kind: if a
    // previous pick existed, drop the upstream sampleEntity too so
    // the preview doesn't keep showing an entity whose id is no
    // longer present in the new kind's list. Without this branch
    // the picker would render its placeholder for kind=N+1 while the
    // preview still shows the previous kind's entity — the two UI
    // surfaces would be out of sync until the user picked again.
    if (selectedId) onChange(null);
    setActiveKind(next);
    // Reset the local pick too: `selectedId` from the previous kind
    // won't be present in the new `items` array the fetchItems
    // effect is about to load, so leaving it would render an
    // out-of-range Select value on the next paint.
    setSelectedId(null);
  };

  const onEntityChange = (id: string) => {
    // Empty value comes from the placeholder MenuItem (rendered with
    // `value=""` for the loading / empty / error states). Treating
    // it as a deliberate "clear" gives the user a path back to the
    // synthetic placeholder that lives in CardPreview / fallback
    // entity helpers — a primitive substitute for the X-clear
    // button that the previous Autocomplete-based UI exposed.
    if (!id) {
      inflightRef.current?.abort();
      setSelectedId(null);
      onChange(null);
      return;
    }
    // Abort any in-flight detail fetch BEFORE triggering a fresh
    // one. The shared `inflightRef` is what the previous fetch's
    // `finally` block inspects against, so a fresh abort here is
    // benign and lets the new detail request land cleanly.
    inflightRef.current?.abort();
    setSelectedId(id);
    fetchAndApply(id);
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('cards_sample_kind', 'Tipo')}</InputLabel>
          <Select
            label={t('cards_sample_kind', 'Tipo')}
            value={activeKind}
            onChange={(e) => onKindChange(e.target.value as CardEntityKind)}
          >
            {/* Four kinds only, per the user's explicit ask. The
                monster and shop-item branches in `CardEntityKind`
                stay available to other consumers (CardTemplateList,
                sharedSampleCache) — the edit-dialog preview just
                doesn't render them as a `<MenuItem>`. */}
            <MenuItem value="spell">{t('cards_sample_kind_spell', 'Conjuro')}</MenuItem>
            <MenuItem value="trait">{t('cards_sample_kind_trait', 'Rasgo')}</MenuItem>
            <MenuItem value="feat">{t('cards_sample_kind_feat', 'Dote')}</MenuItem>
            <MenuItem value="character">{t('cards_sample_kind_character', 'Personaje')}</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 260, flex: 1 }}>
          <InputLabel>{t('cards_sample_entity', 'Ejemplo')}</InputLabel>
          <Select
            label={t('cards_sample_entity', 'Ejemplo')}
            value={selectedId ?? ''}
            onChange={(e) => onEntityChange(e.target.value as string)}
            disabled={loadingList || loadingDetail}
            endAdornment={
              // Explicit clear affordance. MUI's `<Select>` has no
              // built-in X-clear button (unlike `<Autocomplete>`), so
              // the only way to return to the synthetic placeholder
              // without changing kind was the unreachable `!id` branch
              // in `onEntityChange`. This IconButton surfaces that path:
              // it appears only when there is a current pick (so it
              // never lingers over an empty list) and on click aborts
              // any inflight fetch, drops the local pick and propagates
              // `null` to the parent so the preview reverts to the
              // synthetic `Bola de fuego` fallback that lives inside
              // CardPreview / fallbackEntityFromSlots.
              selectedId ? (
                <InputAdornment position="end" sx={{ mr: 1 }}>
                  <Tooltip title={t('cards_sample_clear', 'Limpiar muestra (volver al ejemplo por defecto)')}>
                    <IconButton
                      size="small"
                      edge="end"
                      // MUI `<Select>` v5 opens its dropdown on its own
                      // `mousedown` handler, not `click`, so an
                      // IconButton nested in `endAdornment` would otherwise
                      // toggle the dropdown open for one paint before
                      // closing. Cut both the mousedown AND the click so
                      // the X-button click stays purely an "abort + clear"
                      // gesture and never bleeds into the Select's open
                      // behaviour. `preventDefault()` on `mousedown` also
                      // keeps the Select from receiving focus on the
                      // toggle, which would re-render and momentarily
                      // show the (now-empty) placeholder text blink.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        inflightRef.current?.abort();
                        setSelectedId(null);
                        // Drop any pending loadError too so the
                        // `Alert severity="warning"` from a previous
                        // failing fetch doesn't linger over the freshly
                        // cleared state — the user sees a coherent
                        // reset, not a stale error whose cause the
                        // clear just removed.
                        setLoadError(null);
                        onChange(null);
                      }}
                      aria-label={t('cards_sample_clear', 'Limpiar muestra')}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : null
            }
          >
            {/* Three mutually-exclusive placeholder states are
                rendered as a single disabled MenuItem at the top of
                the list so the Select always has a valid selection
                (`''`) and the user sees why a list might be empty:
                loading, error, or fetched-but-empty. The empty-string
                value is intercepted by `onEntityChange` early-return
                so it never reaches `fetchAndApply`. */}
            {loadingList && (
              <MenuItem value="" disabled>{t('cards_sample_loading', 'Cargando…')}</MenuItem>
            )}
            {!loadingList && items.length === 0 && (
              <MenuItem value="" disabled>
                {loadError
                  ? t('cards_sample_empty_error', 'No se encontraron entradas')
                  : t('cards_sample_empty', 'Sin resultados')}
              </MenuItem>
            )}
            {items.map((it) => (
              <MenuItem key={it.id} value={it.id}>{it.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {loadError && <Alert severity="warning">{loadError}</Alert>}
      <Typography variant="caption" color="text.secondary">
        {t('cards_sample_active', 'Muestra activa: ')}
        {value?.data?.name ? String(value.data.name) : t('none', 'Ninguna')}
      </Typography>
    </Stack>
  );
}
