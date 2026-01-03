import { api } from '../../apiBase';

export async function getActiveSkylineCharacterId(campaignId: string): Promise<string | null> {
  const res = await api.get<{ characterId: string | null }>(`/campaigns/${campaignId}/active-skyline-character`);
  return res.data?.characterId ?? null;
}

export async function setActiveSkylineCharacterId(campaignId: string, characterId: string | null): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/active-skyline-character`, { characterId });
}
