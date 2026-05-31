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
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import type { SceneVideoAsset } from '../../../types/scenes';
import type { SoundSourceSelection } from '../../Map/SoundSourcePickerDialog';
import { ImageContextualMenu } from '../menus/ImageContextualMenu';
import { FilterContextualMenu } from '../menus/FilterContextualMenu';
import { MusicContextualMenu } from '../menus/MusicContextualMenu';
import { NarratorContextualMenu } from '../menus/NarratorContextualMenu';
import { NARRATIVE_TOOL_STYLE_PRESETS } from '../constants/narrativePresets';
import { toVideoDragPayload } from '../utils/sceneEditorUtils';
import type { LeftToolPanelMode } from '../hooks/useSceneDraft';

export type SceneContextualMenu = null | 'image' | 'music' | 'filter' | 'narrator';

interface SceneToolsPanelProps {
  campaignId?: string | null;
  actionsCount: number;
  maxActions: number;
  contextualMenu: SceneContextualMenu;
  setContextualMenu: React.Dispatch<React.SetStateAction<SceneContextualMenu>>;
  leftToolPanelMode: LeftToolPanelMode;
  setLeftToolPanelMode: React.Dispatch<React.SetStateAction<LeftToolPanelMode>>;
  onCreateNarrativeAction: (patch?: Record<string, unknown>) => void;
  onCreateImageAction: (image: { url: string; label: string }) => void;
  onCreateFilterAction: (filterType: string) => void;
  onCreateAudioAction: (selection: SoundSourceSelection) => void;
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
  campaignId,
  actionsCount,
  maxActions,
  contextualMenu,
  setContextualMenu,
  leftToolPanelMode,
  setLeftToolPanelMode,
  onCreateNarrativeAction,
  onCreateImageAction,
  onCreateFilterAction,
  onCreateAudioAction,
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
  const { t } = useTranslation();

  return (
    <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('scene_tools_title', 'Herramientas')}</Typography>

      <Stack spacing={0.8}>
        <Button
          size="small"
          variant={contextualMenu === null && leftToolPanelMode === 'media' ? 'contained' : 'outlined'}
          startIcon={<MovieCreationIcon />}
          onClick={() => {
            setLeftToolPanelMode('media');
            setContextualMenu(null);
          }}
        >
          {t('scene_tools_add_video', 'Añadir vídeo')}
        </Button>
        <Button
          size="small"
          variant={contextualMenu === 'image' ? 'contained' : 'outlined'}
          startIcon={<ImageIcon />}
          onClick={() => setContextualMenu((curr) => curr === 'image' ? null : 'image')}
        >
          {t('scene_tools_add_image', 'Añadir imagen')}
        </Button>
        <Button
          size="small"
          variant={contextualMenu === null && leftToolPanelMode === 'text' ? 'contained' : 'outlined'}
          startIcon={<TextFieldsIcon />}
          onClick={() => {
            setLeftToolPanelMode('text');
            setContextualMenu(null);
          }}
        >
          {t('scene_tools_add_text', 'Añadir texto')}
        </Button>
        <Button
          size="small"
          variant={contextualMenu === 'music' ? 'contained' : 'outlined'}
          startIcon={<MusicNoteIcon />}
          onClick={() => setContextualMenu((curr) => curr === 'music' ? null : 'music')}
        >
          {t('scene_tools_add_music', 'Añadir música')}
        </Button>
        <Button
          size="small"
          variant={contextualMenu === 'narrator' ? 'contained' : 'outlined'}
          startIcon={<RecordVoiceOverIcon />}
          onClick={() => setContextualMenu((curr) => curr === 'narrator' ? null : 'narrator')}
        >
          {t('scene_tools_add_narrator', 'Añadir narrador')}
        </Button>
        <Button
          size="small"
          variant={contextualMenu === 'filter' ? 'contained' : 'outlined'}
          startIcon={<FilterAltIcon />}
          onClick={() => setContextualMenu((curr) => curr === 'filter' ? null : 'filter')}
        >
          {t('scene_tools_add_filter', 'Añadir filtro')}
        </Button>

        {contextualMenu === 'image' && (
          <ImageContextualMenu
            campaignId={campaignId}
            onSelect={(image) => {
              if (actionsCount >= maxActions) return;
              onCreateImageAction(image);
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
        {contextualMenu === 'music' && campaignId ? (
          <MusicContextualMenu
            campaignId={campaignId}
            onSelect={(selection) => {
              if (actionsCount >= maxActions) return;
              onCreateAudioAction(selection);
              setContextualMenu(null);
            }}
            onClose={() => setContextualMenu(null)}
          />
        ) : null}
        {contextualMenu === 'narrator' ? (
          <NarratorContextualMenu
            onSelect={(patch) => {
              if (actionsCount >= maxActions) return;
              onCreateNarrativeAction(patch);
              setContextualMenu(null);
            }}
            onClose={() => setContextualMenu(null)}
          />
        ) : null}
      </Stack>

      {contextualMenu === null && (
        <>
          <Divider sx={{ my: 1 }} />

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
                    onClick={() => onCreateNarrativeAction({
                      ...preset.patch,
                      voiceTarget: 'none',
                      displayName: String(preset.label ?? 'Texto'),
                    })}
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
                                <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between" sx={{ minWidth: 0, width: '100%' }}>
                                  <Chip
                                    label={`${asset.name} (${Math.round(asset.size / (1024 * 1024))}MB)`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      minWidth: 0,
                                      flex: 1,
                                      justifyContent: 'flex-start',
                                      '& .MuiChip-label': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        display: 'block',
                                      },
                                    }}
                                    draggable
                                    onDragStart={(event) => {
                                      event.dataTransfer.setData('text/plain', toVideoDragPayload(asset.id));
                                      event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onClick={() => {
                                      onCreateActionByDroppingVideoAsset(asset.id);
                                    }}
                                  />
                                  <Stack direction="row" spacing={0.25} flexShrink={0}>
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
        </>
      )}
    </Paper>
  );
};
