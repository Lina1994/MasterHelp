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
  Button,
  FormControlLabel,
  Switch,
  Alert,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type SceneActionType =
  | 'sendVideoToWindow'
  | 'sendImageToWindow'
  | 'setWindowBackground'
  | 'applyWindowFilter'
  | 'clearWindow'
  | 'playMusic'
  | 'stopMusic'
  | 'setMusicVolume'
  | 'playSound'
  | 'stopSound'
  | 'setSoundVolume'
  | 'delay'
  | 'runShortcut'
  | 'runScene'
  | 'setNarrativeText'
  | 'setWeather'
  | 'hideWeather';

const ACTION_TYPES: SceneActionType[] = [
  'sendVideoToWindow',
  'sendImageToWindow',
  'setWindowBackground',
  'applyWindowFilter',
  'clearWindow',
  'playMusic',
  'stopMusic',
  'setMusicVolume',
  'playSound',
  'stopSound',
  'setSoundVolume',
  'delay',
  'runShortcut',
  'runScene',
  'setNarrativeText',
  'setWeather',
  'hideWeather',
];

const ACTION_TYPE_LABELS: Record<SceneActionType, string> = {
  sendVideoToWindow: '📹 Enviar vídeo a ventana',
  sendImageToWindow: '🖼️ Enviar imagen a ventana',
  setWindowBackground: '🖼️ Establecer fondo de ventana',
  applyWindowFilter: '🎨 Aplicar filtro de ventana',
  clearWindow: '🧹 Limpiar ventana',
  playMusic: '🎵 Reproducir música',
  stopMusic: '🔇 Detener música',
  setMusicVolume: '🔊 Ajustar volumen música',
  playSound: '🔊 Reproducir sonido',
  stopSound: '🔇 Detener sonido',
  setSoundVolume: '🔊 Ajustar volumen sonido',
  delay: '⏳ Pausa (Delay)',
  runShortcut: '⚡ Atajo rápido',
  runScene: '🎬 Cambiar a escena',
  setNarrativeText: '📜 Texto narrativo',
  setWeather: '⛈️ Tiempo atmosférico',
  hideWeather: '☀️ Ocultar tiempo atmosférico',
};

const DEST_WINDOW_LABELS: Record<string, string> = {
  main: 'Ventana principal (Director)',
  projection: 'Proyección (Jugadores / Mapa)',
  skyline: 'Skyline (Detalle)',
};

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

interface SceneVideoAsset {
  id: string;
  name: string;
  originalFilename: string;
  size: number;
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

const toNonNegativeMs = (val: unknown): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

const toNonNegativeSec = (val: unknown): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

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
      }
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

const NARRATIVE_FONT_OPTIONS = [
  'Merriweather',
  'Lora',
  'Playfair Display',
  'Cinzel',
  'Cormorant Garamond',
  'Libre Baskerville',
  'EB Garamond',
  'Noto Serif',
  'Montserrat',
  'Poppins',
] as const;

