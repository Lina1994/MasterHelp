export interface User {
  id: number;
  username: string;
  email: string;
  language?: string;
  theme?: string;
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