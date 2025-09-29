import { FC } from 'react';
import CampaignInviteForm from './CampaignInviteForm';

interface CampaignInviteProps {
  onInvite: (email: string, username?: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

const CampaignInvite: FC<CampaignInviteProps> = ({ onInvite, loading, error }) => {
  return <CampaignInviteForm onInvite={onInvite} loading={loading} error={error} />;
};

export default CampaignInvite;
