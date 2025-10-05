import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

export interface AbilityBonuses {
  str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number;
}

export interface SpeedSpec { walk?: number; climb?: number; swim?: number; fly?: number; }

export interface ProficienciesSpec {
  weapons?: string[];
  armor?: string[];
  tools?: string[];
}

export interface SensesSpec { darkvision?: number; blindsight?: number; tremorsense?: number; truesight?: number; }

export type TraitEffect =
  | { type: 'advantage_saves'; vs: string[] }
  | { type: 'resistance'; damage: string[] }
  | { type: 'expertise_check'; skill: string; condition?: string }
  | { type: 'hp_per_level'; value: number };

export interface RaceTrait {
  id: string;
  name: string;
  effects: TraitEffect[];
}

export interface Subrace {
  id: string;
  name: string;
  abilityBonuses?: AbilityBonuses;
  proficiencies?: ProficienciesSpec;
  traits?: RaceTrait[];
}

export interface Race {
  id: string;
  name: string;
  source?: string;
  abilityBonuses?: AbilityBonuses;
  age?: { maturity?: number; max?: number };
  size: string;
  speed: SpeedSpec;
  languages?: string[];
  proficiencies?: ProficienciesSpec;
  senses?: SensesSpec;
  traits?: RaceTrait[];
  subraces?: Subrace[];
}

/**
 * Service to load and serve races data from manual-specific JSON files.
 * Data lives under backend/data/manuals/<manualId>/races/races.<lang>.json
 */
@Injectable()
export class RacesService {
  /** Cache keyed by `${manualId}:${lang}` */
  private cache: Record<string, { list: Race[]; mtime: number }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  /**
   * Resolve base directory for races dataset of a manual.
   */
  private getBaseDir(manualId?: string) {
    const safeManual = (manualId || this.defaultManualId).replace(/[^a-zA-Z0-9-_]/g, '');
    return resolve(process.cwd(), 'data', 'manuals', safeManual, 'races');
  }

  /**
   * Load and cache races from backend/data/manuals/<manualId>/races/races.<lang>.json
   * If file is missing, returns empty list.
   */
  private load(lang: 'en' | 'es', manualId?: string) {
    const baseDir = this.getBaseDir(manualId);
    const file = join(baseDir, `races.${lang}.json`);
    const cacheKey = `${manualId || this.defaultManualId}:${lang}`;
    try {
      const mtime = statSync(file).mtimeMs;
      const cached = this.cache[cacheKey];
      if (cached && cached.mtime === mtime) return cached;
      let data: Race[] = [];
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
   * Returns the list of races for a manual and language.
   * - Public API contract: returns full race objects (sized for small dataset), suitable for client filtering.
   * @param lang Locale code ('en' | 'es')
   * @param manualId Optional manual id; defaults to 'dnd5e-2014'
   * @returns Array of Race objects
   */
  list(lang: 'en' | 'es', manualId?: string): Race[] {
    return this.load(lang, manualId).list;
  }

  /**
   * Returns a race by id.
   * @param lang Locale code ('en' | 'es')
   * @param id Race id (stable across locales)
   * @param manualId Optional manual id; defaults to 'dnd5e-2014'
   * @returns Race or undefined if not found
   */
  getById(lang: 'en' | 'es', id: string, manualId?: string): Race | undefined {
    const { list } = this.load(lang, manualId);
    return list.find(r => r.id === id);
  }
}
