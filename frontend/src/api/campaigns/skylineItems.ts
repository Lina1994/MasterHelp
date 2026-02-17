import { api } from '../../apiBase';

export interface SkylineItemOverlay {
  id: string;
  campaignId: string;
  cellId: string;
  label: string | null;
  order: number;
  createdAt: string;
}

export async function getSkylineItems(campaignId: string): Promise<SkylineItemOverlay[]> {
  const res = await api.get<SkylineItemOverlay[]>(`/campaigns/${campaignId}/skyline-items`);
  return res.data;
}

export async function addSkylineItem(campaignId: string, cellId: string, label?: string, order?: number): Promise<SkylineItemOverlay> {
  const res = await api.post<SkylineItemOverlay>(`/campaigns/${campaignId}/skyline-items`, { cellId, label, order });
  return res.data;
}

export async function removeSkylineItem(itemId: string): Promise<void> {
  await api.delete(`/campaigns/skyline-items/${itemId}`);
}

export async function clearSkylineItems(campaignId: string): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/skyline-items`);
}
