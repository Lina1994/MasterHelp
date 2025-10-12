import { api } from '../../apiBase';

export async function getCampaignManuals(campaignId: string): Promise<string[]> {
  const res = await api.get<{ manualIds: string[] }>(`/campaigns/${campaignId}/manuals`);
  return res.data?.manualIds ?? [];
}

export async function setCampaignManuals(campaignId: string, manualIds: string[]): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/manuals`, { manualIds });
}
