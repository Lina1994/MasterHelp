import { useEffect, useRef, useCallback } from 'react';
import type { MapSoundSourceElement, SoundSourceType } from '../api/mapElements';
import type { MapTokenPayload } from '../api/maps';
import { computeSoundSourceVolumes } from '../utils/soundSourceHelpers';
import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';
import { listPlaylists, type PlaylistLite } from '../api/soundtrack';

/**
 * Internal state kept per active sound-source element.
 */
interface SourcePlaybackState {
  audio: HTMLAudioElement;
  ctx: AudioContext;
  gainNode: GainNode;
  sourceNode: MediaElementAudioSourceNode;
  objectUrl: string | null;
  /** For playlists: ordered list of song IDs and current index. */
  playlistSongIds?: string[];
  playlistIndex?: number;
  /** Source config snapshot to detect changes. */
  sourceType?: SoundSourceType;
  sourceId?: string;
}

/**
 * Configuration for the useMapSoundPlayback hook.
 */
export interface UseMapSoundPlaybackConfig {
  /** Sound-source map elements. */
  soundSources: MapSoundSourceElement[];
  /** All tokens on the map. */
  tokens: MapTokenPayload[];
  /** Map natural width in pixels. */
  mapW: number;
  /** Map natural height in pixels. */
  mapH: number;
  /** Grid cell size in pixels. */
  cellSize: number;
  /** Grid type. */
  gridType: 'square' | 'hex';
  /** Active campaign UUID (for auth-scoped streaming). */
  campaignId?: string;
  /** Master switch to enable/disable all playback. */
  enabled: boolean;
}

/**
 * useMapSoundPlayback
 *
 * Manages audio playback for sound-source map elements.  For each active
 * source (isOn, has sourceId), creates an HTMLAudioElement routed through
 * a Web Audio GainNode whose gain is computed from the nearest allied
 * token's distance using linear attenuation.
 *
 * Handles songs, playlists (auto-advance + loop), sound effects, and
 * presets (plays first effect of the preset).
 *
 * @param config Hook configuration.
 */
