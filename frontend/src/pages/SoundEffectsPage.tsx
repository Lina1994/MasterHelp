import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, LinearProgress, List, ListItem, ListItemText, MenuItem, Select, Slider, Snackbar, Stack, TextField, Alert, Checkbox, Typography, Switch, FormControlLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';
import { Autocomplete } from '@mui/material';
import { SoundtrackTabs } from '../components/soundtrack/SoundtrackTabs';
import type { AxiosProgressEvent } from 'axios';
import { useSfxPlayer } from '../components/player/SfxPlayerContext';
import { buildEffectStreamUrl, clamp01, msToSec, secToMs } from '../utils/soundEffects';
import { LoopMode, PresetItemMeta, SectionedEffects, SoundEffectMeta, SoundPresetMeta } from '../types/soundEffects';
import { EffectsFilterBar } from '../components/soundEffects/EffectsFilterBar';
import { EffectsList } from '../components/soundEffects/EffectsList';
import { PresetsList } from '../components/soundEffects/PresetsList';
import { EffectCreateDialog } from '../components/soundEffects/EffectCreateDialog';
import { EffectEditDialog } from '../components/soundEffects/EffectEditDialog';
import { PresetItemsEditor, PresetItemInput } from '../components/soundEffects/PresetItemsEditor';

