import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { SceneVideoAsset } from '../../../types/scenes';
import { ImageContextualMenu } from '../menus/ImageContextualMenu';
import { TextContextualMenu } from '../menus/TextContextualMenu';
import { FilterContextualMenu } from '../menus/FilterContextualMenu';
import { NARRATIVE_TOOL_STYLE_PRESETS } from '../constants/narrativePresets';
import { toVideoDragPayload } from '../utils/sceneEditorUtils';
import type { LeftToolPanelMode } from '../hooks/useSceneDraft';

export type SceneContextualMenu = null | 'image' | 'music' | 'text' | 'filter';

interface SceneToolsPanelProps {
  actionsCount: number;
  maxActions: number;
  contextualMenu: SceneContextualMenu;
  setContextualMenu: React.Dispatch<React.SetStateAction<SceneContextualMenu>>;
  leftToolPanelMode: LeftToolPanelMode;
  setLeftToolPanelMode: React.Dispatch<React.SetStateAction<LeftToolPanelMode>>;
  onCreateNarrativeAction: (patch?: Record<string, unknown>) => void;
  onCreateImageAction: (image: { url: string; label: string }) => void;
  onCreateFilterAction: (filterType: string) => void;
  loadingAssets: boolean;
  uploadingVideo: boolean;
  sceneVideoAssets: SceneVideoAsset[];
  videoLibraryQuery: string;
  setVideoLibraryQuery: React.Dispatch<React.SetStateAction<string>>;
  filteredSceneVideoAssets: SceneVideoAsset[];
  renamingVideoId: string | null;
  renamingVideoName: string;
  setRenamingVideoName: React.Dispatch<React.SetStateAction<string>>;
  renamingVideoSubmitting: boolean;
  deletingVideoId: string | null;
  onUploadVideoClick: () => void;
  onStartRenameVideo: (asset: SceneVideoAsset) => void;
  onDeleteVideoAsset: (asset: SceneVideoAsset) => void;
  onConfirmRenameVideo: (assetId: string) => void;
  onCancelRenameVideo: () => void;
  onCreateActionByDroppingVideoAsset: (assetId: string) => void;
}

/**
 * Left tools panel of SceneFormDialog (media/text actions and video library).
 */
