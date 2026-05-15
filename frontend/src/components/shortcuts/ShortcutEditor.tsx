import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Paper,
  Popover,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import BackspaceIcon from '@mui/icons-material/Backspace';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  SHORTCUT_ACTION_KIND_OPTIONS_GROUPED,
  SHORTCUT_SCHEMA_VERSION,
  SHORTCUT_WINDOW_TARGET_KIND_OPTIONS,
  type ShortcutActionDefinition,
  type ShortcutActionKind,
  type ShortcutWindowTargetKind,
} from '../../types/actionTypes';
import { hotkeyFromKeyboardEvent, type ShortcutItem, type ShortcutMode, type ShortcutPanel, type ShortcutPayload } from '../../types/shortcuts';
import { listShortcutWindows, type ShortcutRuntimeWindow } from '../../shortcuts/ipcActions';
import { findHotkeyConflict, getActionPayload, validateActionForEditor } from '../../shortcuts/validators';
import type { ShortcutActionExecutionResult } from '../../shortcuts/ShortcutRunner';
import { listMaps, type MapItemDto } from '../../api/maps';
import { listPlaylists, listSongsForCampaign, type PlaylistLite, type SongLite } from '../../api/soundtrack';
import { listSfxPresets, type SoundPresetLite } from '../../api/soundeffects';
import { listCharacters, type CharacterPayload } from '../../api/characters';
import { listCampaignMonsters, type CampaignMonsterListItem } from '../../api/bestiary/bestiaryApi';
import { uploadShortcutIcon } from '../../api/shortcuts';
import { listScenes, type SceneLite } from '../../api/scenes';
import EmojiPickerDialog from './EmojiPickerDialog';
import { recordRecentEmoji } from './emojiData';
import ShortcutThumbnailPreview from './ShortcutThumbnailPreview';

type ShortcutEditorProps = {
  open: boolean;
  editing: ShortcutItem | null;
  initialDraft: ShortcutPayload;
  panels: ShortcutPanel[];
  shortcuts: ShortcutItem[];
  soundEffects: Array<{ id: string; name: string }>;
  campaignId?: string | null;
  onClose: () => void;
  onSave: (payload: ShortcutPayload) => Promise<void>;
  onTest: (payload: ShortcutPayload) => Promise<ShortcutActionExecutionResult[]>;
};

const EMPTY_ACTION: ShortcutActionDefinition = {
  kind: 'toggleState',
  payload: {},
};

const formatHotkeyLabel = (hotkey: string): string => {
  if (!hotkey) return '';
  return hotkey
    .split('+')
    .filter(Boolean)
    .map((segment) => (segment.length === 1 ? segment.toUpperCase() : segment.charAt(0).toUpperCase() + segment.slice(1)))
    .join('+');
};

const actionKey = (action: ShortcutActionDefinition, index: number): string => {
  return `${action.kind}-${index}`;
};

const MONSTER_ORIGIN_LABEL: Record<CampaignMonsterListItem['origin'], string> = {
  manual: 'Manual',
  'manual-edited': 'Manual editado',
  homebrew: 'Homebrew',
};

const getSongGroupLabel = (song: SongLite): string => {
  return song.group?.trim() || song.atmosphere?.trim() || 'Sin grupo';
};

const getSongSecondaryLabel = (song: SongLite): string => {
  const parts = [song.artist, song.album].filter(Boolean);
  return parts.join(' · ');
};

const getPlaylistGroupLabel = (playlist: PlaylistLite): string => {
  return (playlist.songs?.length || 0) > 0 ? 'Con canciones' : 'Vacias';
};

const getMapGroupLabel = (map: MapItemDto): string => {
  return map.isWorldMap ? 'Mapa mundial' : 'Mapa de escena';
};

const getCharacterSecondaryLabel = (character: CharacterPayload): string => {
  const level = typeof character.level === 'number' ? `Nv. ${character.level}` : undefined;
  return [character.className, level].filter(Boolean).join(' · ');
};

const getMonsterSecondaryLabel = (monster: CampaignMonsterListItem): string => {
  return [monster.type, monster.challengeRating ? `CR ${monster.challengeRating}` : undefined]
    .filter(Boolean)
    .join(' · ');
};

const SortableActionRow = ({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Paper ref={setNodeRef} variant="outlined" sx={{ p: 1.5 }} style={style}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <IconButton size="small" {...attributes} {...listeners} sx={{ mt: 0.5 }}>
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>{children}</Box>
      </Stack>
    </Paper>
  );
};

const buildDefaultPayload = (kind: ShortcutActionKind): Record<string, unknown> => {
  switch (kind) {
    case 'playSoundEffect':
      return { effectId: '', volume: 1, loopMode: 'once', uniquePerEffect: true };
    case 'time.setMoment':
      return { value: 'morning' };
    case 'audio.playSong':
      return { songId: '' };
    case 'audio.playPlaylist':
      return { playlistId: '' };
    case 'audio.playPresetEffects':
      return { presetId: '' };
    case 'audio.setVolume':
      return { value: 1 };
    case 'audio.adjustVolume':
      return { value: 0.1 };
    case 'audio.setMute':
      return { muted: true };
    case 'window.showText':
      return { text: '', title: '', durationMs: 4000 };
    case 'window.applyFilter':
      return { filter: 'grayscale', intensity: 0.7, color: '#00000033' };
    case 'window.showCharacterImage':
    case 'window.showNpcImage':
    case 'window.showMonsterImage':
      return { entityId: '', durationMs: 8000 };
    case 'window.setActiveMap':
      return { mapId: '' };
    case 'time.advanceDay':
    case 'time.rewindDay':
      return { amount: 1 };
    case 'config.setLanguage':
      return { language: 'es' };
    case 'config.setTheme':
      return { theme: 'dark' };
    case 'config.setFontScale':
      return { scale: 1 };
    case 'config.updateSettings':
      return { key: '', value: '' };
    case 'runScene':
      return { sceneId: '' };
    case 'delay.wait':
      return { durationMs: 1000 };
    default:
      return {};
  }
};

