import React from 'react';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ContextualMenuBaseProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Small shared container for contextual tool menus used in SceneFormDialog.
 */
export const ContextualMenuBase: React.FC<ContextualMenuBaseProps> = ({ title, onClose, children }) => {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Cerrar menú contextual">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box>{children}</Box>
    </Paper>
  );
};
