import { api } from '../../apiBase';

export async function getActiveEncounterId(campaignId: string): Promise<string | null> {
  const res = await api.get<{ encounterId: string | null }>(`/campaigns/${campaignId}/active-encounter`);
  return res.data?.encounterId ?? null;
}

export async function setActiveEncounterId(campaignId: string, encounterId: string | null): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/active-encounter`, { encounterId });
}
