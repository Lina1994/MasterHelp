import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  MenuItem,
  Popover,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { GridSettings } from './MapGridOverlay';
import type { TokenEditMode } from './MapTokensOverlay';
import type { FogMode } from '../../api/campaigns/fogOfWar';
import type { OrganicFogTool } from './OrganicFogEditorLayer';
import type { ElementEditorTool } from './MapElementsEditorLayer';
import type { MapElement, MapLightElement } from '../../api/mapElements';
import MapElementsPanel from './MapElementsPanel';

type ToolGroup = 'move' | 'grid' | 'fog' | 'tokens' | 'markers' | 'elements';

export type TokenCandidate = {
  id: string;
  label: string;
  type: 'ally' | 'enemy';
};

export type ProjectedMapMirrorToolsProps = {
  // --- Move/transform ---
  canMoveScenario: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRotatePlus90: () => void;
  onRotateMinus90: () => void;
  onResetTransform: () => void;

  // --- Grid ---
  gridSettings: GridSettings;
  onSaveGrid: (next: Partial<GridSettings>) => void;

  // --- Fog ---
  fogEnabled: boolean;
  fogEditEnabled: boolean;
  onSetFogEditEnabled: (v: boolean) => void;
  /** Which fog system is active: grid (classic) or organic (brush-based). */
  fogMode: FogMode;
  onSetFogMode: (v: FogMode) => void;
  // Grid fog controls
  fogTool: 'paint' | 'erase';
  onSetFogTool: (v: 'paint' | 'erase') => void;
  /** Visual-only fog shading in the master preview (does not affect players). */
  fogPreviewColor: string;
  onSetFogPreviewColor: (v: string) => void;
  /** 0..1 */
  fogPreviewOpacity: number;
  onSetFogPreviewOpacity: (v: number) => void;
  allyClearRadius: number;
  onSetAllyClearRadius: (v: number) => void;
  canFogFillAll: boolean;
  onFogFillAll: () => void;
  onFogClearAll: () => void;
  // Organic fog controls
  organicFogTool: OrganicFogTool;
  onSetOrganicFogTool: (v: OrganicFogTool) => void;
  organicBrushRadius: number;
  onSetOrganicBrushRadius: (v: number) => void;
  onOrganicFogClearAll: () => void;
  onOrganicFogFillAll: () => void;

  // --- Tokens ---
  tokenMode: TokenEditMode;
  onSetTokenMode: (v: TokenEditMode) => void;

  /** Optional helpers to auto-create tokens for encounter participants (Combat preview only). */
  onPrepareTokens?: (which: 'allies' | 'foes' | 'all') => void;

  /** Optional handler to clear all tokens from the map. */
  onClearAllTokens?: () => void;

  /** Optional lists to create tokens individually (Combat preview only). */
  tokenCandidates?: {
    allies: TokenCandidate[];
    foes: TokenCandidate[];
  };
  /** Token ids already present on the map (to disable duplicate creation). */
  existingTokenIds?: Set<string>;
  /** Create a token for a given candidate. */
  onCreateTokenForCandidate?: (candidate: TokenCandidate) => void;

  // --- Markers ---
  showMarkers: boolean;
  onToggleMarkers: (v: boolean) => void;
  addMarkerMode?: boolean;
  onToggleAddMarkerMode?: (v: boolean) => void;

  // --- Elements (walls, doors, windows, lights) ---
  elementsEditEnabled: boolean;
  onSetElementsEditEnabled: (v: boolean) => void;
  elementTool: ElementEditorTool;
  onSetElementTool: (v: ElementEditorTool) => void;
  elements: MapElement[];
  selectedElement: MapElement | null;
  onSelectElement: (el: MapElement | null) => void;
  onUpdateElement: (id: string, patch: Partial<MapElement>) => void;
  onRemoveElement: (id: string) => void;
  onClearAllElements: () => void;
  newLightRadius: number;
  onSetNewLightRadius: (v: number) => void;
  /** Toggle a light on/off from the preview toolbar. */
  previewLights: MapLightElement[];
  onToggleLight: (id: string) => void;
};

/**
 * ProjectedMapMirrorTools
 *
 * Compact toolbar for the "Vista previa (Ventana de jugadores)" panel.
 * Renders 4 grouped actions and shows their controls in a floating Popover
 * so the layout is not displaced.
 */
