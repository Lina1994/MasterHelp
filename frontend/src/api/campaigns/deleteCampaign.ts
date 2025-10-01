import { api } from '../../apiBase';
import { getAuthHeaders } from '../../utils/auth';

/**
 * Deletes a campaign by its ID.
 * The request is authenticated and authorized on the backend.
 *
 * @param campaignId The ID of the campaign to delete.
 * @returns A promise that resolves if the deletion is successful.
 */
export const deleteCampaign = async (campaignId: string): Promise<void> => {
  await api.delete(`/campaigns/${campaignId}`, { headers: getAuthHeaders() });
};