export function useMapSoundPlayback(config: UseMapSoundPlaybackConfig): void {
  const { soundSources, tokens, mapW, mapH, cellSize, gridType, campaignId, enabled } = config;

  /** Map of element-id → active playback state. */
  const statesRef = useRef<Map<string, SourcePlaybackState>>(new Map());
  /** Cached playlists for the campaign. */
  const playlistsCacheRef = useRef<PlaylistLite[]>([]);
  /** Whether playlists have been fetched. */
  const playlistsFetchedRef = useRef(false);

  // ── Fetch playlists once when campaignId is available ─────────────────
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    listPlaylists(campaignId)
      .then((pls) => {
        if (!cancelled) {
          playlistsCacheRef.current = pls || [];
          playlistsFetchedRef.current = true;
        }
      })
      .catch(() => { /* non-critical */ });
    return () => { cancelled = true; };
  }, [campaignId]);

  // ── Build stream URL ──────────────────────────────────────────────────
  const buildStreamUrl = useCallback(
    (sourceType: SoundSourceType, id: string): string => {
      const base = api.defaults.baseURL || '';
      const qs = campaignId ? `?campaignId=${campaignId}` : '';
      switch (sourceType) {
        case 'song':
          return `${base}/soundtrack/songs/${id}/stream${qs}`;
        case 'effect':
          return `${base}/soundtrack/effects/${id}/stream${qs}`;
        case 'preset':
          // Presets don't have a single stream — caller must resolve first item
          return '';
        case 'playlist':
          // Playlists play individual songs; caller handles per-song URLs
          return '';
      }
    },
    [campaignId],
  );

  // ── Load a blob URL for streaming with auth ───────────────────────────
  const loadBlobUrl = useCallback(
    async (streamUrl: string): Promise<string> => {
      const res = await api.get(streamUrl, {
        headers: getAuthHeaders(),
        responseType: 'blob',
      });
      return URL.createObjectURL(res.data as Blob);
    },
    [],
  );

  // ── Destroy a single source playback state ────────────────────────────
  const destroyState = useCallback((id: string) => {
    const st = statesRef.current.get(id);
    if (!st) return;
    try { st.audio.pause(); } catch { /* ok */ }
    try { st.gainNode.disconnect(); } catch { /* ok */ }
    try { st.sourceNode.disconnect(); } catch { /* ok */ }
    try { st.ctx.close(); } catch { /* ok */ }
    if (st.objectUrl) URL.revokeObjectURL(st.objectUrl);
    statesRef.current.delete(id);
  }, []);

  // ── Start playback for a source ───────────────────────────────────────
  const startSource = useCallback(
    async (src: MapSoundSourceElement) => {
      if (!src.sourceType || !src.sourceId) return;

      // Clean up any previous state for this element
      destroyState(src.id);

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sourceNode = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0; // Will be set by volume calculation
      sourceNode.connect(gainNode);
      gainNode.connect(ctx.destination);

      const state: SourcePlaybackState = {
        audio,
        ctx,
        gainNode,
        sourceNode,
        objectUrl: null,
        sourceType: src.sourceType,
        sourceId: src.sourceId,
      };
      statesRef.current.set(src.id, state);

      try {
        if (src.sourceType === 'song' || src.sourceType === 'effect') {
          const streamUrl = buildStreamUrl(src.sourceType, src.sourceId);
          const blobUrl = await loadBlobUrl(streamUrl);
          state.objectUrl = blobUrl;
          audio.src = blobUrl;
          audio.loop = true;
          await audio.play();
        } else if (src.sourceType === 'playlist') {
          const pl = playlistsCacheRef.current.find((p) => p.id === src.sourceId);
          const songIds = pl?.songs?.map((s) => s.id) ?? [];
          if (songIds.length === 0) return;
          state.playlistSongIds = songIds;
          state.playlistIndex = 0;

          const loadAndPlaySong = async (index: number) => {
            const songId = songIds[index % songIds.length];
            const streamUrl = buildStreamUrl('song', songId);
            const blobUrl = await loadBlobUrl(streamUrl);
            if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
            state.objectUrl = blobUrl;
            audio.src = blobUrl;
            await audio.play();
          };

          audio.loop = false;
          audio.addEventListener('ended', () => {
            const next = ((state.playlistIndex ?? 0) + 1) % songIds.length;
            state.playlistIndex = next;
            loadAndPlaySong(next).catch(() => { /* skip on error */ });
          });

          await loadAndPlaySong(0);
        } else if (src.sourceType === 'preset') {
          // For presets, try to fetch preset items and play the first effect
          try {
            const res = await api.get(`/soundtrack/presets/campaigns/${campaignId}`, {
              headers: getAuthHeaders(),
            });
            const presets = res.data as Array<{ id: string; items: Array<{ soundEffect?: { id: string } }> }>;
            const preset = presets?.find((p) => p.id === src.sourceId);
            const firstEffect = preset?.items?.[0]?.soundEffect;
            if (firstEffect) {
              const streamUrl = buildStreamUrl('effect', firstEffect.id);
              const blobUrl = await loadBlobUrl(streamUrl);
              state.objectUrl = blobUrl;
              audio.src = blobUrl;
              audio.loop = true;
              await audio.play();
            }
          } catch { /* preset load failed */ }
        }
      } catch {
        // Playback failed — clean up silently
        destroyState(src.id);
      }
    },
    [buildStreamUrl, loadBlobUrl, destroyState, campaignId],
  );

  // ── Main reconciliation effect ────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      // Destroy all active sources when disabled
      for (const id of Array.from(statesRef.current.keys())) {
        destroyState(id);
      }
      return;
    }

    const activeSources = soundSources.filter(
      (s) => s.isOn && s.sourceType && s.sourceId,
    );
    const activeIds = new Set(activeSources.map((s) => s.id));

    // Remove sources that are no longer active
    for (const id of Array.from(statesRef.current.keys())) {
      if (!activeIds.has(id)) {
        destroyState(id);
      }
    }

    // Start sources that are newly active or whose source config changed
    for (const src of activeSources) {
      const existing = statesRef.current.get(src.id);
      if (existing) {
        // Check if source config changed
        if (existing.sourceType !== src.sourceType || existing.sourceId !== src.sourceId) {
          destroyState(src.id);
          startSource(src);
        }
        // Otherwise keep existing — volume will be updated below
      } else {
        startSource(src);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    // Serialise source identity to detect adds/removes/config changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    soundSources
      .map((s) => `${s.id}:${s.isOn}:${s.sourceType}:${s.sourceId}`)
      .join('|'),
    destroyState,
    startSource,
  ]);

  // ── Volume update effect (runs on token movements + source changes) ───
  useEffect(() => {
    if (!enabled) return;

    const activeSources = soundSources.filter(
      (s) => s.isOn && s.sourceType && s.sourceId,
    );
    if (activeSources.length === 0) return;

    const volumes = computeSoundSourceVolumes(
      activeSources,
      tokens,
      mapW,
      mapH,
      cellSize,
      gridType,
    );

    for (const [id, vol] of volumes) {
      const st = statesRef.current.get(id);
      if (st) {
        // Smooth ramp to avoid clicks (50ms)
        try {
          st.gainNode.gain.setTargetAtTime(vol, st.ctx.currentTime, 0.05);
        } catch {
          st.gainNode.gain.value = vol;
        }
      }
    }
  }, [enabled, soundSources, tokens, mapW, mapH, cellSize, gridType]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      for (const id of Array.from(statesRef.current.keys())) {
        const st = statesRef.current.get(id);
        if (st) {
          try { st.audio.pause(); } catch { /* ok */ }
          try { st.gainNode.disconnect(); } catch { /* ok */ }
          try { st.sourceNode.disconnect(); } catch { /* ok */ }
          try { st.ctx.close(); } catch { /* ok */ }
          if (st.objectUrl) URL.revokeObjectURL(st.objectUrl);
        }
      }
      statesRef.current.clear();
    };
  }, []);
}
