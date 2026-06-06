import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/Map';
import PresentToAllIcon from '@mui/icons-material/PresentToAll';
import SkylineIcon from '@mui/icons-material/Layers';

import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import WorldpediaEntityViewer from '../Worldpedia/WorldpediaEntityViewer';

import { MapMarkerDto, MapItemDto, getMapImageUrlSized, listMaps, deleteMapMarker } from '../../api/maps';
import { listCharacters, CharacterPayload } from '../../api/characters';
import { getCampaignMonster, CampaignMonsterListItem } from '../../api/bestiary/bestiaryApi';
import { listEncounters, EncounterSummary } from '../../api/encounters';
import { getDiaryEntryById, DiaryEntryResponse } from '../../api/diary/diaryApi';
import { getNote, WorldpediaNoteFull } from '../../api/worldpedia/worldpediaApi';
import AuthImage from '../common/AuthImage';
import { useActiveMap } from './ActiveMapContext';

// ─── Stack navigation types ──────────────────────────────────────────────────

type NavItem =
  | { type: 'marker' }
  | { type: 'map'; id: string }
  | { type: 'character'; id: string }
  | { type: 'enemy'; id: string }
  | { type: 'encounter'; id: string }
  | { type: 'diary'; id: string }
  | { type: 'worldpedia'; id: string };

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  marker: MapMarkerDto;
  /** The map that owns this marker — needed to call deleteMapMarker. */
  mapId: string;
  campaignId: string;
  open: boolean;
  /** Invoked when the user clicks "Edit marker" — parent opens the edit dialog. */
  onEdit: () => void;
  onClose: () => void;
  /** Called after the marker has been deleted successfully. */
  onDelete?: (markerId: string) => void;
  /** All campaign maps — passed down so we don't re-fetch them each time. */
  allMaps?: MapItemDto[];
  allCharacters?: CharacterPayload[];
  allEnemies?: CampaignMonsterListItem[];
  allEncounters?: EncounterSummary[];
}

// ─── Helper: push to Skyline or Maps windows (DM-side action) ────────────────

function sendMapToPlayers(campaignId: string, mapId: string, setActiveMapId: (id: string) => void) {
  setActiveMapId(mapId);
}

function openSkylineWindow(campaignId: string) {
  if ((window as any).electronAPI?.openSkylineProjection) {
    (window as any).electronAPI.openSkylineProjection(campaignId).catch(() => {});
  } else {
    const url = `${window.location.origin}/#/projection/skyline?campaignId=${encodeURIComponent(campaignId)}`;
    window.open(url, 'projection_skyline', 'noopener,noreferrer');
  }
}

function openMapsWindow(campaignId: string) {
  if ((window as any).electronAPI?.openMapsProjection) {
    (window as any).electronAPI.openMapsProjection(campaignId).catch(() => {});
  } else {
    const url = `${window.location.origin}/#/projection/maps?campaignId=${encodeURIComponent(campaignId)}`;
    window.open(url, 'projection_maps', 'noopener,noreferrer');
  }
}

// ─── Subview: Map ─────────────────────────────────────────────────────────────

function MapSubview({ mapId, campaignId }: { mapId: string; campaignId: string }) {
  const { setActiveMapId } = useActiveMap();
  const [map, setMap] = useState<MapItemDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listMaps({ campaignId }).then((all) => {
      if (alive) { setMap(all.find((m) => m.id === mapId) ?? null); setLoading(false); }
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mapId, campaignId]);

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;
  if (!map) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Mapa no encontrado</Typography>;

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box sx={{ borderRadius: 1, overflow: 'hidden', height: 160, bgcolor: 'action.hover' }}>
        {map.imageAvailable ? (
          <AuthImage src={getMapImageUrlSized(map.id, 'preview')} alt={map.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <MapIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
          </Box>
        )}
      </Box>
      <Typography variant="h6">{map.name}</Typography>
      {map.description && <Typography variant="body2" color="text.secondary">{map.description}</Typography>}
      {Array.isArray(map.group) && map.group.map((g: string) => <Chip key={g} label={g} size="small" />)}
      <Divider />
      <Stack spacing={1}>
        <Button
          variant="contained"
          startIcon={<PresentToAllIcon />}
          onClick={() => { sendMapToPlayers(campaignId, map.id, setActiveMapId); openMapsWindow(campaignId); }}
          fullWidth
        >
          Enviar a ventana de jugadores
        </Button>
        <Button
          variant="outlined"
          startIcon={<SkylineIcon />}
          onClick={() => openSkylineWindow(campaignId)}
          fullWidth
        >
          Abrir ventana Skyline
        </Button>
      </Stack>
    </Stack>
  );
}

