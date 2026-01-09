import { api } from '../../apiBase';

export type SkylineOverlaySettings = {
  showSongTitle: boolean;
};

/**
 * Reads skyline overlay settings for a campaign.
 */
export async function getSkylineOverlaySettings(campaignId: string): Promise<SkylineOverlaySettings> {
  const res = await api.get<{ settings: SkylineOverlaySettings }>(`/campaigns/${campaignId}/skyline-overlay`);
  return res.data.settings;
}

/**
 * Updates skyline overlay settings for a campaign.
 */
export async function setSkylineOverlaySettings(campaignId: string, settings: SkylineOverlaySettings): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/skyline-overlay`, settings);
}
