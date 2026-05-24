import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ContextualMenuBase } from '../ContextualMenuBase';

type NarratorVoiceMode = 'retroBeep' | 'animalese' | 'tomodachi' | 'qwenFormant';
type TomodachiSampleSet = 'classic' | 'bright' | 'soft';
type QwenPersona = 'male' | 'female' | 'child' | 'robot';

interface NarratorContextualMenuProps {
  onSelect: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}

const VOICE_MODE_OPTIONS: Array<{
  value: NarratorVoiceMode;
  label: string;
  description: string;
}> = [
  { value: 'retroBeep', label: 'Retro Beeps', description: 'Beep sintetico por bloques cortos.' },
  { value: 'animalese', label: 'Animalese', description: 'Fonemas suaves con ritmo jugueton.' },
  { value: 'tomodachi', label: 'Tomodachi Style', description: 'Entonacion marcada con vocales reactivas.' },
  { value: 'qwenFormant', label: 'Qwen Formant', description: 'Sintesis formant con perfiles de voz humanoide.' },
];

/**
 * Contextual menu used to create a narrator scene action with voice defaults.
 */
export const NarratorContextualMenu: React.FC<NarratorContextualMenuProps> = ({ onSelect, onClose }) => {
  const [mode, setMode] = React.useState<NarratorVoiceMode>('retroBeep');
  const [speed, setSpeed] = React.useState(1);
  const [pitchRange, setPitchRange] = React.useState(8);
  const [tomodachiSampleSet, setTomodachiSampleSet] = React.useState<TomodachiSampleSet>('classic');
  const [qwenPersona, setQwenPersona] = React.useState<QwenPersona>('male');
  const [text, setText] = React.useState('Hola, soy el narrador de ejemplo.');

  const selectedMode = VOICE_MODE_OPTIONS.find((option) => option.value === mode) ?? VOICE_MODE_OPTIONS[0];
  const pitchLabel = mode === 'tomodachi' || mode === 'qwenFormant' ? 'Tono base' : 'Rango de pitch';

  const handleCreate = () => {
    const nextText = text.trim() || 'Hola, soy el narrador de ejemplo.';
    onSelect({
      displayName: `Narrador · ${selectedMode.label}`,
      text: nextText,
      voiceTarget: 'both',
      voiceConfig: {
        mode,
        speed,
        pitchRange,
        tomodachi: {
          sampleSet: tomodachiSampleSet,
          consonantDensity: 1,
          humanize: 0.65,
        },
        qwen: {
          persona: qwenPersona,
          pitchMul: qwenPersona === 'female' ? 1.3 : qwenPersona === 'child' ? 1.6 : 1,
          speedMs: qwenPersona === 'child' ? 68 : qwenPersona === 'robot' ? 72 : 70,
          brightness: qwenPersona === 'female' ? 1.3 : qwenPersona === 'child' ? 1.5 : qwenPersona === 'robot' ? 0.6 : 1,
          volume: qwenPersona === 'female' ? 0.68 : qwenPersona === 'child' ? 0.66 : qwenPersona === 'robot' ? 0.72 : 0.7,
          jitter: qwenPersona === 'robot' ? 0.02 : qwenPersona === 'child' ? 0.1 : 0.08,
          transitionMul: qwenPersona === 'female' ? 0.34 : qwenPersona === 'child' ? 0.38 : qwenPersona === 'robot' ? 0.14 : 0.3,
          vowelGlitch: qwenPersona === 'female' ? 0.3 : qwenPersona === 'child' ? 0.34 : qwenPersona === 'robot' ? 0.08 : 0.28,
        },
      },
    });
    onClose();
  };

  return (
    <ContextualMenuBase title="Añadir narrador" onClose={onClose}>
      <Stack spacing={1}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            Modo de voz
          </Typography>
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            {VOICE_MODE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                clickable
                color={mode === option.value ? 'primary' : 'default'}
                variant={mode === option.value ? 'filled' : 'outlined'}
                onClick={() => setMode(option.value)}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {selectedMode.description}
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
          <Box sx={{ gridColumn: 'span 6' }}>
            <TextField
              label="Velocidad"
              type="number"
              size="small"
              fullWidth
              value={speed}
              inputProps={{ min: 0.25, max: 3, step: 0.05 }}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </Box>
          <Box sx={{ gridColumn: 'span 6' }}>
            <TextField
              label={pitchLabel}
              type="number"
              size="small"
              fullWidth
              value={pitchRange}
              inputProps={{ min: 0, max: 24, step: 1 }}
              onChange={(event) => setPitchRange(Number(event.target.value))}
            />
          </Box>
        </Box>

        {mode === 'tomodachi' && (
          <FormControl size="small" fullWidth>
            <InputLabel>Preset de claridad</InputLabel>
            <Select
              label="Preset de claridad"
              value={tomodachiSampleSet}
              onChange={(event) => setTomodachiSampleSet(event.target.value as TomodachiSampleSet)}
            >
              <MenuItem value="soft">Suave</MenuItem>
              <MenuItem value="classic">Claro</MenuItem>
              <MenuItem value="bright">Muy claro</MenuItem>
            </Select>
          </FormControl>
        )}

        {mode === 'qwenFormant' && (
          <FormControl size="small" fullWidth>
            <InputLabel>Perfil de voz</InputLabel>
            <Select
              label="Perfil de voz"
              value={qwenPersona}
              onChange={(event) => setQwenPersona(event.target.value as QwenPersona)}
            >
              <MenuItem value="male">Masculina</MenuItem>
              <MenuItem value="female">Femenina</MenuItem>
              <MenuItem value="child">Infantil</MenuItem>
              <MenuItem value="robot">Robotica</MenuItem>
            </Select>
          </FormControl>
        )}

        <TextField
          label="Texto inicial"
          multiline
          rows={3}
          size="small"
          fullWidth
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <Alert severity="info" sx={{ py: 0 }}>
          Retro Beeps genera beeps cortos, Animalese usa fonemas, Tomodachi usa claridad por preset y Qwen Formant agrega perfiles masculina, femenina, infantil y robotica.
        </Alert>

        <Button variant="contained" onClick={handleCreate} sx={{ textTransform: 'none' }}>
          Crear narrador
        </Button>
      </Stack>
    </ContextualMenuBase>
  );
};