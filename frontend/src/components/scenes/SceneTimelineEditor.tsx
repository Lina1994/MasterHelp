import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SceneActionDto } from '../../types/scenes';

export interface TimelineEntry {
  actionId: string;
  type: string;
  label: string;
  trackKey: string;
  trackLabel: string;
  sourceIndex: number;
  layerOrder: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  narrativeHasRichText?: boolean;
  narrativeHasStyleOverrides?: boolean;
}

interface TimelineLane {
  laneIndex: number;
  entries: TimelineEntry[];
}

interface TimelineTrack {
  trackKey: string;
  trackLabel: string;
  lanes: TimelineLane[];
}

interface SceneTimelineEditorProps {
  actions: SceneActionDto[];
  selectedActionId?: string | null;
  narrativeEditingActionId?: string | null;
  onSelectAction?: (actionId: string) => void;
  onMoveActionInTime?: (actionId: string, nextStartMs: number) => void;
  onChangeActionLayerOrder?: (actionId: string, nextLayerOrder: number) => void;
  onChangeActionDuration?: (actionId: string, nextDurationMs: number, nextStartMs?: number) => void;
  currentTimeMs?: number;
  onSeekTimeMs?: (nextTimeMs: number) => void;
  loopEnabled?: boolean;
  loopWindowStartMs?: number | null;
  loopWindowEndMs?: number | null;
  onSetLoopWindow?: (nextStartMs: number, nextEndMs: number) => void;
  /** Nuevo: handler para drop contextualizado en pista/ventana, recibe assetId */
  onDropAsset?: (info: { assetId: string; trackKey: string; startMs: number; clientX: number; clientY: number }) => void;
}

interface TimelineDragState {
  actionId: string;
  trackKey: string;
  sourceLaneIndex: number;
  trackLaneCount: number;
  originStartMs: number;
  startClientX: number;
  startClientY: number;
  previewStartMs: number;
  previewLaneIndex: number;
}

interface TimelineResizeState {
  actionId: string;
  edge: 'left' | 'right';
  originStartMs: number;
  originDurationMs: number;
  startClientX: number;
  previewStartMs: number;
  previewDurationMs: number;
}

interface LoopWindowDragState {
  mode: 'start' | 'end';
  startClientX: number;
  originStartMs: number;
  originEndMs: number;
  previewStartMs: number;
  previewEndMs: number;
}

const TRACK_ORDER = [
  'window.main',
  'window.projection',
  'window.skyline',
  'window.custom',
  'window.instance',
  'audio',
  'fx',
  'narrative',
  'weather',
  'control',
  'timing',
  'other',
] as const;

const ACTION_LABELS: Record<string, string> = {
  playMusic: 'Music',
  stopMusic: 'Stop music',
  playSound: 'SFX',
  setMusicVolume: 'Music volume',
  sendImageToWindow: 'Image',
  sendVideoToWindow: 'Video',
  setWindowBackground: 'Background',
  applyWindowFilter: 'Filter',
  clearWindowFilter: 'Clear filter',
  setWeather: 'Weather',
  setNarrativeText: 'Narrative',
  runShortcut: 'Shortcut',
  delay: 'Delay',
  runScene: 'Run scene',
};

const SNAP_OPTIONS_MS = [100, 250, 500] as const;

/**
 * Timeline-like visualization for scene actions, grouped in tracks with temporal offsets.
 */
