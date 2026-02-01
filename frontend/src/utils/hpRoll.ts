import type { EncounterSummary } from '../api/encounters';
import type { MonsterDetail, MonsterIndexItem } from '../types/monsters';
import { parseDiceRoll } from './combatMath';

/**
 * Roll and assign HP for all foes.
 * - In `avg` mode, uses monster average HP when available.
 * - In `dice` mode, rolls based on the monster roll expression; falls back to average.
 * @param mode - Roll mode: 'avg' or 'dice'
 * @param foes - List of foe participants
 * @param monstersIndex - Index of monsters (with manualId) for name fallback
 * @param fetchMonster - Function to fetch monster details
 * @param setHpLocal - Setter to update local HP fields (max/current)
 * @param schedulePersist - Debounced persist function to save participants
 */
export async function rollAllEnemiesHp(
  mode: 'avg' | 'dice',
  foes: EncounterSummary['participants'],
  monstersIndex: Array<MonsterIndexItem & { manualId: string; compositeId: string }>,
  fetchMonster: (manualId: string, slug: string, lang: 'es' | 'en') => Promise<MonsterDetail | undefined>,
  setHpLocal: (id: string, field: 'currentHp' | 'maxHp', value: number | undefined) => void,
  schedulePersist: (id: string) => void,
): Promise<void> {
  const tasks = foes.map(async (p) => {
    let hpAvg: number | undefined;
    let hpRollExpr: string | undefined;
    let manualId = p.monsterManualId;
    let slug = p.monsterSlug;
    if (!manualId || !slug) {
      const rawName = (p.name || '').trim();
      const strippedName = rawName.replace(/\s+[A-Z]+$/, '').trim();
      const key = strippedName.toLowerCase();
      const byName = (monstersIndex || []).find((m) => m.name.trim().toLowerCase() === key);
      if (byName) { manualId = byName.manualId; slug = byName.slug; }
    }
    if (manualId && slug) {
      try {
        const detail = await fetchMonster(manualId, slug, 'es').catch(() => fetchMonster(manualId!, slug!, 'en'));
        hpAvg = detail?.hitPoints?.average;
        hpRollExpr = detail?.hitPoints?.roll;
      } catch {}
    }
    let value: number | undefined;
    if (mode === 'avg') {
      value = typeof hpAvg === 'number' ? hpAvg : undefined;
    } else {
      const parsed = parseDiceRoll(hpRollExpr);
      if (parsed) {
        const rolls = Array.from({ length: parsed.dice }, () => 1 + Math.floor(Math.random() * parsed.sides));
        value = rolls.reduce((a, b) => a + b, 0) + parsed.mod;
      } else if (typeof hpAvg === 'number') {
        value = hpAvg;
      }
    }
    if (typeof value === 'number' && value > 0) {
      setHpLocal(p.id, 'maxHp', value);
      setHpLocal(p.id, 'currentHp', value);
    }
  });
  await Promise.all(tasks);
  foes.forEach((p) => schedulePersist(p.id));
}
