import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, IconButton, Typography, Box } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Campaign, CampaignPlayer } from '../components/Campaign/types';
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
      <DialogTitle>Ajustes de campaña</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Jugadores activos</Typography>
        <List>
          {campaign.players.filter((p: CampaignPlayer) => p.status === 'active').map((player: CampaignPlayer) => (
            <ListItem key={player.id} secondaryAction={
              <IconButton edge="end" color="error" onClick={() => handleRemove(player)} disabled={loading || removingId === player.id}>
                <DeleteIcon />
              </IconButton>
            }>
              <ListItemText primary={player.user?.username || 'Usuario'} secondary={player.role} />
            </ListItem>
          ))}
        </List>
        {/* Solo el owner/master puede invitar */}
        {currentUserId && campaign.owner && campaign.owner.id === currentUserId && onInvitePlayer && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Invitar jugador</Typography>
            <CampaignInvite onInvite={onInvitePlayer} loading={inviteLoading} error={inviteError} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
      {/* Confirmación de borrado */}
      <Dialog open={!!confirmPlayer} onClose={() => setConfirmPlayer(null)}>
        <DialogTitle>¿Eliminar jugador?</DialogTitle>
        <DialogContent>
          <Typography>¿Seguro que quieres eliminar a <b>{confirmPlayer?.user?.username}</b> de la campaña?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPlayer(null)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} color="error" disabled={loading} autoFocus>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};
