import React from 'react';
import { Box, Button, Chip, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OutboundIcon from '@mui/icons-material/Outbound';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { EncounterSummary } from '../../api/encounters';
import { CharacterPayload } from '../../api/characters';
import type { CampaignMonsterDetail } from '../../api/bestiary/bestiaryApi';
import { stripGroupSuffix } from './utils';

export interface InitiativePanelProps {
  round: number;
  turnIndex: number;
  orderedParticipants: EncounterSummary['participants'];
  currentTurnId: string | null;
  selectedParticipantId: string | null;
  setSelectedParticipantId: (id: string) => void;
  battleStarted: boolean;
  onStartBattle: () => void | Promise<void>;
  onEndBattle: () => void | Promise<void>;
  onPreviousTurn: () => void;
  onNextTurn: () => void;
  isMaster: boolean;
  charMap: Map<string, CharacterPayload>;
  enemyDisplayNameById: Record<string, string>;
  monsterDetailByPid: Record<string, CampaignMonsterDetail | null>;
  savingInitiative: Record<string, boolean>;
  savingHp: Record<string, boolean>;
  setHp: (p: EncounterSummary['participants'][number], kind: 'currentHp' | 'tempHp', value: number | undefined) => void;
  setHpLocal: (pid: string, field: 'currentHp' | 'maxHp', value: number | undefined) => void;
  setInitiativeLocal: (pid: string, value: number | undefined) => void;
  schedulePersistInitiative: (pid: string) => void;
}

const InitiativePanel: React.FC<InitiativePanelProps> = ({
  round,
  turnIndex,
  orderedParticipants,
  currentTurnId,
  selectedParticipantId,
  setSelectedParticipantId,
  battleStarted,
  onStartBattle,
  onEndBattle,
  onPreviousTurn,
  onNextTurn,
  isMaster,
  charMap,
  enemyDisplayNameById,
  monsterDetailByPid,
  savingInitiative,
  savingHp,
  setHp,
  setHpLocal,
  setInitiativeLocal,
  schedulePersistInitiative,
}) => {
  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">Orden por iniciativa</Typography>
        <Chip size="small" label={`Ronda ${round}`} />
        {orderedParticipants.length > 0 && (
          <Chip size="small" label={`Turno ${turnIndex + 1}/${orderedParticipants.length}`} />
        )}
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
        {!battleStarted && (
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={onStartBattle}>Empezar batalla</Button>
        )}
        {battleStarted && (
          <>
            <Button variant="outlined" startIcon={<OutboundIcon />} onClick={onEndBattle}>Escapar batalla</Button>
            <Button variant="contained" color="success" startIcon={<EmojiEventsIcon />} onClick={onEndBattle}>Batalla ganada</Button>
          </>
        )}
        <Button variant="outlined" onClick={onPreviousTurn}>Turno anterior</Button>
        <Button variant="outlined" onClick={onNextTurn}>Turno siguiente</Button>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap">
        {orderedParticipants.map((p) => {
          const isEnemy = p.role === 'foe';
          const isAlly = !isEnemy;
          const char = isAlly && p.kind === 'character' ? charMap.get(p.id) : undefined;
          const ch = isAlly ? (char?.currentHp ?? p.currentHp) : (typeof p.currentHp === 'number' ? p.currentHp : undefined);
          const mx = isAlly ? (char?.maxHp ?? p.maxHp) : (typeof p.maxHp === 'number' ? p.maxHp : undefined);
          const temp = isAlly ? (char?.tempHp) : undefined;
          const hasCh = typeof ch === 'number' && !Number.isNaN(ch as any);
          const hasMx = typeof mx === 'number' && !Number.isNaN(mx as any) && (mx as number) > 0;
          const percent = hasCh && hasMx ? Math.max(0, Math.min(100, (Number(ch) / Number(mx)) * 100)) : undefined;
          const isCurrentTurn = p.id === currentTurnId;
          const isSelected = p.id === selectedParticipantId;
          const borderColor = isCurrentTurn ? 'primary.main' : (isSelected ? 'secondary.main' : 'divider');

          return (
            <Box key={p.id} sx={{ flex: '1 1 280px', minWidth: 240, maxWidth: 360 }}>
              <Paper
                variant="outlined"
                sx={{ p: 1, borderRadius: 1, borderColor, borderWidth: 1, borderStyle: 'solid', cursor: 'pointer' }}
                onClick={() => {
                  setSelectedParticipantId(p.id);
                  try {
                    const baseName = stripGroupSuffix(p.name || '');
                    const md = isEnemy && p.kind !== 'character' ? (monsterDetailByPid[p.id] || null) : null;
                    const mdSummary = md ? {
                      traits: md.traits?.length || 0,
                      actions: md.actions?.length || 0,
                      reactions: md.reactions?.length || 0,
                      legendaryActions: md.legendaryActions?.length || 0,
                      lairActions: md.lairActions?.length || 0,
                      regionalEffects: md.regionalEffects?.length || 0,
                      senses: md.senses ? Object.keys(md.senses).length : 0,
                      skills: md.skills ? Object.keys(md.skills).length : 0,
                      languages: md.languages ? 1 : 0,
                      sampleTrait: md.traits?.[0],
                      sampleAction: md.actions?.[0],
                    } : null;
                    const ch = isAlly ? (char?.currentHp ?? p.currentHp) : (typeof p.currentHp === 'number' ? p.currentHp : undefined);
                    const mx = isAlly ? (char?.maxHp ?? p.maxHp) : (typeof p.maxHp === 'number' ? p.maxHp : undefined);
                    const temp = isAlly ? (char?.tempHp) : undefined;
                    console.log('[CombatView][Select]', {
                      participant: {
                        id: p.id,
                        name: p.name,
                        displayName: isEnemy ? (enemyDisplayNameById[p.id] || p.name) : p.name,
                        role: p.role,
                        kind: p.kind,
                        initiative: p.initiative,
                        currentHp: ch,
                        maxHp: mx,
                        tempHp: temp,
                      },
                      enemyResolution: isEnemy ? {
                        manualId: (p as any).monsterManualId,
                        slug: (p as any).monsterSlug,
                        baseName,
                        detailLoaded: !!md,
                        detailSummary: mdSummary,
                      } : undefined,
                    });
                  } catch {}
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedParticipantId(p.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Stack spacing={0.75}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1">{isEnemy ? (enemyDisplayNameById[p.id] || p.name) : p.name}</Typography>
                    {isCurrentTurn && <Chip size="small" label="Turno actual" color="primary" />}
                    {isSelected && !isCurrentTurn && <Chip size="small" label="Seleccionado" color="secondary" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">{(isEnemy ? 'Enemigo' : 'Aliado')} · Ini {p.initiative ?? '—'}</Typography>
                  {percent !== undefined ? (
                    <Stack spacing={0.5}>
                      <LinearProgress variant="determinate" value={percent} />
                      <Typography variant="caption" color="text.secondary">
                        HP {hasCh ? ch : '—'}/{hasMx ? mx : '—'}{isAlly && typeof temp === 'number' ? ` · Temp ${temp}` : ''}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">HP —</Typography>
                  )}
                  {isMaster ? (
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      {isAlly ? (
                        <>
                          <TextField
                            size="small"
                            type="number"
                            label="HP"
                            inputProps={{ min: 0, style: { width: 64 } }}
                            value={hasCh ? Number(ch) : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              setHp(p, 'currentHp', val);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); } }}
                          />
                          {p.kind === 'character' && (
                            <TextField
                              size="small"
                              type="number"
                              label="Temp"
                              inputProps={{ min: 0, style: { width: 64 } }}
                              value={typeof temp === 'number' ? temp : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setHp(p, 'tempHp', val);
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <TextField
                            size="small"
                            type="number"
                            label="HP"
                            inputProps={{ min: 0, style: { width: 64 } }}
                            value={p.currentHp ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              setHpLocal(p.id, 'currentHp', val);
                              schedulePersistInitiative(p.id);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); schedulePersistInitiative(p.id); } }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="HP Max"
                            inputProps={{ min: 1, style: { width: 64 } }}
                            value={p.maxHp ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              setHpLocal(p.id, 'maxHp', val);
                              schedulePersistInitiative(p.id);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); schedulePersistInitiative(p.id); } }}
                          />
                        </>
                      )}
                      {(savingInitiative[p.id] || savingHp[p.id]) && <Chip size="small" label="Guardando..." />}
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            </Box>
          );
        })}
      </Stack>
    </>
  );
};

export default InitiativePanel;
