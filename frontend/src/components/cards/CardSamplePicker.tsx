import { Alert, Autocomplete, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Resolve the app's current language to the manuals API 'lang' parameter. */
function resolveAppLang(i18nLanguage: string | undefined): 'en' | 'es' {
  return (i18nLanguage?.slice(0, 2) === 'es' ? 'es' : 'en');
}
import { api } from '../../apiBase';
import { entityNormalisers } from './cardsFieldCatalog';
import type { CardEntityKind, CardEntityPayload } from '../../types/cardTemplates';

/**
 * Preset sample entities used when the editor hasn't picked a real one yet,
 * or when the manuals fetch fails. Each entry mirrors the flat data shape
 * produced by {@link entityNormalisers}.
 */
const BUILTIN_SAMPLES: { kind: CardEntityKind; label: string; data: Record<string, unknown> }[] = [
  { kind: 'spell', label: 'Bola de fuego', data: { name: 'Bola de fuego', level: 3, school: 'Evocación', castingTime: '1 acción', range: '45 m', duration: 'Instantáneo', components: 'V, S, M', description: 'Una bola de fuego estalla y rellena una esfera de 6 m de radio.' } },
  { kind: 'trait', label: 'Ataque extra', data: { name: 'Ataque extra', description: 'Puedes realizar un ataque adicional al hacer la acción de Ataque.' } },
  { kind: 'feat', label: 'Ráfaga de disparos', data: { name: 'Ráfaga de disparos', prerequisite: 'Nivel 5+', description: 'Al hacer la acción de Ataque puedes disparar dos veces.' } },
  { kind: 'monster', label: 'Dragón negro adulto', data: { name: 'Dragón negro adulto', size: 'Grande', type: 'Dragón', alignment: 'Caótico Malvado', challengeRating: '14', armorClass: 19, hitPoints: 195, speed: '40 m, vuelo 80 m', abilities: { strength: 23, dexterity: 14, constitution: 21, intelligence: 14, wisdom: 11, charisma: 19 } } },
  { kind: 'character', label: 'Lyra (Bárbara)', data: { name: 'Lyra', className: 'Bárbara', level: 5, race: 'Semielfa', strength: 16, dexterity: 14, constitution: 16, intelligence: 10, wisdom: 12, charisma: 13, armorClass: 16, maxHp: 48, description: 'Guerrera itinerante que protege las aldeas del norte.' } },
];

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
 * Dropdown that lets the editor pick a real global entity (spell/trait /
 * feat/monster from any manual) so the live preview can show authentic
 * content. Falls back gracefully to a built-in mock sample on network or
 * permission errors so the editor is never blank.
 *
 * Stale-response protection: rapid manual/kind switches can otherwise let
 * an older fetch resolve last and overwrite the list; we cancel it via an
 * AbortController.
 */
export default function CardSamplePicker({
  value,
  onChange,
}: {
  value: CardEntityPayload | null;
  onChange: (entity: CardEntityPayload | null) => void;
}) {
  const { t, i18n } = useTranslation();
  // Always re-derive `lang` from i18n so the picker follows the user's
  // current UI language (catalogue data exists in both en/es). Update the
  // hook on every render via a memoised accessor.
  const lang = resolveAppLang(i18n.language);
  const [manualId, setManualId] = useState<string>('dnd5e-2014');
  const [manuals, setManuals] = useState<{ id: string; name: string }[]>([]);
  const [activeKind, setActiveKind] = useState<CardEntityKind>('spell');
  const [loadingList, setLoadingList] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Single shared abort controller so the new call invalidates any
  // in-flight listing or detail fetch from the previous manual/kind.
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);

  // Load manuals list once so the user can pick a different source.
  useEffect(() => {
    const ctrl = new AbortController();
    api.get('/manuals', { signal: ctrl.signal }).then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setManuals(list.map((m: any) => ({ id: m.id ?? m.code ?? m.slug, name: m.name ?? m.title ?? m.id })));
    }).catch(() => setManuals([{ id: 'dnd5e-2014', name: 'D&D 5e (2014)' }]));
    return () => ctrl.abort();
  }, []);

  // Fetch top items for the chosen kind whenever manual/kind changes.
  const fetchItems = useCallback(async () => {
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    setLoadingList(true);
    setLoadError(null);
    try {
      const url = `/manuals/${encodeURIComponent(manualId)}/${kindToPath(activeKind)}`;
      const res = await api.get(url, { params: { page: 1, pageSize: 60, sortBy: 'name', sortDir: 'asc', lang }, signal: ctrl.signal });
      const raw = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setItems(raw.map((it: any) => ({ id: it.id, label: it.name ?? it.title ?? it.id })));
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError') return;
      setLoadError(e?.response?.data?.message ?? t('cards_sample_load_error', 'No se pudieron cargar muestras del manual.'));
      setItems([]);
    } finally {
      if (inflightRef.current === ctrl) setLoadingList(false);
    }
  }, [manualId, activeKind, lang, t]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const fetchAndApply = useCallback(async (id: string) => {
    if (!id) return;
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    setLoadingDetail(true);
    setLoadError(null);
    try {
      const url = `/manuals/${encodeURIComponent(manualId)}/${kindToPath(activeKind)}/${encodeURIComponent(id)}`;
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
  }, [manualId, activeKind, lang, onChange, t]);

  const applyBuiltin = useCallback((descriptor: typeof BUILTIN_SAMPLES[number]) => {
    const payload = entityNormalisers[descriptor.kind](descriptor.data);
    onChange(payload);
    // Intentionally NOT calling setActiveKind here — the dropdown would
    // jump under the user's cursor. The active sample is reflected in the
    // caption below; the manual picker stays as the user left it so they
    // can keep browsing the list without losing context.
    setSelectedId(null);
  }, [onChange]);

  const activeKindLabel = ({
    spell: t('cards_sample_kind_spell', 'Conjuro'),
    trait: t('cards_sample_kind_trait', 'Rasgo'),
    feat: t('cards_sample_kind_feat', 'Dote'),
    monster: t('cards_sample_kind_monster', 'Monstruo'),
    character: t('cards_sample_kind_character', 'Personaje'),
    'shop-item': t('cards_sample_kind_shop', 'Objeto'),
  } as const)[activeKind];

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('cards_sample_manual', 'Manual')}</InputLabel>
          <Select label={t('cards_sample_manual', 'Manual')} value={manualId} onChange={(e) => setManualId(e.target.value as string)}>
            {manuals.map((m) => <MenuItem key={m.id} value={m.id}>{m.name || m.id}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('cards_sample_kind', 'Tipo')}</InputLabel>
          <Select label={t('cards_sample_kind', 'Tipo')} value={activeKind} onChange={(e) => setActiveKind(e.target.value as CardEntityKind)}>
            <MenuItem value="spell">{t('cards_sample_kind_spell', 'Conjuro')}</MenuItem>
            <MenuItem value="trait">{t('cards_sample_kind_trait', 'Rasgo')}</MenuItem>
            <MenuItem value="feat">{t('cards_sample_kind_feat', 'Dote')}</MenuItem>
            <MenuItem value="monster">{t('cards_sample_kind_monster', 'Monstruo')}</MenuItem>
            <MenuItem value="character">{t('cards_sample_kind_character', 'Personaje')}</MenuItem>
          </Select>
        </FormControl>
        <Autocomplete
          size="small"
          sx={{ minWidth: 220, flex: 1 }}
          options={items}
          loading={loadingList || loadingDetail}
          getOptionLabel={(o) => o?.label ?? ''}
          value={items.find((i) => i.id === selectedId) ?? null}
          onChange={(_, v) => { setSelectedId(v?.id ?? null); if (v?.id) fetchAndApply(v.id); }}
          renderInput={(params) => <TextField {...params} label={t('cards_sample_entity', 'Muestra')} placeholder={activeKindLabel} />}
        />
        <Button size="small" onClick={fetchItems} startIcon={<RefreshIcon />}>{t('refresh', 'Refrescar')}</Button>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {BUILTIN_SAMPLES.map((s) => (
          <Button key={s.kind + s.label} size="small" variant="outlined" onClick={() => applyBuiltin(s)}>{s.label}</Button>
        ))}
      </Stack>
      {loadError && <Alert severity="warning">{loadError}</Alert>}
      <Typography variant="caption" color="text.secondary">
        {t('cards_sample_active', 'Muestra activa: ')}
        {value?.data?.name ? String(value.data.name) : t('none', 'Ninguna')}
      </Typography>
    </Stack>
  );
}
