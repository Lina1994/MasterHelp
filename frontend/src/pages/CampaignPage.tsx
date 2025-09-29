
import { useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import { CampaignSettingsModal } from '../components/Campaign/CampaignSettingsModal';
import axios from 'axios';
import API_BASE_URL from '../apiBase';
import { getCurrentUser } from '../utils/getCurrentUser';
import { Box, Typography, Button, Dialog } from '@mui/material';
import { useCampaigns } from '../components/Campaign/useCampaigns';
import { CampaignPlayer } from '../components/Campaign/types';
import CampaignList from '../components/Campaign/CampaignList';
import CampaignForm from '../components/Campaign/CampaignForm';
import CampaignInvite from '../components/Campaign/CampaignInvite';

const CampaignPage = () => {
  const { campaigns, activeCampaign, setActiveCampaign, createCampaign, invitePlayer, fetchCampaigns, loading, error } = useCampaigns();
  const [openForm, setOpenForm] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [removingId, setRemovingId] = useState<string | undefined>();
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
    await createCampaign(data);
    setOpenForm(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Campañas</Typography>
        <Button variant="contained" color="primary" onClick={() => setOpenForm(true)}>
          Nueva campaña
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
      {/* Gestión de jugadores/invitaciones */}
      {activeCampaign && (
        <Box sx={{ mt: 4, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" gutterBottom>Jugadores e invitaciones</Typography>
            {/* Solo el master ve el botón de ajustes */}
            {(() => {
              const currentUser = getCurrentUser();
              if (currentUser && activeCampaign.owner && activeCampaign.owner.id === currentUser.id) {
                return (
                  <Button startIcon={<SettingsIcon />} size="small" onClick={() => setOpenSettings(true)}>
                    Ajustes
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
            <Typography variant="subtitle1">Jugadores</Typography>
            {activeCampaign.players && activeCampaign.players.filter(p => p.status === 'active').length > 0 ? (
              <ul>
                {activeCampaign.players.filter(p => p.status === 'active').map(player => (
                  <li key={player.id}>
                    {player.user ? `${player.user.username} (${player.role})` : <span style={{color:'red'}}>Usuario no encontrado</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <Typography variant="body2" color="text.secondary">No hay jugadores activos.</Typography>
            )}

            {/* Solo el master ve invitaciones pendientes y declinadas */}
            {(() => {
              const currentUser = getCurrentUser();
              if (currentUser && activeCampaign.owner && activeCampaign.owner.id === currentUser.id) {
                return <>
                  {/* Invitaciones pendientes */}
                  <Typography variant="subtitle1" sx={{ mt: 2 }}>Invitaciones pendientes</Typography>
                  {activeCampaign.players && activeCampaign.players.filter(p => p.status === 'invited').length > 0 ? (
                    <ul>
                      {activeCampaign.players.filter(p => p.status === 'invited').map(player => (
                        <li key={player.id}>
                          {player.user ? `${player.user.username} (pendiente de aceptar)` : <span style={{color:'red'}}>Usuario no encontrado</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No hay invitaciones pendientes.</Typography>
                  )}
                  {/* Invitaciones declinadas */}
                  {activeCampaign.players && activeCampaign.players.filter(p => p.status === 'declined').length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ mt: 2 }}>Invitaciones declinadas</Typography>
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
      <Dialog open={openForm} onClose={() => setOpenForm(false)}>
        <CampaignForm
          onSave={handleSave}
          onCancel={() => setOpenForm(false)}
        />
      </Dialog>
    </Box>
  );
};

export default CampaignPage;
