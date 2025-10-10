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

type LoopMode = 'continuous' | 'fixed' | 'random';

interface SoundEffectMeta {
  id: string;
  name: string;
  category?: string | null;
  isPublic: boolean;
  size: number;
  mimeType: string;
}

interface SectionedEffects {
  associated: SoundEffectMeta[];
  reusable: SoundEffectMeta[];
}

interface PresetItemMeta {
  id: string;
  volume: number;
  loopMode: LoopMode;
  waitMs?: number | null;
  randomMinMs?: number | null;
  randomMaxMs?: number | null;
  echoEnabled?: boolean;
  echoDelayMs?: number | null;
  echoFeedback?: number | null;
  pitchSemitones?: number | null;
  soundEffect: SoundEffectMeta;
}

interface SoundPresetMeta {
  id: string;
  name: string;
  items: PresetItemMeta[];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

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

  const buildStreamEffect = (id: string) => {
    return campaignId
      ? `${api.defaults.baseURL}/soundtrack/effects/${id}/stream?campaignId=${campaignId}`
      : `${api.defaults.baseURL}/soundtrack/effects/${id}/stream`;
  };
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
        const res = await api.get(buildStreamEffect(id), { headers: getAuthHeaders(), responseType: 'blob' });
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
          const res = await api.get(buildStreamEffect(eff.id), { headers: getAuthHeaders(), responseType: 'blob' });
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

