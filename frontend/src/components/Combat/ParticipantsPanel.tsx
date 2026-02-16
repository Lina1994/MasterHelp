import React from 'react';
import { Box, Button, Chip, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { EncounterSummary } from '../../api/encounters';
import { CharacterPayload } from '../../api/characters';
import { Paper } from '@mui/material';
import AuthImage from '../common/AuthImage';
import type { CampaignMonsterDetail } from '../../api/bestiary/bestiaryApi';

export interface ParticipantsPanelProps {
  isMaster: boolean;
  allies: EncounterSummary['participants'];
  foes: EncounterSummary['participants'];
  charMap: Map<string, CharacterPayload>;
  enemyDisplayNameById: Record<string, string>;
  monsterDetailByPid: Record<string, CampaignMonsterDetail | null>;
  savingInitiative: Record<string, boolean>;
  savingHp: Record<string, boolean>;
  setHp: (p: EncounterSummary['participants'][number], kind: 'currentHp' | 'tempHp', value: number | undefined) => void;
  setHpLocal: (pid: string, field: 'currentHp' | 'maxHp', value: number | undefined) => void;
  setInitiativeLocal: (pid: string, value: number | undefined) => void;
  schedulePersistInitiative: (pid: string) => void;
  rollAllEnemiesInitiative: () => void | Promise<void>;
  rollAllEnemiesHp: (mode: 'avg' | 'dice') => void | Promise<void>;
  onCreateTokenForParticipant?: (p: EncounterSummary['participants'][number]) => void;
}

const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  isMaster,
  allies,
  foes,
  charMap,
  enemyDisplayNameById,
  monsterDetailByPid,
  savingInitiative,
  savingHp,
  setHp,
  setHpLocal,
  setInitiativeLocal,
  schedulePersistInitiative,
  rollAllEnemiesInitiative,
  rollAllEnemiesHp,
  onCreateTokenForParticipant,
}) => {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems={'center'}>
        <Typography variant="subtitle1">Participantes</Typography>
        {!isMaster && <Chip size="small" label="Solo lectura" />}
      </Stack>

      {/* Aliados */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Aliados</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {allies.map((p) => {
            const char = p.kind === 'character' ? charMap.get(p.id) : undefined;
            const ch = (char?.currentHp ?? p.currentHp);
            const mx = (char?.maxHp ?? p.maxHp);
            const temp = (char?.tempHp);
            const hasCh = typeof ch === 'number' && !Number.isNaN(ch as any);
            const hasMx = typeof mx === 'number' && !Number.isNaN(mx as any) && (mx as number) > 0;
            const percent = hasCh && hasMx ? Math.max(0, Math.min(100, (Number(ch) / Number(mx)) * 100)) : undefined;
            return (
              <Box key={p.id} sx={{ flex: '1 1 280px', minWidth: 240, maxWidth: 360 }}>
                <Paper variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="body1">{p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name}</Typography>
                    {percent !== undefined ? (
                      <Stack spacing={0.5}>
                        <LinearProgress variant="determinate" value={percent} />
                        <Typography variant="caption" color="text.secondary">HP {hasCh ? ch : '—'}/{hasMx ? mx : '—'}{typeof temp === 'number' ? ` · Temp ${temp}` : ''}</Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">HP —</Typography>
                    )}
                    {isMaster ? (
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
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
                        <TextField
                          size="small"
                          type="number"
                          label="Ini"
                          inputProps={{ min: -10, max: 50, style: { width: 64 } }}
                          value={p.initiative ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            setInitiativeLocal(p.id, val);
                            schedulePersistInitiative(p.id);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); schedulePersistInitiative(p.id); } }}
                        />
                        {(savingInitiative[p.id] || savingHp[p.id]) && <Chip size="small" label="Guardando..." />}
                        {onCreateTokenForParticipant && (
                          <Button size="small" variant="outlined" onClick={() => onCreateTokenForParticipant(p)}>Añadir token</Button>
                        )}
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1}>
                        <Chip size="small" label={`Ini ${p.initiative ?? '—'}`} variant="outlined" />
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Enemigos */}
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2">Enemigos</Typography>
          {isMaster && (
            <Button size="small" variant="outlined" startIcon={<CasinoIcon />} onClick={rollAllEnemiesInitiative}>
              Calcular iniciativa (todos)
            </Button>
          )}
          {isMaster && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" variant="outlined" startIcon={<FavoriteIcon />} onClick={() => rollAllEnemiesHp('avg')}>
                Calcular HP (media)
              </Button>
              <Button size="small" variant="outlined" startIcon={<FavoriteIcon />} onClick={() => rollAllEnemiesHp('dice')}>
                Calcular HP (dados)
              </Button>
            </Stack>
          )}
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {foes.map((p) => {
            const char = p.kind === 'character' ? charMap.get(p.id) : undefined;
            const ch = (char?.currentHp ?? p.currentHp);
            const mx = (char?.maxHp ?? p.maxHp);
            const temp = (char?.tempHp);
            const hasCh = typeof ch === 'number' && !Number.isNaN(ch as any);
            const hasMx = typeof mx === 'number' && !Number.isNaN(mx as any) && (mx as number) > 0;
            const percent = hasCh && hasMx ? Math.max(0, Math.min(100, (Number(ch) / Number(mx)) * 100)) : undefined;
            
            // Get illustration: character image for character enemies, monster image for monster enemies
            // Also check if an 'enemy' kind participant is actually a character by looking up in charMap
            let illustrationUrl: string | undefined;
            const isCharacter = p.kind === 'character' || charMap.has(p.id);
            if (isCharacter) {
              const char = charMap.get(p.id);
              illustrationUrl = char?.characterImageUrl || undefined;
            } else {
              const md = monsterDetailByPid[p.id];
              illustrationUrl = md?.imageUrls?.medium || md?.imageUrls?.low || md?.imageUrls?.high;
            }
            
            return (
              <Box key={p.id} sx={{ flex: '1 1 280px', minWidth: 240, maxWidth: 360 }}>
                <Paper variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {illustrationUrl && (
                        <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 1, overflow: 'hidden' }}>
                          <AuthImage
                            src={illustrationUrl}
                            alt={p.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </Box>
                      )}
                      <Typography variant="body1" sx={{ flex: 1 }}>{p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name}</Typography>
                    </Stack>
                    {percent !== undefined ? (
                      <Stack spacing={0.5}>
                        <LinearProgress variant="determinate" value={percent} />
                        <Typography variant="caption" color="text.secondary">HP {hasCh ? ch : '—'}/{hasMx ? mx : '—'}{typeof temp === 'number' ? ` · Temp ${temp}` : ''}</Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">HP —</Typography>
                    )}
                    {isMaster ? (
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        {p.kind === 'character' ? (
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
                          </>
                        ) : (
                          <>
                            <TextField
                              size="small"
                              type="number"
                              label="HP"
                              inputProps={{ min: 0, style: { width: 64 } }}
                              value={hasCh ? Number(ch) : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setHpLocal(p.id, 'currentHp', val);
                                schedulePersistInitiative(p.id);
                              }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label="HP Max"
                              inputProps={{ min: 1, style: { width: 64 } }}
                              value={hasMx ? Number(mx) : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setHpLocal(p.id, 'maxHp', val);
                                schedulePersistInitiative(p.id);
                              }}
                            />
                          </>
                        )}
                        <TextField
                          size="small"
                          type="number"
                          label="Ini"
                          inputProps={{ min: -10, max: 50, style: { width: 64 } }}
                          value={p.initiative ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            setInitiativeLocal(p.id, val);
                            schedulePersistInitiative(p.id);
                          }}
                        />
                        {(savingInitiative[p.id] || savingHp[p.id]) && <Chip size="small" label="Guardando..." />}
                        {onCreateTokenForParticipant && (
                          <Button size="small" variant="outlined" onClick={() => onCreateTokenForParticipant(p)}>Añadir token</Button>
                        )}
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1}>
                        <Chip size="small" label={`Ini ${p.initiative ?? '—'}`} variant="outlined" />
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
};

export default ParticipantsPanel;
