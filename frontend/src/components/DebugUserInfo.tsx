import React from 'react';
import { getCurrentUser } from '../utils/getCurrentUser';
import { Box, Typography } from '@mui/material';

export const DebugUserInfo: React.FC = () => {
  const user = getCurrentUser();
  if (!user) return null;
  return (
    <Box sx={{ mb: 2, p: 1, border: '1px dashed #aaa', borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary">
        Usuario logueado: <b>{user.username}</b> (id: <b>{user.id}</b>, email: <b>{user.email}</b>)
      </Typography>
    </Box>
  );
};
