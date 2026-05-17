import React from 'react';
import {
  Button,
  Box,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SceneActionDto, SceneVideoAsset } from '../../types/scenes';

const ACTION_TYPE_LABELS: Record<string, string> = {
  playMusic: '🎵 Reproducir música',
  stopMusic: '⏹ Detener música',
  playSound: '🔊 Reproducir sonido',
  setMusicVolume: '🔉 Volumen de música',
  sendImageToWindow: '🖼 Enviar imagen a ventana',
  sendVideoToWindow: '🎬 Enviar vídeo a ventana',
  setWindowBackground: '🖼 Fondo de ventana',
  applyWindowFilter: '🎨 Aplicar filtro',
  clearWindowFilter: '🚫 Limpiar filtro',
  setWeather: '🌦 Establecer clima',
  setNarrativeText: '📜 Texto narrativo',
  runShortcut: '⚡ Ejecutar atajo',
  delay: '⏱ Pausa',
  runScene: '🎭 Ejecutar escena',
};

const ACTION_TYPES = Object.keys(ACTION_TYPE_LABELS);

const WINDOW_TARGET_KINDS = ['main', 'projection', 'skyline'] as const;
const WINDOW_TARGET_LABELS: Record<(typeof WINDOW_TARGET_KINDS)[number], string> = {
  main: 'Principal',
  projection: 'Mapas',
  skyline: 'Skyline',
};

interface Props {
  /** The action being edited */
  action: SceneActionDto;
  /** Index in the parent list (1-based for display) */
  index: number;
  /** Called whenever this action's fields change */
  onChange: (updated: SceneActionDto) => void;
  /** Called to remove this action */
  onRemove: () => void;
  /** Available uploaded scene videos for quick selection in video actions. */
  sceneVideoAssets?: SceneVideoAsset[];
  /** Triggers video upload flow from the parent editor. */
  onRequestUploadVideo?: () => void;
  /** Highlights the action row when selected from timeline. */
  highlighted?: boolean;
  /** Starts color picking mode for chroma on the selected layer in preview. */
  onStartChromaColorPick?: () => void;
  /** Indicates chroma color picking mode is active. */
  isChromaColorPicking?: boolean;
}

/**
 * Renders a single draggable action row with type selector and dynamic payload fields.
 */
