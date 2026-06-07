import { api } from '../../apiBase';

export interface ActiveSkylineCharacterResponse {
  characterId: string | null;
  activeSkylineImageUrl: string | null;
}

export async function getActiveSkylineCharacterId(campaignId: string): Promise<string | null> {
  const res = await api.get<ActiveSkylineCharacterResponse>(`/campaigns/${campaignId}/active-skyline-character`);
  return res.data?.characterId ?? null;
}

export async function getActiveSkylineCharacterInfo(campaignId: string): Promise<ActiveSkylineCharacterResponse> {
  const res = await api.get<ActiveSkylineCharacterResponse>(`/campaigns/${campaignId}/active-skyline-character`);
  return res.data;
}

export async function setActiveSkylineCharacterId(campaignId: string, characterId: string | null, activeSkylineImageUrl?: string | null): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/active-skyline-character`, { characterId, activeSkylineImageUrl });
}
