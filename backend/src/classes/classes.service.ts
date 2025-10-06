import { Injectable } from '@nestjs/common';
import { readFileSync, statSync, readdirSync } from 'fs';
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
  private cache: Record<string, { list: CharacterClass[]; mtime: number; fileCount?: number }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  private getBaseDir(manualId?: string) {
    const safeManual = (manualId || this.defaultManualId).replace(/[^a-zA-Z0-9-_]/g, '');
    return resolve(process.cwd(), 'data', 'manuals', safeManual, 'classes');
  }

  private load(lang: 'en' | 'es', manualId?: string) {
    const baseDir = this.getBaseDir(manualId);
    const cacheKey = `${manualId || this.defaultManualId}:${lang}`;

    // 1) Preferred: per-class directory backend/data/manuals/<manual>/classes/<lang>/*.json
    const langDir = join(baseDir, lang);
    try {
      const dirStat = statSync(langDir);
      if (dirStat.isDirectory()) {
        const fileNames = readdirSync(langDir).filter(f => f.toLowerCase().endsWith('.json'));
        // Compute a simple freshness signature
        let maxMtime = 0;
        for (const fn of fileNames) {
          try {
            const s = statSync(join(langDir, fn));
            if (s.mtimeMs > maxMtime) maxMtime = s.mtimeMs;
          } catch { /* skip */ }
        }
        const cached = this.cache[cacheKey];
        if (cached && cached.mtime === maxMtime && cached.fileCount === fileNames.length) return cached;

        const list: CharacterClass[] = [];
        for (const fn of fileNames) {
          try {
            const raw = readFileSync(join(langDir, fn), 'utf-8');
            const obj = JSON.parse(raw);
            if (obj && obj.id && obj.name) list.push(obj);
          } catch {
            // Skip malformed file
          }
        }
        // Cache and return
        this.cache[cacheKey] = { list, mtime: maxMtime, fileCount: fileNames.length };
        return this.cache[cacheKey];
      }
    } catch {
      // Directory missing; fall back to monolithic
    }

    // 2) Fallback: monolithic file backend/data/manuals/<manual>/classes/classes.<lang>.json
    const file = join(baseDir, `classes.${lang}.json`);
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
