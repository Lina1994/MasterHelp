import React from 'react';
import { useInvitations } from '../hooks/useInvitations';
import { Button, Card, CardContent, Typography, Box, CircularProgress, Alert, Stack, Avatar } from '@mui/material';

export const InvitationsList: React.FC = () => {
  const { invitations, loading, error, accept, decline } = useInvitations();

  if (loading) return <Box display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!invitations.length) return null;

  return (
    <Stack spacing={2}>
      {invitations.map(inv => (
        <Card key={inv.id} variant="outlined">
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar src={inv.campaign.imageUrl} alt={inv.campaign.name} />
              <Box flex={1}>
                <Typography variant="subtitle1">{inv.campaign.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Invitado por: {inv.campaign.owner.username}
                </Typography>
              </Box>
              <Button color="success" variant="contained" size="small" onClick={() => accept(inv.id)}>
                Aceptar
              </Button>
              <Button color="error" variant="outlined" size="small" onClick={() => decline(inv.id)}>
                Rechazar
              </Button>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};
