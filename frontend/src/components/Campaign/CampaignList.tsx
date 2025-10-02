
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Campaign, CampaignPlayer } from './types';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import CampaignItem from './CampaignItem';

interface CampaignListProps {
  campaigns: Campaign[];
  activeCampaignId?: string;
  onSelect: (id: string) => void;
  onEdit: (campaign: Campaign) => void;
  onUpdate: (id: string, data: Partial<Campaign>) => Promise<void>;
  onRemovePlayer: (player: CampaignPlayer) => Promise<void>;
  onInvitePlayer: (campaignId: string, email: string, username?: string) => Promise<void>;
  inviteLoading: boolean;
  inviteError: string | null;
}

const CampaignList: FC<CampaignListProps> = ({
  campaigns,
  activeCampaignId,
  onSelect,
  onEdit,
  onUpdate,
  onRemovePlayer,
  onInvitePlayer,
  inviteLoading,
  inviteError,
}) => {
  const { t } = useTranslation();

  if (!campaigns.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{t('no_campaigns', 'No hay campañas creadas.')}</Typography>;
  }

  return (
    <List sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {campaigns.map(campaign => (
        <CampaignItem
          key={campaign.id}
          campaign={campaign}
          isActive={campaign.id === activeCampaignId}
          onSelect={() => onSelect(campaign.id)}
          onEdit={() => onEdit(campaign)}
          onUpdate={onUpdate}
          onRemovePlayer={onRemovePlayer}
          onInvitePlayer={onInvitePlayer}
          inviteLoading={inviteLoading}
          inviteError={inviteError}
        />
      ))}
    </List>
  );
};

export default CampaignList;
