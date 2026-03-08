import { api } from '../../apiBase';

export type SkylineOverlaySettings = {
  showSongTitle: boolean;
  showInitiativeStrip: boolean;
  /** When true, a QR code overlay is displayed in the Skyline projection window. */
  showQr: boolean;
  /** The URL encoded in the QR code. */
  qrUrl: string;
};

/**
 * Reads skyline overlay settings for a campaign.
 */
export async function getSkylineOverlaySettings(campaignId: string): Promise<SkylineOverlaySettings> {
  const res = await api.get<{ settings: SkylineOverlaySettings }>(`/campaigns/${campaignId}/skyline-overlay`);
  return res.data.settings;
}

/**
 * Public (no-auth) read of skyline overlay settings for projection.
 */
export async function getSkylineOverlaySettingsPublic(campaignId: string): Promise<SkylineOverlaySettings> {
  const res = await api.get<SkylineOverlaySettings>(`/campaigns/projection/${campaignId}/skyline-overlay`);
  return res.data;
}

/**
 * Updates skyline overlay settings for a campaign.
 */
export async function setSkylineOverlaySettings(campaignId: string, settings: Partial<SkylineOverlaySettings>): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/skyline-overlay`, settings);
}
