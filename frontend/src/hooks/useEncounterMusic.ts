/**
 * useEncounterMusic
 *
 * Encapsula la lógica de reproducir la música del encuentro al iniciar batalla
 * y restaurar la pista anterior al finalizar (o detener si no hay anterior).
 *
 * - Guarda la pista actual como "previa" al arrancar el encuentro.
 * - Si el encuentro tiene canción y está habilitado `prioritizeEncounterMusic`, la reproduce.
 * - Marca la canción como reproducida vía API y obtiene el stream seguro.
 * - Al finalizar, intenta restaurar la pista previa; si falla o no hay, detiene.
 */
import { useCallback, useState } from 'react';
import { useGlobalPlayer } from '../components/player/GlobalPlayerContext';
import { useEncounterAudio } from './useEncounterAudio';
import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';
import type { EncounterSummary } from '../api/encounters';
import type { SongLite } from '../api/soundtrack';

export interface UseEncounterMusicParams {
  campaignId?: string;
  selectedEncounter: EncounterSummary | null;
  songs: SongLite[];
  prioritizeEncounterMusic: boolean;
}

export interface UseEncounterMusicResult {
  /** Inicia la música del encuentro si corresponde, guardando la pista previa. */
  startEncounterMusic: () => Promise<void>;
  /** Restaura la pista previa si existe; si no, detiene la reproducción. */
  restorePreviousMusic: () => Promise<void>;
}

export function useEncounterMusic({ campaignId, selectedEncounter, songs, prioritizeEncounterMusic }: UseEncounterMusicParams): UseEncounterMusicResult {
  const { play, stop, current } = useGlobalPlayer();
  const { buildSongStreamEndpoint } = useEncounterAudio(campaignId);
  const [prevTrack, setPrevTrack] = useState<{ id: string; name: string; size?: number; mimeType?: string } | null>(null);

  const findSong = useCallback((songId?: string) => songs.find((s) => s.id === songId), [songs]);

  /**
   * Inicia la música del encuentro si está configurada y priorizada.
   * Guarda la pista actual para poder restaurarla al finalizar.
   */
  const startEncounterMusic = useCallback(async () => {
    // Guardar pista previa si hay algo sonando
    if (current) {
      setPrevTrack({ id: current.id, name: current.name, size: current.size, mimeType: current.mimeType });
    } else {
      setPrevTrack(null);
    }

    if (!selectedEncounter || !prioritizeEncounterMusic) return;

    const songId = selectedEncounter.musicSongId;
    const meta = songId ? findSong(songId) : undefined;
    if (!songId || !meta) return;

    await play(
      { id: songId, name: meta.name, mimeType: meta.mimeType, size: meta.size },
      async () => {
        try {
          await api.post(`/soundtrack/songs/${songId}/played`, null, { headers: getAuthHeaders(), params: campaignId ? { campaignId } : undefined });
        } catch {
          // silencioso: no bloquea reproducción
        }
        const res = await api.get(buildSongStreamEndpoint(songId), { headers: getAuthHeaders(), responseType: 'blob' });
        return URL.createObjectURL(res.data as Blob);
      },
    );
  }, [current, selectedEncounter, prioritizeEncounterMusic, findSong, play, buildSongStreamEndpoint, campaignId]);

  /**
   * Restaura la pista previa si existe y es válida; si no, detiene.
   */
  const restorePreviousMusic = useCallback(async () => {
    if (prevTrack) {
      try {
        await play(
          { id: prevTrack.id, name: prevTrack.name, mimeType: prevTrack.mimeType, size: prevTrack.size },
          async () => {
            const res = await api.get(buildSongStreamEndpoint(prevTrack.id), { headers: getAuthHeaders(), responseType: 'blob' });
            return URL.createObjectURL(res.data as Blob);
          },
        );
        return;
      } catch {
        // Si falla la restauración, detener.
      }
    }
    stop();
  }, [prevTrack, play, stop, buildSongStreamEndpoint]);

  return { startEncounterMusic, restorePreviousMusic };
}
