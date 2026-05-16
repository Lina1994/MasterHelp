import { Avatar, Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import { useActiveScenes } from '../../contexts/ActiveScenesContext';
import { useShortcuts } from '../../contexts/ShortcutsContext';

/**
 * Fixed bottom strip with currently active scene executions.
 */
const ActiveScenesBar = () => {
  const { activeScenes, requestStopExecution } = useActiveScenes();
  const { config, hotbarShortcuts } = useShortcuts();

  if (activeScenes.length === 0) return null;

  const hasHotbar = config.showHotbar && hotbarShortcuts.length > 0;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: { xs: 8, sm: 252 },
        right: 12,
        bottom: hasHotbar ? { xs: 106, sm: 108 } : 12,
        zIndex: (theme) => theme.zIndex.drawer + 2,
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
          Escenas activas
        </Typography>

        <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto' }}>
          {activeScenes.map((item) => (
            <Box
              key={item.executionId}
              sx={{
                minWidth: 62,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.35,
              }}
            >
              <Tooltip title={item.sceneName}>
                <Avatar
                  src={item.imageUrl ?? undefined}
                  sx={{
                    width: 44,
                    height: 44,
                    bgcolor: item.imageUrl ? 'transparent' : 'action.selected',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {item.imageUrl ? null : (item.icon || <TheaterComedyIcon fontSize="small" />)}
                </Avatar>
              </Tooltip>

              <Tooltip title={item.loop ? 'Detener loop' : 'Detener ejecución'}>
                <IconButton
                  size="small"
                  sx={{ color: '#f87171', p: 0.25 }}
                  onClick={() => { void requestStopExecution(item.executionId); }}
                >
                  <StopCircleIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Typography
                variant="caption"
                sx={{
                  maxWidth: 64,
                  lineHeight: 1.1,
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.85)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.sceneName}
              </Typography>

              <Chip
                size="small"
                label={item.loop ? 'Bucle' : 'Una vez'}
                color={item.loop ? 'secondary' : 'default'}
                variant={item.loop ? 'filled' : 'outlined'}
                sx={{
                  height: 18,
                  '& .MuiChip-label': { px: 0.6, fontSize: 10, lineHeight: 1 },
                }}
              />
            </Box>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
};

export default ActiveScenesBar;