const SceneActionEditor: React.FC<Props> = ({
  action,
  index,
  onChange,
  onRemove,
  sceneVideoAssets,
  onRequestUploadVideo,
  highlighted,
  onStartChromaColorPick,
  isChromaColorPicking,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: action.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const setPayload = (key: string, value: unknown) => {
    onChange({ ...action, payload: { ...action.payload, [key]: value } });
  };

  const setPayloadPatch = (patch: Record<string, unknown>) => {
    onChange({ ...action, payload: { ...action.payload, ...patch } });
  };

  const setType = (newType: string) => {
    onChange({ ...action, type: newType, payload: {} });
  };

  const setDelay = (ms: number) => {
    onChange({ ...action, delay: isNaN(ms) ? 0 : ms });
  };

  const setTargetKind = (kind: (typeof WINDOW_TARGET_KINDS)[number]) => {
    onChange({ ...action, targetWindow: { kind } });
  };

  const p = action.payload;

  const needsWindow = [
    'sendImageToWindow',
    'sendVideoToWindow',
    'setWindowBackground',
    'applyWindowFilter',
    'clearWindowFilter',
  ].includes(action.type);

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{
        p: 1.5,
        width: '100%',
        minWidth: 0,
        overflowX: 'hidden',
        borderColor: highlighted ? 'primary.main' : 'divider',
        boxShadow: highlighted ? 2 : undefined,
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        {/* Drag handle */}
        <Tooltip title="Arrastrar para reordenar">
          <Box
            {...attributes}
            {...listeners}
            sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', pt: 0.5, color: 'text.disabled' }}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>
        </Tooltip>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={1} sx={{ flexWrap: 'wrap', minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 24 }}>
              #{index}
            </Typography>

            {/* Action type */}
            <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 200 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
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
              sx={{ width: { xs: '100%', sm: 130 } }}
              value={action.delay ?? 0}
              inputProps={{ min: 0, max: 600000, step: 100 }}
              onChange={(e) => setDelay(Number(e.target.value))}
            />
          </Stack>

          <TextField
            label="Nombre en timeline (opcional)"
            size="small"
            value={String(action.payload?.displayName ?? '')}
            onChange={(e) => setPayload('displayName', e.target.value)}
            sx={{ mb: 1, width: '100%', minWidth: 0, maxWidth: '100%' }}
          />

          {/* Window target picker — only for window-related actions */}
          {needsWindow && (
            <Stack direction="row" spacing={1} mb={1} sx={{ flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 150 }, width: { xs: '100%', sm: 'auto' } }}>
                <InputLabel>Ventana destino</InputLabel>
                <Select
                  value={action.targetWindow?.kind ?? 'main'}
                  label="Ventana destino"
                  onChange={(e) => setTargetKind(e.target.value as (typeof WINDOW_TARGET_KINDS)[number])}
                >
                  {WINDOW_TARGET_KINDS.map((k) => (
                    <MenuItem key={k} value={k}>{WINDOW_TARGET_LABELS[k]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}

          <Divider sx={{ mb: 1 }} />

          {/* Dynamic payload fields per action type */}
          <Box
            sx={{
              minWidth: 0,
              '& .MuiFormControl-root, & .MuiTextField-root': {
                maxWidth: '100%',
                minWidth: 0,
              },
              '& .MuiStack-root': {
                minWidth: 0,
                flexWrap: 'wrap',
              },
            }}
          >
            <PayloadFields
              type={action.type}
              payload={p}
              setPayload={setPayload}
              setPayloadPatch={setPayloadPatch}
              sceneVideoAssets={sceneVideoAssets}
              onRequestUploadVideo={onRequestUploadVideo}
              onStartChromaColorPick={onStartChromaColorPick}
              isChromaColorPicking={isChromaColorPicking}
            />
          </Box>
        </Box>

        {/* Delete button */}
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// Payload field sub-renderer
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
    label: 'Narrador clásico',
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

  const [narrativeEditorMode, setNarrativeEditorMode] = React.useState<'basic' | 'advanced'>('basic');
  const [narrativeInspectorSection, setNarrativeInspectorSection] = React.useState<'text' | 'typography' | 'background' | 'layout' | 'segments'>('text');
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
          <Stack direction="row" spacing={1}>
            <TextField label="Volumen (0-100)" type="number" size="small" sx={{ width: 150 }} value={num('volume', 80)} inputProps={{ min: 0, max: 100 }} onChange={(e) => setPayload('volume', Number(e.target.value))} />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Loop</InputLabel>
              <Select value={bool('loop') ? 'si' : 'no'} label="Loop" onChange={(e) => setPayload('loop', e.target.value === 'si')}>
                <MenuItem value="si">Sí</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      );

    case 'stopMusic':
      return (
        <FormControl size="small" sx={{ minWidth: 180 }}>
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
          <Stack direction="row" spacing={1}>
            <TextField label="Volumen (0-100)" type="number" size="small" sx={{ width: 150 }} value={num('volume', 80)} inputProps={{ min: 0, max: 100 }} onChange={(e) => setPayload('volume', Number(e.target.value))} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Modo loop</InputLabel>
              <Select value={str('loopMode') || 'once'} label="Modo loop" onChange={(e) => setPayload('loopMode', e.target.value)}>
                <MenuItem value="once">once</MenuItem>
                <MenuItem value="continuous">continuous</MenuItem>
                <MenuItem value="fixed">fixed</MenuItem>
                <MenuItem value="random">random</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      );

    case 'setMusicVolume':
      return (
        <TextField label="Volumen (0-100)" type="number" size="small" sx={{ width: 150 }} value={num('value', 80)} inputProps={{ min: 0, max: 100 }} onChange={(e) => setPayload('value', Number(e.target.value))} />
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
            sx={{ width: 170 }}
            value={num('opacity', 1)}
            inputProps={{ min: 0, max: 1, step: 0.05 }}
            onChange={(e) => setPayload('opacity', Number(e.target.value))}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField label="X%" type="number" size="small" sx={{ width: 95 }} value={num('leftPct', 10)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('leftPct', Number(e.target.value))} />
            <TextField label="Y%" type="number" size="small" sx={{ width: 95 }} value={num('topPct', 10)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('topPct', Number(e.target.value))} />
            <TextField label="Ancho%" type="number" size="small" sx={{ width: 110 }} value={num('widthPct', 80)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('widthPct', Number(e.target.value))} />
            <TextField label="Alto%" type="number" size="small" sx={{ width: 100 }} value={num('heightPct', 80)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('heightPct', Number(e.target.value))} />
          </Stack>
          <Divider />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
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
            <TextField
              label="Color croma"
              size="small"
              sx={{ width: 140 }}
              value={chroma.color}
              onChange={(e) => setChroma({ color: e.target.value })}
            />
            <TextField
              label="Tolerancia"
              type="number"
              size="small"
              sx={{ width: 120 }}
              value={chroma.tolerance}
              inputProps={{ min: 0, max: 100, step: 1 }}
              onChange={(e) => setChroma({ tolerance: Number(e.target.value) })}
            />
            {onStartChromaColorPick ? (
              <Button variant={isChromaColorPicking ? 'contained' : 'outlined'} size="small" onClick={onStartChromaColorPick}>
                {isChromaColorPicking ? 'Selecciona color en preview' : 'Tomar color exacto'}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      );

    case 'sendVideoToWindow':
      {
        const rawVideoAssetId = str('videoAssetId');
        const availableVideoAssetIds = new Set((sceneVideoAssets ?? []).map((asset) => asset.id));
        const selectedVideoAssetId = availableVideoAssetIds.has(rawVideoAssetId) ? rawVideoAssetId : '';
      return (
        <Stack spacing={1}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
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
            <Button variant="outlined" size="small" onClick={onRequestUploadVideo}>
              Subir nuevo vídeo
            </Button>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            Selecciona un vídeo subido y el backend resolverá la URL firmada al ejecutar.
          </Typography>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Loop</InputLabel>
              <Select value={bool('loop') ? 'si' : 'no'} label="Loop" onChange={(e) => setPayload('loop', e.target.value === 'si')}>
                <MenuItem value="si">Sí</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Sin audio</InputLabel>
              <Select value={bool('muted') ? 'si' : 'no'} label="Sin audio" onChange={(e) => setPayload('muted', e.target.value === 'si')}>
                <MenuItem value="si">Sí</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Opacidad (0-1)"
              type="number"
              size="small"
              sx={{ width: 170 }}
              value={num('opacity', 1)}
              inputProps={{ min: 0, max: 1, step: 0.05 }}
              onChange={(e) => setPayload('opacity', Number(e.target.value))}
            />
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField label="X%" type="number" size="small" sx={{ width: 95 }} value={num('leftPct', 10)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('leftPct', Number(e.target.value))} />
            <TextField label="Y%" type="number" size="small" sx={{ width: 95 }} value={num('topPct', 10)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('topPct', Number(e.target.value))} />
            <TextField label="Ancho%" type="number" size="small" sx={{ width: 110 }} value={num('widthPct', 80)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('widthPct', Number(e.target.value))} />
            <TextField label="Alto%" type="number" size="small" sx={{ width: 100 }} value={num('heightPct', 80)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('heightPct', Number(e.target.value))} />
          </Stack>
          <Divider />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
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
            <TextField
              label="Color croma"
              size="small"
              sx={{ width: 140 }}
              value={chroma.color}
              onChange={(e) => setChroma({ color: e.target.value })}
            />
            <TextField
              label="Tolerancia"
              type="number"
              size="small"
              sx={{ width: 120 }}
              value={chroma.tolerance}
              inputProps={{ min: 0, max: 100, step: 1 }}
              onChange={(e) => setChroma({ tolerance: Number(e.target.value) })}
            />
            {onStartChromaColorPick ? (
              <Button variant={isChromaColorPicking ? 'contained' : 'outlined'} size="small" onClick={onStartChromaColorPick}>
                {isChromaColorPicking ? 'Selecciona color en preview' : 'Tomar color exacto'}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      );
      }

    case 'setWindowBackground':
      return (
        <Stack spacing={1}>
          <TextField label="URL de imagen" size="small" value={str('imageUrl')} onChange={(e) => setPayload('imageUrl', e.target.value)} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
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
          <Stack direction="row" spacing={1}>
            <TextField label="Intensidad (0-1)" type="number" size="small" sx={{ width: 160 }} value={num('intensity', 0.5)} inputProps={{ min: 0, max: 1, step: 0.05 }} onChange={(e) => setPayload('intensity', Number(e.target.value))} />
            <TextField label="Color (hex, opcional)" size="small" value={str('color')} onChange={(e) => setPayload('color', e.target.value)} />
          </Stack>
        </Stack>
      );

    case 'clearWindowFilter':
      return <Typography variant="caption" color="text.secondary">Sin opciones configurables.</Typography>;

    case 'setWeather':
      return (
        <Stack spacing={1}>
          <TextField label="Preset de clima (ej. rain, snow)" size="small" value={str('preset')} onChange={(e) => setPayload('preset', e.target.value)} />
          <Stack direction="row" spacing={1}>
            <TextField label="Intensidad (0-1)" type="number" size="small" sx={{ width: 160 }} value={num('intensity', 0.5)} inputProps={{ min: 0, max: 1, step: 0.05 }} onChange={(e) => setPayload('intensity', Number(e.target.value))} />
            <TextField label="Duración (ms)" type="number" size="small" sx={{ width: 150 }} value={num('durationMs', 0)} inputProps={{ min: 0 }} onChange={(e) => setPayload('durationMs', Number(e.target.value))} />
          </Stack>
        </Stack>
      );

    case 'setNarrativeText':
      {
        const narrativeSegments = getNarrativeEditorSegments();
        const selectedFont = str('fontFamily') || 'Merriweather';
        const hasCuratedFont = NARRATIVE_FONT_OPTIONS.includes(selectedFont as (typeof NARRATIVE_FONT_OPTIONS)[number]);
        const appliedPresetId = str('stylePresetId');
        const applyPreset = (presetId: string) => {
          const preset = NARRATIVE_STYLE_PRESETS.find((item) => item.id === presetId);
          if (!preset) return;
          setPayloadPatch({ ...preset.patch, stylePresetId: preset.id });
          const presetFont = String(preset.patch.fontFamily ?? '');
          setShowCustomFontInput(!NARRATIVE_FONT_OPTIONS.includes(presetFont as (typeof NARRATIVE_FONT_OPTIONS)[number]));
        };
        const narrativeSectionSx = {
          p: 1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        } as const;

      return (
          <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.8 }}>
            <Typography variant="caption" color="text.secondary">Modo editor</Typography>
            <Button
              size="small"
              variant={narrativeEditorMode === 'basic' ? 'contained' : 'outlined'}
              onClick={() => setNarrativeEditorMode('basic')}
            >
              Basico
            </Button>
            <Button
              size="small"
              variant={narrativeEditorMode === 'advanced' ? 'contained' : 'outlined'}
              onClick={() => {
                setNarrativeEditorMode('advanced');
                if (narrativeInspectorSection === 'text') {
                  setNarrativeInspectorSection('typography');
                }
              }}
            >
              Avanzado
            </Button>
          </Stack>

          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.7 }}>
            <Typography variant="caption" color="text.secondary">Sección</Typography>
            <Button size="small" variant={narrativeInspectorSection === 'text' ? 'contained' : 'outlined'} onClick={() => setNarrativeInspectorSection('text')}>Texto</Button>
            <Button size="small" variant={narrativeInspectorSection === 'typography' ? 'contained' : 'outlined'} onClick={() => setNarrativeInspectorSection('typography')}>Tipografía</Button>
            <Button size="small" variant={narrativeInspectorSection === 'background' ? 'contained' : 'outlined'} onClick={() => setNarrativeInspectorSection('background')}>Fondo</Button>
            <Button size="small" variant={narrativeInspectorSection === 'layout' ? 'contained' : 'outlined'} onClick={() => setNarrativeInspectorSection('layout')}>Posición</Button>
            <Button size="small" variant={narrativeInspectorSection === 'segments' ? 'contained' : 'outlined'} onClick={() => setNarrativeInspectorSection('segments')}>Segmentos</Button>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.8 }}>
            <FormControl size="small" sx={{ minWidth: 210 }}>
              <InputLabel>Preset narrativo</InputLabel>
              <Select
                label="Preset narrativo"
                value={appliedPresetId}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <MenuItem value="">(sin preset)</MenuItem>
                {NARRATIVE_STYLE_PRESETS.map((preset) => (
                  <MenuItem key={preset.id} value={preset.id}>{preset.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {appliedPresetId ? (
              <Button
                size="small"
                variant="text"
                onClick={() => setPayload('stylePresetId', '')}
              >
                Quitar preset
              </Button>
            ) : null}
          </Stack>

          <TextField label="Texto narrativo" size="small" multiline rows={2} value={str('text')} onChange={(e) => setPayload('text', e.target.value)} />
          <Stack direction="row" spacing={1}>
            <TextField label="Título (opcional)" size="small" value={str('title')} onChange={(e) => setPayload('title', e.target.value)} />
            <TextField label="Duración (ms, 0=manual)" type="number" size="small" sx={{ width: 180 }} value={num('durationMs', 0)} inputProps={{ min: 0 }} onChange={(e) => setPayload('durationMs', Number(e.target.value))} />
          </Stack>

          {narrativeInspectorSection === 'text' || narrativeInspectorSection === 'typography' ? (
          <Paper variant="outlined" sx={narrativeSectionSx}>
            <Stack spacing={0.8}>
              <Typography variant="caption" color="text.secondary">Apariencia rapida</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
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
                <FormControlLabel
                  control={(
                    <Switch
                      checked={showCustomFontInput || !hasCuratedFont}
                      onChange={(_, checked) => setShowCustomFontInput(checked)}
                    />
                  )}
                  label="Fuente manual"
                />
                {showCustomFontInput || !hasCuratedFont ? (
                  <TextField
                    label="Fuente personalizada"
                    size="small"
                    sx={{ minWidth: 220 }}
                    value={selectedFont}
                    onChange={(e) => setPayload('fontFamily', e.target.value)}
                  />
                ) : null}
                <TextField label="Tamaño px" type="number" size="small" sx={{ width: 120 }} value={num('fontSizePx', 28)} inputProps={{ min: 8, max: 220, step: 1 }} onChange={(e) => setPayload('fontSizePx', Number(e.target.value))} />
                <TextField label="Color" size="small" sx={{ width: 130 }} value={str('fontColor') || '#ffffff'} onChange={(e) => setPayload('fontColor', e.target.value)} />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Alineación</InputLabel>
                  <Select value={str('textAlign') || 'left'} label="Alineación" onChange={(e) => setPayload('textAlign', e.target.value)}>
                    <MenuItem value="left">left</MenuItem>
                    <MenuItem value="center">center</MenuItem>
                    <MenuItem value="right">right</MenuItem>
                    <MenuItem value="justify">justify</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>
          ) : null}

          {narrativeInspectorSection === 'background' ? (
          <Paper variant="outlined" sx={narrativeSectionSx}>
            <Stack spacing={0.8}>
              <Typography variant="caption" color="text.secondary">Caja</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Modo</InputLabel>
                  <Select value={str('backgroundMode') || 'rect'} label="Modo" onChange={(e) => setPayload('backgroundMode', e.target.value)}>
                    <MenuItem value="none">none</MenuItem>
                    <MenuItem value="rect">rect</MenuItem>
                    <MenuItem value="capsule">capsule</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Color" size="small" sx={{ width: 130 }} value={str('backgroundColor') || '#000000'} onChange={(e) => setPayload('backgroundColor', e.target.value)} />
                <TextField label="Opacidad" type="number" size="small" sx={{ width: 120 }} value={num('backgroundOpacity', 0.58)} inputProps={{ min: 0, max: 1, step: 0.05 }} onChange={(e) => setPayload('backgroundOpacity', Number(e.target.value))} />
              </Stack>
            </Stack>
          </Paper>
          ) : null}

          {narrativeEditorMode === 'advanced' ? (
            <>
              {narrativeInspectorSection === 'layout' ? (
              <Paper variant="outlined" sx={narrativeSectionSx}>
                <Stack spacing={0.8}>
                  <Typography variant="caption" color="text.secondary">Capa y posición fina</Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <TextField label="Left %" type="number" size="small" sx={{ width: 110 }} value={num('leftPct', 8)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('leftPct', Number(e.target.value))} />
                    <TextField label="Top %" type="number" size="small" sx={{ width: 110 }} value={num('topPct', 68)} inputProps={{ min: -50, max: 150, step: 1 }} onChange={(e) => setPayload('topPct', Number(e.target.value))} />
                    <TextField label="Width %" type="number" size="small" sx={{ width: 120 }} value={num('widthPct', 84)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('widthPct', Number(e.target.value))} />
                    <TextField label="Height %" type="number" size="small" sx={{ width: 120 }} value={num('heightPct', 22)} inputProps={{ min: 1, max: 200, step: 1 }} onChange={(e) => setPayload('heightPct', Number(e.target.value))} />
                    <TextField label="Opacity" type="number" size="small" sx={{ width: 120 }} value={num('opacity', 1)} inputProps={{ min: 0, max: 1, step: 0.05 }} onChange={(e) => setPayload('opacity', Number(e.target.value))} />
                    <TextField label="Layer" type="number" size="small" sx={{ width: 110 }} value={num('layerOrder', 100)} onChange={(e) => setPayload('layerOrder', Number(e.target.value))} />
                  </Stack>
                </Stack>
              </Paper>
              ) : null}

              {narrativeInspectorSection === 'typography' ? (
              <Paper variant="outlined" sx={narrativeSectionSx}>
                <Stack spacing={0.8}>
                  <Typography variant="caption" color="text.secondary">Tipografía avanzada</Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <TextField label="Line height" type="number" size="small" sx={{ width: 130 }} value={num('lineHeight', 1.35)} inputProps={{ min: 0.8, max: 3, step: 0.05 }} onChange={(e) => setPayload('lineHeight', Number(e.target.value))} />
                    <TextField label="Espaciado letras" type="number" size="small" sx={{ width: 150 }} value={num('letterSpacingPx', 0)} inputProps={{ min: -8, max: 20, step: 0.25 }} onChange={(e) => setPayload('letterSpacingPx', Number(e.target.value))} />
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Peso</InputLabel>
                      <Select value={str('fontWeight') || 'normal'} label="Peso" onChange={(e) => setPayload('fontWeight', e.target.value)}>
                        <MenuItem value="normal">normal</MenuItem>
                        <MenuItem value="bold">bold</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Estilo</InputLabel>
                      <Select value={str('fontStyle') || 'normal'} label="Estilo" onChange={(e) => setPayload('fontStyle', e.target.value)}>
                        <MenuItem value="normal">normal</MenuItem>
                        <MenuItem value="italic">italic</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>Decoración</InputLabel>
                      <Select value={str('textDecoration') || 'none'} label="Decoración" onChange={(e) => setPayload('textDecoration', e.target.value)}>
                        <MenuItem value="none">none</MenuItem>
                        <MenuItem value="underline">underline</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                </Stack>
              </Paper>
              ) : null}

              {narrativeInspectorSection === 'background' ? (
              <Paper variant="outlined" sx={narrativeSectionSx}>
                <Stack spacing={0.8}>
                  <Typography variant="caption" color="text.secondary">Caja avanzada</Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <TextField label="Radio px" type="number" size="small" sx={{ width: 120 }} value={num('borderRadiusPx', 12)} inputProps={{ min: 0, max: 128, step: 1 }} onChange={(e) => setPayload('borderRadiusPx', Number(e.target.value))} />
                    <TextField label="Padding px" type="number" size="small" sx={{ width: 120 }} value={num('paddingPx', 16)} inputProps={{ min: 0, max: 64, step: 1 }} onChange={(e) => setPayload('paddingPx', Number(e.target.value))} />
                  </Stack>
                </Stack>
              </Paper>
              ) : null}
            </>
          ) : null}

          {narrativeInspectorSection === 'segments' ? (
            <>
              <Divider flexItem />
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">Texto enriquecido por segmentos</Typography>
                <Button
                  size="small"
                  variant={showSegmentEditor ? 'contained' : 'outlined'}
                  onClick={() => setShowSegmentEditor((current) => !current)}
                >
                  {showSegmentEditor ? 'Ocultar segmentos' : 'Editar por segmentos'}
                </Button>
              </Stack>
            </>
          ) : null}

          {narrativeInspectorSection === 'segments' && showSegmentEditor ? (
            <>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">Segmentos activos: {narrativeSegments.filter((segment) => segment.text.trim()).length}</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setNarrativeEditorSegments([
                      ...narrativeSegments,
                      { text: '', fontSizePx: num('fontSizePx', 28), color: str('fontColor') || '#ffffff', fontFamily: selectedFont || 'Merriweather' },
                    ]);
                  }}
                >
                  Añadir segmento
                </Button>
              </Stack>
              <Stack spacing={0.8}>
                {narrativeSegments.map((segment, segmentIndex) => (
                  <Paper key={`narrative-segment-${segmentIndex}`} variant="outlined" sx={{ p: 1 }}>
                    <Stack spacing={0.8}>
                      <TextField
                        label={`Segmento ${segmentIndex + 1}`}
                        size="small"
                        multiline
                        rows={2}
                        value={segment.text}
                        onChange={(e) => {
                          const next = [...narrativeSegments];
                          next[segmentIndex] = { ...next[segmentIndex], text: e.target.value };
                          setNarrativeEditorSegments(next);
                        }}
                      />
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                        <Tooltip title="Negrita">
                          <IconButton
                            size="small"
                            color={segment.bold ? 'primary' : 'default'}
                            onClick={() => {
                              const next = [...narrativeSegments];
                              next[segmentIndex] = { ...next[segmentIndex], bold: !next[segmentIndex].bold };
                              setNarrativeEditorSegments(next);
                            }}
                          >
                            <FormatBoldIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cursiva">
                          <IconButton
                            size="small"
                            color={segment.italic ? 'primary' : 'default'}
                            onClick={() => {
                              const next = [...narrativeSegments];
                              next[segmentIndex] = { ...next[segmentIndex], italic: !next[segmentIndex].italic };
                              setNarrativeEditorSegments(next);
                            }}
                          >
                            <FormatItalicIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Subrayado">
                          <IconButton
                            size="small"
                            color={segment.underline ? 'primary' : 'default'}
                            onClick={() => {
                              const next = [...narrativeSegments];
                              next[segmentIndex] = { ...next[segmentIndex], underline: !next[segmentIndex].underline };
                              setNarrativeEditorSegments(next);
                            }}
                          >
                            <FormatUnderlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <TextField
                          label="Tamaño"
                          type="number"
                          size="small"
                          sx={{ width: 110 }}
                          value={Number.isFinite(Number(segment.fontSizePx)) ? Number(segment.fontSizePx) : ''}
                          inputProps={{ min: 8, max: 220, step: 1 }}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const next = [...narrativeSegments];
                            next[segmentIndex] = {
                              ...next[segmentIndex],
                              ...(raw.trim() ? { fontSizePx: Number(raw) } : { fontSizePx: undefined }),
                            };
                            setNarrativeEditorSegments(next);
                          }}
                        />
                        <TextField
                          label="Color"
                          type="color"
                          size="small"
                          sx={{ width: 90 }}
                          value={segment.color || '#ffffff'}
                          onChange={(e) => {
                            const next = [...narrativeSegments];
                            next[segmentIndex] = { ...next[segmentIndex], color: e.target.value };
                            setNarrativeEditorSegments(next);
                          }}
                        />
                        <TextField
                          label="Fuente"
                          size="small"
                          sx={{ minWidth: 160 }}
                          value={segment.fontFamily || ''}
                          onChange={(e) => {
                            const next = [...narrativeSegments];
                            next[segmentIndex] = {
                              ...next[segmentIndex],
                              ...(e.target.value.trim() ? { fontFamily: e.target.value } : { fontFamily: undefined }),
                            };
                            setNarrativeEditorSegments(next);
                          }}
                        />
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          startIcon={<DeleteIcon fontSize="small" />}
                          onClick={() => {
                            const next = narrativeSegments.filter((_, idx) => idx !== segmentIndex);
                            setNarrativeEditorSegments(next);
                          }}
                        >
                          Quitar
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </>
          ) : narrativeInspectorSection === 'segments' ? (
            <Typography variant="caption" color="text.secondary">
              Usa Editar por segmentos para mezclar estilos en una misma caja de texto.
            </Typography>
          ) : null}
        </Stack>
      );
      }

    case 'runShortcut':
      return (
        <TextField label="ID del atajo (shortcutId)" size="small" value={str('shortcutId')} onChange={(e) => setPayload('shortcutId', e.target.value)} />
      );

    case 'delay':
      return (
        <TextField label="Duración (ms)" type="number" size="small" sx={{ width: 180 }} value={num('durationMs', 1000)} inputProps={{ min: 0, max: 1800000 }} onChange={(e) => setPayload('durationMs', Number(e.target.value))} />
      );

    case 'runScene':
      return (
        <TextField label="ID de escena (sceneId)" size="small" value={str('sceneId')} onChange={(e) => setPayload('sceneId', e.target.value)} />
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
