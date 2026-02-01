import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useActiveMap } from './ActiveMapContext';
import { useTimeOfDay } from '../player/TimeOfDayContext';
import { useGlobalPlayer } from '../player/GlobalPlayerContext';
import { useSfxPlayer } from '../player/SfxPlayerContext';
import { useSoundtrackMode } from '../../hooks/useSoundtrackMode';
import { listMaps, MapItemDto } from '../../api/maps';
import { listPlaylists, listSongsForCampaign, PlaylistLite, SongLite } from '../../api/soundtrack';
import { api } from '../../apiBase';
import { getAuthHeaders } from '../../utils/auth';

type Tod = 'dawn' | 'morning' | 'afternoon' | 'night';

/**
 * Headless component that observes activeMapId and timeOfDay to auto-play configured audio.
 * Rules:
 * - Only consider situation "base" (ignore battle variants for now).
 * - Respect current global time of day. If no config for the TOD, do nothing.
 * - Start music only if selection changed vs last applied; otherwise no-op.
 * - For playlists, start a queue (non-loop by default) using the playlist order.
 * - For SFX preset, if changed, stop all and apply the new preset items.
 */
const MapAudioOrchestrator: React.FC = () => {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const { activeMapId } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { play, playQueue, current, isQueue } = useGlobalPlayer();
  const { stopAllSfx, playSfx } = useSfxPlayer() as any;
  const { mode: soundtrackMode } = useSoundtrackMode(campaignId);

  const [maps, setMaps] = useState<MapItemDto[] | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistLite[] | null>(null);
  const [songsIndex, setSongsIndex] = useState<Map<string, SongLite> | null>(null);
  const [presets, setPresets] = useState<Array<{ id: string; name: string; items: any[] }> | null>(null);

  const lastMusicRef = useRef<string | null>(null); // e.g., song:abc or playlist:def
  const lastPresetRef = useRef<string | null>(null);
  const applyingPresetRef = useRef<string | null>(null);

  // Fetch maps for active campaign
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!campaignId) { setMaps(null); return; }
      try {
        const list = await listMaps({ campaignId });
        if (!cancelled) setMaps(list || []);
      } catch {
        if (!cancelled) setMaps([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Fetch playlists for campaign (for playlist playback)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!campaignId) { setPlaylists(null); return; }
      try {
        const pls = await listPlaylists(campaignId);
        if (!cancelled) setPlaylists(pls || []);
      } catch {
        if (!cancelled) setPlaylists([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Fetch songs (associated + reusable) to resolve names when playing a single song from map config
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!campaignId) { setSongsIndex(null); return; }
      try {
        const { associated, reusable } = await listSongsForCampaign(campaignId);
        const map = new Map<string, SongLite>();
        [...(associated || []), ...(reusable || [])].forEach(s => map.set(s.id, s));
        if (!cancelled) setSongsIndex(map);
      } catch {
        if (!cancelled) setSongsIndex(new Map());
      }
    }
    load();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Fetch SFX presets for campaign (with items)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!campaignId) { setPresets(null); return; }
      try {
        const r = await api.get(`/soundtrack/presets/campaigns/${campaignId}`, { headers: getAuthHeaders() });
        if (!cancelled) setPresets(r.data || []);
      } catch {
        if (!cancelled) setPresets([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [campaignId]);

  const activeMap = useMemo(() => {
    if (!activeMapId || !maps) return null;
    return maps.find(m => m.id === activeMapId) || null;
  }, [activeMapId, maps]);

  // Helpers to build stream endpoints
  const buildSongStreamEndpoint = (songId: string) => {
    return campaignId
      ? `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream?campaignId=${campaignId}`
      : `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream`;
  };
  const markSongPlayed = async (songId: string) => {
    try {
      await api.post(`/soundtrack/songs/${songId}/played`, null, { headers: getAuthHeaders(), params: campaignId ? { campaignId } : undefined });
    } catch {}
  };

  useEffect(() => {
    // Orchestrate whenever inputs change
    const run = async () => {
      if (!activeMap || !timeOfDay) return;
      if (soundtrackMode === 'manual') return;
      const tod: Tod = timeOfDay as Tod;
      const musicConfig: any = activeMap.musicConfig || {};
      const sfxConfig: any = activeMap.sfxConfig || {};

      // MUSIC: consider base only
      const sel = musicConfig?.[tod]?.['base'] as { type: 'song' | 'playlist'; id: string } | undefined;
      if (sel) {
        const key = `${sel.type}:${sel.id}`;
        // Determine if we must apply even if key matches (e.g., user manually played another song/queue)
        let mustApply = lastMusicRef.current !== key;
        if (!mustApply) {
          if (sel.type === 'song') {
            if (!current || current.id !== sel.id || isQueue) mustApply = true;
          } else if (sel.type === 'playlist') {
            const pl = (playlists || []).find(p => p.id === sel.id);
            const items = (pl?.songs || [])
              .map(s => ({ id: s.id, name: s.name, size: s.size, mimeType: s.mimeType }));
            const containsCurrent = !!(current && items.some(it => it.id === current.id));
            if (!isQueue || !containsCurrent) mustApply = true;
          }
        }
        if (mustApply) {
          if (sel.type === 'song') {
            const meta = songsIndex?.get(sel.id);
            await play(
              { id: sel.id, name: meta?.name || 'Canción', mimeType: meta?.mimeType, size: meta?.size },
              async () => {
                await markSongPlayed(sel.id);
                const res = await api.get(buildSongStreamEndpoint(sel.id), { headers: getAuthHeaders(), responseType: 'blob' });
                return URL.createObjectURL(res.data as Blob);
              }
            );
            lastMusicRef.current = key;
          } else if (sel.type === 'playlist') {
            const pl = (playlists || []).find(p => p.id === sel.id);
            const items = (pl?.songs || []).map(s => ({ id: s.id, name: s.name, size: s.size, mimeType: s.mimeType }));
            if (items.length) {
              await playQueue(items, async (id: string) => {
                await markSongPlayed(id);
                const res = await api.get(buildSongStreamEndpoint(id), { headers: getAuthHeaders(), responseType: 'blob' });
                return URL.createObjectURL(res.data as Blob);
              }, { shuffle: false });
              lastMusicRef.current = key;
            }
          }
        }
      }

      // SFX: apply preset for base if changed (do not reapply if already applied)
      const preset = sfxConfig?.[tod]?.['base'] as { presetId: string } | undefined;
      if (preset?.presetId && preset.presetId !== lastPresetRef.current && applyingPresetRef.current !== preset.presetId) {
        const p = (presets || []).find(x => x.id === preset.presetId);
        if (p && Array.isArray(p.items) && p.items.length) {
          applyingPresetRef.current = preset.presetId;
          stopAllSfx();
          for (const item of p.items) {
            const eff = item.soundEffect;
            if (!eff) continue;
            await playSfx(
              { effectId: eff.id, name: eff.name },
              async () => {
                const url = campaignId
                  ? `${api.defaults.baseURL}/soundtrack/effects/${eff.id}/stream?campaignId=${campaignId}`
                  : `${api.defaults.baseURL}/soundtrack/effects/${eff.id}/stream`;
                const res = await api.get(url, { headers: getAuthHeaders(), responseType: 'blob' });
                return URL.createObjectURL(res.data as Blob);
              },
              {
                volume: clamp01(item.volume ?? 1),
                loopMode: item.loopMode || 'continuous',
                waitMs: item.waitMs ?? undefined,
                randomMinMs: item.randomMinMs ?? undefined,
                randomMaxMs: item.randomMaxMs ?? undefined,
                echoEnabled: !!item.echoEnabled,
                echoDelayMs: item.echoEnabled ? (item.echoDelayMs ?? 300) : undefined,
                echoFeedback: item.echoEnabled ? clamp01(item.echoFeedback ?? 0.3) : undefined,
                pitchSemitones: typeof item.pitchSemitones === 'number' ? item.pitchSemitones : 0,
                uniquePerEffect: true,
              }
            );
          }
          lastPresetRef.current = preset.presetId;
          applyingPresetRef.current = null;
        }
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, activeMap, timeOfDay, playlists, presets, play, playQueue, stopAllSfx, playSfx, soundtrackMode]);

  return null;
};

export default MapAudioOrchestrator;

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
