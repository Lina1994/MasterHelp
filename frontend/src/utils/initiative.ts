import type { EncounterSummary } from '../api/encounters';
import type { MonsterDetail } from '../types/monsters';
import { dexMod } from './combatMath';

/**
 * Roll initiative for a single enemy participant, respecting DEX modifier.
 * @param pid - Participant id to roll for
 * @param participants - Current participants draft list
 * @param fetchMonster - Function to fetch monster details by manualId/slug
 * @param setInitiativeLocal - Setter to update local initiative value
 * @param schedulePersist - Debounced persist function to save participants
 */
export async function rollEnemyInitiative(
  pid: string,
  participants: EncounterSummary['participants'],
  fetchMonster: (manualId: string, slug: string, lang: 'es' | 'en') => Promise<MonsterDetail | undefined>,
  setInitiativeLocal: (id: string, value: number | undefined) => void,
  schedulePersist: (id: string) => void,
): Promise<void> {
  const p = participants.find((pp) => pp.id === pid);
  if (!p) return;
  let mod = 0;
  if (p.monsterManualId && p.monsterSlug) {
    try {
      const detail = await fetchMonster(p.monsterManualId, p.monsterSlug, 'es').catch(() => fetchMonster(p.monsterManualId!, p.monsterSlug!, 'en'));
      mod = dexMod(detail?.abilities?.dex);
    } catch {}
  }
  const d20 = 1 + Math.floor(Math.random() * 20);
  const total = d20 + mod;
  setInitiativeLocal(pid, total);
  schedulePersist(pid);
}

/**
 * Roll initiative for all foes in one go.
 * Each foe uses its own DEX modifier when available.
 * @param foes - List of foe participants
 * @param fetchMonster - Function to fetch monster details by manualId/slug
 * @param setInitiativeLocal - Setter to update local initiative value
 * @param schedulePersist - Debounced persist function to save participants
 */
export async function rollAllEnemiesInitiative(
  foes: EncounterSummary['participants'],
  fetchMonster: (manualId: string, slug: string, lang: 'es' | 'en') => Promise<MonsterDetail | undefined>,
  setInitiativeLocal: (id: string, value: number | undefined) => void,
  schedulePersist: (id: string) => void,
): Promise<void> {
  const tasks = foes.map(async (p) => {
    let mod = 0;
    if (p.monsterManualId && p.monsterSlug) {
      try {
        const detail = await fetchMonster(p.monsterManualId, p.monsterSlug, 'es').catch(() => fetchMonster(p.monsterManualId!, p.monsterSlug!, 'en'));
        mod = dexMod(detail?.abilities?.dex);
      } catch {}
    }
    const d20 = 1 + Math.floor(Math.random() * 20);
    const total = d20 + mod;
    setInitiativeLocal(p.id, total);
  });
  await Promise.all(tasks);
  foes.forEach((p) => schedulePersist(p.id));
}
