import { api } from '../../apiBase';

/**
 * Upload (or replace) the default/fallback skyline image for a campaign.
 * @param campaignId Campaign UUID.
 * @param file Image file to upload.
 */
export async function uploadDefaultSkyline(campaignId: string, file: File): Promise<{ ok: boolean }> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ ok: boolean }>(`/campaigns/${campaignId}/default-skyline`, form);
  return res.data;
}

/**
 * Build the authenticated URL to stream the default skyline image.
 * @param campaignId Campaign UUID.
 */
export function getDefaultSkylineUrl(campaignId: string): string {
  return `${api.defaults.baseURL}/campaigns/${campaignId}/default-skyline`;
}

/**
 * Build the public (no-auth) URL to stream the default skyline image.
 * Used by projection windows.
 * @param campaignId Campaign UUID.
 */
export function getDefaultSkylinePublicUrl(campaignId: string): string {
  return `${api.defaults.baseURL}/campaigns/projection/${campaignId}/default-skyline`;
}

/**
 * Check whether a default skyline image exists for the campaign (authenticated).
 * @param campaignId Campaign UUID.
 */
export async function hasDefaultSkyline(campaignId: string): Promise<boolean> {
  const res = await api.get<{ exists: boolean }>(`/campaigns/${campaignId}/default-skyline/exists`);
  return res.data.exists;
}

/**
 * Check whether a default skyline image exists for the campaign (public, no auth).
 * @param campaignId Campaign UUID.
 */
export async function hasDefaultSkylinePublic(campaignId: string): Promise<boolean> {
  const res = await api.get<{ exists: boolean }>(`/campaigns/projection/${campaignId}/default-skyline/exists`);
  return res.data.exists;
}

/**
 * Delete the default/fallback skyline image for a campaign.
 * @param campaignId Campaign UUID.
 */
export async function deleteDefaultSkyline(campaignId: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/campaigns/${campaignId}/default-skyline`);
  return res.data;
}
