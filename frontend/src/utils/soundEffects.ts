/**
 * Clamp value into [0,1].
 */
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Convert milliseconds to seconds (number) for UI. Returns undefined if nullish.
 */
export const msToSec = (ms?: number | null): number | undefined => {
  if (ms === null || typeof ms === 'undefined') return undefined;
  return ms / 1000;
};

/**
 * Convert seconds to milliseconds. Returns undefined if nullish.
 */
export const secToMs = (sec?: number | null): number | undefined => {
  if (sec === null || typeof sec === 'undefined') return undefined;
  return Math.round(sec * 1000);
};

/**
 * Build stream URL for a sound effect, optionally scoped to campaign.
 */
export const buildEffectStreamUrl = (baseUrl: string | undefined, effectId: string, campaignId?: string | null): string => {
  if (!baseUrl) return '';
  return campaignId
    ? `${baseUrl}/soundtrack/effects/${effectId}/stream?campaignId=${campaignId}`
    : `${baseUrl}/soundtrack/effects/${effectId}/stream`;
};
