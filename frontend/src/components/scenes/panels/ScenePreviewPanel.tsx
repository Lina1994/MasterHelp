import React, { useEffect, useRef } from 'react';
import { Box, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import type { WindowSize } from '../../../hooks/useSecondaryWindowSizes';
import type { ScenePreviewWindowKind } from '../utils/sceneLayerUtils';

const PREVIEW_SCALE_OPTIONS = [
  0.3,
  0.35,
  0.4,
  0.45,
  0.5,
  0.55,
  0.6,
  0.65,
  0.7,
  0.75,
  0.8,
  0.85,
  0.9,
  0.95,
  1,
] as const;

function pickBestAutoScale(rawFitScale: number): number {
  const clamped = Math.max(0.3, Math.min(1, rawFitScale));
  let best = 0.3;
  for (const option of PREVIEW_SCALE_OPTIONS) {
    if (option <= clamped) {
      best = option;
    }
  }
  return best;
}

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
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const hasAppliedInitialAutoScaleRef = useRef(false);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const applyInitialAutoScale = () => {
      if (hasAppliedInitialAutoScaleRef.current) return;
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const styles = window.getComputedStyle(viewport);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const availableWidth = Math.max(1, rect.width - (Number.isFinite(horizontalPadding) ? horizontalPadding : 0));
      const availableHeight = Math.max(1, rect.height - (Number.isFinite(verticalPadding) ? verticalPadding : 0));
      const fitByWidth = availableWidth / Math.max(1, previewWindowSize.width);
      const fitByHeight = availableHeight / Math.max(1, previewWindowSize.height);
      const bestScale = pickBestAutoScale(Math.min(fitByWidth, fitByHeight));

      hasAppliedInitialAutoScaleRef.current = true;
      if (Math.abs(previewZoom - bestScale) > 0.0001) {
        onChangePreviewZoom(bestScale);
      }
    };

    applyInitialAutoScale();

    const resizeObserver = new ResizeObserver(() => {
      applyInitialAutoScale();
    });
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, [onChangePreviewZoom, previewWindowSize.height, previewWindowSize.width, previewZoom]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        minHeight: 0,
        flex: 1,
      }}
    >
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
        ref={previewViewportRef}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDropVideoAsset}
        sx={{
          borderRadius: 1,
          bgcolor: '#0f1116',
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 280,
          flex: 1,
          minWidth: 0,
          p: 1.5,
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
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
            flex: '0 0 auto',
          }}
        >
          <Box
            ref={previewStageRef}
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
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
