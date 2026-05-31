import React from 'react';
import {
  Paper,
  Stack,
  Box,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type SceneActionType,
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  DEST_WINDOW_LABELS,
} from './constants/actionTypes';
import { toNonNegativeMs, toNonNegativeSec } from './utils/sceneEditorUtils';
import { estimateNarrationDurationMs } from './utils/narratorPlayback';
import type { SceneVideoAsset } from '../../types/scenes';
import {
  type NarrativeSegment,
  NarrativePayloadRenderer,
  SendImagePayloadRenderer,
  SendVideoPayloadRenderer,
} from './renderers';
import { TransformAnimationSection } from './panels/TransformAnimationSection';

interface SceneAction {
  id: string;
  type: string;
  delay?: number;
  targetWindow?: {
    kind: 'main' | 'projection' | 'skyline' | 'custom' | 'instance';
    instanceId?: string;
    customWindowId?: string;
  };
  payload?: Record<string, any>;
}

interface SceneActionEditorProps {
  action: SceneAction;
  index: number;
  highlighted?: boolean;
  onChange: (updatedAction: any) => void;
  onRemove: () => void;
  sceneVideoAssets?: SceneVideoAsset[];
  onRequestUploadVideo?: () => void;
  onStartChromaColorPick?: () => void;
  isChromaColorPicking?: boolean;
}

