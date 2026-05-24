import { useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import ThemeContext from '../ThemeContext';
import API_BASE_URL, { api } from '../apiBase';
import { normalizeShortcut } from '../api/shortcuts';
import { executeScene } from '../api/scenes';
import { listPlaylists, listSongsForCampaign } from '../api/soundtrack';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useGlobalPlayer } from '../components/player/GlobalPlayerContext';
import { useSfxPlayer, type SfxLoopMode } from '../components/player/SfxPlayerContext';
import {
  estimateNarrationDurationMs,
  normalizeNarratorVoiceConfig,
  normalizeNarratorVoiceTarget,
  playNarration,
  type NarratorVoiceConfig,
} from '../components/scenes/utils/narratorPlayback';
import { dispatchSceneWindowCommand, dispatchWindowShortcutAction } from './ipcActions';
import { useSceneClockSync } from '../hooks/useSceneClockSync';
import { getAuthHeaders } from '../utils/auth';
import type { ShortcutActionDefinition } from '../types/actionTypes';
import type { ExecuteSceneResponse, SceneRuntimeCommand } from '../types/scenes';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const toVolume01 = (value: unknown, fallback = 1): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return clamp01(fallback);
  return clamp01(n > 1 ? n / 100 : n);
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const toOptionalNonNegativeNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const toOptionalFilterType = (value: unknown): 'none' | 'lowpass' | 'highpass' | 'bandpass' | undefined => {
  if (value === 'none' || value === 'lowpass' || value === 'highpass' || value === 'bandpass') {
    return value;
  }
  return undefined;
};

const getPayload = (action: ShortcutActionDefinition): Record<string, unknown> => {
  return (action.payload ?? action.config ?? {}) as Record<string, unknown>;
};

const resolveNarrativeText = (payload: Record<string, unknown>): string => {
  const text = payload.text;
  return typeof text === 'string' ? text : '';
};

const resolveNarratorVoiceConfig = (payload: Record<string, unknown>): Partial<NarratorVoiceConfig> | undefined => {
  const rawVoiceConfig = payload.voiceConfig;
  if (!rawVoiceConfig || typeof rawVoiceConfig !== 'object') return undefined;
  return rawVoiceConfig as Partial<NarratorVoiceConfig>;
};

const resolveNarratorVoiceTarget = (payload: Record<string, unknown>): 'main' | 'projection' | 'both' => {
  return normalizeNarratorVoiceTarget(payload.voiceTarget);
};

const songStreamUrl = (songId: string, campaignId?: string | null): string => {
  const base = api.defaults.baseURL || '';
  return campaignId
    ? `${base}/soundtrack/songs/${songId}/stream?campaignId=${campaignId}`
    : `${base}/soundtrack/songs/${songId}/stream`;
};

const asLoopMode = (value: unknown): SfxLoopMode => {
  if (value === 'continuous' || value === 'fixed' || value === 'random' || value === 'once') return value;
  return 'once';
};

const resolveAudioPlaybackWindow = (payload: Record<string, unknown>) => {
  const clipInSec = toOptionalNonNegativeNumber(payload.clipInSec) ?? 0;
  const explicitStartAtSec = toOptionalNonNegativeNumber(payload.startAtSec);
  const startAtSec = explicitStartAtSec === undefined
    ? clipInSec
    : Math.max(clipInSec, explicitStartAtSec);
  const clipOutSecRaw = toOptionalNonNegativeNumber(payload.clipOutSec);
  const clipOutSec = clipOutSecRaw !== undefined && clipOutSecRaw > clipInSec
    ? clipOutSecRaw
    : undefined;
  const clipDurationMs = toOptionalNonNegativeNumber(payload.clipDurationMs);
  const payloadDurationMs = toOptionalNonNegativeNumber(payload.durationMs);

  const candidates: number[] = [];
  if (clipOutSec !== undefined && clipOutSec > startAtSec) {
    candidates.push(Math.round((clipOutSec - startAtSec) * 1000));
  }
  if (clipDurationMs !== undefined && clipDurationMs > 0) {
    candidates.push(Math.round(clipDurationMs));
  }
  if (payloadDurationMs !== undefined && payloadDurationMs > 0) {
    candidates.push(Math.round(payloadDurationMs));
  }

  return {
    startAtSec,
    durationMs: candidates.length > 0 ? Math.min(...candidates) : undefined,
    clipOutSec,
  };
};

const inferCommandDurationMs = (command: SceneRuntimeCommand): number => {
  const payload = command.payload ?? {};
  if (
    command.kind === 'audio.playMusic'
    || command.kind === 'audio.playPreset'
    || command.kind === 'audio.playSound'
  ) {
    const playbackWindow = resolveAudioPlaybackWindow(payload);
    if (playbackWindow.durationMs !== undefined && playbackWindow.durationMs > 0) {
      return playbackWindow.durationMs;
    }
  }

  const durationMs = Number(payload.durationMs);
  if (Number.isFinite(durationMs) && durationMs > 0) return Math.round(durationMs);

  if (command.kind === 'window.sendVideo') {
    const isLoop = Boolean(payload.loop);
    return isLoop ? 6000 : 4000;
  }
  if (command.kind === 'window.sendImage') return 4000;
  if (command.kind === 'narrative.setText') {
    const text = resolveNarrativeText(payload);
    const voiceConfig = resolveNarratorVoiceConfig(payload);
    return Math.max(300, estimateNarrationDurationMs(text, voiceConfig));
  }
  if (command.kind.startsWith('audio.')) return 1200;
  if (command.kind === 'shortcut.execute') return 1000;
  return 900;
};

const inferExecutionDurationMs = (commands: SceneRuntimeCommand[]): number => {
  if (!commands.length) return 0;
  let maxEnd = 0;
  for (const command of commands) {
    const start = Number.isFinite(command.issuedAtOffsetMs) ? command.issuedAtOffsetMs : 0;
    const end = start + inferCommandDurationMs(command);
    if (end > maxEnd) maxEnd = end;
  }
  return Math.max(0, Math.round(maxEnd));
};

const resolveLoopDelayMs = (scene: ExecuteSceneResponse['scene'] | undefined): number => {
  if (!scene?.loop) return 0;

  const minMs = Number(scene.loopDelayRandomMinMs);
  const maxMs = Number(scene.loopDelayRandomMaxMs);
  if (Number.isFinite(minMs) && Number.isFinite(maxMs) && minMs >= 0 && maxMs >= minMs) {
    const range = maxMs - minMs;
    if (range <= 0) return Math.round(minMs);
    return Math.round(minMs + Math.random() * range);
  }

  const fixedMs = Number(scene.loopDelayMs);
  if (Number.isFinite(fixedMs) && fixedMs > 0) {
    return Math.round(fixedMs);
  }

  return 0;
};

