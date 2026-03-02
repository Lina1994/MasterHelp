export interface User {
  id: number;
  username: string;
  email: string;
  language?: string;
  theme?: string;
  /** JSON-serialised sidebar config, or null for defaults. */
  sidebarConfig?: string | null;
}

export interface SpellSummary {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  // Derived flags from backend for quick filtering/UI badges
  isConcentration?: boolean;
  isRitual?: boolean;
}

export interface SpellDetail extends SpellSummary {
  classes?: string[];
  materials?: string;
  ritual?: boolean;
  concentration?: boolean;
  description?: string; // markdown
  savingThrow?: string; // e.g., "DEX half"
  areaOfEffect?: string; // e.g., "Sphere 20 ft radius"
}

// ===== Classes & Progression =====

export interface ClassFeatureRef {
  id: string;
  name?: string;
}

export interface ClassLevelProgression {
  level: number;
  proficiencyBonus: number;
  features: string[]; // feature ids; resolve via CharacterClass.features
  // Optional fields depending on class type
  knownSpellsCount?: number;
  knownCantripsCount?: number;
  cantripsKnown?: number; // used by Wizard (ES/EN datasets)
  spellSlots?: Record<'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9', number>;
}

export interface ClassFeature {
  id: string;
  name: string;
  level: number;
  description?: string;
}

export interface CharacterClass {
  id: string;
  name: string;
  hitDie?: number;
  features?: ClassFeature[];
  levels: ClassLevelProgression[];
  spellcasting?: {
    ability?: string;
    progression?: 'full'|'half'|'third'|'pact'|'none';
    prepareFormula?: string;
    ritualCasting?: boolean;
    usesSpellbook?: boolean;
    cantripsKnown?: number;
    cantripsKnownUpgrades?: Record<string, number>;
  } | null;
  spells?: {
    byLevel?: Record<'cantrip'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9', string[]>;
  } | null;
}