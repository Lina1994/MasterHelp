import { useContext, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import ThemeContext from '../ThemeContext';
import API_BASE_URL, { api } from '../apiBase';
import { listPlaylists, listSongsForCampaign } from '../api/soundtrack';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useGlobalPlayer } from '../components/player/GlobalPlayerContext';
import { useSfxPlayer, type SfxLoopMode } from '../components/player/SfxPlayerContext';
import { getAuthHeaders } from '../utils/auth';
import type { ShortcutActionDefinition } from '../types/actionTypes';

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

/**
 * Headless bridge that maps shortcut runtime events to concrete app actions.
 */
const ShortcutRuntimeBridge = () => {
  const { i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const { setMode } = useContext(ThemeContext);
  const { play, playQueue, stop } = useGlobalPlayer();
  const { playSfx, stopAllSfx } = useSfxPlayer();

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
        if (!activeCampaign?.id) return;
        const playlistId = String(payload.playlistId || '');
        if (!playlistId) return;
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

    window.addEventListener('shortcut:audio-action', handleAudioAction as EventListener);
    window.addEventListener('shortcut:config-action', handleConfigAction as EventListener);

    return () => {
      window.removeEventListener('shortcut:audio-action', handleAudioAction as EventListener);
      window.removeEventListener('shortcut:config-action', handleConfigAction as EventListener);
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
