import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { MapMarkerDto, MarkerAssociated, listMaps, MapItemDto, createMapMarker, updateMapMarker, deleteMapMarker, getMapImageUrlSized } from '../../api/maps';
import { listCharacters, CharacterPayload } from '../../api/characters';
import { listCampaignMonsters, CampaignMonsterListItem } from '../../api/bestiary/bestiaryApi';
import { listEncounters, EncounterSummary } from '../../api/encounters';
import { listAllDiaryEntries, DiaryEntrySummary } from '../../api/diary/diaryApi';
import { getWorldpediaTree, WorldpediaTree, WorldpediaNoteLight } from '../../api/worldpedia/worldpediaApi';
import AuthImage from '../common/AuthImage';

/** Preset icon emojis shown as quick-pick chips below the icon field. */
const ICON_PRESETS = [
  '📍', '🏰', '🌲', '🏔️', '⚔️', '💀', '✨', '🏠', '🗺️',
  '🔮', '👁️', '⚠️', '🎭', '🐉', '💎', '🔑', '🗡️', '🛡️',
  '🌊', '🗿', '🏛️', '🔔', '❓', '❗', '🎯', '🌋', '🏕️', '🐺',
];

interface Props {
  /** If provided, the dialog is in "edit" mode and pre-populates from this marker. */
  marker?: MapMarkerDto | null;
  /** Pre-filled x/y for "create at click position" flows. Ignored in edit mode. */
  initialX?: number;
  initialY?: number;
  campaignId: string;
  mapId: string;
  onClose: () => void;
  /**
   * Called after a successful create or update.
   * Receives the full updated/created marker.
   */
  onSaved: (marker: MapMarkerDto) => void;
  /** Called when the user requests to delete the marker (edit mode only). */
  onDelete?: (markerId: string) => void;
}

// ─── AuthThumb ───────────────────────────────────────────────────────────────

/**
 * AuthThumb
 *
 * Renders a 28×28 authenticated thumbnail using AuthImage.
 * Falls back to a neutral Box with the first letter of `fallback`.
 */
