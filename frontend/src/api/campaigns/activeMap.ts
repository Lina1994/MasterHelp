import { api } from '../../apiBase';

export async function getActiveMapId(campaignId: string): Promise<string | null> {
  const res = await api.get<{ mapId: string | null }>(`/campaigns/${campaignId}/active-map`);
  return res.data?.mapId ?? null;
}

export async function setActiveMapId(campaignId: string, mapId: string | null): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/active-map`, { mapId });
}
