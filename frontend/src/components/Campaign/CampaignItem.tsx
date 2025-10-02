import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Campaign, CampaignPlayer } from './types';
import { getCurrentUser } from '../../utils/getCurrentUser';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import { CampaignSettingsModal } from './CampaignSettingsModal';

interface CampaignItemProps {
  campaign: Campaign;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onUpdate: (id: string, data: Partial<Campaign>) => Promise<void>;
  onRemovePlayer: (player: CampaignPlayer) => Promise<void>;
  onInvitePlayer: (campaignId: string, email: string, username?: string) => Promise<void>;
  inviteLoading: boolean;
  inviteError: string | null;
}

const CampaignItem: FC<CampaignItemProps> = ({
  campaign,
  isActive,
  onSelect,
  onEdit,
  onUpdate,
  onRemovePlayer,
  onInvitePlayer,
  inviteLoading,
  inviteError,
}) => {
  const { t } = useTranslation();
  const [openSettings, setOpenSettings] = useState(false);
  const [removingId, setRemovingId] = useState<string | undefined>();

  const isOwner = getCurrentUser()?.id === campaign.owner?.id;

  const handleRemovePlayer = async (player: CampaignPlayer) => {
    setRemovingId(player.id);
    await onRemovePlayer(player);
    setRemovingId(undefined);
  };

  const pendingInvitations = campaign.players?.filter(p => p.status === 'invited') || [];
  const declinedInvitations = campaign.players?.filter(p => p.status === 'declined') || [];

  return (
    <ListItem key={campaign.id} disablePadding sx={{ display: 'block' }}>
      <ListItemButton
        selected={isActive}
        onClick={onSelect}
        sx={{
          border: '1px solid',
          borderColor: isActive ? 'primary.main' : 'divider',
          borderRadius: 1,
        }}
      >
        <ListItemAvatar>
          <Avatar src={campaign.imageUrl} alt={campaign.name}>
            {campaign.name?.[0] || '?'}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={campaign.name}
          secondary={
            <Typography component="span" variant="caption" color="text.secondary">
              {t('master', 'Master')}: {campaign.owner?.username}
            </Typography>
          }
        />
        {isOwner && (
          <Box>
            <IconButton edge="end" aria-label="settings" onClick={(e) => { e.stopPropagation(); setOpenSettings(true); }}>
              <SettingsIcon />
            </IconButton>
            <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <EditIcon />
            </IconButton>
          </Box>
        )}
      </ListItemButton>

      <Collapse in={isActive} timeout="auto" unmountOnExit>
        <Card sx={{ mt: 1, mb: 2, border: '1px solid', borderColor: 'divider' }}>
          {campaign.imageUrl && (
            <Box sx={{ width: '100%', height: 220, bgcolor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #eee' }}>
              <img src={campaign.imageUrl} alt={campaign.name} style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain' }} />
            </Box>
          )}
          <CardContent>
            {campaign.description && (
              <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>{campaign.description}</Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {t('created_at', 'Creada')}: {new Date(campaign.createdAt).toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('updated_at', 'Actualizada')}: {new Date(campaign.updatedAt).toLocaleString()}
            </Typography>

            {/* --- Players and Invitations --- */}
            <Box sx={{ position: 'relative' }}>
              {/* Active Players */}
              <Typography variant="subtitle1">{t('players', 'Jugadores')}</Typography>
              {campaign.players && campaign.players.filter(p => p.status === 'active').length > 0 ? (
                <List dense>
                  {campaign.players.filter(p => p.status === 'active').map(player => (
                    <ListItem key={player.id} disableGutters>
                      <ListItemText primary={player.user ? `${player.user.username} (${player.role})` : t('user_not_found', 'Usuario no encontrado')} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('no_active_players', 'No hay jugadores activos.')}</Typography>
              )}

              {/* Pending/Declined Invitations (Owner only) */}
              {isOwner && (
                <>
                  {/* Conditionally render Pending Invitations */}
                  {pendingInvitations.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ mt: 2 }}>{t('pending_invitations', 'Invitaciones pendientes')}</Typography>
                      <List dense>
                        {pendingInvitations.map(player => (
                          <ListItem key={player.id} disableGutters>
                            <ListItemText primary={player.user ? `${player.user.username} (${t('pending_acceptance', 'pendiente de aceptar')})` : t('user_not_found', 'Usuario no encontrado')} />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  )}

                  {/* Conditionally render Declined Invitations */}
                  {declinedInvitations.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ mt: 2 }}>{t('declined_invitations', 'Invitaciones declinadas')}</Typography>
                      <List dense>
                        {declinedInvitations.map(player => (
                          <ListItem key={player.id} disableGutters>
                            <ListItemText primary={player.user ? `${player.user.username} (${t('declined', 'rechazada')})` : t('user_not_found', 'Usuario no encontrado')} />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  )}
                </>
              )}
            </Box>
          </CardContent>
        </Card>
      </Collapse>

      {/* Settings Modal */}
      <CampaignSettingsModal
        open={openSettings}
        onClose={() => setOpenSettings(false)}
        campaign={campaign}
        onRemovePlayer={handleRemovePlayer}
        removingId={removingId}
        onInvitePlayer={async (email, username) => {
          await onInvitePlayer(campaign.id, email, username);
        }}
        inviteLoading={inviteLoading}
        inviteError={inviteError}
        currentUserId={getCurrentUser()?.id}
      />
    </ListItem>
  );
};

export default CampaignItem;