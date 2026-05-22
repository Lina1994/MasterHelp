import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import AuthImage from '../common/AuthImage';
import type { Scene, SceneActionDto, ScenePayload } from '../../types/scenes';
import type { SceneVideoAsset } from '../../types/scenes';
import {
  createSceneVideoClip,
  createSceneVideoSignedUrl,
  deleteSceneVideo,
  getSceneVideoDerivationStatus,
  listSceneVideos,
  updateSceneVideo,
  uploadSceneVideo,
} from '../../api/sceneVideos';
import { getMapImageUrlSized } from '../../api/maps';
import { useActiveMap } from '../Map/ActiveMapContext';
import { useTimeOfDay } from '../player/TimeOfDayContext';
import { useSecondaryWindowSizes, type WindowSize } from '../../hooks/useSecondaryWindowSizes';
import SkylineViewportContent from '../Skyline/SkylineViewportContent';
import { buildTimeline } from './SceneTimelineEditor';
import useSceneVideoMemoryWarmup from '../../hooks/useSceneVideoMemoryWarmup';
import ShortcutThumbnailPreview from '../shortcuts/ShortcutThumbnailPreview';
import EmojiPickerDialog from '../shortcuts/EmojiPickerDialog';
import { uploadShortcutIcon } from '../../api/shortcuts';
import { WINDOW_ACTION_TYPES, SPLITTABLE_ACTION_TYPES } from './constants/actionTypes';
import { NARRATIVE_TOOL_STYLE_PRESETS } from './constants/narrativePresets';
import {
  SCENE_MAX_ACTIONS,
  PREVIEW_FPS,
  DERIVATION_POLL_INTERVAL_MS,
  DERIVATION_MAX_POLLS,
  toPositiveDurationMs,
  measureVideoDurationMs,
  toNonNegativeSec,
  waitMs,
  omitClipMetadata,
  emptyPayload,
  toVideoDragPayload,
  fromVideoDragPayload,
  defaultAction,
  blankDraft,
} from './utils/sceneEditorUtils';
import {
  type ScenePreviewWindowKind,
  readStoredWindowSize,
  snapPct,
  clampLayerMoveInsideStage,
  clampLayerSizeInsideStage,
  getPlacementFromPayload,
  normalizeActionForEditor,
  normalizeActionForSave,
  normalizeFreePlacement,
} from './utils/sceneLayerUtils';
import { useSceneDraft, useSceneVideoLibrary, useScenePreview, useSceneLayerDrag, type LeftToolPanelMode } from './hooks';
import { SceneToolsPanel, SceneInspectorPanel, SceneTimelinePanel, ScenePreviewPanel } from './panels';
import { ScenePreviewLayersRenderer } from './renderers';

