import React from 'react';
import { Card, CardContent, CardHeader, List, ListItem, ListItemText, Stack, IconButton, Button } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import StopIcon from '@mui/icons-material/Stop';
import { SoundPresetMeta } from '../../types/soundEffects';

interface PresetsListProps {
  presets: SoundPresetMeta[];
  playingPresetId: string | null;
  onPlay: (preset: SoundPresetMeta) => void;
  onEdit: (preset: SoundPresetMeta) => void;
  onStop?: () => void;
}

export const PresetsList: React.FC<PresetsListProps> = ({ presets, playingPresetId, onPlay, onEdit, onStop }) => {
  return (
    <Card variant="outlined">
      <CardHeader title="Presets" action={
        playingPresetId && onStop ? <Button color="error" startIcon={<StopIcon />} onClick={onStop}>Detener</Button> : null
      } />
      <CardContent sx={{ p: 0 }}>
        <List dense>
          {presets.map(p => (
            <ListItem key={p.id} secondaryAction={<Stack direction="row" spacing={1}>
              <IconButton size="small" title="Reproducir" onClick={() => onPlay(p)}><PlayArrowIcon /></IconButton>
              <IconButton size="small" title="Editar" onClick={() => onEdit(p)}><EditIcon /></IconButton>
            </Stack>}>
              <ListItemText primary={p.name} secondary={`${p.items?.length || 0} efectos`} />
            </ListItem>
          ))}
          {presets.length === 0 && (
            <ListItem><ListItemText primary="No hay presets" /></ListItem>
          )}
        </List>
      </CardContent>
    </Card>
  );
};
