/**
 * useTurnOrder
 *
 * Manages combat turn order and round counters for a given ordered
 * participant list. Persists state per session (campaign+encounter)
 * using localStorage and rehydrates robustly via participant ids.
 *
 * Public API is self-contained so containers can stay lean.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

export interface TurnParticipant {
  id: string;
}

export interface UseTurnOrderResult {
  round: number;
  index: number;
  currentId: string | null;
  hydrated: boolean;
  nextTurn: () => void;
  previousTurn: () => void;
  setRound: (r: number) => void;
  setIndex: (i: number) => void;
  resetToStart: () => void;
}

/**
 * @param sessionKey - Unique key (e.g., `${campaignId}:${encounterId}`) to scope persistence
 * @param participants - Current ordered participant array
 * @param isSkippable - Optional predicate; participants for which it returns true
 *   keep their position in the list but are skipped when advancing/retreating turns
 *   (e.g. downed combatants at 0 HP that could still be revived).
 */
export function useTurnOrder(
  sessionKey: string | null,
  participants: TurnParticipant[],
  isSkippable?: (id: string | null | undefined) => boolean,
): UseTurnOrderResult {
  const [round, setRound] = useState<number>(1);
  const [index, setIndex] = useState<number>(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const alignedRef = useRef<boolean>(false);

  const key = useMemo(() => (sessionKey ? `turn.state:${sessionKey}` : null), [sessionKey]);

  // Hydrate from storage
  useEffect(() => {
    alignedRef.current = false;
    if (!key) { setHydrated(false); return; }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const obj = JSON.parse(raw) as { round?: number; index?: number; currentId?: string | null };
        if (typeof obj.round === 'number' && obj.round > 0) setRound(obj.round);
        if (typeof obj.index === 'number' && obj.index >= 0) setIndex(obj.index);
        if (typeof obj.currentId === 'string' || obj.currentId === null) setCurrentId(obj.currentId ?? null);
      }
    } catch {}
    setHydrated(true);
  }, [key]);

  // Align index to currentId when participants load (one-time per change)
  useEffect(() => {
    if (!hydrated || !participants || participants.length === 0) return;
    if (currentId && !alignedRef.current) {
      const idx = participants.findIndex(p => p.id === currentId);
      if (idx >= 0) {
        setIndex(idx);
        alignedRef.current = true; // Only mark as aligned if we successfully found the participant
      }
      // Don't reset index to 0 or mark as aligned if participant not found yet
      // This allows for re-alignment when participants list updates with more data
    } else if (!currentId && index >= participants.length) {
      setIndex(0);
    }
  }, [hydrated, participants, currentId, index]);

  // Persist changes
  useEffect(() => {
    if (!key || !hydrated) return;
    try {
      const payload = JSON.stringify({ round, index, currentId });
      localStorage.setItem(key, payload);
    } catch {}
  }, [key, round, index, currentId, hydrated]);

  // Keep currentId in sync with index (but only after initial hydration and alignment)
  useEffect(() => {
    // Don't sync until we're hydrated and have participants
    if (!hydrated || participants.length === 0) return;
    // Don't sync during initial alignment phase
    if (currentId && !alignedRef.current) return;
    
    const id = participants[index]?.id ?? null;
    if (id !== currentId) {
      setCurrentId(id);
    }
  }, [participants, index, hydrated]); // Removed currentId to avoid loop

  const nextTurn = () => {
    const len = participants.length;
    if (len === 0) return;
    let newIndex = index;
    let wrapped = false;
    let found = false;
    // Walk forward up to `len` steps looking for the next non-skippable turn.
    for (let step = 0; step < len; step++) {
      if (newIndex + 1 >= len) { newIndex = 0; wrapped = true; } else { newIndex += 1; }
      if (!isSkippable || !isSkippable(participants[newIndex]?.id)) { found = true; break; }
    }
    if (!found) {
      // Everyone else is skippable: fall back to a plain single-step advance.
      newIndex = index + 1 >= len ? 0 : index + 1;
      wrapped = index + 1 >= len;
    }
    setIndex(newIndex);
    if (wrapped) setRound(r => r + 1);
    setCurrentId(participants[newIndex]?.id ?? null);
  };

  const previousTurn = () => {
    const len = participants.length;
    if (len === 0) return;
    let newIndex = index;
    let wrapped = false;
    let found = false;
    // Walk backward up to `len` steps looking for the previous non-skippable turn.
    for (let step = 0; step < len; step++) {
      if (newIndex - 1 < 0) { newIndex = len - 1; wrapped = true; } else { newIndex -= 1; }
      if (!isSkippable || !isSkippable(participants[newIndex]?.id)) { found = true; break; }
    }
    if (!found) {
      newIndex = index - 1 < 0 ? len - 1 : index - 1;
      wrapped = index - 1 < 0;
    }
    setIndex(newIndex);
    if (wrapped) setRound(r => Math.max(1, r - 1));
    setCurrentId(participants[newIndex]?.id ?? null);
  };

  const resetToStart = () => {
    setIndex(0);
    setRound(1);
    // Update currentId immediately
    const id = participants[0]?.id ?? null;
    setCurrentId(id);
  };

  return { round, index, currentId, hydrated, nextTurn, previousTurn, setRound, setIndex, resetToStart };
}
