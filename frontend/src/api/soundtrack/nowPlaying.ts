import { api } from '../../apiBase';

export async function getCampaignNowPlayingTitle(campaignId: string): Promise<{ title: string | null; lastPlayedAt: string | null }> {
  const res = await api.get<{ title: string | null; lastPlayedAt: string | null }>(`/soundtrack/campaigns/${campaignId}/now-playing`);
  return res.data;
}