const PROJECTION_SIZE_KEY = 'app.projection.size';
const SKYLINE_SIZE_KEY = 'app.projection.skyline.size';
const SCENE_EDITOR_MEMORY_WARMUP_KEY = 'app.sceneEditor.videoMemoryWarmup';

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
  const { activeMapId } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { mode: secondaryWindowMode, customSizes } = useSecondaryWindowSizes();
  const {
    draft,
    setDraft,
    saving,
    setSaving,
    error,
    setError,
    selectedActionId,
    setSelectedActionId,
    chromaPickActionId,
    setChromaPickActionId,
    dragOverActionId,
    setDragOverActionId,
    contextualMenu,
    setContextualMenu,
    leftToolPanelMode,
    setLeftToolPanelMode,
    narrativeCanvasEditActionId,
    setNarrativeCanvasEditActionId,
    narrativeCanvasDraft,
    setNarrativeCanvasDraft,
    iconPickerOpen,
    setIconPickerOpen,
    uploadingIcon,
    setUploadingIcon,
  } = useSceneDraft(campaignId);
  const {
    sceneVideoAssets,
    setSceneVideoAssets,
    loadingAssets,
    setLoadingAssets,
    uploadingVideo,
    setUploadingVideo,
    videoPreviewUrlsByActionId,
    setVideoPreviewUrlsByActionId,
    videoPreviewErrorsByActionId,
    setVideoPreviewErrorsByActionId,
    videoLibraryQuery,
    setVideoLibraryQuery,
    renamingVideoId,
    setRenamingVideoId,
    renamingVideoName,
    setRenamingVideoName,
    renamingVideoSubmitting,
    setRenamingVideoSubmitting,
    deletingVideoId,
    setDeletingVideoId,
    derivingClipActionId,
    setDerivingClipActionId,
    derivingClipErrorByActionId,
    setDerivingClipErrorByActionId,
    fileInputRef,
    signedVideoUrlCacheRef,
  } = useSceneVideoLibrary();
  const {
    previewWindowKind,
    setPreviewWindowKind,
    previewZoom,
    setPreviewZoom,
    isPreviewPlaying,
    setIsPreviewPlaying,
    isPreviewLooping,
    setIsPreviewLooping,
    previewLoopMode,
    setPreviewLoopMode,
    currentTimelineTimeMs,
    setCurrentTimelineTimeMs,
    previewSeekVersion,
    setPreviewSeekVersion,
    previewLoopCycleIndex,
    setPreviewLoopCycleIndex,
    projectionWindowSize,
    setProjectionWindowSize,
    skylineWindowSize,
    setSkylineWindowSize,
    isPreviewMemoryWarmupEnabled,
    setIsPreviewMemoryWarmupEnabled,
    previewStageRef,
  } = useScenePreview(SCENE_EDITOR_MEMORY_WARMUP_KEY);
  const iconFileInputRef = useRef<HTMLInputElement | null>(null);
  const { layerDragRef, activeLayerDragPlacement, setActiveLayerDragPlacement } = useSceneLayerDrag();

  // Fetch initial scene video assets when dialog opens
  useEffect(() => {
    if (!open) return;

    let active = true;
    const fetchVideos = async () => {
      setLoadingAssets(true);
      try {
        const assets = await listSceneVideos(campaignId ?? undefined);
        if (active) {
          setSceneVideoAssets(assets);
        }
      } catch (err: any) {
        console.error('Error fetching scene videos on mount:', err);
      } finally {
        if (active) {
          setLoadingAssets(false);
        }
      }
    };

    fetchVideos();

    return () => {
      active = false;
    };
  }, [open, campaignId, setSceneVideoAssets, setLoadingAssets]);

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const resolvedCampaignId = editing.campaignId ?? ((editing as unknown as { campaign?: { id?: string | null } }).campaign?.id ?? null);
      // Aquí iría la lógica de inicialización del draft si es necesario
      return;
    }
    setSelectedActionId(draft.actions[0]?.id ?? null);
  }, [draft.actions, selectedActionId, open, editing]);

  useEffect(() => {
    if (!open) return;

    const syncFromStorage = () => {
      setProjectionWindowSize(readStoredWindowSize(PROJECTION_SIZE_KEY));
      setSkylineWindowSize(readStoredWindowSize(SKYLINE_SIZE_KEY));
    };

    syncFromStorage();

    const onStorage = (event: StorageEvent) => {
      if (event.key === PROJECTION_SIZE_KEY || event.key === SKYLINE_SIZE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(syncFromStorage, 1200);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem(SCENE_EDITOR_MEMORY_WARMUP_KEY, isPreviewMemoryWarmupEnabled ? 'on' : 'off');
    } catch {
      // Ignore localStorage write failures in restricted environments.
    }
  }, [isPreviewMemoryWarmupEnabled]);

  useEffect(() => {
    if (!selectedActionId && chromaPickActionId) {
      setChromaPickActionId(null);
      return;
    }
    if (chromaPickActionId && chromaPickActionId !== selectedActionId) {
      setChromaPickActionId(null);
    }
  }, [selectedActionId, chromaPickActionId]);

  useEffect(() => {
    if (!narrativeCanvasEditActionId) return;
    if (!selectedActionId || selectedActionId !== narrativeCanvasEditActionId) {
      setNarrativeCanvasEditActionId(null);
      setNarrativeCanvasDraft(null);
      return;
    }
    const active = draft.actions.find((action) => action.id === narrativeCanvasEditActionId);
    if (!active || active.type !== 'setNarrativeText') {
      setNarrativeCanvasEditActionId(null);
      setNarrativeCanvasDraft(null);
    }
  }, [selectedActionId, narrativeCanvasEditActionId, draft.actions]);

  const timelineModel = useMemo(() => buildTimeline(draft.actions), [draft.actions]);
  const timelineEntriesByActionId = useMemo(() => {
    const map = new Map<string, { startMs: number; endMs: number; durationMs: number }>();
    for (const entry of timelineModel.entries) {
      map.set(entry.actionId, {
        startMs: entry.startMs,
        endMs: entry.endMs,
        durationMs: entry.durationMs,
      });
    }
    return map;
  }, [timelineModel.entries]);
  const timelineDurationMs = timelineModel.totalMs;
  const hasValidLoopWindow = useMemo(() => {
    const startMs = Number(draft.loopWindowStartMs);
    const endMs = Number(draft.loopWindowEndMs);
    return Boolean(
      draft.loop
      && Number.isFinite(startMs)
      && Number.isFinite(endMs)
      && startMs >= 0
      && endMs > startMs,
    );
  }, [draft.loop, draft.loopWindowEndMs, draft.loopWindowStartMs]);
  const effectivePreviewLoopMode = previewLoopMode === 'partial' && hasValidLoopWindow ? 'partial' : 'full';
  const previewLoopWindow = useMemo(() => {
    if (effectivePreviewLoopMode !== 'partial' || !hasValidLoopWindow) return null;

    const startMs = Math.max(0, Math.round(Number(draft.loopWindowStartMs ?? 0)));
    const endMs = Math.min(
      timelineDurationMs,
      Math.max(startMs + 1, Math.round(Number(draft.loopWindowEndMs ?? timelineDurationMs))),
    );
    if (endMs <= startMs) return null;

    return {
      startMs,
      endMs,
      durationMs: endMs - startMs,
    };
  }, [effectivePreviewLoopMode, hasValidLoopWindow, draft.loopWindowStartMs, draft.loopWindowEndMs, timelineDurationMs]);

  useEffect(() => {
    if (!open || !draft.loop) return;
    if (hasValidLoopWindow) return;
    if (!Number.isFinite(timelineDurationMs) || timelineDurationMs <= 0) return;

    setDraft((currentDraft) => {
      if (!currentDraft.loop) return currentDraft;
      const startMs = Number(currentDraft.loopWindowStartMs);
      const endMs = Number(currentDraft.loopWindowEndMs);
      const alreadyValid = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs >= 0 && endMs > startMs;
      if (alreadyValid) return currentDraft;
      return {
        ...currentDraft,
        loopWindowStartMs: 0,
        loopWindowEndMs: Math.max(1, Math.round(timelineDurationMs)),
      };
    });
  }, [open, draft.loop, hasValidLoopWindow, timelineDurationMs]);

  useEffect(() => {
    if (!open) {
      setIsPreviewPlaying(false);
      setCurrentTimelineTimeMs(0);
      setPreviewLoopCycleIndex(0);
      return;
    }
    setCurrentTimelineTimeMs((current) => Math.max(0, Math.min(timelineDurationMs, current)));
  }, [open, timelineDurationMs]);

  useEffect(() => {
    if (!open) return;
    setPreviewLoopCycleIndex(0);
  }, [open, editing?.id, effectivePreviewLoopMode]);

  useEffect(() => {
    if (!open || !isPreviewPlaying) return;

    let rafId = 0;
    let lastFrame = performance.now();

    const step = (now: number) => {
      const delta = now - lastFrame;
      lastFrame = now;
      setCurrentTimelineTimeMs((current) => {
        const next = current + delta;
        if (next >= timelineDurationMs) {
          if (isPreviewLooping && timelineDurationMs > 0) {
            if (previewLoopWindow) {
              const overflowMs = Math.max(0, next - timelineDurationMs);
              setPreviewLoopCycleIndex((cycle) => Math.max(1, cycle + 1));
              setPreviewSeekVersion((version) => version + 1);
              return previewLoopWindow.startMs + (overflowMs % previewLoopWindow.durationMs);
            }
            return next % timelineDurationMs;
          }
          setIsPreviewPlaying(false);
          return timelineDurationMs;
        }

        if (isPreviewLooping && previewLoopWindow && previewLoopCycleIndex > 0) {
          if (next < previewLoopWindow.startMs) {
            return previewLoopWindow.startMs;
          }
          if (next >= previewLoopWindow.endMs) {
            return previewLoopWindow.startMs + ((next - previewLoopWindow.startMs) % previewLoopWindow.durationMs);
          }
        }
        return next;
      });
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    isPreviewPlaying,
    isPreviewLooping,
    open,
    timelineDurationMs,
    previewLoopWindow,
    previewLoopCycleIndex,
  ]);

  useEffect(() => {
    if (!open) return;

    const isTextInputTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || Boolean(target.isContentEditable);
    };

    const frameStepMs = 1000 / PREVIEW_FPS;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) return;
      if (narrativeCanvasEditActionId) return;

      if (event.code === 'Space') {
        event.preventDefault();
        setIsPreviewPlaying((playing) => !playing);
        return;
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault();
        setIsPreviewPlaying(false);
        setCurrentTimelineTimeMs((current) => Math.min(timelineDurationMs, current + (event.shiftKey ? frameStepMs * 5 : frameStepMs)));
        return;
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        setIsPreviewPlaying(false);
        setCurrentTimelineTimeMs((current) => Math.max(0, current - (event.shiftKey ? frameStepMs * 5 : frameStepMs)));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, timelineDurationMs, narrativeCanvasEditActionId]);

  const set = <K extends keyof ScenePayload>(key: K, value: ScenePayload[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const loopDelayMode = useMemo<'immediate' | 'fixed' | 'random'>(() => {
    if ((draft.loopDelayRandomMinMs ?? null) !== null || (draft.loopDelayRandomMaxMs ?? null) !== null) {
      return 'random';
    }
    if ((draft.loopDelayMs ?? null) !== null) {
      return 'fixed';
    }
    return 'immediate';
  }, [draft.loopDelayMs, draft.loopDelayRandomMaxMs, draft.loopDelayRandomMinMs]);

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

  const updateActionById = (actionId: string, updater: (action: SceneActionDto) => SceneActionDto) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((action) => (action.id === actionId ? updater(action) : action)),
    }));
  };

  const beginNarrativeCanvasEdit = (action: SceneActionDto) => {
    if (action.type !== 'setNarrativeText') return;
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const textAlignRaw = String(payload.textAlign ?? 'left').trim();
    const textAlign: 'left' | 'center' | 'right' | 'justify' =
      textAlignRaw === 'center' || textAlignRaw === 'right' || textAlignRaw === 'justify'
        ? textAlignRaw
        : 'left';
    setNarrativeCanvasEditActionId(action.id);
    setNarrativeCanvasDraft({
      title: String(payload.title ?? ''),
      text: String(payload.text ?? ''),
      fontSizePx: Number.isFinite(Number(payload.fontSizePx)) ? Math.max(8, Math.min(220, Number(payload.fontSizePx))) : 28,
      fontColor: String(payload.fontColor ?? '#ffffff').trim() || '#ffffff',
      textAlign,
      fontWeight: String(payload.fontWeight ?? 'normal').trim() === 'bold' ? 'bold' : 'normal',
      fontStyle: String(payload.fontStyle ?? 'normal').trim() === 'italic' ? 'italic' : 'normal',
      textDecoration: String(payload.textDecoration ?? 'none').trim() === 'underline' ? 'underline' : 'none',
    });
    setIsPreviewPlaying(false);
  };

  const createNarrativeActionAndStartEdit = (presetPatch?: Record<string, unknown>) => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;

    const basePayload = emptyPayload('setNarrativeText');
    const payload = {
      ...basePayload,
      ...(presetPatch ?? {}),
    } as Record<string, unknown>;

    const next: SceneActionDto = {
      id: uuidv4(),
      type: 'setNarrativeText',
      delay: 0,
      payload,
    };

    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
    setLeftToolPanelMode('text');
    setContextualMenu(null);
    beginNarrativeCanvasEdit(next);
  };

  const finishNarrativeCanvasEdit = (mode: 'save' | 'cancel') => {
    if (!narrativeCanvasEditActionId) return;
    if (mode === 'save' && narrativeCanvasDraft) {
      const title = narrativeCanvasDraft.title.trim();
      const text = narrativeCanvasDraft.text;
      updateActionById(narrativeCanvasEditActionId, (action) => ({
        ...action,
        payload: {
          ...(action.payload ?? {}),
          text,
          ...(title ? { title } : { title: '' }),
          fontSizePx: narrativeCanvasDraft.fontSizePx,
          fontColor: narrativeCanvasDraft.fontColor,
          textAlign: narrativeCanvasDraft.textAlign,
          fontWeight: narrativeCanvasDraft.fontWeight,
          fontStyle: narrativeCanvasDraft.fontStyle,
          textDecoration: narrativeCanvasDraft.textDecoration,
        },
      }));
    }
    setNarrativeCanvasEditActionId(null);
    setNarrativeCanvasDraft(null);
  };

  const removeAction = (index: number) => {
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, i) => i !== index) }));
  };

  const handleSelectActionFromTimeline = (actionId: string) => {
    selectActionAndSeekToStart(actionId);
  };

  const handleChangeActionType = (index: number, type: string) => {
    updateAction(index, { ...draft.actions[index], type, payload: emptyPayload(type) });
  };

  const handleSave = async () => {
    if (!draft.name.trim()) { setError('El nombre es obligatorio.'); return; }
    const contextCampaignId = draft.campaignId
      ?? campaignId
      ?? editing?.campaignId
      ?? ((editing as unknown as { campaign?: { id?: string | null } })?.campaign?.id ?? null);

    const resolvedScope = draft.scope === 'campaign' && !contextCampaignId
      ? 'global'
      : draft.scope;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...draft,
        scope: resolvedScope,
        campaignId: resolvedScope === 'campaign' ? contextCampaignId : null,
        actions: draft.actions.map(normalizeActionForSave),
      }, editing?.id);
      onClose();
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const message = Array.isArray(backendMessage)
        ? backendMessage.join(' | ')
        : backendMessage;
      setError(message ?? err?.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadVideoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePickEmoji = (emoji: string) => {
    setDraft((d) => ({
      ...d,
      icon: emoji || null,
      imageUrl: null,
    }));
  };

  const handleUploadSceneIconClick = () => {
    iconFileInputRef.current?.click();
  };

  const handleIconFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingIcon(true);
    try {
      const iconUrl = await uploadShortcutIcon(file);
      setDraft((d) => ({ ...d, imageUrl: iconUrl, icon: null }));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al subir el icono.');
    } finally {
      setUploadingIcon(false);
      if (event.target) event.target.value = '';
    }
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

  const handleStartRenameVideo = (asset: SceneVideoAsset) => {
    setRenamingVideoId(asset.id);
    setRenamingVideoName(asset.name);
  };

  const handleCancelRenameVideo = () => {
    setRenamingVideoId(null);
    setRenamingVideoName('');
  };

  const handleConfirmRenameVideo = async (assetId: string) => {
    const nextName = renamingVideoName.trim();
    if (!nextName) {
      setError('El nombre del video no puede estar vacio.');
      return;
    }

    setRenamingVideoSubmitting(true);
    try {
      await updateSceneVideo(assetId, { name: nextName });
      const refreshed = await listSceneVideos(campaignId ?? undefined);
      setSceneVideoAssets(refreshed);
      setRenamingVideoId(null);
      setRenamingVideoName('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al renombrar video.');
    } finally {
      setRenamingVideoSubmitting(false);
    }
  };

  const handleDeleteVideoAsset = async (asset: SceneVideoAsset) => {
    const confirmed = window.confirm(`Â¿Eliminar el video "${asset.name}"?`);
    if (!confirmed) return;

    setDeletingVideoId(asset.id);
    try {
      await deleteSceneVideo(asset.id);
      const refreshed = await listSceneVideos(campaignId ?? undefined);
      setSceneVideoAssets(refreshed);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al eliminar video.');
    } finally {
      setDeletingVideoId(null);
    }
  };

  const handleCreateImageAction = useCallback((image: { url: string; label: string }) => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    const next: SceneActionDto = {
      id: uuidv4(),
      type: 'sendImageToWindow',
      delay: 0,
      targetWindow: { kind: 'projection' },
      payload: {
        ...emptyPayload('sendImageToWindow'),
        imageUrl: image.url,
        imageAssetName: image.label,
      },
    };
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  }, [draft.actions.length, setDraft, setSelectedActionId]);

  const handleCreateFilterAction = useCallback((filterType: string) => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    const next: SceneActionDto = {
      id: uuidv4(),
      type: 'applyWindowFilter',
      delay: 0,
      targetWindow: { kind: 'projection' },
      payload: {
        ...emptyPayload('applyWindowFilter'),
        filter: filterType,
      },
    };
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  }, [draft.actions.length, setDraft, setSelectedActionId]);

  const handleCreateNarrativeFromPreset = useCallback((patch?: Record<string, unknown>) => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    createNarrativeActionAndStartEdit(patch);
  }, [createNarrativeActionAndStartEdit, draft.actions.length]);

  const selectedActionIndex = draft.actions.findIndex((action) => action.id === selectedActionId);
  const selectedAction = selectedActionIndex >= 0 ? draft.actions[selectedActionIndex] : null;
  const lockPreviewInteractionToSelectedNarrative = Boolean(
    selectedAction
    && selectedAction.type === 'setNarrativeText'
    && (leftToolPanelMode === 'text' || narrativeCanvasEditActionId === selectedAction.id),
  );
  const selectedPreviewGuidePlacement = useMemo(() => {
    if (!selectedAction) return null;
    if (!['sendImageToWindow', 'sendVideoToWindow', 'setNarrativeText'].includes(selectedAction.type)) {
      return null;
    }
    const payload = (selectedAction.payload ?? {}) as Record<string, unknown>;
    if (selectedAction.type === 'setNarrativeText') {
      const placement = getPlacementFromPayload(payload);
      return {
        actionId: selectedAction.id,
        leftPct: placement.leftPct,
        topPct: placement.topPct,
        widthPct: placement.widthPct,
        heightPct: placement.heightPct,
      };
    }

    return {
      actionId: selectedAction.id,
      leftPct: normalizeFreePlacement(payload.leftPct, 10),
      topPct: normalizeFreePlacement(payload.topPct, 10),
      widthPct: Math.max(1, normalizeFreePlacement(payload.widthPct, 80)),
      heightPct: Math.max(1, normalizeFreePlacement(payload.heightPct, 80)),
    };
  }, [selectedAction]);
  const activePreviewGuidePlacement = activeLayerDragPlacement
    && selectedActionId
    && activeLayerDragPlacement.actionId === selectedActionId
    ? activeLayerDragPlacement
    : selectedPreviewGuidePlacement;
  const selectedTimelineEntry = selectedAction ? timelineEntriesByActionId.get(selectedAction.id) : undefined;
  const canSplitSelectedAction = Boolean(
    selectedAction
    && selectedTimelineEntry
    && SPLITTABLE_ACTION_TYPES.has(selectedAction.type)
    && currentTimelineTimeMs > selectedTimelineEntry.startMs
    && currentTimelineTimeMs < selectedTimelineEntry.endMs,
  );
  const selectedClipDerivationCandidate = useMemo(() => {
    if (!selectedAction || selectedAction.type !== 'sendVideoToWindow' || !selectedTimelineEntry) return null;
    const payload = (selectedAction.payload ?? {}) as Record<string, unknown>;
    const videoAssetId = String(payload.videoAssetId ?? '').trim();
    if (!videoAssetId) return null;

    const sourceAssetName = String(payload.videoAssetName ?? 'Clip');
    const startSec = toNonNegativeSec(payload.clipInSec) ?? 0;
    const defaultEndSec = startSec + (selectedTimelineEntry.durationMs / 1000);
    const endSec = toNonNegativeSec(payload.clipOutSec) ?? defaultEndSec;
    if (!(endSec > startSec)) return null;

    return {
      actionId: selectedAction.id,
      videoAssetId,
      startSec,
      endSec,
      sourceAssetName,
    };
  }, [selectedAction, selectedTimelineEntry]);
  const canCreateDerivedClip = Boolean(selectedClipDerivationCandidate && !derivingClipActionId);
  const canJoinSelectedWithNext = useMemo(() => {
    if (!selectedAction || selectedActionIndex < 0) return false;
    const nextAction = draft.actions[selectedActionIndex + 1];
    if (!nextAction) return false;
    if (selectedAction.type !== nextAction.type) return false;

    const currentPayload = (selectedAction.payload ?? {}) as Record<string, unknown>;
    const nextPayload = (nextAction.payload ?? {}) as Record<string, unknown>;
    const currentGroupId = typeof currentPayload.splitGroupId === 'string' ? currentPayload.splitGroupId : '';
    const nextGroupId = typeof nextPayload.splitGroupId === 'string' ? nextPayload.splitGroupId : '';
    if (!currentGroupId || currentGroupId !== nextGroupId) return false;

    const currentEntry = timelineEntriesByActionId.get(selectedAction.id);
    const nextEntry = timelineEntriesByActionId.get(nextAction.id);
    if (!currentEntry || !nextEntry) return false;
    if (Math.abs(nextEntry.startMs - currentEntry.endMs) > 50) return false;

    const sameTargetWindow = JSON.stringify(selectedAction.targetWindow ?? null) === JSON.stringify(nextAction.targetWindow ?? null);
    if (!sameTargetWindow) return false;

    return JSON.stringify(omitClipMetadata(currentPayload)) === JSON.stringify(omitClipMetadata(nextPayload));
  }, [draft.actions, selectedAction, selectedActionIndex, timelineEntriesByActionId]);
  const filteredSceneVideoAssets = useMemo(() => {
    const query = videoLibraryQuery.trim().toLowerCase();
    if (!query) return sceneVideoAssets;
    return sceneVideoAssets.filter((asset) => {
      const haystack = `${asset.name} ${asset.originalFilename}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [sceneVideoAssets, videoLibraryQuery]);
  const videoActionSources = useMemo(() => {
    return draft.actions
      .filter((action) => action.type === 'sendVideoToWindow')
      .map((action) => {
        const payload = (action.payload ?? {}) as Record<string, unknown>;
        const directVideoUrl = String(payload.videoUrl ?? '').trim();
        const videoAssetId = String(payload.videoAssetId ?? '').trim();
        return {
          actionId: action.id,
          directVideoUrl,
          videoAssetId,
        };
      });
  }, [draft.actions]);
  const prioritizedVideoActionIds = useMemo(() => {
    const ids = videoActionSources.map((source) => source.actionId);
    if (!selectedActionId || !ids.includes(selectedActionId)) {
      return ids;
    }
    return [selectedActionId, ...ids.filter((id) => id !== selectedActionId)];
  }, [selectedActionId, videoActionSources]);
  const {
    resolvedUrlsByActionId: previewMediaUrlsByActionId,
    warmedActionCount,
    targetedActionCount,
  } = useSceneVideoMemoryWarmup({
    open,
    enabled: isPreviewMemoryWarmupEnabled,
    urlsByActionId: videoPreviewUrlsByActionId,
    prioritizedActionIds: prioritizedVideoActionIds,
  });

  const createVideoActionFromAsset = (assetId: string): SceneActionDto => {
    const asset = sceneVideoAssets.find((item) => item.id === assetId);
    const assetDurationMs = toPositiveDurationMs(asset?.durationMs);
    return {
      id: uuidv4(),
      type: 'sendVideoToWindow',
      delay: 0,
      targetWindow: { kind: 'projection' },
      payload: {
        videoAssetId: assetId,
        loop: false,
        muted: false,
        opacity: 1,
        leftPct: 10,
        topPct: 10,
        widthPct: 80,
        heightPct: 80,
        ...(asset?.name ? { videoAssetName: asset.name } : {}),
        ...(assetDurationMs !== undefined ? { durationMs: assetDurationMs } : {}),
      },
    };
  };

  const assignVideoAssetToAction = (action: SceneActionDto, assetId: string): SceneActionDto => {
    const asset = sceneVideoAssets.find((item) => item.id === assetId);
    const assetDurationMs = toPositiveDurationMs(asset?.durationMs);
    const payload = { ...(action.payload ?? {}), videoAssetId: assetId } as Record<string, unknown>;
    delete payload.videoUrl;
    if (asset?.name) {
      payload.videoAssetName = asset.name;
    }
    if (assetDurationMs !== undefined) {
      payload.durationMs = assetDurationMs;
    }
    return { ...action, payload };
  };

  useEffect(() => {
    if (!open || sceneVideoAssets.length === 0) return;

    const metadataByAssetId = new Map<string, { durationMs?: number; name?: string }>();
    for (const asset of sceneVideoAssets) {
      const durationMs = toPositiveDurationMs(asset.durationMs);
      metadataByAssetId.set(asset.id, {
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(asset.name ? { name: asset.name } : {}),
      });
    }
    if (metadataByAssetId.size === 0) return;

    setDraft((currentDraft) => {
      let changed = false;
      const nextActions = currentDraft.actions.map((action) => {
        if (action.type !== 'sendVideoToWindow') return action;
        const payload = (action.payload ?? {}) as Record<string, unknown>;
        const assetId = String(payload.videoAssetId ?? '').trim();
        if (!assetId) return action;
        const metadata = metadataByAssetId.get(assetId);
        if (!metadata) return action;

        const currentDurationMs = toPositiveDurationMs(payload.durationMs);
        const currentAssetName = typeof payload.videoAssetName === 'string' ? payload.videoAssetName.trim() : '';
        const expectedDurationMs = metadata.durationMs;
        const expectedAssetName = metadata.name ?? '';

        const durationChanged = expectedDurationMs !== undefined && currentDurationMs !== expectedDurationMs;
        const nameChanged = expectedAssetName !== '' && currentAssetName !== expectedAssetName;
        if (!durationChanged && !nameChanged) return action;

        changed = true;
        return {
          ...action,
          payload: {
            ...payload,
            ...(durationChanged ? { durationMs: expectedDurationMs } : {}),
            ...(nameChanged ? { videoAssetName: expectedAssetName } : {}),
          },
        };
      });

      return changed ? { ...currentDraft, actions: nextActions } : currentDraft;
    });
  }, [open, sceneVideoAssets]);

  useEffect(() => {
    if (!open) return;

    const pendingActions = draft.actions.filter((action) => {
      if (action.type !== 'sendVideoToWindow') return false;
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      if (toPositiveDurationMs(payload.durationMs) !== undefined) return false;
      return Boolean(previewMediaUrlsByActionId[action.id]);
    });

    if (pendingActions.length === 0) return;

    let cancelled = false;

    const syncDurations = async () => {
      const measuredByActionId = new Map<string, number>();
      for (const action of pendingActions) {
        const url = previewMediaUrlsByActionId[action.id];
        if (!url) continue;
        const durationMs = await measureVideoDurationMs(url);
        if (cancelled || durationMs === undefined) continue;
        measuredByActionId.set(action.id, durationMs);
      }

      if (cancelled || measuredByActionId.size === 0) return;

      setDraft((currentDraft) => {
        let changed = false;
        const nextActions = currentDraft.actions.map((action) => {
          const measuredDurationMs = measuredByActionId.get(action.id);
          if (!measuredDurationMs || action.type !== 'sendVideoToWindow') return action;
          const payload = (action.payload ?? {}) as Record<string, unknown>;
          if (toPositiveDurationMs(payload.durationMs) !== undefined) return action;
          changed = true;
          return {
            ...action,
            payload: {
              ...payload,
              durationMs: measuredDurationMs,
            },
          };
        });
        return changed ? { ...currentDraft, actions: nextActions } : currentDraft;
      });
    };

    syncDurations();
    return () => {
      cancelled = true;
    };
  }, [open, draft.actions, previewMediaUrlsByActionId]);


  /**
   * Nuevo: handler para drop contextualizado en pista/ventana del timeline.
   * info: { trackKey, startMs, clientX, clientY }
   */
  const handleDropAssetOnTimeline = (info: { assetId: string; trackKey: string; startMs: number; clientX: number; clientY: number }) => {
    if (!info.assetId) return;
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;
    // Determinar ventana a partir de trackKey
    let windowKind: ScenePreviewWindowKind = 'projection';
    if (info.trackKey.startsWith('window.')) {
      const k = info.trackKey.split('.')[1];
      if (k === 'main' || k === 'projection' || k === 'skyline') windowKind = k;
    }
    const next = {
      ...createVideoActionFromAsset(info.assetId),
      targetWindow: { kind: windowKind },
      payload: {
        ...createVideoActionFromAsset(info.assetId).payload,
        timelineStartMs: info.startMs,
      },
    };
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  };

  const createActionByDroppingVideoAsset = (assetId: string) => {
    if (!assetId || draft.actions.length >= SCENE_MAX_ACTIONS) return;
    const next = createVideoActionFromAsset(assetId);
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  };

  const handleDropVideoAsset: React.DragEventHandler<HTMLElement> = (event) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    const assetId = fromVideoDragPayload(raw);
    if (!assetId) return;
    createActionByDroppingVideoAsset(assetId);
  };

  const startLayerDrag = (action: SceneActionDto, _mode: 'move' | 'resize', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedActionId(action.id);
  };

  useEffect(() => {
    if (!selectedAction || !WINDOW_ACTION_TYPES.has(selectedAction.type)) return;
    const nextKind = (selectedAction.targetWindow?.kind ?? 'main') as ScenePreviewWindowKind;
    if (nextKind === 'main' || nextKind === 'projection' || nextKind === 'skyline') {
      setPreviewWindowKind(nextKind);
    }
  }, [selectedAction?.id, selectedAction?.type, selectedAction?.targetWindow?.kind]);





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

  const splitSelectedActionAtPlayhead = () => {
    if (!selectedAction || selectedActionIndex < 0) return;
    if (!SPLITTABLE_ACTION_TYPES.has(selectedAction.type)) return;

    const timelineEntry = timelineEntriesByActionId.get(selectedAction.id);
    if (!timelineEntry) return;

    const splitAtMs = Math.round(Math.max(timelineEntry.startMs + 1, Math.min(timelineEntry.endMs - 1, currentTimelineTimeMs)));
    if (splitAtMs <= timelineEntry.startMs || splitAtMs >= timelineEntry.endMs) return;

    const leftDurationMs = splitAtMs - timelineEntry.startMs;
    const rightDurationMs = timelineEntry.endMs - splitAtMs;
    if (leftDurationMs <= 0 || rightDurationMs <= 0) return;

    const payload = { ...(selectedAction.payload ?? {}) } as Record<string, unknown>;
    const basePayload = omitClipMetadata(payload);
    const clipInSec = toNonNegativeSec(payload.clipInSec) ?? 0;
    const explicitClipOutSec = toNonNegativeSec(payload.clipOutSec);
    const fallbackClipOutSec = clipInSec + (timelineEntry.durationMs / 1000);
    const clipOutSec = explicitClipOutSec !== undefined && explicitClipOutSec > clipInSec
      ? explicitClipOutSec
      : fallbackClipOutSec;

    const leftClipOutSec = Math.min(clipOutSec, clipInSec + (leftDurationMs / 1000));
    const rightClipInSec = leftClipOutSec;
    const splitGroupId = uuidv4();

    const leftAction: SceneActionDto = {
      ...selectedAction,
      payload: {
        ...basePayload,
        durationMs: leftDurationMs,
        clipDurationMs: leftDurationMs,
        clipInSec,
        clipOutSec: leftClipOutSec,
        splitGroupId,
        splitIndex: 0,
        splitTotal: 2,
        parentActionId: selectedAction.id,
      },
    };

    const rightAction: SceneActionDto = {
      ...selectedAction,
      id: uuidv4(),
      payload: {
        ...basePayload,
        timelineStartMs: splitAtMs,
        durationMs: rightDurationMs,
        clipDurationMs: rightDurationMs,
        clipInSec: rightClipInSec,
        clipOutSec,
        splitGroupId,
        splitIndex: 1,
        splitTotal: 2,
        parentActionId: selectedAction.id,
      },
    };

    setDraft((currentDraft) => {
      const nextActions = [...currentDraft.actions];
      nextActions[selectedActionIndex] = leftAction;
      nextActions.splice(selectedActionIndex + 1, 0, rightAction);
      return { ...currentDraft, actions: nextActions };
    });
    setSelectedActionId(leftAction.id);
  };

  const createDerivedClipFromSelectedAction = async () => {
    if (!selectedAction || !selectedClipDerivationCandidate) return;

    const { actionId, videoAssetId, startSec, endSec, sourceAssetName } = selectedClipDerivationCandidate;
    setDerivingClipActionId(actionId);
    setDerivingClipErrorByActionId((current) => {
      const next = { ...current };
      delete next[actionId];
      return next;
    });

    try {
      const initialClip = await createSceneVideoClip(videoAssetId, {
        startSec,
        endSec,
        name: `${sourceAssetName} (clip ${startSec.toFixed(2)}-${endSec.toFixed(2)})`,
      });

      setSceneVideoAssets((current) => {
        const existingIndex = current.findIndex((item) => item.id === initialClip.id);
        if (existingIndex < 0) return [initialClip, ...current];
        const next = [...current];
        next[existingIndex] = initialClip;
        return next;
      });

      let derivedAsset = initialClip;
      let completed = false;
      for (let i = 0; i < DERIVATION_MAX_POLLS; i += 1) {
        const status = await getSceneVideoDerivationStatus(initialClip.id);
        if (status.processingStatus === 'ready') {
          const refreshedAssets = await listSceneVideos(campaignId ?? undefined);
          setSceneVideoAssets(refreshedAssets);
          const refreshed = refreshedAssets.find((asset) => asset.id === initialClip.id);
          if (refreshed) {
            derivedAsset = refreshed;
          }
          completed = true;
          break;
        }

        if (status.processingStatus === 'failed') {
          throw new Error(status.processingError || 'No se pudo procesar el clip derivado.');
        }

        await waitMs(DERIVATION_POLL_INTERVAL_MS);
      }

      if (!completed) {
        throw new Error('El clip sigue procesandose. Reintenta en unos segundos.');
      }

      updateActionById(actionId, (action) => {
        if (action.type !== 'sendVideoToWindow') return action;
        const payload = omitClipMetadata((action.payload ?? {}) as Record<string, unknown>);
        delete payload.videoUrl;
        return {
          ...action,
          payload: {
            ...payload,
            videoAssetId: derivedAsset.id,
            videoAssetName: derivedAsset.name,
            ...(toPositiveDurationMs(derivedAsset.durationMs) !== undefined
              ? { durationMs: toPositiveDurationMs(derivedAsset.durationMs) }
              : {}),
          },
        };
      });
    } catch (err: any) {
      const message = String(err?.response?.data?.message || err?.message || 'Error al crear clip derivado.');
      setDerivingClipErrorByActionId((current) => ({ ...current, [actionId]: message }));
      setError(message);
    } finally {
      setDerivingClipActionId((current) => (current === actionId ? null : current));
    }
  };

  const joinSelectedWithNextAction = () => {
    if (!selectedAction || selectedActionIndex < 0) return;
    const nextAction = draft.actions[selectedActionIndex + 1];
    if (!nextAction) return;
    if (selectedAction.type !== nextAction.type) return;

    const currentPayload = (selectedAction.payload ?? {}) as Record<string, unknown>;
    const nextPayload = (nextAction.payload ?? {}) as Record<string, unknown>;
    const currentGroupId = typeof currentPayload.splitGroupId === 'string' ? currentPayload.splitGroupId : '';
    const nextGroupId = typeof nextPayload.splitGroupId === 'string' ? nextPayload.splitGroupId : '';
    if (!currentGroupId || currentGroupId !== nextGroupId) return;

    const currentEntry = timelineEntriesByActionId.get(selectedAction.id);
    const nextEntry = timelineEntriesByActionId.get(nextAction.id);
    if (!currentEntry || !nextEntry) return;
    if (Math.abs(nextEntry.startMs - currentEntry.endMs) > 50) return;

    const sameTargetWindow = JSON.stringify(selectedAction.targetWindow ?? null) === JSON.stringify(nextAction.targetWindow ?? null);
    if (!sameTargetWindow) return;

    const currentComparable = JSON.stringify(omitClipMetadata(currentPayload));
    const nextComparable = JSON.stringify(omitClipMetadata(nextPayload));
    if (currentComparable !== nextComparable) return;

    const mergedPayload = {
      ...omitClipMetadata(currentPayload),
      timelineStartMs: currentEntry.startMs,
      durationMs: currentEntry.durationMs + nextEntry.durationMs,
      clipDurationMs: currentEntry.durationMs + nextEntry.durationMs,
      clipInSec: toNonNegativeSec(currentPayload.clipInSec) ?? 0,
      clipOutSec: toNonNegativeSec(nextPayload.clipOutSec)
        ?? ((toNonNegativeSec(currentPayload.clipInSec) ?? 0) + ((currentEntry.durationMs + nextEntry.durationMs) / 1000)),
    } as Record<string, unknown>;

    const mergedAction: SceneActionDto = {
      ...selectedAction,
      payload: mergedPayload,
    };

    setDraft((currentDraft) => {
      const nextActions = [...currentDraft.actions];
      nextActions[selectedActionIndex] = mergedAction;
      nextActions.splice(selectedActionIndex + 1, 1);
      return {
        ...currentDraft,
        actions: nextActions,
      };
    });
    setSelectedActionId(mergedAction.id);
  };

  const reorderActionsByIds = (draggedActionId: string, dropActionId: string) => {
    if (!draggedActionId || !dropActionId || draggedActionId === dropActionId) return;

    setDraft((d) => {
      const fromIndex = d.actions.findIndex((action) => action.id === draggedActionId);
      const toIndex = d.actions.findIndex((action) => action.id === dropActionId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return d;

      const nextActions = [...d.actions];
      const [moved] = nextActions.splice(fromIndex, 1);
      nextActions.splice(toIndex, 0, moved);
      return { ...d, actions: nextActions };
    });
  };

  const handleInspectorDragActionDrop = useCallback((targetActionId: string, draggedData: string) => {
    const targetIndex = draft.actions.findIndex((action) => action.id === targetActionId);
    if (targetIndex < 0) return;

    const draggedAssetId = fromVideoDragPayload(draggedData);
    const targetAction = draft.actions[targetIndex];

    if (draggedAssetId && targetAction.type === 'sendVideoToWindow') {
      updateAction(targetIndex, assignVideoAssetToAction(targetAction, draggedAssetId));
      setSelectedActionId(targetAction.id);
      return;
    }

    reorderActionsByIds(draggedData, targetActionId);
  }, [assignVideoAssetToAction, draft.actions, reorderActionsByIds, setSelectedActionId, updateAction]);

  const handleToggleSelectedChromaPick = useCallback(() => {
    if (!selectedAction || (selectedAction.type !== 'sendImageToWindow' && selectedAction.type !== 'sendVideoToWindow')) {
      return;
    }
    setChromaPickActionId((current) => (current === selectedAction.id ? null : selectedAction.id));
  }, [selectedAction, setChromaPickActionId]);

  const handleChangeSelectedAction = useCallback((updated: SceneActionDto) => {
    if (selectedActionIndex < 0) return;
    if (updated.type !== draft.actions[selectedActionIndex].type) {
      handleChangeActionType(selectedActionIndex, updated.type);
    } else {
      updateAction(selectedActionIndex, updated);
    }
  }, [draft.actions, handleChangeActionType, selectedActionIndex, updateAction]);

  const moveActionInTimeline = (actionId: string, nextStartMs: number) => {
    const snappedStartMs = Math.max(0, Math.round(nextStartMs / 100) * 100);
    updateActionById(actionId, (action) => ({
      ...action,
      payload: {
        ...(action.payload ?? {}),
        timelineStartMs: snappedStartMs,
      },
    }));
  };

  const changeActionDurationInTimeline = (actionId: string, nextDurationMs: number, nextStartMs?: number) => {
    const snappedDurationMs = Math.max(200, Math.round(nextDurationMs / 100) * 100);
    updateActionById(actionId, (action) => {
      const payload: Record<string, any> = {
        ...(action.payload ?? {}),
        durationMs: snappedDurationMs,
      };
      if (nextStartMs !== undefined) {
        payload.timelineStartMs = Math.max(0, Math.round(nextStartMs / 100) * 100);
      }
      return {
        ...action,
        payload,
      };
    });
  };

  const setActionLayerOrder = (actionId: string, nextLayerOrder: number) => {
    const normalized = Math.round(nextLayerOrder);
    updateActionById(actionId, (action) => ({
      ...action,
      payload: {
        ...(action.payload ?? {}),
        layerOrder: normalized,
      },
    }));
  };

  // --- FUNCIÓN INCOMPLETA ELIMINADA POR ERROR DE SINTAXIS ---

  const moveSelectedLayerToEdge = (edge: 'top' | 'bottom') => {
    if (selectedActionIndex < 0) return;
    setDraft((d) => {
      const nextActions = [...d.actions];
      const [moved] = nextActions.splice(selectedActionIndex, 1);
      if (!moved) return d;
      if (edge === 'top') {
        nextActions.push(moved);
      } else {
        nextActions.unshift(moved);
      }
      return { ...d, actions: nextActions };
    });
  };

  const handleSeekTimelineTime = (nextTimeMs: number) => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(Math.max(0, Math.min(timelineDurationMs, nextTimeMs)));
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  };

  function selectActionAndSeekToStart(actionId: string) {
    setSelectedActionId(actionId);
    const selectedAction = draft.actions.find((action) => action.id === actionId);
    if (selectedAction?.type === 'setNarrativeText') {
      setLeftToolPanelMode('text');
      setContextualMenu(null);
    }

    const timelineEntry = timelineEntriesByActionId.get(actionId);
    const startMs = timelineEntry?.startMs ?? 0;
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(Math.max(0, Math.min(timelineDurationMs, startMs)));
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  }

  const handleSetLoopWindow = useCallback((nextStartMs: number, nextEndMs: number) => {
    setDraft((currentDraft) => {
      if (!currentDraft.loop) return currentDraft;
      return {
        ...currentDraft,
        loopWindowStartMs: Math.max(0, Math.round(nextStartMs)),
        loopWindowEndMs: Math.max(Math.round(nextStartMs) + 1, Math.round(nextEndMs)),
      };
    });
  }, []);

  const frameStepMs = 1000 / PREVIEW_FPS;
  const stepPreviewFrame = (direction: -1 | 1) => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs((current) => {
      const next = current + direction * frameStepMs;
      return Math.max(0, Math.min(timelineDurationMs, next));
    });
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  };

  const goToTimelineStart = () => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(0);
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  };

  const goToTimelineEnd = () => {
    setIsPreviewPlaying(false);
    setCurrentTimelineTimeMs(timelineDurationMs);
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);
  };

  const activeTimelineEntry = useMemo(() => {
    return timelineModel.entries.find((entry) => currentTimelineTimeMs >= entry.startMs && currentTimelineTimeMs < entry.endMs) ?? null;
  }, [currentTimelineTimeMs, timelineModel.entries]);

  const activeEntryLabel = activeTimelineEntry
    ? `${activeTimelineEntry.label} · ${formatPreviewClock(Math.max(0, currentTimelineTimeMs - activeTimelineEntry.startMs))}/${formatPreviewClock(activeTimelineEntry.durationMs)}`
    : 'Sin acción activa';

  const previewRenderableActions = draft.actions.filter((action) => {
    const timelineEntry = timelineEntriesByActionId.get(action.id);
    if (!timelineEntry) return false;

    if (
      previewLoopWindow
      && previewLoopCycleIndex > 0
      && timelineEntry.endMs <= previewLoopWindow.startMs
    ) {
      return false;
    }

    const isActive = currentTimelineTimeMs >= timelineEntry.startMs && currentTimelineTimeMs < timelineEntry.endMs;
    if (!isActive) return false;

    if (!WINDOW_ACTION_TYPES.has(action.type)) return false;

    const targetKind = action.targetWindow?.kind ?? (action.type === 'setNarrativeText' ? 'projection' : 'main');
    return targetKind === previewWindowKind;
  });

  const effectiveProjectionSize = useMemo<WindowSize>(() => {
    if (secondaryWindowMode === 'custom') return customSizes.players;
    return projectionWindowSize ?? { width: 1920, height: 1080 };
  }, [secondaryWindowMode, customSizes.players, projectionWindowSize]);

  const effectiveSkylineSize = useMemo<WindowSize>(() => {
    if (secondaryWindowMode === 'custom') return customSizes.skyline;
    return skylineWindowSize ?? { width: 1920, height: 1080 };
  }, [secondaryWindowMode, customSizes.skyline, skylineWindowSize]);

  const previewWindowSize = useMemo<WindowSize>(() => {
    if (previewWindowKind === 'skyline') return effectiveSkylineSize;
    if (previewWindowKind === 'main') return { width: 1280, height: 720 };
    return effectiveProjectionSize;
  }, [previewWindowKind, effectiveProjectionSize, effectiveSkylineSize]);

  const previewScale = Number.isFinite(previewZoom) && previewZoom > 0 ? previewZoom : 0.25;

  const mapPreviewUrl = typeof activeMapId === 'string' && activeMapId.length > 0
    ? getMapImageUrlSized(activeMapId, 'preview', { timeOfDay: timeOfDay as 'dawn' | 'morning' | 'afternoon' | 'night' })
    : null;

  const previewBaseContent = (() => {
    if (previewWindowKind === 'skyline') {
      if (!campaignId || !activeMapId) {
        return (
          <Stack sx={{ width: '100%', height: '100%' }} alignItems="center" justifyContent="center">
            <Typography variant="body2" color="text.secondary">
              Selecciona campaña y mapa activo para usar la base Skyline.
            </Typography>
          </Stack>
        );
      }
      return (
        <SkylineViewportContent
          campaignId={campaignId as string}
          mapId={activeMapId as string}
          timeOfDay={timeOfDay}
        />
      );
    }

    if (previewWindowKind === 'main') {
      return (
        <Stack sx={{ width: '100%', height: '100%' }} alignItems="center" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Vista de ventana main (placeholder funcional).
          </Typography>
        </Stack>
      );
    }

    if (!mapPreviewUrl) {
      return (
        <Stack sx={{ width: '100%', height: '100%' }} alignItems="center" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            No hay mapa activo para la ventana projection.
          </Typography>
        </Stack>
      );
    }

    return (
      <AuthImage
        src={mapPreviewUrl ?? ''}
        alt="Projection base"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
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
      <DialogTitle sx={{ py: 1.5, px: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Box sx={{ flexShrink: 0 }}>
            <ShortcutThumbnailPreview
              icon={draft.icon}
              imageUrl={draft.imageUrl}
              name={draft.name || 'Escena'}
              onClick={() => setIconPickerOpen(true)}
              hideLabel={true}
            />
          </Box>
          <Stack spacing={1.25} sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                label="Nombre *"
                size="small"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                inputProps={{ maxLength: 80 }}
                sx={{ flex: 1 }}
              />
              <FormControl size="small" sx={{ width: 150 }}>
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
              placeholder="Descripción breve de la escena..."
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
            />
          </Stack>
          {uploadingIcon ? (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 1 }}>
              Subiendo...
            </Typography>
          ) : null}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={1.25} sx={{ height: '100%' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoFileSelected}
          />
          <input
            ref={iconFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleIconFileSelected}
          />

          <EmojiPickerDialog
            open={iconPickerOpen}
            value={draft.icon ?? ''}
            imageUrl={draft.imageUrl}
            onClose={() => setIconPickerOpen(false)}
            onSelect={handlePickEmoji}
            onUploadImage={handleUploadSceneIconClick}
            isUploadingImage={uploadingIcon}
          />

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{
              bgcolor: 'background.paper',
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              flexWrap: 'wrap',
            }}
          >
            <FormControlLabel
              control={(
                <Switch
                  checked={Boolean(draft.loop)}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setDraft((d) => ({
                      ...d,
                      loop: enabled,
                      loopDelayMs: enabled ? d.loopDelayMs : null,
                      loopDelayRandomMinMs: enabled ? d.loopDelayRandomMinMs : null,
                      loopDelayRandomMaxMs: enabled ? d.loopDelayRandomMaxMs : null,
                      loopWindowStartMs: enabled ? (d.loopWindowStartMs ?? 0) : null,
                      loopWindowEndMs: enabled ? (d.loopWindowEndMs ?? Math.max(1, Math.round(timelineDurationMs))) : null,
                    }));
                  }}
                />
              )}
              label="Escena en loop"
              sx={{ mr: 1 }}
            />

            {draft.loop ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 280, flexWrap: 'wrap', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Reinicio loop</InputLabel>
                  <Select
                    value={loopDelayMode}
                    label="Reinicio loop"
                    onChange={(event) => {
                      const mode = event.target.value as 'immediate' | 'fixed' | 'random';
                      setDraft((d) => {
                        if (mode === 'immediate') {
                          return {
                            ...d,
                            loopDelayMs: null,
                            loopDelayRandomMinMs: null,
                            loopDelayRandomMaxMs: null,
                          };
                        }
                        if (mode === 'fixed') {
                          return {
                            ...d,
                            loopDelayMs: d.loopDelayMs ?? 1000,
                            loopDelayRandomMinMs: null,
                            loopDelayRandomMaxMs: null,
                          };
                        }
                        return {
                          ...d,
                          loopDelayMs: null,
                          loopDelayRandomMinMs: d.loopDelayRandomMinMs ?? 500,
                          loopDelayRandomMaxMs: d.loopDelayRandomMaxMs ?? 1500,
                        };
                      });
                    }}
                  >
                    <MenuItem value="immediate">Inmediato</MenuItem>
                    <MenuItem value="fixed">Delay fijo</MenuItem>
                    <MenuItem value="random">Delay aleatorio</MenuItem>
                  </Select>
                </FormControl>

                {loopDelayMode === 'fixed' ? (
                  <TextField
                    size="small"
                    type="number"
                    label="Delay loop (ms)"
                    value={draft.loopDelayMs ?? 0}
                    onChange={(event) => set('loopDelayMs', Math.max(0, Number(event.target.value || 0)))}
                    inputProps={{ min: 0, step: 100 }}
                    sx={{ width: 140 }}
                  />
                ) : null}

                {loopDelayMode === 'random' ? (
                  <>
                    <TextField
                      size="small"
                      type="number"
                      label="Delay min (ms)"
                      value={draft.loopDelayRandomMinMs ?? 0}
                      onChange={(event) => set('loopDelayRandomMinMs', Math.max(0, Number(event.target.value || 0)))}
                      inputProps={{ min: 0, step: 100 }}
                      sx={{ width: 130 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Delay max (ms)"
                      value={draft.loopDelayRandomMaxMs ?? 0}
                      onChange={(event) => set('loopDelayRandomMaxMs', Math.max(0, Number(event.target.value || 0)))}
                      inputProps={{ min: 0, step: 100 }}
                      sx={{ width: 130 }}
                    />
                  </>
                ) : null}

                <Typography variant="caption" color="text.secondary">
                  El loop parcial se edita visualmente en el timeline (caja inferior).
                </Typography>
              </Stack>
            ) : null}
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: '240px minmax(0, 1fr)',
                lg: '250px minmax(0, 1fr) 320px',
                xl: '260px minmax(0, 1fr) 360px',
              },
              gap: 1.5,
              minHeight: 0,
              flex: 1,
            }}
          >
            <SceneToolsPanel
              actionsCount={draft.actions.length}
              maxActions={SCENE_MAX_ACTIONS}
              contextualMenu={contextualMenu}
              setContextualMenu={setContextualMenu}
              leftToolPanelMode={leftToolPanelMode}
              setLeftToolPanelMode={setLeftToolPanelMode}
              onCreateNarrativeAction={handleCreateNarrativeFromPreset}
              onCreateImageAction={handleCreateImageAction}
              onCreateFilterAction={handleCreateFilterAction}
              loadingAssets={loadingAssets}
              uploadingVideo={uploadingVideo}
              sceneVideoAssets={sceneVideoAssets}
              videoLibraryQuery={videoLibraryQuery}
              setVideoLibraryQuery={setVideoLibraryQuery}
              filteredSceneVideoAssets={filteredSceneVideoAssets}
              renamingVideoId={renamingVideoId}
              renamingVideoName={renamingVideoName}
              setRenamingVideoName={setRenamingVideoName}
              renamingVideoSubmitting={renamingVideoSubmitting}
              deletingVideoId={deletingVideoId}
              onUploadVideoClick={handleUploadVideoClick}
              onStartRenameVideo={handleStartRenameVideo}
              onDeleteVideoAsset={handleDeleteVideoAsset}
              onConfirmRenameVideo={handleConfirmRenameVideo}
              onCancelRenameVideo={handleCancelRenameVideo}
              onCreateActionByDroppingVideoAsset={createActionByDroppingVideoAsset}
            />

            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
              <ScenePreviewPanel
                effectivePreviewLoopMode={effectivePreviewLoopMode}
                hasValidLoopWindow={hasValidLoopWindow}
                onChangePreviewLoopMode={setPreviewLoopMode}
                isPreviewMemoryWarmupEnabled={isPreviewMemoryWarmupEnabled}
                onTogglePreviewMemoryWarmup={() => setIsPreviewMemoryWarmupEnabled((current) => !current)}
                warmedActionCount={warmedActionCount}
                targetedActionCount={targetedActionCount}
                currentTimelineTimeMs={currentTimelineTimeMs}
                previewFps={PREVIEW_FPS}
                activeEntryLabel={activeEntryLabel}
                derivingClipErrorLabel={selectedActionId ? derivingClipErrorByActionId[selectedActionId] : null}
                previewWindowKind={previewWindowKind}
                onChangePreviewWindowKind={setPreviewWindowKind}
                previewZoom={previewZoom}
                onChangePreviewZoom={setPreviewZoom}
                onDropVideoAsset={handleDropVideoAsset}
                previewWindowSize={previewWindowSize}
                previewScale={previewScale}
                previewStageRef={previewStageRef}
                previewBaseContent={previewBaseContent}
                previewGuideOverlay={activePreviewGuidePlacement && !narrativeCanvasEditActionId ? (
                  <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9000 }}>
                    {activeLayerDragPlacement ? (
                      <>
                        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pct) => (
                          <Box
                            key={`drag-v-guide-${pct}`}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: `${pct}%`,
                              width: '1px',
                              bgcolor: pct === 50 ? 'rgba(121, 134, 255, 0.7)' : 'rgba(121, 134, 255, 0.28)',
                            }}
                          />
                        ))}
                        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pct) => (
                          <Box
                            key={`drag-h-guide-${pct}`}
                            sx={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: `${pct}%`,
                              height: '1px',
                              bgcolor: pct === 50 ? 'rgba(121, 134, 255, 0.7)' : 'rgba(121, 134, 255, 0.28)',
                            }}
                          />
                        ))}
                      </>
                    ) : null}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${activePreviewGuidePlacement.leftPct}%`,
                        top: `${activePreviewGuidePlacement.topPct}%`,
                        width: `${activePreviewGuidePlacement.widthPct}%`,
                        height: `${activePreviewGuidePlacement.heightPct}%`,
                        border: '1px dashed rgba(121, 134, 255, 0.95)',
                        borderRadius: 0.5,
                        boxShadow: 'inset 0 0 0 1px rgba(121, 134, 255, 0.45)',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          transform: 'translateY(-100%)',
                          px: 0.5,
                          py: 0.2,
                          bgcolor: 'rgba(10, 14, 26, 0.88)',
                          border: '1px solid rgba(121, 134, 255, 0.9)',
                          borderRadius: 0.5,
                        }}
                      >
                        <Typography sx={{ fontSize: 10, lineHeight: 1.1, color: 'rgba(230, 236, 255, 0.95)' }}>
                          L {activePreviewGuidePlacement.leftPct.toFixed(0)}% | T {activePreviewGuidePlacement.topPct.toFixed(0)}% | W {activePreviewGuidePlacement.widthPct.toFixed(0)}% | H {activePreviewGuidePlacement.heightPct.toFixed(0)}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ) : null}
                                previewLayersContent={(
                  <ScenePreviewLayersRenderer
                    draftActions={draft.actions}
                    previewRenderableActions={previewRenderableActions}
                    previewWindowKind={previewWindowKind}
                    selectedActionId={selectedActionId}
                    lockPreviewInteractionToSelectedNarrative={lockPreviewInteractionToSelectedNarrative}
                    chromaPickActionId={chromaPickActionId}
                    setChromaPickActionId={setChromaPickActionId}
                    selectActionAndSeekToStart={selectActionAndSeekToStart}
                    startLayerDrag={startLayerDrag}
                    updateActionById={updateActionById}
                    previewMediaUrlsByActionId={previewMediaUrlsByActionId}
                    videoPreviewErrorsByActionId={videoPreviewErrorsByActionId}
                    timelineEntriesByActionId={timelineEntriesByActionId}
                    currentTimelineTimeMs={currentTimelineTimeMs}
                    previewLoopWindow={previewLoopWindow}
                    previewLoopCycleIndex={previewLoopCycleIndex}
                    isPreviewPlaying={isPreviewPlaying}
                    previewSeekVersion={previewSeekVersion}
                    narrativeCanvasEditActionId={narrativeCanvasEditActionId}
                    narrativeCanvasDraft={narrativeCanvasDraft}
                    setNarrativeCanvasDraft={setNarrativeCanvasDraft}
                    leftToolPanelMode={leftToolPanelMode}
                    beginNarrativeCanvasEdit={beginNarrativeCanvasEdit}
                    finishNarrativeCanvasEdit={finishNarrativeCanvasEdit}
                    previewWindowSize={previewWindowSize}
                    previewScale={previewScale}
                  />
                )}
                formatPreviewClock={formatPreviewClock}
              />

              <SceneTimelinePanel
                actions={draft.actions}
                maxActions={SCENE_MAX_ACTIONS}
                selectedActionId={selectedActionId}
                narrativeEditingActionId={narrativeCanvasEditActionId}
                currentTimeMs={currentTimelineTimeMs}
                isPreviewPlaying={isPreviewPlaying}
                isPreviewLooping={isPreviewLooping}
                canSplitSelectedAction={canSplitSelectedAction}
                canCreateDerivedClip={canCreateDerivedClip}
                canJoinSelectedWithNext={canJoinSelectedWithNext}
                derivingClipActionId={derivingClipActionId}
                onGoToTimelineStart={goToTimelineStart}
                onStepPreviewFrame={stepPreviewFrame}
                onSetPreviewPlaying={setIsPreviewPlaying}
                onGoToTimelineEnd={goToTimelineEnd}
                onSetPreviewLooping={setIsPreviewLooping}
                onSplitSelectedActionAtPlayhead={splitSelectedActionAtPlayhead}
                onCreateDerivedClipFromSelectedAction={createDerivedClipFromSelectedAction}
                onJoinSelectedWithNextAction={joinSelectedWithNextAction}
                onDropVideoAsset={handleDropVideoAsset}
                onSelectAction={handleSelectActionFromTimeline}
                onMoveActionInTime={moveActionInTimeline}
                onChangeActionLayerOrder={setActionLayerOrder}
                onChangeActionDuration={changeActionDurationInTimeline}
                onDropAsset={handleDropAssetOnTimeline}
                onSeekTimeMs={handleSeekTimelineTime}
                loopEnabled={Boolean(draft.loop)}
                loopWindowStartMs={draft.loopWindowStartMs ?? null}
                loopWindowEndMs={draft.loopWindowEndMs ?? null}
                onSetLoopWindow={handleSetLoopWindow}
              />
            </Paper>

            <SceneInspectorPanel
              actions={draft.actions}
              selectedActionId={selectedActionId}
              selectedActionIndex={selectedActionIndex}
              selectedAction={selectedAction as SceneActionDto | null}
              narrativeCanvasEditActionId={narrativeCanvasEditActionId}
              dragOverActionId={dragOverActionId}
              setDragOverActionId={setDragOverActionId}
              onDragActionDrop={handleInspectorDragActionDrop}
              onSelectAction={handleSelectActionFromTimeline}
              onMoveSelectedAction={moveSelectedAction}
              onRemoveSelectedAction={removeSelectedAction}
              onMoveSelectedLayerToEdge={moveSelectedLayerToEdge}
              sceneVideoAssets={sceneVideoAssets}
              onRequestUploadVideo={handleUploadVideoClick}
              chromaPickActionId={chromaPickActionId}
              onToggleSelectedChromaPick={handleToggleSelectedChromaPick}
              onChangeSelectedAction={handleChangeSelectedAction}
            />
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
          {saving ? 'Guardandoâ€¦' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};


function formatPreviewClock(valueMs: number): string {
  const totalSeconds = Math.floor(valueMs / 1000);
  const frames = Math.floor((valueMs % 1000) / (1000 / PREVIEW_FPS));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

export default SceneFormDialog;

