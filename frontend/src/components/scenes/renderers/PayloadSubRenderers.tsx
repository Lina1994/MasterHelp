import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { NARRATIVE_FONT_OPTIONS, NARRATIVE_STYLE_PRESETS } from '../constants/narrativePresets';
import type { SceneVideoAsset } from '../../../types/scenes';
import { estimateNarrationDurationMs } from '../utils/narratorPlayback';

export type NarrativeSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSizePx?: number;
  color?: string;
  fontFamily?: string;
};

type VoiceMode = 'retroBeep' | 'animalese' | 'tomodachi' | 'qwenFormant' | 'roboti' | 'orchestra';
type TomodachiSampleSet = 'classic' | 'bright' | 'soft';
type QwenPersona = 'male' | 'female' | 'child' | 'robot';
type RobotiVoice = 'male' | 'female' | 'neutral';
type OrchestraInstrument = 'piano' | 'marimba' | 'guitar' | 'violin' | 'flute' | 'oboe' | 'trumpet' | 'retro';

type VoiceTomodachiConfig = {
  sampleSet: TomodachiSampleSet;
  consonantDensity: number;
  humanize: number;
};

type VoiceQwenConfig = {
  persona: QwenPersona;
  pitchMul: number;
  speedMs: number;
  brightness: number;
  volume: number;
  jitter: number;
  transitionMul: number;
  vowelGlitch: number;
};

