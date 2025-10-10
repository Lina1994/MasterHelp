import React from 'react';
import { useSfxPlayer } from './SfxPlayerContext';
import { Box, Typography, IconButton, Slider, Tooltip, Divider, Button } from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import { usePlayerDrawerUi } from './PlayerDrawerUiContext';

const SfxPlayerDrawerControls: React.FC = () => {
  const { items, stopSfx, stopAllSfx, setSfxVolume } = useSfxPlayer();
  const { sfxExpanded } = usePlayerDrawerUi();
  if (!items.length || !sfxExpanded) return null;

  return (
    <Box sx={{ borderTop: '1px dashed', borderColor: 'divider', p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">Efectos activos</Typography>
        <Button size="small" color="error" onClick={stopAllSfx}>Detener todos</Button>
      </Box>
      {items.map(it => (
        <Box key={it.instanceId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={`${it.name} (${it.loopMode}${it.waiting ? ' · esperando' : ''})`}>
            <Typography variant="caption" noWrap sx={{ flex: 1, color: it.waiting ? 'text.disabled' : 'text.primary' }}>
              {it.name} · {it.loopMode}{it.waiting ? ' · esperando' : ''}
            </Typography>
          </Tooltip>
          <Slider size="small" value={it.volume} min={0} max={1} step={0.05} onChange={(_, v) => setSfxVolume(it.instanceId, Array.isArray(v) ? v[0] as number : v as number)} sx={{ width: 100 }} />
          <IconButton size="small" onClick={() => stopSfx(it.instanceId)}><StopIcon fontSize="small" /></IconButton>
        </Box>
      ))}
    </Box>
  );
};

export default SfxPlayerDrawerControls;
