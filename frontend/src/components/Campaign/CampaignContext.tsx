import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import axios from 'axios';
import { Campaign, CampaignPlayer } from './types';
import { filterVisibleCampaigns } from '../../utils/filterVisibleCampaigns';
import { getAuthHeaders } from '../../utils/auth';
import API_BASE_URL, { api } from '../../apiBase';

// Define the shape of the context data
interface CampaignsContextType {
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  loading: boolean;
  error: string | null;
  fetchCampaigns: () => Promise<void>;
  setActiveCampaign: (campaign: Campaign | null) => void;
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>; // Expose for optimistic updates
  afterAuth: (user: any) => void;
  createCampaign: (data: Partial<Campaign>) => Promise<Campaign>;
  updateCampaign: (id: string, data: Partial<Campaign>) => Promise<any>;
  deleteCampaign: (id: string) => Promise<void>;
  invitePlayer: (campaignId: string, email: string, username?: string) => Promise<void>;
  handleRemovePlayer: (player: CampaignPlayer) => Promise<void>;
}

// Create the context with a default undefined value
const CampaignsContext = createContext<CampaignsContextType | undefined>(undefined);

// Create the provider component
export const CampaignsProvider = ({ children }: { children: ReactNode }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/campaigns`, { headers: getAuthHeaders() });
      setCampaigns(filterVisibleCampaigns(res.data));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error fetching campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  const storeCurrentUser = (user: any) => {
    if (user) {
      localStorage.setItem('current_user', JSON.stringify(user));
    }
  };

  const afterAuth = useCallback((user: any) => {
    storeCurrentUser(user);
    fetchCampaigns();
  }, [fetchCampaigns]);

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

  const updateCampaign = async (id: string, data: Partial<Campaign>) => {
    setError(null);
    try {
      const res = await axios.patch(`${API_BASE_URL}/campaigns/${id}`, data, { headers: getAuthHeaders() });
      await fetchCampaigns(); // Refresca campañas tras editar
      return res.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error updating campaign');
      throw err;
    }
  };

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

  const invitePlayer = async (campaignId: string, email: string, username?: string): Promise<void> => {
    setError(null);
    try {
      await axios.post(
        `${API_BASE_URL}/campaigns/invite`,
        { campaignId, email, username },
        { headers: getAuthHeaders() }
      );
      await fetchCampaigns(); // Refresca campañas para ver nuevos jugadores/invitaciones
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error inviting player');
      throw err;
    }
  };

  const handleRemovePlayer = async (player: CampaignPlayer) => {
    if (!activeCampaign) return;
    const token = localStorage.getItem('access_token');
    await axios.delete(`${API_BASE_URL}/campaigns/${activeCampaign.id}/player/${player.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchCampaigns(); // Recarga todo para mantener la consistencia
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchCampaigns();
    }
  }, [fetchCampaigns]);

  const value = {
    campaigns,
    activeCampaign,
    loading,
    error,
    fetchCampaigns,
    setActiveCampaign,
    setCampaigns,
    afterAuth,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    invitePlayer,
    handleRemovePlayer,
  };

  return (
    <CampaignsContext.Provider value={value}>
      {children}
    </CampaignsContext.Provider>
  );
};

// Create a custom hook to use the context
export const useCampaignsContext = () => {
  const context = useContext(CampaignsContext);
  if (context === undefined) {
    throw new Error('useCampaignsContext must be used within a CampaignsProvider');
  }
  return context;
};