const ProjectedMapMirrorTools: React.FC<ProjectedMapMirrorToolsProps> = (props) => {
  const [openGroup, setOpenGroup] = useState<ToolGroup | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const title = useMemo((): string => {
    switch (openGroup) {
      case 'move': return 'Mover escenario';
      case 'grid': return 'Cuadrícula';
      case 'fog': return 'Niebla';
      case 'tokens': return 'Tokens';
      case 'markers': return 'Marcadores';
      case 'elements': return 'Elementos del mapa';
      default: return '';
    }
  }, [openGroup]);

  const open = Boolean(openGroup && anchorEl);

  const onOpen = (group: ToolGroup) => (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    setOpenGroup(group);
  };

  const onClose = () => {
    setOpenGroup(null);
    setAnchorEl(null);
  };

  const panelSx = { p: 1.5, minWidth: 280, maxWidth: 420 } as const;

  /** Human-readable label for the active token editing sub-mode. */
  const tokenModeLabel = useMemo((): string | null => {
    switch (props.tokenMode) {
      case 'ally': return 'Añadir aliado';
      case 'enemy': return 'Añadir enemigo';
      case 'rotate': return 'Rotar';
      case 'erase': return 'Borrar';
      default: return null;
    }
  }, [props.tokenMode]);

  /** Whether each tool group is considered "active" (has persistent effect beyond the popover). */
  const gridActive = props.gridSettings.enabled;
  const fogActive = props.fogEditEnabled;
  const tokensActive = props.tokenMode !== 'none';
  const markersActive = props.showMarkers;
  const elementsActive = props.elementsEditEnabled;

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Button size="small" variant="outlined" onClick={onOpen('move')} disabled={!props.canMoveScenario}>
          Mover escenario
        </Button>
        <Button size="small" variant={gridActive ? 'contained' : 'outlined'} onClick={onOpen('grid')}>
          Cuadrícula{gridActive ? ` ✓` : ''}
        </Button>
        <Button
          size="small"
          variant={fogActive ? 'contained' : 'outlined'}
          onClick={onOpen('fog')}
        >
          Niebla{fogActive ? ` · ${props.fogMode === 'organic'
            ? (props.organicFogTool === 'reveal' ? 'Revelar' : 'Cubrir')
            : (props.fogTool === 'paint' ? 'Pintar' : 'Borrar')}` : ''}
        </Button>
        <Button
          size="small"
          variant={tokensActive ? 'contained' : 'outlined'}
          onClick={onOpen('tokens')}
        >
          Tokens{tokenModeLabel ? ` · ${tokenModeLabel}` : ''}
        </Button>
        <Button size="small" variant={markersActive ? 'contained' : 'outlined'} onClick={onOpen('markers')}>
          Marcadores{markersActive ? ` ✓` : ''}
        </Button>
        <Button size="small" variant={elementsActive ? 'contained' : 'outlined'} onClick={onOpen('elements')}>
          Elementos{elementsActive ? ` ✓` : ''}
        </Button>
      </Stack>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableRestoreFocus
      >
        <Box sx={panelSx}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
          <Divider sx={{ mb: 1 }} />

          {openGroup === 'move' && (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button size="small" onClick={props.onZoomIn}>Zoom +</Button>
                <Button size="small" onClick={props.onZoomOut}>Zoom -</Button>
                <Button size="small" onClick={props.onMoveLeft}>←</Button>
                <Button size="small" onClick={props.onMoveRight}>→</Button>
                <Button size="small" onClick={props.onMoveUp}>↑</Button>
                <Button size="small" onClick={props.onMoveDown}>↓</Button>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button size="small" onClick={props.onRotatePlus90}>Rotar +90°</Button>
                <Button size="small" onClick={props.onRotateMinus90}>Rotar -90°</Button>
                <Button size="small" onClick={props.onResetTransform}>Reset</Button>
              </Stack>
            </Stack>
          )}

          {openGroup === 'grid' && (
            <Stack spacing={1}>
              <FormControlLabel
                control={<Switch checked={props.gridSettings.enabled} onChange={(e) => props.onSaveGrid({ enabled: e.target.checked })} />}
                label="Cuadrícula"
              />
              <TextField
                select
                size="small"
                label="Tipo"
                value={props.gridSettings.type}
                onChange={(e) => props.onSaveGrid({ type: e.target.value as any })}
              >
                <MenuItem value="square">Cuadrados</MenuItem>
                <MenuItem value="hex">Hexágonos</MenuItem>
              </TextField>
              <TextField
                size="small"
                type="number"
                label="Tamaño"
                value={props.gridSettings.cellSize}
                inputProps={{ min: 6, step: 2 }}
                onChange={(e) => props.onSaveGrid({ cellSize: Math.max(6, Number(e.target.value || 0)) })}
              />
              <TextField
                size="small"
                type="color"
                label="Color"
                value={props.gridSettings.color}
                onChange={(e) => props.onSaveGrid({ color: e.target.value })}
              />
              <TextField
                size="small"
                type="number"
                label="Opacidad"
                value={props.gridSettings.opacity}
                inputProps={{ min: 0, max: 1, step: 0.05 }}
                onChange={(e) => props.onSaveGrid({ opacity: Math.max(0, Math.min(1, Number(e.target.value || 0))) })}
              />
              <TextField
                size="small"
                type="number"
                label="Grosor"
                value={props.gridSettings.lineWidth}
                inputProps={{ min: 0.25, max: 4, step: 0.25 }}
                onChange={(e) => props.onSaveGrid({ lineWidth: Math.max(0.25, Math.min(4, Number(e.target.value || 0))) })}
              />
            </Stack>
          )}

          {openGroup === 'fog' && (
            <Stack spacing={1}>
              <FormControlLabel
                control={<Switch checked={props.fogEnabled} disabled />}
                label="Niebla (controlada en Combate)"
              />

              <TextField
                select
                size="small"
                label="Sistema de niebla"
                value={props.fogMode}
                onChange={(e) => props.onSetFogMode(e.target.value as FogMode)}
              >
                <MenuItem value="grid">Cuadrícula (clásico)</MenuItem>
                <MenuItem value="organic">Orgánica (pincel)</MenuItem>
              </TextField>

              <Divider />
              <Typography variant="body2" color="text.secondary">
                Apariencia (solo vista previa del master)
              </Typography>
              <TextField
                size="small"
                type="color"
                label="Color"
                value={props.fogPreviewColor}
                onChange={(e) => props.onSetFogPreviewColor(e.target.value)}
              />
              <TextField
                size="small"
                type="number"
                label="Opacidad"
                value={props.fogPreviewOpacity}
                inputProps={{ min: 0, max: 1, step: 0.05 }}
                onChange={(e) => props.onSetFogPreviewOpacity(Math.max(0, Math.min(1, Number(e.target.value || 0))))}
              />

              {props.fogEnabled ? (
                <>
                  <FormControlLabel
                    control={<Switch checked={props.fogEditEnabled} onChange={(e) => props.onSetFogEditEnabled(e.target.checked)} />}
                    label="Editar niebla"
                  />

                  {props.fogMode === 'grid' ? (
                    <>
                      <TextField
                        select
                        size="small"
                        label="Herramienta"
                        value={props.fogTool}
                        onChange={(e) => props.onSetFogTool((e.target.value as any) || 'paint')}
                      >
                        <MenuItem value="paint">Pintar</MenuItem>
                        <MenuItem value="erase">Borrar</MenuItem>
                      </TextField>
                      <TextField
                        size="small"
                        type="number"
                        label="Radio aliados"
                        value={props.allyClearRadius}
                        inputProps={{ min: 0, max: 10, step: 1 }}
                        onChange={(e) => props.onSetAllyClearRadius(Math.max(0, Math.min(10, Number(e.target.value || 0))))}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={props.onFogFillAll} disabled={!props.canFogFillAll}>
                          Poner todo
                        </Button>
                        <Button size="small" onClick={props.onFogClearAll}>
                          Borrar todo
                        </Button>
                      </Stack>
                    </>
                  ) : (
                    <>
                      <TextField
                        select
                        size="small"
                        label="Herramienta"
                        value={props.organicFogTool}
                        onChange={(e) => props.onSetOrganicFogTool((e.target.value as OrganicFogTool) || 'reveal')}
                      >
                        <MenuItem value="reveal">Revelar</MenuItem>
                        <MenuItem value="fog">Cubrir</MenuItem>
                      </TextField>
                      <TextField
                        size="small"
                        type="number"
                        label="Radio del pincel (px)"
                        value={props.organicBrushRadius}
                        inputProps={{ min: 5, max: 300, step: 5 }}
                        onChange={(e) => props.onSetOrganicBrushRadius(Math.max(5, Math.min(300, Number(e.target.value || 20))))}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Radio aliados"
                        value={props.allyClearRadius}
                        inputProps={{ min: 0, max: 10, step: 1 }}
                        onChange={(e) => props.onSetAllyClearRadius(Math.max(0, Math.min(10, Number(e.target.value || 0))))}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={props.onOrganicFogFillAll}>
                          Cubrir todo
                        </Button>
                        <Button size="small" onClick={props.onOrganicFogClearAll}>
                          Revelar todo
                        </Button>
                      </Stack>
                    </>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Activa la niebla desde la cabecera de Combate para editarla aquí.
                </Typography>
              )}
            </Stack>
          )}

          {openGroup === 'markers' && (
            <Stack spacing={1}>
              <FormControlLabel
                control={<Switch checked={props.showMarkers} onChange={(e) => props.onToggleMarkers(e.target.checked)} />}
                label="Mostrar marcadores del mapa"
              />
              {props.onToggleAddMarkerMode && (
                <Button
                  size="small"
                  variant={props.addMarkerMode ? 'contained' : 'outlined'}
                  onClick={() => {
                    props.onToggleAddMarkerMode!(!props.addMarkerMode);
                    if (!props.addMarkerMode) onClose();
                  }}
                >
                  {props.addMarkerMode ? 'Cancelar colocación' : 'Añadir marcador'}
                </Button>
              )}
            </Stack>
          )}

          {openGroup === 'tokens' && (
            <Stack spacing={1}>
              {props.onPrepareTokens && (
                <>
                  <Typography variant="body2" color="text.secondary">Preparar tokens</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="outlined" onClick={() => props.onPrepareTokens?.('allies')}>Aliados</Button>
                    <Button size="small" variant="outlined" onClick={() => props.onPrepareTokens?.('foes')}>Enemigos</Button>
                    <Button size="small" variant="outlined" onClick={() => props.onPrepareTokens?.('all')}>Todos</Button>
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                </>
              )}

              {props.tokenCandidates && props.onCreateTokenForCandidate && (
                <>
                  <Typography variant="body2" color="text.secondary">Añadir individual</Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Aliados</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        {props.tokenCandidates.allies.map((c) => (
                          <Button
                            key={c.id}
                            size="small"
                            variant="outlined"
                            disabled={props.existingTokenIds?.has(c.id)}
                            onClick={() => props.onCreateTokenForCandidate?.(c)}
                            title={c.label}
                          >
                            {c.label}
                          </Button>
                        ))}
                        {props.tokenCandidates.allies.length === 0 && (
                          <Typography variant="body2" color="text.secondary">(sin aliados)</Typography>
                        )}
                      </Stack>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="text.secondary">Enemigos</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        {props.tokenCandidates.foes.map((c) => (
                          <Button
                            key={c.id}
                            size="small"
                            variant="outlined"
                            disabled={props.existingTokenIds?.has(c.id)}
                            onClick={() => props.onCreateTokenForCandidate?.(c)}
                            title={c.label}
                          >
                            {c.label}
                          </Button>
                        ))}
                        {props.tokenCandidates.foes.length === 0 && (
                          <Typography variant="body2" color="text.secondary">(sin enemigos)</Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                </>
              )}

              <TextField
                select
                size="small"
                label="Modo"
                value={props.tokenMode}
                onChange={(e) => props.onSetTokenMode((e.target.value as TokenEditMode) || 'none')}
              >
                <MenuItem value="none">Ver/arrastrar/rotar</MenuItem>
                <MenuItem value="ally">Añadir aliado</MenuItem>
                <MenuItem value="enemy">Añadir enemigo</MenuItem>
                <MenuItem value="rotate">Rotar token</MenuItem>
                <MenuItem value="erase">Borrar token</MenuItem>
              </TextField>

              {props.onClearAllTokens && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={props.onClearAllTokens}
                    fullWidth
                  >
                    Limpiar todos
                  </Button>
                </>
              )}
            </Stack>
          )}

          {openGroup === 'elements' && (
            <MapElementsPanel
              elementsEditEnabled={props.elementsEditEnabled}
              onSetElementsEditEnabled={props.onSetElementsEditEnabled}
              elementTool={props.elementTool}
              onSetElementTool={props.onSetElementTool}
              elements={props.elements}
              selectedElement={props.selectedElement}
              onSelectElement={props.onSelectElement}
              onUpdateElement={props.onUpdateElement}
              onRemoveElement={props.onRemoveElement}
              onClearAllElements={props.onClearAllElements}
              newLightRadius={props.newLightRadius}
              onSetNewLightRadius={props.onSetNewLightRadius}
              previewLights={props.previewLights}
              onToggleLight={props.onToggleLight}
            />
          )}
        </Box>
      </Popover>
    </>
  );
};

export default ProjectedMapMirrorTools;
