import { createContext } from 'react';
import { Campaign } from './types';

export interface ActiveCampaignContextType {
  activeCampaign: Campaign | null;
  setActiveCampaign: (c: Campaign | null) => void;
}

const ActiveCampaignContext = createContext<ActiveCampaignContextType>({
  activeCampaign: null,
  setActiveCampaign: () => {},
});

export default ActiveCampaignContext;