const SceneTimelineEditor: React.FC<SceneTimelineEditorProps> = ({
  actions,
  selectedActionId,
  narrativeEditingActionId,
  onSelectAction,
  onMoveActionInTime,
  onChangeActionLayerOrder,
  onChangeActionDuration,
  currentTimeMs,
  onSeekTimeMs,
  loopEnabled = false,
  loopWindowStartMs,
  loopWindowEndMs,
  onSetLoopWindow,
  onDropAsset,
}) => {
  const { entries, totalMs } = useMemo(() => buildTimeline(actions), [actions]);
  const [dragState, setDragState] = useState<TimelineDragState | null>(null);
  const [resizeState, setResizeState] = useState<TimelineResizeState | null>(null);
  const [loopWindowDragState, setLoopWindowDragState] = useState<LoopWindowDragState | null>(null);
  const [snapMs, setSnapMs] = useState<number>(250);
  const timelineScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const pxPerMs = 0.035;
  const laneHeight = 34;
  const timelineWidth = Math.max(900, totalMs * pxPerMs + 40);
  const tickMs = chooseTickMs(totalMs);
  const boundedCurrentTimeMs = Math.max(0, Math.min(totalMs, Number(currentTimeMs ?? 0)));

  const normalizedLoopWindow = useMemo(() => {
    const startRaw = Number(loopWindowStartMs);
    const endRaw = Number(loopWindowEndMs);
    const hasValidStart = Number.isFinite(startRaw) && startRaw >= 0;
    const hasValidEnd = Number.isFinite(endRaw) && endRaw > 0;

    if (!loopEnabled) {
      return {
        hasLoopWindow: false,
        startMs: 0,
        endMs: totalMs,
      };
    }

    const fallbackStart = 0;
    const fallbackEnd = totalMs;
    const startMs = hasValidStart ? Math.max(0, Math.min(totalMs - 1, Math.round(startRaw))) : fallbackStart;
    const endCandidate = hasValidEnd ? Math.round(endRaw) : fallbackEnd;
    const endMs = Math.max(startMs + 1, Math.min(totalMs, endCandidate));

    return {
      hasLoopWindow: true,
      startMs,
      endMs,
    };
  }, [loopEnabled, loopWindowEndMs, loopWindowStartMs, totalMs]);

  const seekFromPointer = (clientX: number, rect: DOMRect) => {
    if (!onSeekTimeMs || rect.width <= 0) return;
    const activeWidth = totalMs * pxPerMs;
    const x = Math.max(0, Math.min(activeWidth, clientX - rect.left));
    const ratio = activeWidth > 0 ? x / activeWidth : 0;
    const nextTime = Math.round(totalMs * ratio);
    onSeekTimeMs(nextTime);
  };

  const tracks = useMemo(() => {
    const grouped = new Map<string, TimelineEntry[]>();
    for (const entry of entries) {
      const prev = grouped.get(entry.trackKey) ?? [];
      prev.push(entry);
      grouped.set(entry.trackKey, prev);
    }
    return TRACK_ORDER.map((trackKey) => {
      const trackEntries = (grouped.get(trackKey) ?? []).slice().sort((left, right) => {
        if (left.layerOrder !== right.layerOrder) return right.layerOrder - left.layerOrder;
        if (left.startMs !== right.startMs) return left.startMs - right.startMs;
        if (left.endMs !== right.endMs) return left.endMs - right.endMs;
        if (left.sourceIndex !== right.sourceIndex) return left.sourceIndex - right.sourceIndex;
        return left.actionId.localeCompare(right.actionId);
      });

      const lanes: TimelineLane[] = trackEntries.map((entry, index) => ({
        laneIndex: index,
        entries: [entry],
      }));

      return {
        trackKey,
        trackLabel: grouped.get(trackKey)?.[0]?.trackLabel ?? labelForTrack(trackKey),
        lanes,
      };
    }).filter((track) => track.lanes.length > 0);
  }, [entries]);

  // DRAGGING ACTIONS
  useEffect(() => {
    if (!dragState) return;

    const onMouseMove = (event: MouseEvent) => {
      setDragState((current) => {
        if (!current) return null;
        const rawDeltaXMs = (event.clientX - current.startClientX) / pxPerMs;
        const isFineAdjust = event.shiftKey;
        const snappedDeltaXMs = isFineAdjust
          ? Math.round(rawDeltaXMs)
          : Math.round(rawDeltaXMs / snapMs) * snapMs;
        const nextStartMs = Math.max(0, current.originStartMs + snappedDeltaXMs);
        const laneDelta = Math.round((event.clientY - current.startClientY) / laneHeight);
        const unclampedLaneIndex = current.sourceLaneIndex + laneDelta;
        const maxLaneIndex = Math.max(0, current.trackLaneCount - 1);
        const nextLaneIndex = Math.max(0, Math.min(maxLaneIndex, unclampedLaneIndex));
        return {
          ...current,
          previewStartMs: nextStartMs,
          previewLaneIndex: nextLaneIndex,
        };
      });
    };

    const onMouseUp = () => {
      const current = dragState;
      onMoveActionInTime?.(current.actionId, current.previewStartMs);

      if (current.previewLaneIndex !== current.sourceLaneIndex) {
        const track = tracks.find((t) => t.trackKey === current.trackKey);
        if (track) {
          const trackEntries = track.lanes.flatMap((l) => l.entries);
          const orderedActionIds = trackEntries.map((e) => e.actionId);

          const [draggedId] = orderedActionIds.splice(current.sourceLaneIndex, 1);
          orderedActionIds.splice(current.previewLaneIndex, 0, draggedId);

          const draggedIndex = current.previewLaneIndex;

          const aboveEntry = draggedIndex > 0
            ? trackEntries.find((e) => e.actionId === orderedActionIds[draggedIndex - 1])
            : undefined;
          const belowEntry = draggedIndex < orderedActionIds.length - 1
            ? trackEntries.find((e) => e.actionId === orderedActionIds[draggedIndex + 1])
            : undefined;

          const aboveOrder = aboveEntry?.layerOrder;
          const belowOrder = belowEntry?.layerOrder;

          let nextLayerOrder = 100;
          if (aboveOrder !== undefined && belowOrder !== undefined) {
            nextLayerOrder = Math.round((aboveOrder + belowOrder) / 2);
            if (nextLayerOrder === aboveOrder || nextLayerOrder === belowOrder) {
              nextLayerOrder = aboveOrder - 1;
            }
          } else if (belowOrder !== undefined) {
            nextLayerOrder = belowOrder + 10;
          } else if (aboveOrder !== undefined) {
            nextLayerOrder = Math.max(0, aboveOrder - 10);
            if (nextLayerOrder === aboveOrder) {
              nextLayerOrder = Math.max(0, aboveOrder - 1);
            }
          }

          onChangeActionLayerOrder?.(current.actionId, nextLayerOrder);
        }
      }

      setDragState(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, laneHeight, onChangeActionLayerOrder, onMoveActionInTime, pxPerMs, tracks]);

  // RESIZING ACTIONS
  useEffect(() => {
    if (!resizeState) return;

    const onMouseMove = (event: MouseEvent) => {
      setResizeState((current) => {
        if (!current) return null;
        const rawDeltaXMs = (event.clientX - current.startClientX) / pxPerMs;
        const isFineAdjust = event.shiftKey;
        const snappedDeltaXMs = isFineAdjust
          ? Math.round(rawDeltaXMs)
          : Math.round(rawDeltaXMs / snapMs) * snapMs;

        if (current.edge === 'right') {
          // Adjust duration, keep startMs
          const nextDurationMs = Math.max(200, current.originDurationMs + snappedDeltaXMs);
          return {
            ...current,
            previewDurationMs: nextDurationMs,
          };
        } else {
          // Adjust startMs and duration (keeping endMs constant)
          const originEndMs = current.originStartMs + current.originDurationMs;
          const nextStartMs = Math.max(0, Math.min(originEndMs - 200, current.originStartMs + snappedDeltaXMs));
          const nextDurationMs = originEndMs - nextStartMs;
          return {
            ...current,
            previewStartMs: nextStartMs,
            previewDurationMs: nextDurationMs,
          };
        }
      });
    };

    const onMouseUp = () => {
      const current = resizeState;
      if (current) {
        onChangeActionDuration?.(current.actionId, current.previewDurationMs, current.previewStartMs);
      }
      setResizeState(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizeState, onChangeActionDuration, pxPerMs, snapMs]);

  // DRAGGING LOOP WINDOW
  useEffect(() => {
    if (!loopWindowDragState || !normalizedLoopWindow.hasLoopWindow || !onSetLoopWindow) return;

    const onMouseMove = (event: MouseEvent) => {
      setLoopWindowDragState((current) => {
        if (!current) return null;

        const rawDeltaXMs = (event.clientX - current.startClientX) / pxPerMs;
        const snappedDeltaXMs = event.shiftKey
          ? Math.round(rawDeltaXMs)
          : Math.round(rawDeltaXMs / snapMs) * snapMs;

        if (current.mode === 'start') {
          const nextStartMs = Math.max(0, Math.min(current.originEndMs - 1, current.originStartMs + snappedDeltaXMs));
          return {
            ...current,
            previewStartMs: nextStartMs,
          };
        }

        const nextEndMs = Math.max(current.originStartMs + 1, Math.min(totalMs, current.originEndMs + snappedDeltaXMs));
        return {
          ...current,
          previewEndMs: nextEndMs,
        };
      });
    };

    const onMouseUp = () => {
      const current = loopWindowDragState;
      onSetLoopWindow(
        Math.max(0, Math.round(current.previewStartMs)),
        Math.max(1, Math.round(current.previewEndMs)),
      );
      setLoopWindowDragState(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [loopWindowDragState, normalizedLoopWindow.hasLoopWindow, onSetLoopWindow, pxPerMs, snapMs, totalMs]);

  if (actions.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Timeline</Typography>
        <Typography variant="body2" color="text.secondary">
          Anade acciones para ver la timeline por capas.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">Timeline</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Snap
          </Typography>
          {SNAP_OPTIONS_MS.map((option) => (
            <Chip
              key={option}
              size="small"
              label={`${option}ms`}
              clickable
              variant={snapMs === option ? 'filled' : 'outlined'}
              color={snapMs === option ? 'primary' : 'default'}
              onClick={() => setSnapMs(option)}
            />
          ))}
          <Chip
            size="small"
            label={`Duracion aprox: ${formatMs(totalMs)}`}
            variant="outlined"
          />
        </Stack>
      </Stack>

      <Box ref={timelineScrollContainerRef} sx={{ overflowX: 'auto', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ width: timelineWidth + 220, p: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ width: 210, pr: 1 }}>
              <Typography variant="caption" color="text.secondary">Pista</Typography>
            </Box>
            <Box
              sx={{ position: 'relative', width: timelineWidth, height: 24, cursor: onSeekTimeMs ? 'pointer' : 'default' }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                const rect = event.currentTarget.getBoundingClientRect();
                seekFromPointer(event.clientX, rect);
              }}
            >
              {renderTicks(totalMs, tickMs, pxPerMs).map((tick) => (
                <Box
                  key={tick.ms}
                  sx={{
                    position: 'absolute',
                    left: tick.ms * pxPerMs,
                    top: 0,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {tick.label}
                  </Typography>
                </Box>
              ))}
              <Box
                sx={{
                  position: 'absolute',
                  left: boundedCurrentTimeMs * pxPerMs,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  bgcolor: 'error.main',
                  opacity: 0.9,
                  transform: 'translateX(-1px)',
                  pointerEvents: 'none',
                }}
              />
            </Box>
          </Box>

          <Stack spacing={0.75}>
            {tracks.map((track, trackIndex) => (
              <Box key={track.trackKey} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Box sx={{ width: 210, pr: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {track.trackLabel}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    position: 'relative',
                    width: timelineWidth,
                    minHeight: Math.max(laneHeight, track.lanes.length * laneHeight + 10),
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    overflow: 'visible',
                    cursor: onSeekTimeMs ? 'pointer' : 'default',
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    if (dragState || resizeState) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    seekFromPointer(event.clientX, rect);
                  }}
                  onDragOver={(e) => {
                    // Permitir drop
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (typeof onDropAsset === 'function') {
                      e.preventDefault();
                      // Calcular startMs según posición X
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                      const pxPerMs = timelineWidth / Math.max(1, totalMs);
                      const startMs = Math.round(x / pxPerMs);
                      // Obtener assetId del dataTransfer
                      const payload = e.dataTransfer.getData('text/plain');
                      // Solo soportamos drag de vídeo asset
                      if (!payload.startsWith('scene-video-asset:')) return;
                      const assetId = payload.replace('scene-video-asset:', '').trim();
                      if (!assetId) return;
                      onDropAsset({
                        assetId,
                        trackKey: track.trackKey,
                        startMs,
                        clientX: e.clientX,
                        clientY: e.clientY,
                      });
                    }
                  }}
                >
                  {normalizedLoopWindow.hasLoopWindow ? (
                    <>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: (loopWindowDragState?.previewStartMs ?? normalizedLoopWindow.startMs) * pxPerMs,
                          width: ((loopWindowDragState?.previewEndMs ?? normalizedLoopWindow.endMs) - (loopWindowDragState?.previewStartMs ?? normalizedLoopWindow.startMs)) * pxPerMs,
                          top: 0,
                          bottom: 0,
                          bgcolor: 'primary.main',
                          opacity: 0.1,
                          border: '1px solid',
                          borderColor: 'primary.main',
                          borderStyle: 'dashed',
                          zIndex: 0,
                          pointerEvents: 'none',
                        }}
                      />
                      {trackIndex === 0 && onSetLoopWindow ? (
                        <>
                          <Box
                            role="button"
                            tabIndex={0}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const currentStartMs = loopWindowDragState?.previewStartMs ?? normalizedLoopWindow.startMs;
                              const currentEndMs = loopWindowDragState?.previewEndMs ?? normalizedLoopWindow.endMs;
                              setLoopWindowDragState({
                                mode: 'start',
                                startClientX: event.clientX,
                                originStartMs: currentStartMs,
                                originEndMs: currentEndMs,
                                previewStartMs: currentStartMs,
                                previewEndMs: currentEndMs,
                              });
                            }}
                            sx={{
                              position: 'absolute',
                              left: (loopWindowDragState?.previewStartMs ?? normalizedLoopWindow.startMs) * pxPerMs - 4,
                              top: 0,
                              bottom: 0,
                              width: 8,
                              bgcolor: 'primary.main',
                              opacity: 0.85,
                              borderRadius: 0.5,
                              cursor: 'ew-resize',
                              zIndex: 22,
                            }}
                          />
                          <Box
                            role="button"
                            tabIndex={0}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const currentStartMs = loopWindowDragState?.previewStartMs ?? normalizedLoopWindow.startMs;
                              const currentEndMs = loopWindowDragState?.previewEndMs ?? normalizedLoopWindow.endMs;
                              setLoopWindowDragState({
                                mode: 'end',
                                startClientX: event.clientX,
                                originStartMs: currentStartMs,
                                originEndMs: currentEndMs,
                                previewStartMs: currentStartMs,
                                previewEndMs: currentEndMs,
                              });
                            }}
                            sx={{
                              position: 'absolute',
                              left: (loopWindowDragState?.previewEndMs ?? normalizedLoopWindow.endMs) * pxPerMs - 4,
                              top: 0,
                              bottom: 0,
                              width: 8,
                              bgcolor: 'primary.main',
                              opacity: 0.85,
                              borderRadius: 0.5,
                              cursor: 'ew-resize',
                              zIndex: 22,
                            }}
                          />
                          <Chip
                            size="small"
                            label={`Loop parcial: ${formatMs(loopWindowDragState?.previewStartMs ?? normalizedLoopWindow.startMs)} - ${formatMs(loopWindowDragState?.previewEndMs ?? normalizedLoopWindow.endMs)}`}
                            sx={{
                              position: 'absolute',
                              left: (loopWindowDragState?.previewStartMs ?? normalizedLoopWindow.startMs) * pxPerMs,
                              top: -24,
                              zIndex: 23,
                              bgcolor: 'primary.main',
                              color: '#fff',
                              pointerEvents: 'none',
                            }}
                          />
                        </>
                      ) : null}
                    </>
                  ) : null}

                  <Box
                    sx={{
                      position: 'absolute',
                      left: boundedCurrentTimeMs * pxPerMs,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      bgcolor: 'error.main',
                      opacity: 0.85,
                      transform: 'translateX(-1px)',
                      zIndex: 19,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* DRAG PREVIEW GUIDES */}
                  {dragState && dragState.trackKey === track.trackKey ? (
                    <>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: dragState.previewStartMs * pxPerMs,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          bgcolor: 'warning.main',
                          opacity: 0.75,
                          zIndex: 20,
                          pointerEvents: 'none',
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: dragState.previewLaneIndex * laneHeight,
                          height: laneHeight,
                          bgcolor: 'warning.main',
                          opacity: 0.12,
                          borderTop: '1px solid',
                          borderBottom: '1px solid',
                          borderColor: 'warning.main',
                          zIndex: 2,
                          pointerEvents: 'none',
                        }}
                      />
                      <Chip
                        size="small"
                        label={`${formatMs(dragState.previewStartMs)} | L${dragState.previewLaneIndex + 1} | ${eventHintLabel(snapMs)}`}
                        sx={{
                          position: 'absolute',
                          left: Math.max(0, dragState.previewStartMs * pxPerMs - 40),
                          top: -24,
                          zIndex: 21,
                          bgcolor: 'warning.main',
                          color: '#1a1a1a',
                          fontWeight: 700,
                          pointerEvents: 'none',
                        }}
                      />
                    </>
                  ) : null}

                  {/* RESIZE PREVIEW GUIDES */}
                  {resizeState && (
                    <>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: resizeState.previewStartMs * pxPerMs,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          bgcolor: 'info.main',
                          opacity: 0.75,
                          zIndex: 20,
                          pointerEvents: 'none',
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          left: (resizeState.previewStartMs + resizeState.previewDurationMs) * pxPerMs,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          bgcolor: 'info.main',
                          opacity: 0.75,
                          zIndex: 20,
                          pointerEvents: 'none',
                        }}
                      />
                      <Chip
                        size="small"
                        label={`Duración: ${formatMs(resizeState.previewDurationMs)} | Inicio: ${formatMs(resizeState.previewStartMs)}`}
                        sx={{
                          position: 'absolute',
                          left: Math.max(0, resizeState.previewStartMs * pxPerMs),
                          top: -24,
                          zIndex: 21,
                          bgcolor: 'info.main',
                          color: '#fff',
                          fontWeight: 700,
                          pointerEvents: 'none',
                        }}
                      />
                    </>
                  )}

                  {track.lanes.map((lane) => (
                    <Box
                      key={`${track.trackKey}-lane-${lane.laneIndex}`}
                      sx={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: lane.laneIndex * laneHeight,
                        height: laneHeight,
                        borderTop: lane.laneIndex > 0 ? '1px dashed rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      {lane.entries.map((entry) => {
                        const isDraggingThis = dragState?.actionId === entry.actionId && dragState.trackKey === track.trackKey;
                        const isResizingThis = resizeState?.actionId === entry.actionId;

                        const leftMs = isResizingThis
                          ? resizeState.previewStartMs
                          : isDraggingThis
                            ? dragState.previewStartMs
                            : entry.startMs;

                        const durationMs = isResizingThis
                          ? resizeState.previewDurationMs
                          : entry.durationMs;

                        const left = leftMs * pxPerMs;
                        const width = Math.max(28, durationMs * pxPerMs);
                        const isSelected = selectedActionId === entry.actionId;
                        const isNarrativeEditing = narrativeEditingActionId === entry.actionId;
                        const isResizable = entry.type === 'setNarrativeText' || entry.type === 'sendImageToWindow';

                        return (
                          <Tooltip
                            key={entry.actionId}
                            title={`${entry.label} | ${formatMs(leftMs)} - ${formatMs(leftMs + durationMs)}${entry.type === 'setNarrativeText' ? ` | ${entry.narrativeHasRichText ? 'rich' : 'plain'}${entry.narrativeHasStyleOverrides ? ' + style' : ''}${isNarrativeEditing ? ' | editando' : ''}` : ''}`}
                          >
                            <Box
                              role="button"
                              tabIndex={0}
                              onClick={() => onSelectAction?.(entry.actionId)}
                              onMouseDown={(event) => {
                                if (event.button !== 0) return;
                                event.preventDefault();
                                event.stopPropagation();
                                onSelectAction?.(entry.actionId);
                                setDragState({
                                  actionId: entry.actionId,
                                  trackKey: entry.trackKey,
                                  sourceLaneIndex: lane.laneIndex,
                                  trackLaneCount: track.lanes.length,
                                  originStartMs: entry.startMs,
                                  startClientX: event.clientX,
                                  startClientY: event.clientY,
                                  previewStartMs: entry.startMs,
                                  previewLaneIndex: lane.laneIndex,
                                });
                              }}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter' || ev.key === ' ') {
                                  ev.preventDefault();
                                  onSelectAction?.(entry.actionId);
                                }
                              }}
                              sx={{
                                position: 'absolute',
                                left,
                                top: 4,
                                width,
                                height: 26,
                                borderRadius: 1,
                                px: 0.75,
                                display: 'flex',
                                alignItems: 'center',
                                bgcolor: colorForTrack(entry.trackKey),
                                color: '#fff',
                                border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.28)',
                                boxShadow: isNarrativeEditing
                                  ? '0 0 0 2px rgba(255, 193, 7, 0.55)'
                                  : isSelected
                                    ? '0 0 0 2px rgba(0,0,0,0.35)'
                                    : 'none',
                                overflow: 'hidden',
                                cursor: 'grab',
                                userSelect: 'none',
                                zIndex: isDraggingThis || isResizingThis ? 10 : 1,
                              }}
                            >
                              {/* Left Resize Handle */}
                              {isResizable && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 6,
                                    cursor: 'ew-resize',
                                    zIndex: 3,
                                    borderTopLeftRadius: 'inherit',
                                    borderBottomLeftRadius: 'inherit',
                                    transition: 'background-color 0.15s',
                                    '&:hover': {
                                      bgcolor: 'rgba(255, 255, 255, 0.35)',
                                    }
                                  }}
                                  onMouseDown={(event) => {
                                    if (event.button !== 0) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setResizeState({
                                      actionId: entry.actionId,
                                      edge: 'left',
                                      originStartMs: entry.startMs,
                                      originDurationMs: entry.durationMs,
                                      startClientX: event.clientX,
                                      previewStartMs: entry.startMs,
                                      previewDurationMs: entry.durationMs,
                                    });
                                  }}
                                />
                              )}

                              {/* Box Label Content */}
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: '100%', minWidth: 0, px: 0.5 }}>
                                <Typography variant="caption" noWrap sx={{ color: 'inherit', flex: 1, minWidth: 0 }}>
                                  {entry.label}
                                </Typography>
                                {entry.type === 'setNarrativeText' && entry.narrativeHasRichText ? (
                                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.92)', flexShrink: 0 }} />
                                ) : null}
                                {entry.type === 'setNarrativeText' && entry.narrativeHasStyleOverrides ? (
                                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(173, 216, 230, 0.92)', flexShrink: 0 }} />
                                ) : null}
                                {isNarrativeEditing ? (
                                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.light', flexShrink: 0 }} />
                                ) : null}
                              </Stack>

                              {/* Right Resize Handle */}
                              {isResizable && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 6,
                                    cursor: 'ew-resize',
                                    zIndex: 3,
                                    borderTopRightRadius: 'inherit',
                                    borderBottomRightRadius: 'inherit',
                                    transition: 'background-color 0.15s',
                                    '&:hover': {
                                      bgcolor: 'rgba(255, 255, 255, 0.35)',
                                    }
                                  }}
                                  onMouseDown={(event) => {
                                    if (event.button !== 0) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setResizeState({
                                      actionId: entry.actionId,
                                      edge: 'right',
                                      originStartMs: entry.startMs,
                                      originDurationMs: entry.durationMs,
                                      startClientX: event.clientX,
                                      previewStartMs: entry.startMs,
                                      previewDurationMs: entry.durationMs,
                                    });
                                  }}
                                />
                              )}
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
};

