import { useCallback } from 'react';
import { api } from '../apiBase';

/**
 * useEncounterAudio
 * 
 * Provides helpers for encounter-related audio operations.
 * Currently exposes only `buildSongStreamEndpoint`, which constructs
 * the streaming URL for a song, optionally scoped to a campaign.
 *
 * @param campaignId - Optional active campaign id to scope the stream.
 * @returns Object with `buildSongStreamEndpoint(songId)` function.
 */
export function useEncounterAudio(campaignId?: string | number | null) {
  /**
   * Builds the API endpoint to stream a given song id, scoping by campaign when available.
   * @param songId - The id of the song to stream.
   * @returns The absolute URL to stream the song from the backend.
   */
  const buildSongStreamEndpoint = useCallback((songId: string) => {
    return campaignId
      ? `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream?campaignId=${campaignId}`
      : `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream`;
  }, [campaignId]);

  return { buildSongStreamEndpoint };
}
