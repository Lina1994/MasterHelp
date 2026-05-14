import { Box, Paper, Stack, Typography } from '@mui/material';
import ShortcutButton from './ShortcutButton';
import { useShortcuts } from '../../contexts/ShortcutsContext';

/**
 * Shared shell renderers for sidebar quick panel and bottom hotbar.
 */
export const SidebarShortcutsPanel = () => {
  const { config, sidebarPanelShortcuts, executeShortcut, activePanelName } = useShortcuts();

  if (!config.showSidebarPanel || sidebarPanelShortcuts.length === 0) return null;

  return (
    <Box sx={{ px: 1.5, pb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Atajos · {activePanelName}
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
  const { config, hotbarShortcuts, executeShortcut, activePanelName } = useShortcuts();

  if (!config.showHotbar || hotbarShortcuts.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: { xs: 8, sm: 252 },
        right: 12,
        bottom: 12,
        zIndex: (theme) => theme.zIndex.drawer + 3,
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={10}
        sx={{
          width: 'fit-content',
          maxWidth: '100%',
          ml: { xs: 0, sm: 'auto' },
          mr: { xs: 0, sm: 'auto' },
          px: 1,
          py: 0.75,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(22, 28, 36, 0.9)',
          backdropFilter: 'blur(6px)',
          pointerEvents: 'auto',
        }}
      >
        <Typography variant="caption" color="rgba(255,255,255,0.8)" sx={{ display: 'block', mb: 0.5, px: 0.5 }}>
          Panel: {activePanelName}
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto' }}>
          {hotbarShortcuts.slice(0, 9).map((shortcut) => (
            <Box key={shortcut.id} sx={{ minWidth: 58, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <ShortcutButton
                shortcut={shortcut}
                onClick={executeShortcut}
                hotbar
              />
              {shortcut.hotkey ? (
                <Typography
                  variant="caption"
                  sx={{
                    mt: 0.35,
                    fontSize: 10,
                    lineHeight: 1,
                    color: 'rgba(255,255,255,0.86)',
                    textAlign: 'center',
                    maxWidth: 56,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {shortcut.hotkey}
                </Typography>
              ) : (
                <Box sx={{ mt: 0.35, height: 10 }} />
              )}
            </Box>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
};