import { api } from '../../apiBase';

export type CombatOutcome = 'victory' | 'escape';

/** Per-participant state captured in a turn snapshot. */
export interface CombatParticipantSnapshot {
  id: string;
  name: string;
  role?: 'ally' | 'foe';
  kind?: 'character' | 'enemy';
  currentHp?: number | null;
  maxHp?: number | null;
  note?: string | null;
}

/** Snapshot of the combat taken when a turn finished. */
export interface CombatTurnSnapshot {
  round: number;
  turnIndex: number;
  turnParticipantId?: string | null;
  turnParticipantName?: string | null;
  at?: string;
  participants: CombatParticipantSnapshot[];
}

/** A combat run with its turn snapshots. */
export interface CombatLog {
  id: string;
  campaignId: string;
  encounterId: string | null;
  encounterName: string | null;
  mapId: string | null;
  mapName: string | null;
  year: number;
  monthIndex: number;
  dayIndex: number;
  snapshots: CombatTurnSnapshot[];
  startedAt: string;
  endedAt: string | null;
  outcome: CombatOutcome | null;
  createdAt: string;
  updatedAt: string;
}

const base = (campaignId: string) => `/campaigns/${campaignId}/combat-logs`;

/** Lists combat runs (most recent first), optionally filtered by encounter. */
export async function listCombatLogs(campaignId: string, encounterId?: string): Promise<CombatLog[]> {
  const res = await api.get<CombatLog[]>(base(campaignId), {
    params: encounterId ? { encounterId } : undefined,
  });
  return res.data;
}

/** Fetches a single combat run with its snapshots. */
export async function getCombatLog(campaignId: string, id: string): Promise<CombatLog> {
  const res = await api.get<CombatLog>(`${base(campaignId)}/${id}`);
  return res.data;
}

/** Starts a new combat run. Returns the created log. */
export async function startCombatLog(
  campaignId: string,
  payload: { encounterId?: string | null; encounterName?: string | null; mapId?: string | null; mapName?: string | null },
): Promise<CombatLog> {
  const res = await api.post<CombatLog>(`${base(campaignId)}/start`, payload);
  return res.data;
}

/** Appends a turn snapshot to a combat run. */
export async function appendCombatSnapshot(
  campaignId: string,
  id: string,
  snapshot: CombatTurnSnapshot,
): Promise<void> {
  await api.post(`${base(campaignId)}/${id}/snapshot`, { snapshot });
}

/** Ends a combat run with an optional outcome. */
export async function endCombatLog(campaignId: string, id: string, outcome?: CombatOutcome): Promise<void> {
  await api.post(`${base(campaignId)}/${id}/end`, outcome ? { outcome } : {});
}

/** Deletes a combat run (master only). */
export async function deleteCombatLog(campaignId: string, id: string): Promise<void> {
  await api.delete(`${base(campaignId)}/${id}`);
}
