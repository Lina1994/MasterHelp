import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Campaign } from './types';
import { useCampaignsContext } from './CampaignContext'; // Asumimos que este hook nos da todas las campañas

export interface ActiveCampaignContextType {
  activeCampaign: Campaign | null;
  /** Raw campaign ID from localStorage, available immediately on mount (before campaigns list loads). */
  activeCampaignId: string | null;
  setActiveCampaignId: (id: string | null) => void;
  isLoading: boolean;
}

export const ActiveCampaignContext = createContext<ActiveCampaignContextType | undefined>(undefined);

export const ActiveCampaignProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Read activeCampaignId from localStorage synchronously in the initializer so it is
  // available from the very first render (important for projection windows which need
  // the campaign ID before the campaign list finishes loading from the server).
  const [activeCampaignId, setActiveCampaignIdState] = useState<string | null>(() => {
    try { return localStorage.getItem('activeCampaignId'); } catch { return null; }
  });
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { campaigns, loading: campaignsLoading } = useCampaignsContext();

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
    <ActiveCampaignContext.Provider value={{ activeCampaign, activeCampaignId, setActiveCampaignId, isLoading }}>
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