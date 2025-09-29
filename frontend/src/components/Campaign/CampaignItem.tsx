import { FC } from 'react';
import { Campaign } from './types';

interface CampaignItemProps {
  campaign: Campaign;
  isActive: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const CampaignItem: FC<CampaignItemProps> = ({ campaign, isActive, onSelect, onEdit, onDelete }) => {
  // TODO: Renderizar datos de campaña, imagen/nombre, botones de acción
  return null;
};

export default CampaignItem;
