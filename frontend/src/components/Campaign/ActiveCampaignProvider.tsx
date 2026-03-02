import { useState } from 'react';
// FIX: Changed default import to named import to resolve crash
import { ActiveCampaignContext, ActiveCampaignContextType } from './ActiveCampaignContext';
import { Campaign } from './types';

// DEPRECATED: This component is obsolete and should be deleted.
// The correct provider is exported from ActiveCampaignContext.tsx
export function ActiveCampaignProvider({ children }: { children: React.ReactNode }) {
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  // This is an incomplete stub. The real provider handles localStorage persistence.
  const value: ActiveCampaignContextType = {
    activeCampaign,
    activeCampaignId: null,
    setActiveCampaignId: (_id: string | null) =>
      console.warn('Using deprecated ActiveCampaignProvider!'),
    isLoading: false,
  };

  return (
    <ActiveCampaignContext.Provider value={value}>
      {children}
    </ActiveCampaignContext.Provider>
  );
}