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
import { estimateNarrationDurationMs } from '../utils/narratorPlayback';

type NarratorVoiceMode = 'retroBeep' | 'animalese' | 'tomodachi' | 'qwenFormant' | 'roboti' | 'orchestra';
type TomodachiSampleSet = 'classic' | 'bright' | 'soft';
type QwenPersona = 'male' | 'female' | 'child' | 'robot';
type RobotiVoice = 'male' | 'female' | 'neutral';

type RobotiPreset = {
  pitchSemitones: number;
  vibratoPct: number;
  brightness: number;
  noiseAmount: number;
  lfRd: number;
  aspiration: number;
  transitionMs: number;
  spacePauseMs: number;
  punctuationPauseMs: number;
  volume: number;
};

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
  { value: 'tomodachi', label: 'Bibepo', description: 'Entonacion marcada con vocales reactivas.' },
  { value: 'qwenFormant', label: 'Queque', description: 'Sintesis formant con perfiles de voz humanoide.' },
  { value: 'orchestra', label: 'Orchestra', description: 'Lectura musical por capas instrumentales.' },
  { value: 'roboti', label: 'Roboti', description: 'Sintesis procedural con vibrato y perfil vocal configurable.' },
];

const ROBOTI_PRESETS: Record<RobotiVoice, RobotiPreset> = {
  male: {
    pitchSemitones: -1,
    vibratoPct: 18,
    brightness: 0.9,
    noiseAmount: 0.14,
    lfRd: 1.95,
    aspiration: 0.26,
    transitionMs: 14,
    spacePauseMs: 70,
    punctuationPauseMs: 300,
    volume: 0.8,
  },
  female: {
    pitchSemitones: 3,
    vibratoPct: 28,
    brightness: 1.04,
    noiseAmount: 0.13,
    lfRd: 1.55,
    aspiration: 0.2,
    transitionMs: 13,
    spacePauseMs: 70,
    punctuationPauseMs: 300,
    volume: 0.76,
  },
  neutral: {
    pitchSemitones: 0,
    vibratoPct: 22,
    brightness: 0.96,
    noiseAmount: 0.15,
    lfRd: 1.8,
    aspiration: 0.24,
    transitionMs: 14,
    spacePauseMs: 70,
    punctuationPauseMs: 300,
    volume: 0.78,
  },
};

/**
 * Contextual menu used to create a narrator scene action with voice defaults.
 */
