import React, { useMemo, useState } from 'react';
import { Button, Checkbox, Chip, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import type { CombatNote } from '../../hooks/useCombatNotes';

export interface CombatNotesBoxProps {
  participantId: string | null;
  note: CombatNote | null;
  battleStarted: boolean;
  currentRound: number;
  currentTurnIndex: number; // zero-based
  onUpsert: (participantId: string, text: string, trackByTurns: boolean, addedRound?: number, addedTurnIndex?: number, durationTurns?: number) => void;
  onUpdate: (participantId: string, patch: Partial<Pick<CombatNote, 'text' | 'trackByTurns' | 'count' | 'durationTurns'>>) => void;
  onRemove: (participantId: string) => void;
}

/**
 * CombatNotesBox
 *
 * Per-participant note box shown below detail cards. Allows adding/updating
 * a single note tied to the given participant, showing metadata of when
 * it was added and a counter of how many of that participant's turns
 * have elapsed since.
 */
export default function CombatNotesBox({ participantId, note, battleStarted, currentRound, currentTurnIndex, onUpsert, onUpdate, onRemove }: CombatNotesBoxProps) {
  const [text, setText] = useState('');
  const [trackByTurns, setTrackByTurns] = useState(true);
  const [duration, setDuration] = useState<number | ''>('');

  const hasParticipant = useMemo(() => !!participantId, [participantId]);

  const handleSave = () => {
    if (!participantId) return;
    const t = (note ? note.text : text).trim();
    const track = note ? note.trackByTurns : trackByTurns;
    if (!t) return;
    const dur = note ? note.durationTurns : (typeof duration === 'number' ? duration : undefined);
    onUpsert(participantId, t, track, currentRound, currentTurnIndex, dur);
    if (!note) { setText(''); setDuration(''); }
  };

  // Hide note proactively if expired (avoid UI flash on next turn)
  const displayNote = useMemo(() => {
    if (!note) return null;
    if (note.trackByTurns && typeof note.durationTurns === 'number') {
      const cnt = note.count || 0;
      // Keep note visible during the Nth turn; expire before the (N+1)th
      if (cnt > note.durationTurns) return null;
    }
    return note;
  }, [note]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, flex: '1 1 100%', mt: 1 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Nota</Typography>
        {!hasParticipant ? (
          <Typography variant="caption" color="text.secondary">Sin participante.</Typography>
        ) : (
          <>
            {!displayNote ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <TextField
                  size="small"
                  fullWidth
                  label="Añadir nota (p. ej. 'Envenenado')"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Checkbox checked={trackByTurns} onChange={(_, v) => setTrackByTurns(v)} />
                  <Typography variant="caption" color="text.secondary">Contar turnos</Typography>
                </Stack>
                {trackByTurns && (
                  <TextField
                    size="small"
                    type="number"
                    label="Duración (turnos)"
                    inputProps={{ min: 1, style: { width: 120 } }}
                    value={duration}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDuration(v === '' ? '' : Math.max(1, Number(v)));
                    }}
                  />
                )}
                <Button size="small" variant="contained" onClick={handleSave} disabled={!battleStarted || !text.trim()}>Añadir</Button>
              </Stack>
            ) : (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <TextField
                    size="small"
                    fullWidth
                    label="Nota"
                    value={displayNote.text}
                    onChange={(e) => participantId && onUpdate(participantId, { text: e.target.value })}
                  />
                  <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                    {displayNote.trackByTurns ? (
                      <Chip size="small" label={`Turnos: ${displayNote.count ?? 0}`} color="primary" />
                    ) : (
                      <Chip size="small" label="Sin contador" variant="outlined" />
                    )}
                    <IconButton size="small" onClick={() => participantId && onUpdate(participantId, { trackByTurns: !displayNote.trackByTurns })}>
                      {displayNote.trackByTurns ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                    </IconButton>
                    {displayNote.trackByTurns && (
                      <>
                        <IconButton size="small" onClick={() => participantId && onUpdate(participantId, { count: Math.max(0, (displayNote.count || 0) - 1) })}>
                          <RemoveCircleOutlineIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => participantId && onUpdate(participantId, { count: (displayNote.count || 0) + 1 })}>
                          <AddCircleOutlineIcon />
                        </IconButton>
                        <TextField
                          size="small"
                          type="number"
                          label="Duración (turnos)"
                          inputProps={{ min: 1, style: { width: 120 } }}
                          value={displayNote.durationTurns ?? ''}
                          onChange={(e) => participantId && onUpdate(participantId, { durationTurns: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })}
                        />
                      </>
                    )}
                    {participantId && (
                      <IconButton size="small" color="error" onClick={() => onRemove(participantId)}>
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {typeof displayNote.addedRound === 'number' && typeof displayNote.addedTurnIndex === 'number'
                    ? `Añadida en ronda ${displayNote.addedRound}, turno ${displayNote.addedTurnIndex + 1}`
                    : 'Ronda/turno de creación no registrado'}
                </Typography>
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}