// ─── Subview: Enemy ───────────────────────────────────────────────────────────

function EnemySubview({ enemyId, campaignId }: { enemyId: string; campaignId: string }) {
  const [enemy, setEnemy] = useState<CampaignMonsterListItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getCampaignMonster(campaignId, enemyId, 'en').then((item) => {
      if (alive) { setEnemy(item); setLoading(false); }
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enemyId, campaignId]);

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;
  if (!enemy) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Enemigo no encontrado</Typography>;

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        {enemy.tokenImageUrl ? (
          <AuthImage src={enemy.tokenImageUrl} alt={enemy.name} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
        ) : (
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'error.main' }}>{enemy.name.slice(0, 2).toUpperCase()}</Avatar>
        )}
        <Box>
          <Typography variant="h6">{enemy.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[enemy.type, enemy.size, enemy.challengeRating ? `FP ${enemy.challengeRating}` : null].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Stack>
      <Divider />
      <Button
        variant="outlined"
        startIcon={<SkylineIcon />}
        onClick={() => openSkylineWindow(campaignId)}
        fullWidth
      >
        Abrir ventana Skyline
      </Button>
    </Stack>
  );
}

// ─── Subview: Encounter ───────────────────────────────────────────────────────

function EncounterSubview({ encounterId, campaignId }: { encounterId: string; campaignId: string }) {
  const [enc, setEnc] = useState<EncounterSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listEncounters(campaignId).then((all) => {
      if (alive) { setEnc(all.find((e) => e.id === encounterId) ?? null); setLoading(false); }
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [encounterId, campaignId]);

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;
  if (!enc) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Encuentro no encontrado</Typography>;

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Typography variant="h6">{enc.name}</Typography>
      <Chip label={enc.difficulty} size="small" color="warning" />
      {enc.participants.length > 0 && (
        <>
          <Typography variant="subtitle2">Participantes ({enc.participants.length})</Typography>
          {enc.participants.map((p) => (
            <Typography key={p.id} variant="body2" sx={{ pl: 1 }}>
              {p.kind === 'character' ? '🧑' : '👹'} {p.name}
              {p.cr !== undefined ? ` (FP ${p.cr})` : ''}
            </Typography>
          ))}
        </>
      )}
    </Stack>
  );
}

// ─── Subview: Diary session ───────────────────────────────────────────────────

/**
 * DiarySubview
 *
 * Shows a calendar diary entry (year/month/day + annotated items).
 * Fetches the entry by its UUID directly from the backend.
 */
function DiarySubview({ entryId, campaignId }: { entryId: string; campaignId: string }) {
  const [entry, setEntry] = useState<DiaryEntryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getDiaryEntryById(campaignId, entryId)
      .then((e) => { if (alive) { setEntry(e); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [entryId, campaignId]);

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;
  if (!entry) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Entrada no encontrada</Typography>;

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Typography variant="h6">
        Año {entry.year} / Mes {entry.monthIndex + 1} / Día {entry.dayIndex + 1}
      </Typography>
      {entry.items.length === 0 && (
        <Typography variant="body2" color="text.secondary">Sin anotaciones en este día.</Typography>
      )}
      {entry.items.map((item, i) => (
        <Box key={item.id ?? i}>
          {item.title && <Typography variant="subtitle2">{item.title}</Typography>}
          {item.html && (
            <Box
              sx={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'text.secondary', '& p': { m: 0 } }}
              dangerouslySetInnerHTML={{ __html: item.html }}
            />
          )}
        </Box>
      ))}
    </Stack>
  );
}

