
import { FC } from 'react';
import { Campaign } from './types';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';

import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ListItemButton from '@mui/material/ListItemButton';

interface CampaignListProps {
  campaigns: Campaign[];
  activeCampaignId?: string;
  onSelect: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const CampaignList: FC<CampaignListProps> = ({ campaigns, activeCampaignId, onSelect, onEdit, onDelete }) => {
  if (!campaigns.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>No hay campañas creadas.</Typography>;
  }
  return (
    <List>
      {campaigns.map(campaign => (
        <ListItem key={campaign.id} disablePadding secondaryAction={
          <>
            {onEdit && (
              <IconButton edge="end" aria-label="edit" onClick={e => { e.stopPropagation(); onEdit(campaign.id); }}>
                <EditIcon />
              </IconButton>
            )}
            {onDelete && (
              <IconButton edge="end" aria-label="delete" onClick={e => { e.stopPropagation(); onDelete(campaign.id); }}>
                <DeleteIcon />
              </IconButton>
            )}
          </>
        }>
          <ListItemButton
            selected={campaign.id === activeCampaignId}
            onClick={() => onSelect(campaign.id)}
            sx={{ bgcolor: campaign.id === activeCampaignId ? 'action.selected' : undefined }}
          >
            <ListItemAvatar>
              <Avatar src={campaign.imageUrl} alt={campaign.name}>
                {campaign.name?.[0] || '?'}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={campaign.name}
              secondary={
                <>
                  {campaign.owner && (
                    <Typography component="span" variant="caption" color="text.secondary">
                      Master: {campaign.owner.username}
                    </Typography>
                  )}
                </>
              }
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};

export default CampaignList;