const SceneActionEditor: React.FC<SceneActionEditorProps> = ({
  action,
  index,
  highlighted,
  onChange,
  onRemove,
  sceneVideoAssets,
  onRequestUploadVideo,
  onStartChromaColorPick,
  isChromaColorPicking,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: action.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const setPayload = (key: string, value: unknown) => {
    onChange({
      ...action,
      payload: {
        ...(action.payload ?? {}),
        [key]: value,
      },
    });
  };

  const setPayloadPatch = (patch: Record<string, unknown>) => {
    onChange({
      ...action,
      payload: {
        ...(action.payload ?? {}),
        ...patch,
      },
    });
  };

  const setType = (type: string) => {
    // Si establecemos texto narrativo, inicializamos por defecto en skyline si no tiene ventana destino
    const extraDefaults = type === 'setNarrativeText' ? {
      targetWindow: { kind: 'skyline' as const },
      payload: {
        ...(action.payload ?? {}),
        displayName: action.payload?.displayName ?? 'Texto Narrativo',
        durationMs: estimateNarrationDurationMs(
          String(action.payload?.text ?? ''),
          action.payload?.voiceConfig as Record<string, unknown> | undefined,
        ),
        voiceConfig: action.payload?.voiceConfig ?? {
          mode: 'retroBeep',
          speed: 1,
          pitchRange: 8,
          tomodachi: {
            sampleSet: 'classic',
            consonantDensity: 1,
            humanize: 0.65,
          },
          qwen: {
            persona: 'male',
            pitchMul: 1,
            speedMs: 70,
            brightness: 1,
            volume: 0.7,
            jitter: 0.08,
            transitionMul: 0.3,
            vowelGlitch: 0.28,
          },
          roboti: {
            voice: 'neutral',
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
        },
      },
    } : type === 'applyWindowFilter' ? {
      payload: {
        ...(action.payload ?? {}),
        filter: action.payload?.filter ?? 'blur',
        intensity: typeof action.payload?.intensity === 'number' ? action.payload.intensity : 0.5,
        color: typeof action.payload?.color === 'string' ? action.payload.color : '',
        durationMs: typeof action.payload?.durationMs === 'number' ? action.payload.durationMs : 2500,
      },
    } : {};

    onChange({
      ...action,
      type,
      ...extraDefaults,
    });
  };

  const setDelay = (delay: number) => {
    onChange({
      ...action,
      delay,
    });
  };

  const setTargetWindowKind = (kind: 'main' | 'projection' | 'skyline' | 'custom' | 'instance') => {
    onChange({
      ...action,
      targetWindow: {
        ...(action.targetWindow ?? {}),
        kind,
      },
    });
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{
        p: 1.5,
        width: 'auto', // Ajustado a auto para que encaje perfectamente dentro de la zona visible y no se desborde bajo el scrollbar
        minWidth: 0,
        overflowX: 'hidden',
        borderColor: highlighted ? 'primary.main' : 'divider',
        boxShadow: highlighted ? 2 : undefined,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          {/* Grab handle */}
          <IconButton
            size="small"
            sx={{ cursor: 'grab', p: 0.25, mt: 0.5 }}
            {...attributes}
            {...listeners}
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Header: index, type, delay */}
            <Stack direction="row" spacing={1} alignItems="center" mb={1.25} sx={{ flexWrap: 'wrap', minWidth: 0, rowGap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20 }}>
                #{index}
              </Typography>

              {/* Action type */}
              <FormControl size="small" sx={{ flex: '1 1 150px', minWidth: 0 }}>
                <InputLabel>Tipo de acción</InputLabel>
                <Select
                  value={action.type}
                  label="Tipo de acción"
                  onChange={(e) => setType(e.target.value)}
                >
                  {ACTION_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {ACTION_TYPE_LABELS[t] ?? t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Delay */}
              <TextField
                label="Retraso (ms)"
                type="number"
                size="small"
                sx={{ flex: '1 1 100px', minWidth: 0 }}
                value={action.delay ?? 0}
                inputProps={{ min: 0, max: 600000, step: 100 }}
                onChange={(e) => setDelay(Number(e.target.value))}
              />
            </Stack>

            {/* Timeline label */}
            <TextField
              label="Nombre en timeline (opcional)"
              size="small"
              value={String(action.payload?.displayName ?? '')}
              onChange={(e) => setPayload('displayName', e.target.value)}
              sx={{ mb: 1.25, width: '100%', minWidth: 0, maxWidth: '100%' }}
            />

            {/* Window destination */}
            {['sendVideoToWindow', 'sendImageToWindow', 'setWindowBackground', 'applyWindowFilter', 'clearWindow', 'setNarrativeText'].includes(action.type) ? (
              <FormControl size="small" fullWidth sx={{ mb: 1.25 }}>
                <InputLabel>Ventana destino</InputLabel>
                <Select
                  value={action.targetWindow?.kind ?? 'main'}
                  label="Ventana destino"
                  onChange={(e) => setTargetWindowKind(e.target.value as any)}
                >
                  <MenuItem value="main">{DEST_WINDOW_LABELS.main}</MenuItem>
                  <MenuItem value="projection">{DEST_WINDOW_LABELS.projection}</MenuItem>
                  <MenuItem value="skyline">{DEST_WINDOW_LABELS.skyline}</MenuItem>
                </Select>
              </FormControl>
            ) : null}

            {/* Render subfields based on action type */}
            <PayloadFields
              type={action.type}
              payload={action.payload ?? {}}
              setPayload={setPayload}
              setPayloadPatch={setPayloadPatch}
              sceneVideoAssets={sceneVideoAssets}
              onRequestUploadVideo={onRequestUploadVideo}
              onStartChromaColorPick={onStartChromaColorPick}
              isChromaColorPicking={isChromaColorPicking}
            />
          </Box>

          {/* Delete action */}
          <IconButton size="small" color="error" onClick={onRemove}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// Sub-renderer for specific payload fields
// ---------------------------------------------------------------------------

interface PayloadFieldsProps {
  type: string;
  payload: Record<string, unknown>;
  setPayload: (key: string, value: unknown) => void;
  setPayloadPatch: (patch: Record<string, unknown>) => void;
  sceneVideoAssets?: SceneVideoAsset[];
  onRequestUploadVideo?: () => void;
  onStartChromaColorPick?: () => void;
  isChromaColorPicking?: boolean;
}

const PayloadFields: React.FC<PayloadFieldsProps> = ({
  type,
  payload,
  setPayload,
  setPayloadPatch,
  sceneVideoAssets,
  onRequestUploadVideo,
  onStartChromaColorPick,
  isChromaColorPicking,
}) => {
  type NarrativeSegment = {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSizePx?: number;
    color?: string;
    fontFamily?: string;
  };

  const str = (key: string) => String(payload[key] ?? '');
  const num = (key: string, fallback = 0) => {
    const direct = payload[key];
    if (direct !== undefined && direct !== null && Number.isFinite(Number(direct))) {
      return Number(direct);
    }
    if (key === 'leftPct') {
      const legacy = payload.left ?? payload.xPct ?? payload.x;
      if (legacy !== undefined && legacy !== null && Number.isFinite(Number(legacy))) {
        const n = Number(legacy);
        return n >= 0 && n <= 1 ? n * 100 : n;
      }
    }
    if (key === 'topPct') {
      const legacy = payload.top ?? payload.yPct ?? payload.y;
      if (legacy !== undefined && legacy !== null && Number.isFinite(Number(legacy))) {
        const n = Number(legacy);
        return n >= 0 && n <= 1 ? n * 100 : n;
      }
    }
    if (key === 'widthPct') {
      const legacy = payload.width;
      if (legacy !== undefined && legacy !== null && Number.isFinite(Number(legacy))) {
        const n = Number(legacy);
        return n > 0 && n <= 1 ? n * 100 : n;
      }
    }
    if (key === 'heightPct') {
      const legacy = payload.height;
      if (legacy !== undefined && legacy !== null && Number.isFinite(Number(legacy))) {
        const n = Number(legacy);
        return n > 0 && n <= 1 ? n * 100 : n;
      }
    }
    return fallback;
  };
  const bool = (key: string) => Boolean(payload[key] ?? false);
  const chroma = (() => {
    const raw = payload.chromaKey ?? payload.chroma;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { enabled: false, color: '#00ff00', tolerance: 20 };
    }
    const value = raw as Record<string, unknown>;
    return {
      enabled: Boolean(value.enabled),
      color: typeof value.color === 'string' && value.color.trim() ? value.color : '#00ff00',
      tolerance: Number.isFinite(Number(value.tolerance)) ? Number(value.tolerance) : 20,
    };
  })();

  const setChroma = (patch: Partial<{ enabled: boolean; color: string; tolerance: number }>) => {
    setPayload('chromaKey', {
      enabled: patch.enabled ?? chroma.enabled,
      color: patch.color ?? chroma.color,
      tolerance: patch.tolerance ?? chroma.tolerance,
    });
  };

  const getNarrativeEditorSegments = (): NarrativeSegment[] => {
    const richTextDoc = payload.richTextDoc;
    if (richTextDoc && typeof richTextDoc === 'object' && !Array.isArray(richTextDoc)) {
      const blocksRaw = (richTextDoc as Record<string, unknown>).blocks;
      if (Array.isArray(blocksRaw)) {
        const segments: NarrativeSegment[] = [];
        for (const block of blocksRaw) {
          if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
          const blockSegments = (block as Record<string, unknown>).segments;
          if (!Array.isArray(blockSegments)) continue;
          for (const segment of blockSegments) {
            if (!segment || typeof segment !== 'object' || Array.isArray(segment)) continue;
            const s = segment as Record<string, unknown>;
            const text = typeof s.text === 'string' ? s.text : '';
            if (!text.trim()) continue;
            segments.push({
              text,
              ...(s.bold !== undefined ? { bold: Boolean(s.bold) } : {}),
              ...(s.italic !== undefined ? { italic: Boolean(s.italic) } : {}),
              ...(s.underline !== undefined ? { underline: Boolean(s.underline) } : {}),
              ...(Number.isFinite(Number(s.fontSizePx)) ? { fontSizePx: Number(s.fontSizePx) } : {}),
              ...(typeof s.color === 'string' && s.color.trim() ? { color: s.color } : {}),
              ...(typeof s.fontFamily === 'string' && s.fontFamily.trim() ? { fontFamily: s.fontFamily } : {}),
            });
          }
        }
        if (segments.length > 0) return segments;
      }
    }

    const legacyText = str('text').trim();
    if (legacyText) return [{ text: legacyText }];
    return [{ text: '' }];
  };

  const setNarrativeEditorSegments = (nextSegments: NarrativeSegment[]) => {
    const cleaned = nextSegments
      .map((segment) => ({
        text: String(segment.text ?? ''),
        ...(segment.bold ? { bold: true } : {}),
        ...(segment.italic ? { italic: true } : {}),
        ...(segment.underline ? { underline: true } : {}),
        ...(Number.isFinite(Number(segment.fontSizePx)) ? { fontSizePx: Number(segment.fontSizePx) } : {}),
        ...(typeof segment.color === 'string' && segment.color.trim() ? { color: segment.color.trim() } : {}),
        ...(typeof segment.fontFamily === 'string' && segment.fontFamily.trim() ? { fontFamily: segment.fontFamily.trim() } : {}),
      }))
      .filter((segment) => segment.text.trim().length > 0);

    if (cleaned.length === 0) {
      setPayload('richTextDoc', undefined);
      return;
    }

    setPayload('richTextDoc', { blocks: [{ segments: cleaned }] });
  };

  switch (type) {
    case 'playMusic':
      return (
        <Stack spacing={1}>
          <TextField label="ID de canción (songId)" size="small" value={str('songId')} onChange={(e) => setPayload('songId', e.target.value)} />
          <TextField label="ID de playlist (playlistId)" size="small" value={str('playlistId')} onChange={(e) => setPayload('playlistId', e.target.value)} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField label="Volumen (0-100)" type="number" size="small" fullWidth value={num('volume', 80)} inputProps={{ min: 0, max: 100 }} onChange={(e) => setPayload('volume', Number(e.target.value))} />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Loop</InputLabel>
                <Select value={bool('loop') ? 'si' : 'no'} label="Loop" onChange={(e) => setPayload('loop', e.target.value === 'si')}>
                  <MenuItem value="si">Sí</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Stack>
      );

    case 'stopMusic':
      return (
        <FormControl size="small" fullWidth>
          <InputLabel>Detener efectos</InputLabel>
          <Select value={bool('stopEffects') ? 'si' : 'no'} label="Detener efectos" onChange={(e) => setPayload('stopEffects', e.target.value === 'si')}>
            <MenuItem value="si">Sí</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </Select>
        </FormControl>
      );

    case 'playPreset':
      return (
        <Stack spacing={1}>
          <TextField label="ID de preset (presetId)" size="small" value={str('presetId')} onChange={(e) => setPayload('presetId', e.target.value)} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField
                label="Volumen (0-100)"
                type="number"
                size="small"
                fullWidth
                value={num('volume', 100)}
                inputProps={{ min: 0, max: 100, step: 1 }}
                onChange={(e) => setPayload('volume', Number(e.target.value))}
              />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField
                label="Velocidad (0.5-2.0)"
                type="number"
                size="small"
                fullWidth
                value={num('playbackRate', 1)}
                inputProps={{ min: 0.5, max: 2, step: 0.05 }}
                onChange={(e) => setPayload('playbackRate', Number(e.target.value))}
              />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField
                label="Tono (semitonos)"
                type="number"
                size="small"
                fullWidth
                value={num('pitchSemitones', 0)}
                inputProps={{ min: -24, max: 24, step: 1 }}
                onChange={(e) => setPayload('pitchSemitones', Number(e.target.value))}
              />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Eco</InputLabel>
                <Select value={bool('echoEnabled') ? 'si' : 'no'} label="Eco" onChange={(e) => setPayload('echoEnabled', e.target.value === 'si')}>
                  <MenuItem value="si">Sí</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {bool('echoEnabled') ? (
              <>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Retardo eco (ms)"
                    type="number"
                    size="small"
                    fullWidth
                    value={num('echoDelayMs', 300)}
                    inputProps={{ min: 0, max: 3000, step: 10 }}
                    onChange={(e) => setPayload('echoDelayMs', Number(e.target.value))}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Feedback eco (0-1)"
                    type="number"
                    size="small"
                    fullWidth
                    value={num('echoFeedback', 0.3)}
                    inputProps={{ min: 0, max: 1, step: 0.05 }}
                    onChange={(e) => setPayload('echoFeedback', Number(e.target.value))}
                  />
                </Box>
              </>
            ) : null}
            <Box sx={{ gridColumn: 'span 6' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Filtro</InputLabel>
                <Select value={str('filterType') || 'none'} label="Filtro" onChange={(e) => setPayload('filterType', e.target.value)}>
                  <MenuItem value="none">none</MenuItem>
                  <MenuItem value="lowpass">lowpass</MenuItem>
                  <MenuItem value="highpass">highpass</MenuItem>
                  <MenuItem value="bandpass">bandpass</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {str('filterType') && str('filterType') !== 'none' ? (
              <>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Frecuencia filtro (Hz)"
                    type="number"
                    size="small"
                    fullWidth
                    value={num('filterFrequency', 1000)}
                    inputProps={{ min: 20, max: 20000, step: 10 }}
                    onChange={(e) => setPayload('filterFrequency', Number(e.target.value))}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Q filtro"
                    type="number"
                    size="small"
                    fullWidth
                    value={num('filterQ', 1)}
                    inputProps={{ min: 0.1, max: 30, step: 0.1 }}
                    onChange={(e) => setPayload('filterQ', Number(e.target.value))}
                  />
                </Box>
              </>
            ) : null}
          </Box>
        </Stack>
      );

    case 'playSound':
      return (
        <Stack spacing={1}>
          <TextField label="ID de efecto (effectId)" size="small" value={str('effectId')} onChange={(e) => setPayload('effectId', e.target.value)} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField label="Volumen (0-100)" type="number" size="small" fullWidth value={num('volume', 80)} inputProps={{ min: 0, max: 100 }} onChange={(e) => setPayload('volume', Number(e.target.value))} />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Modo loop</InputLabel>
                <Select value={str('loopMode') || 'once'} label="Modo loop" onChange={(e) => setPayload('loopMode', e.target.value)}>
                  <MenuItem value="once">once</MenuItem>
                  <MenuItem value="continuous">continuous</MenuItem>
                  <MenuItem value="fixed">fixed</MenuItem>
                  <MenuItem value="random">random</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField
                label="Velocidad (0.5-2.0)"
                type="number"
                size="small"
                fullWidth
                value={num('playbackRate', 1)}
                inputProps={{ min: 0.5, max: 2, step: 0.05 }}
                onChange={(e) => setPayload('playbackRate', Number(e.target.value))}
              />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField
                label="Tono (semitonos)"
                type="number"
                size="small"
                fullWidth
                value={num('pitchSemitones', 0)}
                inputProps={{ min: -24, max: 24, step: 1 }}
                onChange={(e) => setPayload('pitchSemitones', Number(e.target.value))}
              />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Eco</InputLabel>
                <Select value={bool('echoEnabled') ? 'si' : 'no'} label="Eco" onChange={(e) => setPayload('echoEnabled', e.target.value === 'si')}>
                  <MenuItem value="si">Sí</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {bool('echoEnabled') ? (
              <>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Retardo eco (ms)"
                    type="number"
                    size="small"
                    fullWidth
                    value={num('echoDelayMs', 300)}
                    inputProps={{ min: 0, max: 3000, step: 10 }}
                    onChange={(e) => setPayload('echoDelayMs', Number(e.target.value))}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Feedback eco (0-1)"
                    type="number"
                    size="small"
                    fullWidth
                    value={num('echoFeedback', 0.3)}
                    inputProps={{ min: 0, max: 1, step: 0.05 }}
                    onChange={(e) => setPayload('echoFeedback', Number(e.target.value))}
                  />
                </Box>
              </>
            ) : null}
            <Box sx={{ gridColumn: 'span 6' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Filtro</InputLabel>
                <Select value={str('filterType') || 'none'} label="Filtro" onChange={(e) => setPayload('filterType', e.target.value)}>
                  <MenuItem value="none">none</MenuItem>
                  <MenuItem value="lowpass">lowpass</MenuItem>
                  <MenuItem value="highpass">highpass</MenuItem>
                  <MenuItem value="bandpass">bandpass</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {str('filterType') && str('filterType') !== 'none' ? (
              <>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Frecuencia filtro (Hz)"
                    type="number"
                    size="small"
                    fullWidth
                    value={num('filterFrequency', 1000)}
                    inputProps={{ min: 20, max: 20000, step: 10 }}
                    onChange={(e) => setPayload('filterFrequency', Number(e.target.value))}
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 6' }}>
                  <TextField
                    label="Q filtro"
                    type="number"
                    size="small"
                    fullWidth
                    value={num('filterQ', 1)}
                    inputProps={{ min: 0.1, max: 30, step: 0.1 }}
                    onChange={(e) => setPayload('filterQ', Number(e.target.value))}
                  />
                </Box>
              </>
            ) : null}
          </Box>
        </Stack>
      );

    case 'setMusicVolume':
    case 'setSoundVolume':
      return (
        <Stack spacing={1}>
          <TextField label="Volumen (0-100)" type="number" size="small" sx={{ width: '100%' }} value={num('value', 80)} inputProps={{ min: 0, max: 100 }} onChange={(e) => setPayload('value', Number(e.target.value))} />
          {type === 'setSoundVolume' ? (
            <TextField label="ID de efecto (opcional)" size="small" value={str('effectId')} onChange={(e) => setPayload('effectId', e.target.value)} />
          ) : null}
        </Stack>
      );

    case 'stopSound':
      return (
        <TextField label="ID de efecto (vacío = todos)" size="small" fullWidth value={str('effectId')} onChange={(e) => setPayload('effectId', e.target.value)} />
      );

    case 'sendImageToWindow':
      return (
        <>
          <SendImagePayloadRenderer
            str={str}
            num={num}
            setPayload={setPayload}
            chroma={chroma}
            setChroma={setChroma}
            onStartChromaColorPick={onStartChromaColorPick}
            isChromaColorPicking={isChromaColorPicking}
          />
          <TransformAnimationSection
            payload={payload}
            setPayloadPatch={setPayloadPatch}
            durationMs={num('durationMs', 0)}
          />
        </>
      );

    case 'sendVideoToWindow':
      return (
        <>
          <SendVideoPayloadRenderer
            str={str}
            num={num}
            bool={bool}
            setPayload={setPayload}
            chroma={chroma}
            setChroma={setChroma}
            sceneVideoAssets={sceneVideoAssets}
            onRequestUploadVideo={onRequestUploadVideo}
            onStartChromaColorPick={onStartChromaColorPick}
            isChromaColorPicking={isChromaColorPicking}
          />
          <TransformAnimationSection
            payload={payload}
            setPayloadPatch={setPayloadPatch}
            durationMs={num('durationMs', 0)}
          />
        </>
      );

    case 'setWindowBackground':
      return (
        <Stack spacing={1}>
          <TextField label="URL de imagen" size="small" value={str('imageUrl')} onChange={(e) => setPayload('imageUrl', e.target.value)} />
          <FormControl size="small" fullWidth>
            <InputLabel>Ajuste</InputLabel>
            <Select value={str('sizing') || 'cover'} label="Ajuste" onChange={(e) => setPayload('sizing', e.target.value)}>
              <MenuItem value="cover">cover</MenuItem>
              <MenuItem value="contain">contain</MenuItem>
              <MenuItem value="stretch">stretch</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      );

    case 'applyWindowFilter':
      return (
        <Stack spacing={1}>
          <TextField label="Filtro (ej. blur, sepia)" size="small" value={str('filter')} onChange={(e) => setPayload('filter', e.target.value)} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField label="Intensidad (0-1)" type="number" size="small" fullWidth value={num('intensity', 0.5)} inputProps={{ min: 0, max: 1, step: 0.05 }} onChange={(e) => setPayload('intensity', Number(e.target.value))} />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField label="Color (hex, opcional)" size="small" fullWidth value={str('color')} onChange={(e) => setPayload('color', e.target.value)} />
            </Box>
            <Box sx={{ gridColumn: 'span 12' }}>
              <TextField label="Duración (ms)" type="number" size="small" fullWidth value={num('durationMs', 2500)} inputProps={{ min: 200, max: 1800000, step: 100 }} onChange={(e) => setPayload('durationMs', Number(e.target.value))} />
            </Box>
          </Box>
        </Stack>
      );

    case 'setWeather':
      return (
        <Stack spacing={1}>
          <TextField label="Preset de clima (ej. rain, snow)" size="small" value={str('preset')} onChange={(e) => setPayload('preset', e.target.value)} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField label="Intensidad (0-1)" type="number" size="small" fullWidth value={num('intensity', 0.5)} inputProps={{ min: 0, max: 1, step: 0.05 }} onChange={(e) => setPayload('intensity', Number(e.target.value))} />
            </Box>
            <Box sx={{ gridColumn: 'span 6' }}>
              <TextField label="Duración (ms)" type="number" size="small" fullWidth value={num('durationMs', 0)} inputProps={{ min: 0 }} onChange={(e) => setPayload('durationMs', Number(e.target.value))} />
            </Box>
          </Box>
        </Stack>
      );

    case 'hideWeather':
      return (
        <TextField label="Duración (ms)" type="number" size="small" fullWidth value={num('durationMs', 0)} inputProps={{ min: 0 }} onChange={(e) => setPayload('durationMs', Number(e.target.value))} />
      );

    case 'setNarrativeText':
      return (
        <>
          <NarrativePayloadRenderer
            str={str}
            num={num}
            payload={payload}
            setPayload={setPayload}
            setPayloadPatch={setPayloadPatch}
            getNarrativeEditorSegments={getNarrativeEditorSegments}
            setNarrativeEditorSegments={setNarrativeEditorSegments}
          />
          <TransformAnimationSection
            payload={payload}
            setPayloadPatch={setPayloadPatch}
            durationMs={num('durationMs', 0)}
          />
        </>
      );

    case 'runShortcut':
      return (
        <TextField label="ID del atajo (shortcutId)" size="small" fullWidth value={str('shortcutId')} onChange={(e) => setPayload('shortcutId', e.target.value)} />
      );

    case 'delay':
      return (
        <TextField label="Duración (ms)" type="number" size="small" fullWidth value={num('durationMs', 1000)} inputProps={{ min: 0, max: 1800000 }} onChange={(e) => setPayload('durationMs', Number(e.target.value))} />
      );

    case 'runScene':
      return (
        <TextField label="ID de escena (sceneId)" size="small" fullWidth value={str('sceneId')} onChange={(e) => setPayload('sceneId', e.target.value)} />
      );

    default:
      return (
        <Typography variant="caption" color="text.secondary">
          Tipo de acción desconocido: {type}
        </Typography>
      );
  }
};

export default SceneActionEditor;