export const SceneToolsPanel: React.FC<SceneToolsPanelProps> = ({
  actionsCount,
  maxActions,
  contextualMenu,
  setContextualMenu,
  leftToolPanelMode,
  setLeftToolPanelMode,
  onCreateNarrativeAction,
  onCreateImageAction,
  onCreateFilterAction,
  loadingAssets,
  uploadingVideo,
  sceneVideoAssets,
  videoLibraryQuery,
  setVideoLibraryQuery,
  filteredSceneVideoAssets,
  renamingVideoId,
  renamingVideoName,
  setRenamingVideoName,
  renamingVideoSubmitting,
  deletingVideoId,
  onUploadVideoClick,
  onStartRenameVideo,
  onDeleteVideoAsset,
  onConfirmRenameVideo,
  onCancelRenameVideo,
  onCreateActionByDroppingVideoAsset,
}) => {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Herramientas</Typography>

      <Stack spacing={0.8}>
        <Button
          size="small"
          variant="contained"
          startIcon={<MovieCreationIcon />}
          onClick={() => setLeftToolPanelMode('media')}
        >
          Anadir video
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ImageIcon />}
          onClick={() => setContextualMenu('image')}
        >
          Anadir imagen
        </Button>
        <Button
          size="small"
          variant={leftToolPanelMode === 'text' ? 'contained' : 'outlined'}
          startIcon={<TextFieldsIcon />}
          onClick={() => setContextualMenu('text')}
        >
          Anadir texto
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<MusicNoteIcon />}
          onClick={() => setContextualMenu('music')}
        >
          Anadir musica
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FilterAltIcon />}
          onClick={() => setContextualMenu('filter')}
        >
          Anadir filtro
        </Button>

        {contextualMenu === 'image' && (
          <ImageContextualMenu
            onSelect={(image) => {
              if (actionsCount >= maxActions) return;
              onCreateImageAction(image);
              setContextualMenu(null);
            }}
            onClose={() => setContextualMenu(null)}
          />
        )}
        {contextualMenu === 'text' && (
          <TextContextualMenu
            onSelect={(type) => {
              if (actionsCount >= maxActions) return;
              const preset = NARRATIVE_TOOL_STYLE_PRESETS.find((p) => p.id === type.style || p.patch.stylePresetId === type.style);
              onCreateNarrativeAction(preset?.patch);
              setContextualMenu(null);
            }}
            onClose={() => setContextualMenu(null)}
          />
        )}
        {contextualMenu === 'filter' && (
          <FilterContextualMenu
            onSelect={(filter) => {
              if (actionsCount >= maxActions) return;
              onCreateFilterAction(String(filter.type));
              setContextualMenu(null);
            }}
            onClose={() => setContextualMenu(null)}
          />
        )}
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
        <Button
          size="small"
          variant={leftToolPanelMode === 'media' ? 'contained' : 'outlined'}
          onClick={() => setLeftToolPanelMode('media')}
        >
          Media
        </Button>
        <Button
          size="small"
          variant={leftToolPanelMode === 'text' ? 'contained' : 'outlined'}
          onClick={() => setLeftToolPanelMode('text')}
        >
          Texto
        </Button>
      </Stack>

      <Stack spacing={1} sx={{ minHeight: 0, flex: 1 }}>
        {leftToolPanelMode === 'text' ? (
          <Stack spacing={0.8} sx={{ minHeight: 0, overflowY: 'auto', pr: 0.4 }}>
            <Typography variant="subtitle2">Estilos de texto</Typography>
            <Typography variant="caption" color="text.secondary">
              Elige un estilo para crear texto y escribir directamente en el previsualizador.
            </Typography>
            {NARRATIVE_TOOL_STYLE_PRESETS.map((preset) => (
              <Paper
                key={preset.id}
                variant="outlined"
                sx={{ p: 0.9, cursor: 'pointer', borderColor: 'divider' }}
                onClick={() => onCreateNarrativeAction(preset.patch)}
              >
                <Stack spacing={0.5}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {preset.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {preset.subtitle}
                  </Typography>
                  <Box
                    sx={{
                      borderRadius: 1,
                      px: 0.8,
                      py: 0.55,
                      bgcolor: 'rgba(15, 18, 28, 0.5)',
                      border: '1px solid rgba(148, 163, 184, 0.24)',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#f6f7fb',
                        fontFamily: String(preset.patch.fontFamily ?? 'Merriweather'),
                        fontSize: Math.max(12, Number(preset.patch.fontSizePx ?? 20) * 0.48),
                        fontWeight: String(preset.patch.fontWeight ?? 'normal') === 'bold' ? 700 : 400,
                        textAlign: String(preset.patch.textAlign ?? 'left') as 'left' | 'center' | 'right' | 'justify',
                        display: 'block',
                      }}
                    >
                      {String(preset.patch.title ?? '') || 'Texto de ejemplo'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Libreria de videos</Typography>
              <Button
                size="small"
                startIcon={<UploadIcon />}
                onClick={onUploadVideoClick}
                disabled={uploadingVideo}
              >
                {uploadingVideo ? 'Subiendo…' : 'Subir'}
              </Button>
            </Stack>

            {loadingAssets ? (
              <Typography variant="caption" color="text.secondary">Cargando videos…</Typography>
            ) : sceneVideoAssets.length === 0 ? (
              <Alert severity="info">No hay videos subidos todavia.</Alert>
            ) : (
              <Stack spacing={0.8} sx={{ minHeight: 0 }}>
                <TextField
                  size="small"
                  placeholder="Buscar por nombre o archivo..."
                  value={videoLibraryQuery}
                  onChange={(event) => setVideoLibraryQuery(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                {filteredSceneVideoAssets.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    No hay resultados para la busqueda actual.
                  </Typography>
                ) : (
                  <Stack spacing={0.7} sx={{ overflowY: 'auto', overflowX: 'hidden', pr: 0.5, minWidth: 0 }}>
                    {filteredSceneVideoAssets.map((asset) => {
                      const isRenaming = renamingVideoId === asset.id;
                      return (
                        <Paper key={asset.id} variant="outlined" sx={{ p: 0.75, minWidth: 0, overflow: 'hidden' }}>
                          <Stack spacing={0.6}>
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                              <Chip
                                label={`${asset.name} (${Math.round(asset.size / (1024 * 1024))}MB)`}
                                size="small"
                                variant="outlined"
                                sx={{ maxWidth: '100%' }}
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.setData('text/plain', toVideoDragPayload(asset.id));
                                  event.dataTransfer.effectAllowed = 'copy';
                                }}
                                onClick={() => {
                                  onCreateActionByDroppingVideoAsset(asset.id);
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => onStartRenameVideo(asset)}
                                aria-label="Renombrar video"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => onDeleteVideoAsset(asset)}
                                disabled={deletingVideoId === asset.id}
                                aria-label="Eliminar video"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>

                            {isRenaming ? (
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <TextField
                                  size="small"
                                  value={renamingVideoName}
                                  onChange={(event) => setRenamingVideoName(event.target.value)}
                                  sx={{ flex: 1 }}
                                />
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => onConfirmRenameVideo(asset.id)}
                                  disabled={renamingVideoSubmitting}
                                >
                                  Guardar
                                </Button>
                                <Button size="small" onClick={onCancelRenameVideo}>
                                  Cancelar
                                </Button>
                              </Stack>
                            ) : null}

                            <Typography variant="caption" color="text.secondary">
                              Archivo: {asset.originalFilename}
                            </Typography>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
};
