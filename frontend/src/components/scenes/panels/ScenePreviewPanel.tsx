import React from 'react';
import { Box, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import type { WindowSize } from '../../../hooks/useSecondaryWindowSizes';
import type { ScenePreviewWindowKind } from '../utils/sceneLayerUtils';

interface ScenePreviewPanelProps {
  effectivePreviewLoopMode: 'full' | 'partial';
  hasValidLoopWindow: boolean;
  onChangePreviewLoopMode: (mode: 'full' | 'partial') => void;
  isPreviewMemoryWarmupEnabled: boolean;
  onTogglePreviewMemoryWarmup: () => void;
  warmedActionCount: number;
  targetedActionCount: number;
  currentTimelineTimeMs: number;
  previewFps: number;
  activeEntryLabel: string;
  derivingClipErrorLabel?: string | null;
  previewWindowKind: ScenePreviewWindowKind;
  onChangePreviewWindowKind: (kind: ScenePreviewWindowKind) => void;
  previewZoom: number;
  onChangePreviewZoom: (zoom: number) => void;
  onDropVideoAsset: (event: React.DragEvent<HTMLDivElement>) => void;
  previewWindowSize: WindowSize;
  previewScale: number;
  previewStageRef: React.RefObject<HTMLDivElement | null>;
  previewBaseContent: React.ReactNode;
  previewGuideOverlay?: React.ReactNode;
  previewLayersContent: React.ReactNode;
  formatPreviewClock: (valueMs: number) => string;
}

/**
 * Central preview panel in SceneFormDialog.
 */
export const ScenePreviewPanel: React.FC<ScenePreviewPanelProps> = ({
  effectivePreviewLoopMode,
  hasValidLoopWindow,
  onChangePreviewLoopMode,
  isPreviewMemoryWarmupEnabled,
  onTogglePreviewMemoryWarmup,
  warmedActionCount,
  targetedActionCount,
  currentTimelineTimeMs,
  previewFps,
  activeEntryLabel,
  derivingClipErrorLabel,
  previewWindowKind,
  onChangePreviewWindowKind,
  previewZoom,
  onChangePreviewZoom,
  onDropVideoAsset,
  previewWindowSize,
  previewScale,
  previewStageRef,
  previewBaseContent,
  previewGuideOverlay,
  previewLayersContent,
  formatPreviewClock,
}) => {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2">Previsualizador</Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 162 }}>
            <InputLabel>Modo loop preview</InputLabel>
            <Select
              label="Modo loop preview"
              value={effectivePreviewLoopMode}
              onChange={(event) => onChangePreviewLoopMode(event.target.value as 'full' | 'partial')}
            >
              <MenuItem value="full">Loop completo</MenuItem>
              <MenuItem value="partial" disabled={!hasValidLoopWindow}>Loop parcial</MenuItem>
            </Select>
          </FormControl>
          <Chip
            size="small"
            clickable
            color={isPreviewMemoryWarmupEnabled ? 'success' : 'default'}
            variant={isPreviewMemoryWarmupEnabled ? 'filled' : 'outlined'}
            label={isPreviewMemoryWarmupEnabled
              ? `Preload memoria ON (${warmedActionCount}/${targetedActionCount})`
              : 'Preload memoria OFF'}
            onClick={onTogglePreviewMemoryWarmup}
          />
          <Chip size="small" label={`${formatPreviewClock(currentTimelineTimeMs)} @ ${previewFps}fps`} />
          <Chip size="small" variant="outlined" label={activeEntryLabel} />
          {derivingClipErrorLabel ? (
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label={derivingClipErrorLabel}
            />
          ) : null}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Vista previa</InputLabel>
            <Select
              label="Vista previa"
              value={previewWindowKind}
              onChange={(event) => onChangePreviewWindowKind(event.target.value as ScenePreviewWindowKind)}
            >
              <MenuItem value="main">Principal</MenuItem>
              <MenuItem value="projection">Mapas</MenuItem>
              <MenuItem value="skyline">Skyline</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Escala</InputLabel>
            <Select
              label="Escala"
              value={String(previewZoom)}
              onChange={(event) => onChangePreviewZoom(Number(event.target.value))}
            >
              <MenuItem value="0.18">18%</MenuItem>
              <MenuItem value="0.22">22%</MenuItem>
              <MenuItem value="0.25">25%</MenuItem>
              <MenuItem value="0.3">30%</MenuItem>
              <MenuItem value="0.35">35%</MenuItem>
              <MenuItem value="0.4">40%</MenuItem>
              <MenuItem value="0.45">45%</MenuItem>
              <MenuItem value="0.5">50%</MenuItem>
              <MenuItem value="0.55">55%</MenuItem>
              <MenuItem value="0.6">60%</MenuItem>
              <MenuItem value="0.65">65%</MenuItem>
              <MenuItem value="0.7">70%</MenuItem>
              <MenuItem value="0.75">75%</MenuItem>
              <MenuItem value="0.8">80%</MenuItem>
              <MenuItem value="0.85">85%</MenuItem>
              <MenuItem value="0.9">90%</MenuItem>
              <MenuItem value="0.95">95%</MenuItem>
              <MenuItem value="1">100%</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>
      <Box
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDropVideoAsset}
        sx={{
          borderRadius: 1,
          bgcolor: '#0f1116',
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 280,
          maxHeight: 460,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            width: Math.max(1, Math.round(previewWindowSize.width * previewScale)),
            height: Math.max(1, Math.round(previewWindowSize.height * previewScale)),
            overflow: 'visible',
          }}
        >
          <Box
            ref={previewStageRef}
            sx={{
              position: 'relative',
              width: previewWindowSize.width,
              height: previewWindowSize.height,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
              overflow: 'visible',
              background: 'linear-gradient(180deg, rgba(4, 5, 9, 0.08) 0%, rgba(4, 5, 9, 0.22) 100%)',
            }}
          >
            <Box sx={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              {previewBaseContent}
            </Box>

            {previewGuideOverlay}

            {previewLayersContent}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};