/**
 * Builds temporal intervals for actions using the same offset rules as the scene runner.
 */
export function buildTimeline(actions: SceneActionDto[]): { entries: TimelineEntry[]; totalMs: number } {
  let cursorMs = 0;
  let maxEndMs = 0;
  const entries: TimelineEntry[] = [];

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const preDelayMs = clampMsNumber(action.delay, 0);
    cursorMs += preDelayMs;

    const durationMs = inferActionDurationMs(action);
    const track = resolveTrack(action);
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const explicitStartMs = Number(payload.timelineStartMs);
    const hasExplicitStart = Number.isFinite(explicitStartMs) && explicitStartMs >= 0;
    const startMs = hasExplicitStart ? Math.round(explicitStartMs) : cursorMs;
    const endMs = startMs + durationMs;

    entries.push({
      actionId: action.id,
      type: action.type,
      label: inferTimelineLabel(action),
      trackKey: track.key,
      trackLabel: track.label,
      sourceIndex: index,
      layerOrder: readLayerOrder(payload, index),
      startMs,
      endMs,
      durationMs,
      ...(action.type === 'setNarrativeText'
        ? {
          narrativeHasRichText: hasNarrativeRichTextDoc(payload),
          narrativeHasStyleOverrides: hasNarrativeStyleOverrides(payload),
        }
        : {}),
    });

    cursorMs = hasExplicitStart ? cursorMs : endMs;
    maxEndMs = Math.max(maxEndMs, endMs);
  }

  return { entries, totalMs: Math.max(maxEndMs, cursorMs, 1000) };
}

