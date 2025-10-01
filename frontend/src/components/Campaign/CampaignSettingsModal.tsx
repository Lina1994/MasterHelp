import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, IconButton, Typography, Box, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Campaign, CampaignPlayer } from './types';
import CampaignInvite from './CampaignInvite';
import { useDeleteCampaign } from '../../hooks/useDeleteCampaign';

interface CampaignSettingsModalProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  onRemovePlayer: (player: CampaignPlayer) => void;
  removingId?: string;
  loading?: boolean;
  onInvitePlayer?: (email: string, username?: string) => Promise<void>;
  inviteLoading?: boolean;
  inviteError?: string | null;
  currentUserId?: number;
}

export const CampaignSettingsModal: React.FC<CampaignSettingsModalProps> = ({
  open,
  onClose,
  campaign,
  onRemovePlayer,
  removingId,
  loading,
  onInvitePlayer,
  inviteLoading,
  inviteError,
  currentUserId,
}) => {
  const { t } = useTranslation();
  const [confirmPlayer, setConfirmPlayer] = useState<CampaignPlayer | null>(null);
  const [confirmDeleteCampaign, setConfirmDeleteCampaign] = useState(false);
  const { removeCampaign, loading: deleteLoading, error: deleteError } = useDeleteCampaign();

  const handleRemove = (player: CampaignPlayer) => {
    setConfirmPlayer(player);
  };

  const handleConfirm = () => {
    if (confirmPlayer) onRemovePlayer(confirmPlayer);
    setConfirmPlayer(null);
  };

  const handleDeleteCampaignClick = () => {
    setConfirmDeleteCampaign(true);
  };

  const handleConfirmDeleteCampaign = async () => {
    if (campaign) {
      try {
        await removeCampaign(campaign.id);
        onClose(); // Close modal on success
      } catch (e) {
        // Error is handled by the hook state, no need to do anything here
      }
    }
    setConfirmDeleteCampaign(false); // Close confirmation dialog
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>{t('campaign_settings', 'Ajustes de campaña')}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('active_players', 'Jugadores activos')}</Typography>
          <List>
            {campaign.players.filter((p: CampaignPlayer) => p.status === 'active').map((player: CampaignPlayer) => (
              <ListItem key={player.id} secondaryAction={
                <IconButton edge="end" color="error" onClick={() => handleRemove(player)} disabled={loading || removingId === player.id}>
                  <DeleteIcon />
                </IconButton>
              }>
                <ListItemText primary={player.user?.username || t('user', 'Usuario')} secondary={player.role} />
              </ListItem>
            ))}
          </List>
          
          {currentUserId && campaign.owner && campaign.owner.id === currentUserId && onInvitePlayer && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('invite_player', 'Invitar jugador')}</Typography>
              <CampaignInvite onInvite={onInvitePlayer} loading={inviteLoading} error={inviteError} />
            </Box>
          )}

          {/* Danger Zone for Campaign Deletion */}
          {currentUserId && campaign.owner && campaign.owner.id === currentUserId && (
            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" color="error" sx={{ mb: 1 }}>
                {t('danger_zone', 'Zona de Peligro')}
              </Typography>
              <Button
                variant="outlined"
                color="error"
                onClick={handleDeleteCampaignClick}
                disabled={deleteLoading}
                fullWidth
              >
                {deleteLoading ? t('deleting', 'Eliminando...') : t('delete_campaign', 'Eliminar esta campaña')}
              </Button>
              {deleteError && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {deleteError}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('close', 'Cerrar')}</Button>
        </DialogActions>
      </Dialog>

      {/* Player Remove Confirmation Dialog */}
      <Dialog open={!!confirmPlayer} onClose={() => setConfirmPlayer(null)}>
        <DialogTitle>{t('remove_player_title', '¿Eliminar jugador?')}</DialogTitle>
        <DialogContent>
          <Typography>{t('remove_player_confirm', '¿Seguro que quieres eliminar a')} <b>{confirmPlayer?.user?.username}</b> {t('from_campaign', 'de la campaña?')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPlayer(null)} disabled={loading}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={handleConfirm} color="error" disabled={loading} autoFocus>
            {t('delete', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Campaign Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteCampaign} onClose={() => setConfirmDeleteCampaign(false)}>
        <DialogTitle>{t('delete_campaign_title', '¿Eliminar Campaña?')}</DialogTitle>
        <DialogContent>
          <Typography>{t('delete_campaign_confirm', '¿Estás seguro de que quieres eliminar esta campaña? Esta acción es irreversible.')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteCampaign(false)} disabled={deleteLoading}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={handleConfirmDeleteCampaign} color="error" disabled={deleteLoading} autoFocus>
            {deleteLoading ? t('deleting', 'Eliminando...') : t('delete', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};