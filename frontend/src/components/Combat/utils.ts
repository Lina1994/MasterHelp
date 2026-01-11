import type { EncounterSummary } from '../../api/encounters';

/**
 * Remove trailing uppercase letter group suffix (e.g., " A", "B", "AA")
 * appended to distinguish repeated enemy names.
 */
export function stripGroupSuffix(name: string): string {
  const base = (name || '').trim();
  return base.replace(/\s+[A-Z]+$/, '');
}

/**
 * Convert a zero-based index into letters (A, B, ..., Z, AA, AB, ...)
 * used to label repeated enemies.
 */
export function indexToLetters(idx: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let n = idx;
  let out = '';
  do {
    out = letters[n % 26] + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Skill names ES mapping */
const skillNameEs: Record<string, string> = {
  athletics: 'Atletismo',
  acrobatics: 'Acrobacias',
  sleightOfHand: 'Juego de manos',
  stealth: 'Sigilo',
  arcana: 'Arcanos',
  history: 'Historia',
  investigation: 'Investigación',
  nature: 'Naturaleza',
  religion: 'Religión',
  animalHandling: 'Manejo de animales',
  insight: 'Perspicacia',
  medicine: 'Medicina',
  perception: 'Percepción',
  survival: 'Supervivencia',
  deception: 'Engaño',
  intimidation: 'Intimidación',
  performance: 'Interpretación',
  persuasion: 'Persuasión',
};

/** Map alternative keys to canonical ones for ES display */
const skillAltMap: Record<string, string> = {
  sleightofhand: 'sleightOfHand',
  animalhandling: 'animalHandling',
  passiveperception: 'perception',
};

/** Pretty print skill name in ES */
export function prettySkill(k: string): string {
  const key = k.trim().replace(/\s+/g, '').toLowerCase();
  const norm = skillAltMap[key] || key;
  return skillNameEs[norm] || k;
}

/** Sense names ES mapping */
const senseNameEs: Record<string, string> = {
  darkvision: 'Visión en la oscuridad',
  blindsight: 'Vista ciega',
  tremorsense: 'Sentido de vibración',
  truesight: 'Vista verdadera',
  passivePerception: 'Percepción pasiva',
};

/** Pretty print sense name in ES */
export function prettySense(k: string): string {
  return senseNameEs[k as any] || k;
}

/**
 * Build display names for enemies, adding letter suffixes when repeated.
 */
export function computeEnemyDisplayNameById(
  foes: EncounterSummary['participants'],
): Record<string, string> {
  const map: Record<string, string> = {};
  const groups = new Map<string, EncounterSummary['participants'][number][]>();
  foes.forEach((p) => {
    const key = (p.name || '').trim().toLowerCase();
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  });
  groups.forEach((arr) => {
    if (arr.length <= 1) {
      const only = arr[0];
      if (only) map[only.id] = only.name;
    } else {
      arr.forEach((p, idx) => { map[p.id] = `${p.name} ${indexToLetters(idx)}`; });
    }
  });
  return map;
}