export const NarratorContextualMenu: React.FC<NarratorContextualMenuProps> = ({ onSelect, onClose }) => {
  const [mode, setMode] = React.useState<NarratorVoiceMode>('retroBeep');
  const [speed, setSpeed] = React.useState(1);
  const [pitchRange, setPitchRange] = React.useState(8);
  const [tomodachiSampleSet, setTomodachiSampleSet] = React.useState<TomodachiSampleSet>('classic');
  const [qwenPersona, setQwenPersona] = React.useState<QwenPersona>('male');
  const [robotiVoice, setRobotiVoice] = React.useState<RobotiVoice>('neutral');
  const [robotiPitchSemitones, setRobotiPitchSemitones] = React.useState(0);
  const [robotiVibratoPct, setRobotiVibratoPct] = React.useState(22);
  const [robotiBrightness, setRobotiBrightness] = React.useState(0.96);
  const [robotiNoiseAmount, setRobotiNoiseAmount] = React.useState(0.15);
  const [robotiLfRd, setRobotiLfRd] = React.useState(1.8);
  const [robotiAspiration, setRobotiAspiration] = React.useState(0.24);
  const [robotiTransitionMs, setRobotiTransitionMs] = React.useState(14);
  const [robotiSpacePauseMs, setRobotiSpacePauseMs] = React.useState(70);
  const [robotiPunctuationPauseMs, setRobotiPunctuationPauseMs] = React.useState(300);
  const [robotiVolume, setRobotiVolume] = React.useState(0.78);
  const [text, setText] = React.useState('Hola, soy el narrador de ejemplo.');

  const selectedMode = VOICE_MODE_OPTIONS.find((option) => option.value === mode) ?? VOICE_MODE_OPTIONS[0];
  const pitchLabel = mode === 'tomodachi' || mode === 'qwenFormant' ? 'Tono base' : 'Rango de pitch';

  const applyRobotiPreset = React.useCallback((voice: RobotiVoice) => {
    const preset = ROBOTI_PRESETS[voice];
    setRobotiVoice(voice);
    setRobotiPitchSemitones(preset.pitchSemitones);
    setRobotiVibratoPct(preset.vibratoPct);
    setRobotiBrightness(preset.brightness);
    setRobotiNoiseAmount(preset.noiseAmount);
    setRobotiLfRd(preset.lfRd);
    setRobotiAspiration(preset.aspiration);
    setRobotiTransitionMs(preset.transitionMs);
    setRobotiSpacePauseMs(preset.spacePauseMs);
    setRobotiPunctuationPauseMs(preset.punctuationPauseMs);
    setRobotiVolume(preset.volume);
  }, []);

  const handleCreate = () => {
    const nextText = text.trim() || 'Hola, soy el narrador de ejemplo.';
    onSelect({
      displayName: `Narrador · ${selectedMode.label}`,
      text: nextText,
      voiceTarget: 'both',
          durationMs: estimateNarrationDurationMs(nextText, {
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
            roboti: {
              voice: robotiVoice,
              pitchSemitones: robotiPitchSemitones,
              vibratoPct: robotiVibratoPct,
              brightness: robotiBrightness,
              noiseAmount: robotiNoiseAmount,
              lfRd: robotiLfRd,
              aspiration: robotiAspiration,
              transitionMs: robotiTransitionMs,
              spacePauseMs: robotiSpacePauseMs,
              punctuationPauseMs: robotiPunctuationPauseMs,
              volume: robotiVolume,
            },
          }),
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
        roboti: {
          voice: robotiVoice,
          pitchSemitones: robotiPitchSemitones,
          vibratoPct: robotiVibratoPct,
          brightness: robotiBrightness,
          noiseAmount: robotiNoiseAmount,
          lfRd: robotiLfRd,
          aspiration: robotiAspiration,
          transitionMs: robotiTransitionMs,
          spacePauseMs: robotiSpacePauseMs,
          punctuationPauseMs: robotiPunctuationPauseMs,
          volume: robotiVolume,
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

        {mode === 'roboti' && (
          <Stack spacing={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Perfil Roboti</InputLabel>
              <Select
                label="Perfil Roboti"
                value={robotiVoice}
                onChange={(event) => applyRobotiPreset(event.target.value as RobotiVoice)}
              >
                <MenuItem value="male">Masculina</MenuItem>
                <MenuItem value="female">Femenina</MenuItem>
                <MenuItem value="neutral">Neutra</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Tono base (semitonos)"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiPitchSemitones}
                  inputProps={{ min: -12, max: 12, step: 1 }}
                  onChange={(event) => setRobotiPitchSemitones(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Vibrato (%)"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiVibratoPct}
                  inputProps={{ min: 0, max: 100, step: 1 }}
                  onChange={(event) => setRobotiVibratoPct(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Brillo"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiBrightness}
                  inputProps={{ min: 0.4, max: 2, step: 0.05 }}
                  onChange={(event) => setRobotiBrightness(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Ruido"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiNoiseAmount}
                  inputProps={{ min: 0, max: 0.8, step: 0.01 }}
                  onChange={(event) => setRobotiNoiseAmount(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="LF Rd"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiLfRd}
                  inputProps={{ min: 0.7, max: 2.7, step: 0.05 }}
                  onChange={(event) => setRobotiLfRd(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Aspiracion"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiAspiration}
                  inputProps={{ min: 0, max: 0.8, step: 0.01 }}
                  onChange={(event) => setRobotiAspiration(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Transicion (ms)"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiTransitionMs}
                  inputProps={{ min: 4, max: 30, step: 1 }}
                  onChange={(event) => setRobotiTransitionMs(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Volumen"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiVolume}
                  inputProps={{ min: 0.1, max: 1, step: 0.05 }}
                  onChange={(event) => setRobotiVolume(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Pausa por espacio (ms)"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiSpacePauseMs}
                  inputProps={{ min: 20, max: 300, step: 5 }}
                  onChange={(event) => setRobotiSpacePauseMs(Number(event.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Pausa por puntuacion (ms)"
                  type="number"
                  size="small"
                  fullWidth
                  value={robotiPunctuationPauseMs}
                  inputProps={{ min: 80, max: 700, step: 10 }}
                  onChange={(event) => setRobotiPunctuationPauseMs(Number(event.target.value))}
                />
              </Box>
            </Box>
          </Stack>
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

        <Button variant="contained" onClick={handleCreate} sx={{ textTransform: 'none' }}>
          Crear narrador
        </Button>
      </Stack>
    </ContextualMenuBase>
  );
};