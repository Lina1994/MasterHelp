import React, { useEffect, useRef, useState } from 'react';
import { alpha } from '@mui/material/styles';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { SceneActionDto } from '../../../types/scenes';
import type { WindowSize } from '../../../hooks/useSecondaryWindowSizes';
import ChromaKeyMedia from '../../common/ChromaKeyMedia';
import type { LeftToolPanelMode, NarrativeCanvasDraft } from '../hooks/useSceneDraft';
import {
  buildWindowFilterBackdropStyle,
  getChromaFromPayload,
  getNarrativeSegments,
  getPlacementFromPayload,
  normalizeFreePlacement,
  normalizeOpacity,
} from '../utils/sceneLayerUtils';
import {
  applyOscillation,
  buildTransformCss,
  getMotionPathFromPayload,
  getOscillationFromPayload,
  getTransformFromPayload,
  interpolateMotionPath,
} from '../utils/motionPathUtils';
import { resolveSceneMediaUrl, toNonNegativeMs, toNonNegativeSec } from '../utils/sceneEditorUtils';

export type TimelineEntryRange = {
  startMs: number;
  endMs: number;
};

interface ScenePreviewLayersRendererProps {
  draftActions: SceneActionDto[];
  previewRenderableActions: SceneActionDto[];
  previewWindowKind: 'main' | 'projection' | 'skyline';
  selectedActionId: string | null;
  lockPreviewInteractionToSelectedNarrative: boolean;
  chromaPickActionId: string | null;
  setChromaPickActionId: (next: string | null) => void;
  selectActionAndSeekToStart: (actionId: string) => void;
  startLayerDrag: (action: SceneActionDto, mode: 'move' | 'resize', event: React.MouseEvent<HTMLElement>) => void;
  startMotionKeyframeDrag: (actionId: string, keyframeIndex: number, event: React.MouseEvent<HTMLElement>) => void;
  addMotionKeyframeAtPreview: (actionId: string, leftPct: number, topPct: number) => void;
  removeMotionKeyframeAtPreview: (actionId: string, keyframeIndex: number) => void;
  toggleMotionKeyframeFlipAtPreview: (actionId: string, keyframeIndex: number, axis: 'h' | 'v') => void;
  updateMotionKeyframeHoldAtPreview: (actionId: string, keyframeIndex: number, holdMs: number) => void;
  toggleMotionKeyframeOscillationPauseAtPreview: (actionId: string, keyframeIndex: number) => void;
  propagateMotionKeyframeFlipFromPreview: (actionId: string, keyframeIndex: number, axis: 'h' | 'v') => void;
  updateActionById: (actionId: string, updater: (currentAction: SceneActionDto) => SceneActionDto) => void;
  previewMediaUrlsByActionId: Record<string, string>;
  videoPreviewErrorsByActionId: Record<string, string | undefined>;
  timelineEntriesByActionId: Map<string, TimelineEntryRange>;
  currentTimelineTimeMs: number;
  previewLoopWindow: { startMs: number; endMs: number } | null;
  previewLoopCycleIndex: number;
  isPreviewPlaying: boolean;
  previewSeekVersion: number;
  narrativeCanvasEditActionId: string | null;
  narrativeCanvasDraft: NarrativeCanvasDraft | null;
  setNarrativeCanvasDraft: React.Dispatch<React.SetStateAction<NarrativeCanvasDraft | null>>;
  leftToolPanelMode: LeftToolPanelMode;
  beginNarrativeCanvasEdit: (action: SceneActionDto) => void;
  finishNarrativeCanvasEdit: (mode: 'save' | 'cancel') => void;
  previewWindowSize: WindowSize;
  previewScale: number;
  isSelectionModifierPressed: boolean;
}

/**
 * Renders active scene layers inside the preview stage.
 *
 * @param props Layer render inputs and callbacks bridged from SceneFormDialog.
 * @returns Layer nodes for the current preview window and timeline cursor.
 */
