export interface MonsterIndexItem {
  id: string;
  slug: string;
  name: string;
  type?: string;
  size?: string;
  alignment?: string;
  challengeRating?: string;
  translated?: boolean;
}

export interface ArmorClass { value: number; type?: string }
export interface HitPoints { average: number; roll?: string }
export interface Speed { [k: string]: number | undefined }
export interface Abilities { str: number; dex: number; con: number; int: number; wis: number; cha: number }

export interface MonsterTrait { name: string; desc: string }

export interface MonsterDetail extends MonsterIndexItem {
  lang: 'en' | 'es';
  source?: string;
  sourcePage?: string;
  armorClass?: ArmorClass;
  hitPoints?: HitPoints;
  speed?: Speed;
  abilities?: Partial<Abilities>;
  savingThrows?: Partial<Abilities>;
  skills?: Record<string, number>;
  damageVulnerabilities?: string[];
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses?: Record<string, string | number>;
  languages?: string;
  proficiencyBonus?: number;
  traits?: MonsterTrait[];
  actions?: MonsterTrait[];
  reactions?: MonsterTrait[];
  legendaryActions?: MonsterTrait[];
  lairActions?: MonsterTrait[];
  regionalEffects?: MonsterTrait[];
  environment?: string[];
  notes?: string[];
}
