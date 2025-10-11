import { api } from '../apiBase';

export interface SoundPresetLite {
  id: string;
  name: string;
  // other fields are not needed for selection
}

/**
 * Lists SFX presets for a given campaign.
 */
export async function listSfxPresets(campaignId: string): Promise<SoundPresetLite[]> {
  const res = await api.get<SoundPresetLite[]>(`/soundtrack/presets/campaigns/${campaignId}`);
  return res.data;
}
