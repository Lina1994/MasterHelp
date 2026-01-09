/**
 * CombatePage reúne la gestión de encuentros y la vista de combate en una sola pantalla.
 * Usa el contexto de campaña activa para decidir el contenido y el nivel de permisos
 * (máster con control total; jugador en modo lectura/seguimiento).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Button,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import EncounterList from '../components/Combat/EncounterList';
import CombatViewExt from '../components/Combat/CombatView';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { listEncounters, deleteEncounter as apiDeleteEncounter, createEncounter as apiCreateEncounter, updateEncounter as apiUpdateEncounter, EncounterSummary, EncounterDifficulty } from '../api/encounters';
import { listCharacters, CharacterPayload } from '../api/characters';
import { listSongsForCampaign, SongLite } from '../api/soundtrack';
import { getCampaignManuals } from '../api/campaigns/manuals';
import { fetchMonsters, fetchMonster } from '../api/monsters';
import type { MonsterIndexItem, MonsterDetail } from '../types/monsters';
import type { Campaign } from '../components/Campaign/types';
import { computeEncounterMetrics } from '../utils/encounterMetrics';

function computeIsMaster(campaign: Campaign | null, currentUserId?: number) {
  if (!campaign || !currentUserId) return false;
  if (campaign.owner?.id === currentUserId) return true;
  return campaign.players?.some((p) => p.user?.id === currentUserId && p.role === 'master') || false;
}

const CombatPage: React.FC = () => {
  const { activeCampaign } = useActiveCampaign();
  const user = getCurrentUser();
  const isMaster = useMemo(() => computeIsMaster(activeCampaign, user?.id), [activeCampaign, user?.id]);
  const [tab, setTab] = useState<'encounters' | 'combat'>('combat');
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [monsters, setMonsters] = useState<Array<MonsterIndexItem & { manualId: string; compositeId: string }>>([]);
  const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; open: boolean; encounter: EncounterSummary | null }>({ mode: 'create', open: false, encounter: null });
  const [deleteTarget, setDeleteTarget] = useState<EncounterSummary | null>(null);

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) {
      setEncounters([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await listEncounters(cid);
        setEncounters(data);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'No se pudieron cargar los encuentros');
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCampaign?.id]);

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) { setCharacters([]); return; }
    // Cargar personajes para permitir asociarlos como participantes
    listCharacters(cid).then(setCharacters).catch(() => setCharacters([]));
  }, [activeCampaign?.id]);

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) { setSongs([]); return; }
    listSongsForCampaign(cid)
      .then(({ associated, reusable }) => setSongs([...(associated || []), ...(reusable || [])]))
      .catch(() => setSongs([]));
  }, [activeCampaign?.id]);

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) { setMonsters([]); return; }
    (async () => {
      try {
        let manualIds = activeCampaign?.selectedManualIds?.length
          ? activeCampaign.selectedManualIds
          : [];
        if (!manualIds.length) {
          try {
            manualIds = await getCampaignManuals(cid);
          } catch {
            manualIds = [];
          }
        }
        const ids = manualIds.length ? manualIds : ['dnd5e-2014'];
        const fetchOne = async (mid: string, lang: 'es' | 'en') => {
          const r = await fetchMonsters(mid, { lang, page: 1, pageSize: 500 });
          return r.items || [];
        };
        const combined: Record<string, MonsterIndexItem & { manualId: string; compositeId: string }> = {};
        for (const mid of ids) {
          let items: MonsterIndexItem[] = [];
          try { items = await fetchOne(mid, 'es'); } catch {}
          if (!items.length) {
            try { items = await fetchOne(mid, 'en'); } catch {}
          }
          items.forEach((m) => {
            const compositeId = `${mid}:${m.slug}`;
            combined[compositeId] = { ...m, manualId: mid, compositeId };
          });
        }
        const list = Object.values(combined).sort((a, b) => a.name.localeCompare(b.name));
        setMonsters(list);
      } catch {
        setMonsters([]);
      }
    })();
  }, [activeCampaign?.id, activeCampaign?.selectedManualIds]);

  const handleOpenCreate = () => setDialogState({ mode: 'create', open: true, encounter: null });
  const handleOpenEdit = (enc: EncounterSummary) => setDialogState({ mode: 'edit', open: true, encounter: enc });
  const handleCloseDialog = () => setDialogState({ ...dialogState, open: false });

  const handleSaved = (saved: EncounterSummary, mode: 'create' | 'edit') => {
    setEncounters((prev) => {
      if (mode === 'create') return [...prev, saved];
      return prev.map((p) => (p.id === saved.id ? saved : p));
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget || !activeCampaign?.id) return;
    try {
      await apiDeleteEncounter(activeCampaign.id, deleteTarget.id);
      setEncounters((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!activeCampaign?.id) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Combate</Typography>
        <Typography variant="body2" color="text.secondary">
          Selecciona una campaña para gestionar encuentros o usar la vista de combate.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Combate</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="encounters" label="Encuentros" />
        <Tab value="combat" label="Combate" />
      </Tabs>
      {tab === 'encounters' && (
        <Stack spacing={2}>
          {!isMaster && <Alert severity="info">Como jugador puedes consultar encuentros, pero solo el máster puede crearlos o editarlos.</Alert>}
          {loading && <Alert severity="info">Cargando encuentros...</Alert>}
          {error && <Alert severity="warning">{error}</Alert>}
          <EncounterList encounters={encounters} isMaster={isMaster} onCreate={handleOpenCreate} onEdit={handleOpenEdit} onDelete={(enc) => setDeleteTarget(enc)} />
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Próximo paso: conectar CRUD de encuentros (bestiario + personajes), calculadora de dificultad y selección de música por dificultad y momento del día.
            </Typography>
          </Paper>
        </Stack>
      )}
      {tab === 'combat' && (
        <CombatViewExt
          encounters={encounters.length ? encounters : []}
          isMaster={isMaster}
          campaign={activeCampaign}
          songs={songs}
          onUpdateEncounter={(enc) => setEncounters((prev) => prev.map((e) => e.id === enc.id ? enc : e))}
          characters={characters}
          onPatchCharacterLocal={(id, patch) => setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))}
          monsters={monsters}
        />
      )}

      {isMaster && (
        <EncounterFormDialog
          open={dialogState.open}
          mode={dialogState.mode}
          encounter={dialogState.encounter}
          onClose={handleCloseDialog}
          onSaved={handleSaved}
          campaignId={activeCampaign.id}
          characters={characters}
          songs={songs}
          monsters={monsters}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar encuentro"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        confirmColor="error"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
};

// GotoMapsButton moved to components/Combat/GotoMapsButton

export default CombatPage;

type EncounterFormDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  encounter: EncounterSummary | null;
  onClose: () => void;
  onSaved: (enc: EncounterSummary, mode: 'create' | 'edit') => void;
  campaignId: string;
  characters: CharacterPayload[];
  songs: SongLite[];
  monsters: Array<MonsterIndexItem & { manualId: string; compositeId: string }>;
};

function EncounterFormDialog({ open, mode, encounter, onClose, onSaved, campaignId, characters, songs, monsters }: EncounterFormDialogProps) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<EncounterDifficulty>('Medio');
  const [autoDifficulty, setAutoDifficulty] = useState(true);
  const [musicLabel, setMusicLabel] = useState('');
  const [musicSongId, setMusicSongId] = useState<string | ''>('');
  const [participants, setParticipants] = useState<EncounterSummary['participants']>([]);
  const [saving, setSaving] = useState(false);
  const [monsterPreview, setMonsterPreview] = useState<MonsterDetail | null>(null);
  const [monsterPreviewLoading, setMonsterPreviewLoading] = useState(false);

  const metrics = useMemo(() => computeEncounterMetrics(participants), [participants]);

  useEffect(() => {
    if (open && encounter) {
      setName(encounter.name);
      setDifficulty(encounter.difficulty);
      setAutoDifficulty(false);
      setMusicLabel(encounter.musicLabel || '');
      setMusicSongId(encounter.musicSongId || '');
      setParticipants(encounter.participants || []);
    } else if (open) {
      setName('');
      setDifficulty('Medio');
      setAutoDifficulty(true);
      setMusicLabel('');
      setMusicSongId('');
      setParticipants([]);
    }
  }, [open, encounter]);

  useEffect(() => {
    if (autoDifficulty) {
      setDifficulty(metrics.suggested);
    }
  }, [metrics.suggested, autoDifficulty]);

  const upsertParticipantById = (pid: string, patch: Partial<EncounterSummary['participants'][number]>) => {
    setParticipants((prev) => prev.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  };

  const addCharacter = (charId: string, asEnemy = false) => {
    const ch = characters.find((c) => c.id === charId);
    if (!ch) return;
    setParticipants((prev) => [...prev, {
      id: ch.id!,
      name: ch.name,
      kind: asEnemy ? 'enemy' : 'character',
      role: asEnemy ? 'foe' : 'ally',
      level: ch.level,
    }]);
  };

  const makeUuid = () => {
    try {
      if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
    } catch {}
    // simple fallback uuid v4-ish
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const addEnemy = (monster?: MonsterIndexItem & { manualId?: string; compositeId?: string }) => {
    const id = makeUuid();
    setParticipants((prev) => [...prev, {
      id,
      name: monster?.name || 'Enemigo',
      kind: 'enemy',
      role: 'foe',
      cr: monster?.challengeRating ? Number(monster.challengeRating) : 0,
      monsterManualId: monster?.manualId,
      monsterSlug: monster?.slug,
    }]);
  };

  const duplicateParticipantById = (pid: string) => {
    const original = participants.find((p) => p.id === pid);
    if (!original) return;
    const id = makeUuid();
    const clone = { ...original, id };
    setParticipants((prev) => [...prev, clone]);
  };

  const removeParticipantById = (pid: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== pid));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      difficulty,
      musicLabel: musicLabel.trim() || undefined,
      musicSongId: musicSongId || undefined,
      participants: participants.map((p) => {
        const cleanLevel = Number.isFinite(p.level) ? p.level : undefined;
        const cleanCr = Number.isFinite(p.cr) ? p.cr : undefined;
        const cleanInit = Number.isFinite(p.initiative) ? p.initiative : undefined;
        const cleanMaxHp = Number.isFinite(p.maxHp) ? p.maxHp : undefined;
        const cleanCurrentHp = Number.isFinite(p.currentHp) ? p.currentHp : undefined;
        return {
          ...p,
          level: cleanLevel,
          cr: cleanCr,
          initiative: cleanInit,
          maxHp: cleanMaxHp,
          currentHp: cleanCurrentHp,
        };
      }),
    } as const;
    try {
      let saved: EncounterSummary;
      if (mode === 'create') {
        saved = await apiCreateEncounter(campaignId, payload as any);
      } else if (encounter) {
        saved = await apiUpdateEncounter(campaignId, encounter.id, payload as any);
      } else {
        return;
      }
      onSaved(saved, mode);
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Error al guardar el encuentro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Nuevo encuentro' : 'Editar encuentro'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
          <FormControl size="small" fullWidth>
            <InputLabel id="difficulty-label">Dificultad</InputLabel>
            <Select
              labelId="difficulty-label"
              label="Dificultad"
              value={difficulty}
              onChange={(e) => { setAutoDifficulty(false); setDifficulty(e.target.value as EncounterDifficulty); }}
            >
              {(['Fácil','Medio','Difícil','Mortal'] as EncounterDifficulty[]).map((d) => (
                <MenuItem key={d} value={d}>{d}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            XP base {metrics.totalXp || 0} · x{metrics.multiplier} ({metrics.monsterCount} enemigos) = {metrics.adjustedXp || 0} ajustados.{' '}
            Umbrales {metrics.pcCount || 0} PJ: Fácil {metrics.thresholds.easy || 0} / Medio {metrics.thresholds.medium || 0} / Difícil {metrics.thresholds.hard || 0} / Mortal {metrics.thresholds.deadly || 0}.{' '}
            Sugerido: {metrics.suggested}{autoDifficulty ? ' (auto)' : ''}.
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel id="music-label" shrink>Música asociada</InputLabel>
            <Select
              labelId="music-label"
              label="Música asociada"
              value={musicSongId}
              onChange={(e) => {
                const val = e.target.value as string;
                setMusicSongId(val);
                const selected = songs.find((s) => s.id === val);
                setMusicLabel(selected?.name || '');
              }}
              displayEmpty
              renderValue={(val) => {
                if (!val) return <em>Sin música</em>;
                const selected = songs.find((s) => s.id === val);
                return selected?.name || musicLabel || <em>Sin música</em>;
              }}
            >
              <MenuItem value=""><em>Sin música</em></MenuItem>
              {songs.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />
          <Typography variant="subtitle1">Participantes</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="add-character-label" shrink>Añadir personaje (aliado)</InputLabel>
              <Select
                labelId="add-character-label"
                label="Añadir personaje (aliado)"
                onChange={(e) => { addCharacter(e.target.value as string, false); (e.target as any).value = ''; }}
                value=""
                displayEmpty
                renderValue={(val) => (val ? val : <em>Selecciona personaje</em>)}
              >
                <MenuItem value="" disabled>Selecciona personaje</MenuItem>
                {characters.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} {c.level ? `(Nivel ${c.level})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="add-character-foe-label" shrink>Personaje como enemigo</InputLabel>
              <Select
                labelId="add-character-foe-label"
                label="Personaje como enemigo"
                onChange={(e) => { addCharacter(e.target.value as string, true); (e.target as any).value = ''; }}
                value=""
                displayEmpty
                renderValue={(val) => (val ? val : <em>Selecciona personaje</em>)}
              >
                <MenuItem value="" disabled>Selecciona personaje</MenuItem>
                {characters.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} {c.level ? `(Nivel ${c.level})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="add-monster-label" shrink>Enemigo del bestiario</InputLabel>
              <Select
                labelId="add-monster-label"
                label="Enemigo del bestiario"
                onChange={async (e) => {
                  const composite = e.target.value as string;
                  const m = monsters.find((mm) => mm.compositeId === composite);
                  if (m) {
                    addEnemy(m);
                    setMonsterPreviewLoading(true);
                    try {
                      const detail = await fetchMonster(m.manualId, m.slug, 'es').catch(async () => fetchMonster(m.manualId, m.slug, 'en'));
                      setMonsterPreview(detail);
                    } catch { setMonsterPreview(null); } finally { setMonsterPreviewLoading(false); }
                  }
                  (e.target as any).value = '';
                }}
                value=""
                displayEmpty
                renderValue={(val) => (val ? val : <em>Selecciona enemigo</em>)}
              >
                <MenuItem value="" disabled>Selecciona enemigo</MenuItem>
                {monsters.map((m) => (
                  <MenuItem key={m.compositeId} value={m.compositeId}>{m.name}{m.challengeRating ? ` (CR ${m.challengeRating})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => addEnemy()}>Enemigo manual</Button>
          </Stack>

          {monsterPreview && (
            <Card variant="outlined" sx={{ p: 1 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="subtitle2">{monsterPreview.name} {monsterPreview.challengeRating ? `(CR ${monsterPreview.challengeRating})` : ''}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {monsterPreview.size || '—'} · {monsterPreview.type || 'criatura'}{monsterPreview.alignment ? `, ${monsterPreview.alignment}` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AC {monsterPreview.armorClass?.value ?? '—'} · HP {monsterPreview.hitPoints?.average ?? '—'} {monsterPreview.hitPoints?.roll ? `(${monsterPreview.hitPoints.roll})` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">Velocidad: {monsterPreview.speed ? Object.entries(monsterPreview.speed).map(([k,v]) => `${k} ${v}ft`).join(', ') : '—'}</Typography>
                {monsterPreview.traits?.length ? (
                  <Typography variant="body2" color="text.secondary">{monsterPreview.traits.slice(0,2).map(t => t.name).join(' · ')}</Typography>
                ) : null}
              </CardContent>
            </Card>
          )}
          {monsterPreviewLoading && <Typography variant="body2" color="text.secondary">Cargando ficha...</Typography>}

          <Stack spacing={2}>
            <Typography variant="subtitle2">Aliados</Typography>
            {participants.filter(p => p.role !== 'foe').map((p) => (
              <Paper key={p.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                  <TextField
                    label="Nombre"
                    size="small"
                    value={p.name}
                    onChange={(e) => upsertParticipantById(p.id, { name: e.target.value })}
                    sx={{ minWidth: 200 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id={`kind-${p.id}`}>Tipo</InputLabel>
                    <Select
                      labelId={`kind-${p.id}`}
                      label="Tipo"
                      value={p.kind}
                      onChange={(e) => upsertParticipantById(p.id, { kind: e.target.value as any })}
                    >
                      <MenuItem value="character">Personaje</MenuItem>
                      <MenuItem value="enemy">Enemigo</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id={`role-${p.id}`}>Rol</InputLabel>
                    <Select
                      labelId={`role-${p.id}`}
                      label="Rol"
                      value={p.role || ''}
                      onChange={(e) => upsertParticipantById(p.id, { role: e.target.value as any })}
                    >
                      <MenuItem value="ally">Aliado</MenuItem>
                      <MenuItem value="foe">Enemigo</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Nivel"
                    size="small"
                    type="number"
                    inputProps={{ min: 1, max: 30 }}
                    value={p.level ?? ''}
                    onChange={(e) => upsertParticipantById(p.id, { level: Number(e.target.value) })}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Iniciativa"
                    size="small"
                    type="number"
                    inputProps={{ min: -10, max: 50 }}
                    value={p.initiative ?? ''}
                    onChange={(e) => upsertParticipantById(p.id, { initiative: Number(e.target.value) })}
                    sx={{ width: 140 }}
                  />
                  <Button color="error" size="small" onClick={() => removeParticipantById(p.id)}>Quitar</Button>
                </Stack>
              </Paper>
            ))}
            <Typography variant="subtitle2">Enemigos</Typography>
            {participants.filter(p => p.role === 'foe').map((p) => (
              <Paper key={p.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                  <TextField
                    label="Nombre"
                    size="small"
                    value={p.name}
                    onChange={(e) => upsertParticipantById(p.id, { name: e.target.value })}
                    sx={{ minWidth: 200 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id={`kind-${p.id}`}>Tipo</InputLabel>
                    <Select
                      labelId={`kind-${p.id}`}
                      label="Tipo"
                      value={p.kind}
                      onChange={(e) => upsertParticipantById(p.id, { kind: e.target.value as any })}
                    >
                      <MenuItem value="character">Personaje</MenuItem>
                      <MenuItem value="enemy">Enemigo</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id={`role-${p.id}`}>Rol</InputLabel>
                    <Select
                      labelId={`role-${p.id}`}
                      label="Rol"
                      value={p.role || ''}
                      onChange={(e) => upsertParticipantById(p.id, { role: e.target.value as any })}
                    >
                      <MenuItem value="ally">Aliado</MenuItem>
                      <MenuItem value="foe">Enemigo</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="CR"
                    size="small"
                    type="number"
                    inputProps={{ min: 0, step: 0.25 }}
                    value={p.cr ?? ''}
                    onChange={(e) => upsertParticipantById(p.id, { cr: Number(e.target.value) })}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Iniciativa"
                    size="small"
                    type="number"
                    inputProps={{ min: -10, max: 50 }}
                    value={p.initiative ?? ''}
                    onChange={(e) => upsertParticipantById(p.id, { initiative: Number(e.target.value) })}
                    sx={{ width: 140 }}
                  />
                  <IconButton aria-label="Duplicar" size="small" color="primary" onClick={() => duplicateParticipantById(p.id)} title="Duplicar este enemigo">
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <Button color="error" size="small" onClick={() => removeParticipantById(p.id)}>Quitar</Button>
                </Stack>
              </Paper>
            ))}
            {participants.length === 0 && (
              <Typography variant="body2" color="text.secondary">Añade personajes o enemigos para calcular dificultad y preparar iniciativa.</Typography>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
          {mode === 'create' ? 'Crear' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
