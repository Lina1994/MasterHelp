import { useState } from 'react';
import { useCampaignsContext } from '../components/Campaign/CampaignContext';
import { deleteCampaign as deleteCampaignApi } from '../api/campaigns/deleteCampaign';

export const useDeleteCampaign = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setCampaigns, activeCampaign, setActiveCampaign } = useCampaignsContext();

  const removeCampaign = async (campaignId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Call the dedicated API function
      await deleteCampaignApi(campaignId);

      // Update state optimistically
      setCampaigns(prevCampaigns =>
        prevCampaigns.filter(campaign => campaign.id !== campaignId)
      );
      
      // If the deleted campaign was the active one, deactivate it
      if (activeCampaign?.id === campaignId) {
        setActiveCampaign(null);
      }

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Error deleting campaign';
      setError(errorMessage);
      // Re-throw the error if the caller needs to handle it
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { removeCampaign, loading, error };
};
