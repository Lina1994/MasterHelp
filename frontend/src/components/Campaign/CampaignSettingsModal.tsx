import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, IconButton, Typography, Box, Divider, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput, CircularProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Campaign, CampaignPlayer } from './types';
import CampaignInvite from './CampaignInvite';
import { useDeleteCampaign } from '../../hooks/useDeleteCampaign';
import { api } from '../../apiBase';
import { getCampaignManuals, setCampaignManuals } from '../../api/campaigns/manuals';

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
  const [availableManuals, setAvailableManuals] = useState<{ id: string; title: string }[]>([]);
  const [selectedManualIds, setSelectedManualIds] = useState<string[]>([]);
  const [savingManuals, setSavingManuals] = useState(false);
  const [loadingManuals, setLoadingManuals] = useState(false);

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

  // Load available manuals and current selection
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        setLoadingManuals(true);
        const res = await api.get('/manuals');
        const manuals = (res.data || []).map((m: any) => ({ id: String(m.id), title: m.title || String(m.id) }));
        if (!mounted) return;
        setAvailableManuals(manuals);
        const current = await getCampaignManuals(campaign.id);
        if (!mounted) return;
        setSelectedManualIds(current);
      } catch (e) {
        // noop UI: keep empty lists
      } finally {
        if (mounted) setLoadingManuals(false);
      }
    })();
    return () => { mounted = false; };
  }, [open, campaign.id]);

  const handleSaveManuals = async () => {
    setSavingManuals(true);
    try {
      await setCampaignManuals(campaign.id, selectedManualIds);
    } finally {
      setSavingManuals(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>{t('campaign_settings', 'Ajustes de campaña')}</DialogTitle>
        <DialogContent>
          {/* Manuals selection (owner only) */}
          {currentUserId && campaign.owner && campaign.owner.id === currentUserId && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('manuals_for_campaign', 'Manuales para esta campaña')}</Typography>
              {loadingManuals ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">{t('loading', 'Cargando...')}</Typography>
                </Box>
              ) : (
                <FormControl fullWidth>
                  <InputLabel id="select-manuals-label">{t('manuals', 'Manuales')}</InputLabel>
                  <Select
                    labelId="select-manuals-label"
                    multiple
                    value={selectedManualIds}
                    onChange={(e) => setSelectedManualIds(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
                    input={<OutlinedInput id="select-manuals" label={t('manuals', 'Manuales')} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => {
                          const m = availableManuals.find((x) => x.id === value);
                          return <Chip key={value} label={m?.title || value} />;
                        })}
                      </Box>
                    )}
                  >
                    {availableManuals.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.title}
                      </MenuItem>
                    ))}
                  </Select>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => setSelectedManualIds([])}>{t('clear', 'Limpiar')}</Button>
                    <Button size="small" variant="contained" onClick={handleSaveManuals} disabled={savingManuals}>
                      {savingManuals ? t('saving', 'Guardando...') : t('save', 'Guardar')}
                    </Button>
                  </Box>
                </FormControl>
              )}
            </Box>
          )}
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