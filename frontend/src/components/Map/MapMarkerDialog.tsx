import { useEffect, useMemo, useState } from 'react';
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
  DialogTitle,
  FormControlLabel,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { MapMarkerDto, MarkerAssociated, listMaps, MapItemDto, createMapMarker, updateMapMarker, deleteMapMarker } from '../../api/maps';
import { listCharacters, CharacterPayload } from '../../api/characters';
import { listCampaignMonsters, CampaignMonsterListItem } from '../../api/bestiary/bestiaryApi';
import { listEncounters, EncounterSummary } from '../../api/encounters';
import { listDiarySessions, DiarySessionResponse } from '../../api/diary/diaryApi';
import { getWorldpediaTree, WorldpediaTree } from '../../api/worldpedia/worldpediaApi';

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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Toggles `id` in/out of the provided string array. Returns a new array. */
function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// ─── Association picker sub-component ───────────────────────────────────────

interface AssocSectionProps<T> {
  label: string;
  loading: boolean;
  items: T[];
  selected: string[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  onToggle: (id: string) => void;
}

function AssocSection<T>({ label, loading, items, selected, getId, getLabel, onToggle }: AssocSectionProps<T>) {
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
      <AccordionDetails sx={{ maxHeight: 200, overflowY: 'auto', pt: 0 }}>
        {loading ? (
          <Stack spacing={0.5}>
            {[0, 1, 2].map((i) => <Skeleton key={i} variant="text" />)}
          </Stack>
        ) : (
          items.map((item) => {
            const id = getId(item);
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
                label={<Typography variant="body2">{getLabel(item)}</Typography>}
                sx={{ display: 'flex', m: 0 }}
              />
            );
          })
        )}
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
  const [associated, setAssociated] = useState<MarkerAssociated>(marker?.associated ?? {});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // If opened in create mode with a position, x/y are set at submit time (passed as prop).
  const x = marker?.x ?? initialX;
  const y = marker?.y ?? initialY;

  // ─── Association lists ───────────────────────────────────────────────────
  const [maps, setMaps] = useState<MapItemDto[]>([]);
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [enemies, setEnemies] = useState<CampaignMonsterListItem[]>([]);
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [diarySessions, setDiarySessions] = useState<DiarySessionResponse[]>([]);
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
      listCampaignMonsters(campaignId),
      listEncounters(campaignId),
      listDiarySessions(campaignId),
      getWorldpediaTree(campaignId),
    ]).then(([mRes, cRes, eRes, enRes, dRes, wRes]) => {
      if (!alive) return;
      if (mRes.status === 'fulfilled') setMaps(mRes.value);
      if (cRes.status === 'fulfilled') setCharacters(cRes.value as CharacterPayload[]);
      if (eRes.status === 'fulfilled') setEnemies((eRes.value as any).items ?? []);
      if (enRes.status === 'fulfilled') setEncounters(enRes.value);
      if (dRes.status === 'fulfilled') setDiarySessions(dRes.value);
      if (wRes.status === 'fulfilled') setWpTree(wRes.value);
      setListsLoading(false);
    });
    return () => { alive = false; };
  }, [campaignId]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const toggle = (key: keyof MarkerAssociated, id: string) =>
    setAssociated((prev) => ({
      ...prev,
      [key]: toggleId(prev[key] ?? [], id),
    }));

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), icon, notes: notes || undefined, x, y, campaignId, associated };
      const saved = isEdit
        ? await updateMapMarker(mapId, marker!.id, { name: payload.name, icon, notes: notes || null, associated })
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

          {/* ─── Associations ──────────────────────────────────────────────── */}
          <Typography variant="subtitle2" sx={{ mt: 1 }}>Asociaciones</Typography>

          <AssocSection
            label="Mapas"
            loading={listsLoading}
            items={maps}
            selected={associated.mapIds ?? []}
            getId={(m) => m.id}
            getLabel={(m) => m.name}
            onToggle={(id) => toggle('mapIds', id)}
          />

          <AssocSection
            label="Personajes"
            loading={listsLoading}
            items={characters}
            selected={associated.characterIds ?? []}
            getId={(c) => c.id!}
            getLabel={(c) => c.name}
            onToggle={(id) => toggle('characterIds', id)}
          />

          <AssocSection
            label="Enemigos"
            loading={listsLoading}
            items={enemies}
            selected={associated.enemyIds ?? []}
            getId={(e) => e.id}
            getLabel={(e) => e.name}
            onToggle={(id) => toggle('enemyIds', id)}
          />

          <AssocSection
            label="Encuentros"
            loading={listsLoading}
            items={encounters}
            selected={associated.encounterIds ?? []}
            getId={(e) => e.id}
            getLabel={(e) => e.name}
            onToggle={(id) => toggle('encounterIds', id)}
          />

          <AssocSection
            label="Sesiones de diario"
            loading={listsLoading}
            items={diarySessions}
            selected={associated.diarySessionIds ?? []}
            getId={(d) => d.id}
            getLabel={(d) => d.title ?? `Sesión ${d.id.slice(0, 6)}`}
            onToggle={(id) => toggle('diarySessionIds', id)}
          />

          <AssocSection
            label="Worldpedia"
            loading={listsLoading}
            items={wpNotes}
            selected={associated.worldpediaIds ?? []}
            getId={(n) => n.id}
            getLabel={(n) => n.title}
            onToggle={(id) => toggle('worldpediaIds', id)}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        {isEdit && onDelete && (
          <Button
            color="error"
            onClick={handleDelete}
            disabled={saving || deleting}
            sx={{ mr: 'auto' }}
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
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
    </Dialog>
  );
}
