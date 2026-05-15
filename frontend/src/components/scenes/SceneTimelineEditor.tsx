import React, { useEffect, useMemo, useState } from 'react';
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
  onSelectAction?: (actionId: string) => void;
  onMoveActionInTime?: (actionId: string, nextStartMs: number) => void;
  onChangeActionLayerOrder?: (actionId: string, nextLayerOrder: number) => void;
  currentTimeMs?: number;
  onSeekTimeMs?: (nextTimeMs: number) => void;
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
  onSelectAction,
  onMoveActionInTime,
  onChangeActionLayerOrder,
  currentTimeMs,
  onSeekTimeMs,
}) => {
  const { entries, totalMs } = useMemo(() => buildTimeline(actions), [actions]);
  const [dragState, setDragState] = useState<TimelineDragState | null>(null);
  const [snapMs, setSnapMs] = useState<number>(250);

  const pxPerMs = 0.035;
  const laneHeight = 34;
  const timelineWidth = Math.max(900, totalMs * pxPerMs + 40);
  const tickMs = chooseTickMs(totalMs);
  const boundedCurrentTimeMs = Math.max(0, Math.min(totalMs, Number(currentTimeMs ?? 0)));

  const seekFromPointer = (clientX: number, rect: DOMRect) => {
    if (!onSeekTimeMs || rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = x / rect.width;
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
      setDragState((current) => {
        if (!current) return null;
        onMoveActionInTime?.(current.actionId, current.previewStartMs);

        if (current.previewLaneIndex !== current.sourceLaneIndex) {
          const nextLayerOrder = 1000 - current.previewLaneIndex;
          onChangeActionLayerOrder?.(current.actionId, nextLayerOrder);
        }

        return null;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, laneHeight, onChangeActionLayerOrder, onMoveActionInTime, pxPerMs]);

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

      <Box sx={{ overflowX: 'auto', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
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
            {tracks.map((track) => (
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
                    if (dragState) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    seekFromPointer(event.clientX, rect);
                  }}
                >
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
                        const leftMs = isDraggingThis ? dragState.previewStartMs : entry.startMs;
                        const laneDelta = isDraggingThis ? dragState.previewLaneIndex - lane.laneIndex : 0;
                        const left = leftMs * pxPerMs;
                        const width = Math.max(28, entry.durationMs * pxPerMs);
                        const isSelected = selectedActionId === entry.actionId;

                        return (
                          <Tooltip
                            key={entry.actionId}
                            title={`${entry.label} | ${formatMs(entry.startMs)} - ${formatMs(entry.endMs)}`}
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
                                top: 4 + laneDelta * laneHeight,
                                width,
                                height: 26,
                                borderRadius: 1,
                                px: 1,
                                display: 'flex',
                                alignItems: 'center',
                                bgcolor: colorForTrack(entry.trackKey),
                                color: '#fff',
                                border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.28)',
                                boxShadow: isSelected ? '0 0 0 2px rgba(0,0,0,0.35)' : 'none',
                                overflow: 'hidden',
                                cursor: 'grab',
                                userSelect: 'none',
                                zIndex: isDraggingThis ? 10 : 1,
                              }}
                            >
                              <Typography variant="caption" noWrap sx={{ color: 'inherit' }}>
                                {entry.label}
                              </Typography>
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
      label: ACTION_LABELS[action.type] ?? action.type,
      trackKey: track.key,
      trackLabel: track.label,
      sourceIndex: index,
      layerOrder: readLayerOrder(payload, index),
      startMs,
      endMs,
      durationMs,
    });

    cursorMs = hasExplicitStart ? cursorMs : endMs;
    maxEndMs = Math.max(maxEndMs, endMs);
  }

  return { entries, totalMs: Math.max(maxEndMs, cursorMs, 1000) };
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
  ]);

  if (windowActionTypes.has(action.type)) {
    const target = action.targetWindow?.kind ?? 'main';
    return { key: `window.${target}`, label: `Window: ${target}` };
  }

  if (action.type === 'playMusic' || action.type === 'stopMusic' || action.type === 'setMusicVolume') {
    return { key: 'audio', label: 'Audio' };
  }

  if (action.type === 'playSound') {
    return { key: 'fx', label: 'Sound FX' };
  }

  if (action.type === 'setNarrativeText') {
    return { key: 'narrative', label: 'Narrative' };
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