type VoiceRobotiConfig = {
  voice: RobotiVoice;
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

type VoiceOrchestraConfig = {
  instrumentType: OrchestraInstrument;
  toneHz: number;
  timbreHz: number;
  speedMs: number;
  expressiveness: number;
};

const QWEN_PERSONA_PRESETS: Record<QwenPersona, VoiceQwenConfig> = {
  male: { persona: 'male', pitchMul: 1, speedMs: 70, brightness: 1, volume: 0.7, jitter: 0.08, transitionMul: 0.3, vowelGlitch: 0.28 },
  female: { persona: 'female', pitchMul: 1.3, speedMs: 70, brightness: 1.3, volume: 0.68, jitter: 0.08, transitionMul: 0.34, vowelGlitch: 0.3 },
  child: { persona: 'child', pitchMul: 1.6, speedMs: 68, brightness: 1.5, volume: 0.66, jitter: 0.1, transitionMul: 0.38, vowelGlitch: 0.34 },
  robot: { persona: 'robot', pitchMul: 1, speedMs: 72, brightness: 0.6, volume: 0.72, jitter: 0.02, transitionMul: 0.14, vowelGlitch: 0.08 },
};

const ROBOTI_VOICE_PRESETS: Record<RobotiVoice, VoiceRobotiConfig> = {
  male: { voice: 'male', pitchSemitones: -1, vibratoPct: 18, brightness: 0.9, noiseAmount: 0.14, lfRd: 1.95, aspiration: 0.26, transitionMs: 14, spacePauseMs: 70, punctuationPauseMs: 300, volume: 0.8 },
  female: { voice: 'female', pitchSemitones: 3, vibratoPct: 28, brightness: 1.04, noiseAmount: 0.13, lfRd: 1.55, aspiration: 0.2, transitionMs: 13, spacePauseMs: 70, punctuationPauseMs: 300, volume: 0.76 },
  neutral: { voice: 'neutral', pitchSemitones: 0, vibratoPct: 22, brightness: 0.96, noiseAmount: 0.15, lfRd: 1.8, aspiration: 0.24, transitionMs: 14, spacePauseMs: 70, punctuationPauseMs: 300, volume: 0.78 },
};

const ORCHESTRA_PRESETS: Record<OrchestraInstrument, VoiceOrchestraConfig> = {
  piano: { instrumentType: 'piano', toneHz: 500, timbreHz: 4000, speedMs: 70, expressiveness: 120 },
  marimba: { instrumentType: 'marimba', toneHz: 640, timbreHz: 5200, speedMs: 62, expressiveness: 95 },
  guitar: { instrumentType: 'guitar', toneHz: 460, timbreHz: 3600, speedMs: 78, expressiveness: 140 },
  violin: { instrumentType: 'violin', toneHz: 560, timbreHz: 5200, speedMs: 88, expressiveness: 170 },
  flute: { instrumentType: 'flute', toneHz: 720, timbreHz: 6800, speedMs: 84, expressiveness: 110 },
  oboe: { instrumentType: 'oboe', toneHz: 610, timbreHz: 5400, speedMs: 74, expressiveness: 130 },
  trumpet: { instrumentType: 'trumpet', toneHz: 760, timbreHz: 7600, speedMs: 80, expressiveness: 160 },
  retro: { instrumentType: 'retro', toneHz: 520, timbreHz: 3000, speedMs: 58, expressiveness: 75 },
};

type VoiceConfig = {
  mode: VoiceMode;
  speed: number;
  pitchRange: number;
  tomodachi: VoiceTomodachiConfig;
  qwen: VoiceQwenConfig;
  roboti: VoiceRobotiConfig;
  orchestra: VoiceOrchestraConfig;
};

type VoiceTarget = 'main' | 'projection' | 'both' | 'none';

const resolveNarrativeDurationMs = (
  text: string,
  voiceConfig: VoiceConfig,
  currentDurationMs: unknown,
): number | undefined => {
  const normalizedCurrentDurationMs = Number(currentDurationMs);
  const currentDuration = Number.isFinite(normalizedCurrentDurationMs) && normalizedCurrentDurationMs > 0
    ? Math.max(0, Math.round(normalizedCurrentDurationMs))
    : undefined;
  let estimatedDuration = 0;
  try {
    estimatedDuration = Math.max(0, Math.round(estimateNarrationDurationMs(text, voiceConfig)));
  } catch (error) {
    // Keep editor responsive if synthesis estimation receives unexpected payloads.
    console.warn('[NarrativePayloadRenderer] duration estimation failed', error);
    return currentDuration;
  }
  if (estimatedDuration <= 0) {
    return currentDuration;
  }
  return estimatedDuration;
};

type BasePayloadProps = {
  str: (key: string) => string;
  num: (key: string, fallback?: number) => number;
  setPayload: (key: string, value: unknown) => void;
};

type ChromaPayloadProps = {
  chroma: { enabled: boolean; color: string; tolerance: number };
  setChroma: (patch: Partial<{ enabled: boolean; color: string; tolerance: number }>) => void;
  onStartChromaColorPick?: () => void;
  isChromaColorPicking?: boolean;
};

export type SendImagePayloadRendererProps = BasePayloadProps & ChromaPayloadProps;

export const SendImagePayloadRenderer: React.FC<SendImagePayloadRendererProps> = ({
  str,
  num,
  setPayload,
  chroma,
  setChroma,
  onStartChromaColorPick,
  isChromaColorPicking,
}) => {
  return (
    <Stack spacing={1}>
      <TextField label="URL de imagen" size="small" value={str('imageUrl')} onChange={(e) => setPayload('imageUrl', e.target.value)} />
      <TextField label="Titulo (opcional)" size="small" value={str('title')} onChange={(e) => setPayload('title', e.target.value)} />
      <TextField
        label="Opacidad (0-1)"
        type="number"
        size="small"
        fullWidth
        value={num('opacity', 1)}
        inputProps={{ min: 0, max: 1, step: 0.05 }}
        onChange={(e) => setPayload('opacity', Number(e.target.value))}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
        <Box sx={{ gridColumn: 'span 4' }}>
          <TextField label="X (%)" type="number" size="small" fullWidth value={num('leftPct', 10)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('leftPct', Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: 'span 4' }}>
          <TextField label="Y (%)" type="number" size="small" fullWidth value={num('topPct', 10)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('topPct', Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: 'span 4' }}>
          <TextField label="Capa" type="number" size="small" fullWidth value={num('layerOrder', 100)} onChange={(e) => setPayload('layerOrder', Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: 'span 6' }}>
          <TextField label="Ancho (%)" type="number" size="small" fullWidth value={num('widthPct', 80)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('widthPct', Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: 'span 6' }}>
          <TextField label="Alto (%)" type="number" size="small" fullWidth value={num('heightPct', 80)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('heightPct', Number(e.target.value))} />
        </Box>
      </Box>
      <Divider sx={{ my: 0.5 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
        <Box sx={{ gridColumn: 'span 6' }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Croma</InputLabel>
            <Select
              label="Croma"
              value={chroma.enabled ? 'si' : 'no'}
              onChange={(e) => setChroma({ enabled: e.target.value === 'si' })}
            >
              <MenuItem value="si">Activo</MenuItem>
              <MenuItem value="no">Inactivo</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ gridColumn: 'span 6' }}>
          <TextField
            label="Color croma"
            size="small"
            fullWidth
            value={chroma.color}
            onChange={(e) => setChroma({ color: e.target.value })}
          />
        </Box>
        <Box sx={{ gridColumn: 'span 6' }}>
          <TextField
            label="Tolerancia"
            type="number"
            size="small"
            fullWidth
            value={chroma.tolerance}
            inputProps={{ min: 0, max: 100, step: 1 }}
            onChange={(e) => setChroma({ tolerance: Number(e.target.value) })}
          />
        </Box>
        {onStartChromaColorPick ? (
          <Box sx={{ gridColumn: 'span 6', display: 'flex', alignItems: 'center' }}>
            <Button
              variant={isChromaColorPicking ? 'contained' : 'outlined'}
              size="small"
              fullWidth
              onClick={onStartChromaColorPick}
              sx={{ textTransform: 'none', height: '100%', py: 1, fontSize: '0.72rem' }}
            >
              {isChromaColorPicking ? 'Capturando...' : 'Color exacto'}
            </Button>
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
};

export type SendVideoPayloadRendererProps = BasePayloadProps &
  ChromaPayloadProps & {
    bool: (key: string) => boolean;
    sceneVideoAssets?: SceneVideoAsset[];
    onRequestUploadVideo?: () => void;
  };

export const SendVideoPayloadRenderer: React.FC<SendVideoPayloadRendererProps> = ({
  str,
  num,
  bool,
  setPayload,
  chroma,
  setChroma,
  sceneVideoAssets,
  onRequestUploadVideo,
  onStartChromaColorPick,
  isChromaColorPicking,
}) => {
  const rawVideoAssetId = str('videoAssetId');
  const availableVideoAssetIds = new Set((sceneVideoAssets ?? []).map((asset) => asset.id));
  const selectedVideoAssetId = availableVideoAssetIds.has(rawVideoAssetId) ? rawVideoAssetId : '';

  return (
    <Stack spacing={1}>
      <FormControl size="small" fullWidth>
        <InputLabel>Video subido</InputLabel>
        <Select
          value={selectedVideoAssetId}
          label="Video subido"
          onChange={(e) => setPayload('videoAssetId', e.target.value)}
        >
          <MenuItem value="">(ninguno)</MenuItem>
          {rawVideoAssetId && !availableVideoAssetIds.has(rawVideoAssetId) ? (
            <MenuItem value={rawVideoAssetId}>
              Video no disponible ({rawVideoAssetId.slice(0, 8)}...)
            </MenuItem>
          ) : null}
          {(sceneVideoAssets ?? []).map((asset) => (
            <MenuItem key={asset.id} value={asset.id}>
              {asset.name} ({Math.round(asset.size / (1024 * 1024))}MB)
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {onRequestUploadVideo ? (
        <Button variant="outlined" size="small" fullWidth onClick={onRequestUploadVideo}>
          Subir nuevo video
        </Button>
      ) : null}
      <Typography variant="caption" color="text.secondary">
        Selecciona un video subido y el backend resolvera la URL firmada al ejecutar.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
        <Box sx={{ gridColumn: 'span 4' }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Loop</InputLabel>
            <Select value={bool('loop') ? 'si' : 'no'} label="Loop" onChange={(e) => setPayload('loop', e.target.value === 'si')}>
              <MenuItem value="si">Si</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ gridColumn: 'span 4' }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Sin audio</InputLabel>
            <Select value={bool('muted') ? 'si' : 'no'} label="Sin audio" onChange={(e) => setPayload('muted', e.target.value === 'si')}>
              <MenuItem value="si">Si</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ gridColumn: 'span 4' }}>
          <TextField
            label="Opacidad"
            type="number"
            size="small"
            fullWidth
            value={num('opacity', 1)}
            inputProps={{ min: 0, max: 1, step: 0.05 }}
            onChange={(e) => setPayload('opacity', Number(e.target.value))}
          />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
        <Box sx={{ gridColumn: 'span 4' }}>
          <TextField label="X (%)" type="number" size="small" fullWidth value={num('leftPct', 10)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('leftPct', Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: 'span 4' }}>
          <TextField label="Y (%)" type="number" size="small" fullWidth value={num('topPct', 10)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('topPct', Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: 'span 4' }}>
          <TextField label="Capa" type="number" size="small" fullWidth value={num('layerOrder', 100)} onChange={(e) => setPayload('layerOrder', Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: 'span 6' }}>
          <TextField label="Ancho (%)" type="number" size="small" fullWidth value={num('widthPct', 80)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('widthPct', Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: 'span 6' }}>
          <TextField label="Alto (%)" type="number" size="small" fullWidth value={num('heightPct', 80)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('heightPct', Number(e.target.value))} />
        </Box>
      </Box>
      <Divider sx={{ my: 0.5 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
        <Box sx={{ gridColumn: 'span 6' }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Croma</InputLabel>
            <Select
              label="Croma"
              value={chroma.enabled ? 'si' : 'no'}
              onChange={(e) => setChroma({ enabled: e.target.value === 'si' })}
            >
              <MenuItem value="si">Activo</MenuItem>
              <MenuItem value="no">Inactivo</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ gridColumn: 'span 6' }}>
          <TextField
            label="Color croma"
            size="small"
            fullWidth
            value={chroma.color}
            onChange={(e) => setChroma({ color: e.target.value })}
          />
        </Box>
        <Box sx={{ gridColumn: 'span 6' }}>
          <TextField
            label="Tolerancia"
            type="number"
            size="small"
            fullWidth
            value={chroma.tolerance}
            inputProps={{ min: 0, max: 100, step: 1 }}
            onChange={(e) => setChroma({ tolerance: Number(e.target.value) })}
          />
        </Box>
        {onStartChromaColorPick ? (
          <Box sx={{ gridColumn: 'span 6', display: 'flex', alignItems: 'center' }}>
            <Button
              variant={isChromaColorPicking ? 'contained' : 'outlined'}
              size="small"
              fullWidth
              onClick={onStartChromaColorPick}
              sx={{ textTransform: 'none', height: '100%', py: 1, fontSize: '0.72rem' }}
            >
              {isChromaColorPicking ? 'Capturando...' : 'Color exacto'}
            </Button>
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
};

export type NarrativePayloadRendererProps = BasePayloadProps & {
  payload: Record<string, unknown>;
  setPayloadPatch: (patch: Record<string, unknown>) => void;
  getNarrativeEditorSegments: () => NarrativeSegment[];
  setNarrativeEditorSegments: (nextSegments: NarrativeSegment[]) => void;
};

export const NarrativePayloadRenderer: React.FC<NarrativePayloadRendererProps> = ({
  str,
  num,
  payload,
  setPayload,
  setPayloadPatch,
  getNarrativeEditorSegments,
  setNarrativeEditorSegments,
}) => {
  const [narrativeTab, setNarrativeTab] = React.useState<'content' | 'style' | 'position' | 'voice'>('content');
  const [showSegmentEditor, setShowSegmentEditor] = React.useState<boolean>(false);
  const [showCustomFontInput, setShowCustomFontInput] = React.useState<boolean>(false);

  const currentSegments = getNarrativeEditorSegments();
  const availableFonts = NARRATIVE_FONT_OPTIONS;
  const selectedFont = str('fontFamily') || 'Merriweather';
  const hasCuratedFont = availableFonts.includes(selectedFont as any);
  const rawVoiceConfig = payload.voiceConfig;
  const durationAuto = payload.durationAuto === undefined ? true : Boolean(payload.durationAuto);
  const voiceConfig: VoiceConfig = rawVoiceConfig && typeof rawVoiceConfig === 'object' && !Array.isArray(rawVoiceConfig)
    ? {
        mode: (['retroBeep', 'animalese', 'tomodachi', 'qwenFormant', 'roboti', 'orchestra'].includes(String((rawVoiceConfig as Record<string, unknown>).mode))
          ? String((rawVoiceConfig as Record<string, unknown>).mode)
          : 'retroBeep') as VoiceMode,
        speed: Number.isFinite(Number((rawVoiceConfig as Record<string, unknown>).speed))
          ? Math.max(0.25, Math.min(3, Number((rawVoiceConfig as Record<string, unknown>).speed)))
          : 1,
        pitchRange: Number.isFinite(Number((rawVoiceConfig as Record<string, unknown>).pitchRange))
          ? Math.max(0, Math.min(24, Number((rawVoiceConfig as Record<string, unknown>).pitchRange)))
          : 8,
        tomodachi: (() => {
          const rawTomodachi = (rawVoiceConfig as Record<string, unknown>).tomodachi;
          if (!rawTomodachi || typeof rawTomodachi !== 'object' || Array.isArray(rawTomodachi)) {
            return {
              sampleSet: 'classic' as TomodachiSampleSet,
              consonantDensity: 1,
              humanize: 0.65,
            };
          }
          const body = rawTomodachi as Record<string, unknown>;
          return {
            sampleSet: body.sampleSet === 'bright' || body.sampleSet === 'soft' || body.sampleSet === 'classic'
              ? body.sampleSet
              : 'classic',
            consonantDensity: Number.isFinite(Number(body.consonantDensity))
              ? Math.max(0, Math.min(1, Number(body.consonantDensity)))
              : 1,
            humanize: Number.isFinite(Number(body.humanize))
              ? Math.max(0, Math.min(1, Number(body.humanize)))
              : 0.65,
          };
        })(),
        qwen: (() => {
          const rawQwen = (rawVoiceConfig as Record<string, unknown>).qwen;
          if (!rawQwen || typeof rawQwen !== 'object' || Array.isArray(rawQwen)) {
            return { ...QWEN_PERSONA_PRESETS.male };
          }
          const body = rawQwen as Record<string, unknown>;
          const persona = body.persona === 'female' || body.persona === 'child' || body.persona === 'robot' || body.persona === 'male'
            ? body.persona
            : 'male';
          return {
            persona,
            pitchMul: Number.isFinite(Number(body.pitchMul))
              ? Math.max(0.5, Math.min(2.5, Number(body.pitchMul)))
              : QWEN_PERSONA_PRESETS[persona].pitchMul,
            speedMs: Number.isFinite(Number(body.speedMs))
              ? Math.max(30, Math.min(200, Number(body.speedMs)))
              : QWEN_PERSONA_PRESETS[persona].speedMs,
            brightness: Number.isFinite(Number(body.brightness))
              ? Math.max(0.3, Math.min(3, Number(body.brightness)))
              : QWEN_PERSONA_PRESETS[persona].brightness,
            volume: Number.isFinite(Number(body.volume))
              ? Math.max(0.1, Math.min(1, Number(body.volume)))
              : QWEN_PERSONA_PRESETS[persona].volume,
            jitter: Number.isFinite(Number(body.jitter))
              ? Math.max(0, Math.min(0.3, Number(body.jitter)))
              : QWEN_PERSONA_PRESETS[persona].jitter,
            transitionMul: Number.isFinite(Number(body.transitionMul))
              ? Math.max(0, Math.min(0.8, Number(body.transitionMul)))
              : QWEN_PERSONA_PRESETS[persona].transitionMul,
            vowelGlitch: Number.isFinite(Number(body.vowelGlitch))
              ? Math.max(0, Math.min(1, Number(body.vowelGlitch)))
              : QWEN_PERSONA_PRESETS[persona].vowelGlitch,
          };
        })(),
        roboti: (() => {
          const rawRoboti = (rawVoiceConfig as Record<string, unknown>).roboti;
          if (!rawRoboti || typeof rawRoboti !== 'object' || Array.isArray(rawRoboti)) {
            return { ...ROBOTI_VOICE_PRESETS.neutral };
          }
          const body = rawRoboti as Record<string, unknown>;
          const voice = body.voice === 'male' || body.voice === 'female' || body.voice === 'neutral'
            ? body.voice
            : 'neutral';
          return {
            voice,
            pitchSemitones: Number.isFinite(Number(body.pitchSemitones))
              ? Math.max(-12, Math.min(12, Number(body.pitchSemitones)))
              : ROBOTI_VOICE_PRESETS[voice].pitchSemitones,
            vibratoPct: Number.isFinite(Number(body.vibratoPct))
              ? Math.max(0, Math.min(100, Number(body.vibratoPct)))
              : ROBOTI_VOICE_PRESETS[voice].vibratoPct,
            brightness: Number.isFinite(Number(body.brightness))
              ? Math.max(0.4, Math.min(2, Number(body.brightness)))
              : ROBOTI_VOICE_PRESETS[voice].brightness,
            noiseAmount: Number.isFinite(Number(body.noiseAmount))
              ? Math.max(0, Math.min(0.8, Number(body.noiseAmount)))
              : ROBOTI_VOICE_PRESETS[voice].noiseAmount,
            lfRd: Number.isFinite(Number(body.lfRd))
              ? Math.max(0.7, Math.min(2.7, Number(body.lfRd)))
              : ROBOTI_VOICE_PRESETS[voice].lfRd,
            aspiration: Number.isFinite(Number(body.aspiration))
              ? Math.max(0, Math.min(0.8, Number(body.aspiration)))
              : ROBOTI_VOICE_PRESETS[voice].aspiration,
            transitionMs: Number.isFinite(Number(body.transitionMs))
              ? Math.max(4, Math.min(30, Number(body.transitionMs)))
              : ROBOTI_VOICE_PRESETS[voice].transitionMs,
            spacePauseMs: Number.isFinite(Number(body.spacePauseMs))
              ? Math.max(20, Math.min(300, Number(body.spacePauseMs)))
              : ROBOTI_VOICE_PRESETS[voice].spacePauseMs,
            punctuationPauseMs: Number.isFinite(Number(body.punctuationPauseMs))
              ? Math.max(80, Math.min(700, Number(body.punctuationPauseMs)))
              : ROBOTI_VOICE_PRESETS[voice].punctuationPauseMs,
            volume: Number.isFinite(Number(body.volume))
              ? Math.max(0.1, Math.min(1, Number(body.volume)))
              : ROBOTI_VOICE_PRESETS[voice].volume,
          };
        })(),
        orchestra: (() => {
          const rawOrchestra = (rawVoiceConfig as Record<string, unknown>).orchestra;
          if (!rawOrchestra || typeof rawOrchestra !== 'object' || Array.isArray(rawOrchestra)) {
            return { ...ORCHESTRA_PRESETS.piano };
          }
          const body = rawOrchestra as Record<string, unknown>;
          const instrumentType =
            body.instrumentType === 'piano' || body.instrumentType === 'marimba' || body.instrumentType === 'guitar'
            || body.instrumentType === 'violin' || body.instrumentType === 'flute' || body.instrumentType === 'oboe'
            || body.instrumentType === 'trumpet' || body.instrumentType === 'retro'
              ? body.instrumentType
              : 'piano';
          return {
            instrumentType,
            toneHz: Number.isFinite(Number(body.toneHz))
              ? Math.max(150, Math.min(1200, Number(body.toneHz)))
              : ORCHESTRA_PRESETS[instrumentType].toneHz,
            timbreHz: Number.isFinite(Number(body.timbreHz))
              ? Math.max(500, Math.min(10000, Number(body.timbreHz)))
              : ORCHESTRA_PRESETS[instrumentType].timbreHz,
            speedMs: Number.isFinite(Number(body.speedMs))
              ? Math.max(20, Math.min(150, Number(body.speedMs)))
              : ORCHESTRA_PRESETS[instrumentType].speedMs,
            expressiveness: Number.isFinite(Number(body.expressiveness))
              ? Math.max(0, Math.min(250, Number(body.expressiveness)))
              : ORCHESTRA_PRESETS[instrumentType].expressiveness,
          };
        })(),
      }
    : {
        mode: 'retroBeep',
        speed: 1,
        pitchRange: 8,
        tomodachi: {
          sampleSet: 'classic',
          consonantDensity: 1,
          humanize: 0.65,
        },
        qwen: {
          ...QWEN_PERSONA_PRESETS.male,
        },
        roboti: {
          ...ROBOTI_VOICE_PRESETS.neutral,
        },
        orchestra: {
          ...ORCHESTRA_PRESETS.piano,
        },
      };

  const setVoiceConfig = (patch: Partial<VoiceConfig>) => {
    const nextVoiceConfig = {
      ...voiceConfig,
      ...patch,
    };
    const payloadPatch: Record<string, unknown> = { voiceConfig: nextVoiceConfig };
    if (durationAuto) {
      const nextDurationMs = resolveNarrativeDurationMs(String(payload.text ?? ''), nextVoiceConfig, payload.durationMs);
      if (nextDurationMs !== undefined) {
        payloadPatch.durationMs = nextDurationMs;
      }
    }
    setPayloadPatch(payloadPatch);
  };
  const setNarrativeText = (nextText: string) => {
    const payloadPatch: Record<string, unknown> = { text: nextText };
    if (durationAuto) {
      const nextDurationMs = resolveNarrativeDurationMs(nextText, voiceConfig, payload.durationMs);
      if (nextDurationMs !== undefined) {
        payloadPatch.durationMs = nextDurationMs;
      }
    }
    setPayloadPatch(payloadPatch);
  };
  const setNarrativeDurationMode = (enabled: boolean) => {
    const payloadPatch: Record<string, unknown> = { durationAuto: enabled };
    if (enabled) {
      const nextDurationMs = resolveNarrativeDurationMs(String(payload.text ?? ''), voiceConfig, payload.durationMs);
      if (nextDurationMs !== undefined) {
        payloadPatch.durationMs = nextDurationMs;
      }
    }
    setPayloadPatch(payloadPatch);
  };
  const applyNarrativeDurationEstimate = () => {
    const nextDurationMs = resolveNarrativeDurationMs(String(payload.text ?? ''), voiceConfig, payload.durationMs);
    if (nextDurationMs !== undefined) {
      setPayload('durationMs', nextDurationMs);
    }
  };
  const voiceTargetRaw = String(payload.voiceTarget ?? '').trim();
  const voiceTarget: VoiceTarget = voiceTargetRaw === 'main' || voiceTargetRaw === 'projection' || voiceTargetRaw === 'both' || voiceTargetRaw === 'none'
    ? voiceTargetRaw
    : 'both';
  const pitchLabel = voiceConfig.mode === 'tomodachi' ? 'Tono base' : 'Rango de pitch';

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
          Estilos rapidos:
        </Typography>
        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
          {NARRATIVE_STYLE_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.label}
              size="small"
              clickable
              variant="outlined"
              onClick={() => setPayloadPatch(preset.patch)}
              sx={{ fontSize: '0.72rem' }}
            />
          ))}
        </Stack>
      </Box>

      <Tabs
        value={narrativeTab}
        onChange={(_, value) => setNarrativeTab(value)}
        variant="fullWidth"
        sx={{
          minHeight: 32,
          height: 32,
          '& .MuiTab-root': {
            py: 0.5,
            minHeight: 32,
            fontSize: '0.75rem',
            textTransform: 'none',
          },
        }}
      >
        <Tab value="content" label="Contenido" />
        <Tab value="style" label="Diseno" />
        <Tab value="position" label="Posicion" />
        <Tab value="voice" label="Voz" />
      </Tabs>

      {narrativeTab === 'content' && (
        <Stack spacing={1.5}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1.5 }}>
            <Box sx={{ gridColumn: 'span 7' }}>
              <TextField
                label="Titulo (opcional)"
                size="small"
                value={str('title')}
                onChange={(e) => setPayload('title', e.target.value)}
                fullWidth
              />
            </Box>
            <Box sx={{ gridColumn: 'span 5' }}>
              <Stack spacing={0.6}>
                <TextField
                  label="Duracion (ms)"
                  placeholder={durationAuto ? 'Auto' : 'Manual'}
                  type="number"
                  size="small"
                  value={num('durationMs', 0)}
                  inputProps={{ min: 0 }}
                  onChange={(e) => {
                    setPayloadPatch({
                      durationMs: Number(e.target.value),
                      durationAuto: false,
                    });
                  }}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <FormControlLabel
                  control={(
                    <Switch
                      checked={durationAuto}
                      onChange={(_, checked) => setNarrativeDurationMode(checked)}
                      size="small"
                    />
                  )}
                  label={durationAuto ? 'Ajuste automatico' : 'Duracion manual'}
                  sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.7rem' } }}
                />
                {!durationAuto ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={applyNarrativeDurationEstimate}
                    sx={{ textTransform: 'none', py: 0.35, fontSize: '0.68rem', alignSelf: 'flex-start' }}
                  >
                    Ajustar ahora
                  </Button>
                ) : null}
              </Stack>
            </Box>
          </Box>

          {!showSegmentEditor ? (
            <Stack spacing={1}>
              <TextField
                label="Texto principal"
                multiline
                rows={3}
                size="small"
                value={str('text')}
                onChange={(e) => setNarrativeText(e.target.value)}
                fullWidth
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowSegmentEditor(true)}
                sx={{ textTransform: 'none', py: 0.5, fontSize: '0.72rem' }}
              >
                Convertir a editor enriquecido (colores/estilos)
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Editor de segmentos (enriquecido)
                </Typography>
                <Button
                  size="small"
                  color="warning"
                  onClick={() => {
                    if (confirm('¿Volver a texto plano? Perderas los formatos individuales de color/tamano de cada palabra.')) {
                      const combined = currentSegments.map((s) => s.text).join(' ');
                      setNarrativeText(combined);
                      setPayload('richTextDoc', undefined);
                      setShowSegmentEditor(false);
                    }
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.68rem', py: 0 }}
                >
                  Texto plano
                </Button>
              </Stack>

              <Alert severity="info" sx={{ p: 0.5, '& .MuiAlert-message': { fontSize: '0.7rem' } }}>
                Consejo: Es mas comodo hacer doble clic sobre el texto en el previsualizador para editarlo de forma visual en pantalla completa.
              </Alert>

              <Stack spacing={1} sx={{ maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
                {currentSegments.map((segment, segIndex) => (
                  <Paper key={`seg-row-${segIndex}`} variant="outlined" sx={{ p: 1, position: 'relative' }}>
                    <Stack spacing={1}>
                      <TextField
                        label={`Segmento #${segIndex + 1}`}
                        size="small"
                        multiline
                        rows={1}
                        value={segment.text}
                        onChange={(e) => {
                          const next = [...currentSegments];
                          next[segIndex] = { ...next[segIndex], text: e.target.value };
                          setNarrativeEditorSegments(next);
                        }}
                        fullWidth
                      />

                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
                        <Box sx={{ gridColumn: 'span 4' }}>
                          <FormControlLabel
                            control={(
                              <Switch
                                checked={Boolean(segment.bold)}
                                onChange={(e) => {
                                  const next = [...currentSegments];
                                  next[segIndex] = { ...next[segIndex], bold: e.target.checked };
                                  setNarrativeEditorSegments(next);
                                }}
                                size="small"
                              />
                            )}
                            label="Negrita"
                            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.7rem' } }}
                          />
                        </Box>
                        <Box sx={{ gridColumn: 'span 4' }}>
                          <FormControlLabel
                            control={(
                              <Switch
                                checked={Boolean(segment.italic)}
                                onChange={(e) => {
                                  const next = [...currentSegments];
                                  next[segIndex] = { ...next[segIndex], italic: e.target.checked };
                                  setNarrativeEditorSegments(next);
                                }}
                                size="small"
                              />
                            )}
                            label="Cursiva"
                            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.7rem' } }}
                          />
                        </Box>
                        <Box sx={{ gridColumn: 'span 4' }}>
                          <FormControlLabel
                            control={(
                              <Switch
                                checked={Boolean(segment.underline)}
                                onChange={(e) => {
                                  const next = [...currentSegments];
                                  next[segIndex] = { ...next[segIndex], underline: e.target.checked };
                                  setNarrativeEditorSegments(next);
                                }}
                                size="small"
                              />
                            )}
                            label="Subrayado"
                            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.7rem' } }}
                          />
                        </Box>

                        <Box sx={{ gridColumn: 'span 6' }}>
                          <TextField
                            label="Tamano (px)"
                            type="number"
                            size="small"
                            fullWidth
                            value={segment.fontSizePx ?? ''}
                            placeholder="Predeterminado"
                            onChange={(e) => {
                              const next = [...currentSegments];
                              const val = e.target.value.trim() ? Number(e.target.value) : undefined;
                              next[segIndex] = { ...next[segIndex], fontSizePx: val };
                              setNarrativeEditorSegments(next);
                            }}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Box>
                        <Box sx={{ gridColumn: 'span 6' }}>
                          <TextField
                            label="Color"
                            size="small"
                            fullWidth
                            value={segment.color ?? ''}
                            placeholder="Predeterminado"
                            onChange={(e) => {
                              const next = [...currentSegments];
                              next[segIndex] = { ...next[segIndex], color: e.target.value.trim() || undefined };
                              setNarrativeEditorSegments(next);
                            }}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Box>
                      </Box>
                    </Stack>

                    {currentSegments.length > 1 ? (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          const next = currentSegments.filter((_, idx) => idx !== segIndex);
                          setNarrativeEditorSegments(next);
                        }}
                        sx={{ position: 'absolute', top: 4, right: 4 }}
                      >
                        <DeleteIcon fontSize="inherit" />
                      </IconButton>
                    ) : null}
                  </Paper>
                ))}
              </Stack>

              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  const next = [...currentSegments, { text: 'Nuevo texto' }];
                  setNarrativeEditorSegments(next);
                }}
                sx={{ textTransform: 'none', py: 0.5, fontSize: '0.72rem' }}
              >
                Anadir nuevo fragmento
              </Button>
            </Stack>
          )}
        </Stack>
      )}

      {narrativeTab === 'style' && (
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tipografia y Formato
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
              <Box sx={{ gridColumn: 'span 7' }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Fuente</InputLabel>
                  <Select
                    label="Fuente"
                    value={hasCuratedFont ? selectedFont : ''}
                    onChange={(e) => {
                      setPayload('fontFamily', e.target.value);
                      setShowCustomFontInput(false);
                    }}
                  >
                    {NARRATIVE_FONT_OPTIONS.map((font) => (
                      <MenuItem key={font} value={font}>{font}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ gridColumn: 'span 5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={showCustomFontInput || !hasCuratedFont}
                      onChange={(_, checked) => setShowCustomFontInput(checked)}
                      size="small"
                    />
                  )}
                  label="Manual"
                  sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.72rem' } }}
                />
              </Box>

              {showCustomFontInput || !hasCuratedFont ? (
                <Box sx={{ gridColumn: 'span 12' }}>
                  <TextField
                    label="Nombre de fuente personalizada"
                    size="small"
                    fullWidth
                    value={str('fontFamily')}
                    onChange={(e) => setPayload('fontFamily', e.target.value)}
                  />
                </Box>
              ) : null}

              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Tamano (px)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('fontSizePx', 28)}
                  inputProps={{ min: 8, max: 220, step: 1 }}
                  onChange={(e) => setPayload('fontSizePx', Number(e.target.value))}
                />
              </Box>

              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Color"
                  size="small"
                  fullWidth
                  value={str('fontColor') || '#ffffff'}
                  onChange={(e) => setPayload('fontColor', e.target.value)}
                />
              </Box>

              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Interlineado"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('lineHeight', 1.35)}
                  inputProps={{ min: 0.5, max: 3, step: 0.05 }}
                  onChange={(e) => setPayload('lineHeight', Number(e.target.value))}
                />
              </Box>

              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Espacio (px)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('letterSpacingPx', 0)}
                  inputProps={{ min: -8, max: 20, step: 0.5 }}
                  onChange={(e) => setPayload('letterSpacingPx', Number(e.target.value))}
                />
              </Box>

              <Box sx={{ gridColumn: 'span 6' }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Alineacion</InputLabel>
                  <Select
                    label="Alineacion"
                    value={str('textAlign') || 'left'}
                    onChange={(e) => setPayload('textAlign', e.target.value)}
                  >
                    <MenuItem value="left">Izquierda</MenuItem>
                    <MenuItem value="center">Centro</MenuItem>
                    <MenuItem value="right">Derecha</MenuItem>
                    <MenuItem value="justify">Justificado</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ gridColumn: 'span 6', display: 'flex', gap: 1 }}>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={str('fontWeight') === 'bold'}
                      onChange={(e) => setPayload('fontWeight', e.target.checked ? 'bold' : 'normal')}
                      size="small"
                    />
                  )}
                  label="B"
                  sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.72rem', fontWeight: 'bold' } }}
                />
                <FormControlLabel
                  control={(
                    <Switch
                      checked={str('fontStyle') === 'italic'}
                      onChange={(e) => setPayload('fontStyle', e.target.checked ? 'italic' : 'normal')}
                      size="small"
                    />
                  )}
                  label="I"
                  sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.72rem', fontStyle: 'italic' } }}
                />
                <FormControlLabel
                  control={(
                    <Switch
                      checked={str('textDecoration') === 'underline'}
                      onChange={(e) => setPayload('textDecoration', e.target.checked ? 'underline' : 'none')}
                      size="small"
                    />
                  )}
                  label="U"
                  sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.72rem', textDecoration: 'underline' } }}
                />
              </Box>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Caja y Fondo
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
              <Box sx={{ gridColumn: 'span 6' }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Modo fondo</InputLabel>
                  <Select
                    label="Modo fondo"
                    value={str('backgroundMode') || 'rect'}
                    onChange={(e) => setPayload('backgroundMode', e.target.value)}
                  >
                    <MenuItem value="none">Sin fondo</MenuItem>
                    <MenuItem value="rect">Rectangulo</MenuItem>
                    <MenuItem value="capsule">Capsula</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Color fondo"
                  size="small"
                  fullWidth
                  value={str('backgroundColor') || '#000000'}
                  disabled={str('backgroundMode') === 'none'}
                  onChange={(e) => setPayload('backgroundColor', e.target.value)}
                />
              </Box>

              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Opacidad"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('backgroundOpacity', 0.58)}
                  disabled={str('backgroundMode') === 'none'}
                  inputProps={{ min: 0, max: 1, step: 0.05 }}
                  onChange={(e) => setPayload('backgroundOpacity', Number(e.target.value))}
                />
              </Box>

              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Redondeado (px)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('borderRadiusPx', 12)}
                  disabled={str('backgroundMode') !== 'rect'}
                  inputProps={{ min: 0, max: 128 }}
                  onChange={(e) => setPayload('borderRadiusPx', Number(e.target.value))}
                />
              </Box>

              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Padding (px)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('paddingPx', 16)}
                  inputProps={{ min: 0, max: 64 }}
                  onChange={(e) => setPayload('paddingPx', Number(e.target.value))}
                />
              </Box>
            </Box>
          </Box>
        </Stack>
      )}

      {narrativeTab === 'position' && (
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Posicionamiento en Pantalla
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Izquierda (X %)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('leftPct', 10)}
                  inputProps={{ min: -50, max: 150, step: 1 }}
                  onChange={(e) => setPayload('leftPct', Number(e.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Superior (Y %)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('topPct', 10)}
                  inputProps={{ min: -50, max: 150, step: 1 }}
                  onChange={(e) => setPayload('topPct', Number(e.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Ancho (%)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('widthPct', 80)}
                  inputProps={{ min: 1, max: 200, step: 1 }}
                  onChange={(e) => setPayload('widthPct', Number(e.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Alto (%)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('heightPct', 22)}
                  inputProps={{ min: 1, max: 200, step: 1 }}
                  onChange={(e) => setPayload('heightPct', Number(e.target.value))}
                />
              </Box>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Propiedades de Capa
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Opacidad (0-1)"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('opacity', 1)}
                  inputProps={{ min: 0, max: 1, step: 0.05 }}
                  onChange={(e) => setPayload('opacity', Number(e.target.value))}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Orden de Capa"
                  type="number"
                  size="small"
                  fullWidth
                  value={num('layerOrder', 100)}
                  onChange={(e) => setPayload('layerOrder', Number(e.target.value))}
                />
              </Box>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2.5, fontStyle: 'italic', bgcolor: 'rgba(0, 0, 0, 0.015)', p: 1, borderRadius: 1 }}>
              Consejo: Tambien puedes ordenar las capas arrastrando los bloques verticalmente en la pista del timeline.
            </Typography>
          </Box>
        </Stack>
      )}

      {narrativeTab === 'voice' && (
        <Stack spacing={1.25}>
          <Typography variant="caption" color="text.secondary">
            Configura como se interpreta la narracion al reproducirla.
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Salida de voz</InputLabel>
            <Select
              label="Salida de voz"
              value={voiceTarget}
              onChange={(event) => setPayload('voiceTarget', event.target.value as VoiceTarget)}
            >
              <MenuItem value="main">Principal</MenuItem>
              <MenuItem value="projection">Proyeccion</MenuItem>
              <MenuItem value="both">Ambas</MenuItem>
              <MenuItem value="none">Sin narrador</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Modo de voz</InputLabel>
            <Select
              label="Modo de voz"
              value={voiceConfig.mode}
              onChange={(event) => setVoiceConfig({ mode: event.target.value as VoiceMode })}
            >
              <MenuItem value="retroBeep">Retro Beeps</MenuItem>
              <MenuItem value="animalese">Animalese</MenuItem>
              <MenuItem value="tomodachi">Bibepo</MenuItem>
              <MenuItem value="qwenFormant">Queque</MenuItem>
              <MenuItem value="orchestra">Orchestra</MenuItem>
              <MenuItem value="roboti">Roboti</MenuItem>
            </Select>
          </FormControl>
          {voiceConfig.mode !== 'qwenFormant' && voiceConfig.mode !== 'roboti' && voiceConfig.mode !== 'orchestra' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label="Velocidad"
                  type="number"
                  size="small"
                  fullWidth
                  value={voiceConfig.speed}
                  inputProps={{ min: 0.25, max: 3, step: 0.05 }}
                  onChange={(event) => setVoiceConfig({ speed: Number(event.target.value) })}
                />
              </Box>
              <Box sx={{ gridColumn: 'span 6' }}>
                <TextField
                  label={pitchLabel}
                  type="number"
                  size="small"
                  fullWidth
                  value={voiceConfig.pitchRange}
                  inputProps={{ min: 0, max: 24, step: 1 }}
                  onChange={(event) => setVoiceConfig({ pitchRange: Number(event.target.value) })}
                />
              </Box>
            </Box>
          )}
          {voiceConfig.mode === 'orchestra' && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Instrumento base</InputLabel>
                <Select
                  label="Instrumento base"
                  value={voiceConfig.orchestra.instrumentType}
                  onChange={(event) => {
                    const instrument = event.target.value as OrchestraInstrument;
                    setVoiceConfig({ orchestra: { ...ORCHESTRA_PRESETS[instrument] } });
                  }}
                >
                  <MenuItem value="piano">Piano</MenuItem>
                  <MenuItem value="marimba">Marimba</MenuItem>
                  <MenuItem value="guitar">Guitarra</MenuItem>
                  <MenuItem value="violin">Violin</MenuItem>
                  <MenuItem value="flute">Flauta</MenuItem>
                  <MenuItem value="oboe">Oboe</MenuItem>
                  <MenuItem value="trumpet">Trompeta</MenuItem>
                  <MenuItem value="retro">8-Bit Retro</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
                <Box sx={{ gridColumn: 'span 12' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Tono General
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Slider
                      size="small"
                      min={150}
                      max={1200}
                      step={1}
                      value={voiceConfig.orchestra.toneHz}
                      onChange={(_, value) => setVoiceConfig({ orchestra: { ...voiceConfig.orchestra, toneHz: Array.isArray(value) ? value[0] : value } })}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${Math.round(value)} Hz`}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Hz"
                      type="number"
                      size="small"
                      value={voiceConfig.orchestra.toneHz}
                      inputProps={{ min: 150, max: 1200, step: 1 }}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setVoiceConfig({ orchestra: { ...voiceConfig.orchestra, toneHz: Math.max(150, Math.min(1200, next)) } });
                      }}
                      sx={{ width: 110 }}
                    />
                  </Stack>
                </Box>
                <Box sx={{ gridColumn: 'span 12' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Timbre (Filtro Acustico)
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Slider
                      size="small"
                      min={500}
                      max={10000}
                      step={10}
                      value={voiceConfig.orchestra.timbreHz}
                      onChange={(_, value) => setVoiceConfig({ orchestra: { ...voiceConfig.orchestra, timbreHz: Array.isArray(value) ? value[0] : value } })}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${Math.round(value)} Hz`}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Hz"
                      type="number"
                      size="small"
                      value={voiceConfig.orchestra.timbreHz}
                      inputProps={{ min: 500, max: 10000, step: 10 }}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setVoiceConfig({ orchestra: { ...voiceConfig.orchestra, timbreHz: Math.max(500, Math.min(10000, next)) } });
                      }}
                      sx={{ width: 110 }}
                    />
                  </Stack>
                </Box>
                <Box sx={{ gridColumn: 'span 12' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Velocidad del Habla
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Slider
                      size="small"
                      min={20}
                      max={150}
                      step={1}
                      value={voiceConfig.orchestra.speedMs}
                      onChange={(_, value) => setVoiceConfig({ orchestra: { ...voiceConfig.orchestra, speedMs: Array.isArray(value) ? value[0] : value } })}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${Math.round(value)} ms`}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="ms"
                      type="number"
                      size="small"
                      value={voiceConfig.orchestra.speedMs}
                      inputProps={{ min: 20, max: 150, step: 1 }}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setVoiceConfig({ orchestra: { ...voiceConfig.orchestra, speedMs: Math.max(20, Math.min(150, next)) } });
                      }}
                      sx={{ width: 110 }}
                    />
                  </Stack>
                </Box>
                <Box sx={{ gridColumn: 'span 12' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Expresividad (Saltos de notas)
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Slider
                      size="small"
                      min={0}
                      max={250}
                      step={1}
                      value={voiceConfig.orchestra.expressiveness}
                      onChange={(_, value) => setVoiceConfig({ orchestra: { ...voiceConfig.orchestra, expressiveness: Array.isArray(value) ? value[0] : value } })}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${Math.round(value)}`}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Nivel"
                      type="number"
                      size="small"
                      value={voiceConfig.orchestra.expressiveness}
                      inputProps={{ min: 0, max: 250, step: 1 }}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setVoiceConfig({ orchestra: { ...voiceConfig.orchestra, expressiveness: Math.max(0, Math.min(250, next)) } });
                      }}
                      sx={{ width: 110 }}
                    />
                  </Stack>
                </Box>
              </Box>
            </>
          )}
          {voiceConfig.mode === 'tomodachi' && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Preset de claridad</InputLabel>
                <Select
                  label="Preset de claridad"
                  value={voiceConfig.tomodachi.sampleSet}
                  onChange={(event) => {
                    setVoiceConfig({
                      tomodachi: {
                        ...voiceConfig.tomodachi,
                        sampleSet: event.target.value as TomodachiSampleSet,
                      },
                    });
                  }}
                >
                  <MenuItem value="soft">Suave</MenuItem>
                  <MenuItem value="classic">Claro</MenuItem>
                  <MenuItem value="bright">Muy claro</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Densidad consonante"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.tomodachi.consonantDensity}
                    inputProps={{ min: 0, max: 1, step: 0.05 }}
                    onChange={(event) => {
                      setVoiceConfig({
                        tomodachi: {
                          ...voiceConfig.tomodachi,
                          consonantDensity: Number(event.target.value),
                        },
                      });
                    }}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Humanizacion"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.tomodachi.humanize}
                    inputProps={{ min: 0, max: 1, step: 0.05 }}
                    onChange={(event) => {
                      setVoiceConfig({
                        tomodachi: {
                          ...voiceConfig.tomodachi,
                          humanize: Number(event.target.value),
                        },
                      });
                    }}
                  />
                </Box>
              </Box>
            </>
          )}
          {voiceConfig.mode === 'qwenFormant' && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Perfil de voz</InputLabel>
                <Select
                  label="Perfil de voz"
                  value={voiceConfig.qwen.persona}
                  onChange={(event) => {
                    const persona = event.target.value as QwenPersona;
                    setVoiceConfig({
                      qwen: {
                        ...QWEN_PERSONA_PRESETS[persona],
                      },
                    });
                  }}
                >
                  <MenuItem value="male">Masculina</MenuItem>
                  <MenuItem value="female">Femenina</MenuItem>
                  <MenuItem value="child">Infantil</MenuItem>
                  <MenuItem value="robot">Robotica</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Tono base"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.qwen.pitchMul}
                    inputProps={{ min: 0.5, max: 2.5, step: 0.05 }}
                    onChange={(event) => setVoiceConfig({ qwen: { ...voiceConfig.qwen, pitchMul: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Velocidad (ms)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.qwen.speedMs}
                    inputProps={{ min: 30, max: 200, step: 1 }}
                    onChange={(event) => setVoiceConfig({ qwen: { ...voiceConfig.qwen, speedMs: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Brillo"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.qwen.brightness}
                    inputProps={{ min: 0.3, max: 3, step: 0.1 }}
                    onChange={(event) => setVoiceConfig({ qwen: { ...voiceConfig.qwen, brightness: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Volumen"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.qwen.volume}
                    inputProps={{ min: 0.1, max: 1, step: 0.05 }}
                    onChange={(event) => setVoiceConfig({ qwen: { ...voiceConfig.qwen, volume: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Jitter (variacion)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.qwen.jitter}
                    inputProps={{ min: 0, max: 0.3, step: 0.01 }}
                    onChange={(event) => setVoiceConfig({ qwen: { ...voiceConfig.qwen, jitter: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Transicion (coarticulacion)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.qwen.transitionMul}
                    inputProps={{ min: 0, max: 0.8, step: 0.05 }}
                    onChange={(event) => setVoiceConfig({ qwen: { ...voiceConfig.qwen, transitionMul: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Glitch de transicion (vocales/consonantes)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.qwen.vowelGlitch}
                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                    onChange={(event) => setVoiceConfig({ qwen: { ...voiceConfig.qwen, vowelGlitch: Number(event.target.value) } })}
                  />
                </Box>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const preset = QWEN_PERSONA_PRESETS[voiceConfig.qwen.persona];
                  setVoiceConfig({ qwen: { ...preset } });
                }}
                sx={{ textTransform: 'none' }}
              >
                Restaurar valores del perfil
              </Button>
            </>
          )}
          {voiceConfig.mode === 'roboti' && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Perfil Roboti</InputLabel>
                <Select
                  label="Perfil Roboti"
                  value={voiceConfig.roboti.voice}
                  onChange={(event) => {
                    const voice = event.target.value as RobotiVoice;
                    setVoiceConfig({ roboti: { ...ROBOTI_VOICE_PRESETS[voice] } });
                  }}
                >
                  <MenuItem value="male">Masculina</MenuItem>
                  <MenuItem value="female">Femenina</MenuItem>
                  <MenuItem value="neutral">Neutra</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
                <Box sx={{ gridColumn: 'span 12' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Velocidad de lectura
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Slider
                      size="small"
                      min={0.2}
                      max={2}
                      step={0.05}
                      value={voiceConfig.speed}
                      onChange={(_, value) => setVoiceConfig({ speed: Array.isArray(value) ? value[0] : value })}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${value.toFixed(2)}x`}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="x"
                      type="number"
                      size="small"
                      value={voiceConfig.speed}
                      inputProps={{ min: 0.2, max: 2, step: 0.05 }}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setVoiceConfig({ speed: Math.max(0.2, Math.min(2, next)) });
                      }}
                      sx={{ width: 110 }}
                    />
                  </Stack>
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Tono base (semitonos)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.pitchSemitones}
                    inputProps={{ min: -12, max: 12, step: 1 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, pitchSemitones: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Vibrato (%)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.vibratoPct}
                    inputProps={{ min: 0, max: 100, step: 1 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, vibratoPct: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Brillo"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.brightness}
                    inputProps={{ min: 0.4, max: 2, step: 0.05 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, brightness: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Ruido"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.noiseAmount}
                    inputProps={{ min: 0, max: 0.8, step: 0.01 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, noiseAmount: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="LF Rd"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.lfRd}
                    inputProps={{ min: 0.7, max: 2.7, step: 0.05 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, lfRd: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Aspiracion"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.aspiration}
                    inputProps={{ min: 0, max: 0.8, step: 0.01 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, aspiration: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Transicion (ms)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.transitionMs}
                    inputProps={{ min: 4, max: 30, step: 1 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, transitionMs: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Volumen"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.volume}
                    inputProps={{ min: 0.1, max: 1, step: 0.05 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, volume: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Pausa por espacio (ms)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.spacePauseMs}
                    inputProps={{ min: 20, max: 300, step: 5 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, spacePauseMs: Number(event.target.value) } })}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Pausa por puntuacion (ms)"
                    type="number"
                    size="small"
                    fullWidth
                    value={voiceConfig.roboti.punctuationPauseMs}
                    inputProps={{ min: 80, max: 700, step: 10 }}
                    onChange={(event) => setVoiceConfig({ roboti: { ...voiceConfig.roboti, punctuationPauseMs: Number(event.target.value) } })}
                  />
                </Box>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const preset = ROBOTI_VOICE_PRESETS[voiceConfig.roboti.voice];
                  setVoiceConfig({ roboti: { ...preset } });
                }}
                sx={{ textTransform: 'none' }}
              >
                Restaurar valores del perfil
              </Button>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
};