function hasNarrativeRichTextDoc(payload: Record<string, unknown>): boolean {
  const richTextDoc = payload.richTextDoc;
  if (!richTextDoc || typeof richTextDoc !== 'object' || Array.isArray(richTextDoc)) return false;
  const blocks = (richTextDoc as Record<string, unknown>).blocks;
  if (!Array.isArray(blocks)) return false;
  return blocks.some((block) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
    const segments = (block as Record<string, unknown>).segments;
    return Array.isArray(segments) && segments.length > 0;
  });
}

function hasNarrativeStyleOverrides(payload: Record<string, unknown>): boolean {
  const styleFields = [
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
  ] as const;
  return styleFields.some((field) => payload[field] !== undefined && payload[field] !== null && payload[field] !== '');
}

function inferTimelineLabel(action: SceneActionDto): string {
  const payload = (action.payload ?? {}) as Record<string, unknown>;
  const manualName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
  if (manualName) return manualName;

  if (action.type === 'sendVideoToWindow') {
    const assetName = typeof payload.videoAssetName === 'string' ? payload.videoAssetName.trim() : '';
    if (assetName) return `Video: ${assetName}`;
    const assetId = typeof payload.videoAssetId === 'string' ? payload.videoAssetId.trim() : '';
    if (assetId) return `Video: ${assetId.slice(0, 8)}`;
  }

  if (action.type === 'sendImageToWindow') {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (title) return `Image: ${title}`;
    const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : '';
    if (imageUrl) {
      const filename = imageUrl.split('/').pop()?.split('?')[0] ?? imageUrl;
      return `Image: ${filename}`;
    }
  }

  if (action.type === 'setNarrativeText') {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (title) return `Narrative: ${title}`;
  }

  if (action.type === 'playMusic') {
    const songId = typeof payload.songId === 'string' ? payload.songId.trim() : '';
    const playlistId = typeof payload.playlistId === 'string' ? payload.playlistId.trim() : '';
    if (songId) return `Music: ${songId}`;
    if (playlistId) return `Playlist: ${playlistId}`;
  }

  if (action.type === 'playSound') {
    const effectId = typeof payload.effectId === 'string' ? payload.effectId.trim() : '';
    if (effectId) return `SFX: ${effectId}`;
  }

  if (action.type === 'runScene') {
    const sceneId = typeof payload.sceneId === 'string' ? payload.sceneId.trim() : '';
    if (sceneId) return `Run scene: ${sceneId.slice(0, 8)}`;
  }

  if (action.type === 'runShortcut') {
    const shortcutId = typeof payload.shortcutId === 'string' ? payload.shortcutId.trim() : '';
    if (shortcutId) return `Shortcut: ${shortcutId.slice(0, 8)}`;
  }

  return ACTION_LABELS[action.type] ?? action.type;
}

