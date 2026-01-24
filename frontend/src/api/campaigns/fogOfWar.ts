import { api } from '../../apiBase';

export type FogOfWarSettings = {
  allyClearRadius: number;
};

/**
 * Get Fog of War settings for a campaign.
 */
export async function getFogOfWarSettings(campaignId: string): Promise<FogOfWarSettings> {
  const res = await api.get<{ settings: FogOfWarSettings }>(`/campaigns/${campaignId}/fog-of-war`);
  return res.data.settings;
}

/**
 * Update Fog of War settings for a campaign (owner only).
 */
export async function setFogOfWarSettings(campaignId: string, settings: FogOfWarSettings): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/fog-of-war`, settings);
}