export const ScenePreviewLayersRenderer: React.FC<ScenePreviewLayersRendererProps> = ({
  draftActions,
  previewRenderableActions,
  previewWindowKind,
  selectedActionId,
  lockPreviewInteractionToSelectedNarrative,
  chromaPickActionId,
  setChromaPickActionId,
  selectActionAndSeekToStart,
  startLayerDrag,
  startMotionKeyframeDrag,
  addMotionKeyframeAtPreview,
  removeMotionKeyframeAtPreview,
  toggleMotionKeyframeFlipAtPreview,
  updateMotionKeyframeHoldAtPreview,
  toggleMotionKeyframeOscillationPauseAtPreview,
  propagateMotionKeyframeFlipFromPreview,
  updateActionById,
  previewMediaUrlsByActionId,
  videoPreviewErrorsByActionId,
  timelineEntriesByActionId,
  currentTimelineTimeMs,
  previewLoopWindow,
  previewLoopCycleIndex,
  isPreviewPlaying,
  previewSeekVersion,
  narrativeCanvasEditActionId,
  narrativeCanvasDraft,
  setNarrativeCanvasDraft,
  leftToolPanelMode,
  beginNarrativeCanvasEdit,
  finishNarrativeCanvasEdit,
  previewWindowSize,
  previewScale,
  isSelectionModifierPressed,
}) => {
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number | null>(null);
  const flipClickTimersRef = useRef<{ h: number | null; v: number | null }>({ h: null, v: null });
  const keyframeOpenedOnMouseDownRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (flipClickTimersRef.current.h !== null) {
        window.clearTimeout(flipClickTimersRef.current.h);
      }
      if (flipClickTimersRef.current.v !== null) {
        window.clearTimeout(flipClickTimersRef.current.v);
      }
    };
  }, []);

  useEffect(() => {
    setSelectedKeyframeIndex(null);
  }, [selectedActionId]);

  const canSwitchSelection = (
    event: React.MouseEvent<HTMLElement>,
    isSelected: boolean,
  ): boolean => {
    if (isSelected) return true;
    if (!selectedActionId) return true;
    return event.ctrlKey || event.metaKey || isSelectionModifierPressed;
  };

  const canCapturePointer = (isSelected: boolean): boolean => {
    if (isSelected) return true;
    if (!selectedActionId) return true;
    return isSelectionModifierPressed;
  };

  if (previewRenderableActions.length === 0) {
    return (
      <Stack sx={{ width: '100%', height: '100%' }} alignItems="center" justifyContent="center">
        <Typography variant="body2" color="text.secondary">
          No hay capas para la ventana {previewWindowKind}.
        </Typography>
      </Stack>
    );
  }

  const selectedAction = selectedActionId
    ? previewRenderableActions.find((action) => action.id === selectedActionId)
    : undefined;
  const selectedPayload = (selectedAction?.payload ?? {}) as Record<string, unknown>;
  const selectedMotionPath = selectedAction ? getMotionPathFromPayload(selectedPayload) : [];
  const selectedPathOrigin = selectedAction
    ? selectedAction.type === 'setNarrativeText'
      ? (() => {
        const placement = getPlacementFromPayload(selectedPayload);
        return { leftPct: placement.leftPct, topPct: placement.topPct };
      })()
      : {
        leftPct: normalizeFreePlacement(selectedPayload.leftPct, 10),
        topPct: normalizeFreePlacement(selectedPayload.topPct, 10),
      }
    : { leftPct: 10, topPct: 10 };
  const selectedPathPoints = selectedMotionPath.length > 0
    ? [{ leftPct: selectedPathOrigin.leftPct, topPct: selectedPathOrigin.topPct }, ...selectedMotionPath]
    : [];
  const selectedCanEditMotion = Boolean(
    selectedAction
    && (
      selectedAction.type === 'sendImageToWindow'
      || selectedAction.type === 'sendVideoToWindow'
      || selectedAction.type === 'setNarrativeText'
    ),
  );

  const handlePathDoubleClick = (event: React.MouseEvent<SVGPolylineElement>) => {
    if (!selectedAction || !selectedCanEditMotion) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const leftPct = ((event.clientX - rect.left) / rect.width) * 100;
    const topPct = ((event.clientY - rect.top) / rect.height) * 100;
    addMotionKeyframeAtPreview(
      selectedAction.id,
      Math.max(-200, Math.min(200, leftPct)),
      Math.max(-200, Math.min(200, topPct)),
    );
    setSelectedKeyframeIndex(selectedMotionPath.length);
  };

  const handleFlipButtonClick = (axis: 'h' | 'v') => {
    if (!selectedAction || selectedKeyframeIndex === null) return;
    const timerId = flipClickTimersRef.current[axis];
    if (timerId !== null) {
      window.clearTimeout(timerId);
      flipClickTimersRef.current[axis] = null;
      propagateMotionKeyframeFlipFromPreview(selectedAction.id, selectedKeyframeIndex, axis);
      return;
    }

    flipClickTimersRef.current[axis] = window.setTimeout(() => {
      flipClickTimersRef.current[axis] = null;
      toggleMotionKeyframeFlipAtPreview(selectedAction.id, selectedKeyframeIndex, axis);
    }, 220);
  };

  return (
    <>
      {selectedPathPoints.length > 1 ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            {selectedCanEditMotion ? (
              <polyline
                points={selectedPathPoints.map((point) => `${point.leftPct},${point.topPct}`).join(' ')}
                fill="none"
                stroke="rgba(0,0,0,0)"
                strokeWidth="4"
                style={{ pointerEvents: 'stroke', cursor: 'copy' }}
                onDoubleClick={handlePathDoubleClick}
              />
            ) : null}
            <polyline
              points={selectedPathPoints.map((point) => `${point.leftPct},${point.topPct}`).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="0.35"
              strokeDasharray="1.2 1"
            />
            {selectedPathPoints.map((point, index) => (
              <circle
                key={`motion-path-kf-${index}`}
                cx={point.leftPct}
                cy={point.topPct}
                r={index === 0 ? 0.9 : 0.7}
                fill={index === 0 ? 'rgba(0,191,255,0.95)' : 'rgba(255,255,255,0.95)'}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth="0.25"
              />
            ))}
          </svg>
          {selectedCanEditMotion
            ? selectedMotionPath.map((keyframe, index) => (
              <Box
                key={`motion-path-handle-${index}`}
                sx={{
                  position: 'absolute',
                  left: `${keyframe.leftPct}%`,
                  top: `${keyframe.topPct}%`,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '1px solid rgba(0,0,0,0.45)',
                  bgcolor: 'rgba(255,255,255,0.98)',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.35)',
                  cursor: 'grab',
                  pointerEvents: 'auto',
                  zIndex: 10000,
                  outline: selectedKeyframeIndex === index
                    ? '2px solid rgba(255, 215, 64, 0.95)'
                    : 'none',
                }}
                title={`Arrastra para mover. Click derecho para eliminar${keyframe.pauseOscillationDuringHold ? ' | Oscilación congelada durante pausa' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.button !== 0) return;
                  if (!selectedAction) return;
                  if (selectedKeyframeIndex === index) {
                    keyframeOpenedOnMouseDownRef.current = null;
                    return;
                  }
                  keyframeOpenedOnMouseDownRef.current = index;
                  setSelectedKeyframeIndex(index);
                  startMotionKeyframeDrag(selectedAction.id, index, event);
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (keyframeOpenedOnMouseDownRef.current === index) {
                    keyframeOpenedOnMouseDownRef.current = null;
                    setSelectedKeyframeIndex(index);
                    return;
                  }
                  setSelectedKeyframeIndex((current) => (current === index ? null : index));
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!selectedAction) return;
                  removeMotionKeyframeAtPreview(selectedAction.id, index);
                  setSelectedKeyframeIndex((current) => {
                    if (current === null) return current;
                    if (current === index) return null;
                    return current > index ? current - 1 : current;
                  });
                }}
              >
                {keyframe.pauseOscillationDuringHold ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      right: -4,
                      top: -4,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: 'rgba(17, 24, 39, 0.95)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.35rem',
                      fontWeight: 800,
                      color: '#fff',
                      lineHeight: 1,
                      pointerEvents: 'none',
                    }}
                    aria-hidden="true"
                  >
                    ||
                  </Box>
                ) : null}
              </Box>
            ))
            : null}

          {selectedCanEditMotion && selectedAction && selectedKeyframeIndex !== null && selectedMotionPath[selectedKeyframeIndex] ? (
            <Box
              sx={{
                position: 'absolute',
                left: `${selectedMotionPath[selectedKeyframeIndex].leftPct}%`,
                top: `${selectedMotionPath[selectedKeyframeIndex].topPct}%`,
                transform: `translate(-50%, -155%) scale(${1 / Math.max(0.01, previewScale)})`,
                transformOrigin: 'center bottom',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: 'rgba(14, 18, 28, 0.9)',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 1,
                px: 0.5,
                py: 0.35,
                pointerEvents: 'auto',
                zIndex: 10010,
              }}
            >
              <Tooltip title="Pausa en este punto (ms) antes de seguir al siguiente.">
                <TextField
                  size="small"
                  type="number"
                  value={Math.max(0, Number(selectedMotionPath[selectedKeyframeIndex].holdMs ?? 0))}
                  inputProps={{ min: 0, max: 60000, step: 100 }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    updateMotionKeyframeHoldAtPreview(
                      selectedAction.id,
                      selectedKeyframeIndex,
                      Number.isFinite(next) ? Math.max(0, next) : 0,
                    );
                  }}
                  sx={{
                    width: 82,
                    '& .MuiInputBase-input': {
                      fontSize: '0.68rem',
                      px: 0.75,
                      py: 0.5,
                    },
                  }}
                />
              </Tooltip>
              <Tooltip title="Si está activo, durante la pausa de este punto también se congela la oscilación secundaria.">
                <Button
                  size="small"
                  variant={selectedMotionPath[selectedKeyframeIndex].pauseOscillationDuringHold ? 'contained' : 'outlined'}
                  sx={{ minWidth: 62, height: 24, px: 0.8, fontSize: '0.62rem', lineHeight: 1, fontWeight: 700 }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleMotionKeyframeOscillationPauseAtPreview(selectedAction.id, selectedKeyframeIndex);
                  }}
                >
                  Osc ⏸
                </Button>
              </Tooltip>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, lineHeight: 1 }}>
                Flip
              </Typography>
              <Tooltip title="Click: alterna Flip H en este punto. Doble click: aplica desde este punto en adelante.">
                <Button
                  size="small"
                  variant={selectedMotionPath[selectedKeyframeIndex].flipH ? 'contained' : 'outlined'}
                  sx={{ minWidth: 44, height: 24, px: 0.8, fontSize: '0.7rem', lineHeight: 1, fontWeight: 700 }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleFlipButtonClick('h');
                  }}
                >
                  H
                </Button>
              </Tooltip>
              <Tooltip title="Click: alterna Flip V en este punto. Doble click: aplica desde este punto en adelante.">
                <Button
                  size="small"
                  variant={selectedMotionPath[selectedKeyframeIndex].flipV ? 'contained' : 'outlined'}
                  sx={{ minWidth: 44, height: 24, px: 0.8, fontSize: '0.7rem', lineHeight: 1, fontWeight: 700 }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleFlipButtonClick('v');
                  }}
                >
                  V
                </Button>
              </Tooltip>
            </Box>
          ) : null}
        </Box>
      ) : null}
      {previewRenderableActions
        .slice()
        .sort((left, right) => {
          const leftOrder = Number((left.payload ?? {}).layerOrder);
          const rightOrder = Number((right.payload ?? {}).layerOrder);
          const a = Number.isFinite(leftOrder) ? leftOrder : 0;
          const b = Number.isFinite(rightOrder) ? rightOrder : 0;
          if (a !== b) return a - b;
          const leftIndex = draftActions.findIndex((item) => item.id === left.id);
          const rightIndex = draftActions.findIndex((item) => item.id === right.id);
          return leftIndex - rightIndex;
        })
        .map((action, layerIndex) => {
          const payload = action.payload ?? {};
          const payloadRecord = payload as Record<string, unknown>;
          const opacity = normalizeOpacity((payload as Record<string, unknown>).opacity);
          const leftPct = normalizeFreePlacement((payload as Record<string, unknown>).leftPct, 10);
          const topPct = normalizeFreePlacement((payload as Record<string, unknown>).topPct, 10);
          const widthPct = Math.max(1, normalizeFreePlacement((payload as Record<string, unknown>).widthPct, 80));
          const heightPct = Math.max(1, normalizeFreePlacement((payload as Record<string, unknown>).heightPct, 80));
          const selected = action.id === selectedActionId;
          const key = `${action.id}-${layerIndex}`;
          const payloadLayerOrder = Number((payload as Record<string, unknown>).layerOrder);
          const zIndex = Number.isFinite(payloadLayerOrder) ? Math.round(payloadLayerOrder) : layerIndex + 1;
          const motionPath = getMotionPathFromPayload(payloadRecord);
          const oscillation = getOscillationFromPayload(payloadRecord);
          const staticTransform = getTransformFromPayload(payloadRecord);
          const timelineEntry = timelineEntriesByActionId.get(action.id);
          const elapsedMs = timelineEntry ? Math.max(0, currentTimelineTimeMs - timelineEntry.startMs) : 0;
          const motionState = motionPath.length > 0
            ? interpolateMotionPath(
              { leftPct, topPct },
              motionPath,
              elapsedMs,
              {
                rotation: staticTransform.rotation,
                flipH: staticTransform.flipH,
                flipV: staticTransform.flipV,
              },
              {
                defaultPauseOscillationDuringHold: Boolean(oscillation?.pauseDuringMotionHold),
              },
            )
            : {
              leftPct,
              topPct,
              rotation: staticTransform.rotation,
              flipH: staticTransform.flipH,
              flipV: staticTransform.flipV,
              oscillationElapsedMs: elapsedMs,
            };
          const oscillatedPlacement = applyOscillation(
            { leftPct: motionState.leftPct, topPct: motionState.topPct },
            oscillation,
            Math.max(0, Number(motionState.oscillationElapsedMs ?? elapsedMs)),
          );
          const animatedLeftPct = oscillatedPlacement.leftPct;
          const animatedTopPct = oscillatedPlacement.topPct;
          const transformCss = buildTransformCss(motionState.rotation, motionState.flipH, motionState.flipV);

          if (action.type === 'setWindowBackground') {
            const imageUrl = String(payload.imageUrl ?? '').trim();
            if (!imageUrl) return null;
            const sizing = String(payload.sizing ?? 'cover');
            return (
              <Box
                key={key}
                component="img"
                src={resolveSceneMediaUrl(imageUrl)}
                alt="Layer background"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: sizing === 'contain' ? 'contain' : sizing === 'stretch' ? 'fill' : 'cover',
                  opacity,
                  zIndex,
                  border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                  pointerEvents: 'none',
                }}
              />
            );
          }

          if (action.type === 'sendImageToWindow') {
            const imageUrl = String(payload.imageUrl ?? '').trim();
            if (!imageUrl) return null;
            const chroma = getChromaFromPayload(payload as Record<string, unknown>);
            const canCaptureThisLayer = canCapturePointer(selected);
            return (
              <Box
                key={key}
                sx={{
                  position: 'absolute',
                  left: `${animatedLeftPct}%`,
                  top: `${animatedTopPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  transform: transformCss,
                  transformOrigin: 'center center',
                  zIndex,
                  border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                  pointerEvents: lockPreviewInteractionToSelectedNarrative && !selected
                    ? 'none'
                    : canCaptureThisLayer ? 'auto' : 'none',
                  cursor: !selected
                    ? (canCaptureThisLayer ? 'pointer' : 'default')
                    : selected && chromaPickActionId !== action.id ? 'move' : 'default',
                }}
                onMouseDown={(event) => {
                  if (lockPreviewInteractionToSelectedNarrative && !selected) return;
                  if (chromaPickActionId === action.id) return;
                  if (!selected) {
                    if (!canSwitchSelection(event, selected)) {
                      event.preventDefault();
                      return;
                    }
                    selectActionAndSeekToStart(action.id);
                    return;
                  }
                  startLayerDrag(action, 'move', event);
                }}
              >
                <ChromaKeyMedia
                  kind="image"
                  src={resolveSceneMediaUrl(imageUrl)}
                  opacity={opacity}
                  chromaKey={chroma}
                  pickColorEnabled={selected && chromaPickActionId === action.id}
                  onPickColor={(hexColor) => {
                    updateActionById(action.id, (currentAction) => ({
                      ...currentAction,
                      payload: {
                        ...(currentAction.payload ?? {}),
                        chromaKey: {
                          ...getChromaFromPayload(currentAction.payload ?? {}),
                          enabled: true,
                          color: hexColor,
                        },
                      },
                    }));
                    setChromaPickActionId(null);
                  }}
                  onMediaError={() => {
                    setChromaPickActionId(null);
                  }}
                />
                {selected ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      right: -8,
                      bottom: -8,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      border: '2px solid #fff',
                      cursor: 'nwse-resize',
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={(event) => {
                      if (chromaPickActionId === action.id) return;
                      startLayerDrag(action, 'resize', event);
                    }}
                  />
                ) : null}
              </Box>
            );
          }

          if (action.type === 'sendVideoToWindow') {
            const videoUrl = previewMediaUrlsByActionId[action.id] ?? '';
            const videoError = videoPreviewErrorsByActionId[action.id];
            const chroma = getChromaFromPayload(payloadRecord);
            const loopSegmentEnabled = Boolean(payloadRecord.loopSegmentEnabled);
            const loopSegmentStartMs = toNonNegativeMs(payloadRecord.loopSegmentStartMs);
            const loopSegmentEndMs = toNonNegativeMs(payloadRecord.loopSegmentEndMs);
            const clipInSec = toNonNegativeSec(payloadRecord.clipInSec) ?? 0;
            const clipOutSec = toNonNegativeSec(payloadRecord.clipOutSec);
            const hasLoopSegment = loopSegmentEnabled
              && loopSegmentStartMs !== undefined
              && (loopSegmentEndMs === undefined || loopSegmentEndMs > loopSegmentStartMs);
            const timelineEntry = timelineEntriesByActionId.get(action.id);
            const mediaTimeSec = timelineEntry
              ? Math.max(clipInSec, clipInSec + ((currentTimelineTimeMs - timelineEntry.startMs) / 1000))
              : 0;
            const hasScenePartialLoop = Boolean(previewLoopWindow && previewLoopCycleIndex > 0);
            const actionStartsBeforeLoopWindow = Boolean(previewLoopWindow && timelineEntry && timelineEntry.startMs < previewLoopWindow.startMs);
            const sceneLoopStartOffsetSec = (previewLoopWindow && timelineEntry)
              ? Math.max(0, (previewLoopWindow.startMs - timelineEntry.startMs) / 1000)
              : undefined;
            const sceneStartAtSec = hasScenePartialLoop && actionStartsBeforeLoopWindow
              ? sceneLoopStartOffsetSec
              : undefined;

            const startAtSec = sceneStartAtSec !== undefined
              ? Math.max(clipInSec, sceneStartAtSec)
              : clipInSec;

            const loopSegmentStartSec = hasLoopSegment ? Number(loopSegmentStartMs) / 1000 : undefined;
            const loopSegmentEndSec = hasLoopSegment && loopSegmentEndMs !== undefined ? Number(loopSegmentEndMs) / 1000 : undefined;
            const effectiveLoopRangeStartSec = loopSegmentStartSec !== undefined
              ? Math.max(clipInSec, loopSegmentStartSec)
              : (clipInSec > 0 ? clipInSec : undefined);
            const effectiveLoopRangeEndSec = (() => {
              if (loopSegmentEndSec !== undefined && clipOutSec !== undefined) {
                return Math.min(loopSegmentEndSec, clipOutSec);
              }
              if (loopSegmentEndSec !== undefined) {
                return loopSegmentEndSec;
              }
              if (clipOutSec !== undefined) {
                return clipOutSec;
              }
              return undefined;
            })();
            const canCaptureThisLayer = canCapturePointer(selected);
            if (videoError) {
              return (
                <Box key={key} sx={{ position: 'absolute', inset: 0, p: 2 }}>
                  <Typography variant="caption" color="error">
                    {videoError}
                  </Typography>
                </Box>
              );
            }
            if (!videoUrl) return null;
            return (
              <Box
                key={key}
                sx={{
                  position: 'absolute',
                  left: `${animatedLeftPct}%`,
                  top: `${animatedTopPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  transform: transformCss,
                  transformOrigin: 'center center',
                  zIndex,
                  border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                  pointerEvents: lockPreviewInteractionToSelectedNarrative && !selected
                    ? 'none'
                    : canCaptureThisLayer ? 'auto' : 'none',
                  cursor: !selected
                    ? (canCaptureThisLayer ? 'pointer' : 'default')
                    : selected && chromaPickActionId !== action.id ? 'move' : 'default',
                }}
                onMouseDown={(event) => {
                  if (lockPreviewInteractionToSelectedNarrative && !selected) return;
                  if (chromaPickActionId === action.id) return;
                  if (!selected) {
                    if (!canSwitchSelection(event, selected)) {
                      event.preventDefault();
                      return;
                    }
                    selectActionAndSeekToStart(action.id);
                    return;
                  }
                  startLayerDrag(action, 'move', event);
                }}
              >
                <ChromaKeyMedia
                  kind="video"
                  src={videoUrl}
                  autoPlay
                  muted
                  loop
                  opacity={opacity}
                  chromaKey={chroma}
                  isPlaying={isPreviewPlaying}
                  seekTimeSec={mediaTimeSec}
                  seekVersion={previewSeekVersion}
                  startAtSec={startAtSec}
                  loopRangeStartSec={effectiveLoopRangeStartSec}
                  loopRangeEndSec={effectiveLoopRangeEndSec}
                  pickColorEnabled={selected && chromaPickActionId === action.id}
                  onPickColor={(hexColor) => {
                    updateActionById(action.id, (currentAction) => ({
                      ...currentAction,
                      payload: {
                        ...(currentAction.payload ?? {}),
                        chromaKey: {
                          ...getChromaFromPayload(currentAction.payload ?? {}),
                          enabled: true,
                          color: hexColor,
                        },
                      },
                    }));
                    setChromaPickActionId(null);
                  }}
                  onMediaError={() => {
                    setChromaPickActionId(null);
                  }}
                />
                {selected ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      right: -8,
                      bottom: -8,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      border: '2px solid #fff',
                      cursor: 'nwse-resize',
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={(event) => {
                      if (chromaPickActionId === action.id) return;
                      startLayerDrag(action, 'resize', event);
                    }}
                  />
                ) : null}
              </Box>
            );
          }

          if (action.type === 'applyWindowFilter') {
            const filter = String(payload.filter ?? '').trim();
            if (!filter) return null;
            const intensity = Number(payload.intensity ?? 1);
            const color = typeof payload.color === 'string' ? payload.color : undefined;
            return (
              <Box
                key={key}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  ...buildWindowFilterBackdropStyle(filter, Number.isFinite(intensity) ? intensity : 1, color),
                  opacity,
                  zIndex,
                  border: selected ? '2px solid rgba(255,255,255,0.8)' : 'none',
                  pointerEvents: 'none',
                }}
              />
            );
          }

          if (action.type === 'setNarrativeText') {
            const placement = getPlacementFromPayload(payload);
            const narrativeMotionState = motionPath.length > 0
              ? interpolateMotionPath(
                { leftPct: placement.leftPct, topPct: placement.topPct },
                motionPath,
                elapsedMs,
                {
                  rotation: staticTransform.rotation,
                  flipH: staticTransform.flipH,
                  flipV: staticTransform.flipV,
                },
                {
                  defaultPauseOscillationDuringHold: Boolean(oscillation?.pauseDuringMotionHold),
                },
              )
              : {
                leftPct: placement.leftPct,
                topPct: placement.topPct,
                rotation: staticTransform.rotation,
                flipH: staticTransform.flipH,
                flipV: staticTransform.flipV,
                oscillationElapsedMs: elapsedMs,
              };
            const narrativeOscillatedPlacement = applyOscillation(
              { leftPct: narrativeMotionState.leftPct, topPct: narrativeMotionState.topPct },
              oscillation,
              Math.max(0, Number(narrativeMotionState.oscillationElapsedMs ?? elapsedMs)),
            );
            const narrativeTransformCss = buildTransformCss(
              narrativeMotionState.rotation,
              narrativeMotionState.flipH,
              narrativeMotionState.flipV,
            );
            const title = String(payload.title ?? '').trim();
            const segments = getNarrativeSegments(payload);
            const isNarrativeCanvasEditing = narrativeCanvasEditActionId === action.id && selected;
            const fontFamily = String(payload.fontFamily ?? 'Merriweather').trim() || 'Merriweather';
            const fontSizePx = isNarrativeCanvasEditing
              ? (narrativeCanvasDraft?.fontSizePx ?? 28)
              : (Number.isFinite(Number(payload.fontSizePx)) ? Math.max(8, Math.min(220, Number(payload.fontSizePx))) : 28);
            const fontColor = isNarrativeCanvasEditing
              ? (narrativeCanvasDraft?.fontColor ?? '#ffffff')
              : (String(payload.fontColor ?? '#ffffff').trim() || '#ffffff');
            const textAlignRaw = String(payload.textAlign ?? 'left').trim();
            const textAlign = isNarrativeCanvasEditing
              ? (narrativeCanvasDraft?.textAlign ?? 'left')
              : (textAlignRaw === 'center' || textAlignRaw === 'right' || textAlignRaw === 'justify' ? textAlignRaw : 'left');
            const lineHeight = Number.isFinite(Number(payload.lineHeight)) ? Math.max(0.8, Math.min(3, Number(payload.lineHeight))) : 1.35;
            const letterSpacingPx = Number.isFinite(Number(payload.letterSpacingPx))
              ? Math.max(-8, Math.min(20, Number(payload.letterSpacingPx)))
              : 0;
            const fontWeightRaw = String(payload.fontWeight ?? 'normal').trim();
            const fontWeight = isNarrativeCanvasEditing
              ? (narrativeCanvasDraft?.fontWeight === 'bold' ? 700 : 400)
              : (fontWeightRaw === 'bold' ? 700 : 400);
            const fontStyle = isNarrativeCanvasEditing
              ? (narrativeCanvasDraft?.fontStyle ?? 'normal')
              : (String(payload.fontStyle ?? 'normal').trim() === 'italic' ? 'italic' : 'normal');
            const textDecoration = isNarrativeCanvasEditing
              ? (narrativeCanvasDraft?.textDecoration ?? 'none')
              : (String(payload.textDecoration ?? 'none').trim() === 'underline' ? 'underline' : 'none');
            const backgroundModeRaw = String(payload.backgroundMode ?? 'rect').trim();
            const backgroundMode = backgroundModeRaw === 'none' || backgroundModeRaw === 'capsule' ? backgroundModeRaw : 'rect';
            const backgroundColor = String(payload.backgroundColor ?? '#000000').trim() || '#000000';
            const backgroundOpacity = Number.isFinite(Number(payload.backgroundOpacity))
              ? normalizeOpacity(payload.backgroundOpacity)
              : 0.58;
            const borderRadiusPx = Number.isFinite(Number(payload.borderRadiusPx))
              ? Math.max(0, Math.min(128, Number(payload.borderRadiusPx)))
              : 12;
            const paddingPx = Number.isFinite(Number(payload.paddingPx))
              ? Math.max(0, Math.min(64, Number(payload.paddingPx)))
              : 16;
            const hasContent = Boolean(title) || segments.length > 0;
            const narrativeCanvasWidthPx = (placement.widthPct / 100) * previewWindowSize.width * previewScale;
            const narrativeCanvasHeightPx = (placement.heightPct / 100) * previewWindowSize.height * previewScale;
            const narrativeToolbarCompact = narrativeCanvasWidthPx < 460 || narrativeCanvasHeightPx < 220;
            const shouldRenderNarrative = hasContent || selected || isNarrativeCanvasEditing;

            if (!shouldRenderNarrative) {
              return null;
            }

            const canCaptureThisLayer = canCapturePointer(selected);
            return (
              <Box
                key={key}
                sx={{
                  position: 'absolute',
                  left: `${narrativeOscillatedPlacement.leftPct}%`,
                  top: `${narrativeOscillatedPlacement.topPct}%`,
                  width: `${placement.widthPct}%`,
                  height: `${placement.heightPct}%`,
                  opacity,
                  transform: narrativeTransformCss,
                  transformOrigin: 'center center',
                  zIndex,
                  border: selected ? '2px solid rgba(255,255,255,0.9)' : 'none',
                  borderRadius: selected ? 1 : 0,
                  pointerEvents: lockPreviewInteractionToSelectedNarrative && !selected
                    ? 'none'
                    : canCaptureThisLayer ? 'auto' : 'none',
                  display: 'flex',
                  alignItems: 'stretch',
                  boxSizing: 'border-box',
                  cursor: !selected
                    ? (canCaptureThisLayer ? 'pointer' : 'default')
                    : selected && !isNarrativeCanvasEditing && leftToolPanelMode !== 'text'
                      ? 'move'
                      : 'text',
                }}
                onMouseDown={(event) => {
                  if (!selected) {
                    if (!canSwitchSelection(event, selected)) {
                      event.preventDefault();
                      return;
                    }
                    selectActionAndSeekToStart(action.id);
                    return;
                  }
                  if (isNarrativeCanvasEditing) return;
                  if (leftToolPanelMode === 'text') {
                    return;
                  }
                }}
                onClick={(event) => {
                  if (!selected || isNarrativeCanvasEditing) return;
                  if (leftToolPanelMode !== 'text') return;
                  event.stopPropagation();
                }}
                onDoubleClick={() => {
                  if (!selected) return;
                  beginNarrativeCanvasEdit(action);
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    overflow: isNarrativeCanvasEditing ? 'visible' : 'hidden',
                    p: `${paddingPx}px`,
                    borderRadius: backgroundMode === 'capsule' ? 999 : `${borderRadiusPx}px`,
                    bgcolor: backgroundMode === 'none' ? 'transparent' : alpha(backgroundColor, backgroundOpacity),
                    color: fontColor,
                    fontFamily,
                    fontSize: `${fontSizePx}px`,
                    textAlign,
                    lineHeight,
                    letterSpacing: `${letterSpacingPx}px`,
                    fontWeight,
                    fontStyle,
                    textDecoration,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    boxSizing: 'border-box',
                  }}
                >
                  {isNarrativeCanvasEditing ? (
                    <Stack
                      spacing={narrativeToolbarCompact ? 0.5 : 0.75}
                      sx={{ width: '100%', height: '100%' }}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      {!narrativeToolbarCompact || Boolean(narrativeCanvasDraft?.title ?? title) ? (
                        <TextField
                          size="small"
                          label="Título"
                          value={narrativeCanvasDraft?.title ?? title}
                          onChange={(event) => {
                            const nextTitle = event.target.value;
                            setNarrativeCanvasDraft((current) => ({
                              ...(current ?? {
                                title: String(payload.title ?? ''),
                                text: String(payload.text ?? ''),
                                fontSizePx,
                                fontColor,
                                textAlign: textAlign as 'left' | 'center' | 'right' | 'justify',
                                fontWeight: (fontWeightRaw === 'bold' ? 'bold' : 'normal') as 'normal' | 'bold',
                                fontStyle: (String(payload.fontStyle ?? 'normal').trim() === 'italic' ? 'italic' : 'normal') as 'normal' | 'italic',
                                textDecoration: (String(payload.textDecoration ?? 'none').trim() === 'underline' ? 'underline' : 'none') as 'none' | 'underline',
                              }),
                              title: nextTitle,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              finishNarrativeCanvasEdit('cancel');
                            }
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                      ) : null}
                      <TextField
                        size="small"
                        label="Texto"
                        multiline
                        minRows={narrativeToolbarCompact ? 2 : 3}
                        value={narrativeCanvasDraft?.text ?? String(payload.text ?? '')}
                        onChange={(event) => {
                          const nextText = event.target.value;
                          setNarrativeCanvasDraft((current) => ({
                            ...(current ?? {
                              title: String(payload.title ?? ''),
                              text: String(payload.text ?? ''),
                              fontSizePx,
                              fontColor,
                              textAlign: textAlign as 'left' | 'center' | 'right' | 'justify',
                              fontWeight: (fontWeightRaw === 'bold' ? 'bold' : 'normal') as 'normal' | 'bold',
                              fontStyle: (String(payload.fontStyle ?? 'normal').trim() === 'italic' ? 'italic' : 'normal') as 'normal' | 'italic',
                              textDecoration: (String(payload.textDecoration ?? 'none').trim() === 'underline' ? 'underline' : 'none') as 'none' | 'underline',
                            }),
                            text: nextText,
                          }));
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            finishNarrativeCanvasEdit('cancel');
                          }
                          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
                            event.preventDefault();
                            setNarrativeCanvasDraft((current) => {
                              if (!current) return current;
                              return {
                                ...current,
                                fontWeight: current.fontWeight === 'bold' ? 'normal' : 'bold',
                              };
                            });
                          }
                          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
                            event.preventDefault();
                            setNarrativeCanvasDraft((current) => {
                              if (!current) return current;
                              return {
                                ...current,
                                fontStyle: current.fontStyle === 'italic' ? 'normal' : 'italic',
                              };
                            });
                          }
                          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'u') {
                            event.preventDefault();
                            setNarrativeCanvasDraft((current) => {
                              if (!current) return current;
                              return {
                                ...current,
                                textDecoration: current.textDecoration === 'underline' ? 'none' : 'underline',
                              };
                            });
                          }
                          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            finishNarrativeCanvasEdit('save');
                          }
                        }}
                        sx={{ flex: 1 }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Stack>
                  ) : (
                    <>
                      {!hasContent ? (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255,255,255,0.82)',
                            fontStyle: 'italic',
                          }}
                        >
                          Haz clic para editar texto...
                        </Typography>
                      ) : null}
                      {title ? (
                        <Typography
                          variant="subtitle2"
                          sx={{
                            mb: 0.5,
                            color: 'inherit',
                            fontFamily: 'inherit',
                            fontStyle: 'inherit',
                            textDecoration: 'inherit',
                          }}
                        >
                          {title}
                        </Typography>
                      ) : null}
                      <Typography
                        component="div"
                        sx={{
                          color: 'inherit',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          fontWeight: 'inherit',
                          fontStyle: 'inherit',
                          textDecoration: 'inherit',
                          lineHeight: 'inherit',
                          textAlign: 'inherit',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {segments.map((segment, segmentIndex) => (
                          <Box
                            key={`${action.id ?? key}-seg-${segmentIndex}`}
                            component="span"
                            sx={{
                              fontWeight: segment.bold ? 700 : undefined,
                              fontStyle: segment.italic ? 'italic' : undefined,
                              textDecoration: segment.underline ? 'underline' : undefined,
                              fontSize: segment.fontSizePx ? `${segment.fontSizePx}px` : undefined,
                              color: segment.color,
                              fontFamily: segment.fontFamily,
                            }}
                          >
                            {segment.text}
                          </Box>
                        ))}
                      </Typography>
                    </>
                  )}
                </Box>
                {selected && !isNarrativeCanvasEditing ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -8,
                      top: -8,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: 'info.main',
                      border: '2px solid #fff',
                      cursor: 'move',
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={(event) => {
                      startLayerDrag(action, 'move', event);
                    }}
                  />
                ) : null}
                {selected && !isNarrativeCanvasEditing ? (
                  <Button
                    size="small"
                    variant="contained"
                    sx={{
                      position: 'absolute',
                      right: 6,
                      top: 6,
                      minWidth: 0,
                      px: 1,
                      py: 0.25,
                      textTransform: 'none',
                      fontSize: 11,
                      zIndex: 2,
                    }}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      beginNarrativeCanvasEdit(action);
                    }}
                  >
                    Editar texto
                  </Button>
                ) : null}
                {selected && isNarrativeCanvasEditing ? (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{
                      flexWrap: 'wrap',
                      rowGap: 0.5,
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: '100%',
                      mb: 0.6,
                      zIndex: 4,
                      p: 0.4,
                      borderRadius: 0.8,
                      border: '1px solid rgba(255,255,255,0.2)',
                      bgcolor: 'rgba(12, 14, 20, 0.92)',
                      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <Button
                      size="small"
                      variant={narrativeCanvasDraft?.fontWeight === 'bold' ? 'contained' : 'outlined'}
                      sx={{ minWidth: 34, px: 0.85 }}
                      onClick={() => {
                        setNarrativeCanvasDraft((current) => {
                          if (!current) return current;
                          return {
                            ...current,
                            fontWeight: current.fontWeight === 'bold' ? 'normal' : 'bold',
                          };
                        });
                      }}
                    >
                      B
                    </Button>
                    <Button
                      size="small"
                      variant={narrativeCanvasDraft?.fontStyle === 'italic' ? 'contained' : 'outlined'}
                      sx={{ minWidth: 34, px: 0.85 }}
                      onClick={() => {
                        setNarrativeCanvasDraft((current) => {
                          if (!current) return current;
                          return {
                            ...current,
                            fontStyle: current.fontStyle === 'italic' ? 'normal' : 'italic',
                          };
                        });
                      }}
                    >
                      I
                    </Button>
                    <Button
                      size="small"
                      variant={narrativeCanvasDraft?.textDecoration === 'underline' ? 'contained' : 'outlined'}
                      sx={{ minWidth: 34, px: 0.85 }}
                      onClick={() => {
                        setNarrativeCanvasDraft((current) => {
                          if (!current) return current;
                          return {
                            ...current,
                            textDecoration: current.textDecoration === 'underline' ? 'none' : 'underline',
                          };
                        });
                      }}
                    >
                      U
                    </Button>
                    <TextField
                      size="small"
                      label="Color"
                      type="color"
                      sx={{ width: 88 }}
                      value={narrativeCanvasDraft?.fontColor ?? '#ffffff'}
                      onChange={(event) => {
                        const next = event.target.value;
                        setNarrativeCanvasDraft((current) => {
                          if (!current) return current;
                          return { ...current, fontColor: next };
                        });
                      }}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      size="small"
                      label="Tam"
                      type="number"
                      sx={{ width: 84 }}
                      value={narrativeCanvasDraft?.fontSizePx ?? 28}
                      inputProps={{ min: 8, max: 220, step: 1 }}
                      onChange={(event) => {
                        const raw = Number(event.target.value);
                        setNarrativeCanvasDraft((current) => {
                          if (!current) return current;
                          return {
                            ...current,
                            fontSizePx: Number.isFinite(raw) ? Math.max(8, Math.min(220, raw)) : current.fontSizePx,
                          };
                        });
                      }}
                      InputLabelProps={{ shrink: true }}
                    />
                    <FormControl size="small" sx={{ minWidth: 116 }}>
                      <InputLabel>Alineación</InputLabel>
                      <Select
                        label="Alineación"
                        value={narrativeCanvasDraft?.textAlign ?? 'left'}
                        onChange={(event) => {
                          const value = event.target.value as 'left' | 'center' | 'right' | 'justify';
                          setNarrativeCanvasDraft((current) => {
                            if (!current) return current;
                            return { ...current, textAlign: value };
                          });
                        }}
                      >
                        <MenuItem value="left">Left</MenuItem>
                        <MenuItem value="center">Center</MenuItem>
                        <MenuItem value="right">Right</MenuItem>
                        <MenuItem value="justify">Justify</MenuItem>
                      </Select>
                    </FormControl>
                    <Stack direction="row" spacing={0.5} sx={{ marginLeft: 'auto' }}>
                      <Button size="small" variant="outlined" onClick={() => finishNarrativeCanvasEdit('cancel')}>
                        Cancelar
                      </Button>
                      <Button size="small" variant="contained" onClick={() => finishNarrativeCanvasEdit('save')}>
                        Guardar
                      </Button>
                    </Stack>
                  </Stack>
                ) : null}
                {selected ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      right: -8,
                      bottom: -8,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      border: '2px solid #fff',
                      cursor: 'nwse-resize',
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={(event) => {
                      if (isNarrativeCanvasEditing) return;
                      startLayerDrag(action, 'resize', event);
                    }}
                  />
                ) : null}
              </Box>
            );
          }

          return null;
        })}
    </>
  );
};
