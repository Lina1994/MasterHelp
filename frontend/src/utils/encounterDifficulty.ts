/**
 * D&D 5e encounter difficulty helpers.
 *
 * Computes the adjusted enemy XP and the party XP thresholds (Easy/Medium/
 * Hard/Deadly) so the UI can place the encounter on a continuous colored scale
 * rather than just reporting a single band.
 */

/** XP thresholds per character level: [easy, medium, hard, deadly]. */
const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],
  20: [2800, 5700, 8500, 12700],
};

/** XP awarded per challenge rating. */
const CR_XP: Record<number, number> = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900,
  9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000,
  23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
};

export type DifficultyBand = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';

export interface EncounterThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

export interface EncounterDifficultyResult {
  thresholds: EncounterThresholds;
  /** Raw enemy XP (sum of CR XP). */
  rawXp: number;
  /** XP after applying the encounter-size multiplier. */
  adjustedXp: number;
  multiplier: number;
  band: DifficultyBand;
  partyCount: number;
  enemyCount: number;
}

/** Encounter-size XP multiplier based on the number of enemies. */
function encounterMultiplier(enemyCount: number): number {
  if (enemyCount <= 1) return 1;
  if (enemyCount === 2) return 1.5;
  if (enemyCount <= 6) return 2;
  if (enemyCount <= 10) return 2.5;
  if (enemyCount <= 14) return 3;
  return 4;
}

/** Clamps a level into the 1..20 supported range. */
function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(20, Math.round(level)));
}

/** Looks up the XP for a challenge rating, snapping to the nearest known CR. */
export function crToXp(cr: number): number {
  if (!Number.isFinite(cr) || cr < 0) return 0;
  if (CR_XP[cr] !== undefined) return CR_XP[cr];
  // Snap to the nearest known CR key.
  const keys = Object.keys(CR_XP).map(Number);
  let nearest = keys[0];
  for (const k of keys) {
    if (Math.abs(k - cr) < Math.abs(nearest - cr)) nearest = k;
  }
  return CR_XP[nearest] ?? 0;
}

/**
 * Computes encounter difficulty from the active party levels and enemy CRs.
 *
 * @param partyLevels - Levels of the (alive) player-character allies.
 * @param enemyCrs - Challenge ratings of the (alive) enemies.
 */
export function computeEncounterDifficulty(partyLevels: number[], enemyCrs: number[]): EncounterDifficultyResult {
  const thresholds = partyLevels.reduce<EncounterThresholds>(
    (acc, lvl) => {
      const t = XP_THRESHOLDS[clampLevel(lvl)];
      return {
        easy: acc.easy + t[0],
        medium: acc.medium + t[1],
        hard: acc.hard + t[2],
        deadly: acc.deadly + t[3],
      };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 },
  );

  const rawXp = enemyCrs.reduce((sum, cr) => sum + crToXp(cr), 0);
  const multiplier = encounterMultiplier(enemyCrs.length);
  const adjustedXp = Math.round(rawXp * multiplier);

  let band: DifficultyBand;
  if (adjustedXp < thresholds.easy) band = 'trivial';
  else if (adjustedXp < thresholds.medium) band = 'easy';
  else if (adjustedXp < thresholds.hard) band = 'medium';
  else if (adjustedXp < thresholds.deadly) band = 'hard';
  else band = 'deadly';

  return {
    thresholds,
    rawXp,
    adjustedXp,
    multiplier,
    band,
    partyCount: partyLevels.length,
    enemyCount: enemyCrs.length,
  };
}

/** Spanish label for a difficulty band. */
export function difficultyLabel(band: DifficultyBand): string {
  switch (band) {
    case 'trivial': return 'Trivial';
    case 'easy': return 'Fácil';
    case 'medium': return 'Media';
    case 'hard': return 'Difícil';
    case 'deadly': return 'Mortal';
  }
}

/** Minimal participant shape needed to derive difficulty inputs. */
export interface DifficultyParticipant {
  role?: 'ally' | 'foe';
  kind?: 'character' | 'enemy';
  level?: number;
  cr?: number;
  /** Summons added during combat do not count toward difficulty. */
  isSummon?: boolean;
}

/**
 * Parses a challenge rating that may arrive as a number or as a string,
 * including fractional notations like "1/8", "1/4" or "1/2".
 *
 * @param value - CR as number or string (e.g. "1/4").
 * @returns The CR as a number (0 if it cannot be parsed).
 */