  // Preset editor local item model
  type PresetItemInput = {
    soundEffectId: string;
    volume: number;
    loopMode: LoopMode;
    // UI uses seconds; convert to ms when saving
    waitSec?: number;
    randomMinSec?: number;
    randomMaxSec?: number;
    // Modifiers
    echoEnabled?: boolean;
    echoDelayMs?: number;
    echoFeedback?: number; // 0..1
    pitchSemitones?: number; // -24..+24
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
        waitSec: typeof i.waitMs === 'number' ? i.waitMs / 1000 : undefined,
        randomMinSec: typeof i.randomMinMs === 'number' ? i.randomMinMs / 1000 : undefined,
        randomMaxSec: typeof i.randomMaxMs === 'number' ? i.randomMaxMs / 1000 : undefined,
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
        waitMs: it.loopMode === 'fixed' ? Math.round((it.waitSec ?? 0) * 1000) : undefined,
        randomMinMs: it.loopMode === 'random' ? Math.round((it.randomMinSec ?? 0) * 1000) : undefined,
        randomMaxMs: it.loopMode === 'random' ? Math.round((it.randomMaxSec ?? 0) * 1000) : undefined,
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
          <Grid container spacing={2} columns={12}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth size="small" label="Buscar" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre o categoría" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                multiple
                size="small"
                options={optionsCategories}
                value={filterCategories}
                onChange={(_, v) => setFilterCategories(v)}
                renderInput={(params) => <TextField {...params} label="Categoría" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField fullWidth size="small" label="Público" value={filterPublic} onChange={e => setFilterPublic(e.target.value as any)} select SelectProps={{ native: true }}>
                <option value="any">Todos</option>
                <option value="true">Sólo públicos</option>
                <option value="false">Sólo privados</option>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField fullWidth size="small" label="Orden" value={sort} onChange={e => setSort(e.target.value as any)} select SelectProps={{ native: true }}>
                <option value="alpha">Alfabético A-Z</option>
                <option value="alpha_desc">Alfabético Z-A</option>
                <option value="size">Tamaño ↑</option>
                <option value="size_desc">Tamaño ↓</option>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} columns={12}>
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardHeader title="Presets" action={
              playingPresetId ? <Button color="error" startIcon={<StopIcon />} onClick={stopPresetPlayback}>Detener</Button> : null
            } />
            <CardContent sx={{ p: 0 }}>
              <List dense>
                {presets.map(p => (
                  <ListItem key={p.id} secondaryAction={<Stack direction="row" spacing={1}>
                    <IconButton size="small" title="Reproducir" onClick={() => startPresetPlayback(p)}><PlayArrowIcon /></IconButton>
                    <IconButton size="small" title="Editar" onClick={() => setEditPreset(p)}><EditIcon /></IconButton>
                  </Stack>}>
                    <ListItemText primary={p.name} secondary={`${p.items?.length || 0} efectos`} />
                  </ListItem>
                ))}
                {presets.length === 0 && (
                  <ListItem><ListItemText primary="No hay presets" /></ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader title="Efectos asociados" subheader={!campaignId ? 'Selecciona una campaña' : undefined} />
            <CardContent sx={{ p: 0 }}>
              <List dense>
                {campaignId && filteredAssociated.map(e => (
                  <ListItem key={e.id} secondaryAction={<Stack direction="row" spacing={1}>
                    <FormControlLabel
                      sx={{ mr: 1 }}
                      control={<Switch size="small" checked={(effectPlayMode[e.id] ?? 'once') === 'continuous'} onChange={(_, checked) => setEffectPlayMode(prev => ({ ...prev, [e.id]: checked ? 'continuous' : 'once' }))} />}
                      label={(effectPlayMode[e.id] ?? 'once') === 'continuous' ? 'Continuo' : '1 vez'}
                      labelPlacement="start"
                    />
                    <IconButton size="small" title="Desasociar" onClick={() => handleEffectUnassociate(e.id)}><LinkOffIcon /></IconButton>
                    <IconButton size="small" title="Editar" onClick={() => { setEditEf(e); setEfEditName(e.name); setEfEditCategory(e.category || ''); }}><EditIcon /></IconButton>
                    <IconButton size="small" title="Reproducir" onClick={() => handleEffectPlay(e.id)}><PlayArrowIcon /></IconButton>
                  </Stack>}>
                    <ListItemText primary={e.name} secondary={`${(e.size/1024).toFixed(1)} KB`} />
                  </ListItem>
                ))}
                {campaignId && filteredAssociated.length === 0 && (
                  <ListItem><ListItemText primary="No hay efectos asociados" /></ListItem>
                )}
                {!campaignId && (
                  <ListItem><ListItemText primary="Sin campaña activa" /></ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader title="Efectos reutilizables" subheader="Propios no asociados" />
            <CardContent sx={{ p: 0 }}>
              <List dense>
                {filteredReusable.map(e => (
                  <ListItem key={e.id} secondaryAction={<Stack direction="row" spacing={1}>
                    <FormControlLabel
                      sx={{ mr: 1 }}
                      control={<Switch size="small" checked={(effectPlayMode[e.id] ?? 'once') === 'continuous'} onChange={(_, checked) => setEffectPlayMode(prev => ({ ...prev, [e.id]: checked ? 'continuous' : 'once' }))} />}
                      label={(effectPlayMode[e.id] ?? 'once') === 'continuous' ? 'Continuo' : '1 vez'}
                      labelPlacement="start"
                    />
                    {campaignId && <IconButton size="small" title="Asociar" onClick={() => handleEffectAssociate(e.id)}><LinkIcon /></IconButton>}
                    <IconButton size="small" title="Editar" onClick={() => { setEditEf(e); setEfEditName(e.name); setEfEditCategory(e.category || ''); }}><EditIcon /></IconButton>
                    <IconButton size="small" title="Reproducir" onClick={() => handleEffectPlay(e.id)}><PlayArrowIcon /></IconButton>
                  </Stack>}>
                    <ListItemText primary={e.name} secondary={`${(e.size/1024).toFixed(1)} KB`} />
                  </ListItem>
                ))}
                {filteredReusable.length === 0 && (
                  <ListItem><ListItemText primary="No hay efectos reutilizables" /></ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create Effect */}
      <Dialog open={openCreateEf} onClose={() => setOpenCreateEf(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nuevo efecto</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            {efFiles.length <= 1 && (
              <TextField label="Nombre" size="small" value={efName} onChange={e => setEfName(e.target.value)} />
            )}
            <TextField label="Categoría (opcional)" size="small" value={efCategory} onChange={e => setEfCategory(e.target.value)} />
            <TextField label="URL (opcional)" size="small" value={efUrl} onChange={e => setEfUrl(e.target.value)} disabled={efFiles.length>0} />
            <Typography variant="caption" color="text.secondary">
              En un lote, cada efecto usará su nombre de archivo; la categoría se aplica a todos.
            </Typography>
            <Box
              sx={{
                p: 2,
                border: '2px dashed',
                borderColor: efIsDragging ? 'primary.main' : 'divider',
                borderRadius: 1,
                textAlign: 'center',
                bgcolor: efIsDragging ? 'action.hover' : 'transparent',
                cursor: 'pointer',
              }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setEfIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setEfIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation(); setEfIsDragging(false);
                const dropped = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('audio/'));
                if (dropped.length) {
                  setEfFiles(prev => {
                    const map = new Map(prev.map(f => [f.name + ':' + f.size, f]));
                    for (const d of dropped) map.set(d.name + ':' + d.size, d);
                    const arr = Array.from(map.values());
                    if (arr.length === 1 && !efName.trim()) { const base = arr[0].name.replace(/\.[^.]+$/, ''); setEfName(base); }
                    return arr;
                  });
                }
              }}
              onClick={() => { (document.getElementById('ef-file-multi') as HTMLInputElement | null)?.click(); }}
            >
              <Typography variant="body2" color="text.secondary">Arrastra aquí archivos de audio o haz click para seleccionarlos</Typography>
              <input id="ef-file-multi" type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={e => {
                const list = Array.from(e.target.files || []);
                if (!list.length) return;
                setEfFiles(prev => {
                  const map = new Map(prev.map(f => [f.name + ':' + f.size, f]));
                  for (const d of list) map.set(d.name + ':' + d.size, d);
                  const arr = Array.from(map.values());
                  if (arr.length === 1 && !efName.trim()) { const base = arr[0].name.replace(/\.[^.]+$/, ''); setEfName(base); }
                  return arr;
                });
              }} />
            </Box>
            {efFiles.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">Seleccionados: {efFiles.length} archivo(s)</Typography>
                <List dense>
                  {efFiles.slice(0, 5).map(f => {
                    const key = f.name + ':' + f.size;
                    const pct = efUploadProgress[key];
                    return (
                      <ListItem key={key} sx={{ alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={f.name} secondary={`${(f.size/1024).toFixed(1)} KB`} />
                          {creatingEf && (
                            <Box sx={{ pr: 2 }}>
                              <LinearProgress variant={typeof pct === 'number' ? 'determinate' : 'indeterminate'} value={pct ?? 0} />
                              <Typography variant="caption" color="text.secondary">{typeof pct === 'number' ? `${pct}%` : 'Subiendo…'}</Typography>
                            </Box>
                          )}
                        </Box>
                      </ListItem>
                    );
                  })}
                  {efFiles.length > 5 && (
                    <ListItem><ListItemText primary={`… y ${efFiles.length - 5} más`} /></ListItem>
                  )}
                </List>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateEf(false)}>Cancelar</Button>
          <Button variant="contained" disabled={creatingEf || (!(efFiles.length > 0) && !(efUrl.trim() && efName.trim()))} onClick={handleCreateEffect} startIcon={<AddIcon />}>Crear</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Effect */}
      <Dialog open={!!editEf} onClose={() => setEditEf(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar efecto</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField label="Nombre" size="small" value={efEditName} onChange={e => setEfEditName(e.target.value)} />
            <TextField label="Categoría" size="small" value={efEditCategory} onChange={e => setEfEditCategory(e.target.value)} />
            <Box>
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => setConfirmDeleteEfOpen(true)}>Eliminar efecto…</Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEf(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!editEf || savingEf} onClick={async () => {
            if (!editEf) return; setSavingEf(true);
            try {
              await api.patch(`/soundtrack/effects/${editEf.id}`, { name: efEditName.trim() || editEf.name, category: efEditCategory.trim() || null }, { headers: getAuthHeaders() });
              await fetchEffects(); setEditEf(null);
            } finally { setSavingEf(false); }
          }} startIcon={<EditIcon />}>Guardar</Button>
        </DialogActions>
      </Dialog>

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
            <Stack spacing={2}>
              {presetItemsDraft.map((it, idx) => {
                const eff = effectById.get(it.soundEffectId);
                if (!eff) return null;
                return (
                  <Card key={it.soundEffectId} variant="outlined">
                    <CardHeader title={eff.name} />
                    <CardContent>
                      <Stack spacing={2}>
                        <Box>
                          Volumen: <Slider value={it.volume} onChange={(_, v) => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, volume: Array.isArray(v)? v[0] as number : v as number } : x))} step={0.05} min={0} max={1} />
                        </Box>
                        <Box>
                          <Select size="small" value={it.loopMode} onChange={e => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, loopMode: e.target.value as LoopMode } : x))}>
                            <MenuItem value="continuous">Continuo</MenuItem>
                            <MenuItem value="fixed">Con espera fija</MenuItem>
                            <MenuItem value="random">Con espera aleatoria</MenuItem>
                          </Select>
                        </Box>
                        {it.loopMode === 'fixed' && (
                          <TextField type="number" size="small" label="Espera (s)" inputProps={{ step: 0.1 }} value={it.waitSec ?? 0} onChange={e => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, waitSec: Math.max(0, Number(e.target.value||0)) } : x))} />
                        )}
                        {it.loopMode === 'random' && (
                          <Stack direction="row" spacing={2}>
                            <TextField type="number" size="small" label="Mín (s)" inputProps={{ step: 0.1 }} value={it.randomMinSec ?? 0} onChange={e => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, randomMinSec: Math.max(0, Number(e.target.value||0)) } : x))} />
                            <TextField type="number" size="small" label="Máx (s)" inputProps={{ step: 0.1 }} value={it.randomMaxSec ?? 0} onChange={e => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, randomMaxSec: Math.max(0, Number(e.target.value||0)) } : x))} />
                          </Stack>
                        )}
                        {/* Modificadores */}
                        <FormControlLabel control={<Switch size="small" checked={!!it.echoEnabled} onChange={(_, v) => setPresetItemsDraft(d => d.map((x,i)=> i===idx? { ...x, echoEnabled: v } : x))} />} label="Eco" />
                        {it.echoEnabled && (
                          <Stack direction="row" spacing={2}>
                            <TextField type="number" size="small" label="Retardo (ms)" inputProps={{ step: 10 }} value={it.echoDelayMs ?? 300} onChange={e => setPresetItemsDraft(d => d.map((x,i)=> i===idx? { ...x, echoDelayMs: Math.max(0, Number(e.target.value||0)) } : x))} />
                            <Box display="flex" alignItems="center" gap={1}>
                              Feedback: <Slider sx={{ width: 120 }} value={it.echoFeedback ?? 0.3} onChange={(_, v)=> setPresetItemsDraft(d => d.map((x,i)=> i===idx? { ...x, echoFeedback: Array.isArray(v)? v[0] as number : v as number } : x))} min={0} max={1} step={0.05} />
                            </Box>
                          </Stack>
                        )}
                        <TextField type="number" size="small" label="Tono (semitonos)" inputProps={{ step: 1, min: -24, max: 24 }} value={it.pitchSemitones ?? 0} onChange={e => setPresetItemsDraft(d => d.map((x,i)=> i===idx? { ...x, pitchSemitones: Number(e.target.value) } : x))} />
                        <Box>
                          <Button color="error" onClick={() => setPresetItemsDraft(d => d.filter((_,i) => i!==idx))} startIcon={<DeleteIcon />}>Quitar</Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
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
            <Stack spacing={2}>
              {presetItemsDraft.map((it, idx) => {
                const eff = effectById.get(it.soundEffectId);
                if (!eff) return null;
                return (
                  <Card key={it.soundEffectId} variant="outlined">
                    <CardHeader title={eff.name} />
                    <CardContent>
                      <Stack spacing={2}>
                        <Box>
                          Volumen: <Slider value={it.volume} onChange={(_, v) => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, volume: Array.isArray(v)? v[0] as number : v as number } : x))} step={0.05} min={0} max={1} />
                        </Box>
                        <Box>
                          <Select size="small" value={it.loopMode} onChange={e => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, loopMode: e.target.value as LoopMode } : x))}>
                            <MenuItem value="continuous">Continuo</MenuItem>
                            <MenuItem value="fixed">Con espera fija</MenuItem>
                            <MenuItem value="random">Con espera aleatoria</MenuItem>
                          </Select>
                        </Box>
                        {it.loopMode === 'fixed' && (
                          <TextField type="number" size="small" label="Espera (s)" inputProps={{ step: 0.1 }} value={it.waitSec ?? 0} onChange={e => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, waitSec: Math.max(0, Number(e.target.value||0)) } : x))} />
                        )}
                        {it.loopMode === 'random' && (
                          <Stack direction="row" spacing={2}>
                            <TextField type="number" size="small" label="Mín (s)" inputProps={{ step: 0.1 }} value={it.randomMinSec ?? 0} onChange={e => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, randomMinSec: Math.max(0, Number(e.target.value||0)) } : x))} />
                            <TextField type="number" size="small" label="Máx (s)" inputProps={{ step: 0.1 }} value={it.randomMaxSec ?? 0} onChange={e => setPresetItemsDraft(d => d.map((x,i) => i===idx? { ...x, randomMaxSec: Math.max(0, Number(e.target.value||0)) } : x))} />
                          </Stack>
                        )}
                        {/* Modificadores */}
                        <FormControlLabel control={<Switch size="small" checked={!!it.echoEnabled} onChange={(_, v) => setPresetItemsDraft(d => d.map((x,i)=> i===idx? { ...x, echoEnabled: v } : x))} />} label="Eco" />
                        {it.echoEnabled && (
                          <Stack direction="row" spacing={2}>
                            <TextField type="number" size="small" label="Retardo (ms)" inputProps={{ step: 10 }} value={it.echoDelayMs ?? 300} onChange={e => setPresetItemsDraft(d => d.map((x,i)=> i===idx? { ...x, echoDelayMs: Math.max(0, Number(e.target.value||0)) } : x))} />
                            <Box display="flex" alignItems="center" gap={1}>
                              Feedback: <Slider sx={{ width: 120 }} value={it.echoFeedback ?? 0.3} onChange={(_, v)=> setPresetItemsDraft(d => d.map((x,i)=> i===idx? { ...x, echoFeedback: Array.isArray(v)? v[0] as number : v as number } : x))} min={0} max={1} step={0.05} />
                            </Box>
                          </Stack>
                        )}
                        <TextField type="number" size="small" label="Tono (semitonos)" inputProps={{ step: 1, min: -24, max: 24 }} value={it.pitchSemitones ?? 0} onChange={e => setPresetItemsDraft(d => d.map((x,i)=> i===idx? { ...x, pitchSemitones: Number(e.target.value) } : x))} />
                        <Box>
                          <Button color="error" onClick={() => setPresetItemsDraft(d => d.filter((_,i) => i!==idx))} startIcon={<DeleteIcon />}>Quitar</Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
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
