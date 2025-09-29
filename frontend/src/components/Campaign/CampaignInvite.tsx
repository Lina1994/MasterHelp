import { FC } from 'react';
import { Campaign } from './types';

interface CampaignInviteProps {
  campaign: Campaign;
  onInvite: (email: string) => void;
}

const CampaignInvite: FC<CampaignInviteProps> = ({ campaign, onInvite }) => {
  // TODO: Formulario para invitar jugadores
  return null;
};

export default CampaignInvite;
