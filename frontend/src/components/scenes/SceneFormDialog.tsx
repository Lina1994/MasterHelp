import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Paper,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import UploadIcon from '@mui/icons-material/Upload';
import type { Scene, SceneActionDto, ScenePayload } from '../../types/scenes';
import type { SceneVideoAsset } from '../../types/scenes';
import { listSceneVideos, uploadSceneVideo } from '../../api/sceneVideos';
import SceneActionEditor from './SceneActionEditor';
import SceneTimelineEditor from './SceneTimelineEditor';

const SCENE_MAX_ACTIONS = 48;
const WINDOW_ACTION_TYPES = new Set([
  'sendImageToWindow',
  'sendVideoToWindow',
  'setWindowBackground',
  'applyWindowFilter',
  'clearWindowFilter',
]);

function emptyPayload(type: string): Record<string, unknown> {
  switch (type) {
    case 'playMusic':      return { songId: '', loop: false, volume: 80 };
    case 'stopMusic':      return { stopEffects: false };
    case 'playSound':      return { effectId: '', volume: 80, loopMode: 'once' };
    case 'setMusicVolume': return { value: 80 };
    case 'sendImageToWindow': return { imageUrl: '', title: '' };
    case 'sendVideoToWindow': return { videoUrl: '', loop: false, muted: false };
    case 'setWindowBackground': return { imageUrl: '', sizing: 'cover' };
    case 'applyWindowFilter': return { filter: 'blur', intensity: 0.5, color: '' };
    case 'clearWindowFilter': return {};
    case 'setWeather':     return { preset: 'rain', intensity: 0.5, durationMs: 0 };
    case 'setNarrativeText': return { text: '', title: '', durationMs: 0 };
    case 'runShortcut':    return { shortcutId: '' };
    case 'delay':          return { durationMs: 1000 };
    case 'runScene':       return { sceneId: '' };
    default:               return {};
  }
}

function defaultAction(): SceneActionDto {
  return { id: uuidv4(), type: 'delay', delay: 0, payload: { durationMs: 1000 } };
}

function blankDraft(campaignId?: string | null): ScenePayload {
  return {
    name: '',
    description: '',
    scope: campaignId ? 'campaign' : 'global',
    campaignId: campaignId ?? null,
    actions: [],
  };
}

interface Props {
  open: boolean;
  /** Scene being edited; null means "create new" */
  editing: Scene | null;
  campaignId?: string | null;
  onClose: () => void;
  onSave: (payload: ScenePayload, id?: string) => Promise<void>;
}

/**
 * Dialog for creating or editing a Scene, including its action list.
 */
