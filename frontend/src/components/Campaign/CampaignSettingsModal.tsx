import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, IconButton, Typography, Box } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Campaign, CampaignPlayer } from './types';
import CampaignInvite from './CampaignInvite';

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

  const handleRemove = (player: CampaignPlayer) => {
    setConfirmPlayer(player);
  };

  const handleConfirm = () => {
    if (confirmPlayer) onRemovePlayer(confirmPlayer);
    setConfirmPlayer(null);
  };

  return (
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
        {/* Solo el owner/master puede invitar */}
        {currentUserId && campaign.owner && campaign.owner.id === currentUserId && onInvitePlayer && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('invite_player', 'Invitar jugador')}</Typography>
            <CampaignInvite onInvite={onInvitePlayer} loading={inviteLoading} error={inviteError} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('close', 'Cerrar')}</Button>
      </DialogActions>
      {/* Confirmación de borrado */}
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
    </Dialog>
  );
};
