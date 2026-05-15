import React, { useMemo } from 'react';
import {
  Box,
  Chip,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SceneActionDto } from '../../types/scenes';

interface TimelineEntry {
  actionId: string;
  type: string;
  label: string;
  trackKey: string;
  trackLabel: string;
  startMs: number;
  durationMs: number;
}

interface SceneTimelineEditorProps {
  actions: SceneActionDto[];
  selectedActionId?: string | null;
  onSelectAction?: (actionId: string) => void;
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

/**
 * Timeline-like visualization for scene actions, grouped in tracks with temporal offsets.
 */
const SceneTimelineEditor: React.FC<SceneTimelineEditorProps> = ({
  actions,
  selectedActionId,
  onSelectAction,
}) => {
  const { entries, totalMs } = useMemo(() => buildTimeline(actions), [actions]);

  const pxPerMs = 0.035;
  const timelineWidth = Math.max(900, totalMs * pxPerMs + 40);
  const tickMs = chooseTickMs(totalMs);

  const tracks = useMemo(() => {
    const grouped = new Map<string, TimelineEntry[]>();
    for (const entry of entries) {
      const prev = grouped.get(entry.trackKey) ?? [];
      prev.push(entry);
      grouped.set(entry.trackKey, prev);
    }
    return TRACK_ORDER.map((trackKey) => ({
      trackKey,
      trackLabel: grouped.get(trackKey)?.[0]?.trackLabel ?? labelForTrack(trackKey),
      entries: grouped.get(trackKey) ?? [],
    })).filter((track) => track.entries.length > 0);
  }, [entries]);

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
        <Chip
          size="small"
          label={`Duracion aprox: ${formatMs(totalMs)}`}
          variant="outlined"
        />
      </Stack>

      <Box sx={{ overflowX: 'auto', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ width: timelineWidth + 220, p: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ width: 210, pr: 1 }}>
              <Typography variant="caption" color="text.secondary">Pista</Typography>
            </Box>
            <Box sx={{ position: 'relative', width: timelineWidth, height: 24 }}>
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
            </Box>
          </Box>

          <Stack spacing={0.75}>
            {tracks.map((track) => (
              <Box key={track.trackKey} sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ width: 210, pr: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {track.trackLabel}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    position: 'relative',
                    width: timelineWidth,
                    height: 34,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    overflow: 'hidden',
                  }}
                >
                  {track.entries.map((entry) => {
                    const left = entry.startMs * pxPerMs;
                    const width = Math.max(28, entry.durationMs * pxPerMs);
                    const isSelected = selectedActionId === entry.actionId;

                    return (
                      <Tooltip
                        key={entry.actionId}
                        title={`${entry.label} | ${formatMs(entry.startMs)} - ${formatMs(entry.startMs + entry.durationMs)}`}
                      >
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectAction?.(entry.actionId)}
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
                            px: 1,
                            display: 'flex',
                            alignItems: 'center',
                            bgcolor: colorForTrack(entry.trackKey),
                            color: '#fff',
                            border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.28)',
                            boxShadow: isSelected ? '0 0 0 2px rgba(0,0,0,0.35)' : 'none',
                            overflow: 'hidden',
                            cursor: 'pointer',
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
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
};

function buildTimeline(actions: SceneActionDto[]): { entries: TimelineEntry[]; totalMs: number } {
  let cursorMs = 0;
  const entries: TimelineEntry[] = [];

  for (const action of actions) {
    const preDelayMs = clampMsNumber(action.delay, 0);
    cursorMs += preDelayMs;

    const durationMs = inferActionDurationMs(action);
    const track = resolveTrack(action);

    entries.push({
      actionId: action.id,
      type: action.type,
      label: ACTION_LABELS[action.type] ?? action.type,
      trackKey: track.key,
      trackLabel: track.label,
      startMs: cursorMs,
      durationMs,
    });

    cursorMs += durationMs;
  }

  return { entries, totalMs: Math.max(cursorMs, 1000) };
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

export default SceneTimelineEditor;
