import { api } from '../../apiBase';

/**
 * Automatic adventure-log settings for a campaign.
 *
 * When `enabled` is true (and a diary session is active), the backend appends
 * entries to a "Registro de aventuras" item on the campaign's current day for
 * each enabled category.
 */
export type AutoLogSettings = {
  enabled: boolean;
  logPlaces: boolean;
  logCharacters: boolean;
  logQuests: boolean;
  logCombat: boolean;
};

/** Reads the automatic adventure-log settings for a campaign. */
export async function getAutoLogSettings(campaignId: string): Promise<AutoLogSettings> {
  const res = await api.get<{ settings: AutoLogSettings }>(`/campaigns/${campaignId}/auto-log-settings`);
  return res.data.settings;
}

/** Updates the automatic adventure-log settings for a campaign (owner only). */
export async function setAutoLogSettings(campaignId: string, settings: Partial<AutoLogSettings>): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/auto-log-settings`, settings);
}
