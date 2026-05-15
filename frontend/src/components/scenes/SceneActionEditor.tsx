import React from 'react';
import {
  Button,
  Box,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
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

const WINDOW_TARGET_KINDS = ['main', 'projection', 'skyline', 'custom', 'instance'] as const;

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

  const setType = (newType: string) => {
    onChange({ ...action, type: newType, payload: {} });
  };

  const setDelay = (ms: number) => {
    onChange({ ...action, delay: isNaN(ms) ? 0 : ms });
  };

  const setTargetKind = (kind: string) => {
    onChange({ ...action, targetWindow: { ...(action.targetWindow ?? { kind: 'main' }), kind: kind as any } });
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

        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 24 }}>
              #{index}
            </Typography>

            {/* Action type */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
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
              sx={{ width: 130 }}
              value={action.delay ?? 0}
              inputProps={{ min: 0, max: 600000, step: 100 }}
              onChange={(e) => setDelay(Number(e.target.value))}
            />
          </Stack>

          {/* Window target picker — only for window-related actions */}
          {needsWindow && (
            <Stack direction="row" spacing={1} mb={1}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Ventana destino</InputLabel>
                <Select
                  value={action.targetWindow?.kind ?? 'main'}
                  label="Ventana destino"
                  onChange={(e) => setTargetKind(e.target.value)}
                >
                  {WINDOW_TARGET_KINDS.map((k) => (
                    <MenuItem key={k} value={k}>{k}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}

          <Divider sx={{ mb: 1 }} />

          {/* Dynamic payload fields per action type */}
          <PayloadFields
            type={action.type}
            payload={p}
            setPayload={setPayload}
            sceneVideoAssets={sceneVideoAssets}
            onRequestUploadVideo={onRequestUploadVideo}
          />
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
  sceneVideoAssets?: SceneVideoAsset[];
  onRequestUploadVideo?: () => void;
}

const PayloadFields: React.FC<PayloadFieldsProps> = ({
  type,
  payload,
  setPayload,
  sceneVideoAssets,
  onRequestUploadVideo,
}) => {
  const str = (key: string) => String(payload[key] ?? '');
  const num = (key: string, fallback = 0) => Number(payload[key] ?? fallback);
  const bool = (key: string) => Boolean(payload[key] ?? false);

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
        </Stack>
      );

    case 'sendVideoToWindow':
      return (
        <Stack spacing={1}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>Vídeo subido</InputLabel>
            <Select
              value={str('videoAssetId')}
              label="Vídeo subido"
              onChange={(e) => setPayload('videoAssetId', e.target.value)}
            >
              <MenuItem value="">(ninguno)</MenuItem>
              {(sceneVideoAssets ?? []).map((asset) => (
                <MenuItem key={asset.id} value={asset.id}>
                  {asset.name} ({Math.round(asset.size / (1024 * 1024))}MB)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="ID de vídeo subido (videoAssetId)" size="small" value={str('videoAssetId')} onChange={(e) => setPayload('videoAssetId', e.target.value)} />
          <TextField label="URL de vídeo" size="small" value={str('videoUrl')} onChange={(e) => setPayload('videoUrl', e.target.value)} />
          {onRequestUploadVideo ? (
            <Button variant="outlined" size="small" onClick={onRequestUploadVideo}>
              Subir nuevo vídeo
            </Button>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            Puedes usar videoAssetId (archivo subido) o URL directa.
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
          </Stack>
        </Stack>
      );

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
      return (
        <Stack spacing={1}>
          <TextField label="Texto narrativo" size="small" multiline rows={2} value={str('text')} onChange={(e) => setPayload('text', e.target.value)} />
          <Stack direction="row" spacing={1}>
            <TextField label="Título (opcional)" size="small" value={str('title')} onChange={(e) => setPayload('title', e.target.value)} />
            <TextField label="Duración (ms, 0=manual)" type="number" size="small" sx={{ width: 180 }} value={num('durationMs', 0)} inputProps={{ min: 0 }} onChange={(e) => setPayload('durationMs', Number(e.target.value))} />
          </Stack>
        </Stack>
      );

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
