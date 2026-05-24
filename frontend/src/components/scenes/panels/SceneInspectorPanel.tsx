import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SceneActionEditor from '../SceneActionEditor';
import type { SceneActionDto } from '../../../types/scenes';
import type { SceneVideoAsset } from '../../../types/scenes';

interface SceneInspectorPanelProps {
  actions: SceneActionDto[];
  selectedActionId: string | null;
  selectedActionIndex: number;
  selectedAction: SceneActionDto | null;
  narrativeCanvasEditActionId: string | null;
  dragOverActionId: string | null;
  setDragOverActionId: React.Dispatch<React.SetStateAction<string | null>>;
  onDragActionDrop: (targetActionId: string, data: string) => void;
  onSelectAction: (actionId: string) => void;
  onMoveSelectedAction: (direction: -1 | 1) => void;
  onRemoveSelectedAction: () => void;
  onMoveSelectedLayerToEdge: (edge: 'top' | 'bottom') => void;
  sceneVideoAssets: SceneVideoAsset[];
  onRequestUploadVideo: () => void;
  chromaPickActionId: string | null;
  onToggleSelectedChromaPick: () => void;
  onChangeSelectedAction: (updated: SceneActionDto) => void;
}

/**
 * Right inspector panel for layer list and selected action editing.
 */
export const SceneInspectorPanel: React.FC<SceneInspectorPanelProps> = ({
  actions,
  selectedActionId,
  selectedActionIndex,
  selectedAction,
  narrativeCanvasEditActionId,
  dragOverActionId,
  setDragOverActionId,
  onDragActionDrop,
  onSelectAction,
  onMoveSelectedAction,
  onRemoveSelectedAction,
  onMoveSelectedLayerToEdge,
  sceneVideoAssets,
  onRequestUploadVideo,
  chromaPickActionId,
  onToggleSelectedChromaPick,
  onChangeSelectedAction,
}) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        gridColumn: {
          xs: 'span 1',
          md: 'span 2',
          lg: 'span 1',
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        <Typography variant="subtitle2">Inspector y capas</Typography>
        <Stack direction="row" spacing={0.4} sx={{ flexWrap: 'wrap' }}>
          <Tooltip title="Subir">
            <span>
              <IconButton
                size="small"
                onClick={() => onMoveSelectedAction(-1)}
                disabled={selectedActionIndex <= 0}
                aria-label="Subir"
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Bajar">
            <span>
              <IconButton
                size="small"
                onClick={() => onMoveSelectedAction(1)}
                disabled={selectedActionIndex < 0 || selectedActionIndex >= actions.length - 1}
                aria-label="Bajar"
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Eliminar">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={onRemoveSelectedAction}
                disabled={selectedActionIndex < 0}
                aria-label="Eliminar"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Enviar al frente">
            <span>
              <IconButton
                size="small"
                onClick={() => onMoveSelectedLayerToEdge('top')}
                disabled={selectedActionIndex < 0 || selectedActionIndex === actions.length - 1}
                aria-label="Enviar al frente"
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Enviar al fondo">
            <span>
              <IconButton
                size="small"
                onClick={() => onMoveSelectedLayerToEdge('bottom')}
                disabled={selectedActionIndex <= 0}
                aria-label="Enviar al fondo"
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.1, maxHeight: 210, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary">
            Capas (arrastra para cambiar superposicion). Ultima = mas arriba.
          </Typography>
          {actions.map((action, index) => {
            const isSelected = selectedActionId === action.id;
            const targetKind = action.targetWindow?.kind ?? 'main';
            const payload = (action.payload ?? {}) as Record<string, unknown>;
            const isNarrative = action.type === 'setNarrativeText';
            const narrativeEditing = narrativeCanvasEditActionId === action.id;
            const narrativeHasRichText = isNarrative && (() => {
              const richTextDoc = payload.richTextDoc;
              if (!richTextDoc || typeof richTextDoc !== 'object' || Array.isArray(richTextDoc)) return false;
              const blocks = (richTextDoc as Record<string, unknown>).blocks;
              if (!Array.isArray(blocks)) return false;
              return blocks.some((block) => {
                if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
                const segments = (block as Record<string, unknown>).segments;
                return Array.isArray(segments) && segments.length > 0;
              });
            })();
            const narrativeHasStyle = isNarrative && [
              'fontFamily',
              'fontSizePx',
              'fontColor',
              'textAlign',
              'lineHeight',
              'fontWeight',
              'fontStyle',
              'textDecoration',
              'backgroundMode',
              'backgroundColor',
              'backgroundOpacity',
              'borderRadiusPx',
              'paddingPx',
            ].some((field) => payload[field] !== undefined && payload[field] !== null && payload[field] !== '');
            const narrativeHasVoice = isNarrative && Boolean(payload.voiceConfig && typeof payload.voiceConfig === 'object');
            return (
              <Paper
                key={action.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', action.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverActionId(action.id);
                }}
                onDragLeave={() => {
                  if (dragOverActionId === action.id) setDragOverActionId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedData = event.dataTransfer.getData('text/plain');
                  onDragActionDrop(action.id, draggedData);
                  setDragOverActionId(null);
                }}
                onClick={() => {
                  onSelectAction(action.id);
                }}
                sx={{
                  p: 0.9,
                  borderRadius: 1,
                  cursor: 'grab',
                  border: '1px solid',
                  borderColor: isSelected
                    ? 'primary.main'
                    : dragOverActionId === action.id
                      ? 'secondary.main'
                      : 'divider',
                  bgcolor: isSelected ? 'action.selected' : 'background.paper',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {index + 1}. {action.type}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      Ventana: {targetKind}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.4} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Chip size="small" label={`z${index + 1}`} />
                    {narrativeHasRichText ? <Chip size="small" color="info" variant="outlined" label="rich" /> : null}
                    {narrativeHasStyle ? <Chip size="small" color="secondary" variant="outlined" label="style" /> : null}
                    {narrativeHasVoice ? <Chip size="small" color="success" variant="outlined" label="voice" /> : null}
                    {narrativeEditing ? <Chip size="small" color="warning" label="editando" /> : null}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
          {actions.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No hay acciones creadas.
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', pr: 0.5 }}>
        {selectedAction ? (
          <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary">
              Editor de la capa seleccionada.
            </Typography>
            <DndContext>
              <SortableContext items={[selectedAction?.id ?? '']} strategy={verticalListSortingStrategy}>
                <SceneActionEditor
                  action={selectedAction}
                  index={selectedActionIndex + 1}
                  highlighted
                  sceneVideoAssets={sceneVideoAssets}
                  onRequestUploadVideo={onRequestUploadVideo}
                  onStartChromaColorPick={onToggleSelectedChromaPick}
                  isChromaColorPicking={chromaPickActionId === (selectedAction?.id ?? null)}
                  onChange={onChangeSelectedAction}
                  onRemove={onRemoveSelectedAction}
                />
              </SortableContext>
            </DndContext>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Selecciona un bloque en timeline o en la lista del inspector.
          </Typography>
        )}
      </Box>
    </Paper>
  );
};
