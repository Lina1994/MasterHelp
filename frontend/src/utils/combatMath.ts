/**
 * Utilities for combat-related math.
 * Contains pure functions used across combat views.
 */

/**
 * Computes DEX ability modifier from an ability score.
 * @param score - The Dexterity ability score (e.g., 10, 14).
 * @returns The ability modifier as an integer.
 */
export function dexMod(score?: number): number {
  if (!score || Number.isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}

export type DiceRollSpec = { dice: number; sides: number; mod: number };

/**
 * Parses a dice roll expression like "3d8+2" or "2D6 - 1".
 * @param expr - The textual dice expression.
 * @returns A structured spec `{ dice, sides, mod }` or null if invalid.
 */
export function parseDiceRoll(expr?: string): DiceRollSpec | null {
  if (!expr) return null;
  const m = expr.match(/^(\d+)\s*[dD]\s*(\d+)(\s*[+-]\s*\d+)?\s*$/);
  if (!m) return null;
  const dice = Number(m[1]);
  const sides = Number(m[2]);
  const mod = m[3] ? Number(m[3].replace(/\s+/g, '')) : 0;
  if (!Number.isFinite(dice) || !Number.isFinite(sides) || dice <= 0 || sides <= 0) return null;
  return { dice, sides, mod };
}
