
import { useState } from 'react';
import { Box, Typography, Button, Dialog } from '@mui/material';
import { useCampaigns } from '../components/Campaign/useCampaigns';
import CampaignList from '../components/Campaign/CampaignList';
import CampaignForm from '../components/Campaign/CampaignForm';
import CampaignInvite from '../components/Campaign/CampaignInvite';

const CampaignPage = () => {
  const { campaigns, activeCampaign, setActiveCampaign, createCampaign } = useCampaigns();
  const [openForm, setOpenForm] = useState(false);

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
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>Jugadores e invitaciones</Typography>
          {/* Lista de jugadores */}
          <Box sx={{ mb: 2 }}>
            {activeCampaign.players && activeCampaign.players.length > 0 ? (
              <ul>
                {activeCampaign.players.map(player => (
                  <li key={player.id}>
                    {player.user.username} ({player.role}) - {player.status}
                  </li>
                ))}
              </ul>
            ) : (
              <Typography variant="body2" color="text.secondary">No hay jugadores ni invitaciones.</Typography>
            )}
          </Box>
          {/* Formulario de invitación */}
          <CampaignInvite campaign={activeCampaign} onInvite={email => {/* TODO: lógica de invitación */}} />
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
