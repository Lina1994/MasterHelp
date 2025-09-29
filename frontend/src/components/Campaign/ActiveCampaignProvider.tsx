import { useState } from 'react';
import ActiveCampaignContext from './ActiveCampaignContext';
import { Campaign } from './types';

export function ActiveCampaignProvider({ children }: { children: React.ReactNode }) {
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  return (
    <ActiveCampaignContext.Provider value={{ activeCampaign, setActiveCampaign }}>
      {children}
    </ActiveCampaignContext.Provider>
  );
}
