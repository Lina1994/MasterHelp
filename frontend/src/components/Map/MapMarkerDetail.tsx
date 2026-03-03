import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
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
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/Map';
import PersonIcon from '@mui/icons-material/Person';
import PresentToAllIcon from '@mui/icons-material/PresentToAll';
import SkylineIcon from '@mui/icons-material/Layers';

import { MapMarkerDto, MapItemDto, getMapImageUrlSized, listMaps } from '../../api/maps';
import { listCharacters, CharacterPayload } from '../../api/characters';
import { listCampaignMonsters, CampaignMonsterListItem } from '../../api/bestiary/bestiaryApi';
import { listEncounters, EncounterSummary } from '../../api/encounters';
import { listDiarySessions, DiarySessionResponse } from '../../api/diary/diaryApi';
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
  campaignId: string;
  open: boolean;
  /** Invoked when the user clicks "Edit marker" — parent opens the edit dialog. */
  onEdit: () => void;
  onClose: () => void;
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
    const url = `${window.location.origin}/projection/skyline?campaignId=${encodeURIComponent(campaignId)}`;
    window.open(url, 'projection_skyline', 'noopener,noreferrer');
  }
}

function openMapsWindow(campaignId: string) {
  if ((window as any).electronAPI?.openMapsProjection) {
    (window as any).electronAPI.openMapsProjection(campaignId).catch(() => {});
  } else {
    const url = `${window.location.origin}/projection/maps?campaignId=${encodeURIComponent(campaignId)}`;
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
      {map.group && <Chip label={map.group} size="small" />}
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

// ─── Subview: Character ───────────────────────────────────────────────────────

function CharacterSubview({ charId, campaignId }: { charId: string; campaignId: string }) {
  const [char, setChar] = useState<CharacterPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listCharacters(campaignId).then((all) => {
      if (alive) { setChar(all.find((c) => c.id === charId) ?? null); setLoading(false); }
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [charId, campaignId]);

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;
  if (!char) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Personaje no encontrado</Typography>;

  const abbr = char.name.slice(0, 2).toUpperCase();

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        {char.characterImageUrl ? (
          <AuthImage src={char.characterImageUrl} alt={char.name} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover' }} />
        ) : (
          <Avatar sx={{ width: 72, height: 72 }}>{abbr}</Avatar>
        )}
        <Box>
          <Typography variant="h6">{char.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[char.race, char.className, char.level ? `Nv ${char.level}` : null].filter(Boolean).join(' · ')}
          </Typography>
          <Chip label={char.kind === 'pc' ? 'Jugador' : 'NPC'} size="small" sx={{ mt: 0.5 }} />
        </Box>
      </Stack>
      {char.background && (
        <Typography variant="body2"><strong>Trasfondo:</strong> {char.background}</Typography>
      )}
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

// ─── Subview: Enemy ───────────────────────────────────────────────────────────

function EnemySubview({ enemyId, campaignId }: { enemyId: string; campaignId: string }) {
  const [enemy, setEnemy] = useState<CampaignMonsterListItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listCampaignMonsters(campaignId, {}, 'en').then((res: any) => {
      const items: CampaignMonsterListItem[] = res.items ?? res;
      if (alive) { setEnemy(items.find((e) => e.id === enemyId) ?? null); setLoading(false); }
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

function DiarySubview({ sessionId, campaignId }: { sessionId: string; campaignId: string }) {
  const [session, setSession] = useState<DiarySessionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listDiarySessions(campaignId).then((all) => {
      if (alive) { setSession(all.find((s) => s.id === sessionId) ?? null); setLoading(false); }
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sessionId, campaignId]);

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;
  if (!session) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Sesión no encontrada</Typography>;

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Typography variant="h6">{session.title ?? `Sesión ${sessionId.slice(0, 6)}`}</Typography>
      {session.items.map((item) => item.title && (
        <Typography key={item.id} variant="body2" sx={{ pl: 1 }}>• {item.title}</Typography>
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
  onEdit: () => void;
}

function MarkerRootView({ marker, campaignId, allMaps, allCharacters, allEnemies, allEncounters, onNavigate, onEdit }: MarkerViewProps) {
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
    (assoc.diarySessionIds?.length ?? 0) +
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
        </Stack>
        {marker.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {marker.notes}
          </Typography>
        )}
      </Box>

      {totalAssociated > 0 && (
        <>
          <Divider />
          <List dense disablePadding>
            {/* Maps */}
            {mapItems.map((m) => (
              <ListItemButton key={m.id} onClick={() => onNavigate({ type: 'map', id: m.id })}>
                <MapIcon fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                <ListItemText primary={m.name} secondary="Mapa" />
              </ListItemButton>
            ))}
            {/* Characters */}
            {charItems.map((c) => (
              <ListItemButton key={c.id} onClick={() => onNavigate({ type: 'character', id: c.id! })}>
                <PersonIcon fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                <ListItemText primary={c.name} secondary={c.kind === 'pc' ? 'Jugador' : 'NPC'} />
              </ListItemButton>
            ))}
            {/* Enemies */}
            {enemyItems.map((e) => (
              <ListItemButton key={e.id} onClick={() => onNavigate({ type: 'enemy', id: e.id })}>
                <Typography sx={{ mr: 1.5 }}>👹</Typography>
                <ListItemText primary={e.name} secondary={`${e.type} · FP ${e.challengeRating ?? '?'}`} />
              </ListItemButton>
            ))}
            {/* Encounters */}
            {encounterItems.map((e) => (
              <ListItemButton key={e.id} onClick={() => onNavigate({ type: 'encounter', id: e.id })}>
                <Typography sx={{ mr: 1.5 }}>⚔️</Typography>
                <ListItemText primary={e.name} secondary={`Encuentro · ${e.difficulty}`} />
              </ListItemButton>
            ))}
            {/* Diary sessions (IDs only — names fetched in subview) */}
            {(assoc.diarySessionIds ?? []).map((id) => (
              <ListItemButton key={id} onClick={() => onNavigate({ type: 'diary', id })}>
                <Typography sx={{ mr: 1.5 }}>📖</Typography>
                <ListItemText primary="Sesión de diario" secondary={id.slice(0, 8)} />
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
 * Sliding Drawer (right side) that shows full marker information with
 * drill-down navigation into associated entities. Supports:
 * - Back/breadcrumb navigation
 * - Map subview with "Send to player window" + "Open Skyline"
 * - Character subview with "Open Skyline"
 * - Enemy subview with "Open Skyline"
 * - Encounter, diary session, and worldpedia subviews
 */
export default function MapMarkerDetail({
  marker,
  campaignId,
  open,
  onEdit,
  onClose,
  allMaps,
  allCharacters,
  allEnemies,
  allEncounters,
}: Props) {
  const [stack, setStack] = useState<NavItem[]>([{ type: 'marker' }]);

  /** Reset stack when the marker changes. */
  useEffect(() => {
    setStack([{ type: 'marker' }]);
  }, [marker.id]);

  const current = stack[stack.length - 1];
  const canGoBack = stack.length > 1;

  const navigate = (item: NavItem) => setStack((s) => [...s, item]);
  const goBack = () => setStack((s) => s.slice(0, -1));

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Toolbar */}
      <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
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
            : current.type === 'diary' ? 'Sesión de diario'
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
          />
        )}
        {current.type === 'map' && (
          <MapSubview mapId={current.id} campaignId={campaignId} />
        )}
        {current.type === 'character' && (
          <CharacterSubview charId={current.id} campaignId={campaignId} />
        )}
        {current.type === 'enemy' && (
          <EnemySubview enemyId={current.id} campaignId={campaignId} />
        )}
        {current.type === 'encounter' && (
          <EncounterSubview encounterId={current.id} campaignId={campaignId} />
        )}
        {current.type === 'diary' && (
          <DiarySubview sessionId={current.id} campaignId={campaignId} />
        )}
        {current.type === 'worldpedia' && (
          <WorldpediaSubview noteId={current.id} campaignId={campaignId} />
        )}
      </Box>
    </Drawer>
  );
}
