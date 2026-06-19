/**
 * CombatePage reúne la gestión de encuentros y la vista de combate en una sola pantalla.
 * Usa el contexto de campaña activa para decidir el contenido y el nivel de permisos
 * (máster con control total; jugador en modo lectura/seguimiento).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import EncounterList from '../components/Combat/EncounterList';
import CombatViewExt from '../components/Combat/CombatView';
import CombatSettingsView from '../components/Combat/CombatSettingsView';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { listEncounters, deleteEncounter as apiDeleteEncounter, EncounterSummary } from '../api/encounters';
import { listCharacters, CharacterPayload } from '../api/characters';
import { listSongsForCampaign, SongLite } from '../api/soundtrack';
import { getCampaignManuals } from '../api/campaigns/manuals';
import { listCampaignMonsters, CampaignMonsterListItem } from '../api/bestiary/bestiaryApi';
import { setSkylineOverlaySettings } from '../api/campaigns/skylineOverlay';
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
  const [tab, setTab] = useState<'encounters' | 'combat' | 'settings'>('combat');
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [monsters, setMonsters] = useState<Array<CampaignMonsterListItem & { compositeId: string }>>([]);
  const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; open: boolean; encounter: EncounterSummary | null }>({ mode: 'create', open: false, encounter: null });
  const [deleteTarget, setDeleteTarget] = useState<EncounterSummary | null>(null);

  // Ajustes compartidos entre CombatView y CombatSettingsView
  const [prioritizeEncounterMusic, setPrioritizeEncounterMusic] = useState(true);
  
  // Initialize showInitiativeStrip from localStorage to avoid flicker
  const [showInitiativeStrip, setShowInitiativeStrip] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('app.skyline.initiativeStrip');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.campaignId === activeCampaign?.id && data.enabled === true) {
          return true;
        }
      }
    } catch {}
    return false;
  });

  const handleToggleInitiativeStrip = useCallback(async (v: boolean) => {
    setShowInitiativeStrip(v);
    try {
      if (activeCampaign?.id) {
        await setSkylineOverlaySettings(activeCampaign.id, { showInitiativeStrip: v });
        try { 
          localStorage.setItem('app.skyline.settingsUpdated', JSON.stringify({ 
            campaignId: activeCampaign.id, 
            showInitiativeStrip: v, 
            at: Date.now() 
          })); 
        } catch {}
        try {
          if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('campaign-sync');
            bc.postMessage({ 
              type: 'skylineSettingsChanged', 
              campaignId: activeCampaign.id, 
              settings: { showInitiativeStrip: v } 
            });
            bc.close();
          }
        } catch {}
      }
    } catch {}
  }, [activeCampaign?.id]);

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
    if (!cid) { 
      setCharacters([]); 
      setLoadingCharacters(false);
      return; 
    }
    setLoadingCharacters(true);
    listCharacters(cid)
      .then(setCharacters)
      .catch(() => setCharacters([]))
      .finally(() => setLoadingCharacters(false));
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
        // Obtener monstruos del bestiario de campaña (incluye manual, editados y homebrew)
        const lang = 'es'; // TODO: usar i18n si está disponible
        const response = await listCampaignMonsters(cid, { pageSize: 1000 }, lang);
        const items = response.items || [];
        
        // Transformar para incluir compositeId para compatibilidad con EncounterFormDialog
        const list = items.map((m: CampaignMonsterListItem) => ({
          ...m,
          compositeId: m.id, // usar el id de campaña como compositeId
        })).sort((a: CampaignMonsterListItem & { compositeId: string }, b: CampaignMonsterListItem & { compositeId: string }) => a.name.localeCompare(b.name));
        
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
        <Tab value="settings" label="Ajustes" />
      </Tabs>
      {tab === 'encounters' && (
        <Stack spacing={2}>
          {!isMaster && <Alert severity="info">Como jugador puedes consultar encuentros, pero solo el máster puede crearlos o editarlos.</Alert>}
          {loading && <Alert severity="info">Cargando encuentros...</Alert>}
          {error && <Alert severity="warning">{error}</Alert>}
          <EncounterList encounters={encounters} characters={characters} isMaster={isMaster} onCreate={handleOpenCreate} onEdit={handleOpenEdit} onDelete={(enc) => setDeleteTarget(enc)} />
        </Stack>
      )}
      {tab === 'combat' && (
        loadingCharacters ? (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Alert severity="info">Cargando personajes...</Alert>
          </Paper>
        ) : (
          <CombatViewExt
            encounters={encounters.length ? encounters : []}
            isMaster={isMaster}
            campaign={activeCampaign}
            songs={songs}
            onUpdateEncounter={(enc) => setEncounters((prev) => prev.map((e) => e.id === enc.id ? enc : e))}
            characters={characters}
            onPatchCharacterLocal={(id, patch) => setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))}
            monsters={monsters}
            prioritizeEncounterMusic={prioritizeEncounterMusic}
            setPrioritizeEncounterMusic={setPrioritizeEncounterMusic}
            showInitiativeStrip={showInitiativeStrip}
            onToggleInitiativeStrip={handleToggleInitiativeStrip}
          />
        )
      )}
      {tab === 'settings' && (
        <CombatSettingsView
          isMaster={isMaster}
          campaign={activeCampaign}
          prioritizeEncounterMusic={prioritizeEncounterMusic}
          setPrioritizeEncounterMusic={setPrioritizeEncounterMusic}
          showInitiativeStrip={showInitiativeStrip}
          onToggleInitiativeStrip={handleToggleInitiativeStrip}
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