const NARRATIVE_STYLE_PRESETS: Array<{ id: string; label: string; patch: Record<string, unknown> }> = [
  {
    id: 'narrador',
    label: 'Narrador',
    patch: {
      fontFamily: 'Merriweather',
      fontSizePx: 28,
      fontColor: '#ffffff',
      textAlign: 'left',
      lineHeight: 1.35,
      backgroundMode: 'rect',
      backgroundColor: '#000000',
      backgroundOpacity: 0.58,
      borderRadiusPx: 12,
      paddingPx: 16,
    },
  },
  {
    id: 'susurro',
    label: 'Susurro',
    patch: {
      fontFamily: 'Cormorant Garamond',
      fontSizePx: 24,
      fontColor: '#dbeafe',
      textAlign: 'left',
      lineHeight: 1.45,
      fontStyle: 'italic',
      backgroundMode: 'none',
      paddingPx: 10,
    },
  },
  {
    id: 'aviso',
    label: 'Aviso',
    patch: {
      fontFamily: 'Montserrat',
      fontSizePx: 30,
      fontColor: '#fff7d6',
      textAlign: 'center',
      lineHeight: 1.25,
      fontWeight: 'bold',
      backgroundMode: 'capsule',
      backgroundColor: '#7c2d12',
      backgroundOpacity: 0.72,
      borderRadiusPx: 18,
      paddingPx: 14,
    },
  },
  {
    id: 'titulo',
    label: 'Título',
    patch: {
      fontFamily: 'Cinzel',
      fontSizePx: 38,
      fontColor: '#fef3c7',
      textAlign: 'center',
      lineHeight: 1.15,
      fontWeight: 'bold',
      backgroundMode: 'none',
    },
  },
  {
    id: 'ritual',
    label: 'Ritual',
    patch: {
      fontFamily: 'EB Garamond',
      fontSizePx: 32,
      fontColor: '#f5d0fe',
      textAlign: 'justify',
      lineHeight: 1.5,
      fontStyle: 'italic',
      backgroundMode: 'rect',
      backgroundColor: '#1f1147',
      backgroundOpacity: 0.68,
      borderRadiusPx: 8,
      paddingPx: 18,
    },
  },
];

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

  const [narrativeTab, setNarrativeTab] = React.useState<'content' | 'style' | 'position'>('content');
  const [showSegmentEditor, setShowSegmentEditor] = React.useState<boolean>(false);
  const [showCustomFontInput, setShowCustomFontInput] = React.useState<boolean>(false);

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
          </Box>
        </Stack>
      );

    case 'setMusicVolume':
    case 'setSoundVolume':
      return (
        <TextField label="Volumen (0-100)" type="number" size="small" sx={{ width: '100%' }} value={num('value', 80)} inputProps={{ min: 0, max: 100 }} onChange={(e) => setPayload('value', Number(e.target.value))} />
      );

    case 'sendImageToWindow':
      return (
        <Stack spacing={1}>
          <TextField label="URL de imagen" size="small" value={str('imageUrl')} onChange={(e) => setPayload('imageUrl', e.target.value)} />
          <TextField label="Título (opcional)" size="small" value={str('title')} onChange={(e) => setPayload('title', e.target.value)} />
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

    case 'sendVideoToWindow':
      {
        const rawVideoAssetId = str('videoAssetId');
        const availableVideoAssetIds = new Set((sceneVideoAssets ?? []).map((asset) => asset.id));
        const selectedVideoAssetId = availableVideoAssetIds.has(rawVideoAssetId) ? rawVideoAssetId : '';
        return (
          <Stack spacing={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Vídeo subido</InputLabel>
              <Select
                value={selectedVideoAssetId}
                label="Vídeo subido"
                onChange={(e) => setPayload('videoAssetId', e.target.value)}
              >
                <MenuItem value="">(ninguno)</MenuItem>
                {rawVideoAssetId && !availableVideoAssetIds.has(rawVideoAssetId) ? (
                  <MenuItem value={rawVideoAssetId}>
                    Vídeo no disponible ({rawVideoAssetId.slice(0, 8)}...)
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
                Subir nuevo vídeo
              </Button>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              Selecciona un vídeo subido y el backend resolverá la URL firmada al ejecutar.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1 }}>
              <Box sx={{ gridColumn: 'span 4' }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Loop</InputLabel>
                  <Select value={bool('loop') ? 'si' : 'no'} label="Loop" onChange={(e) => setPayload('loop', e.target.value === 'si')}>
                    <MenuItem value="si">Sí</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ gridColumn: 'span 4' }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Sin audio</InputLabel>
                  <Select value={bool('muted') ? 'si' : 'no'} label="Sin audio" onChange={(e) => setPayload('muted', e.target.value === 'si')}>
                    <MenuItem value="si">Sí</MenuItem>
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
      }

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
      {
        const currentSegments = getNarrativeEditorSegments();
        const availableFonts = NARRATIVE_FONT_OPTIONS;
        const selectedFont = str('fontFamily') || 'Merriweather';
        const hasCuratedFont = availableFonts.includes(selectedFont as any);

        return (
          <Stack spacing={1.5}>
            {/* Presets section */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Estilos rápidos:
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

            {/* Navigation Tabs */}
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
              <Tab value="style" label="Diseño" />
              <Tab value="position" label="Posición" />
            </Tabs>

            {/* TAB 1: CONTENT */}
            {narrativeTab === 'content' && (
              <Stack spacing={1.5}>
                {/* Title and Duration Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1.5 }}>
                  <Box sx={{ gridColumn: 'span 7' }}>
                    <TextField
                      label="Título (opcional)"
                      size="small"
                      value={str('title')}
                      onChange={(e) => setPayload('title', e.target.value)}
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ gridColumn: 'span 5' }}>
                    <TextField
                      label="Duración (ms)"
                      placeholder="0 = manual"
                      type="number"
                      size="small"
                      value={num('durationMs', 0)}
                      inputProps={{ min: 0 }}
                      onChange={(e) => setPayload('durationMs', Number(e.target.value))}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>
                </Box>

                {/* Legacy text vs Segment editor */}
                {!showSegmentEditor ? (
                  <Stack spacing={1}>
                    <TextField
                      label="Texto principal"
                      multiline
                      rows={3}
                      size="small"
                      value={str('text')}
                      onChange={(e) => setPayload('text', e.target.value)}
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
                          if (confirm('¿Volver a texto plano? Perderás los formatos individuales de color/tamaño de cada palabra.')) {
                            const combined = currentSegments.map((s) => s.text).join(' ');
                            setPayload('text', combined);
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
                      💡 Consejo: Es más cómodo hacer doble clic sobre el texto en el previsualizador para editarlo de forma visual en pantalla completa.
                    </Alert>

                    {/* Segment rows */}
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
                                  label="Tamaño (px)"
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
                      Añadir nuevo fragmento
                    </Button>
                  </Stack>
                )}
              </Stack>
            )}

            {/* TAB 2: STYLE & DESIGN */}
            {narrativeTab === 'style' && (
              <Stack spacing={2}>
                {/* Section A: Typography */}
                <Box>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Tipografía y Formato
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
                        label="Tamaño (px)"
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
                        <InputLabel>Alineación</InputLabel>
                        <Select
                          label="Alineación"
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

                {/* Section B: Box and Background */}
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
                          <MenuItem value="rect">Rectángulo</MenuItem>
                          <MenuItem value="capsule">Cápsula</MenuItem>
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

            {/* TAB 3: POSITION */}
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

                {/* Layer properties */}
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
                    💡 Consejo: También puedes ordenar las capas arrastrando los bloques verticalmente en la pista del timeline.
                  </Typography>
                </Box>
              </Stack>
            )}
          </Stack>
        );
      }

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
