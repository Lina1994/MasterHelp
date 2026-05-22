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

export type NarrativeSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSizePx?: number;
  color?: string;
  fontFamily?: string;
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
  setPayloadPatch: (patch: Record<string, unknown>) => void;
  getNarrativeEditorSegments: () => NarrativeSegment[];
  setNarrativeEditorSegments: (nextSegments: NarrativeSegment[]) => void;
};

export const NarrativePayloadRenderer: React.FC<NarrativePayloadRendererProps> = ({
  str,
  num,
  setPayload,
  setPayloadPatch,
  getNarrativeEditorSegments,
  setNarrativeEditorSegments,
}) => {
  const [narrativeTab, setNarrativeTab] = React.useState<'content' | 'style' | 'position'>('content');
  const [showSegmentEditor, setShowSegmentEditor] = React.useState<boolean>(false);
  const [showCustomFontInput, setShowCustomFontInput] = React.useState<boolean>(false);

  const currentSegments = getNarrativeEditorSegments();
  const availableFonts = NARRATIVE_FONT_OPTIONS;
  const selectedFont = str('fontFamily') || 'Merriweather';
  const hasCuratedFont = availableFonts.includes(selectedFont as any);

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
              <TextField
                label="Duracion (ms)"
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
                    if (confirm('¿Volver a texto plano? Perderas los formatos individuales de color/tamano de cada palabra.')) {
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
    </Stack>
  );
};