export function parseChallengeRating(value: string | number | undefined | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const s = String(value).trim();
  if (s.includes('/')) {
    const [a, b] = s.split('/').map((x) => Number(x));
    return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : 0;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Snaps an arbitrary value to the nearest valid 5e challenge rating
 * (0, 1/8, 1/4, 1/2, then 1..30).
 */
function snapToValidCr(raw: number): number {
  if (raw <= 0) return 0;
  if (raw < 1) {
    const fractional = [0, 0.125, 0.25, 0.5, 1];
    let best = fractional[0];
    for (const c of fractional) {
      if (Math.abs(c - raw) < Math.abs(best - raw)) best = c;
    }
    return best;
  }
  return Math.max(1, Math.min(30, Math.round(raw)));
}

/**
 * Approximates the challenge rating of a player character used as an enemy
 * from its level. A PC level does not map 1:1 to a CR, so a tiered factor is
 * applied (lower factor at low levels, higher at high levels) and the result
 * is snapped to the nearest valid CR.
 *
 * Tiers: lvl 1-4 → /2, lvl 5-10 → ×0.65, lvl 11-16 → ×0.7, lvl 17-20 → ×0.75.
 *
 * @param level - Character level (1..20).
 * @returns An approximate challenge rating snapped to a valid CR (0..30).
 */
export function levelToApproxCr(level: number): number {
  if (!Number.isFinite(level) || level <= 0) return 0;
  const lvl = Math.max(1, Math.min(20, Math.round(level)));
  let raw: number;
  if (lvl <= 4) raw = lvl / 2;
  else if (lvl <= 10) raw = lvl * 0.65;
  else if (lvl <= 16) raw = lvl * 0.7;
  else raw = lvl * 0.75;
  return snapToValidCr(raw);
}

/** Formats a CR value as a short label (e.g. 0.25 → "1/4"). */
export function formatCr(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
}

/**
 * Derives the party levels and enemy CRs expected by
 * {@link computeEncounterDifficulty} from a list of encounter participants.
 *
 * Player characters used as enemies (role "foe", kind "character") have no CR,
 * so their level is converted to an approximate CR via {@link levelToApproxCr}.
 *
 * @param participants - Encounter participants (allies and foes).
 * @returns Levels of the allies and challenge ratings of the foes.
 */
export function participantsToDifficultyInputs(
  participants: DifficultyParticipant[],
): { partyLevels: number[]; enemyCrs: number[] } {
  const partyLevels: number[] = [];
  const enemyCrs: number[] = [];
  for (const p of participants) {
    // Summons (temporary combat additions) never count toward difficulty.
    if (p.isSummon) continue;
    if (p.role === 'foe') {
      if (p.kind === 'character') {
        enemyCrs.push(typeof p.level === 'number' ? levelToApproxCr(p.level) : 0);
      } else {
        enemyCrs.push(typeof p.cr === 'number' ? p.cr : 0);
      }
    } else {
      partyLevels.push(typeof p.level === 'number' && p.level > 0 ? p.level : 1);
    }
  }
  return { partyLevels, enemyCrs };
}

/** Participant shape that can be resolved against live data by id. */
export interface ResolvableParticipant extends DifficultyParticipant {
  id?: string;
}

/** Hooks to resolve participant data from live sources (characters/bestiary). */
export interface DifficultyResolvers {
  /** Returns the live level for a character participant id, if known. */
  characterLevel?: (id: string) => number | undefined;
}

/**
 * Resolves the difficulty inputs for a list of participants, preferring live
 * character levels over the (possibly stale) levels stored on the encounter.
 *
 * This is the single source of truth shared by the encounter form and the
 * combat view so both compute identical difficulty for the same encounter.
 *
 * @param participants - Participants (with optional id).
 * @param resolvers - Optional live-data resolvers (e.g. character level by id).
 * @returns Party levels and enemy CRs ready for {@link computeEncounterDifficulty}.
 */
export function resolveDifficultyInputs(
  participants: ResolvableParticipant[],
  resolvers?: DifficultyResolvers,
): { partyLevels: number[]; enemyCrs: number[] } {
  const resolved: DifficultyParticipant[] = participants.map((p) => {
    const liveLevel = p.id ? resolvers?.characterLevel?.(p.id) : undefined;
    return {
      role: p.role,
      kind: p.kind,
      level: liveLevel ?? p.level,
      cr: p.cr,
      isSummon: p.isSummon,
    };
  });
  return participantsToDifficultyInputs(resolved);
}
