
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsIcon from '@mui/icons-material/Settings';
import { CampaignSettingsModal } from '../components/Campaign/CampaignSettingsModal';
import axios from 'axios';
import API_BASE_URL from '../apiBase';
import { getCurrentUser } from '../utils/getCurrentUser';
import { Box, Typography, Button, Dialog, Card, CardContent, CardMedia, Stack } from '@mui/material';
import { useCampaigns } from '../components/Campaign/useCampaigns';
import { CampaignPlayer } from '../components/Campaign/types';
import CampaignList from '../components/Campaign/CampaignList';
import CampaignForm from '../components/Campaign/CampaignForm';
import CampaignInvite from '../components/Campaign/CampaignInvite';

const CampaignPage = () => {
  const { t } = useTranslation();
  const { campaigns, activeCampaign, setActiveCampaign, createCampaign, invitePlayer, fetchCampaigns, loading, error, updateCampaign } = useCampaigns();
  // Sincroniza activeCampaign con la lista campaigns tras cada actualización
  useEffect(() => {
    if (activeCampaign) {
      const updated = campaigns.find(c => c.id === activeCampaign.id);
      if (updated) setActiveCampaign(updated);
    }
  }, [campaigns]);
  const [openForm, setOpenForm] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [removingId, setRemovingId] = useState<string | undefined>();
  const [editMode, setEditMode] = useState(false);
  // Eliminar jugador de campaña
  const handleRemovePlayer = async (player: CampaignPlayer) => {
    if (!activeCampaign) return;
    setRemovingId(player.id);
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_BASE_URL}/campaigns/${activeCampaign.id}/player/${player.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchCampaigns();
    } catch (e) {
      // Puedes mostrar error si quieres
    } finally {
      setRemovingId(undefined);
    }
  };


  const handleSave = async (data: Partial<any>) => {
    if (editMode && activeCampaign) {
      // Editar campaña existente
      await updateCampaign(activeCampaign.id, data);
      setEditMode(false);
    } else {
      // Crear nueva campaña
      await createCampaign(data);
      setOpenForm(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
  <Typography variant="h4">{t('campaigns', 'Campañas')}</Typography>
        <Button variant="contained" color="primary" onClick={() => setOpenForm(true)}>
          {t('new_campaign', 'Nueva campaña')}
        </Button>
      </Box>
      <CampaignList
        campaigns={campaigns}
        activeCampaignId={activeCampaign?.id}
        onSelect={id => {
          const selected = campaigns.find(c => c.id === id) || null;
          setActiveCampaign(selected);
        }}
      />

      {/* Detalles de campaña activa */}
      {activeCampaign && (
        <Card sx={{ mt: 3, mb: 3, maxWidth: 600 }}>
          {activeCampaign.imageUrl && (
            <Box sx={{ width: '100%', height: 220, bgcolor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #eee' }}>
              <img
                src={activeCampaign.imageUrl}
                alt={activeCampaign.name}
                style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            </Box>
          )}
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5">{activeCampaign.name}</Typography>
              {/* Solo el owner puede editar */}
              {getCurrentUser()?.id === activeCampaign.owner?.id && (
                <Button size="small" variant="outlined" onClick={() => setEditMode(true)}>
                  {t('edit_campaign', 'Editar campaña')}
                </Button>
              )}
            </Stack>
            {activeCampaign.description && (
              <Typography variant="body1" sx={{ mt: 1 }}>{activeCampaign.description}</Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('master', 'Master')}: {activeCampaign.owner?.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('created_at', 'Creada')}: {new Date(activeCampaign.createdAt).toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('updated_at', 'Actualizada')}: {new Date(activeCampaign.updatedAt).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      )}
      {/* Gestión de jugadores/invitaciones */}
      {activeCampaign && (
        <Box sx={{ mt: 4, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" gutterBottom>{t('players_and_invitations', 'Jugadores e invitaciones')}</Typography>
            {/* Solo el master ve el botón de ajustes */}
            {(() => {
              const currentUser = getCurrentUser();
              if (currentUser && activeCampaign.owner && activeCampaign.owner.id === currentUser.id) {
                return (
                  <Button startIcon={<SettingsIcon />} size="small" onClick={() => setOpenSettings(true)}>
                    {t('settings', 'Ajustes')}
                  </Button>
                );
              }
              return null;
            })()}
          </Box>
      {/* Modal de ajustes de campaña */}
      {activeCampaign && (
        <CampaignSettingsModal
          open={openSettings}
          onClose={() => setOpenSettings(false)}
          campaign={activeCampaign}
          onRemovePlayer={handleRemovePlayer}
          removingId={removingId}
          onInvitePlayer={async (email, username) => {
            if (!activeCampaign) return;
            await invitePlayer(activeCampaign.id, email, username);
          }}
          inviteLoading={loading}
          inviteError={error}
          currentUserId={getCurrentUser()?.id}
        />
      )}
          {/* Lista de jugadores */}
          <Box sx={{ mb: 2 }}>
            {/* Jugadores activos */}
            <Typography variant="subtitle1">{t('players', 'Jugadores')}</Typography>
            {activeCampaign.players && activeCampaign.players.filter(p => p.status === 'active').length > 0 ? (
              <ul>
                {activeCampaign.players.filter(p => p.status === 'active').map(player => (
                  <li key={player.id}>
                    {player.user ? `${player.user.username} (${player.role})` : <span style={{color:'red'}}>Usuario no encontrado</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <Typography variant="body2" color="text.secondary">{t('no_active_players', 'No hay jugadores activos.')}</Typography>
            )}

            {/* Solo el master ve invitaciones pendientes y declinadas */}
            {(() => {
              const currentUser = getCurrentUser();
              if (currentUser && activeCampaign.owner && activeCampaign.owner.id === currentUser.id) {
                return <>
                  {/* Invitaciones pendientes */}
                  <Typography variant="subtitle1" sx={{ mt: 2 }}>{t('pending_invitations', 'Invitaciones pendientes')}</Typography>
                  {activeCampaign.players && activeCampaign.players.filter(p => p.status === 'invited').length > 0 ? (
                    <ul>
                      {activeCampaign.players.filter(p => p.status === 'invited').map(player => (
                        <li key={player.id}>
                          {player.user ? `${player.user.username} (pendiente de aceptar)` : <span style={{color:'red'}}>Usuario no encontrado</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Typography variant="body2" color="text.secondary">{t('no_pending_invitations', 'No hay invitaciones pendientes.')}</Typography>
                  )}
                  {/* Invitaciones declinadas */}
                  {activeCampaign.players && activeCampaign.players.filter(p => p.status === 'declined').length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ mt: 2 }}>{t('declined_invitations', 'Invitaciones declinadas')}</Typography>
                      <ul>
                        {activeCampaign.players.filter(p => p.status === 'declined').map(player => (
                          <li key={player.id}>
                            {player.user ? `${player.user.username} (rechazada)` : <span style={{color:'red'}}>Usuario no encontrado</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>;
              }
              return null;
            })()}
          </Box>
          {/* ...el formulario de invitación ahora solo está en los ajustes de campaña... */}
        </Box>
      )}
      <Dialog open={openForm || editMode} onClose={() => { setOpenForm(false); setEditMode(false); }}>
        <CampaignForm
          initial={editMode && activeCampaign ? activeCampaign : undefined}
          onSave={handleSave}
          onCancel={() => { setOpenForm(false); setEditMode(false); }}
        />
      </Dialog>
    </Box>
  );
};

export default CampaignPage;
