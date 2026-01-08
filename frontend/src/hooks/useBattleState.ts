import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * useBattleState
 *
 * Manages battle lifecycle state (started, round, turnIndex) with
 * persistence scoped by campaign + encounter via localStorage.
 *
 * Public API intentionally mirrors React setters to minimize refactor impact.
 *
 * @param campaignId - Active campaign id (string/number) or null/undefined if not available.
 * @param encounterId - Active encounter id (string) or null/undefined if not available.
 * @returns Battle state and dispatchers.
 */
export function useBattleState(
  campaignId?: string | number | null,
  encounterId?: string | null,
) {
  const [battleStarted, setBattleStarted] = useState<boolean>(false);
  const [round, setRound] = useState<number>(1);
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);

  const battleKey = useMemo(() => {
    return campaignId && encounterId ? `battle.state:${campaignId}:${encounterId}` : null;
  }, [campaignId, encounterId]);

  // Rehydrate state when campaign/encounter changes
  useEffect(() => {
    if (!battleKey) { setHydrated(false); return; }
    try {
      const raw = localStorage.getItem(battleKey);
      if (raw) {
        const obj = JSON.parse(raw) as { started?: boolean; round?: number; turnIndex?: number; currentTurnId?: string | null };
        if (typeof obj.started === 'boolean') setBattleStarted(obj.started);
        if (typeof obj.round === 'number' && obj.round > 0) setRound(obj.round);
        if (typeof obj.turnIndex === 'number' && obj.turnIndex >= 0) setTurnIndex(obj.turnIndex);
        if (typeof obj.currentTurnId === 'string' || obj.currentTurnId === null) setCurrentTurnId(obj.currentTurnId ?? null);
      }
    } catch {}
    // mark hydrated after attempting to read (whether it existed or not)
    setHydrated(true);
  }, [battleKey]);

  // Persist changes
  useEffect(() => {
    if (!battleKey || !hydrated) return;
    try {
      const payload = JSON.stringify({ started: battleStarted, round, turnIndex, currentTurnId });
      localStorage.setItem(battleKey, payload);
    } catch {}
  }, [battleKey, battleStarted, round, turnIndex, currentTurnId, hydrated]);

  const resetBattle = useCallback(() => {
    setBattleStarted(false);
    setRound(1);
    setTurnIndex(0);
  }, []);

  return {
    battleStarted,
    setBattleStarted,
    round,
    setRound,
    turnIndex,
    setTurnIndex,
    currentTurnId,
    setCurrentTurnId,
    resetBattle,
    hydrated,
  } as const;
}
