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
import { dispatchSceneWindowCommand, dispatchWindowShortcutAction } from './ipcActions';
import { useSceneClockSync } from '../hooks/useSceneClockSync';
import { getAuthHeaders } from '../utils/auth';
import type { ShortcutActionDefinition } from '../types/actionTypes';
import type { ExecuteSceneResponse, SceneRuntimeCommand } from '../types/scenes';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getPayload = (action: ShortcutActionDefinition): Record<string, unknown> => {
  return (action.payload ?? action.config ?? {}) as Record<string, unknown>;
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

const inferCommandDurationMs = (command: SceneRuntimeCommand): number => {
  const payload = command.payload ?? {};
  const durationMs = Number(payload.durationMs);
  if (Number.isFinite(durationMs) && durationMs > 0) return Math.round(durationMs);

  if (command.kind === 'window.sendVideo') {
    const isLoop = Boolean(payload.loop);
    return isLoop ? 6000 : 4000;
  }
  if (command.kind === 'window.sendImage') return 4000;
  if (command.kind === 'narrative.setText') return 3500;
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
}

/**
 * Headless bridge that maps shortcut runtime events to concrete app actions.
 */
const ShortcutRuntimeBridge = () => {
  const { i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const { setMode } = useContext(ThemeContext);
  const { play, playQueue, stop } = useGlobalPlayer();
  const { playSfx, stopAllSfx } = useSfxPlayer();
  const { clockOffsetMs: sceneClockOffsetMs } = useSceneClockSync({ enabled: true, pollMs: 60000 });
  const sceneClockOffsetRef = useRef<number>(0);
  const activeSceneExecutionsRef = useRef<Map<string, ActiveSceneExecutionController>>(new Map());

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
    const stopSceneExecution = (executionId: string) => {
      const controller = activeSceneExecutionsRef.current.get(executionId);
      if (!controller) return;
      controller.stopped = true;
      if (controller.timerId !== null) {
        window.clearTimeout(controller.timerId);
        controller.timerId = null;
      }
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

    const playSongById = async (songId: string) => {
      if (!songId) return;
      const campaignId = activeCampaign?.id;
      await play(
        { id: songId, name: songId },
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

      let previousOffset = 0;
      for (const command of plannedCommands) {
        if (controller.stopped) return false;

        const executeAtMs = Number(command.executeAtMs);
        const isWindowBoundCommand = command.kind.startsWith('window.') || command.kind === 'narrative.setText';

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
          if (songId) {
            await playSongById(songId);
          } else if (playlistId) {
            await playPlaylistById(playlistId);
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
              volume: clamp01(Number(command.payload.volume ?? 1)),
              loopMode: asLoopMode(command.payload.loopMode),
              waitMs: typeof command.payload.waitMs === 'number' ? command.payload.waitMs : undefined,
              randomMinMs: typeof command.payload.randomMinMs === 'number' ? command.payload.randomMinMs : undefined,
              randomMaxMs: typeof command.payload.randomMaxMs === 'number' ? command.payload.randomMaxMs : undefined,
            },
          );
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
      const logicalExecutionId = String(initialExecution?.executionId || '');
      if (!logicalExecutionId) return;

      stopSceneExecution(logicalExecutionId);

      const controller: ActiveSceneExecutionController = { stopped: false, timerId: null };
      activeSceneExecutionsRef.current.set(logicalExecutionId, controller);

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
        const wasStopped = controller.stopped;
        activeSceneExecutionsRef.current.delete(logicalExecutionId);
        window.dispatchEvent(new CustomEvent(wasStopped ? 'scene:execution-stopped' : 'scene:execution-completed', {
          detail: {
            executionId: logicalExecutionId,
            sceneId: initialExecution.scene?.id,
          },
        }));
      }
    };

    const handleStopRequest = (event: Event) => {
      const custom = event as CustomEvent<{ executionId?: string }>;
      const executionId = String(custom.detail?.executionId || '');
      if (!executionId) return;
      stopSceneExecution(executionId);
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
        if (controller.timerId !== null) {
          window.clearTimeout(controller.timerId);
          controller.timerId = null;
        }
      });
      activeSceneExecutionsRef.current.clear();
    };
  }, [activeCampaign?.id, i18n, play, playQueue, playSfx, setMode, stop, stopAllSfx]);

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
    void listSongsForCampaign(activeCampaign.id).catch(() => {});
  }, [activeCampaign?.id]);

  return null;
};

export default ShortcutRuntimeBridge;
