import React, { useCallback, useEffect, useState } from 'react';
import { CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material';
import { CombatLog, deleteCombatLog, listCombatLogs } from '../../api/campaigns/combatLog';
import { getDiaryCalendar, type DiaryCalendarConfig } from '../../api/diary/diaryApi';
import CombatLogList from './CombatLogList';

interface CombatHistoryPanelProps {
  campaignId: string;
  /** When set, only runs of this encounter are shown. */
  encounterId?: string | null;
  /** Bump this to force a reload (e.g. after starting/ending a combat). */
  refreshKey?: number;
  isMaster: boolean;
}

/**
 * Combat history + timeline shown at the bottom of the combat view.
 *
 * Lists past combat runs (each tagged with its campaign day and outcome) and,
 * when expanded, renders a timeline that shows only the turn-by-turn changes
 * (HP and notes). Separate runs/encounters never mix.
 */
export const CombatHistoryPanel: React.FC<CombatHistoryPanelProps> = ({ campaignId, encounterId, refreshKey, isMaster }) => {
  const [logs, setLogs] = useState<CombatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState<DiaryCalendarConfig | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCombatLogs(campaignId, encounterId || undefined);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, encounterId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    getDiaryCalendar(campaignId)
      .then((c) => { if (!cancelled) setCalendar(c.config); })
      .catch(() => { /* labels fall back to numeric */ });
    return () => { cancelled = true; };
  }, [campaignId]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCombatLog(campaignId, id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  }, [campaignId]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">Historial de combate</Typography>
        {loading ? <CircularProgress size={18} /> : null}
      </Stack>
      <Divider sx={{ mb: 1.5 }} />
      <CombatLogList
        logs={logs}
        calendar={calendar}
        isMaster={isMaster}
        onDelete={handleDelete}
        deletingId={deletingId}
        emptyText={`Aún no hay combates registrados${encounterId ? ' para este encuentro' : ''}.`}
      />
    </Paper>
  );
};

export default CombatHistoryPanel;
