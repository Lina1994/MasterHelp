import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import axios from 'axios';
import { Campaign } from './types';
import { filterVisibleCampaigns } from '../../utils/filterVisibleCampaigns';
import { getAuthHeaders } from '../../utils/auth';
import { api } from '../../apiBase';

// Define the shape of the context data
interface CampaignsContextType {
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  loading: boolean;
  error: string | null;
  fetchCampaigns: () => Promise<void>;
  setActiveCampaign: (campaign: Campaign | null) => void;
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>; // Expose for optimistic updates
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

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const value = {
    campaigns,
    activeCampaign,
    loading,
    error,
    fetchCampaigns,
    setActiveCampaign,
    setCampaigns,
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