function AuthThumb({ src, fallback }: { src: string; fallback: string }) {
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: 0.75,
        overflow: 'hidden',
        flexShrink: 0,
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AuthImage
        src={src}
        alt={fallback}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onErrorIcon={
          <Typography variant="caption" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>
            {fallback.slice(0, 1).toUpperCase()}
          </Typography>
        }
      />
    </Box>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Toggles `id` in/out of the provided string array. Returns a new array. */
function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// ─── Stable per-type extractor helpers (module-level, never recreated) ────────
// Defining these outside the component ensures their references are stable,
// which allows React.memo on AssocSection to bail out on re-renders caused
// solely by parent text-field state changes (name / notes).

const getMapId    = (m: MapItemDto) => m.id;
const getMapLabel = (m: MapItemDto) => m.name;
const getMapImageUrl = (m: MapItemDto): string | null =>
  m.imageAvailable ? getMapImageUrlSized(m.id, 'thumb') : null;

const getCharId       = (c: CharacterPayload) => c.id!;
const getCharLabel    = (c: CharacterPayload) => c.name;
const getCharImageUrl = (c: CharacterPayload): string | null =>
  c.characterImageUrl ?? c.tokenImageUrl ?? null;

const getEnemyId       = (e: CampaignMonsterListItem) => e.id;
const getEnemyLabel    = (e: CampaignMonsterListItem) => e.name;
const getEnemySubLabel = (e: CampaignMonsterListItem): string | null =>
  [e.type, e.size, e.challengeRating ? `FP ${e.challengeRating}` : null]
    .filter(Boolean).join(' · ') || null;
const getEnemyImageUrl = (e: CampaignMonsterListItem): string | null =>
  e.tokenImageUrl ?? null;

const getEncounterId    = (e: EncounterSummary) => e.id;
const getEncounterLabel = (e: EncounterSummary) => e.name;

const getDiaryId       = (d: DiaryEntrySummary) => d.id;
const getDiaryLabel    = (d: DiaryEntrySummary) =>
  `Año ${d.year} / Mes ${d.monthIndex + 1} / Día ${d.dayIndex}`;
const getDiarySubLabel = (d: DiaryEntrySummary): string | null =>
  d.firstTitle ?? (d.itemCount > 0 ? `${d.itemCount} nota${d.itemCount !== 1 ? 's' : ''}` : null);

const getWpNoteId    = (n: WorldpediaNoteLight) => n.id;
const getWpNoteLabel = (n: WorldpediaNoteLight) => n.title;

// ─── Association picker sub-component ───────────────────────────────────────

interface AssocSectionProps<T> {
  label: string;
  loading: boolean;
  items: T[];
  selected: string[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  /** Optional secondary text shown below the label. */
  getSubLabel?: (item: T) => string | null | undefined;
  /** Optional: returns an authenticated API URL for a thumbnail. */
  getImageUrl?: (item: T) => string | null | undefined;
  onToggle: (id: string) => void;
}

function AssocSection<T>({
  label, loading, items, selected, getId, getLabel, getSubLabel, getImageUrl, onToggle,
}: AssocSectionProps<T>) {
  const [search, setSearch] = useState('');

  // Memoised so 300+ item lists are not re-filtered on every parent render.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((item) => getLabel(item).toLowerCase().includes(q)) : items;
  }, [items, search, getLabel]);

  if (!loading && items.length === 0) return null;

  return (
    <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {label}
          {selected.length > 0 && (
            <Chip label={selected.length} size="small" color="primary" sx={{ ml: 1 }} />
          )}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 1 }}>
        {/* Search bar */}
        <TextField
          size="small"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{ mb: 1, mt: 0.5 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          onKeyDown={(e) => e.stopPropagation()} // prevent accordion from capturing keys
          onClick={(e) => e.stopPropagation()}
        />

        {/* Item list */}
        <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
          {loading ? (
            <Stack spacing={0.5}>
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="text" />)}
            </Stack>
          ) : filtered.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
              Sin resultados
            </Typography>
          ) : (
            filtered.map((item) => {
              const id = getId(item);
              const imgUrl = getImageUrl?.(item);
              const subLabel = getSubLabel?.(item);
              return (
                <FormControlLabel
                  key={id}
                  control={
                    <Checkbox
                      size="small"
                      checked={selected.includes(id)}
                      onChange={() => onToggle(id)}
                    />
                  }
                  label={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {imgUrl ? (
                        <AuthThumb src={imgUrl} fallback={getLabel(item)} />
                      ) : null}
                      <Box>
                        <Typography variant="body2" sx={{ lineHeight: 1.2 }}>{getLabel(item)}</Typography>
                        {subLabel && (
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                            {subLabel}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  }
                  sx={{ display: 'flex', m: 0, py: 0.35, alignItems: 'center' }}
                />
              );
            })
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * MapMarkerDialog
 *
 * Modal dialog for creating or editing a world-map marker.
 * Handles name, icon (emoji preset chips + free input), notes,
 * and association picking for maps, characters, enemies, encounters,
 * diary sessions, and worldpedia notes.
 */
export default function MapMarkerDialog({
  marker,
  initialX = 50,
  initialY = 50,
  campaignId,
  mapId,
  onClose,
  onSaved,
  onDelete,
}: Props) {
  const isEdit = !!marker;

  // ─── Form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState(marker?.name ?? '');
  const [icon, setIcon] = useState(marker?.icon ?? '📍');
  const [notes, setNotes] = useState(marker?.notes ?? '');
  const [visibleToPlayers, setVisibleToPlayers] = useState(marker?.visibleToPlayers ?? false);
  const [associated, setAssociated] = useState<MarkerAssociated>(marker?.associated ?? {});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // If opened in create mode with a position, x/y are set at submit time (passed as prop).
  const x = marker?.x ?? initialX;
  const y = marker?.y ?? initialY;

  // ─── Association lists ───────────────────────────────────────────────────
  const [maps, setMaps] = useState<MapItemDto[]>([]);
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [enemies, setEnemies] = useState<CampaignMonsterListItem[]>([]);
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntrySummary[]>([]);
  const [wpTree, setWpTree] = useState<WorldpediaTree | null>(null);
  const [listsLoading, setListsLoading] = useState(true);

  const wpNotes = useMemo(() => {
    if (!wpTree) return [];
    const rootNotes = wpTree.rootNotes ?? [];
    const folderNotes = (wpTree.folders ?? []).flatMap((f) => f.notes ?? []);
    return [...rootNotes, ...folderNotes];
  }, [wpTree]);

  useEffect(() => {
    let alive = true;
    setListsLoading(true);
    Promise.allSettled([
      listMaps({ campaignId }),
      listCharacters(campaignId),
      listCampaignMonsters(campaignId, { pageSize: 9999 }),
      listEncounters(campaignId),
      listAllDiaryEntries(campaignId),
      getWorldpediaTree(campaignId),
    ]).then(([mRes, cRes, eRes, enRes, dRes, wRes]) => {
      if (!alive) return;
      if (mRes.status === 'fulfilled') setMaps(mRes.value);
      if (cRes.status === 'fulfilled') setCharacters(cRes.value as CharacterPayload[]);
      if (eRes.status === 'fulfilled') setEnemies((eRes.value as any).items ?? []);
      if (enRes.status === 'fulfilled') setEncounters(enRes.value);
      if (dRes.status === 'fulfilled') setDiaryEntries(dRes.value);
      if (wRes.status === 'fulfilled') setWpTree(wRes.value);
      setListsLoading(false);
    });
    return () => { alive = false; };
  }, [campaignId]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  // Stable reference — does not depend on any component state, uses functional
  // setState so it is safe to memoize with an empty dependency array.
  const toggle = useCallback((key: keyof MarkerAssociated, id: string) =>
    setAssociated((prev) => ({
      ...prev,
      [key]: toggleId((prev[key] as string[] | undefined) ?? [], id),
    })), []);

  // Per-section stable handlers (required for React.memo on AssocSection to work).
  const toggleMaps       = useCallback((id: string) => toggle('mapIds', id), [toggle]);
  const toggleCharacters = useCallback((id: string) => toggle('characterIds', id), [toggle]);
  const toggleEnemies    = useCallback((id: string) => toggle('enemyIds', id), [toggle]);
  const toggleEncounters = useCallback((id: string) => toggle('encounterIds', id), [toggle]);
  const toggleDiary      = useCallback((id: string) => toggle('diaryEntryIds', id), [toggle]);
  const toggleWorldpedia = useCallback((id: string) => toggle('worldpediaIds', id), [toggle]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), icon, notes: notes || undefined, x, y, campaignId, visibleToPlayers, associated };
      const saved = isEdit
        ? await updateMapMarker(mapId, marker!.id, { name: payload.name, icon, notes: notes || null, visibleToPlayers, associated })
        : await createMapMarker(mapId, payload);
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!marker) return;
    setDeleting(true);
    try {
      await deleteMapMarker(mapId, marker.id);
      onDelete?.(marker.id);
      onClose();
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar marcador' : 'Nuevo marcador'}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Name */}
          <TextField
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />

          {/* Icon */}
          <Box>
            <TextField
              label="Icono (emoji)"
              value={icon}
              onChange={(e) => setIcon(e.target.value.slice(0, 4))}
              inputProps={{ maxLength: 4 }}
              sx={{ mb: 1, width: 120 }}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {ICON_PRESETS.map((emoji) => (
                <Chip
                  key={emoji}
                  label={emoji}
                  size="small"
                  onClick={() => setIcon(emoji)}
                  variant={icon === emoji ? 'filled' : 'outlined'}
                  color={icon === emoji ? 'primary' : 'default'}
                  sx={{ fontSize: '1rem', cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {/* Notes */}
          <TextField
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
          />
          {/* Visible to players */}
          <FormControlLabel
            control={<Switch checked={visibleToPlayers} onChange={(_, v) => setVisibleToPlayers(v)} />}
            label="Visible para jugadores"
          />
          {/* ─── Associations ──────────────────────────────────────────────── */}
          <Typography variant="subtitle2" sx={{ mt: 1 }}>Asociaciones</Typography>

          <AssocSection
            label="Mapas"
            loading={listsLoading}
            items={maps}
            selected={associated.mapIds ?? []}
            getId={getMapId}
            getLabel={getMapLabel}
            getImageUrl={getMapImageUrl}
            onToggle={toggleMaps}
          />

          <AssocSection
            label="Personajes"
            loading={listsLoading}
            items={characters}
            selected={associated.characterIds ?? []}
            getId={getCharId}
            getLabel={getCharLabel}
            getImageUrl={getCharImageUrl}
            onToggle={toggleCharacters}
          />

          <AssocSection
            label="Enemigos"
            loading={listsLoading}
            items={enemies}
            selected={associated.enemyIds ?? []}
            getId={getEnemyId}
            getLabel={getEnemyLabel}
            getSubLabel={getEnemySubLabel}
            getImageUrl={getEnemyImageUrl}
            onToggle={toggleEnemies}
          />

          <AssocSection
            label="Encuentros"
            loading={listsLoading}
            items={encounters}
            selected={associated.encounterIds ?? []}
            getId={getEncounterId}
            getLabel={getEncounterLabel}
            onToggle={toggleEncounters}
          />

          <AssocSection
            label="Entradas de diario"
            loading={listsLoading}
            items={diaryEntries}
            selected={associated.diaryEntryIds ?? []}
            getId={getDiaryId}
            getLabel={getDiaryLabel}
            getSubLabel={getDiarySubLabel}
            onToggle={toggleDiary}
          />

          <AssocSection
            label="Worldpedia"
            loading={listsLoading}
            items={wpNotes}
            selected={associated.worldpediaIds ?? []}
            getId={getWpNoteId}
            getLabel={getWpNoteLabel}
            onToggle={toggleWorldpedia}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        {isEdit && onDelete && (
          <Button
            color="error"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={saving || deleting}
            sx={{ mr: 'auto' }}
          >
            Eliminar
          </Button>
        )}
        <Button onClick={onClose} disabled={saving || deleting}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || deleting || !name.trim()}
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>

      {/* ─── Delete confirmation ────────────────────────────────────── */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => !deleting && setConfirmDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>¿Eliminar marcador?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres eliminar <strong>{marker?.name}</strong>? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
