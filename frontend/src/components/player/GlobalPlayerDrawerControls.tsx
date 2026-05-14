import React, { useRef, useEffect } from 'react';
import { useGlobalPlayer } from './GlobalPlayerContext';
import { Box, Typography, IconButton, Tooltip, LinearProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LoopIcon from '@mui/icons-material/Loop';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { useSfxPlayer } from './SfxPlayerContext';
import { usePlayerDrawerUi } from './PlayerDrawerUiContext';
import MarqueeText from './MarqueeText';

/**
 * Controles compactos del reproductor global para mostrarse en la parte inferior del sidebar.
 */
const GlobalPlayerDrawerControls: React.FC = () => {
  const { current, loop, toggleLoop, stop, loading, next, nextMode, toggleNextMode, isQueue } = useGlobalPlayer();
  const { items: sfxItems } = useSfxPlayer();
  const { sfxExpanded, toggleSfxExpanded } = usePlayerDrawerUi();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const VOLUME_KEY = 'globalPlayer.volume';

  useEffect(() => {
    if (audioRef.current && current) {
      audioRef.current.play().catch(()=>{});
    }
  }, [current]);
  // Avanzar automáticamente al terminar si loop está desactivado y hay cola
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = async () => {
      if (!loop) {
        await next();
      }
    };
    el.addEventListener('ended', onEnded);
    return () => { el.removeEventListener('ended', onEnded); };
  }, [loop, next, current]);

  // Restore saved volume on mount and when track changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      const v = raw !== null ? Number(raw) : NaN;
      if (!Number.isNaN(v) && v >= 0 && v <= 1) {
        el.volume = v;
      }
    } catch {}
  }, [current]);

  // Persist volume changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onVolume = () => {
      try { localStorage.setItem(VOLUME_KEY, String(el.volume)); } catch {}
    };
    el.addEventListener('volumechange', onVolume);
    return () => { el.removeEventListener('volumechange', onVolume); };
  }, []);

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
  <MarqueeText text={current.name} />
      <audio
        ref={audioRef}
        data-global-player-audio="true"
        src={current.objectUrl}
        controls
        loop={loop}
        style={{ width: '100%' }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, alignItems: 'center' }}>
        <Tooltip title={loop ? 'Loop activado' : 'Loop desactivado'}>
          <IconButton size="small" color={loop ? 'primary' : 'default'} onClick={toggleLoop}>
            <LoopIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {/* Next track (visible sólo en modo playlist/cola) */}
        {isQueue && (
          <Tooltip title={nextMode === 'random' ? 'Siguiente (aleatorio)' : 'Siguiente (secuencial)'}>
            <span>
              <IconButton size="small" onClick={next}>
                <SkipNextIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title={nextMode === 'random' ? 'Siguiente aleatorio' : 'Siguiente secuencial'}>
          <IconButton size="small" color={nextMode === 'random' ? 'primary' : 'default'} onClick={toggleNextMode}>
            <ShuffleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {/* Compact SFX toggle */}
        <Tooltip title={sfxExpanded ? 'Ocultar efectos' : (sfxItems.length ? 'Mostrar efectos' : 'Sin efectos activos')}>
          <span>
            <IconButton size="small" onClick={toggleSfxExpanded} disabled={!sfxItems.length}>
              <GraphicEqIcon fontSize="small" />
            </IconButton>
          </span>
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