const resolveSceneLoopWindow = (
  scene: ExecuteSceneResponse['scene'] | undefined,
  fallbackDurationMs: number,
): { startMs: number; endMs: number; durationMs: number } | null => {
  if (!scene?.loop) return null;

  const startMsRaw = Number(scene.loopWindowStartMs);
  const endMsRaw = Number(scene.loopWindowEndMs);
  if (!Number.isFinite(startMsRaw) || !Number.isFinite(endMsRaw)) return null;

  const roundedStartMs = Math.max(0, Math.round(startMsRaw));
  const roundedEndMs = Math.max(roundedStartMs + 1, Math.round(endMsRaw));
  const boundedStartMs = fallbackDurationMs > 0
    ? Math.min(Math.max(0, fallbackDurationMs - 1), roundedStartMs)
    : roundedStartMs;
  const boundedEndMs = Math.max(boundedStartMs + 1, roundedEndMs);
  if (boundedEndMs <= boundedStartMs) return null;

  return {
    startMs: boundedStartMs,
    endMs: boundedEndMs,
    durationMs: boundedEndMs - boundedStartMs,
  };
};

interface ActiveSceneExecutionController {
  stopped: boolean;
  timerId: number | null;
  audioTimerIds: Set<number>;
  narrationStops: Set<() => void>;
  hasBoundedMusic: boolean;
  audioDeadlineMs: number;
  stopReason?: string;
}

/**
 * Headless bridge that maps shortcut runtime events to concrete app actions.
 */
