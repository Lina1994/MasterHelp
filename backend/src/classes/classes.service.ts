import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

export interface ClassSkillChoice { choose: number; from: string[] }
export interface ClassEquipmentOption { id: string; description: string }
export interface ClassEquipmentChoice { choose: number; options: ClassEquipmentOption[] }

export interface ClassFeatureEffect {
  type: string;
  [key: string]: any;
}

export interface ClassFeature {
  id: string;
  name: string;
  level: number;
  description: string; // markdown supported
  effects?: ClassFeatureEffect[];
}

export interface ClassLevelProgression {
  level: number;
  proficiencyBonus: number;
  features: string[]; // feature ids
  ragesPerLongRest?: number;
  rageDamageBonus?: number;
  extraAttack?: boolean;
  knownSpellsCount?: number;
  knownCantripsCount?: number;
  spellSlots?: Record<string, number>; // level -> slots
}

export interface Subclass {
  id: string;
  name: string;
  description?: string;
  grantedAtLevel: number;
  features: ClassFeature[];
}

export interface CharacterClass {
  id: string;
  name: string;
  source?: string;
  hitDie: number; // e.g., 12 for d12
  /**
   * Detailed hit points rules for the class.
   * hitDice: textual representation (e.g., "1d12 per barbarian level").
   * at1stLevel: formula or text for HP at level 1 (e.g., "12 + CON mod").
   * atHigherLevels: average or die + CON for levels after 1st (e.g., "1d12 (or 7) + CON mod").
   */
  hitPoints?: {
    hitDice: string;
    at1stLevel: string;
    atHigherLevels: string;
  };
  primaryAbilities: string[]; // e.g., ['str']
  savingThrows: string[]; // e.g., ['str','con']
  proficiencies: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
  };
  skills: ClassSkillChoice;
  equipment: ClassEquipmentChoice[];
  features: ClassFeature[];
  levels: ClassLevelProgression[];
  subclasses?: Subclass[];
  languages?: string[]; // rare
  spellcasting?: {
    ability?: string; // e.g., 'wis'
    progression?: 'full'|'half'|'third'|'pact'|'none';
  } | null;
  spells?: {
    // For spellcasting classes: list of spell ids or names per level for convenience (names must match spells dataset)
    byLevel?: Record<string, string[]>; // 'cantrip' or '1'..'9'
  } | null;
}

@Injectable()
export class ClassesService {
  private cache: Record<string, { list: CharacterClass[]; mtime: number }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  private getBaseDir(manualId?: string) {
    const safeManual = (manualId || this.defaultManualId).replace(/[^a-zA-Z0-9-_]/g, '');
    return resolve(process.cwd(), 'data', 'manuals', safeManual, 'classes');
  }

  private load(lang: 'en' | 'es', manualId?: string) {
    const baseDir = this.getBaseDir(manualId);
    const file = join(baseDir, `classes.${lang}.json`);
    const cacheKey = `${manualId || this.defaultManualId}:${lang}`;
    try {
      const mtime = statSync(file).mtimeMs;
      const cached = this.cache[cacheKey];
      if (cached && cached.mtime === mtime) return cached;
      let data: CharacterClass[] = [];
      try {
        data = JSON.parse(readFileSync(file, 'utf-8'));
      } catch {
        data = [];
      }
      this.cache[cacheKey] = { list: data, mtime };
      return this.cache[cacheKey];
    } catch {
      if (!this.cache[cacheKey]) this.cache[cacheKey] = { list: [], mtime: 0 };
      return this.cache[cacheKey];
    }
  }

  /**
   * Returns the list of classes for a manual and language.
   */
  list(lang: 'en' | 'es', manualId?: string): CharacterClass[] {
    return this.load(lang, manualId).list;
  }

  /**
   * Returns a class by id.
   */
  getById(lang: 'en' | 'es', id: string, manualId?: string): CharacterClass | undefined {
    const { list } = this.load(lang, manualId);
    return list.find(r => r.id === id);
  }
}
