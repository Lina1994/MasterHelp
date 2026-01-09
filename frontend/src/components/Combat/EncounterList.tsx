import React from 'react';
import { Paper, Stack, Typography, Button, List, ListItem, ListItemSecondaryAction, ListItemText, Chip, IconButton } from '@mui/material';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShieldIcon from '@mui/icons-material/Shield';
import GroupsIcon from '@mui/icons-material/Groups';
import { EncounterSummary, EncounterDifficulty } from '../../api/encounters';

/**
 * EncounterList: lista de encuentros con acciones de creación/edición/eliminación.
 * Responsabilidad: renderizado y acciones delegadas a callbacks.
 * Mantiene compatibilidad con el uso previo en CombatPage.
 */
export interface EncounterListProps {
  encounters: EncounterSummary[];
  isMaster: boolean;
  onCreate: () => void;
  onEdit: (enc: EncounterSummary) => void;
  onDelete: (enc: EncounterSummary) => void;
}

const difficultyColor: Record<EncounterDifficulty, 'default' | 'success' | 'warning' | 'error'> = {
  'Fácil': 'success',
  'Medio': 'default',
  'Difícil': 'warning',
  'Mortal': 'error',
};

function EncounterList({ encounters, isMaster, onCreate, onEdit, onDelete }: EncounterListProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="h6">Encuentros</Typography>
        {isMaster && (
          <Button startIcon={<EditIcon />} variant="contained" size="small" onClick={() => onCreate()}>
            Nuevo encuentro
          </Button>
        )}
      </Stack>
      {encounters.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Aún no hay encuentros. Crea el primero para comenzar a preparar el combate.</Typography>
      ) : (
        <List dense>
          {encounters.map((enc) => (
            <ListItem key={enc.id} alignItems="flex-start" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1">{enc.name}</Typography>
                    <Chip size="small" label={enc.difficulty} color={difficultyColor[enc.difficulty]} />
                    {enc.musicLabel && <Chip size="small" icon={<LibraryMusicIcon fontSize="small" />} label={enc.musicLabel} />}
                  </Stack>
                }
                secondary={
                  <Stack spacing={0.5} mt={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {enc.participants.length} integrantes · {enc.participants.filter((p) => p.kind === 'enemy').length} enemigos
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {enc.participants.map((p) => (
                        <Chip
                          key={p.id}
                          size="small"
                          label={`${p.name}${p.level ? ` · Nivel ${p.level}` : ''}${p.cr ? ` · CR ${p.cr}` : ''}`}
                          icon={p.kind === 'enemy' ? <ShieldIcon fontSize="small" /> : <GroupsIcon fontSize="small" />}
                        />
                      ))}
                    </Stack>
                  </Stack>
                }
              />
              {isMaster && (
                <ListItemSecondaryAction>
                  <IconButton edge="end" aria-label="edit" size="small" onClick={() => onEdit(enc)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" size="small" sx={{ ml: 1 }} onClick={() => onDelete(enc)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}

export default EncounterList;
