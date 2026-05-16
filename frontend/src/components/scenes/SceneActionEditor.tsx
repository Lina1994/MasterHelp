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
  sceneVideoAssets?: SceneVideoAsset[];
  onRequestUploadVideo?: () => void;
  onStartChromaColorPick?: () => void;
  isChromaColorPicking?: boolean;
}

const PayloadFields: React.FC<PayloadFieldsProps> = ({
  type,
  payload,
  setPayload,
  sceneVideoAssets,
  onRequestUploadVideo,
  onStartChromaColorPick,
  isChromaColorPicking,
}) => {
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
