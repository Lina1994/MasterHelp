import { useState } from 'react';
// FIX: Changed default import to named import to resolve crash
import { ActiveCampaignContext } from './ActiveCampaignContext';
import { Campaign } from './types';

// DEPRECATED: This component is obsolete and should be deleted.
// The correct provider is exported from ActiveCampaignContext.tsx
export function ActiveCampaignProvider({ children }: { children: React.ReactNode }) {
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  
  // This is an incomplete implementation. The real provider handles localStorage persistence.
  const value = {
    activeCampaign,
    // @ts-ignore - This is intentionally broken to highlight the deprecated nature
    setActiveCampaignId: () => console.warn('Using deprecated ActiveCampaignProvider!'),
    isLoading: false,
  };

  return (
    <ActiveCampaignContext.Provider value={value}>
      {children}
    </ActiveCampaignContext.Provider>
  );
}