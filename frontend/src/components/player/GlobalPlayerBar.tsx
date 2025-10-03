import React, { useRef, useEffect } from 'react';
import { useGlobalPlayer } from './GlobalPlayerContext';
import { Card, CardContent, Typography, Box, Button, LinearProgress } from '@mui/material';

export const GlobalPlayerBar: React.FC = () => {
  const { current, loop, toggleLoop, stop, loading } = useGlobalPlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && current) {
      audioRef.current.play().catch(()=>{});
    }
  }, [current]);

  if (!current) return null;

  return (
    <Card variant="outlined" sx={{ position: 'fixed', bottom: 8, right: 16, width: 360, zIndex: 1300 }}>
      {loading && <LinearProgress />}
      <CardContent sx={{ pb: '8px!important' }}>
        <Typography variant="subtitle1" noWrap>{current.name}</Typography>
        {current.size && (
          <Typography variant="caption" color="text.secondary">{(current.size/1024).toFixed(1)} KB</Typography>
        )}
        <audio
          ref={audioRef}
          src={current.objectUrl}
          controls
          loop={loop}
          style={{ width: '100%', marginTop: 4 }}
          onEnded={() => { /* loop handled by attr; nothing extra */ }}
        />
        <Box mt={1} display="flex" gap={1}>
          <Button size="small" variant={loop ? 'contained' : 'outlined'} onClick={toggleLoop}>
            {loop ? 'Loop ON' : 'Loop OFF'}
          </Button>
          <Button size="small" onClick={stop}>Cerrar</Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default GlobalPlayerBar;
