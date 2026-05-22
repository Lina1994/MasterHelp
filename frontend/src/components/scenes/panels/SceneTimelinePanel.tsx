import React from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import RepeatIcon from '@mui/icons-material/Repeat';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import SceneTimelineEditor from '../SceneTimelineEditor';
import type { SceneActionDto } from '../../../types/scenes';

interface SceneTimelinePanelProps {
  actions: SceneActionDto[];
  maxActions: number;
  selectedActionId: string | null;
  narrativeEditingActionId: string | null;
  currentTimeMs: number;
  isPreviewPlaying: boolean;
  isPreviewLooping: boolean;
  canSplitSelectedAction: boolean;
  canCreateDerivedClip: boolean;
  canJoinSelectedWithNext: boolean;
  derivingClipActionId: string | null;
  onGoToTimelineStart: () => void;
  onStepPreviewFrame: (direction: -1 | 1) => void;
  onSetPreviewPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  onGoToTimelineEnd: () => void;
  onSetPreviewLooping: React.Dispatch<React.SetStateAction<boolean>>;
  onSplitSelectedActionAtPlayhead: () => void;
  onCreateDerivedClipFromSelectedAction: () => void;
  onJoinSelectedWithNextAction: () => void;
  onDropVideoAsset: (event: React.DragEvent<HTMLDivElement>) => void;
  onSelectAction: (actionId: string) => void;
  onMoveActionInTime: (actionId: string, nextStartMs: number) => void;
  onChangeActionLayerOrder: (actionId: string, nextLayerOrder: number) => void;
  onChangeActionDuration: (actionId: string, nextDurationMs: number, nextStartMs?: number) => void;
  onDropAsset: (info: { assetId: string; trackKey: string; startMs: number; clientX: number; clientY: number }) => void;
  onSeekTimeMs: (timeMs: number) => void;
  loopEnabled: boolean;
  loopWindowStartMs: number | null;
  loopWindowEndMs: number | null;
  onSetLoopWindow: (nextStartMs: number, nextEndMs: number) => void;
}

/**
 * Timeline controls and editor panel for SceneFormDialog.
 */
export const SceneTimelinePanel: React.FC<SceneTimelinePanelProps> = ({
  actions,
  maxActions,
  selectedActionId,
  narrativeEditingActionId,
  currentTimeMs,
  isPreviewPlaying,
  isPreviewLooping,
  canSplitSelectedAction,
  canCreateDerivedClip,
  canJoinSelectedWithNext,
  derivingClipActionId,
  onGoToTimelineStart,
  onStepPreviewFrame,
  onSetPreviewPlaying,
  onGoToTimelineEnd,
  onSetPreviewLooping,
  onSplitSelectedActionAtPlayhead,
  onCreateDerivedClipFromSelectedAction,
  onJoinSelectedWithNextAction,
  onDropVideoAsset,
  onSelectAction,
  onMoveActionInTime,
  onChangeActionLayerOrder,
  onChangeActionDuration,
  onDropAsset,
  onSeekTimeMs,
  loopEnabled,
  loopWindowStartMs,
  loopWindowEndMs,
  onSetLoopWindow,
}) => {
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="subtitle2">
            Timeline principal ({actions.length}/{maxActions})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click para scrub | Espacio play/pause | Flechas frame a frame.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ flexWrap: 'wrap', rowGap: 0.5, width: '100%' }}>
          <Tooltip title="Ir al inicio">
            <span>
              <IconButton size="small" onClick={onGoToTimelineStart} aria-label="Ir al inicio">
                <FirstPageIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Frame anterior">
            <span>
              <IconButton size="small" onClick={() => onStepPreviewFrame(-1)} aria-label="Frame anterior">
                <SkipPreviousIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={isPreviewPlaying ? 'Pausar' : 'Reproducir'}>
            <span>
              <IconButton
                size="small"
                color={isPreviewPlaying ? 'primary' : 'default'}
                onClick={() => onSetPreviewPlaying((playing) => !playing)}
                aria-label={isPreviewPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPreviewPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Frame siguiente">
            <span>
              <IconButton size="small" onClick={() => onStepPreviewFrame(1)} aria-label="Frame siguiente">
                <SkipNextIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Ir al final">
            <span>
              <IconButton size="small" onClick={onGoToTimelineEnd} aria-label="Ir al final">
                <LastPageIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={isPreviewLooping ? 'Loop ON' : 'Loop OFF'}>
            <span>
              <IconButton
                size="small"
                color={isPreviewLooping ? 'primary' : 'default'}
                onClick={() => onSetPreviewLooping((looping) => !looping)}
                aria-label={isPreviewLooping ? 'Desactivar loop' : 'Activar loop'}
              >
                <RepeatIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Cortar clip en playhead">
            <span>
              <IconButton
                size="small"
                onClick={onSplitSelectedActionAtPlayhead}
                disabled={!canSplitSelectedAction}
                aria-label="Cortar clip"
              >
                <ContentCutIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ flexWrap: 'wrap', rowGap: 0.5, width: '100%' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<MovieCreationIcon fontSize="small" />}
            onClick={onCreateDerivedClipFromSelectedAction}
            disabled={!canCreateDerivedClip}
          >
            {derivingClipActionId === selectedActionId ? 'Renderizando clip…' : 'Renderizar clip derivado'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CallMergeIcon fontSize="small" />}
            onClick={onJoinSelectedWithNextAction}
            disabled={!canJoinSelectedWithNext}
          >
            Unir siguiente
          </Button>
        </Stack>
      </Stack>
      <Box onDragOver={(event) => event.preventDefault()} onDrop={onDropVideoAsset}>
        <SceneTimelineEditor
          actions={actions}
          selectedActionId={selectedActionId}
          narrativeEditingActionId={narrativeEditingActionId}
          onSelectAction={onSelectAction}
          onMoveActionInTime={onMoveActionInTime}
          onChangeActionLayerOrder={onChangeActionLayerOrder}
          onChangeActionDuration={onChangeActionDuration}
          onDropAsset={onDropAsset}
          currentTimeMs={currentTimeMs}
          onSeekTimeMs={onSeekTimeMs}
          loopEnabled={loopEnabled}
          loopWindowStartMs={loopWindowStartMs}
          loopWindowEndMs={loopWindowEndMs}
          onSetLoopWindow={onSetLoopWindow}
        />
      </Box>
    </Box>
  );
};