const SceneFormDialog: React.FC<Props> = ({ open, editing, campaignId, onClose, onSave }) => {
  const [draft, setDraft] = useState<ScenePayload>(blankDraft(campaignId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneVideoAssets, setSceneVideoAssets] = useState<SceneVideoAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft({
        name: editing.name,
        description: editing.description ?? '',
        scope: editing.scope ?? 'campaign',
        campaignId: editing.campaignId ?? null,
        actions: editing.actions ?? [],
      });
    } else {
      setDraft(blankDraft(campaignId));
    }
    setError(null);
    setSelectedActionId(editing?.actions?.[0]?.id ?? null);
  }, [open, editing, campaignId]);

  useEffect(() => {
    if (!open) return;
    setLoadingAssets(true);
    listSceneVideos(campaignId ?? undefined)
      .then((items) => setSceneVideoAssets(items))
      .catch(() => setSceneVideoAssets([]))
      .finally(() => setLoadingAssets(false));
  }, [open, campaignId]);

  useEffect(() => {
    if (!draft.actions.length) {
      if (selectedActionId !== null) setSelectedActionId(null);
      return;
    }
    if (selectedActionId && draft.actions.some((action) => action.id === selectedActionId)) {
      return;
    }
    setSelectedActionId(draft.actions[0]?.id ?? null);
  }, [draft.actions, selectedActionId]);

  const set = <K extends keyof ScenePayload>(key: K, value: ScenePayload[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const addAction = () => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    const next = defaultAction();
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  };

  const addActionOfType = (type: string) => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    const next: SceneActionDto = {
      id: uuidv4(),
      type,
      delay: 0,
      targetWindow: WINDOW_ACTION_TYPES.has(type) ? { kind: 'projection' } : undefined,
      payload: emptyPayload(type),
    };
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  };

  const updateAction = (index: number, updated: SceneActionDto) => {
    setDraft((d) => {
      const actions = [...d.actions];
      actions[index] = updated;
      return { ...d, actions };
    });
  };

  const removeAction = (index: number) => {
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, i) => i !== index) }));
  };

  const handleSelectActionFromTimeline = (actionId: string) => {
    setSelectedActionId(actionId);
  };

  const handleChangeActionType = (index: number, type: string) => {
    updateAction(index, { ...draft.actions[index], type, payload: emptyPayload(type) });
  };

  const handleSave = async () => {
    if (!draft.name.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft, editing?.id);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadVideoClick = () => {
    fileInputRef.current?.click();
  };

  const handleVideoFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      await uploadSceneVideo(file, {
        campaignId: campaignId ?? undefined,
        name: file.name,
      });
      const refreshed = await listSceneVideos(campaignId ?? undefined);
      setSceneVideoAssets(refreshed);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al subir vídeo.');
    } finally {
      setUploadingVideo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedActionIndex = draft.actions.findIndex((action) => action.id === selectedActionId);
  const selectedAction = selectedActionIndex >= 0 ? draft.actions[selectedActionIndex] : null;

  const moveSelectedAction = (direction: -1 | 1) => {
    if (selectedActionIndex < 0) return;
    const nextIndex = selectedActionIndex + direction;
    if (nextIndex < 0 || nextIndex >= draft.actions.length) return;
    setDraft((d) => {
      const nextActions = [...d.actions];
      const swap = nextActions[selectedActionIndex];
      nextActions[selectedActionIndex] = nextActions[nextIndex];
      nextActions[nextIndex] = swap;
      return { ...d, actions: nextActions };
    });
  };

  const removeSelectedAction = () => {
    if (selectedActionIndex < 0) return;
    setDraft((d) => {
      const nextActions = d.actions.filter((_, idx) => idx !== selectedActionIndex);
      return { ...d, actions: nextActions };
    });
  };

  const selectedPreview = (() => {
    if (!selectedAction) {
      return (
        <Typography variant="body2" color="text.secondary">
          Selecciona una acción para previsualizarla.
        </Typography>
      );
    }

    const payload = selectedAction.payload ?? {};
    if (selectedAction.type === 'sendImageToWindow') {
      const imageUrl = String(payload.imageUrl ?? '').trim();
      if (!imageUrl) {
        return <Typography variant="body2" color="text.secondary">Acción sin URL de imagen.</Typography>;
      }
      return (
        <Box
          component="img"
          src={imageUrl}
          alt="Previsualizacion"
          sx={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 1 }}
        />
      );
    }

    if (selectedAction.type === 'sendVideoToWindow') {
      const videoUrl = String(payload.videoUrl ?? '').trim();
      if (!videoUrl) {
        return <Typography variant="body2" color="text.secondary">Acción sin URL de vídeo.</Typography>;
      }
      return (
        <Box
          component="video"
          src={videoUrl}
          autoPlay
          muted
          loop
          controls
          sx={{ width: '100%', maxHeight: 320, borderRadius: 1, bgcolor: 'black' }}
        />
      );
    }

    if (selectedAction.type === 'setNarrativeText') {
      return (
        <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.45)' }}>
          <Typography variant="subtitle2" color="white" sx={{ mb: 1 }}>
            {String(payload.title ?? 'Narrativa')}
          </Typography>
          <Typography variant="body1" color="white">
            {String(payload.text ?? 'Sin texto')}
          </Typography>
        </Box>
      );
    }

    return (
      <Stack spacing={1}>
        <Chip size="small" label={`Tipo: ${selectedAction.type}`} sx={{ alignSelf: 'flex-start' }} />
        <Typography variant="body2" color="text.secondary">
          Esta accion no tiene una previsualizacion dedicada todavia, pero puedes editar sus parametros en el inspector.
        </Typography>
      </Stack>
    );
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '96vw',
          maxWidth: '96vw',
          height: '92vh',
          maxHeight: '92vh',
        },
      }}
    >
      <DialogTitle>{editing ? 'Editar escena' : 'Nueva escena'}</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ height: '100%' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoFileSelected}
          />

          <Stack direction="row" spacing={1}>
            <TextField
              label="Nombre *"
              size="small"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              inputProps={{ maxLength: 80 }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ width: 180 }}>
              <InputLabel>Alcance</InputLabel>
              <Select
                value={draft.scope}
                label="Alcance"
                onChange={(e) => set('scope', e.target.value as 'global' | 'campaign')}
              >
                <MenuItem value="campaign">Campaña</MenuItem>
                <MenuItem value="global">Global</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <TextField
            label="Descripción"
            size="small"
            multiline
            rows={2}
            value={draft.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            inputProps={{ maxLength: 500 }}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '260px minmax(0, 1fr) 360px' },
              gap: 1.5,
              minHeight: 0,
              flex: 1,
            }}
          >
            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Herramientas</Typography>

              <Stack spacing={0.8}>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => addActionOfType('sendVideoToWindow')}>Añadir vídeo</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('sendImageToWindow')}>Añadir imagen</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('setNarrativeText')}>Añadir texto</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('playMusic')}>Añadir música</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('playSound')}>Añadir sonido</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('applyWindowFilter')}>Añadir filtro</Button>
                <Button size="small" variant="outlined" onClick={() => addActionOfType('delay')}>Añadir pausa</Button>
                <Button size="small" variant="text" onClick={addAction}>Acción vacía</Button>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Stack spacing={1} sx={{ minHeight: 0, flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Librería de vídeos</Typography>
                  <Button
                    size="small"
                    startIcon={<UploadIcon />}
                    onClick={handleUploadVideoClick}
                    disabled={uploadingVideo}
                  >
                    {uploadingVideo ? 'Subiendo…' : 'Subir'}
                  </Button>
                </Stack>

                {loadingAssets ? (
                  <Typography variant="caption" color="text.secondary">Cargando vídeos…</Typography>
                ) : sceneVideoAssets.length === 0 ? (
                  <Alert severity="info">No hay vídeos subidos todavía.</Alert>
                ) : (
                  <Stack spacing={0.7} sx={{ overflowY: 'auto', pr: 0.5 }}>
                    {sceneVideoAssets.map((asset) => (
                      <Chip
                        key={asset.id}
                        label={`${asset.name} (${Math.round(asset.size / (1024 * 1024))}MB)`}
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          if (!selectedAction || selectedAction.type !== 'sendVideoToWindow') return;
                          const updated = {
                            ...selectedAction,
                            payload: {
                              ...selectedAction.payload,
                              videoAssetId: asset.id,
                            },
                          };
                          updateAction(selectedActionIndex, updated);
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
              <Typography variant="subtitle2">Previsualizador</Typography>
              <Box
                sx={{
                  borderRadius: 1,
                  bgcolor: '#0f1116',
                  border: '1px solid',
                  borderColor: 'divider',
                  minHeight: 280,
                  maxHeight: 340,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {selectedPreview}
              </Box>

              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">
                    Timeline principal ({draft.actions.length}/{SCENE_MAX_ACTIONS})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Haz click en un bloque para editarlo.
                  </Typography>
                </Stack>
                <SceneTimelineEditor
                  actions={draft.actions}
                  selectedActionId={selectedActionId}
                  onSelectAction={handleSelectActionFromTimeline}
                />
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Inspector</Typography>
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    onClick={() => moveSelectedAction(-1)}
                    disabled={selectedActionIndex <= 0}
                    startIcon={<ArrowUpwardIcon />}
                  >
                    Subir
                  </Button>
                  <Button
                    size="small"
                    onClick={() => moveSelectedAction(1)}
                    disabled={selectedActionIndex < 0 || selectedActionIndex >= draft.actions.length - 1}
                    startIcon={<ArrowDownwardIcon />}
                  >
                    Bajar
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={removeSelectedAction}
                    disabled={selectedActionIndex < 0}
                    startIcon={<DeleteIcon />}
                  >
                    Eliminar
                  </Button>
                </Stack>
              </Stack>

              <Paper variant="outlined" sx={{ p: 1, mb: 1, maxHeight: 180, overflowY: 'auto' }}>
                <Stack spacing={0.5}>
                  {draft.actions.map((action, index) => (
                    <Button
                      key={action.id}
                      size="small"
                      variant={selectedActionId === action.id ? 'contained' : 'outlined'}
                      onClick={() => setSelectedActionId(action.id)}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      {index + 1}. {action.type}
                    </Button>
                  ))}
                  {draft.actions.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      No hay acciones creadas.
                    </Typography>
                  ) : null}
                </Stack>
              </Paper>

              <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {selectedAction ? (
                  <DndContext>
                    <SortableContext items={[selectedAction.id]} strategy={verticalListSortingStrategy}>
                      <SceneActionEditor
                        action={selectedAction}
                        index={selectedActionIndex + 1}
                        highlighted
                        sceneVideoAssets={sceneVideoAssets}
                        onRequestUploadVideo={handleUploadVideoClick}
                        onChange={(updated) => {
                          if (selectedActionIndex < 0) return;
                          if (updated.type !== draft.actions[selectedActionIndex].type) {
                            handleChangeActionType(selectedActionIndex, updated.type);
                          } else {
                            updateAction(selectedActionIndex, updated);
                          }
                        }}
                        onRemove={removeSelectedAction}
                      />
                    </SortableContext>
                  </DndContext>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Selecciona un bloque en timeline o en la lista del inspector.
                  </Typography>
                )}
              </Box>
            </Paper>
          </Box>

          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SceneFormDialog;
