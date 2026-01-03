import React from 'react';
import { Card, CardContent, CardHeader, Stack, Box, Slider, Select, MenuItem, TextField, Switch, FormControlLabel, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { LoopMode, SoundEffectMeta } from '../../types/soundEffects';

export type PresetItemInput = {
  soundEffectId: string;
  volume: number;
  loopMode: LoopMode;
  waitSec?: number;
  randomMinSec?: number;
  randomMaxSec?: number;
  echoEnabled?: boolean;
  echoDelayMs?: number;
  echoFeedback?: number;
  pitchSemitones?: number;
};

interface PresetItemsEditorProps {
  items: PresetItemInput[];
  effectsById: Map<string, SoundEffectMeta>;
  onChange: (next: PresetItemInput[]) => void;
}

export const PresetItemsEditor: React.FC<PresetItemsEditorProps> = ({ items, effectsById, onChange }) => {
  const updateAt = (idx: number, patch: Partial<PresetItemInput>) => {
    onChange(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };
  const removeAt = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <Stack spacing={2}>
      {items.map((it, idx) => {
        const eff = effectsById.get(it.soundEffectId);
        if (!eff) return null;
        return (
          <Card key={it.soundEffectId} variant="outlined">
            <CardHeader title={eff.name} />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  Volumen: <Slider value={it.volume} onChange={(_, v) => updateAt(idx, { volume: Array.isArray(v) ? v[0] as number : v as number })} step={0.05} min={0} max={1} />
                </Box>
                <Box>
                  <Select size="small" value={it.loopMode} onChange={e => updateAt(idx, { loopMode: e.target.value as LoopMode })}>
                    <MenuItem value="continuous">Continuo</MenuItem>
                    <MenuItem value="fixed">Con espera fija</MenuItem>
                    <MenuItem value="random">Con espera aleatoria</MenuItem>
                  </Select>
                </Box>
                {it.loopMode === 'fixed' && (
                  <TextField type="number" size="small" label="Espera (s)" inputProps={{ step: 0.1 }} value={it.waitSec ?? 0} onChange={e => updateAt(idx, { waitSec: Math.max(0, Number(e.target.value || 0)) })} />
                )}
                {it.loopMode === 'random' && (
                  <Stack direction="row" spacing={2}>
                    <TextField type="number" size="small" label="Mín (s)" inputProps={{ step: 0.1 }} value={it.randomMinSec ?? 0} onChange={e => updateAt(idx, { randomMinSec: Math.max(0, Number(e.target.value || 0)) })} />
                    <TextField type="number" size="small" label="Máx (s)" inputProps={{ step: 0.1 }} value={it.randomMaxSec ?? 0} onChange={e => updateAt(idx, { randomMaxSec: Math.max(0, Number(e.target.value || 0)) })} />
                  </Stack>
                )}
                <FormControlLabel control={<Switch size="small" checked={!!it.echoEnabled} onChange={(_, v) => updateAt(idx, { echoEnabled: v })} />} label="Eco" />
                {it.echoEnabled && (
                  <Stack direction="row" spacing={2}>
                    <TextField type="number" size="small" label="Retardo (ms)" inputProps={{ step: 10 }} value={it.echoDelayMs ?? 300} onChange={e => updateAt(idx, { echoDelayMs: Math.max(0, Number(e.target.value || 0)) })} />
                    <Box display="flex" alignItems="center" gap={1}>
                      Feedback: <Slider sx={{ width: 120 }} value={it.echoFeedback ?? 0.3} onChange={(_, v)=> updateAt(idx, { echoFeedback: Array.isArray(v)? v[0] as number : v as number })} min={0} max={1} step={0.05} />
                    </Box>
                  </Stack>
                )}
                <TextField type="number" size="small" label="Tono (semitonos)" inputProps={{ step: 1, min: -24, max: 24 }} value={it.pitchSemitones ?? 0} onChange={e => updateAt(idx, { pitchSemitones: Number(e.target.value) })} />
                <Box>
                  <Button color="error" onClick={() => removeAt(idx)} startIcon={<DeleteIcon />}>Quitar</Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
};
