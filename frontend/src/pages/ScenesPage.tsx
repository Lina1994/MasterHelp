import React from 'react';
import { Box, Alert } from '@mui/material';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import { ScenesList } from '../components/scenes';

/**
 * Top-level scenes page.
 * Only visible to masters with an active campaign.
 */
const ScenesPage: React.FC = () => {
  const { activeCampaign } = useActiveCampaign();
  const currentUser = getCurrentUser();

  const isMaster = !!(
    activeCampaign &&
    currentUser &&
    (
      activeCampaign.owner?.id === currentUser.id ||
      activeCampaign.players?.some(
        (p: any) => p?.user?.id === currentUser.id && p?.status === 'active' && p?.role === 'master',
      )
    )
  );

  if (!activeCampaign) {
    return (
      <Box>
        <Alert severity="info">
          Selecciona una campaña para gestionar escenas.
        </Alert>
      </Box>
    );
  }

  if (!isMaster) {
    return (
      <Box>
        <Alert severity="warning">
          Solo el master tiene acceso a la herramienta de escenas.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ScenesList />
      </Box>
    </Box>
  );
};

export default ScenesPage;
