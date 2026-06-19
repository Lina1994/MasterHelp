import React, { useMemo } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Chip, IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FavoriteIcon from '@mui/icons-material/Favorite';
import NotesIcon from '@mui/icons-material/Notes';
import { CombatLog, CombatTurnSnapshot } from '../../api/campaigns/combatLog';
import type { DiaryCalendarConfig } from '../../api/diary/diaryApi';

/** Formats a campaign calendar day using the calendar config (month names). */
export function formatCampaignDay(config: DiaryCalendarConfig | null, year: number, monthIndex: number, dayIndex: number): string {
  const monthName = config?.months?.[monthIndex]?.name;
  const yearLabel = config?.yearLabelTemplate
    ? config.yearLabelTemplate.replace('{year}', String(year))
    : `Año ${year}`;
  return monthName ? `Día ${dayIndex} de ${monthName} · ${yearLabel}` : `Día ${dayIndex} · Mes ${monthIndex + 1} · ${yearLabel}`;
}

/** A single change detected between two consecutive snapshots. */
interface ParticipantChange {
  id: string;
  name: string;
  role?: 'ally' | 'foe';
  hpChanged: boolean;
  hpBefore: number | null;
  hpAfter: number | null;
  maxBefore: number | null;
  maxAfter: number | null;
  noteChanged: boolean;
  note: string | null;
}

/** Computes the participant changes of `cur` relative to `prev`. */
function diffSnapshot(prev: CombatTurnSnapshot | null, cur: CombatTurnSnapshot): ParticipantChange[] {
  const prevById = new Map((prev?.participants || []).map((p) => [p.id, p]));
  const changes: ParticipantChange[] = [];
  for (const p of cur.participants || []) {
    const before = prevById.get(p.id);
    const hpBefore = before ? (before.currentHp ?? null) : null;
    const hpAfter = p.currentHp ?? null;
    const hpChanged = !before ? hpAfter !== null : hpBefore !== hpAfter;
    const noteBefore = before?.note ?? '';
    const noteAfter = p.note ?? '';
    const noteChanged = !before ? !!noteAfter : noteBefore !== noteAfter;
    if (hpChanged || noteChanged) {
      changes.push({
        id: p.id,
        name: p.name,
        role: p.role,
        hpChanged,
        hpBefore,
        hpAfter,
        maxBefore: before ? (before.maxHp ?? null) : null,
        maxAfter: p.maxHp ?? null,
        noteChanged,
        note: p.note ?? null,
      });
    }
  }
  return changes;
}

/** Formats a "current/max" HP pair, tolerating missing values. */
function formatHp(current: number | null, max: number | null): string {
  const cur = current ?? '—';
  return max != null ? `${cur}/${max}` : `${cur}`;
}

/** Timeline rendering for a single combat run (only turns with changes). */
const CombatTimeline: React.FC<{ log: CombatLog }> = ({ log }) => {
  const snapshots = log.snapshots || [];
  if (snapshots.length === 0) {
    return <Typography variant="body2" color="text.secondary">Sin movimientos registrados.</Typography>;
  }
  return (
    <Stack spacing={1.5}>
      {snapshots.map((snap, idx) => {
        const prev = idx > 0 ? snapshots[idx - 1] : null;
        const changes = diffSnapshot(prev, snap);
        if (changes.length === 0) return null;
        return (
          <Box key={idx} sx={{ borderLeft: '3px solid', borderColor: 'primary.main', pl: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {idx === 0 ? 'Inicio' : `Ronda ${snap.round} · turno de ${snap.turnParticipantName || '—'}`}
            </Typography>
            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
              {changes.map((c) => (
                <Stack key={c.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2" sx={{ fontWeight: 500, color: c.role === 'foe' ? 'error.main' : 'success.main' }}>
                    {c.name}
                  </Typography>
                  {c.hpChanged ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <FavoriteIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {idx === 0
                          ? formatHp(c.hpAfter, c.maxAfter)
                          : `${formatHp(c.hpBefore, c.maxBefore ?? c.maxAfter)} → ${formatHp(c.hpAfter, c.maxAfter)}`}
                      </Typography>
                    </Stack>
                  ) : null}
                  {c.noteChanged && c.note ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <NotesIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">{c.note}</Typography>
                    </Stack>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
};

export interface CombatLogListProps {
  logs: CombatLog[];
  calendar: DiaryCalendarConfig | null;
  isMaster: boolean;
  /** Optional delete handler (master only). */
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  emptyText?: string;
}

/**
 * Renders a collapsible list of combat runs. Each run is collapsed by default
 * and expands to show its turn-by-turn timeline (only changes).
 */
export const CombatLogList: React.FC<CombatLogListProps> = ({ logs, calendar, isMaster, onDelete, deletingId, emptyText }) => {
  const outcomeChip = useMemo(() => (log: CombatLog) => {
    if (!log.endedAt) return <Chip size="small" label="En curso" color="warning" />;
    if (log.outcome === 'victory') return <Chip size="small" label="Victoria" color="success" />;
    if (log.outcome === 'escape') return <Chip size="small" label="Huida" color="info" />;
    return <Chip size="small" label="Finalizado" />;
  }, []);

  if (logs.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText || 'Sin combates.'}</Typography>;
  }

  return (
    <Stack spacing={1}>
      {logs.map((log) => {
        const rounds = log.snapshots?.length ? Math.max(...log.snapshots.map((s) => s.round)) : 0;
        return (
          <Accordion key={log.id} variant="outlined" disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                {outcomeChip(log)}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {log.encounterName || 'Encuentro'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatCampaignDay(calendar, log.year, log.monthIndex, log.dayIndex)}
                  {log.mapName ? ` · ${log.mapName}` : ''}
                  {rounds ? ` · ${rounds} ronda(s)` : ''}
                </Typography>
              </Stack>
              {isMaster && onDelete ? (
                <Tooltip title="Eliminar registro">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={deletingId === log.id}
                      onClick={(e) => { e.stopPropagation(); onDelete(log.id); }}
                      sx={{ mr: 1 }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
            </AccordionSummary>
            <AccordionDetails>
              <CombatTimeline log={log} />
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
};

export default CombatLogList;
