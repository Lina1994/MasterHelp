
import { useState, useEffect, useCallback } from 'react';
import { Campaign, CampaignInvite } from './types';
import API_BASE_URL from '../../apiBase';
import axios from 'axios';

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper para auth
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch all campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/campaigns`, { headers: getAuthHeaders() });
      setCampaigns(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error fetching campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create campaign
  const createCampaign = async (data: Partial<Campaign>) => {
    setError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/campaigns`, data, { headers: getAuthHeaders() });
      setCampaigns(prev => [...prev, res.data]);
      return res.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error creating campaign');
      throw err;
    }
  };

  // Update campaign
  const updateCampaign = async (id: string, data: Partial<Campaign>) => {
    setError(null);
    try {
      const res = await axios.patch(`${API_BASE_URL}/campaigns/${id}`, data, { headers: getAuthHeaders() });
      setCampaigns(prev => prev.map(c => c.id === id ? res.data : c));
      return res.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error updating campaign');
      throw err;
    }
  };

  // Delete campaign
  const deleteCampaign = async (id: string) => {
    setError(null);
    try {
      await axios.delete(`${API_BASE_URL}/campaigns/${id}`, { headers: getAuthHeaders() });
      setCampaigns(prev => prev.filter(c => c.id !== id));
      if (activeCampaign?.id === id) setActiveCampaign(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting campaign');
      throw err;
    }
  };

  // Invite player (dummy, to be implemented with backend endpoint)
  const invitePlayer = async (campaignId: string, email: string): Promise<CampaignInvite> => {
    setError(null);
    // TODO: Cambiar por endpoint real cuando esté disponible
    try {
      // const res = await axios.post(`${API_BASE_URL}/campaigns/${campaignId}/invite`, { email }, { headers: getAuthHeaders() });
      // return res.data;
      return {
        campaignId,
        email,
        invitedBy: 'me',
        status: 'pending',
        sentAt: new Date().toISOString(),
      };
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error inviting player');
      throw err;
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return {
    campaigns,
    setCampaigns,
    activeCampaign,
    setActiveCampaign,
    loading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    invitePlayer,
  };
}
