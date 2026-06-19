import { useCallback, useState } from 'react';
import { setActiveSkylineCharacterId } from '../api/campaigns/activeSkylineCharacter';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useCampaignsContext } from '../components/Campaign/CampaignContext';
import { notifySkylineCharacterChanged } from '../utils/skylineSync';

/**
 * Result returned by {@link useSendEmoteToSkyline}.
 */
interface UseSendEmoteToSkylineResult {
  /**
   * Sets the given character as the active Skyline character using a specific
   * emote image, refreshes the campaign context and notifies every window.
   *
   * @param characterId - UUID of the character to project.
   * @param emoteUrl - Image URL/data-URL of the emote to display.
   */
  sendEmote: (characterId: string, emoteUrl: string) => Promise<void>;
  /** `true` while a send request is in flight. */
  sending: boolean;
}

/**
 * Shared logic to push a character emote to the Skyline projection.
 *
 * Centralizes the previously duplicated flow (PATCH active skyline character +
 * refresh campaigns + cross-window notification) so every entry point
 * (character list, sheet header, affinity chart, skyline preview) behaves
 * consistently.
 *
 * @returns The {@link UseSendEmoteToSkylineResult} handlers and state.
 */
export function useSendEmoteToSkyline(): UseSendEmoteToSkylineResult {
  const { activeCampaign } = useActiveCampaign();
  const { fetchCampaigns } = useCampaignsContext();
  const [sending, setSending] = useState(false);

  const sendEmote = useCallback(
    async (characterId: string, emoteUrl: string) => {
      const campaignId = activeCampaign?.id;
      if (!campaignId || !characterId) return;
      setSending(true);
      try {
        await setActiveSkylineCharacterId(campaignId, characterId, emoteUrl);
        await fetchCampaigns();
        notifySkylineCharacterChanged(campaignId);
      } finally {
        setSending(false);
      }
    },
    [activeCampaign?.id, fetchCampaigns],
  );

  return { sendEmote, sending };
}
