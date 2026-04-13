import { Box, Paper, Stack, Typography } from '@mui/material';
import ShortcutButton from './ShortcutButton';
import { useShortcuts } from '../../contexts/ShortcutsContext';

/**
 * Shared shell renderers for sidebar quick panel and bottom hotbar.
 */
export const SidebarShortcutsPanel = () => {
  const { config, sidebarPanelShortcuts, executeShortcut } = useShortcuts();

  if (!config.showSidebarPanel || sidebarPanelShortcuts.length === 0) return null;

  return (
    <Box sx={{ px: 1.5, pb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Atajos
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${config.sidebarPanelColumns}, minmax(0, 1fr))`,
          gap: 1,
        }}
      >
        {sidebarPanelShortcuts.slice(0, 9).map((shortcut) => (
          <ShortcutButton key={shortcut.id} shortcut={shortcut} onClick={executeShortcut} compact sidebarMinimal />
        ))}
      </Box>
    </Box>
  );
};

export const ShortcutHotbar = () => {
  const { config, hotbarShortcuts, executeShortcut } = useShortcuts();

  if (!config.showHotbar || hotbarShortcuts.length === 0) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        mt: 3,
        p: 1,
        borderRadius: 2,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
        {hotbarShortcuts.map((shortcut) => (
          <Box key={shortcut.id} sx={{ minWidth: 160 }}>
            <ShortcutButton shortcut={shortcut} onClick={executeShortcut} />
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};