export default function SoundEffectsPage() {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const [effects, setEffects] = useState<SectionedEffects>({ associated: [], reusable: [] });
  const [presets, setPresets] = useState<SoundPresetMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; type: 'success' | 'error'} | null>(null);
  // Filters
  const [q, setQ] = useState('');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterPublic, setFilterPublic] = useState<'any' | 'true' | 'false'>('any');
  const [sort, setSort] = useState<'alpha' | 'alpha_desc' | 'size' | 'size_desc'>('alpha');

  // Create Effect
  const [openCreateEf, setOpenCreateEf] = useState(false);
  const [efName, setEfName] = useState('');
  const [efCategory, setEfCategory] = useState('');
  const [efUrl, setEfUrl] = useState('');
  const [efFiles, setEfFiles] = useState<File[]>([]);
  const [creatingEf, setCreatingEf] = useState(false);
  const [efIsDragging, setEfIsDragging] = useState(false);
  const [efUploadProgress, setEfUploadProgress] = useState<Record<string, number>>({});

  // Edit Effect
  const [editEf, setEditEf] = useState<SoundEffectMeta | null>(null);
  const [efEditName, setEfEditName] = useState('');
  const [efEditCategory, setEfEditCategory] = useState('');
  const [savingEf, setSavingEf] = useState(false);
  const [confirmDeleteEfOpen, setConfirmDeleteEfOpen] = useState(false);
  const [deletingEf, setDeletingEf] = useState(false);

  // Presets create/edit
  const [openCreatePreset, setOpenCreatePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [editPreset, setEditPreset] = useState<SoundPresetMeta | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [confirmDeletePresetOpen, setConfirmDeletePresetOpen] = useState(false);
  const [deletingPreset, setDeletingPreset] = useState(false);

  // Playback for preset: manage multiple Audio instances
  const [playingPresetId, setPlayingPresetId] = useState<string | null>(null);
  const controllersRef = useRef<Map<string, { audio: HTMLAudioElement; stop: () => void }>>(new Map());

  const { playSfx, stopAllSfx } = useSfxPlayer();
  // Playback mode per effect when playing directly from the list
  const [effectPlayMode, setEffectPlayMode] = useState<Record<string, 'once' | 'continuous'>>({});
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load persisted play modes (scoped by campaignId with legacy fallback)
  useEffect(() => {
    try {
      const key = campaignId ? `sfxEffectPlayMode:${campaignId}` : 'sfxEffectPlayMode';
      let parsed: any = null;
      const raw = localStorage.getItem(key);
      if (raw) {
        parsed = JSON.parse(raw);
      } else if (key !== 'sfxEffectPlayMode') {
        // fallback to legacy global key if scoped key doesn't exist yet
        const legacy = localStorage.getItem('sfxEffectPlayMode');
        if (legacy) parsed = JSON.parse(legacy);
      }
      if (parsed && typeof parsed === 'object') {
        setEffectPlayMode(parsed as Record<string, 'once' | 'continuous'>);
      }
    } catch {}
    setPrefsLoaded(true);
    // re-run when campaignId changes to switch scope
  }, [campaignId]);
  // Persist on change (only after initial load)
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      const key = campaignId ? `sfxEffectPlayMode:${campaignId}` : 'sfxEffectPlayMode';
      localStorage.setItem(key, JSON.stringify(effectPlayMode));
    } catch {}
  }, [effectPlayMode, prefsLoaded, campaignId]);

  const fetchEffects = async () => {
    setLoading(true);
    try {
      if (campaignId) {
  const r = await api.get(`/soundtrack/effects/campaigns/${campaignId}`, { headers: getAuthHeaders() });
        setEffects(r.data);
      } else {
  const r = await api.get(`/soundtrack/effects`, { headers: getAuthHeaders() });
        setEffects({ associated: [], reusable: r.data });
      }
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error cargando efectos', type: 'error' });
    } finally { setLoading(false); }
  };

  const fetchPresets = async () => {
    if (!campaignId) { setPresets([]); return; }
    try {
      const r = await api.get(`/soundtrack/presets/campaigns/${campaignId}`, { headers: getAuthHeaders() });
      setPresets(r.data);
    } catch {}
  };

  useEffect(() => { fetchEffects(); fetchPresets(); }, [campaignId]);

  // Summary: total bytes and unique count across associated + reusable
  const effectsSummary = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    for (const e of [...effects.associated, ...effects.reusable]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      total += e.size || 0;
    }
    return { totalBytes: total, count: seen.size };
  }, [effects]);
  const formatMB = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  const handleCreateEffect = async () => {
    const hasFiles = efFiles.length > 0;
    const hasUrl = !!efUrl.trim();
    if (!hasFiles && !hasUrl) { setSnack({ msg: 'Selecciona archivo(s) o URL', type: 'error' }); return; }
    if (hasUrl && !efName.trim()) { setSnack({ msg: 'Indica un nombre para la URL', type: 'error' }); return; }
    setCreatingEf(true);
    try {
      if (hasFiles) {
        // Progress map init
        const initial: Record<string, number> = {};
        for (const f of efFiles) initial[`${f.name}:${f.size}`] = 0;
        setEfUploadProgress(initial);
        const uploads = efFiles.map(async (f) => {
          const form = new FormData();
          const base = f.name.replace(/\.[^.]+$/, '');
          const nameToUse = (efFiles.length === 1 && efName.trim()) ? efName.trim() : base;
          form.append('name', nameToUse);
          if (campaignId) form.append('campaignId', campaignId);
          if (efCategory.trim()) form.append('category', efCategory.trim());
          form.append('file', f);
          const key = `${f.name}:${f.size}`;
          await api.post(`/soundtrack/effects`, form, {
            headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e: AxiosProgressEvent) => {
              const total = e.total ?? f.size;
              const loaded = e.loaded ?? 0;
              const pct = total ? Math.round((loaded / total) * 100) : 0;
              setEfUploadProgress(prev => ({ ...prev, [key]: pct }));
            },
          });
          setEfUploadProgress(prev => ({ ...prev, [key]: 100 }));
        });
        const results = await Promise.allSettled(uploads);
        const ok = results.filter(r => r.status === 'fulfilled').length;
        const fail = results.length - ok;
        setSnack({ msg: `Subida completada: ${ok} ok${fail ? `, ${fail} errores` : ''}`, type: fail ? 'error' : 'success' });
      } else {
        const form = new FormData();
        form.append('name', efName.trim());
        if (campaignId) form.append('campaignId', campaignId);
        if (efCategory.trim()) form.append('category', efCategory.trim());
        form.append('url', efUrl.trim());
        await api.post(`/soundtrack/effects`, form, { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' } });
        setSnack({ msg: 'Efecto creado', type: 'success' });
      }
      // Reset
      setOpenCreateEf(false); setEfName(''); setEfCategory(''); setEfUrl(''); setEfFiles([]); setEfUploadProgress({});
      await fetchEffects();
    } catch (e: any) { setSnack({ msg: e.response?.data?.message || 'Error creando efecto', type: 'error' }); }
    finally { setCreatingEf(false); }
  };

  const handleEffectAssociate = async (id: string) => {
    if (!campaignId) return;
  await api.post(`/soundtrack/effects/${id}/associate`, { campaignIds: [campaignId] }, { headers: getAuthHeaders() });
    await fetchEffects();
  };
  const handleEffectUnassociate = async (id: string) => {
    if (!campaignId) return;
  await api.delete(`/soundtrack/effects/${id}/associate/${campaignId}`, { headers: getAuthHeaders() });
    await fetchEffects();
  };
  const handleEffectDelete = async (id: string) => {
  await api.delete(`/soundtrack/effects/${id}`, { headers: getAuthHeaders() });
    await fetchEffects();
  };

  const handleEffectPlay = async (id: string) => {
    // Find metadata for name display
    const meta = effects.associated.find(e => e.id === id) || effects.reusable.find(e => e.id === id);
    if (!meta) return;
    const mode = effectPlayMode[id] ?? 'once';
    await playSfx(
      { effectId: id, name: meta.name },
      async () => {
        // Load via auth and return object URL
        const res = await api.get(buildEffectStreamUrl(api.defaults.baseURL, id, campaignId), { headers: getAuthHeaders(), responseType: 'blob' });
        return URL.createObjectURL(res.data as Blob);
      },
      { loopMode: mode, volume: 1, uniquePerEffect: true }
    );
  };

  const startPresetPlayback = async (preset: SoundPresetMeta) => {
    if (!preset.items?.length) return;
    stopPresetPlayback();
    setPlayingPresetId(preset.id);
    // Play each item using SfxPlayer so they are managed and visible in sidebar
    for (const item of preset.items) {
      const eff = item.soundEffect;
      await playSfx(
        { effectId: eff.id, name: eff.name },
        async () => {
          const res = await api.get(buildEffectStreamUrl(api.defaults.baseURL, eff.id, campaignId), { headers: getAuthHeaders(), responseType: 'blob' });
          return URL.createObjectURL(res.data as Blob);
        },
        {
          volume: clamp01(item.volume ?? 1),
          loopMode: item.loopMode,
          waitMs: item.waitMs ?? undefined,
          randomMinMs: item.randomMinMs ?? undefined,
          randomMaxMs: item.randomMaxMs ?? undefined,
          echoEnabled: !!item.echoEnabled,
          echoDelayMs: item.echoEnabled ? (item.echoDelayMs ?? 300) : undefined,
          echoFeedback: item.echoEnabled ? (item.echoFeedback ?? 0.3) : undefined,
          pitchSemitones: typeof item.pitchSemitones === 'number' ? item.pitchSemitones : 0,
        }
      );
    }
  };

  const stopPresetPlayback = () => {
    stopAllSfx();
    setPlayingPresetId(null);
  };

  const [presetItemsDraft, setPresetItemsDraft] = useState<PresetItemInput[]>([]);
  const associatedEffects = effects.associated;

  useEffect(() => {
    if (editPreset) {
      setPresetItemsDraft((editPreset.items || []).map(i => ({
        soundEffectId: i.soundEffect.id,
        volume: i.volume ?? 1,
        loopMode: i.loopMode,
        // convert ms -> seconds for UI
        waitSec: msToSec(i.waitMs),
        randomMinSec: msToSec(i.randomMinMs),
        randomMaxSec: msToSec(i.randomMaxMs),
        echoEnabled: !!i.echoEnabled,
        echoDelayMs: typeof i.echoDelayMs === 'number' ? i.echoDelayMs : 300,
        echoFeedback: typeof i.echoFeedback === 'number' ? i.echoFeedback : 0.3,
        pitchSemitones: typeof i.pitchSemitones === 'number' ? i.pitchSemitones : 0,
      })));
    } else {
      setPresetItemsDraft([]);
    }
  }, [editPreset]);

  const effectById = useMemo(() => {
    const map = new Map<string, SoundEffectMeta>();
    [...effects.associated, ...effects.reusable].forEach(e => map.set(e.id, e));
    return map;
  }, [effects]);

  // Filter options (categories) derived from current lists
  const optionsCategories = useMemo(() => {
    const set = new Set<string>();
    [...effects.associated, ...effects.reusable].forEach(e => { if (e.category) set.add(e.category); });
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }, [effects]);

  // Filtering and sorting
  const normalize = (s?: string | null) => (s || '').toLowerCase();
  const matchesFilters = (e: SoundEffectMeta) => {
    if (q.trim()) {
      const nq = normalize(q);
      const hay = normalize(e.name) + ' ' + normalize(e.category);
      if (!hay.includes(nq)) return false;
    }
    if (filterCategories.length) {
      if (!e.category || !filterCategories.includes(e.category)) return false;
    }
    if (filterPublic !== 'any') {
      const want = filterPublic === 'true';
      if (e.isPublic !== want) return false;
    }
    return true;
  };
  const applySort = (arr: SoundEffectMeta[]) => {
    const copy = [...arr];
    switch (sort) {
      case 'alpha': copy.sort((a,b) => a.name.localeCompare(b.name)); break;
      case 'alpha_desc': copy.sort((a,b) => b.name.localeCompare(a.name)); break;
      case 'size': copy.sort((a,b) => (a.size||0) - (b.size||0)); break;
      case 'size_desc': copy.sort((a,b) => (b.size||0) - (a.size||0)); break;
    }
    return copy;
  };
  const filteredAssociated = useMemo(() => applySort(effects.associated.filter(matchesFilters)), [effects, q, filterCategories, filterPublic, sort]);
  const filteredReusable = useMemo(() => applySort(effects.reusable.filter(matchesFilters)), [effects, q, filterCategories, filterPublic, sort]);

  const commitPreset = async () => {
    if (!campaignId) return;
    setSavingPreset(true);
    try {
      // convert seconds back to milliseconds for API payload
      const itemsPayload = presetItemsDraft.map(it => ({
        soundEffectId: it.soundEffectId,
        volume: it.volume,
        loopMode: it.loopMode,
        waitMs: it.loopMode === 'fixed' ? secToMs(it.waitSec ?? 0) : undefined,
        randomMinMs: it.loopMode === 'random' ? secToMs(it.randomMinSec ?? 0) : undefined,
        randomMaxMs: it.loopMode === 'random' ? secToMs(it.randomMaxSec ?? 0) : undefined,
        echoEnabled: !!it.echoEnabled,
        echoDelayMs: it.echoEnabled ? Math.max(0, Math.round(it.echoDelayMs ?? 300)) : undefined,
        echoFeedback: it.echoEnabled ? Math.max(0, Math.min(1, it.echoFeedback ?? 0.3)) : undefined,
        pitchSemitones: Number.isFinite(it.pitchSemitones as any) ? (it.pitchSemitones as number) : 0,
      }));
      if (editPreset) {
        await api.patch(`/soundtrack/presets/${editPreset.id}`, {
          name: editPreset.name,
          items: itemsPayload,
        }, { headers: getAuthHeaders() });
        setEditPreset(null);
        setSnack({ msg: 'Preset actualizado', type: 'success' });
      } else {
        await api.post(`/soundtrack/presets`, {
          name: presetName.trim(),
          campaignId,
          items: itemsPayload,
        }, { headers: getAuthHeaders() });
        setPresetName(''); setOpenCreatePreset(false);
        setSnack({ msg: 'Preset creado', type: 'success' });
      }
      await fetchPresets();
    } catch (e: any) {
      // Debug info temporal para diagnóstico
      // eslint-disable-next-line no-console
      console.error('Error commitPreset', {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
        request: {
          name: editPreset ? editPreset.name : presetName,
          count: presetItemsDraft.length,
          items: presetItemsDraft,
        },
      });
      setSnack({ msg: e?.response?.data?.message || 'Error guardando el preset', type: 'error' });
    } finally { setSavingPreset(false); }
  };

  return (
    <Box>
      <SoundtrackTabs current="effects" />
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box component="h2" m={0}>Efectos & Presets</Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {formatMB(effectsSummary.totalBytes)} / {effectsSummary.count} efectos
          </Typography>
          <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setOpenCreateEf(true)}>Nuevo Efecto</Button>
          <Button startIcon={<AddIcon />} variant="contained" disabled={!campaignId} onClick={() => setOpenCreatePreset(true)}>Nuevo Preset</Button>
        </Stack>
      </Box>
      {loading && <LinearProgress sx={{ mb:2 }} />}
      {/* Filters */}
      <Card variant="outlined" sx={{ mb:2 }}>
        <CardContent>
          <EffectsFilterBar
            q={q}
            onQChange={setQ}
            filterCategories={filterCategories}
            onCategoriesChange={setFilterCategories}
            filterPublic={filterPublic}
            onPublicChange={setFilterPublic}
            sort={sort}
            onSortChange={setSort}
            optionsCategories={optionsCategories}
          />
        </CardContent>
      </Card>

      <Grid container spacing={2} columns={12}>
        <Grid size={{ xs: 12 }}>
          <PresetsList
            presets={presets}
            playingPresetId={playingPresetId}
            onPlay={startPresetPlayback}
            onEdit={setEditPreset}
            onStop={stopPresetPlayback}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader title="Efectos asociados" subheader={!campaignId ? 'Selecciona una campaña' : undefined} />
            <CardContent sx={{ p: 0 }}>
              <EffectsList
                items={campaignId ? filteredAssociated : []}
                campaignId={campaignId}
                effectPlayMode={effectPlayMode}
                onPlayModeChange={(id, mode) => setEffectPlayMode(prev => ({ ...prev, [id]: mode }))}
                onUnassociate={campaignId ? handleEffectUnassociate : undefined}
                onEdit={(effect) => { setEditEf(effect); setEfEditName(effect.name); setEfEditCategory(effect.category || ''); }}
                onPlay={handleEffectPlay}
                emptyLabel={campaignId ? 'No hay efectos asociados' : 'Sin campaña activa'}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader title="Efectos reutilizables" subheader="Propios no asociados" />
            <CardContent sx={{ p: 0 }}>
              <EffectsList
                items={filteredReusable}
                campaignId={campaignId}
                effectPlayMode={effectPlayMode}
                onPlayModeChange={(id, mode) => setEffectPlayMode(prev => ({ ...prev, [id]: mode }))}
                onAssociate={campaignId ? handleEffectAssociate : undefined}
                onEdit={(effect) => { setEditEf(effect); setEfEditName(effect.name); setEfEditCategory(effect.category || ''); }}
                onPlay={handleEffectPlay}
                emptyLabel="No hay efectos reutilizables"
                showAssociate
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create Effect */}
      <EffectCreateDialog
        open={openCreateEf}
        onClose={() => setOpenCreateEf(false)}
        efName={efName}
        efCategory={efCategory}
        efUrl={efUrl}
        efFiles={efFiles}
        efIsDragging={efIsDragging}
        efUploadProgress={efUploadProgress}
        creatingEf={creatingEf}
        onChangeName={setEfName}
        onChangeCategory={setEfCategory}
        onChangeUrl={setEfUrl}
        onToggleDragging={setEfIsDragging}
        onFilesSelected={(files) => {
          setEfFiles(prev => {
            const map = new Map(prev.map(f => [f.name + ':' + f.size, f]));
            for (const d of files) map.set(d.name + ':' + d.size, d);
            const arr = Array.from(map.values());
            if (arr.length === 1 && !efName.trim()) { const base = arr[0].name.replace(/\.[^.]+$/, ''); setEfName(base); }
            return arr;
          });
        }}
        onSubmit={handleCreateEffect}
      />

      {/* Edit Effect */}
      <EffectEditDialog
        open={!!editEf}
        effect={editEf}
        efEditName={efEditName}
        efEditCategory={efEditCategory}
        savingEf={savingEf}
        onClose={() => setEditEf(null)}
        onChangeName={setEfEditName}
        onChangeCategory={setEfEditCategory}
        onRequestDelete={() => setConfirmDeleteEfOpen(true)}
        onSave={async () => {
          if (!editEf) return; setSavingEf(true);
          try {
            await api.patch(`/soundtrack/effects/${editEf.id}`, { name: efEditName.trim() || editEf.name, category: efEditCategory.trim() || null }, { headers: getAuthHeaders() });
            await fetchEffects(); setEditEf(null);
          } finally { setSavingEf(false); }
        }}
      />

      {/* Confirm delete effect */}
      <Dialog open={confirmDeleteEfOpen} onClose={() => setConfirmDeleteEfOpen(false)}>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent dividers>
          ¿Seguro que quieres eliminar "{efEditName || editEf?.name}"? Esta acción no se puede deshacer.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteEfOpen(false)}>Cancelar</Button>
          <Button color="error" variant="contained" disabled={deletingEf || !editEf} startIcon={<DeleteIcon />} onClick={async () => {
            if (!editEf) return; setDeletingEf(true);
            try {
              await api.delete(`/soundtrack/effects/${editEf.id}`, { headers: getAuthHeaders() });
              setConfirmDeleteEfOpen(false);
              setEditEf(null);
              await fetchEffects();
            } catch (e: any) {
              setSnack({ msg: e?.response?.data?.message || 'Error eliminando efecto', type: 'error' });
            } finally { setDeletingEf(false); }
          }}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      {/* Create Preset */}
      <Dialog open={openCreatePreset} onClose={() => setOpenCreatePreset(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nuevo preset</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField label="Nombre" size="small" value={presetName} onChange={e => setPresetName(e.target.value)} />
            <Autocomplete
              multiple
              size="small"
              options={associatedEffects}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(o,v) => o.id === v.id}
              disableCloseOnSelect
              onChange={(_, values) => {
                setPresetItemsDraft(prev => {
                  const next: PresetItemInput[] = [];
                  for (const v of values) {
                    const existing = prev.find(p => p.soundEffectId === v.id);
                    next.push(existing ?? { soundEffectId: v.id, volume: 1, loopMode: 'continuous' });
                  }
                  return next;
                });
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  {option.name}
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Efectos (asociados)" />}
            />
            <PresetItemsEditor items={presetItemsDraft} effectsById={effectById} onChange={setPresetItemsDraft} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreatePreset(false)}>Cancelar</Button>
          <Button variant="contained" disabled={!campaignId || !presetName.trim() || savingPreset} onClick={commitPreset} startIcon={<AddIcon />}>Crear</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Preset */}
      <Dialog open={!!editPreset} onClose={() => setEditPreset(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar preset</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField label="Nombre" size="small" value={editPreset?.name || ''} onChange={e => setEditPreset(prev => prev ? { ...prev, name: e.target.value } : prev)} />
            <Box>
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => setConfirmDeletePresetOpen(true)}>Eliminar preset…</Button>
            </Box>
            <Autocomplete
              multiple
              size="small"
              options={associatedEffects}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(o,v) => o.id === v.id}
              value={presetItemsDraft.map(it => effectById.get(it.soundEffectId)!).filter(Boolean)}
              disableCloseOnSelect
              onChange={(_, values) => {
                setPresetItemsDraft(prev => {
                  const map = new Map(prev.map(p => [p.soundEffectId, p] as const));
                  const next: PresetItemInput[] = [];
                  for (const v of values) {
                    next.push(map.get(v.id) ?? { soundEffectId: v.id, volume: 1, loopMode: 'continuous' });
                  }
                  return next;
                });
              }}
              renderInput={(params) => <TextField {...params} label="Efectos (asociados)" />}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox icon={<CheckBoxOutlineBlankIcon fontSize="small" />} checkedIcon={<CheckBoxIcon fontSize="small" />} style={{ marginRight: 8 }} checked={selected} />
                  {option.name}
                </li>
              )}
            />
            <PresetItemsEditor items={presetItemsDraft} effectsById={effectById} onChange={setPresetItemsDraft} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPreset(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!editPreset || savingPreset} onClick={commitPreset} startIcon={<EditIcon />}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Confirm delete preset */}
      <Dialog open={confirmDeletePresetOpen} onClose={() => setConfirmDeletePresetOpen(false)}>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent dividers>
          ¿Seguro que quieres eliminar "{editPreset?.name}"? Esta acción no se puede deshacer.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeletePresetOpen(false)}>Cancelar</Button>
          <Button color="error" variant="contained" disabled={deletingPreset || !campaignId || !editPreset} startIcon={<DeleteIcon />} onClick={async () => {
            if (!campaignId || !editPreset) return; setDeletingPreset(true);
            try {
              await api.delete(`/soundtrack/presets/campaigns/${campaignId}/${editPreset.id}`, { headers: getAuthHeaders() });
              setConfirmDeletePresetOpen(false);
              setEditPreset(null);
              await fetchPresets();
            } catch (e: any) {
              setSnack({ msg: e?.response?.data?.message || 'Error eliminando preset', type: 'error' });
            } finally { setDeletingPreset(false); }
          }}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)}>
        {snack ? <Alert severity={snack.type} onClose={() => setSnack(null)}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
