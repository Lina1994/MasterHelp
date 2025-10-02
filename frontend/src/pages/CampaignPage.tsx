import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import API_BASE_URL from '../apiBase';
import { Box, Typography, Button, Dialog } from '@mui/material';
import { useCampaigns } from '../components/Campaign/useCampaigns';
import { Campaign, CampaignPlayer } from '../components/Campaign/types';
import CampaignList from '../components/Campaign/CampaignList';
import CampaignForm from '../components/Campaign/CampaignForm';

const CampaignPage = () => {
  const { t } = useTranslation();
  const {
    campaigns,
    activeCampaign,
    setActiveCampaign,
    createCampaign,
    invitePlayer,
    fetchCampaigns,
    updateCampaign,
    loading,
    error,
  } = useCampaigns();

  // Sincroniza activeCampaign con la lista de campañas tras cada actualización
  useEffect(() => {
    if (activeCampaign) {
      const updated = campaigns.find(c => c.id === activeCampaign.id);
      setActiveCampaign(updated || null);
    }
  }, [campaigns, activeCampaign, setActiveCampaign]);

  const [isFormOpen, setFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>();

  const handleRemovePlayer = async (player: CampaignPlayer) => {
    if (!activeCampaign) return;
    const token = localStorage.getItem('access_token');
    await axios.delete(`${API_BASE_URL}/campaigns/${activeCampaign.id}/player/${player.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchCampaigns(); // Recarga todo para mantener la consistencia
  };

  const handleOpenCreateForm = () => {
    setEditingCampaign(undefined);
    setFormOpen(true);
  };

  const handleOpenEditForm = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormOpen(true);
  };

  const handleSave = async (data: Partial<Campaign>) => {
    if (editingCampaign) {
      await updateCampaign(editingCampaign.id, data);
    } else {
      await createCampaign(data);
    }
    setFormOpen(false);
    setEditingCampaign(undefined);
  };

  const handleSelectCampaign = (id: string) => {
    // Si se hace clic en la campaña ya activa, se deselecciona.
    if (activeCampaign?.id === id) {
      setActiveCampaign(null);
    } else {
      const selected = campaigns.find(c => c.id === id) || null;
      setActiveCampaign(selected);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">{t('campaigns', 'Campañas')}</Typography>
        <Button variant="contained" color="primary" onClick={handleOpenCreateForm}>
          {t('new_campaign', 'Nueva campaña')}
        </Button>
      </Box>

      <CampaignList
        campaigns={campaigns}
        activeCampaignId={activeCampaign?.id}
        onSelect={handleSelectCampaign}
        onEdit={handleOpenEditForm}
        onUpdate={updateCampaign}
        onRemovePlayer={handleRemovePlayer}
        onInvitePlayer={invitePlayer}
        inviteLoading={loading}
        inviteError={error}
      />

      <Dialog open={isFormOpen} onClose={() => setFormOpen(false)}>
        <CampaignForm
          initial={editingCampaign}
          onSave={handleSave}
          onCancel={() => setFormOpen(false)}
        />
      </Dialog>
    </Box>
  );
};

export default CampaignPage;