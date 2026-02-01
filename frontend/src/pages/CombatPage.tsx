/**
 * CombatePage reúne la gestión de encuentros y la vista de combate en una sola pantalla.
 * Usa el contexto de campaña activa para decidir el contenido y el nivel de permisos
 * (máster con control total; jugador en modo lectura/seguimiento).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import EncounterList from '../components/Combat/EncounterList';
import CombatViewExt from '../components/Combat/CombatView';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { listEncounters, deleteEncounter as apiDeleteEncounter, EncounterSummary } from '../api/encounters';
import { listCharacters, CharacterPayload } from '../api/characters';
import { listSongsForCampaign, SongLite } from '../api/soundtrack';
import { getCampaignManuals } from '../api/campaigns/manuals';
import { fetchMonsters } from '../api/monsters';
import type { MonsterIndexItem } from '../types/monsters';
import type { Campaign } from '../components/Campaign/types';
import EncounterFormDialog from '../components/Combat/EncounterFormDialog';

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

  const reloadTimersRef = useRef<{ encounters?: any; characters?: any }>({});

  // Sync: allow other parts of the app (e.g. map token popover) to signal
  // that encounters/characters changed so this page refreshes its local lists.
  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) return;
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('campaign-sync');
        bc.onmessage = (e: MessageEvent) => {
          const data = e?.data;
          if (!data || data.campaignId !== cid) return;
          const type = data.type as string;

          const schedule = (key: 'encounters' | 'characters', fn: () => void) => {
            const prev = (reloadTimersRef.current as any)[key];
            if (prev) clearTimeout(prev);
            (reloadTimersRef.current as any)[key] = setTimeout(fn, 200);
          };

          if (type === 'encounterUpdated') {
            schedule('encounters', () => {
              listEncounters(cid).then(setEncounters).catch(() => {});
            });
          }

          if (type === 'characterUpdated') {
            schedule('characters', () => {
              listCharacters(cid).then(setCharacters).catch(() => {});
            });
          }
        };
      }
    } catch {}

    return () => {
      try { bc?.close(); } catch {}
      try {
        if (reloadTimersRef.current.encounters) clearTimeout(reloadTimersRef.current.encounters);
        if (reloadTimersRef.current.characters) clearTimeout(reloadTimersRef.current.characters);
      } catch {}
      reloadTimersRef.current = {};
    };
  }, [activeCampaign?.id]);

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

export default CombatPage;
