import { api } from '../apiBase';

export interface SongLite {
  id: string;
  name: string;
  group?: string;
  artist?: string;
  album?: string;
  atmosphere?: string;
  mimeType?: string;
  size?: number;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastPlayedAt?: string | null;
}

export interface SongsForCampaignResponse {
  associated: SongLite[];
  reusable: SongLite[];
}

export interface PlaylistLite {
  id: string;
  name: string;
  songs?: Array<Pick<SongLite, 'id' | 'name' | 'size' | 'mimeType'>>;
}

/**
 * Lists songs available for a given campaign, split into associated vs reusable.
 */
export async function listSongsForCampaign(campaignId: string): Promise<SongsForCampaignResponse> {
  const res = await api.get<SongsForCampaignResponse>(`/soundtrack/campaigns/${campaignId}/songs`);
  return res.data;
}

/**
 * Lists playlists for a given campaign.
 */
export async function listPlaylists(campaignId: string): Promise<PlaylistLite[]> {
  const res = await api.get<PlaylistLite[]>(`/soundtrack/campaigns/${campaignId}/playlists`);
  return res.data;
}
