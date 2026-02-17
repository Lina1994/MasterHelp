import React from 'react';
import { Box, Alert } from '@mui/material';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import { ShopsList } from '../components/shops/ShopsList';

const ShopsPage: React.FC = () => {
  const { activeCampaign } = useActiveCampaign();
  const currentUser = getCurrentUser();
  const isMaster = !!(activeCampaign && currentUser && activeCampaign.owner?.id === currentUser.id);

  if (!activeCampaign) {
    return (
      <Box>
        <Alert severity="info">
          Selecciona una campaña para gestionar tiendas.
        </Alert>
      </Box>
    );
  }

  if (!isMaster) {
    return (
      <Box>
        <Alert severity="warning">
          Solo el master tiene acceso a las tiendas.
        </Alert>
      </Box>
    );
  }

  return <ShopsList />;
};

export default ShopsPage;
