import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Campaign } from './types';
import { useCampaigns } from './useCampaigns'; // Asumimos que este hook nos da todas las campañas

interface ActiveCampaignContextType {
  activeCampaign: Campaign | null;
  setActiveCampaignId: (id: string | null) => void;
  isLoading: boolean;
}

export const ActiveCampaignContext = createContext<ActiveCampaignContextType | undefined>(undefined);

export const ActiveCampaignProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeCampaignId, setActiveCampaignIdState] = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { campaigns, loading: campaignsLoading } = useCampaigns();

  // Cargar el ID de la campaña activa desde localStorage al iniciar
  useEffect(() => {
    try {
      const storedId = localStorage.getItem('activeCampaignId');
      if (storedId) {
        setActiveCampaignIdState(storedId);
      }
    } catch (error) {
      console.error("Failed to read from localStorage", error);
    }
    setIsLoading(false);
  }, []);

  // Cuando el ID o la lista de campañas cambie, encontrar y establecer el objeto de la campaña activa
  useEffect(() => {
    if (campaignsLoading) return;

    if (activeCampaignId) {
      const campaign = campaigns.find(c => c.id === activeCampaignId) || null;
      setActiveCampaign(campaign);
    } else {
      setActiveCampaign(null);
    }
  }, [activeCampaignId, campaigns, campaignsLoading]);

  const setActiveCampaignId = (id: string | null) => {
    setIsLoading(true);
    try {
      if (id) {
        localStorage.setItem('activeCampaignId', id);
      } else {
        localStorage.removeItem('activeCampaignId');
      }
      setActiveCampaignIdState(id);
    } catch (error) {
      console.error("Failed to write to localStorage", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ActiveCampaignContext.Provider value={{ activeCampaign, setActiveCampaignId, isLoading }}>
      {children}
    </ActiveCampaignContext.Provider>
  );
};

export const useActiveCampaign = () => {
  const context = useContext(ActiveCampaignContext);
  if (context === undefined) {
    throw new Error('useActiveCampaign must be used within an ActiveCampaignProvider');
  }
  return context;
};