function readLayerOrder(payload: Record<string, unknown>, fallback: number): number {
  const n = Number(payload.layerOrder);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function inferActionDurationMs(action: SceneActionDto): number {
  const payload = action.payload ?? {};

  if (action.type === 'delay') {
    return clampMsNumber(payload.durationMs, 1000);
  }

  const genericDuration = Number((payload as Record<string, unknown>).durationMs);
  if (Number.isFinite(genericDuration) && genericDuration > 0) {
    return clampMsNumber(genericDuration, 1400);
  }

  if (action.type === 'sendVideoToWindow') {
    const isLoop = Boolean((payload as Record<string, unknown>).loop);
    return isLoop ? 6000 : 4000;
  }

  if (action.type === 'setNarrativeText') return 3500;
  if (action.type === 'playMusic') return 1200;
  if (action.type === 'playSound') return 1200;
  if (action.type === 'runScene' || action.type === 'runShortcut') return 1000;

  return 900;
}

function resolveTrack(action: SceneActionDto): { key: string; label: string } {
  const windowActionTypes = new Set([
    'sendImageToWindow',
    'sendVideoToWindow',
    'setWindowBackground',
    'applyWindowFilter',
    'clearWindowFilter',
    'setNarrativeText',
  ]);

  if (windowActionTypes.has(action.type)) {
    const target = action.targetWindow?.kind ?? (action.type === 'setNarrativeText' ? 'projection' : 'main');
    return { key: `window.${target}`, label: `Window: ${target}` };
  }

  if (action.type === 'playMusic' || action.type === 'stopMusic' || action.type === 'setMusicVolume') {
    return { key: 'audio', label: 'Audio' };
  }

  if (action.type === 'playSound') {
    return { key: 'fx', label: 'Sound FX' };
  }

  if (action.type === 'setWeather') {
    return { key: 'weather', label: 'Weather' };
  }

  if (action.type === 'runScene' || action.type === 'runShortcut') {
    return { key: 'control', label: 'Control' };
  }

  if (action.type === 'delay') {
    return { key: 'timing', label: 'Timing' };
  }

  return { key: 'other', label: 'Other' };
}

function clampMsNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.max(Math.round(n), 200), 1_800_000);
}

