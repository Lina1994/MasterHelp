/**
 * Monster domain types for the Bestiary (D&D 5e SRD 5.1, 2014).
 * These types are used across Repository/Service/Controller for type-safety.
 */

export type LanguageCode = 'en' | 'es';

export type Size = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface MonsterIndexItem {
  id: string;
  slug: string;
  name: string;
  type: string;
  size: Size;
  alignment?: string;
  challengeRating?: string; // supports fractions like "1/8"
  translated?: boolean; // when lang=es and content cloned from en
}

export interface ArmorClass {
  value: number;
  type?: string; // e.g., natural armor, armor, mage armor
  notes?: string;
}

export interface HitPoints {
  average: number;
  roll?: string; // e.g., 8d8+8
}

export interface Speed {
  walk?: number;
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
}

export interface Abilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type SavingThrows = Partial<Record<AbilityKey, number>>;

export type SkillMap = Partial<Record<string, number>>; // e.g., { perception: +4 }

export interface SenseMap {
  passivePerception?: number;
  blindsight?: string; // e.g., '60 ft.'
  darkvision?: string;
  tremorsense?: string;
  truesight?: string;
  [k: string]: unknown;
}

export interface TextBlock {
  name?: string;
  text: string;
}

export interface SpellcastingBlock {
  header?: string; // e.g., 'Innate Spellcasting' or 'Spellcasting'
  description?: string; // free text
  atWill?: string[]; // names of spells
  daily?: Record<'1/day' | '2/day' | '3/day', string[]>;
  slots?: Array<{ level: number; slots: number; spells: string[] }>;
}

export interface MonsterDetail extends MonsterIndexItem {
  lang: LanguageCode;
  source?: string; // e.g., 'SRD 5.1'
  size: Size;
  type: string;
  subtype?: string;
  alignment?: string;
  armorClass: ArmorClass;
  hitPoints: HitPoints;
  speed: Speed;
  abilities: Abilities;
  savingThrows?: SavingThrows;
  skills?: SkillMap;
  damageVulnerabilities?: string[];
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses?: SenseMap;
  languages?: string;
  proficiencyBonus?: number;
  challengeRating?: string;
  traits?: TextBlock[];
  actions?: TextBlock[];
  reactions?: TextBlock[];
  legendaryActions?: TextBlock[];
  lairActions?: TextBlock[];
  regionalEffects?: TextBlock[];
  spellcasting?: SpellcastingBlock[];
  environment?: string[];
  sourcePage?: string;
  notes?: string[];
}

export interface MonsterIndexFile {
  lang: LanguageCode;
  items: MonsterIndexItem[];
}
