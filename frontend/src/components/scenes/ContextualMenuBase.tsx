import React from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface ContextualMenuBaseProps {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}

/**
 * Small shared container for contextual tool menus used in SceneFormDialog.
 */
export const ContextualMenuBase: React.FC<ContextualMenuBaseProps> = ({ title, children }) => {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <Box>{children}</Box>
    </Paper>
  );
};
