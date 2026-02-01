import { api } from '../../apiBase';

export type SoundtrackMode = 'automatic' | 'manual';

export type SoundtrackSettings = {
  mode: SoundtrackMode;
};

/**
 * Reads soundtrack settings for a campaign.
 */
export async function getSoundtrackSettings(campaignId: string): Promise<SoundtrackSettings> {
  const res = await api.get<{ settings: SoundtrackSettings }>(`/campaigns/${campaignId}/soundtrack-settings`);
  return res.data.settings;
}

/**
 * Updates soundtrack settings for a campaign.
 */
export async function setSoundtrackSettings(campaignId: string, settings: Partial<SoundtrackSettings>): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/soundtrack-settings`, settings);
}