/**
 * Shortcut editor dialog with typed action forms and drag-drop ordering.
 */
const ShortcutEditor = ({
  open,
  editing,
  initialDraft,
  panels,
  shortcuts,
  soundEffects,
  campaignId,
  onClose,
  onSave,
  onTest,
}: ShortcutEditorProps) => {
  const [draft, setDraft] = useState<ShortcutPayload>(initialDraft);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [availableWindows, setAvailableWindows] = useState<ShortcutRuntimeWindow[]>([]);
  const [testReport, setTestReport] = useState<ShortcutActionExecutionResult[] | null>(null);
  const [availableSongs, setAvailableSongs] = useState<SongLite[]>([]);
  const [availablePlaylists, setAvailablePlaylists] = useState<PlaylistLite[]>([]);
  const [availablePresets, setAvailablePresets] = useState<SoundPresetLite[]>([]);
  const [availableMaps, setAvailableMaps] = useState<MapItemDto[]>([]);
  const [availableCharacters, setAvailableCharacters] = useState<CharacterPayload[]>([]);
  const [availableNpcs, setAvailableNpcs] = useState<CharacterPayload[]>([]);
  const [availableMonsters, setAvailableMonsters] = useState<CampaignMonsterListItem[]>([]);
  const [availableScenes, setAvailableScenes] = useState<SceneLite[]>([]);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [thumbnailMenuAnchorEl, setThumbnailMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [reuseIconValue, setReuseIconValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showInPanels = Boolean((draft.panelIds || []).length > 0 || draft.showInSidebarPanel || draft.showInHotbar);
  const thumbnailMenuOpen = Boolean(thumbnailMenuAnchorEl);

  useEffect(() => {
    setDraft(initialDraft);
    setErrorMessage(null);
    setTestReport(null);
  }, [initialDraft, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listShortcutWindows()
      .then((rows) => {
        if (!cancelled) setAvailableWindows(rows);
      })
      .catch(() => {
        if (!cancelled) setAvailableWindows([]);
      });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || !campaignId) {
      setAvailableSongs([]);
      setAvailablePlaylists([]);
      setAvailablePresets([]);
      setAvailableMaps([]);
      setAvailableCharacters([]);
      setAvailableNpcs([]);
      setAvailableMonsters([]);
      setAvailableScenes([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      listSongsForCampaign(campaignId),
      listPlaylists(campaignId),
      listSfxPresets(campaignId),
      listMaps({ campaignId }),
      listCharacters(campaignId),
      listCampaignMonsters(campaignId, { pageSize: 1000 }, 'es').catch(() => listCampaignMonsters(campaignId, { pageSize: 1000 }, 'en')),
      listScenes({ campaignId }),
    ])
      .then(([songsRes, playlistsRes, presetsRes, mapsRes, charsRes, monstersRes, scenesRes]) => {
        if (cancelled) return;
        setAvailableSongs([...(songsRes.associated || []), ...(songsRes.reusable || [])]);
        setAvailablePlaylists(playlistsRes || []);
        setAvailablePresets(presetsRes || []);
        setAvailableMaps(mapsRes || []);
        const chars = Array.isArray(charsRes) ? charsRes : [];
        setAvailableCharacters(chars.filter((ch) => ch.kind === 'pc'));
        setAvailableNpcs(chars.filter((ch) => ch.kind === 'npc'));
        const monsters = Array.isArray((monstersRes as any)?.items)
          ? ((monstersRes as any).items as CampaignMonsterListItem[])
          : [];
        setAvailableMonsters(monsters);
        setAvailableScenes(Array.isArray(scenesRes) ? scenesRes : []);
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableSongs([]);
        setAvailablePlaylists([]);
        setAvailablePresets([]);
        setAvailableMaps([]);
        setAvailableCharacters([]);
        setAvailableNpcs([]);
        setAvailableMonsters([]);
        setAvailableScenes([]);
      });
    return () => { cancelled = true; };
  }, [open, campaignId]);

  const effectOptions = useMemo(
    () => soundEffects.map((effect) => ({ value: effect.id, label: effect.name })),
    [soundEffects],
  );

  const updateAction = (index: number, next: ShortcutActionDefinition) => {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((action, actionIndex) => (actionIndex === index ? next : action)),
    }));
  };

  const removeAction = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, actionIndex) => actionIndex !== index),
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = Number(String(active.id).split('-').pop());
    const newIndex = Number(String(over.id).split('-').pop());
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;

    setDraft((prev) => ({
      ...prev,
      actions: arrayMove(prev.actions, oldIndex, newIndex),
    }));
  };

  const validateDraft = (): string | null => {
    if (!draft.name?.trim()) return 'El nombre es obligatorio';

    const effectiveScope = draft.scope || (campaignId ? 'campaign' : 'global');

    const conflict = findHotkeyConflict(shortcuts, draft.hotkey, editing?.id, effectiveScope, campaignId);
    if (conflict) {
      return `La combinación ya está en uso por "${conflict.name}"`;
    }

    for (const action of draft.actions) {
      const err = validateActionForEditor(action);
      if (err) return err;
      if (action.targetWindow?.kind === 'instance') {
        const targetId = action.targetWindow.windowId || '';
        const exists = availableWindows.some((row) => row.id === targetId || String(row.webContentsId) === targetId);
        if (!exists) return 'La ventana objetivo seleccionada no existe actualmente';
      }
    }
    return null;
  };

  const normalizedPayload = (): ShortcutPayload => {
    return {
      ...draft,
      scope: draft.scope || (campaignId ? 'campaign' : 'global'),
      campaignId: draft.scope === 'campaign' || (!draft.scope && campaignId) ? campaignId : null,
      schemaVersion: SHORTCUT_SCHEMA_VERSION,
      mode: draft.mode as ShortcutMode,
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      icon: draft.icon?.trim() || null,
      imageUrl: draft.imageUrl?.trim() || null,
      hotkey: draft.hotkey?.trim() || null,
      actions: draft.actions,
    };
  };

  const handleSave = async () => {
    const validationError = validateDraft();
    setErrorMessage(validationError);
    if (validationError) return;

    setIsSaving(true);
    try {
      const nextPayload = normalizedPayload();
      await onSave(nextPayload);
      if (nextPayload.icon) {
        recordRecentEmoji(nextPayload.icon);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    const validationError = validateDraft();
    setErrorMessage(validationError);
    if (validationError) return;

    setIsTesting(true);
    try {
      const report = await onTest(normalizedPayload());
      setTestReport(report);
      const failed = report.find((row) => !row.ok);
      if (failed) {
        setErrorMessage(`Fallo en acción ${failed.index + 1} (${failed.kind}): ${failed.message || 'error desconocido'}`);
      } else {
        setErrorMessage(null);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleHotkeyCapture = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Backspace' || event.key === 'Delete') {
      setDraft((prev) => ({ ...prev, hotkey: '' }));
      return;
    }

    if (event.key === 'Escape') return;

    const nextHotkey = hotkeyFromKeyboardEvent(event.nativeEvent);
    if (!nextHotkey) return;
    setDraft((prev) => ({ ...prev, hotkey: nextHotkey }));
  };

  const closeThumbnailMenu = () => {
    setThumbnailMenuAnchorEl(null);
    setReuseIconValue('');
  };

  const handleIconFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingIcon(true);
    setErrorMessage(null);
    try {
      const url = await uploadShortcutIcon(file);
      setDraft((prev) => ({ ...prev, imageUrl: url, icon: '' }));
    } catch {
      setErrorMessage('No se pudo subir la imagen/gif del icono');
    } finally {
      setIsUploadingIcon(false);
      event.target.value = '';
    }
  };

  const handleReuseIcon = (value: string) => {
    if (!value) return;

    if (value.startsWith('icon:')) {
      setDraft((prev) => ({ ...prev, icon: value.slice(5), imageUrl: '' }));
    } else if (value.startsWith('img:')) {
      setDraft((prev) => ({ ...prev, imageUrl: value.slice(4), icon: '' }));
    }

    closeThumbnailMenu();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{editing ? 'Editar atajo' : 'Nuevo atajo'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {errorMessage ? <Alert severity="warning">{errorMessage}</Alert> : null}
          {testReport && testReport.length > 0 ? (
            <Alert severity={testReport.every((r) => r.ok) ? 'success' : 'info'}>
              {testReport.every((r) => r.ok)
                ? `Prueba completada: ${testReport.length} acciones ejecutadas correctamente.`
                : `Prueba completada con incidencias: ${testReport.filter((r) => !r.ok).length} de ${testReport.length} acciones fallaron.`}
            </Alert>
          ) : null}
          {isUploadingIcon ? (
            <Alert severity="info">Subiendo icono...</Alert>
          ) : null}

          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
              <Box sx={{ flexShrink: 0 }}>
                <ShortcutThumbnailPreview
                  icon={draft.icon}
                  imageUrl={draft.imageUrl}
                  name={draft.name || 'Atajo'}
                  onClick={(event) => setThumbnailMenuAnchorEl(event.currentTarget)}
                />
              </Box>

              <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  label="Nombre"
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Descripción"
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  fullWidth
                  multiline
                  minRows={2}
                />
                <TextField
                  label="Tecla / combinación"
                  value={formatHotkeyLabel(draft.hotkey || '')}
                  onKeyDown={handleHotkeyCapture}
                  fullWidth
                  size="small"
                  placeholder="Pulsa la combinación"
                  helperText="Ctrl+Shift+X y similares. Usa Backspace para limpiar."
                  InputProps={{
                    readOnly: true,
                    endAdornment: draft.hotkey ? (
                      <IconButton size="small" onClick={() => setDraft((prev) => ({ ...prev, hotkey: '' }))}>
                        <BackspaceIcon fontSize="small" />
                      </IconButton>
                    ) : undefined,
                  }}
                />
              </Stack>
            </Stack>
          </Paper>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/gif"
            hidden
            onChange={handleIconFileChange}
          />

          <Popover
            open={thumbnailMenuOpen}
            anchorEl={thumbnailMenuAnchorEl}
            onClose={closeThumbnailMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Stack spacing={1.5} sx={{ p: 2, width: { xs: 280, sm: 340 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Editar miniatura
              </Typography>

              <TextField
                label="Emoji personalizado"
                value={draft.icon || ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, icon: event.target.value, imageUrl: '' }))}
                inputProps={{ maxLength: 32, style: { fontSize: 22, textAlign: 'center' } }}
                helperText="Pega un emoji o usa el selector ampliado."
                fullWidth
                size="small"
              />

              <Button
                variant="outlined"
                onClick={() => {
                  closeThumbnailMenu();
                  setEmojiPickerOpen(true);
                }}
              >
                {draft.icon ? 'Cambiar emoji' : 'Elegir emoji'}
              </Button>

              <Button
                variant="outlined"
                onClick={() => {
                  fileInputRef.current?.click();
                  closeThumbnailMenu();
                }}
                disabled={isUploadingIcon}
              >
                {isUploadingIcon ? 'Subiendo...' : (draft.imageUrl ? 'Cambiar imagen/GIF' : 'Subir imagen/GIF')}
              </Button>

              <FormControl fullWidth size="small">
                <InputLabel id="reuse-icon-label" shrink>Reutilizar icono</InputLabel>
                <Select
                  labelId="reuse-icon-label"
                  label="Reutilizar icono"
                  value={reuseIconValue}
                  displayEmpty
                  renderValue={(selected) => {
                    if (selected) return selected;
                    return <Typography color="text.secondary">Selecciona un atajo...</Typography>;
                  }}
                  onChange={(event) => {
                    const value = String(event.target.value);
                    setReuseIconValue(value);
                    handleReuseIcon(value);
                  }}
                >
                  <MenuItem value="" disabled>
                    <em>Selecciona un atajo...</em>
                  </MenuItem>
                  {shortcuts
                    .filter((shortcut) => (shortcut.icon || shortcut.imageUrl) && shortcut.id !== editing?.id)
                    .map((shortcut) => (
                      shortcut.icon ? (
                        <MenuItem key={`icon-${shortcut.id}`} value={`icon:${shortcut.icon}`}>
                          {shortcut.icon}
                          <span style={{ fontSize: 13, color: '#888', marginLeft: 8 }}>{shortcut.name}</span>
                        </MenuItem>
                      ) : (
                        <MenuItem key={`img-${shortcut.id}`} value={`img:${shortcut.imageUrl}`}>
                          {shortcut.imageUrl ? <img src={shortcut.imageUrl} alt="icono" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3, marginRight: 8 }} /> : null}
                          <span style={{ fontSize: 13, color: '#888' }}>{shortcut.name}</span>
                        </MenuItem>
                      )
                    ))}
                </Select>
              </FormControl>

              <Button
                color="inherit"
                onClick={() => {
                  setDraft((prev) => ({ ...prev, imageUrl: '', icon: '' }));
                  closeThumbnailMenu();
                }}
                disabled={!draft.icon && !draft.imageUrl}
              >
                Quitar miniatura
              </Button>
            </Stack>
          </Popover>

          <EmojiPickerDialog
            open={emojiPickerOpen}
            value={draft.icon || ''}
            onClose={() => setEmojiPickerOpen(false)}
            onSelect={(emoji) => setDraft((prev) => ({ ...prev, icon: emoji, imageUrl: '' }))}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="shortcut-scope-label">Scope</InputLabel>
                <Select
                  labelId="shortcut-scope-label"
                  label="Scope"
                  value={draft.scope || (campaignId ? 'campaign' : 'global')}
                  onChange={(event) => setDraft((prev) => ({ ...prev, scope: event.target.value as 'global' | 'campaign' }))}
                >
                  <MenuItem value="global">Global</MenuItem>
                  <MenuItem value="campaign" disabled={!campaignId}>Campaña activa</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="shortcut-mode-label">Modo</InputLabel>
                <Select
                  labelId="shortcut-mode-label"
                  label="Modo"
                  value={draft.mode}
                  onChange={(event) => setDraft((prev) => ({ ...prev, mode: event.target.value as ShortcutMode }))}
                >
                  <MenuItem value="button">Botón</MenuItem>
                  <MenuItem value="toggle">Toggle</MenuItem>
                  <MenuItem value="temporary">Temporal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                type="number"
                label="Duración temporal (ms)"
                value={draft.temporaryDurationMs ?? 5000}
                onChange={(event) => setDraft((prev) => ({ ...prev, temporaryDurationMs: Number(event.target.value) }))}
                fullWidth
                disabled={draft.mode !== 'temporary'}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                type="color"
                label="Color activo"
                value={draft.activeColor}
                onChange={(event) => setDraft((prev) => ({ ...prev, activeColor: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Acciones</Typography>
                <Button
                  variant="text"
                  onClick={() => setDraft((prev) => ({ ...prev, actions: [...prev.actions, EMPTY_ACTION] }))}
                >
                  Añadir acción
                </Button>
              </Stack>

              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={draft.actions.map((action, index) => actionKey(action, index))}
                  strategy={verticalListSortingStrategy}
                >
                  <Stack spacing={1.5}>
                    {draft.actions.map((action, index) => {
                      const payload = getActionPayload(action);
                      return (
                        <SortableActionRow id={actionKey(action, index)} key={actionKey(action, index)}>
                          <Stack spacing={1.5}>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, md: 5 }}>
                                <FormControl fullWidth>
                                  <InputLabel id={`action-kind-${index}`}>Tipo</InputLabel>
                                  <Select
                                    labelId={`action-kind-${index}`}
                                    label="Tipo"
                                    value={action.kind}
                                    onChange={(event) => {
                                      const nextKind = event.target.value as ShortcutActionKind;
                                      updateAction(index, {
                                        kind: nextKind,
                                        payload: buildDefaultPayload(nextKind),
                                      });
                                    }}
                                  >
                                    {SHORTCUT_ACTION_KIND_OPTIONS_GROUPED.map((group) => [
                                      <ListSubheader key={`group-${group.category}`}>{group.category}</ListSubheader>,
                                      ...group.options.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                      )),
                                    ]).flat()}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                  type="number"
                                  label="Delay antes (ms)"
                                  value={action.delayMs ?? 0}
                                  onChange={(event) => updateAction(index, {
                                    ...action,
                                    delayMs: Number(event.target.value) || 0,
                                  })}
                                  fullWidth
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <FormControl fullWidth>
                                  <InputLabel id={`target-kind-${index}`}>Ventana destino</InputLabel>
                                  <Select
                                    labelId={`target-kind-${index}`}
                                    label="Ventana destino"
                                    value={action.targetWindow?.kind || ''}
                                    onChange={(event) => {
                                      const kind = event.target.value as ShortcutWindowTargetKind;
                                      if (!kind) {
                                        const clone = { ...action } as ShortcutActionDefinition;
                                        delete clone.targetWindow;
                                        updateAction(index, clone);
                                        return;
                                      }
                                      updateAction(index, {
                                        ...action,
                                        targetWindow: {
                                          kind,
                                          windowId: kind === 'instance' ? '' : undefined,
                                          windowType: kind === 'custom' ? '' : undefined,
                                        },
                                      });
                                    }}
                                  >
                                    <MenuItem value="">Sin destino</MenuItem>
                                    {SHORTCUT_WINDOW_TARGET_KIND_OPTIONS.map((option) => (
                                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid size={{ xs: 12, md: 1 }}>
                                <IconButton color="error" onClick={() => removeAction(index)}>
                                  <DeleteIcon />
                                </IconButton>
                              </Grid>
                            </Grid>

                            {action.targetWindow?.kind === 'instance' ? (
                              <Stack spacing={1}>
                                <FormControl fullWidth>
                                  <InputLabel id={`instance-window-${index}`}>Instancia</InputLabel>
                                  <Select
                                    labelId={`instance-window-${index}`}
                                    label="Instancia"
                                    value={action.targetWindow.windowId || ''}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      targetWindow: { ...action.targetWindow!, windowId: String(event.target.value) },
                                    })}
                                  >
                                    {availableWindows.map((row) => (
                                      <MenuItem key={row.id} value={row.id}>
                                        {`${row.title} (${row.kind}) [${row.id}]`}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                {availableWindows.length === 0 ? (
                                  <Typography variant="caption" color="text.secondary">
                                    No hay ventanas registradas en este momento para seleccionar por instancia.
                                  </Typography>
                                ) : null}
                              </Stack>
                            ) : null}

                            {action.targetWindow?.kind === 'custom' ? (
                              <TextField
                                label="Window type"
                                value={action.targetWindow.windowType || ''}
                                onChange={(event) => updateAction(index, {
                                  ...action,
                                  targetWindow: { ...action.targetWindow!, windowType: event.target.value },
                                })}
                                fullWidth
                              />
                            ) : null}

                            {draft.mode === 'button' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <FormControl fullWidth>
                                    <InputLabel id={`active-state-${index}`}>Estado activo de esta acción</InputLabel>
                                    <Select
                                      labelId={`active-state-${index}`}
                                      label="Estado activo de esta acción"
                                      value={action.activeStateRule ?? 'never'}
                                      onChange={(event) => updateAction(index, {
                                        ...action,
                                        activeStateRule: event.target.value as string || null,
                                      })}
                                    >
                                      <MenuItem value="never">Nunca</MenuItem>
                                      <MenuItem value="temporary">Temporal (mientras se reproduce)</MenuItem>
                                      <MenuItem value="when:status=playing">Si: status = playing</MenuItem>
                                      <MenuItem value="when:status=paused">Si: status = paused</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'playSoundEffect' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <FormControl fullWidth>
                                    <InputLabel id={`effect-select-${index}`}>Efecto</InputLabel>
                                    <Select
                                      labelId={`effect-select-${index}`}
                                      label="Efecto"
                                      value={(payload.effectId as string) || ''}
                                      onChange={(event) => updateAction(index, {
                                        ...action,
                                        payload: { ...payload, effectId: event.target.value },
                                      })}
                                    >
                                      {effectOptions.map((effect) => (
                                        <MenuItem key={effect.value} value={effect.value}>{effect.label}</MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                  <TextField
                                    type="number"
                                    label="Volumen"
                                    inputProps={{ min: 0, max: 1, step: 0.1 }}
                                    value={String(payload.volume ?? 1)}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, volume: Number(event.target.value) },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                  <FormControl fullWidth>
                                    <InputLabel id={`loop-mode-${index}`}>Bucle</InputLabel>
                                    <Select
                                      labelId={`loop-mode-${index}`}
                                      label="Bucle"
                                      value={(payload.loopMode as string) || 'once'}
                                      onChange={(event) => updateAction(index, {
                                        ...action,
                                        payload: { ...payload, loopMode: event.target.value },
                                      })}
                                    >
                                      <MenuItem value="once">Una vez</MenuItem>
                                      <MenuItem value="continuous">Continuo</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'audio.playSong' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12 }}>
                                  <Autocomplete
                                    options={availableSongs}
                                    value={availableSongs.find((song) => song.id === (payload.songId as string)) || null}
                                    getOptionLabel={(option) => option.name}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    groupBy={(option) => getSongGroupLabel(option)}
                                    onChange={(_, selected) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, songId: selected?.id || '' },
                                    })}
                                    renderOption={(props, option) => (
                                      <Box component="li" {...props}>
                                        <Stack spacing={0.25}>
                                          <Typography variant="body2">{option.name}</Typography>
                                          {getSongSecondaryLabel(option) ? (
                                            <Typography variant="caption" color="text.secondary">
                                              {getSongSecondaryLabel(option)}
                                            </Typography>
                                          ) : null}
                                        </Stack>
                                      </Box>
                                    )}
                                    renderInput={(params) => <TextField {...params} label="Cancion" placeholder="Buscar cancion" fullWidth />}
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'audio.playPlaylist' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12 }}>
                                  <Autocomplete
                                    options={availablePlaylists}
                                    value={availablePlaylists.find((playlist) => playlist.id === (payload.playlistId as string)) || null}
                                    getOptionLabel={(option) => option.name}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    groupBy={(option) => getPlaylistGroupLabel(option)}
                                    onChange={(_, selected) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, playlistId: selected?.id || '' },
                                    })}
                                    renderOption={(props, option) => (
                                      <Box component="li" {...props}>
                                        <Stack spacing={0.25}>
                                          <Typography variant="body2">{option.name}</Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {(option.songs?.length || 0)} canciones
                                          </Typography>
                                        </Stack>
                                      </Box>
                                    )}
                                    renderInput={(params) => <TextField {...params} label="Playlist" placeholder="Buscar playlist" fullWidth />}
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'audio.playPresetEffects' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12 }}>
                                  <Autocomplete
                                    options={availablePresets}
                                    value={availablePresets.find((preset) => preset.id === (payload.presetId as string)) || null}
                                    getOptionLabel={(option) => option.name}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    onChange={(_, selected) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, presetId: selected?.id || '' },
                                    })}
                                    renderInput={(params) => <TextField {...params} label="Preset SFX" placeholder="Buscar preset" fullWidth />}
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {(action.kind === 'audio.setVolume' || action.kind === 'audio.adjustVolume') ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <TextField
                                    type="number"
                                    label={action.kind === 'audio.setVolume' ? 'Volumen (0..1)' : 'Delta volumen (-1..1)'}
                                    inputProps={{ min: action.kind === 'audio.setVolume' ? 0 : -1, max: 1, step: 0.05 }}
                                    value={String(payload.value ?? (action.kind === 'audio.setVolume' ? 1 : 0.1))}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, value: Number(event.target.value) },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'audio.setMute' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <FormControl fullWidth>
                                    <InputLabel id={`mute-select-${index}`}>Mute</InputLabel>
                                    <Select
                                      labelId={`mute-select-${index}`}
                                      label="Mute"
                                      value={String(Boolean(payload.muted))}
                                      onChange={(event) => updateAction(index, {
                                        ...action,
                                        payload: { ...payload, muted: event.target.value === 'true' },
                                      })}
                                    >
                                      <MenuItem value="true">Silenciar</MenuItem>
                                      <MenuItem value="false">Activar sonido</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'time.setMoment' ? (
                              <FormControl fullWidth>
                                <InputLabel id={`moment-select-${index}`}>Momento</InputLabel>
                                <Select
                                  labelId={`moment-select-${index}`}
                                  label="Momento"
                                  value={(payload.value as string) || 'morning'}
                                  onChange={(event) => updateAction(index, {
                                    ...action,
                                    payload: { ...payload, value: event.target.value },
                                  })}
                                >
                                  <MenuItem value="dawn">Amanecer</MenuItem>
                                  <MenuItem value="morning">Mañana</MenuItem>
                                  <MenuItem value="afternoon">Tarde</MenuItem>
                                  <MenuItem value="night">Noche</MenuItem>
                                  <MenuItem value="midnight">Madrugada</MenuItem>
                                </Select>
                              </FormControl>
                            ) : null}

                            {(action.kind === 'time.advanceDay' || action.kind === 'time.rewindDay') ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <TextField
                                    type="number"
                                    label="Días"
                                    inputProps={{ min: 1, step: 1 }}
                                    value={String(payload.amount ?? 1)}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, amount: Math.max(1, Number(event.target.value) || 1) },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'window.showText' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <TextField
                                    label="Título"
                                    value={(payload.title as string) || ''}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, title: event.target.value },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <TextField
                                    label="Texto"
                                    value={(payload.text as string) || ''}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, text: event.target.value },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, md: 2 }}>
                                  <TextField
                                    type="number"
                                    label="Duración (ms)"
                                    value={String(payload.durationMs ?? 4000)}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, durationMs: Number(event.target.value) },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'window.applyFilter' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <FormControl fullWidth>
                                    <InputLabel id={`filter-kind-${index}`}>Filtro</InputLabel>
                                    <Select
                                      labelId={`filter-kind-${index}`}
                                      label="Filtro"
                                      value={(payload.filter as string) || 'grayscale'}
                                      onChange={(event) => updateAction(index, {
                                        ...action,
                                        payload: { ...payload, filter: event.target.value },
                                      })}
                                    >
                                      <MenuItem value="grayscale">Grayscale</MenuItem>
                                      <MenuItem value="sepia">Sepia</MenuItem>
                                      <MenuItem value="blur">Blur</MenuItem>
                                      <MenuItem value="brightness">Brightness</MenuItem>
                                      <MenuItem value="contrast">Contrast</MenuItem>
                                      <MenuItem value="saturate">Saturate</MenuItem>
                                      <MenuItem value="hue">Hue Rotate</MenuItem>
                                      <MenuItem value="invert">Invert</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                  <TextField
                                    type="number"
                                    label="Intensidad"
                                    inputProps={{ min: 0, max: 1, step: 0.05 }}
                                    value={String(payload.intensity ?? 0.7)}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, intensity: Number(event.target.value) },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                  <TextField
                                    type="color"
                                    label="Color"
                                    value={((payload.color as string) || '#00000033').slice(0, 7)}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, color: event.target.value },
                                    })}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, md: 2 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Usa intensidad entre 0 y 1 para controlar el efecto.
                                  </Typography>
                                </Grid>
                              </Grid>
                            ) : null}

                            {(action.kind === 'window.showCharacterImage' || action.kind === 'window.showNpcImage' || action.kind === 'window.showMonsterImage') ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 8 }}>
                                  <Autocomplete
                                    options={(action.kind === 'window.showMonsterImage' ? availableMonsters : action.kind === 'window.showNpcImage' ? availableNpcs : availableCharacters)
                                      .filter((entity) => Boolean(entity.id))}
                                    value={(
                                      (action.kind === 'window.showMonsterImage' ? availableMonsters : action.kind === 'window.showNpcImage' ? availableNpcs : availableCharacters)
                                        .find((entity) => entity.id === (payload.entityId as string))
                                      || null
                                    ) as any}
                                    getOptionLabel={(option: any) => option.name || option.id || ''}
                                    isOptionEqualToValue={(option: any, value: any) => option.id === value.id}
                                    groupBy={(option: any) => (
                                      action.kind === 'window.showMonsterImage'
                                        ? MONSTER_ORIGIN_LABEL[(option.origin as CampaignMonsterListItem['origin']) || 'homebrew'] || 'Otro'
                                        : 'Personajes de campana'
                                    )}
                                    onChange={(_, selected: any) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, entityId: selected?.id || '' },
                                    })}
                                    renderOption={(props, option: any) => (
                                      <Box component="li" {...props}>
                                        <Stack spacing={0.25}>
                                          <Typography variant="body2">{option.name || option.id}</Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {action.kind === 'window.showMonsterImage'
                                              ? getMonsterSecondaryLabel(option as CampaignMonsterListItem)
                                              : getCharacterSecondaryLabel(option as CharacterPayload)}
                                          </Typography>
                                        </Stack>
                                      </Box>
                                    )}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label={action.kind === 'window.showMonsterImage' ? 'Monstruo' : action.kind === 'window.showNpcImage' ? 'NPC' : 'Personaje'}
                                        placeholder="Buscar por nombre"
                                        fullWidth
                                      />
                                    )}
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <TextField
                                    type="number"
                                    label="Duración (ms)"
                                    value={String(payload.durationMs ?? 8000)}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, durationMs: Number(event.target.value) },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {action.kind === 'window.showMonsterImage'
                                      ? 'Selecciona un monstruo del bestiario de campaña.'
                                      : action.kind === 'window.showNpcImage'
                                        ? 'Selecciona un NPC de la campaña.'
                                        : 'Selecciona un personaje jugador de la campaña.'}
                                  </Typography>
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'window.setActiveMap' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12 }}>
                                  <Autocomplete
                                    options={availableMaps}
                                    value={availableMaps.find((map) => map.id === (payload.mapId as string)) || null}
                                    getOptionLabel={(option) => option.name}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    groupBy={(option) => getMapGroupLabel(option)}
                                    onChange={(_, selected) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, mapId: selected?.id || '' },
                                    })}
                                    renderOption={(props, option) => (
                                      <Box component="li" {...props}>
                                        <Stack spacing={0.25}>
                                          <Typography variant="body2">{option.name}</Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {option.timeOfDay ? `Momento: ${option.timeOfDay}` : 'Sin momento definido'}
                                          </Typography>
                                        </Stack>
                                      </Box>
                                    )}
                                    renderInput={(params) => <TextField {...params} label="Mapa" placeholder="Buscar mapa" fullWidth />}
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'config.setLanguage' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <FormControl fullWidth>
                                    <InputLabel id={`lang-select-${index}`}>Idioma</InputLabel>
                                    <Select
                                      labelId={`lang-select-${index}`}
                                      label="Idioma"
                                      value={(payload.language as string) || 'es'}
                                      onChange={(event) => updateAction(index, {
                                        ...action,
                                        payload: { ...payload, language: event.target.value },
                                      })}
                                    >
                                      <MenuItem value="es">Español</MenuItem>
                                      <MenuItem value="en">English</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'config.setTheme' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <FormControl fullWidth>
                                    <InputLabel id={`theme-select-${index}`}>Tema</InputLabel>
                                    <Select
                                      labelId={`theme-select-${index}`}
                                      label="Tema"
                                      value={(payload.theme as string) || 'dark'}
                                      onChange={(event) => updateAction(index, {
                                        ...action,
                                        payload: { ...payload, theme: event.target.value },
                                      })}
                                    >
                                      <MenuItem value="light">Light</MenuItem>
                                      <MenuItem value="dark">Dark</MenuItem>
                                      <MenuItem value="custom">Custom</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'config.setFontScale' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <TextField
                                    type="number"
                                    label="Escala fuente"
                                    inputProps={{ min: 0.7, max: 1.8, step: 0.05 }}
                                    value={String(payload.scale ?? 1)}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, scale: Number(event.target.value) },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'config.updateSettings' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 5 }}>
                                  <TextField
                                    label="Clave"
                                    value={(payload.key as string) || ''}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, key: event.target.value },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, md: 7 }}>
                                  <TextField
                                    label="Valor"
                                    value={String(payload.value ?? '')}
                                    onChange={(event) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, value: event.target.value },
                                    })}
                                    fullWidth
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {(action.kind === 'audio.pause' || action.kind === 'audio.resume' || action.kind === 'audio.stop' || action.kind === 'window.clearFilter' || action.kind === 'time.advanceMoment' || action.kind === 'time.rewindMoment' || action.kind === 'combat.start' || action.kind === 'combat.escape' || action.kind === 'combat.end' || action.kind === 'combat.nextTurn' || action.kind === 'combat.previousTurn' || action.kind === 'toggleState') ? (
                              <Typography variant="caption" color="text.secondary">
                                Esta acción no requiere parámetros adicionales.
                              </Typography>
                            ) : null}

                            {action.kind === 'runScene' ? (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12 }}>
                                  <Autocomplete
                                    options={availableScenes}
                                    value={availableScenes.find((scene) => scene.id === (payload.sceneId as string)) || null}
                                    getOptionLabel={(option) => option.name}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    onChange={(_, selected) => updateAction(index, {
                                      ...action,
                                      payload: { ...payload, sceneId: selected?.id || '' },
                                    })}
                                    renderOption={(props, option) => (
                                      <Box component="li" {...props}>
                                        <Stack spacing={0.25}>
                                          <Typography variant="body2">{option.name}</Typography>
                                          {option.description ? (
                                            <Typography variant="caption" color="text.secondary">
                                              {option.description}
                                            </Typography>
                                          ) : null}
                                        </Stack>
                                      </Box>
                                    )}
                                    renderInput={(params) => <TextField {...params} label="Escena" placeholder="Buscar escena" fullWidth />}
                                  />
                                </Grid>
                              </Grid>
                            ) : null}

                            {action.kind === 'delay.wait' ? (
                              <TextField
                                type="number"
                                label="Duración delay (ms)"
                                value={String(payload.durationMs ?? 1000)}
                                onChange={(event) => updateAction(index, {
                                  ...action,
                                  payload: { ...payload, durationMs: Number(event.target.value) },
                                })}
                                fullWidth
                              />
                            ) : null}
                          </Stack>
                        </SortableActionRow>
                      );
                    })}
                  </Stack>
                </SortableContext>
              </DndContext>
            </Stack>
          </Paper>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={<Checkbox checked={Boolean(draft.showOnHome)} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showOnHome: checked }))} />}
                label="Mostrar en Inicio"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={showInPanels}
                    onChange={(_, checked) => {
                      setDraft((prev) => ({
                        ...prev,
                        panelIds: checked
                          ? (prev.panelIds && prev.panelIds.length > 0 ? [prev.panelIds[0]] : [panels[0]?.id || 'base'])
                          : [],
                        showInSidebarPanel: checked,
                        showInHotbar: checked,
                      }));
                    }}
                  />
                )}
                label="Mostrar en paneles compartidos"
              />
            </Grid>
            {showInPanels ? (
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth>
                  <InputLabel id="panel-select-editor">Panel</InputLabel>
                  <Select
                    labelId="panel-select-editor"
                    label="Panel"
                    value={(draft.panelIds && draft.panelIds[0]) || ''}
                    onChange={(event) => {
                      const selected = String(event.target.value || '');
                      setDraft((prev) => ({
                        ...prev,
                        panelIds: selected ? [selected] : [],
                        showInSidebarPanel: Boolean(selected),
                        showInHotbar: Boolean(selected),
                      }));
                    }}
                  >
                    {panels.map((panel) => (
                      <MenuItem key={panel.id} value={panel.id}>{panel.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            ) : null}
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="outlined" onClick={handleTest} disabled={isTesting}>{isTesting ? 'Probando...' : 'Probar atajo'}</Button>
        <Button variant="contained" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShortcutEditor;
