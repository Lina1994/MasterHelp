import React, { useRef, useEffect } from 'react';
import { useGlobalPlayer } from './GlobalPlayerContext';
import { Box, Typography, IconButton, Tooltip, LinearProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LoopIcon from '@mui/icons-material/Loop';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { useSfxPlayer } from './SfxPlayerContext';
import { usePlayerDrawerUi } from './PlayerDrawerUiContext';

/**
 * Controles compactos del reproductor global para mostrarse en la parte inferior del sidebar.
 */
const GlobalPlayerDrawerControls: React.FC = () => {
  const { current, loop, toggleLoop, stop, loading } = useGlobalPlayer();
  const { items: sfxItems } = useSfxPlayer();
  const { sfxExpanded, toggleSfxExpanded } = usePlayerDrawerUi();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && current) {
      audioRef.current.play().catch(()=>{});
    }
  }, [current]);

  // Always render the bar if there is a song; if not, render a minimal row with sfx icon only when there are sfx
  if (!current) {
    if (!sfxItems.length) return null;
    return (
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title={sfxExpanded ? 'Ocultar efectos' : 'Mostrar efectos'}>
          <IconButton size="small" onClick={toggleSfxExpanded}>
            <GraphicEqIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {loading && <LinearProgress sx={{ mb: 0.5 }} />}
      <Typography variant="subtitle2" noWrap title={current.name}>{current.name}</Typography>
      <audio
        ref={audioRef}
        src={current.objectUrl}
        controls
        loop={loop}
        style={{ width: '100%' }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, alignItems: 'center' }}>
        {/* Compact SFX toggle */}
        <Tooltip title={sfxExpanded ? 'Ocultar efectos' : (sfxItems.length ? 'Mostrar efectos' : 'Sin efectos activos')}>
          <span>
            <IconButton size="small" onClick={toggleSfxExpanded} disabled={!sfxItems.length}>
              <GraphicEqIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={loop ? 'Loop activado' : 'Loop desactivado'}>
          <IconButton size="small" color={loop ? 'primary' : 'default'} onClick={toggleLoop}>
            <LoopIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Cerrar reproductor">
          <IconButton size="small" onClick={stop}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default GlobalPlayerDrawerControls;