function labelForTrack(trackKey: string): string {
  if (trackKey.startsWith('window.')) return `Window: ${trackKey.split('.')[1]}`;
  if (trackKey === 'audio') return 'Audio';
  if (trackKey === 'fx') return 'Sound FX';
  if (trackKey === 'narrative') return 'Narrative';
  if (trackKey === 'weather') return 'Weather';
  if (trackKey === 'control') return 'Control';
  if (trackKey === 'timing') return 'Timing';
  return 'Other';
}

function colorForTrack(trackKey: string): string {
  if (trackKey === 'audio') return '#1565c0';
  if (trackKey === 'fx') return '#00897b';
  if (trackKey === 'narrative') return '#5e35b1';
  if (trackKey === 'weather') return '#546e7a';
  if (trackKey === 'control') return '#ef6c00';
  if (trackKey === 'timing') return '#8d6e63';

  if (trackKey === 'window.main') return '#283593';
  if (trackKey === 'window.projection') return '#6a1b9a';
  if (trackKey === 'window.skyline') return '#2e7d32';
  if (trackKey === 'window.custom') return '#00838f';
  if (trackKey === 'window.instance') return '#c62828';

  return '#455a64';
}

function renderTicks(totalMs: number, stepMs: number, pxPerMs: number): Array<{ ms: number; x: number; label: string }> {
  const ticks: Array<{ ms: number; x: number; label: string }> = [];
  for (let ms = 0; ms <= totalMs; ms += stepMs) {
    ticks.push({ ms, x: ms * pxPerMs, label: formatMs(ms) });
  }
  return ticks;
}

function chooseTickMs(totalMs: number): number {
  if (totalMs <= 20_000) return 2_000;
  if (totalMs <= 60_000) return 5_000;
  if (totalMs <= 180_000) return 10_000;
  return 30_000;
}

function formatMs(value: number): string {
  const seconds = Math.floor(value / 1000);
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
}

function eventHintLabel(snapMs: number): string {
  return `snap ${snapMs}ms (Shift=fino)`;
}

export default SceneTimelineEditor;
