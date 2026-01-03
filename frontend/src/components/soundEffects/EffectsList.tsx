import React from 'react';
import { List, ListItem, ListItemText, Stack, IconButton, FormControlLabel, Switch } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import LinkIcon from '@mui/icons-material/Link';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { SoundEffectMeta } from '../../types/soundEffects';

interface EffectsListProps {
  items: SoundEffectMeta[];
  campaignId: string | null;
  effectPlayMode: Record<string, 'once' | 'continuous'>;
  onPlayModeChange: (id: string, mode: 'once' | 'continuous') => void;
  onAssociate?: (id: string) => void;
  onUnassociate?: (id: string) => void;
  onEdit: (effect: SoundEffectMeta) => void;
  onPlay: (id: string) => void;
  emptyLabel: string;
  showAssociate?: boolean;
}

export const EffectsList: React.FC<EffectsListProps> = ({
  items,
  campaignId,
  effectPlayMode,
  onPlayModeChange,
  onAssociate,
  onUnassociate,
  onEdit,
  onPlay,
  emptyLabel,
  showAssociate = false,
}) => {
  return (
    <List dense>
      {items.map(e => (
        <ListItem key={e.id} secondaryAction={<Stack direction="row" spacing={1}>
          <FormControlLabel
            sx={{ mr: 1 }}
            control={<Switch size="small" checked={(effectPlayMode[e.id] ?? 'once') === 'continuous'} onChange={(_, checked) => onPlayModeChange(e.id, checked ? 'continuous' : 'once')} />}
            label={(effectPlayMode[e.id] ?? 'once') === 'continuous' ? 'Continuo' : '1 vez'}
            labelPlacement="start"
          />
          {showAssociate && campaignId && onAssociate && <IconButton size="small" title="Asociar" onClick={() => onAssociate(e.id)}><LinkIcon /></IconButton>}
          {onUnassociate && <IconButton size="small" title="Desasociar" onClick={() => onUnassociate(e.id)}><LinkOffIcon /></IconButton>}
          <IconButton size="small" title="Editar" onClick={() => onEdit(e)}><EditIcon /></IconButton>
          <IconButton size="small" title="Reproducir" onClick={() => onPlay(e.id)}><PlayArrowIcon /></IconButton>
        </Stack>}>
          <ListItemText primary={e.name} secondary={`${(e.size/1024).toFixed(1)} KB`} />
        </ListItem>
      ))}
      {items.length === 0 && (
        <ListItem><ListItemText primary={emptyLabel} /></ListItem>
      )}
    </List>
  );
};