// ─── Subview: Worldpedia note ─────────────────────────────────────────────────

function WorldpediaSubview({ noteId, campaignId }: { noteId: string; campaignId: string }) {
  const [note, setNote] = useState<WorldpediaNoteFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getNote(campaignId, noteId).then((n) => {
      if (alive) { setNote(n); setLoading(false); }
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [noteId, campaignId]);

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;
  if (!note) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nota no encontrada</Typography>;

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Typography variant="h6">{note.title}</Typography>
      {note.html ? (
        <Box
          sx={{ fontSize: '0.875rem', lineHeight: 1.6, '& p': { m: 0 } }}
          dangerouslySetInnerHTML={{ __html: note.html }}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">Sin contenido</Typography>
      )}
    </Stack>
  );
}

// ─── Marker root view ─────────────────────────────────────────────────────────

interface MarkerViewProps {
  marker: MapMarkerDto;
  campaignId: string;
  allMaps?: MapItemDto[];
  allCharacters?: CharacterPayload[];
  allEnemies?: CampaignMonsterListItem[];
  allEncounters?: EncounterSummary[];
  onNavigate: (item: NavItem) => void;
  /** Called when the user clicks a character — opens the entity viewer directly. */
  onOpenCharacterSheet: (charId: string) => void;
  /** Called when the user clicks an enemy — opens the entity viewer directly. */
  onOpenEnemySheet: (enemyId: string) => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
}