const ShortcutRuntimeBridge = () => {
  const { i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const { setMode } = useContext(ThemeContext);
  const { current, play, playQueue, stop } = useGlobalPlayer();
  const { items: sfxItems, playSfx, stopSfx, stopAllSfx, setSfxVolume } = useSfxPlayer();
  const { clockOffsetMs: sceneClockOffsetMs } = useSceneClockSync({ enabled: true, pollMs: 60000 });
  const sceneClockOffsetRef = useRef<number>(0);
  const activeSceneExecutionsRef = useRef<Map<string, ActiveSceneExecutionController>>(new Map());
  const sceneAudioPolicyRef = useRef<Map<string, {
    restorePreviousMusicOnFinish: boolean;
    takeOverMusicOnStart: boolean;
  }>>(new Map());
  const scenePreviousMusicRef = useRef<Map<string, { id: string; name: string; size?: number; mimeType?: string } | null>>(new Map());
  const activeMusicTakeoverOrderRef = useRef<string[]>([]);
  const songNameCacheRef = useRef<Map<string, string>>(new Map());
  const songNameCacheCampaignRef = useRef<string | null>(null);
  const currentTrackRef = useRef(current);
  const sfxItemsRef = useRef(sfxItems);

  useEffect(() => {
    currentTrackRef.current = current;
  }, [current]);

  useEffect(() => {
    sfxItemsRef.current = sfxItems;
  }, [sfxItems]);

  useEffect(() => {
    sceneClockOffsetRef.current = sceneClockOffsetMs;
  }, [sceneClockOffsetMs]);

  useEffect(() => {
    try {
      const scaleRaw = localStorage.getItem('app.fontScale');
      if (scaleRaw) {
        const scale = Number(scaleRaw);
        if (!Number.isNaN(scale) && scale > 0) {
          document.documentElement.style.fontSize = `${Math.round(16 * scale)}px`;
        }
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    const runtimeTrace = (executionId: string, stage: string, details?: Record<string, unknown>) => {
      const payload = details ?? {};
      console.info('[scene-runtime]', {
        at: new Date().toISOString(),
        executionId,
        stage,
        ...payload,
      });
    };

    const stopSceneExecution = (executionId: string, reason = 'unspecified') => {
      const controller = activeSceneExecutionsRef.current.get(executionId);
      if (!controller) return;
      controller.stopped = true;
      controller.stopReason = reason;
      runtimeTrace(executionId, 'stop-requested-local', {
        reason,
        activeAudioTimers: controller.audioTimerIds.size,
        audioDeadlineMs: controller.audioDeadlineMs,
      });
      if (controller.timerId !== null) {
        window.clearTimeout(controller.timerId);
        controller.timerId = null;
      }
      controller.audioTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      controller.audioTimerIds.clear();
      controller.narrationStops.forEach((stopNarration) => {
        try {
          stopNarration();
        } catch {
          // no-op
        }
      });
      controller.narrationStops.clear();
    };

    const scheduleAudioStop = (controller: ActiveSceneExecutionController, delayMs: number, stopFn: () => void) => {
      if (!Number.isFinite(delayMs) || delayMs <= 0) return;
      const boundedDelayMs = Math.max(1, Math.round(delayMs));
      controller.audioDeadlineMs = Math.max(controller.audioDeadlineMs, Date.now() + boundedDelayMs);
      const timerId = window.setTimeout(() => {
        controller.audioTimerIds.delete(timerId);
        if (controller.stopped) return;
        stopFn();
      }, boundedDelayMs);
      controller.audioTimerIds.add(timerId);
    };

    const broadcastSceneStopCommand = async (executionId: string) => {
      const baseCommand: SceneRuntimeCommand = {
        actionId: `scene-stop:${executionId}:${Date.now()}`,
        kind: 'scene.stopExecution',
        payload: { executionId },
        executionId,
        issuedAtOffsetMs: 0,
      };

      const targets: Array<SceneRuntimeCommand['targetWindow'] | undefined> = [
        undefined,
        { kind: 'projection' },
        { kind: 'skyline' },
      ];

      await Promise.all(targets.map((targetWindow) => dispatchSceneWindowCommand(
        targetWindow ? { ...baseCommand, targetWindow } : baseCommand,
        activeCampaign?.id,
      )));
    };

    const waitWithController = (controller: ActiveSceneExecutionController, ms: number): Promise<boolean> => {
      if (controller.stopped) return Promise.resolve(false);
      if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve(true);

      return new Promise((resolve) => {
        const timerId = window.setTimeout(() => {
          if (controller.timerId === timerId) {
            controller.timerId = null;
          }
          resolve(!controller.stopped);
        }, ms);
        controller.timerId = timerId;
      });
    };

    const waitForAudioBoundaries = async (controller: ActiveSceneExecutionController): Promise<boolean> => {
      if (controller.stopped) return false;
      const remainingMs = Math.max(0, controller.audioDeadlineMs - Date.now());
      if (remainingMs <= 0) return true;
      return waitWithController(controller, remainingMs);
    };

    const applyAudioControl = (action: ShortcutActionDefinition) => {
      const payload = getPayload(action);
      const audioEl = document.querySelector('audio[data-global-player-audio="true"]') as HTMLAudioElement | null;

      if (action.kind === 'audio.pause') {
        audioEl?.pause();
        return;
      }
      if (action.kind === 'audio.resume') {
        void audioEl?.play?.();
        return;
      }
      if (action.kind === 'audio.setVolume') {
        const value = clamp01(Number(payload.value ?? 1));
        if (audioEl) audioEl.volume = value;
        return;
      }
      if (action.kind === 'audio.adjustVolume') {
        if (!audioEl) return;
        const delta = Number(payload.value ?? 0);
        audioEl.volume = clamp01(audioEl.volume + delta);
        return;
      }
      if (action.kind === 'audio.setMute') {
        if (!audioEl) return;
        audioEl.muted = Boolean(payload.muted);
      }
    };

    const resolveSongNameById = async (songId: string): Promise<string> => {
      const normalizedId = String(songId || '').trim();
      if (!normalizedId) return '';
      const cached = songNameCacheRef.current.get(normalizedId);
      if (cached) return cached;
      if (!activeCampaign?.id) return normalizedId;

      try {
        const songs = await listSongsForCampaign(activeCampaign.id);
        const allSongs = [...(songs.associated || []), ...(songs.reusable || [])];
        songNameCacheRef.current.clear();
        for (const song of allSongs) {
          if (song?.id && song?.name) {
            songNameCacheRef.current.set(song.id, song.name);
          }
        }
        return songNameCacheRef.current.get(normalizedId) || normalizedId;
      } catch {
        return normalizedId;
      }
    };

    const sanitizeTrackLabel = (value: string): string => value.replace(/\s+/g, ' ').trim();

    const playSongById = async (
      songId: string,
      preferredName?: string,
      opts?: { forceLoop?: boolean },
    ) => {
      if (!songId) return;
      const campaignId = activeCampaign?.id;
      const resolvedName = sanitizeTrackLabel(
        (preferredName && preferredName.trim()) ? preferredName : await resolveSongNameById(songId),
      ) || songId;
      await play(
        { id: songId, name: resolvedName },
        async () => {
          await api.post(`/soundtrack/songs/${songId}/played`, null, {
            headers: getAuthHeaders(),
            params: campaignId ? { campaignId } : undefined,
          }).catch(() => {});

          const res = await api.get(songStreamUrl(songId, campaignId), {
            headers: getAuthHeaders(),
            responseType: 'blob',
          });
          return URL.createObjectURL(res.data);
        },
        { forceLoop: opts?.forceLoop ?? true },
      );
    };

    const seekGlobalPlayerAudio = (startAtSec?: number) => {
      if (!Number.isFinite(Number(startAtSec)) || Number(startAtSec) < 0) return;
      const targetSec = Number(startAtSec);
      const audioEl = document.querySelector('audio[data-global-player-audio="true"]') as HTMLAudioElement | null;
      if (!audioEl) return;

      const applySeek = () => {
        try {
          audioEl.currentTime = targetSec;
        } catch {
          // Ignore seek failures for non-seekable states.
        }
      };

      if (audioEl.readyState >= 1) {
        applySeek();
      } else {
        audioEl.addEventListener('loadedmetadata', applySeek, { once: true });
      }
    };

    const resolveMusicRuntimeDurationMs = async (startAtSec?: number): Promise<number | undefined> => {
      const targetStartSec = Number.isFinite(Number(startAtSec)) && Number(startAtSec) >= 0
        ? Number(startAtSec)
        : 0;
      const audioEl = document.querySelector('audio[data-global-player-audio="true"]') as HTMLAudioElement | null;
      if (!audioEl) return undefined;

      const computeDuration = (): number | undefined => {
        const totalSec = Number(audioEl.duration);
        if (!Number.isFinite(totalSec) || totalSec <= 0) return undefined;
        const remainingSec = Math.max(0, totalSec - targetStartSec);
        const ms = Math.round(remainingSec * 1000);
        return ms > 0 ? ms : undefined;
      };

      const immediate = computeDuration();
      if (immediate !== undefined) return immediate;

      return new Promise<number | undefined>((resolve) => {
        const timeoutMs = 2500;
        let settled = false;
        let timeoutId: number | null = null;

        const finish = (value?: number) => {
          if (settled) return;
          settled = true;
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
          audioEl.removeEventListener('loadedmetadata', handleReady);
          audioEl.removeEventListener('durationchange', handleReady);
          resolve(value);
        };

        const handleReady = () => {
          const resolved = computeDuration();
          finish(resolved);
        };

        audioEl.addEventListener('loadedmetadata', handleReady, { once: true });
        audioEl.addEventListener('durationchange', handleReady, { once: true });
        timeoutId = window.setTimeout(() => finish(undefined), timeoutMs);
      });
    };

    const restorePreviousMusic = async (snapshot: { id: string; name: string; size?: number; mimeType?: string } | null) => {
      if (!snapshot?.id) return;
      const campaignId = activeCampaign?.id;
      await play(
        {
          id: snapshot.id,
          name: snapshot.name,
          size: snapshot.size,
          mimeType: snapshot.mimeType,
        },
        async () => {
          const res = await api.get(songStreamUrl(snapshot.id, campaignId), {
            headers: getAuthHeaders(),
            responseType: 'blob',
          });
          return URL.createObjectURL(res.data);
        },
      );
    };

    const handleAudioAction = async (event: Event) => {
      const custom = event as CustomEvent<ShortcutActionDefinition>;
      const action = custom.detail;
      if (!action) return;
      const payload = getPayload(action);

      if (action.kind === 'audio.stop') {
        stop();
        stopAllSfx();
        return;
      }

      if (action.kind === 'audio.playSong') {
        await playSongById(String(payload.songId || ''));
        return;
      }

      if (action.kind === 'audio.playPlaylist') {
        const playlistId = String(payload.playlistId || '');
        await playPlaylistById(playlistId);
        return;
      }

      if (action.kind === 'audio.playPresetEffects') {
        if (!activeCampaign?.id) return;
        const presetId = String(payload.presetId || '');
        if (!presetId) return;
        const res = await api.get(`/soundtrack/presets/campaigns/${activeCampaign.id}`, { headers: getAuthHeaders() });
        const presets = Array.isArray(res.data) ? res.data : [];
        const target = presets.find((preset: any) => preset.id === presetId);
        if (!target?.items?.length) return;

        for (const item of target.items) {
          const effectId = item?.soundEffect?.id;
          const effectName = item?.soundEffect?.name || 'Preset effect';
          if (!effectId) continue;
          await playSfx(
            { effectId, name: effectName },
            async () => {
              const req = await api.get(`${api.defaults.baseURL}/soundtrack/effects/${effectId}/stream?campaignId=${activeCampaign.id}`, {
                headers: getAuthHeaders(),
                responseType: 'blob',
              });
              return URL.createObjectURL(req.data);
            },
            {
              volume: clamp01(Number(item.volume ?? 1)),
              loopMode: asLoopMode(item.loopMode),
              waitMs: item.waitMs ?? undefined,
              randomMinMs: item.randomMinMs ?? undefined,
              randomMaxMs: item.randomMaxMs ?? undefined,
              echoEnabled: Boolean(item.echoEnabled ?? false),
              echoDelayMs: item.echoDelayMs ?? undefined,
              echoFeedback: item.echoFeedback ?? undefined,
              pitchSemitones: item.pitchSemitones ?? undefined,
            },
          );
        }
        return;
      }

      applyAudioControl(action);
    };

    const playPlaylistById = async (playlistId: string) => {
      if (!activeCampaign?.id || !playlistId) return;
      const playlists = await listPlaylists(activeCampaign.id);
      const target = playlists.find((pl) => pl.id === playlistId);
      if (!target?.songs?.length) return;

      const items = target.songs.map((song) => ({ id: song.id, name: song.name }));
      await playQueue(items, async (id: string) => {
        await api.post(`/soundtrack/songs/${id}/played`, null, {
          headers: getAuthHeaders(),
          params: activeCampaign?.id ? { campaignId: activeCampaign.id } : undefined,
        }).catch(() => {});
        const res = await api.get(songStreamUrl(id, activeCampaign.id), {
          headers: getAuthHeaders(),
          responseType: 'blob',
        });
        return URL.createObjectURL(res.data);
      });
    };

    const handleConfigAction = async (event: Event) => {
      const custom = event as CustomEvent<ShortcutActionDefinition>;
      const action = custom.detail;
      if (!action) return;
      const payload = getPayload(action);

      if (action.kind === 'config.setLanguage') {
        const language = String(payload.language || '').trim();
        if (!language) return;
        await i18n.changeLanguage(language);
        try { localStorage.setItem('lang', language); } catch {}
        try {
          await axios.patch(`${API_BASE_URL}/users/me/preferences`, { language }, { headers: getAuthHeaders() });
        } catch {}
        return;
      }

      if (action.kind === 'config.setTheme') {
        const theme = String(payload.theme || '').trim() as 'light' | 'dark' | 'custom';
        if (!theme) return;
        setMode(theme);
        try { localStorage.setItem('theme', theme); } catch {}
        try {
          await axios.patch(`${API_BASE_URL}/users/me/preferences`, { theme }, { headers: getAuthHeaders() });
        } catch {}
        return;
      }

      if (action.kind === 'config.setFontScale') {
        const scale = Number(payload.scale ?? 1);
        if (Number.isNaN(scale)) return;
        const clamped = Math.max(0.7, Math.min(1.8, scale));
        document.documentElement.style.fontSize = `${Math.round(16 * clamped)}px`;
        try { localStorage.setItem('app.fontScale', String(clamped)); } catch {}
        return;
      }

      if (action.kind === 'config.updateSettings') {
        const key = String(payload.key || '').trim();
        if (!key) return;
        try {
          localStorage.setItem(key, JSON.stringify(payload.value));
        } catch {}
      }
    };

    const executeCommandPlan = async (
      execution: ExecuteSceneResponse,
      controller: ActiveSceneExecutionController,
      logicalExecutionId: string,
      loopCycleIndex: number,
    ): Promise<boolean> => {
      const commands = Array.isArray(execution?.commands)
        ? execution.commands.map((command) => ({
          ...command,
          logicalExecutionId,
          loopCycleIndex,
          executionId: execution.executionId,
          scheduleVersion: execution.scheduleVersion,
          serverNowMs: execution.serverNowMs,
          startAtMs: execution.startAtMs,
        }))
        : [];

      commands.sort((left, right) => {
        if (Number.isFinite(left.sequence) && Number.isFinite(right.sequence)) {
          return Number(left.sequence) - Number(right.sequence);
        }
        return left.issuedAtOffsetMs - right.issuedAtOffsetMs;
      });

      const cycleStartedAtMs = Date.now();
      const localReceivedAtMs = Date.now();
      const serverNowMs = Number(execution?.serverNowMs);
      const clockOffsetMs = Number.isFinite(serverNowMs)
        ? serverNowMs - localReceivedAtMs
        : sceneClockOffsetRef.current;

      const fullCycleDurationMs = inferExecutionDurationMs(commands);
      const loopWindow = loopCycleIndex > 0
        ? resolveSceneLoopWindow(execution.scene, fullCycleDurationMs)
        : null;

      const cycleStartExecuteAtMs = Date.now() + clockOffsetMs;
      const plannedCommandsFromWindow: SceneRuntimeCommand[] = loopWindow
        ? commands
          .filter((command) => {
            const commandStartMs = Number.isFinite(command.issuedAtOffsetMs) ? command.issuedAtOffsetMs : 0;
            const commandEndMs = commandStartMs + inferCommandDurationMs(command);
            return commandStartMs < loopWindow.endMs && commandEndMs > loopWindow.startMs;
          })
          .map((command) => {
            const originalOffsetMs = Number.isFinite(command.issuedAtOffsetMs) ? command.issuedAtOffsetMs : 0;
            const shiftedOffsetMs = Math.max(0, Math.round(originalOffsetMs - loopWindow.startMs));

            if (command.kind === 'window.sendVideo' && originalOffsetMs < loopWindow.startMs) {
              const startDeltaSec = Math.max(0, (loopWindow.startMs - originalOffsetMs) / 1000);
              const currentStartAtSec = Number((command.payload as Record<string, unknown>).startAtSec);
              const resolvedStartAtSec = Number.isFinite(currentStartAtSec) && currentStartAtSec >= 0
                ? Math.max(currentStartAtSec, startDeltaSec)
                : startDeltaSec;

              return {
                ...command,
                payload: {
                  ...command.payload,
                  startAtSec: resolvedStartAtSec,
                },
                issuedAtOffsetMs: shiftedOffsetMs,
                executeAtMs: cycleStartExecuteAtMs + shiftedOffsetMs,
              };
            }

            return {
              ...command,
              issuedAtOffsetMs: shiftedOffsetMs,
              executeAtMs: cycleStartExecuteAtMs + shiftedOffsetMs,
            };
          })
        : [];

      const hasWindowCommands = Boolean(loopWindow && plannedCommandsFromWindow.length > 0);
      const plannedCommands = loopWindow
        ? (hasWindowCommands ? plannedCommandsFromWindow : commands)
        : commands;

      const plannedDurationMs = inferExecutionDurationMs(plannedCommands);
      const cycleDurationMs = loopWindow
        ? (hasWindowCommands ? loopWindow.durationMs : plannedDurationMs)
        : plannedDurationMs;
      runtimeTrace(logicalExecutionId, 'cycle-duration-resolved', {
        loopCycleIndex,
        fullCycleDurationMs,
        plannedDurationMs,
        cycleDurationMs,
        commandsTotal: commands.length,
        plannedCommands: plannedCommands.length,
        hasWindowCommands,
      });

      let previousOffset = 0;
      for (const command of plannedCommands) {
        if (controller.stopped) return false;

        const executeAtMs = Number(command.executeAtMs);
        const isWindowBoundCommand = command.kind.startsWith('window.');

        if (!isWindowBoundCommand) {
          let waitMs = 0;
          if (Number.isFinite(executeAtMs)) {
            waitMs = Math.max(0, executeAtMs - (Date.now() + clockOffsetMs));
          } else {
            waitMs = Math.max(0, command.issuedAtOffsetMs - previousOffset);
            previousOffset = command.issuedAtOffsetMs;
          }

          if (waitMs > 0) {
            const shouldContinue = await waitWithController(controller, waitMs);
            if (!shouldContinue) return false;
          }
        }

        if (command.kind === 'audio.playMusic') {
          const songId = typeof command.payload.songId === 'string' ? command.payload.songId : '';
          const playlistId = typeof command.payload.playlistId === 'string' ? command.payload.playlistId : '';
          const commandOffsetMs = Number.isFinite(command.issuedAtOffsetMs) ? command.issuedAtOffsetMs : 0;
          const remainingSceneWindowMs = Math.max(0, cycleDurationMs - commandOffsetMs);
          const playbackWindow = resolveAudioPlaybackWindow(command.payload);
          let boundedDurationMs = playbackWindow.durationMs;
          const displayName = typeof command.payload.displayName === 'string'
            ? sanitizeTrackLabel(command.payload.displayName)
            : '';
          if (songId) {
            await playSongById(songId, displayName || undefined, { forceLoop: false });
            seekGlobalPlayerAudio(playbackWindow.startAtSec);
            if (boundedDurationMs === undefined) {
              boundedDurationMs = await resolveMusicRuntimeDurationMs(playbackWindow.startAtSec);
            }
            if (!execution.scene?.loop && remainingSceneWindowMs > 0) {
              boundedDurationMs = boundedDurationMs === undefined
                ? remainingSceneWindowMs
                : Math.min(boundedDurationMs, remainingSceneWindowMs);
            }
            runtimeTrace(logicalExecutionId, 'music-bounds', {
              loopCycleIndex,
              source: 'song',
              songId,
              commandOffsetMs,
              cycleDurationMs,
              remainingSceneWindowMs,
              clipStartAtSec: playbackWindow.startAtSec,
              clipOutSec: playbackWindow.clipOutSec,
              boundedDurationMs,
            });
            if (boundedDurationMs !== undefined) {
              controller.hasBoundedMusic = true;
              scheduleAudioStop(controller, boundedDurationMs, () => stop());
            } else if (!execution.scene?.loop) {
              // Keep non-loop scenes bounded even when metadata is unavailable.
              controller.hasBoundedMusic = true;
              scheduleAudioStop(controller, Math.max(1500, inferCommandDurationMs(command)), () => stop());
            }
          } else if (playlistId) {
            await playPlaylistById(playlistId);
            if (!execution.scene?.loop && remainingSceneWindowMs > 0) {
              boundedDurationMs = boundedDurationMs === undefined
                ? remainingSceneWindowMs
                : Math.min(boundedDurationMs, remainingSceneWindowMs);
            }
            runtimeTrace(logicalExecutionId, 'music-bounds', {
              loopCycleIndex,
              source: 'playlist',
              playlistId,
              commandOffsetMs,
              cycleDurationMs,
              remainingSceneWindowMs,
              clipStartAtSec: playbackWindow.startAtSec,
              clipOutSec: playbackWindow.clipOutSec,
              boundedDurationMs,
            });
            if (boundedDurationMs !== undefined) {
              controller.hasBoundedMusic = true;
              scheduleAudioStop(controller, boundedDurationMs, () => stop());
            } else if (!execution.scene?.loop) {
              controller.hasBoundedMusic = true;
              scheduleAudioStop(controller, Math.max(1500, inferCommandDurationMs(command)), () => stop());
            }
          }
          continue;
        }

        if (command.kind === 'audio.playPreset') {
          if (!activeCampaign?.id) continue;
          const presetId = typeof command.payload.presetId === 'string' ? command.payload.presetId : '';
          if (!presetId) continue;
          const res = await api.get(`/soundtrack/presets/campaigns/${activeCampaign.id}`, { headers: getAuthHeaders() });
          const presets = Array.isArray(res.data) ? res.data : [];
          const target = presets.find((preset: any) => preset.id === presetId);
          if (!target?.items?.length) continue;

          const presetVolume = toOptionalNumber(command.payload.volume);
          const presetVolumeMultiplier = presetVolume === undefined ? 1 : (presetVolume > 1 ? presetVolume / 100 : presetVolume);
          const presetPlaybackRate = toOptionalNumber(command.payload.playbackRate);
          const presetPitchSemitones = toOptionalNumber(command.payload.pitchSemitones);
          const presetEchoEnabled = command.payload.echoEnabled === undefined
            ? undefined
            : Boolean(command.payload.echoEnabled);
          const presetEchoDelayMs = toOptionalNumber(command.payload.echoDelayMs);
          const presetEchoFeedback = toOptionalNumber(command.payload.echoFeedback);
          const presetFilterType = toOptionalFilterType(command.payload.filterType);
          const presetFilterFrequency = toOptionalNumber(command.payload.filterFrequency);
          const presetFilterQ = toOptionalNumber(command.payload.filterQ);
          const playbackWindow = resolveAudioPlaybackWindow(command.payload);

          for (const item of target.items) {
            const effectId = item?.soundEffect?.id;
            const effectName = item?.soundEffect?.name || 'Preset effect';
            if (!effectId) continue;
            await playSfx(
              { effectId, name: effectName },
              async () => {
                const req = await api.get(`${api.defaults.baseURL}/soundtrack/effects/${effectId}/stream?campaignId=${activeCampaign.id}`, {
                  headers: getAuthHeaders(),
                  responseType: 'blob',
                });
                return URL.createObjectURL(req.data);
              },
              {
                volume: clamp01(toVolume01(item.volume ?? 1) * clamp01(presetVolumeMultiplier)),
                loopMode: asLoopMode(item.loopMode),
                startAtSec: playbackWindow.startAtSec,
                durationMs: playbackWindow.durationMs,
                clipOutSec: playbackWindow.clipOutSec,
                waitMs: item.waitMs ?? undefined,
                randomMinMs: item.randomMinMs ?? undefined,
                randomMaxMs: item.randomMaxMs ?? undefined,
                playbackRate: presetPlaybackRate,
                echoEnabled: presetEchoEnabled ?? Boolean(item.echoEnabled ?? false),
                echoDelayMs: presetEchoDelayMs ?? item.echoDelayMs ?? undefined,
                echoFeedback: presetEchoFeedback ?? item.echoFeedback ?? undefined,
                pitchSemitones: presetPitchSemitones ?? item.pitchSemitones ?? undefined,
                filterType: presetFilterType,
                filterFrequency: presetFilterFrequency,
                filterQ: presetFilterQ,
              },
            );
          }
          continue;
        }

        if (command.kind === 'audio.stopMusic') {
          stop();
          if (Boolean(command.payload.stopEffects)) {
            stopAllSfx();
          }
          continue;
        }

        if (command.kind === 'audio.playSound') {
          const effectId = typeof command.payload.effectId === 'string' ? command.payload.effectId : '';
          if (!effectId) continue;
          const playbackWindow = resolveAudioPlaybackWindow(command.payload);
          await playSfx(
            { effectId, name: effectId },
            async () => {
              const req = await api.get(`${api.defaults.baseURL}/soundtrack/effects/${effectId}/stream?campaignId=${activeCampaign?.id || ''}`, {
                headers: getAuthHeaders(),
                responseType: 'blob',
              });
              return URL.createObjectURL(req.data);
            },
            {
              volume: toVolume01(command.payload.volume, 1),
              loopMode: asLoopMode(command.payload.loopMode),
              startAtSec: playbackWindow.startAtSec,
              durationMs: playbackWindow.durationMs,
              clipOutSec: playbackWindow.clipOutSec,
              waitMs: typeof command.payload.waitMs === 'number' ? command.payload.waitMs : undefined,
              randomMinMs: typeof command.payload.randomMinMs === 'number' ? command.payload.randomMinMs : undefined,
              randomMaxMs: typeof command.payload.randomMaxMs === 'number' ? command.payload.randomMaxMs : undefined,
              playbackRate: toOptionalNumber(command.payload.playbackRate),
              pitchSemitones: toOptionalNumber(command.payload.pitchSemitones),
              echoEnabled: command.payload.echoEnabled === undefined ? undefined : Boolean(command.payload.echoEnabled),
              echoDelayMs: toOptionalNumber(command.payload.echoDelayMs),
              echoFeedback: toOptionalNumber(command.payload.echoFeedback),
              filterType: toOptionalFilterType(command.payload.filterType),
              filterFrequency: toOptionalNumber(command.payload.filterFrequency),
              filterQ: toOptionalNumber(command.payload.filterQ),
            },
          );
          continue;
        }

        if (command.kind === 'audio.stopSound') {
          const effectId = typeof command.payload.effectId === 'string' ? command.payload.effectId.trim() : '';
          if (!effectId) {
            stopAllSfx();
            continue;
          }
          for (const item of sfxItemsRef.current) {
            if (item.effectId === effectId) {
              stopSfx(item.instanceId);
            }
          }
          continue;
        }

        if (command.kind === 'audio.setSoundVolume') {
          const value = toVolume01(command.payload.value, 1);
          const effectId = typeof command.payload.effectId === 'string' ? command.payload.effectId.trim() : '';
          if (!effectId) {
            for (const item of sfxItemsRef.current) {
              setSfxVolume(item.instanceId, value);
            }
            continue;
          }
          for (const item of sfxItemsRef.current) {
            if (item.effectId === effectId) {
              setSfxVolume(item.instanceId, value);
            }
          }
          continue;
        }

        if (command.kind === 'audio.setMusicVolume') {
          applyAudioControl({ kind: 'audio.setVolume', payload: { value: command.payload.value } } as ShortcutActionDefinition);
          continue;
        }

        if (command.kind === 'shortcut.execute') {
          const shortcut = normalizeShortcut(command.payload.shortcut);
          window.dispatchEvent(new CustomEvent('scene:shortcut-command', { detail: { shortcut } }));
          continue;
        }

        if (command.kind === 'narrative.setText') {
          const text = resolveNarrativeText(command.payload);
          const voiceConfig = normalizeNarratorVoiceConfig(resolveNarratorVoiceConfig(command.payload));
          const voiceTarget = resolveNarratorVoiceTarget(command.payload);
          const commandOffsetMs = Number.isFinite(command.issuedAtOffsetMs) ? command.issuedAtOffsetMs : 0;
          const remainingSceneWindowMs = Math.max(0, cycleDurationMs - commandOffsetMs);
          const shouldPlayOnMainWindow = voiceTarget === 'main' || voiceTarget === 'both';

          runtimeTrace(logicalExecutionId, 'narrative-command-received', {
            loopCycleIndex,
            commandOffsetMs,
            cycleDurationMs,
            remainingSceneWindowMs,
            voiceTarget,
            shouldPlayOnMainWindow,
            voiceMode: voiceConfig.mode,
            qwenPersona: voiceConfig.qwen?.persona,
            qwenPitchMul: voiceConfig.qwen?.pitchMul,
            qwenSpeedMs: voiceConfig.qwen?.speedMs,
            qwenBrightness: voiceConfig.qwen?.brightness,
            qwenVolume: voiceConfig.qwen?.volume,
            qwenJitter: voiceConfig.qwen?.jitter,
            qwenTransitionMul: voiceConfig.qwen?.transitionMul,
            qwenVowelGlitch: voiceConfig.qwen?.vowelGlitch,
            textLength: text.length,
          });

          if (shouldPlayOnMainWindow && text.trim().length > 0) {
            const narration = await playNarration({ text, voiceConfig, locale: i18n.language });
            controller.narrationStops.add(narration.stop);
            void narration.finished.finally(() => {
              controller.narrationStops.delete(narration.stop);
            });

            const boundedNarrationMs = remainingSceneWindowMs > 0
              ? Math.min(narration.durationMs, remainingSceneWindowMs)
              : narration.durationMs;
            if (boundedNarrationMs > 0) {
              scheduleAudioStop(controller, boundedNarrationMs, () => {
                if (controller.narrationStops.has(narration.stop)) {
                  narration.stop();
                }
              });
            }

            runtimeTrace(logicalExecutionId, 'narrative-voice-playback', {
              loopCycleIndex,
              commandOffsetMs,
              cycleDurationMs,
              remainingSceneWindowMs,
              boundedNarrationMs,
              voiceTarget,
              voiceMode: voiceConfig.mode,
              voiceSpeed: voiceConfig.speed,
              voicePitchRange: voiceConfig.pitchRange,
              qwenPersona: voiceConfig.qwen?.persona,
              qwenPitchMul: voiceConfig.qwen?.pitchMul,
              qwenSpeedMs: voiceConfig.qwen?.speedMs,
              qwenBrightness: voiceConfig.qwen?.brightness,
              qwenVolume: voiceConfig.qwen?.volume,
              qwenJitter: voiceConfig.qwen?.jitter,
              qwenTransitionMul: voiceConfig.qwen?.transitionMul,
              qwenVowelGlitch: voiceConfig.qwen?.vowelGlitch,
              textLength: text.length,
            });
          } else {
            runtimeTrace(logicalExecutionId, 'narrative-voice-skipped-main-window', {
              loopCycleIndex,
              voiceTarget,
              shouldPlayOnMainWindow,
              textLength: text.length,
              reason: text.trim().length === 0 ? 'empty-text' : 'voice-target-not-main',
            });
          }

          await dispatchSceneWindowCommand(command as SceneRuntimeCommand, activeCampaign?.id);
          continue;
        }

        await dispatchSceneWindowCommand(command as SceneRuntimeCommand, activeCampaign?.id);
      }

      const elapsedMs = Date.now() - cycleStartedAtMs;
      const remainingMs = Math.max(0, cycleDurationMs - elapsedMs);
      if (remainingMs > 0) {
        const shouldContinue = await waitWithController(controller, remainingMs);
        if (!shouldContinue) return false;
      }

      return !controller.stopped;
    };

    const handleSceneRuntimeExecute = async (event: Event) => {
      const custom = event as CustomEvent<ExecuteSceneResponse>;
      const initialExecution = custom.detail;
      console.info('[scene-runtime]', {
        at: new Date().toISOString(),
        executionId: String(initialExecution?.executionId || 'missing'),
        stage: 'runtime-event-received',
        hasDetail: Boolean(initialExecution),
        rawStatus: initialExecution?.status,
        rawSceneId: initialExecution?.scene?.id ?? null,
        rawCommands: Array.isArray(initialExecution?.commands) ? initialExecution.commands.length : null,
      });
      const logicalExecutionId = String(initialExecution?.executionId || '');
      if (!logicalExecutionId) return;

      runtimeTrace(logicalExecutionId, 'execution-start', {
        sceneId: initialExecution.scene?.id ?? null,
        sceneName: initialExecution.scene?.name ?? null,
        sceneLoop: Boolean(initialExecution.scene?.loop),
        commands: Array.isArray(initialExecution.commands) ? initialExecution.commands.length : 0,
        status: initialExecution.status,
      });

      stopSceneExecution(logicalExecutionId, 'replace-existing-execution');

      const controller: ActiveSceneExecutionController = {
        stopped: false,
        timerId: null,
        audioTimerIds: new Set<number>(),
        narrationStops: new Set<() => void>(),
        hasBoundedMusic: false,
        audioDeadlineMs: 0,
      };
      activeSceneExecutionsRef.current.set(logicalExecutionId, controller);

      const shouldTakeOverMusic = Boolean(initialExecution.scene?.takeOverMusicOnStart);
      const shouldRestoreMusic = initialExecution.scene?.restorePreviousMusicOnFinish !== false;
      sceneAudioPolicyRef.current.set(logicalExecutionId, {
        restorePreviousMusicOnFinish: shouldRestoreMusic,
        takeOverMusicOnStart: shouldTakeOverMusic,
      });

      if (shouldTakeOverMusic) {
        activeMusicTakeoverOrderRef.current = activeMusicTakeoverOrderRef.current.filter((id) => id !== logicalExecutionId);
        activeMusicTakeoverOrderRef.current.push(logicalExecutionId);
        scenePreviousMusicRef.current.set(
          logicalExecutionId,
          currentTrackRef.current
            ? {
                id: currentTrackRef.current.id,
                name: currentTrackRef.current.name,
                size: currentTrackRef.current.size,
                mimeType: currentTrackRef.current.mimeType,
              }
            : null,
        );
        stop();
      } else {
        scenePreviousMusicRef.current.set(logicalExecutionId, null);
      }

      window.dispatchEvent(new CustomEvent('scene:execution-started', {
        detail: {
          executionId: logicalExecutionId,
          sceneId: initialExecution.scene?.id,
          sceneName: initialExecution.scene?.name,
          icon: initialExecution.scene?.icon ?? null,
          imageUrl: initialExecution.scene?.imageUrl ?? null,
          loop: Boolean(initialExecution.scene?.loop),
          startedAtMs: Date.now(),
        },
      }));

      let currentExecution: ExecuteSceneResponse | null = initialExecution;
      let loopCycleIndex = 0;

      try {
        while (currentExecution && !controller.stopped) {
          const cycleCompleted = await executeCommandPlan(
            currentExecution,
            controller,
            logicalExecutionId,
            loopCycleIndex,
          );
          if (!cycleCompleted || controller.stopped) break;

          if (!currentExecution.scene?.loop) {
            break;
          }

          const delayMs = resolveLoopDelayMs(currentExecution.scene);
          if (delayMs > 0) {
            const shouldContinue = await waitWithController(controller, delayMs);
            if (!shouldContinue) break;
          }

          if (!currentExecution.scene?.id) break;
          currentExecution = await executeScene(currentExecution.scene.id);
          loopCycleIndex += 1;
        }
      } catch {
        // Execution failures are surfaced by normal error UX and should not break bridge subscriptions.
      } finally {
        if (!controller.stopped) {
          await waitForAudioBoundaries(controller);
        }

        const wasStopped = controller.stopped;
        activeSceneExecutionsRef.current.delete(logicalExecutionId);
        const policy = sceneAudioPolicyRef.current.get(logicalExecutionId);
        const previousMusic = scenePreviousMusicRef.current.get(logicalExecutionId) ?? null;

        if (policy?.takeOverMusicOnStart) {
          activeMusicTakeoverOrderRef.current = activeMusicTakeoverOrderRef.current
            .filter((id) => id !== logicalExecutionId);
        }

        const hasPendingTakeover = activeMusicTakeoverOrderRef.current.length > 0;
        sceneAudioPolicyRef.current.delete(logicalExecutionId);
        scenePreviousMusicRef.current.delete(logicalExecutionId);

        if (!wasStopped && controller.hasBoundedMusic && !initialExecution.scene?.loop) {
          stop();
        }

        if (
          policy?.restorePreviousMusicOnFinish
          && policy.takeOverMusicOnStart
          && previousMusic
          && !hasPendingTakeover
        ) {
          try {
            await restorePreviousMusic(previousMusic);
          } catch {
            // ignore restore failures, scene completion should remain successful
          }
        }

        window.dispatchEvent(new CustomEvent(wasStopped ? 'scene:execution-stopped' : 'scene:execution-completed', {
          detail: {
            executionId: logicalExecutionId,
            sceneId: initialExecution.scene?.id,
          },
        }));

        runtimeTrace(logicalExecutionId, wasStopped ? 'execution-stopped' : 'execution-completed', {
          sceneId: initialExecution.scene?.id ?? null,
          sceneLoop: Boolean(initialExecution.scene?.loop),
          stopReason: controller.stopReason ?? null,
          hasBoundedMusic: controller.hasBoundedMusic,
          audioDeadlineMs: controller.audioDeadlineMs,
          activeNarrationVoices: controller.narrationStops.size,
          pendingAudioTimers: controller.audioTimerIds.size,
        });
      }
    };

    const handleStopRequest = (event: Event) => {
      const custom = event as CustomEvent<{ executionId?: string }>;
      const executionId = String(custom.detail?.executionId || '');
      if (!executionId) return;
      stopSceneExecution(executionId, 'event-scene-execution-stop-request');
      void broadcastSceneStopCommand(executionId);
    };

    window.addEventListener('shortcut:audio-action', handleAudioAction as EventListener);
    window.addEventListener('shortcut:config-action', handleConfigAction as EventListener);
    window.addEventListener('scene:runtime-execute', handleSceneRuntimeExecute as EventListener);
    window.addEventListener('scene:execution-stop-request', handleStopRequest as EventListener);

    return () => {
      window.removeEventListener('shortcut:audio-action', handleAudioAction as EventListener);
      window.removeEventListener('shortcut:config-action', handleConfigAction as EventListener);
      window.removeEventListener('scene:runtime-execute', handleSceneRuntimeExecute as EventListener);
      window.removeEventListener('scene:execution-stop-request', handleStopRequest as EventListener);
      activeSceneExecutionsRef.current.forEach((controller) => {
        controller.stopped = true;
        controller.stopReason = 'bridge-cleanup';
        if (controller.timerId !== null) {
          window.clearTimeout(controller.timerId);
          controller.timerId = null;
        }
        controller.audioTimerIds.forEach((timerId) => window.clearTimeout(timerId));
        controller.audioTimerIds.clear();
        controller.narrationStops.forEach((stopNarration) => {
          try {
            stopNarration();
          } catch {
            // no-op
          }
        });
        controller.narrationStops.clear();
      });
      activeSceneExecutionsRef.current.clear();
      activeMusicTakeoverOrderRef.current = [];
    };
  }, [activeCampaign?.id, i18n, play, playQueue, playSfx, setMode, setSfxVolume, stop, stopAllSfx, stopSfx]);

  useEffect(() => {
    const handleCalendarAction = async (event: Event) => {
      const custom = event as CustomEvent<ShortcutActionDefinition>;
      const action = custom.detail;
      if (!action || !activeCampaign?.id) return;
      if (action.kind !== 'time.advanceDay' && action.kind !== 'time.rewindDay') return;

      try {
        const { getDiaryCalendar, updateCurrentDay } = await import('../api/diary/diaryApi');
        const calendar = await getDiaryCalendar(activeCampaign.id);
        const config = calendar?.config;
        if (!config?.months?.length) return;

        const direction = action.kind === 'time.advanceDay' ? 1 : -1;
        const monthIndex = Number(config.currentMonthIndex || 0);
        const day = Number(config.currentDayIndex || 1);
        const monthDays = Number(config.months[monthIndex]?.days || 30);

        let nextMonth = monthIndex;
        let nextDay = day + direction;
        if (nextDay < 1) {
          nextMonth = (monthIndex - 1 + config.months.length) % config.months.length;
          nextDay = Number(config.months[nextMonth]?.days || 30);
        } else if (nextDay > monthDays) {
          nextMonth = (monthIndex + 1) % config.months.length;
          nextDay = 1;
        }

        await updateCurrentDay(activeCampaign.id, nextMonth, nextDay);
      } catch {
        // no-op
      }
    };

    window.addEventListener('shortcut:calendar-action', handleCalendarAction as EventListener);
    return () => {
      window.removeEventListener('shortcut:calendar-action', handleCalendarAction as EventListener);
    };
  }, [activeCampaign?.id]);

  useEffect(() => {
    const dispatchProjectionEvents = (action?: ShortcutActionDefinition) => {
      if (!action) return;
      if (action.kind === 'window.showText') {
        try {
          window.dispatchEvent(new CustomEvent('projection:show-text', { detail: action.payload ?? {} }));
        } catch {
          // no-op
        }
      }
      if (action.kind === 'window.applyFilter' || action.kind === 'window.clearFilter') {
        try {
          window.dispatchEvent(new CustomEvent('projection:filter', { detail: action }));
        } catch {
          // no-op
        }
      }
    };

    const handleWindowAction = (event: Event) => {
      const custom = event as CustomEvent<{ action?: ShortcutActionDefinition } | ShortcutActionDefinition>;
      const detail = custom.detail;
      const action = (detail && 'kind' in (detail as any))
        ? detail as ShortcutActionDefinition
        : (detail as { action?: ShortcutActionDefinition } | undefined)?.action;
      dispatchProjectionEvents(action);
    };

    const unsubscribe = window.electronAPI?.onShortcutWindowAction?.((payload: { action?: ShortcutActionDefinition } | ShortcutActionDefinition) => {
      const action = (payload && 'kind' in (payload as any))
        ? payload as ShortcutActionDefinition
        : (payload as { action?: ShortcutActionDefinition } | undefined)?.action;
      dispatchProjectionEvents(action);
    });

    window.addEventListener('shortcuts:window-action', handleWindowAction as EventListener);
    window.addEventListener('shortcut:action', handleWindowAction as EventListener);
    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('shortcuts:window-action', handleWindowAction as EventListener);
      window.removeEventListener('shortcut:action', handleWindowAction as EventListener);
    };
  }, []);

  // Optional preload when opening app to reduce latency for first shortcut playback.
  useEffect(() => {
    if (!activeCampaign?.id) return;
    if (songNameCacheCampaignRef.current !== activeCampaign.id) {
      songNameCacheCampaignRef.current = activeCampaign.id;
      songNameCacheRef.current.clear();
    }
    void listSongsForCampaign(activeCampaign.id)
      .then((songs) => {
        const allSongs = [...(songs.associated || []), ...(songs.reusable || [])];
        for (const song of allSongs) {
          if (song?.id && song?.name) {
            songNameCacheRef.current.set(song.id, song.name);
          }
        }
      })
      .catch(() => {});
  }, [activeCampaign?.id]);

  return null;
};

export default ShortcutRuntimeBridge;
