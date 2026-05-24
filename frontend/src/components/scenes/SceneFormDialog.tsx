import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
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
import type { MotionKeyframe, Scene, SceneActionDto, ScenePayload } from '../../types/scenes';
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
import { listPlaylists } from '../../api/soundtrack';
import { api } from '../../apiBase';
import { getMapImageUrlSized } from '../../api/maps';
import { getAuthHeaders } from '../../utils/auth';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useActiveMap } from '../Map/ActiveMapContext';
import type { SoundSourceSelection } from '../Map/SoundSourcePickerDialog';
import { useSfxPlayer } from '../player/SfxPlayerContext';
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
  fromImageDragPayload,
  resolveSceneMediaUrl,
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
import {
  normalizeNarratorVoiceConfig,
  normalizeNarratorVoiceTarget,
  playNarration,
  type NarratorPlaybackHandle,
} from './utils/narratorPlayback';
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
  embedded?: boolean;
}

/**
 * Dialog for creating or editing a Scene, including its action list.
 */
const SceneFormDialog: React.FC<Props> = ({ open, editing, campaignId, onClose, onSave, embedded = false }) => {
  const { activeCampaign } = useActiveCampaign();
  const { activeMapId } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { items: sfxItems, playSfx, stopSfx, stopAllSfx, setSfxVolume } = useSfxPlayer();
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
  const previewAudioTriggerRef = useRef<Set<string>>(new Set());
  const previewSfxInstanceIdsRef = useRef<Set<string>>(new Set());
  const previewMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewMusicObjectUrlRef = useRef<string | null>(null);
  const previewMusicQueueRef = useRef<Array<{ id: string; name: string }>>([]);
  const previewMusicQueueIndexRef = useRef<number>(0);
  const previewMusicStopTimerRef = useRef<number | null>(null);
  const previewNarrationHandlesRef = useRef<Set<NarratorPlaybackHandle>>(new Set());
  const [isSelectionModifierPressed, setIsSelectionModifierPressed] = useState(false);
  const keyframeDragRef = useRef<{
    actionId: string;
    keyframeIndex: number;
    startX: number;
    startY: number;
    originLeftPct: number;
    originTopPct: number;
  } | null>(null);

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

    setError(null);
    setContextualMenu(null);
    setLeftToolPanelMode('media');
    setDragOverActionId(null);
    setChromaPickActionId(null);
    setNarrativeCanvasEditActionId(null);
    setNarrativeCanvasDraft(null);
    setCurrentTimelineTimeMs(0);
    setIsPreviewPlaying(false);
    setPreviewLoopCycleIndex(0);
    setPreviewSeekVersion((v) => v + 1);

    if (editing) {
      const resolvedCampaignId = editing.campaignId ?? ((editing as unknown as { campaign?: { id?: string | null } }).campaign?.id ?? null);
      const normalizedActions = (editing.actions ?? []).map((action) => {
        const clonedAction: SceneActionDto = {
          ...action,
          targetWindow: action.targetWindow ? { ...action.targetWindow } : undefined,
          payload: { ...(action.payload ?? {}) },
        };
        return normalizeActionForEditor(clonedAction);
      });

      setDraft({
        name: editing.name ?? '',
        description: editing.description ?? '',
        icon: editing.icon ?? null,
        imageUrl: editing.imageUrl ?? null,
        loop: Boolean(editing.loop),
        loopDelayMs: editing.loopDelayMs ?? null,
        loopDelayRandomMinMs: editing.loopDelayRandomMinMs ?? null,
        loopDelayRandomMaxMs: editing.loopDelayRandomMaxMs ?? null,
        loopWindowStartMs: editing.loopWindowStartMs ?? null,
        loopWindowEndMs: editing.loopWindowEndMs ?? null,
        takeOverMusicOnStart: Boolean(editing.takeOverMusicOnStart),
        restorePreviousMusicOnFinish: editing.restorePreviousMusicOnFinish !== false,
        scope: editing.scope === 'campaign' && resolvedCampaignId ? 'campaign' : (editing.scope ?? (resolvedCampaignId ? 'campaign' : 'global')),
        campaignId: resolvedCampaignId,
        actions: normalizedActions,
      });
      setSelectedActionId(normalizedActions[0]?.id ?? null);
      return;
    }

    setDraft(blankDraft(campaignId));
    setSelectedActionId(null);
    setVideoPreviewUrlsByActionId({});
    setVideoPreviewErrorsByActionId({});
    signedVideoUrlCacheRef.current.clear();
  }, [
    open,
    editing,
    campaignId,
    setError,
    setContextualMenu,
    setLeftToolPanelMode,
    setDragOverActionId,
    setChromaPickActionId,
    setNarrativeCanvasEditActionId,
    setNarrativeCanvasDraft,
    setCurrentTimelineTimeMs,
    setIsPreviewPlaying,
    setPreviewLoopCycleIndex,
    setPreviewSeekVersion,
    setDraft,
    setSelectedActionId,
    setVideoPreviewUrlsByActionId,
    setVideoPreviewErrorsByActionId,
    signedVideoUrlCacheRef,
  ]);

  useEffect(() => {
    if (!open) return;

    const syncFromStorage = () => {
      const nextProjection = readStoredWindowSize(PROJECTION_SIZE_KEY);
      const nextSkyline = readStoredWindowSize(SKYLINE_SIZE_KEY);
      setProjectionWindowSize((current) => (
        current
          && nextProjection
          && current.width === nextProjection.width
          && current.height === nextProjection.height
          ? current
          : nextProjection
      ));
      setSkylineWindowSize((current) => (
        current
          && nextSkyline
          && current.width === nextSkyline.width
          && current.height === nextSkyline.height
          ? current
          : nextSkyline
      ));
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

    const tickMs = 1000 / 30;
    let lastFrame = performance.now();
    let pendingLoopCycleIncrements = 0;
    let pendingSeekIncrements = 0;

    const flushPendingPreviewState = () => {
      if (pendingLoopCycleIncrements > 0) {
        const increments = pendingLoopCycleIncrements;
        pendingLoopCycleIncrements = 0;
        setPreviewLoopCycleIndex((cycle) => Math.max(1, cycle + increments));
      }
      if (pendingSeekIncrements > 0) {
        const increments = pendingSeekIncrements;
        pendingSeekIncrements = 0;
        setPreviewSeekVersion((version) => version + increments);
      }
    };

    const step = () => {
      const now = performance.now();
      const delta = now - lastFrame;
      lastFrame = now;
      let shouldStopPreview = false;
      setCurrentTimelineTimeMs((current) => {
        const next = current + delta;
        if (next >= timelineDurationMs) {
          if (isPreviewLooping && timelineDurationMs > 0) {
            pendingLoopCycleIncrements += 1;
            pendingSeekIncrements += 1;
            if (previewLoopWindow) {
              const overflowMs = Math.max(0, next - timelineDurationMs);
              return previewLoopWindow.startMs + (overflowMs % previewLoopWindow.durationMs);
            }
            return next % timelineDurationMs;
          }
          shouldStopPreview = true;
          return timelineDurationMs;
        }

        if (isPreviewLooping && previewLoopWindow) {
          if (next < previewLoopWindow.startMs) {
            return previewLoopWindow.startMs;
          }
          if (next >= previewLoopWindow.endMs) {
            return previewLoopWindow.startMs + ((next - previewLoopWindow.startMs) % previewLoopWindow.durationMs);
          }
        }
        return next;
      });
      if (shouldStopPreview) {
        setIsPreviewPlaying(false);
      }
      flushPendingPreviewState();
    };

    const timerId = window.setInterval(step, tickMs);
    return () => {
      pendingLoopCycleIncrements = 0;
      pendingSeekIncrements = 0;
      window.clearInterval(timerId);
    };
  }, [
    isPreviewPlaying,
    isPreviewLooping,
    open,
    timelineDurationMs,
    previewLoopWindow,
  ]);

  useEffect(() => {
    if (!open || !isPreviewPlaying) {
      previewAudioTriggerRef.current.clear();
      for (const handle of previewNarrationHandlesRef.current) {
        handle.stop();
      }
      previewNarrationHandlesRef.current.clear();
      return;
    }

    const normalizeVolume01 = (value: unknown, fallback = 1): number => {
      const n = Number(value);
      if (!Number.isFinite(n)) return Math.max(0, Math.min(1, fallback));
      return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
    };

    const streamSong = async (songId: string, campaignScopeId?: string | null) => {
      const query = campaignScopeId ? `?campaignId=${campaignScopeId}` : '';
      const req = await api.get(`/soundtrack/songs/${songId}/stream${query}`, {
        headers: getAuthHeaders(),
        responseType: 'blob',
      });
      return URL.createObjectURL(req.data);
    };

    const stopPreviewMusic = () => {
      previewMusicQueueRef.current = [];
      previewMusicQueueIndexRef.current = 0;
      if (previewMusicStopTimerRef.current !== null) {
        window.clearTimeout(previewMusicStopTimerRef.current);
        previewMusicStopTimerRef.current = null;
      }
      if (previewMusicAudioRef.current) {
        previewMusicAudioRef.current.onended = null;
        previewMusicAudioRef.current.pause();
        previewMusicAudioRef.current.removeAttribute('src');
        previewMusicAudioRef.current.load();
        previewMusicAudioRef.current = null;
      }
      if (previewMusicObjectUrlRef.current) {
        URL.revokeObjectURL(previewMusicObjectUrlRef.current);
        previewMusicObjectUrlRef.current = null;
      }
    };

    const schedulePreviewMusicStop = (stopAfterMs?: number) => {
      if (previewMusicStopTimerRef.current !== null) {
        window.clearTimeout(previewMusicStopTimerRef.current);
        previewMusicStopTimerRef.current = null;
      }
      if (!Number.isFinite(Number(stopAfterMs)) || Number(stopAfterMs) <= 0) return;
      previewMusicStopTimerRef.current = window.setTimeout(() => {
        stopPreviewMusic();
      }, Math.max(1, Math.round(Number(stopAfterMs))));
    };

    const playPreviewSong = async (
      songId: string,
      songName: string,
      campaignScopeId?: string | null,
      startAtSec?: number,
      stopAfterMs?: number,
    ) => {
      if (!songId) return;
      if (previewMusicObjectUrlRef.current) {
        URL.revokeObjectURL(previewMusicObjectUrlRef.current);
        previewMusicObjectUrlRef.current = null;
      }
      let audio = previewMusicAudioRef.current;
      if (!audio) {
        audio = new Audio();
        previewMusicAudioRef.current = audio;
      }

      const objectUrl = await streamSong(songId, campaignScopeId);
      previewMusicObjectUrlRef.current = objectUrl;
      audio.src = objectUrl;
      audio.volume = 1;
      (audio as any).__songName = songName;
      const normalizedStartAtSec = Number.isFinite(Number(startAtSec)) && Number(startAtSec) >= 0
        ? Number(startAtSec)
        : undefined;
      if (normalizedStartAtSec !== undefined) {
        if (audio.readyState < 1) {
          await new Promise<void>((resolve) => {
            const finish = () => resolve();
            audio.addEventListener('loadedmetadata', finish, { once: true });
            audio.addEventListener('error', finish, { once: true });
          });
        }
        try {
          audio.currentTime = normalizedStartAtSec;
        } catch {
          // Ignore seek failures for streams that cannot seek immediately.
        }
      }
      schedulePreviewMusicStop(stopAfterMs);
      await audio.play().catch(() => undefined);
    };

    const playPreviewPlaylist = async (
      playlistId: string,
      campaignScopeId: string,
      startAtSec?: number,
      stopAfterMs?: number,
    ) => {
      const playlists = await listPlaylists(campaignScopeId);
      const playlist = playlists.find((item) => item.id === playlistId);
      const songs = Array.isArray(playlist?.songs)
        ? playlist.songs
            .filter((song) => typeof song?.id === 'string' && song.id.trim().length > 0)
            .map((song) => ({ id: song.id, name: song.name || song.id }))
        : [];
      if (!songs.length) return;

      previewMusicQueueRef.current = songs;
      previewMusicQueueIndexRef.current = 0;

      if (!previewMusicAudioRef.current) {
        previewMusicAudioRef.current = new Audio();
      }
      previewMusicAudioRef.current.onended = () => {
        const queue = previewMusicQueueRef.current;
        if (!queue.length) return;
        const nextIndex = previewMusicQueueIndexRef.current + 1;
        if (nextIndex >= queue.length) {
          stopPreviewMusic();
          return;
        }
        previewMusicQueueIndexRef.current = nextIndex;
        const nextSong = queue[nextIndex];
        void playPreviewSong(nextSong.id, nextSong.name, campaignScopeId);
      };

      const firstSong = songs[0];
      await playPreviewSong(firstSong.id, firstSong.name, campaignScopeId, startAtSec, stopAfterMs);
    };

    const streamEffect = async (effectId: string, campaignScopeId?: string | null) => {
      const query = campaignScopeId ? `?campaignId=${campaignScopeId}` : '';
      const req = await api.get(`/soundtrack/effects/${effectId}/stream${query}`, {
        headers: getAuthHeaders(),
        responseType: 'blob',
      });
      return URL.createObjectURL(req.data);
    };

    const resolveAudioPlaybackWindow = (
      payload: Record<string, unknown>,
      entry: { startMs: number; endMs: number; durationMs: number },
    ): { startAtSec: number; stopAfterMs: number } => {
      const clipInSec = toNonNegativeSec(payload.clipInSec) ?? 0;
      const rawClipOutSec = toNonNegativeSec(payload.clipOutSec);
      const entryDurationSec = Math.max(0, entry.durationMs / 1000);
      const resolvedClipOutSec = rawClipOutSec !== undefined && rawClipOutSec > clipInSec
        ? rawClipOutSec
        : (clipInSec + entryDurationSec);

      const offsetMs = Math.max(0, Math.min(entry.durationMs, currentTimelineTimeMs - entry.startMs));
      const startAtSec = Math.max(clipInSec, Math.min(resolvedClipOutSec, clipInSec + (offsetMs / 1000)));

      const payloadDurationMs = toPositiveDurationMs(payload.durationMs);
      const clipDurationMs = toPositiveDurationMs(payload.clipDurationMs);
      const remainingClipMs = Math.max(0, Math.round((resolvedClipOutSec - startAtSec) * 1000));
      const candidates = [remainingClipMs, payloadDurationMs, clipDurationMs]
        .filter((value): value is number => Number.isFinite(Number(value)) && Number(value) > 0)
        .map((value) => Math.round(value));
      const stopAfterMs = candidates.length > 0
        ? Math.min(...candidates)
        : Math.max(1, Math.round(entry.endMs - currentTimelineTimeMs));

      return {
        startAtSec,
        stopAfterMs: Math.max(1, stopAfterMs),
      };
    };

    const executePreviewAudioAction = async (
      action: SceneActionDto,
      entry: { startMs: number; endMs: number; durationMs: number },
    ) => {
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      const campaignScopeId = activeCampaign?.id ?? campaignId ?? null;
      const playbackWindow = resolveAudioPlaybackWindow(payload, entry);

      if (action.type === 'playMusic') {
        const songId = typeof payload.songId === 'string' ? payload.songId.trim() : '';
        const playlistId = typeof payload.playlistId === 'string' ? payload.playlistId.trim() : '';

        stopPreviewMusic();

        if (songId) {
          await playPreviewSong(
            songId,
            typeof payload.displayName === 'string' && payload.displayName.trim() ? payload.displayName.trim() : songId,
            campaignScopeId,
            playbackWindow.startAtSec,
            playbackWindow.stopAfterMs,
          );
          return;
        }

        if (playlistId && campaignScopeId) {
          await playPreviewPlaylist(playlistId, campaignScopeId, playbackWindow.startAtSec, playbackWindow.stopAfterMs);
        }
        return;
      }

      if (action.type === 'playSound') {
        const effectId = typeof payload.effectId === 'string' ? payload.effectId.trim() : '';
        if (!effectId) return;
        const loopMode = payload.loopMode === 'continuous' || payload.loopMode === 'fixed' || payload.loopMode === 'random' || payload.loopMode === 'once'
          ? payload.loopMode
          : 'once';
        const instanceId = await playSfx(
          { effectId, name: typeof payload.displayName === 'string' && payload.displayName.trim() ? payload.displayName.trim() : effectId },
          async () => streamEffect(effectId, campaignScopeId),
          {
            volume: normalizeVolume01(payload.volume, 1),
            loopMode,
            startAtSec: playbackWindow.startAtSec,
            durationMs: playbackWindow.stopAfterMs,
            waitMs: Number.isFinite(Number(payload.waitMs)) ? Number(payload.waitMs) : undefined,
            randomMinMs: Number.isFinite(Number(payload.randomMinMs)) ? Number(payload.randomMinMs) : undefined,
            randomMaxMs: Number.isFinite(Number(payload.randomMaxMs)) ? Number(payload.randomMaxMs) : undefined,
            playbackRate: Number.isFinite(Number(payload.playbackRate)) ? Number(payload.playbackRate) : undefined,
            pitchSemitones: Number.isFinite(Number(payload.pitchSemitones)) ? Number(payload.pitchSemitones) : undefined,
            echoEnabled: payload.echoEnabled === undefined ? undefined : Boolean(payload.echoEnabled),
            echoDelayMs: Number.isFinite(Number(payload.echoDelayMs)) ? Number(payload.echoDelayMs) : undefined,
            echoFeedback: Number.isFinite(Number(payload.echoFeedback)) ? Number(payload.echoFeedback) : undefined,
            filterType: payload.filterType === 'none' || payload.filterType === 'lowpass' || payload.filterType === 'highpass' || payload.filterType === 'bandpass'
              ? payload.filterType
              : undefined,
            filterFrequency: Number.isFinite(Number(payload.filterFrequency)) ? Number(payload.filterFrequency) : undefined,
            filterQ: Number.isFinite(Number(payload.filterQ)) ? Number(payload.filterQ) : undefined,
          },
        );
        previewSfxInstanceIdsRef.current.add(instanceId);
        return;
      }

      if (action.type === 'playPreset') {
        const presetId = typeof payload.presetId === 'string' ? payload.presetId.trim() : '';
        if (!presetId || !campaignScopeId) return;
        const response = await api.get(`/soundtrack/presets/campaigns/${campaignScopeId}`, { headers: getAuthHeaders() });
        const presets = Array.isArray(response.data) ? response.data : [];
        const preset = presets.find((item: any) => item?.id === presetId);
        const items = Array.isArray(preset?.items) ? preset.items : [];

        const presetVolume = Number.isFinite(Number(payload.volume)) ? Number(payload.volume) : undefined;
        const volumeMultiplier = presetVolume === undefined ? 1 : (presetVolume > 1 ? presetVolume / 100 : presetVolume);

        for (const item of items) {
          const effectId = item?.soundEffect?.id;
          if (!effectId) continue;
          const instanceId = await playSfx(
            { effectId, name: item?.soundEffect?.name || effectId },
            async () => streamEffect(effectId, campaignScopeId),
            {
              volume: Math.max(0, Math.min(1, normalizeVolume01(item?.volume ?? 1, 1) * Math.max(0, Math.min(1, volumeMultiplier)))),
              loopMode: item?.loopMode === 'continuous' || item?.loopMode === 'fixed' || item?.loopMode === 'random' || item?.loopMode === 'once'
                ? item.loopMode
                : 'once',
              startAtSec: playbackWindow.startAtSec,
              durationMs: playbackWindow.stopAfterMs,
              waitMs: Number.isFinite(Number(item?.waitMs)) ? Number(item.waitMs) : undefined,
              randomMinMs: Number.isFinite(Number(item?.randomMinMs)) ? Number(item.randomMinMs) : undefined,
              randomMaxMs: Number.isFinite(Number(item?.randomMaxMs)) ? Number(item.randomMaxMs) : undefined,
              playbackRate: Number.isFinite(Number(payload.playbackRate)) ? Number(payload.playbackRate) : undefined,
              pitchSemitones: Number.isFinite(Number(payload.pitchSemitones)) ? Number(payload.pitchSemitones) : (Number.isFinite(Number(item?.pitchSemitones)) ? Number(item.pitchSemitones) : undefined),
              echoEnabled: payload.echoEnabled === undefined ? Boolean(item?.echoEnabled ?? false) : Boolean(payload.echoEnabled),
              echoDelayMs: Number.isFinite(Number(payload.echoDelayMs)) ? Number(payload.echoDelayMs) : (Number.isFinite(Number(item?.echoDelayMs)) ? Number(item.echoDelayMs) : undefined),
              echoFeedback: Number.isFinite(Number(payload.echoFeedback)) ? Number(payload.echoFeedback) : (Number.isFinite(Number(item?.echoFeedback)) ? Number(item.echoFeedback) : undefined),
              filterType: payload.filterType === 'none' || payload.filterType === 'lowpass' || payload.filterType === 'highpass' || payload.filterType === 'bandpass'
                ? payload.filterType
                : undefined,
              filterFrequency: Number.isFinite(Number(payload.filterFrequency)) ? Number(payload.filterFrequency) : undefined,
              filterQ: Number.isFinite(Number(payload.filterQ)) ? Number(payload.filterQ) : undefined,
            },
          );
          previewSfxInstanceIdsRef.current.add(instanceId);
        }
        return;
      }

      if (action.type === 'stopMusic') {
        stopPreviewMusic();
        if (Boolean(payload.stopEffects)) {
          stopAllSfx();
          previewSfxInstanceIdsRef.current.clear();
        }
        return;
      }

      if (action.type === 'stopSound') {
        const effectId = typeof payload.effectId === 'string' ? payload.effectId.trim() : '';
        if (!effectId) {
          stopAllSfx();
          previewSfxInstanceIdsRef.current.clear();
          return;
        }

        for (const item of sfxItems) {
          if (item.effectId === effectId) {
            stopSfx(item.instanceId);
            previewSfxInstanceIdsRef.current.delete(item.instanceId);
          }
        }
        return;
      }

      if (action.type === 'setSoundVolume') {
        const nextVolume = normalizeVolume01(payload.value, 1);
        const effectId = typeof payload.effectId === 'string' ? payload.effectId.trim() : '';
        for (const item of sfxItems) {
          if (!effectId || item.effectId === effectId) {
            setSfxVolume(item.instanceId, nextVolume);
          }
        }
        return;
      }

      if (action.type === 'setNarrativeText') {
        const rawText = typeof payload.text === 'string' ? payload.text : '';
        const text = rawText.trim();
        if (!text) return;
        const voiceTarget = normalizeNarratorVoiceTarget(payload.voiceTarget);
        const previewIsMainWindow = previewWindowKind === 'main';
        const shouldPlayOnPreviewWindow = voiceTarget === 'both'
          || (voiceTarget === 'main' && previewIsMainWindow)
          || (voiceTarget === 'projection' && !previewIsMainWindow);
        if (!shouldPlayOnPreviewWindow) return;

        const narration = await playNarration({
          text,
          voiceConfig: normalizeNarratorVoiceConfig(payload.voiceConfig as Record<string, unknown>),
          locale: navigator.language,
        });
        previewNarrationHandlesRef.current.add(narration);
        void narration.finished.finally(() => {
          previewNarrationHandlesRef.current.delete(narration);
        });
      }
    };

    const activeAudioEntries = timelineModel.entries.filter((entry) => {
      if (!['playMusic', 'playPreset', 'stopMusic', 'playSound', 'stopSound', 'setSoundVolume', 'setNarrativeText'].includes(entry.type)) {
        return false;
      }
      return currentTimelineTimeMs >= entry.startMs && currentTimelineTimeMs < entry.endMs;
    });

    for (const entry of activeAudioEntries) {
      const triggerKey = `${previewSeekVersion}:${previewLoopCycleIndex}:${entry.actionId}`;
      if (previewAudioTriggerRef.current.has(triggerKey)) continue;
      previewAudioTriggerRef.current.add(triggerKey);
      const action = draft.actions.find((item) => item.id === entry.actionId);
      if (!action) continue;
      void executePreviewAudioAction(action, entry);
    }
  }, [
    open,
    isPreviewPlaying,
    timelineModel.entries,
    currentTimelineTimeMs,
    previewSeekVersion,
    previewLoopCycleIndex,
    draft.actions,
    activeCampaign?.id,
    campaignId,
    previewWindowKind,
    playSfx,
    setSfxVolume,
    sfxItems,
    stopAllSfx,
    stopSfx,
  ]);

  useEffect(() => {
    if (open && isPreviewPlaying) return;
    if (previewMusicAudioRef.current) {
      previewMusicAudioRef.current.pause();
      previewMusicAudioRef.current.removeAttribute('src');
      previewMusicAudioRef.current.load();
      previewMusicAudioRef.current = null;
    }
    if (previewMusicObjectUrlRef.current) {
      URL.revokeObjectURL(previewMusicObjectUrlRef.current);
      previewMusicObjectUrlRef.current = null;
    }
    if (previewMusicStopTimerRef.current !== null) {
      window.clearTimeout(previewMusicStopTimerRef.current);
      previewMusicStopTimerRef.current = null;
    }
    previewMusicQueueRef.current = [];
    previewMusicQueueIndexRef.current = 0;
    for (const instanceId of previewSfxInstanceIdsRef.current) {
      stopSfx(instanceId);
    }
    previewSfxInstanceIdsRef.current.clear();
    for (const handle of previewNarrationHandlesRef.current) {
      handle.stop();
    }
    previewNarrationHandlesRef.current.clear();
  }, [open, isPreviewPlaying, stopSfx]);

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

  useEffect(() => {
    if (!open) {
      setIsSelectionModifierPressed(false);
      return;
    }

    const syncModifierState = (event: KeyboardEvent) => {
      setIsSelectionModifierPressed(Boolean(event.ctrlKey || event.metaKey));
    };

    const clearModifierState = () => {
      setIsSelectionModifierPressed(false);
    };

    window.addEventListener('keydown', syncModifierState);
    window.addEventListener('keyup', syncModifierState);
    window.addEventListener('blur', clearModifierState);

    return () => {
      window.removeEventListener('keydown', syncModifierState);
      window.removeEventListener('keyup', syncModifierState);
      window.removeEventListener('blur', clearModifierState);
      setIsSelectionModifierPressed(false);
    };
  }, [open]);

  const set = <K extends keyof ScenePayload>(key: K, value: ScenePayload[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleToggleSceneLoop = useCallback((enabled: boolean) => {
    setDraft((d) => ({
      ...d,
      loop: enabled,
      loopDelayMs: enabled ? d.loopDelayMs : null,
      loopDelayRandomMinMs: enabled ? d.loopDelayRandomMinMs : null,
      loopDelayRandomMaxMs: enabled ? d.loopDelayRandomMaxMs : null,
      loopWindowStartMs: enabled ? (d.loopWindowStartMs ?? 0) : null,
      loopWindowEndMs: enabled ? (d.loopWindowEndMs ?? Math.max(1, Math.round(timelineDurationMs))) : null,
    }));
  }, [setDraft, timelineDurationMs]);

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

  const updateAction = useCallback((index: number, updated: SceneActionDto) => {
    setDraft((d) => {
      const actions = [...d.actions];
      actions[index] = updated;
      return { ...d, actions };
    });
  }, [setDraft]);

  const updateActionById = useCallback((actionId: string, updater: (action: SceneActionDto) => SceneActionDto) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((action) => (action.id === actionId ? updater(action) : action)),
    }));
  }, [setDraft]);

  const startMotionKeyframeDrag = useCallback((actionId: string, keyframeIndex: number, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) return;

    const action = draft.actions.find((item) => item.id === actionId);
    if (!action) return;

    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const motionPath = Array.isArray(payload.motionPath)
      ? (payload.motionPath as MotionKeyframe[])
      : [];
    const keyframe = motionPath[keyframeIndex];
    if (!keyframe) return;

    keyframeDragRef.current = {
      actionId,
      keyframeIndex,
      startX: event.clientX,
      startY: event.clientY,
      originLeftPct: Number(keyframe.leftPct),
      originTopPct: Number(keyframe.topPct),
    };
  }, [draft.actions]);

  const addMotionKeyframeAtPreview = useCallback((actionId: string, leftPct: number, topPct: number) => {
    updateActionById(actionId, (action) => {
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      const motionPath = Array.isArray(payload.motionPath)
        ? [...(payload.motionPath as MotionKeyframe[])]
        : [];
      const timelineEntry = timelineEntriesByActionId.get(actionId);
      const elapsedMs = timelineEntry
        ? Math.max(0, currentTimelineTimeMs - timelineEntry.startMs)
        : currentTimelineTimeMs;
      const rawDurationMs = Number(payload.durationMs);
      const fallbackDurationMs = Number.isFinite(rawDurationMs) && rawDurationMs > 0
        ? rawDurationMs
        : 3000;
      const timeMs = Math.max(0, Math.round(Math.min(fallbackDurationMs, elapsedMs)));

      motionPath.push({
        timeMs,
        leftPct,
        topPct,
        easing: 'linear',
      });
      motionPath.sort((a, b) => a.timeMs - b.timeMs);

      return {
        ...action,
        payload: {
          ...payload,
          motionPath,
        },
      };
    });
  }, [currentTimelineTimeMs, timelineEntriesByActionId, updateActionById]);

  const removeMotionKeyframeAtPreview = useCallback((actionId: string, keyframeIndex: number) => {
    updateActionById(actionId, (action) => {
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      const motionPath = Array.isArray(payload.motionPath)
        ? [...(payload.motionPath as MotionKeyframe[])]
        : [];
      if (keyframeIndex < 0 || keyframeIndex >= motionPath.length) return action;
      motionPath.splice(keyframeIndex, 1);
      return {
        ...action,
        payload: {
          ...payload,
          motionPath,
        },
      };
    });
  }, [updateActionById]);

  const toggleMotionKeyframeFlipAtPreview = useCallback((actionId: string, keyframeIndex: number, axis: 'h' | 'v') => {
    updateActionById(actionId, (action) => {
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      const motionPath = Array.isArray(payload.motionPath)
        ? [...(payload.motionPath as MotionKeyframe[])]
        : [];
      if (keyframeIndex < 0 || keyframeIndex >= motionPath.length) return action;
      const keyframe = motionPath[keyframeIndex];
      const nextValue = axis === 'h' ? !Boolean(keyframe.flipH) : !Boolean(keyframe.flipV);
      motionPath[keyframeIndex] = {
        ...keyframe,
        ...(axis === 'h' ? { flipH: nextValue } : { flipV: nextValue }),
      };
      return {
        ...action,
        payload: {
          ...payload,
          motionPath,
        },
      };
    });
  }, [updateActionById]);

  const updateMotionKeyframeHoldAtPreview = useCallback((actionId: string, keyframeIndex: number, holdMs: number) => {
    updateActionById(actionId, (action) => {
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      const motionPath = Array.isArray(payload.motionPath)
        ? [...(payload.motionPath as MotionKeyframe[])]
        : [];
      if (keyframeIndex < 0 || keyframeIndex >= motionPath.length) return action;
      motionPath[keyframeIndex] = {
        ...motionPath[keyframeIndex],
        holdMs: Math.max(0, Math.round(holdMs)),
      };
      return {
        ...action,
        payload: {
          ...payload,
          motionPath,
        },
      };
    });
  }, [updateActionById]);

  const toggleMotionKeyframeOscillationPauseAtPreview = useCallback((actionId: string, keyframeIndex: number) => {
    updateActionById(actionId, (action) => {
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      const motionPath = Array.isArray(payload.motionPath)
        ? [...(payload.motionPath as MotionKeyframe[])]
        : [];
      if (keyframeIndex < 0 || keyframeIndex >= motionPath.length) return action;
      const keyframe = motionPath[keyframeIndex];
      motionPath[keyframeIndex] = {
        ...keyframe,
        pauseOscillationDuringHold: !Boolean(keyframe.pauseOscillationDuringHold),
      };
      return {
        ...action,
        payload: {
          ...payload,
          motionPath,
        },
      };
    });
  }, [updateActionById]);

  const propagateMotionKeyframeFlipFromPreview = useCallback((actionId: string, keyframeIndex: number, axis: 'h' | 'v') => {
    updateActionById(actionId, (action) => {
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      const motionPath = Array.isArray(payload.motionPath)
        ? [...(payload.motionPath as MotionKeyframe[])]
        : [];
      if (keyframeIndex < 0 || keyframeIndex >= motionPath.length) return action;

      const axisField = axis === 'h' ? 'flipH' : 'flipV';
      const nextValue = !Boolean(motionPath[keyframeIndex][axisField]);

      for (let i = keyframeIndex; i < motionPath.length; i += 1) {
        motionPath[i] = {
          ...motionPath[i],
          ...(axis === 'h' ? { flipH: nextValue } : { flipV: nextValue }),
        };
      }

      return {
        ...action,
        payload: {
          ...payload,
          motionPath,
        },
      };
    });
  }, [updateActionById]);

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
        durationMs: 2500,
      },
    };
    setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
    setSelectedActionId(next.id);
  }, [draft.actions.length, setDraft, setSelectedActionId]);

  const measureAudioBlobDurationMs = useCallback((blob: Blob): Promise<number | undefined> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      let settled = false;

      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
      };

      const finish = (value?: number) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const timeoutId = window.setTimeout(() => {
        window.clearTimeout(timeoutId);
        finish(undefined);
      }, 10000);

      audio.onloadedmetadata = () => {
        window.clearTimeout(timeoutId);
        const durationMs = toPositiveDurationMs(audio.duration * 1000);
        finish(durationMs);
      };

      audio.onerror = () => {
        window.clearTimeout(timeoutId);
        finish(undefined);
      };

      audio.preload = 'metadata';
      audio.src = url;
      audio.load();
    });
  }, []);

  const handleCreateAudioAction = useCallback((selection: SoundSourceSelection) => {
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;

    let next: SceneActionDto;

    if (selection.sourceType === 'song') {
      next = {
        id: uuidv4(),
        type: 'playMusic',
        delay: 0,
        payload: {
          ...emptyPayload('playMusic'),
          songId: selection.sourceId,
          playlistId: '',
          displayName: selection.sourceName,
        },
      };
    } else if (selection.sourceType === 'playlist') {
      next = {
        id: uuidv4(),
        type: 'playMusic',
        delay: 0,
        payload: {
          ...emptyPayload('playMusic'),
          songId: '',
          playlistId: selection.sourceId,
          displayName: selection.sourceName,
        },
      };
    } else if (selection.sourceType === 'preset') {
      next = {
        id: uuidv4(),
        type: 'playPreset',
        delay: 0,
        payload: {
          ...emptyPayload('playPreset'),
          presetId: selection.sourceId,
          displayName: selection.sourceName,
        },
      };
    } else {
      next = {
        id: uuidv4(),
        type: 'playSound',
        delay: 0,
        payload: {
          ...emptyPayload('playSound'),
          effectId: selection.sourceId,
          displayName: selection.sourceName,
        },
      };
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      actions: [...currentDraft.actions, next],
    }));
    setSelectedActionId(next.id);

    if (selection.sourceType === 'song') {
      const songId = selection.sourceId;
      const actionId = next.id;
      const campaignScopeId = activeCampaign?.id ?? campaignId ?? null;
      void (async () => {
        try {
          const query = campaignScopeId ? `?campaignId=${campaignScopeId}` : '';
          const response = await api.get(`/soundtrack/songs/${songId}/stream${query}`, {
            headers: getAuthHeaders(),
            responseType: 'blob',
          });
          const measuredDurationMs = await measureAudioBlobDurationMs(response.data);
          if (!measuredDurationMs) return;
          updateActionById(actionId, (action) => {
            if (action.type !== 'playMusic') return action;
            const payload = (action.payload ?? {}) as Record<string, unknown>;
            if (toPositiveDurationMs(payload.durationMs) !== undefined) return action;
            return {
              ...action,
              payload: {
                ...payload,
                durationMs: measuredDurationMs,
              },
            };
          });
        } catch {
          // keep default timeline duration if metadata is unavailable
        }
      })();
    }
  }, [
    draft.actions.length,
    setDraft,
    setSelectedActionId,
    activeCampaign?.id,
    campaignId,
    measureAudioBlobDurationMs,
    updateActionById,
  ]);

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

  useEffect(() => {
    if (!open) {
      setVideoPreviewUrlsByActionId({});
      setVideoPreviewErrorsByActionId({});
      return;
    }

    let active = true;

    const resolveVideoPreviewUrls = async () => {
      const nextUrlsByActionId: Record<string, string> = {};
      const nextErrorsByActionId: Record<string, string> = {};

      for (const source of videoActionSources) {
        if (source.directVideoUrl) {
          nextUrlsByActionId[source.actionId] = resolveSceneMediaUrl(source.directVideoUrl);
          continue;
        }

        if (!source.videoAssetId) continue;

        const nowMs = Date.now();
        const cached = signedVideoUrlCacheRef.current.get(source.videoAssetId);
        if (cached && cached.expiresAtMs > nowMs + 15000) {
          nextUrlsByActionId[source.actionId] = resolveSceneMediaUrl(cached.url);
          continue;
        }

        try {
          const signed = await createSceneVideoSignedUrl(source.videoAssetId, 600);
          const expiresAtRaw = Number(signed.expiresAt);
          const expiresAtMs = Number.isFinite(expiresAtRaw)
            ? (expiresAtRaw > 1_000_000_000_000 ? expiresAtRaw : expiresAtRaw * 1000)
            : (nowMs + 600000);

          signedVideoUrlCacheRef.current.set(source.videoAssetId, {
            url: signed.url,
            expiresAtMs,
          });
          nextUrlsByActionId[source.actionId] = resolveSceneMediaUrl(signed.url);
        } catch (err: any) {
          nextErrorsByActionId[source.actionId] = String(
            err?.response?.data?.message ?? err?.message ?? 'No se pudo generar URL de preview de video.',
          );
        }
      }

      if (!active) return;
      setVideoPreviewUrlsByActionId(nextUrlsByActionId);
      setVideoPreviewErrorsByActionId(nextErrorsByActionId);
    };

    void resolveVideoPreviewUrls();

    return () => {
      active = false;
    };
  }, [
    open,
    videoActionSources,
    signedVideoUrlCacheRef,
    setVideoPreviewUrlsByActionId,
    setVideoPreviewErrorsByActionId,
  ]);
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
  const handleDropAssetOnTimeline = (info: { dragPayload: string; trackKey: string; startMs: number; clientX: number; clientY: number }) => {
    const draggedVideoAssetId = fromVideoDragPayload(info.dragPayload);
    const draggedImage = fromImageDragPayload(info.dragPayload);
    if (!draggedVideoAssetId && !draggedImage) return;
    if (draft.actions.length >= SCENE_MAX_ACTIONS) return;

    // Determinar ventana a partir de trackKey
    let windowKind: ScenePreviewWindowKind = 'projection';
    if (info.trackKey.startsWith('window.')) {
      const k = info.trackKey.split('.')[1];
      if (k === 'main' || k === 'projection' || k === 'skyline') windowKind = k;
    }

    if (draggedImage) {
      const next: SceneActionDto = {
        id: uuidv4(),
        type: 'sendImageToWindow',
        delay: 0,
        targetWindow: { kind: windowKind },
        payload: {
          ...emptyPayload('sendImageToWindow'),
          imageUrl: draggedImage.url,
          imageAssetName: draggedImage.label,
          timelineStartMs: info.startMs,
        },
      };
      setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
      setSelectedActionId(next.id);
      return;
    }

    if (!draggedVideoAssetId) return;

    const next = {
      ...createVideoActionFromAsset(draggedVideoAssetId),
      targetWindow: { kind: windowKind },
      payload: {
        ...createVideoActionFromAsset(draggedVideoAssetId).payload,
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

  const startLayerDrag = (action: SceneActionDto, mode: 'move' | 'resize', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.button !== 0) return;

    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const placement = action.type === 'setNarrativeText'
      ? getPlacementFromPayload(payload)
      : {
          leftPct: normalizeFreePlacement(payload.leftPct, 10),
          topPct: normalizeFreePlacement(payload.topPct, 10),
          widthPct: Math.max(1, normalizeFreePlacement(payload.widthPct, 80)),
          heightPct: Math.max(1, normalizeFreePlacement(payload.heightPct, 80)),
        };

    layerDragRef.current = {
      actionId: action.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originLeftPct: placement.leftPct,
      originTopPct: placement.topPct,
      originWidthPct: placement.widthPct,
      originHeightPct: placement.heightPct,
    };

    setActiveLayerDragPlacement({
      actionId: action.id,
      leftPct: placement.leftPct,
      topPct: placement.topPct,
      widthPct: placement.widthPct,
      heightPct: placement.heightPct,
    });

    setSelectedActionId(action.id);
  };

  useEffect(() => {
    if (!open) {
      layerDragRef.current = null;
      setActiveLayerDragPlacement(null);
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const drag = layerDragRef.current;
      if (!drag) return;

      const stage = previewStageRef.current;
      if (!stage) return;

      const stageRect = stage.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) return;

      const unscaledWidth = Math.max(1, stage.offsetWidth || Math.round(stageRect.width));
      const unscaledHeight = Math.max(1, stage.offsetHeight || Math.round(stageRect.height));

      // The stage is rendered with CSS transform scale, so rect dimensions are scaled.
      // Convert pointer deltas back to logical (unscaled) stage space for stable drag.
      const effectiveScaleX = stageRect.width / unscaledWidth;
      const effectiveScaleY = stageRect.height / unscaledHeight;
      const logicalStageWidth = stageRect.width / Math.max(0.0001, effectiveScaleX);
      const logicalStageHeight = stageRect.height / Math.max(0.0001, effectiveScaleY);

      const deltaXPct = ((event.clientX - drag.startX) / logicalStageWidth) * 100;
      const deltaYPct = ((event.clientY - drag.startY) / logicalStageHeight) * 100;

      let nextPlacement = {
        actionId: drag.actionId,
        leftPct: drag.originLeftPct,
        topPct: drag.originTopPct,
        widthPct: drag.originWidthPct,
        heightPct: drag.originHeightPct,
      };

      if (drag.mode === 'move') {
        const movedLeft = snapPct(drag.originLeftPct + deltaXPct);
        const movedTop = snapPct(drag.originTopPct + deltaYPct);
        const clamped = clampLayerMoveInsideStage(
          movedLeft,
          movedTop,
          drag.originWidthPct,
          drag.originHeightPct,
        );
        nextPlacement = {
          ...nextPlacement,
          leftPct: clamped.leftPct,
          topPct: clamped.topPct,
        };
      } else {
        const rawWidth = drag.originWidthPct + deltaXPct;
        const rawHeight = drag.originHeightPct + deltaYPct;
        const aspectRatio = drag.originHeightPct > 0
          ? drag.originWidthPct / drag.originHeightPct
          : 1;

        let resizedWidth = rawWidth;
        let resizedHeight = rawHeight;

        if (event.shiftKey) {
          const widthDominant = Math.abs(deltaXPct) >= Math.abs(deltaYPct);
          if (widthDominant) {
            resizedWidth = rawWidth;
            resizedHeight = aspectRatio > 0 ? (resizedWidth / aspectRatio) : rawHeight;
          } else {
            resizedHeight = rawHeight;
            resizedWidth = resizedHeight * aspectRatio;
          }
        }

        resizedWidth = snapPct(resizedWidth);
        resizedHeight = snapPct(resizedHeight);
        const clampedSize = clampLayerSizeInsideStage(
          resizedWidth,
          resizedHeight,
          drag.originLeftPct,
          drag.originTopPct,
        );
        nextPlacement = {
          ...nextPlacement,
          widthPct: clampedSize.widthPct,
          heightPct: clampedSize.heightPct,
        };
      }

      setActiveLayerDragPlacement(nextPlacement);
      updateActionById(drag.actionId, (currentAction) => ({
        ...currentAction,
        payload: {
          ...(currentAction.payload ?? {}),
          leftPct: nextPlacement.leftPct,
          topPct: nextPlacement.topPct,
          widthPct: nextPlacement.widthPct,
          heightPct: nextPlacement.heightPct,
        },
      }));
    };

    const stopDrag = () => {
      if (!layerDragRef.current) return;
      layerDragRef.current = null;
      setActiveLayerDragPlacement(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDrag);
      layerDragRef.current = null;
      setActiveLayerDragPlacement(null);
    };
  }, [open, previewStageRef, layerDragRef, setActiveLayerDragPlacement, updateActionById]);

  useEffect(() => {
    if (!layerDragRef.current) return;
    layerDragRef.current = null;
    setActiveLayerDragPlacement(null);
  }, [previewZoom, open, setActiveLayerDragPlacement, layerDragRef]);

  useEffect(() => {
    if (!open) {
      keyframeDragRef.current = null;
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const drag = keyframeDragRef.current;
      if (!drag) return;

      const stage = previewStageRef.current;
      if (!stage) return;

      const stageRect = stage.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) return;

      const unscaledWidth = Math.max(1, stage.offsetWidth || Math.round(stageRect.width));
      const unscaledHeight = Math.max(1, stage.offsetHeight || Math.round(stageRect.height));
      const effectiveScaleX = stageRect.width / unscaledWidth;
      const effectiveScaleY = stageRect.height / unscaledHeight;
      const logicalStageWidth = stageRect.width / Math.max(0.0001, effectiveScaleX);
      const logicalStageHeight = stageRect.height / Math.max(0.0001, effectiveScaleY);

      const deltaXPct = ((event.clientX - drag.startX) / logicalStageWidth) * 100;
      const deltaYPct = ((event.clientY - drag.startY) / logicalStageHeight) * 100;
      const nextLeftPct = Math.max(-200, Math.min(200, snapPct(drag.originLeftPct + deltaXPct)));
      const nextTopPct = Math.max(-200, Math.min(200, snapPct(drag.originTopPct + deltaYPct)));

      updateActionById(drag.actionId, (action) => {
        const payload = (action.payload ?? {}) as Record<string, unknown>;
        const motionPath = Array.isArray(payload.motionPath)
          ? [...(payload.motionPath as MotionKeyframe[])]
          : [];
        if (drag.keyframeIndex < 0 || drag.keyframeIndex >= motionPath.length) return action;
        motionPath[drag.keyframeIndex] = {
          ...motionPath[drag.keyframeIndex],
          leftPct: nextLeftPct,
          topPct: nextTopPct,
        };
        return {
          ...action,
          payload: {
            ...payload,
            motionPath,
          },
        };
      });
    };

    const stopDrag = () => {
      if (!keyframeDragRef.current) return;
      keyframeDragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDrag);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDrag);
      keyframeDragRef.current = null;
    };
  }, [open, previewStageRef, updateActionById]);

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
    const draggedImage = fromImageDragPayload(draggedData);
    const targetAction = draft.actions[targetIndex];

    if (draggedAssetId && targetAction.type === 'sendVideoToWindow') {
      updateAction(targetIndex, assignVideoAssetToAction(targetAction, draggedAssetId));
      setSelectedActionId(targetAction.id);
      return;
    }

    if (draggedImage && (targetAction.type === 'sendImageToWindow' || targetAction.type === 'setWindowBackground')) {
      updateAction(targetIndex, {
        ...targetAction,
        payload: {
          ...(targetAction.payload ?? {}),
          imageUrl: draggedImage.url,
          ...(targetAction.type === 'sendImageToWindow' ? { imageAssetName: draggedImage.label } : {}),
        },
      });
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

  if (!open) return null;

  const sections = (
    <>
      <DialogTitle sx={{ py: 1.25, px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ flexShrink: 0 }}>
            <ShortcutThumbnailPreview
              icon={draft.icon}
              imageUrl={draft.imageUrl}
              name={draft.name || 'Escena'}
              onClick={() => setIconPickerOpen(true)}
              hideLabel={true}
            />
            </Box>
            <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Nombre *"
                size="small"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                inputProps={{ maxLength: 80 }}
                sx={{ flex: 1 }}
              />
              <FormControl size="small" sx={{ width: 132 }}>
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

          <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 1, flexShrink: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mr: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                Escena en loop
              </Typography>
              <Switch
                checked={Boolean(draft.loop)}
                onChange={(event) => handleToggleSceneLoop(event.target.checked)}
              />
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mr: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                Tomar control de musica
              </Typography>
              <Switch
                checked={Boolean(draft.takeOverMusicOnStart)}
                onChange={(event) => setDraft((d) => ({ ...d, takeOverMusicOnStart: event.target.checked }))}
              />
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mr: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                Restaurar musica previa
              </Typography>
              <Switch
                checked={Boolean(draft.restorePreviousMusicOnFinish)}
                onChange={(event) => setDraft((d) => ({ ...d, restorePreviousMusicOnFinish: event.target.checked }))}
              />
            </Stack>
            <Button onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ flex: 1, minHeight: 0 }}>
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

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: '280px minmax(0, 1fr)',
                lg: '320px minmax(0, 1fr) 420px',
                xl: '360px minmax(0, 1fr) 460px',
              },
              gap: 1.5,
              minHeight: 0,
              flex: 1,
            }}
          >
            <SceneToolsPanel
              campaignId={campaignId}
              actionsCount={draft.actions.length}
              maxActions={SCENE_MAX_ACTIONS}
              contextualMenu={contextualMenu}
              setContextualMenu={setContextualMenu}
              leftToolPanelMode={leftToolPanelMode}
              setLeftToolPanelMode={setLeftToolPanelMode}
              onCreateNarrativeAction={handleCreateNarrativeFromPreset}
              onCreateImageAction={handleCreateImageAction}
              onCreateFilterAction={handleCreateFilterAction}
              onCreateAudioAction={handleCreateAudioAction}
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
                    startMotionKeyframeDrag={startMotionKeyframeDrag}
                    addMotionKeyframeAtPreview={addMotionKeyframeAtPreview}
                    removeMotionKeyframeAtPreview={removeMotionKeyframeAtPreview}
                    toggleMotionKeyframeFlipAtPreview={toggleMotionKeyframeFlipAtPreview}
                    updateMotionKeyframeHoldAtPreview={updateMotionKeyframeHoldAtPreview}
                    toggleMotionKeyframeOscillationPauseAtPreview={toggleMotionKeyframeOscillationPauseAtPreview}
                    propagateMotionKeyframeFlipFromPreview={propagateMotionKeyframeFlipFromPreview}
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
                    isSelectionModifierPressed={isSelectionModifierPressed}
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
    </>
  );

  if (embedded) {
    return (
      <Paper
        variant="outlined"
        sx={{
          height: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          borderRadius: 2,
        }}
      >
        {sections}
      </Paper>
    );
  }

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
      {sections}
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