function MarkerRootView({ marker, campaignId, allMaps, allCharacters, allEnemies, allEncounters, onNavigate, onOpenCharacterSheet, onOpenEnemySheet, onEdit, onDeleteRequest }: MarkerViewProps) {
  const assoc = marker.associated ?? {};

  const mapItems = allMaps?.filter((m) => assoc.mapIds?.includes(m.id)) ?? [];
  const charItems = allCharacters?.filter((c) => assoc.characterIds?.includes(c.id!)) ?? [];
  const enemyItems = allEnemies?.filter((e) => assoc.enemyIds?.includes(e.id)) ?? [];
  const encounterItems = allEncounters?.filter((e) => assoc.encounterIds?.includes(e.id)) ?? [];

  const totalAssociated =
    (assoc.mapIds?.length ?? 0) +
    (assoc.characterIds?.length ?? 0) +
    (assoc.enemyIds?.length ?? 0) +
    (assoc.encounterIds?.length ?? 0) +
    (assoc.diaryEntryIds?.length ?? 0) +
    (assoc.worldpediaIds?.length ?? 0);

  return (
    <Stack sx={{ height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h2" sx={{ lineHeight: 1 }}>{marker.icon}</Typography>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{marker.name}</Typography>
          </Box>
          <Tooltip title="Editar marcador">
            <IconButton onClick={onEdit} size="small"><EditIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Eliminar marcador">
            <IconButton onClick={onDeleteRequest} size="small" color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        {marker.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {marker.notes}
          </Typography>
        )}
        <Chip
          icon={marker.visibleToPlayers ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
          label={marker.visibleToPlayers ? 'Visible para jugadores' : 'Oculto para jugadores'}
          size="small"
          variant="outlined"
          color={marker.visibleToPlayers ? 'success' : 'default'}
          sx={{ mt: 1, alignSelf: 'flex-start' }}
        />
      </Box>

      {totalAssociated > 0 && (
        <>
          <Divider />
          <List dense disablePadding>
            {/* Maps */}
            {mapItems.map((m) => (
              <ListItemButton key={m.id} onClick={() => onNavigate({ type: 'map', id: m.id })}>
                {m.imageAvailable ? (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      mr: 1.5,
                      borderRadius: 1,
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <AuthImage
                      src={getMapImageUrlSized(m.id, 'thumb')}
                      alt={m.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                ) : (
                  <MapIcon fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                )}
                <ListItemText primary={m.name} secondary="Mapa" />
              </ListItemButton>
            ))}
            {/* Characters — open entity viewer directly (worldpedia-style) */}
            {charItems.map((c) => {
              const imgUrl = c.characterImageUrl ?? c.tokenImageUrl;
              return (
                <ListItemButton key={c.id} onClick={() => onOpenCharacterSheet(c.id!)}>
                  {imgUrl ? (
                    <Box sx={{ width: 32, height: 32, mr: 1.5, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                      <AuthImage
                        src={imgUrl}
                        alt={c.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  ) : (
                    <Avatar sx={{ width: 32, height: 32, mr: 1.5, fontSize: '0.75rem' }}>
                      {c.name.slice(0, 2).toUpperCase()}
                    </Avatar>
                  )}
                  <ListItemText primary={c.name} secondary={c.kind === 'pc' ? 'Jugador' : 'NPC'} />
                </ListItemButton>
              );
            })}
            {/* Enemies */}
            {enemyItems.map((e) => (
              <ListItemButton key={e.id} onClick={() => onOpenEnemySheet(e.id)}>
                {e.tokenImageUrl ? (
                  <Box sx={{ width: 32, height: 32, mr: 1.5, borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
                    <AuthImage
                      src={e.tokenImageUrl}
                      alt={e.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                ) : (
                  <Avatar
                    variant="rounded"
                    sx={{ width: 32, height: 32, mr: 1.5, fontSize: '0.75rem', bgcolor: 'error.main' }}
                  >
                    {e.name.slice(0, 2).toUpperCase()}
                  </Avatar>
                )}
                <ListItemText
                  primary={e.name}
                  secondary={[e.type, e.size, e.challengeRating ? `FP ${e.challengeRating}` : null].filter(Boolean).join(' · ') || undefined}
                />
              </ListItemButton>
            ))}
            {/* Encounters */}
            {encounterItems.map((e) => (
              <ListItemButton key={e.id} onClick={() => onNavigate({ type: 'encounter', id: e.id })}>
                <Typography sx={{ mr: 1.5 }}>⚔️</Typography>
                <ListItemText primary={e.name} secondary={`Encuentro · ${e.difficulty}`} />
              </ListItemButton>
            ))}
            {/* Diary entries (IDs only — detail fetched in subview) */}
            {(assoc.diaryEntryIds ?? []).map((id) => (
              <ListItemButton key={id} onClick={() => onNavigate({ type: 'diary', id })}>
                <Typography sx={{ mr: 1.5 }}>📅</Typography>
                <ListItemText primary="Entrada de diario" secondary={id.slice(0, 8)} />
              </ListItemButton>
            ))}
            {/* Worldpedia notes (IDs only — names fetched in subview) */}
            {(assoc.worldpediaIds ?? []).map((id) => (
              <ListItemButton key={id} onClick={() => onNavigate({ type: 'worldpedia', id })}>
                <Typography sx={{ mr: 1.5 }}>📚</Typography>
                <ListItemText primary="Nota de Worldpedia" secondary={id.slice(0, 8)} />
              </ListItemButton>
            ))}
          </List>
        </>
      )}

      {totalAssociated === 0 && (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">Sin entidades asociadas. Edita el marcador para añadir mapas, personajes, etc.</Typography>
        </Box>
      )}
    </Stack>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * MapMarkerDetail
 *
 * Centered modal dialog that shows full marker information with
 * drill-down navigation into associated entities. Supports:
 * - Back/breadcrumb navigation
 * - Map subview with "Send to player window" + "Open Skyline"
 * - Character subview with "Open Skyline"
 * - Enemy subview with "Open Skyline"
 * - Encounter, diary session, and worldpedia subviews
 */
export default function MapMarkerDetail({
  marker,
  mapId,
  campaignId,
  open,
  onEdit,
  onClose,
  onDelete,
  allMaps,
  allCharacters,
  allEnemies,
  allEncounters,
}: Props) {
  const [stack, setStack] = useState<NavItem[]>([{ type: 'marker' }]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sheetCharId, setSheetCharId] = useState<string | null>(null);
  const [sheetEnemyId, setSheetEnemyId] = useState<string | null>(null);

  /** Reset stack when the marker changes. */
  useEffect(() => {
    setStack([{ type: 'marker' }]);
  }, [marker.id]);

  /**
   * Performs the actual deletion after the user confirms.
   * Calls the API, notifies the parent and closes the drawer.
   */
  const handleConfirmDelete = async () => {
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

  const current = stack[stack.length - 1];
  const canGoBack = stack.length > 1;

  const navigate = (item: NavItem) => setStack((s) => [...s, item]);
  const goBack = () => setStack((s) => s.slice(0, -1));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: 1400 }}
      PaperProps={{ sx: { height: '75vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
      >
        {canGoBack ? (
          <IconButton onClick={goBack} size="small"><ArrowBackIcon /></IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
        <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>
          {current.type === 'marker' ? marker.name
            : current.type === 'map' ? 'Mapa'
            : current.type === 'character' ? 'Personaje'
            : current.type === 'enemy' ? 'Enemigo'
            : current.type === 'encounter' ? 'Encuentro'
            : current.type === 'diary' ? 'Entrada de diario'
            : 'Worldpedia'}
        </Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Stack>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {current.type === 'marker' && (
          <MarkerRootView
            marker={marker}
            campaignId={campaignId}
            allMaps={allMaps}
            allCharacters={allCharacters}
            allEnemies={allEnemies}
            allEncounters={allEncounters}
            onNavigate={navigate}
            onEdit={onEdit}
            onDeleteRequest={() => setConfirmDeleteOpen(true)}
            onOpenCharacterSheet={(charId) => setSheetCharId(charId)}
            onOpenEnemySheet={(enemyId) => setSheetEnemyId(enemyId)}
          />
        )}
        {current.type === 'map' && (
          <MapSubview mapId={current.id} campaignId={campaignId} />
        )}
        {current.type === 'encounter' && (
          <EncounterSubview encounterId={current.id} campaignId={campaignId} />
        )}
        {current.type === 'diary' && (
          <DiarySubview entryId={current.id} campaignId={campaignId} />
        )}
        {current.type === 'worldpedia' && (
          <WorldpediaSubview noteId={current.id} campaignId={campaignId} />
        )}
      </Box>

      {/* ─── Delete confirmation dialog ─────────────────────────────────── */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => !deleting && setConfirmDeleteOpen(false)}
        sx={{ zIndex: 1501 }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>¿Eliminar marcador?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres eliminar el marcador <strong>{marker.name}</strong>? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Character sheet viewer (Worldpedia-style) ────────────────── */}
      <WorldpediaEntityViewer
        open={!!sheetCharId}
        entityType="character"
        entityId={sheetCharId ?? ''}
        campaignId={campaignId}
        onClose={() => setSheetCharId(null)}
        dialogSx={{ zIndex: 1500 }}
      />
      {/* ─── Enemy stat block viewer (Worldpedia-style) ──────────────────── */}
      <WorldpediaEntityViewer
        open={!!sheetEnemyId}
        entityType="monster"
        entityId={sheetEnemyId ?? ''}
        campaignId={campaignId}
        onClose={() => setSheetEnemyId(null)}
        dialogSx={{ zIndex: 1500 }}
      />    </Dialog>
  );
}
