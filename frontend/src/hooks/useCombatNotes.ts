import { useCallback, useEffect, useMemo, useState } from 'react';

export interface CombatNote {
  id: string;
  participantId: string;
  text: string;
  trackByTurns: boolean;
  count: number;
  addedRound?: number;
  addedTurnIndex?: number; // zero-based turn index when added
  durationTurns?: number; // optional max participant turns before auto-expire
}

export interface UseCombatNotesResult {
  getNote: (participantId?: string | null) => CombatNote | null;
  upsertNoteForParticipant: (participantId: string, text: string, trackByTurns: boolean, addedRound?: number, addedTurnIndex?: number, durationTurns?: number) => void;
  updateNoteForParticipant: (participantId: string, patch: Partial<Pick<CombatNote, 'text' | 'trackByTurns' | 'count' | 'durationTurns'>>) => void;
  removeNoteForParticipant: (participantId: string) => void;
  clearAllNotes: () => void;
  incrementForParticipant: (participantId: string, by?: number) => void;
  advanceTurnForParticipant: (participantId: string) => void;
}

/**
 * useCombatNotes
 *
 * Manages per-participant combat notes scoped by `campaignId` + `encounterId`.
 * Notes persist in localStorage while the battle is active and are intended
 * to be cleared when the battle ends (win or escape).
 * Provides metadata of round/turn when the note was added and supports
 * incrementing counts only when that participant receives a turn.
 */
export function useCombatNotes(
  campaignId?: string | number | null,
  encounterId?: string | null,
): UseCombatNotesResult {
  const [notesByPid, setNotesByPid] = useState<Record<string, CombatNote>>({});

  const storageKey = useMemo(() => {
    return campaignId && encounterId ? `battle.notes:${campaignId}:${encounterId}` : null;
  }, [campaignId, encounterId]);

  // Rehydrate
  useEffect(() => {
    if (!storageKey) { setNotesByPid({}); return; }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const rec: Record<string, CombatNote> = {};
          for (const n of data as any[]) {
            if (n && n.participantId) rec[n.participantId] = n as CombatNote;
          }
          setNotesByPid(rec);
        } else if (data && typeof data === 'object') {
          setNotesByPid(data as Record<string, CombatNote>);
        } else {
          setNotesByPid({});
        }
      } else {
        setNotesByPid({});
      }
    } catch {
      setNotesByPid({});
    }
  }, [storageKey]);

  // Persist
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(notesByPid)); } catch {}
  }, [storageKey, notesByPid]);

  // Cross-tab/window sync
  useEffect(() => {
    if (!storageKey) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      try {
        const raw = e.newValue;
        if (raw) {
          const data = JSON.parse(raw);
          if (data && typeof data === 'object') setNotesByPid(data as Record<string, CombatNote>);
        } else {
          setNotesByPid({});
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const getNote = useCallback((participantId?: string | null): CombatNote | null => {
    if (!participantId) return null;
    return notesByPid[participantId] || null;
  }, [notesByPid]);

  const upsertNoteForParticipant = useCallback((participantId: string, text: string, trackByTurns: boolean, addedRound?: number, addedTurnIndex?: number, durationTurns?: number) => {
    setNotesByPid((prev) => {
      const existing = prev[participantId];
      const next: CombatNote = existing ? { ...existing, text: text.trim(), trackByTurns, durationTurns } : {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        participantId,
        text: text.trim(),
        trackByTurns,
        count: 0,
        addedRound,
        addedTurnIndex,
        durationTurns,
      };
      return { ...prev, [participantId]: next };
    });
  }, []);

  const updateNoteForParticipant = useCallback((participantId: string, patch: Partial<Pick<CombatNote, 'text' | 'trackByTurns' | 'count' | 'durationTurns'>>) => {
    setNotesByPid((prev) => {
      const existing = prev[participantId];
      if (!existing) return prev;
      return { ...prev, [participantId]: { ...existing, ...patch } };
    });
  }, []);

  const removeNoteForParticipant = useCallback((participantId: string) => {
    setNotesByPid((prev) => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
  }, []);

  const clearAllNotes = useCallback(() => {
    setNotesByPid({});
    try { if (storageKey) localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  const incrementForParticipant = useCallback((participantId: string, by: number = 1) => {
    setNotesByPid((prev) => {
      const existing = prev[participantId];
      if (!existing || !existing.trackByTurns) return prev;
      return { ...prev, [participantId]: { ...existing, count: (existing.count || 0) + by } };
    });
  }, []);

  const advanceTurnForParticipant = useCallback((participantId: string) => {
    setNotesByPid((prev) => {
      const existing = prev[participantId];
      if (!existing || !existing.trackByTurns) return prev;
      const dur = existing.durationTurns;
      const currentCount = existing.count || 0;
      // If duration is set and already reached, remove before next turn
      if (typeof dur === 'number' && dur >= 0 && currentCount >= dur) {
        const next = { ...prev };
        delete next[participantId];
        return next;
      }
      return { ...prev, [participantId]: { ...existing, count: currentCount + 1 } };
    });
  }, []);

  return { getNote, upsertNoteForParticipant, updateNoteForParticipant, removeNoteForParticipant, clearAllNotes, incrementForParticipant, advanceTurnForParticipant };
}
