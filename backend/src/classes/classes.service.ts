import { Injectable } from '@nestjs/common';
import { readFileSync, statSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { CustomManualsService } from '../manuals/custom-manuals.service';

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

  constructor(
    private readonly customManualsService: CustomManualsService,
  ) {}

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

  /* ═══════════════ Async variants with DB manual fallback ═══════════════ */

  /**
   * Loads classes from DB manual entries when no file-based data is found.
   */
  private async loadFromDb(lang: 'en' | 'es', manualId: string) {
    const cacheKey = `db:${manualId}:${lang}`;
    const cached = this.cache[cacheKey];
    if (cached) return cached;

    const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'class', lang);
    const list: CharacterClass[] = entries.map((e) => ({
      id: e.entryKey,
      name: (e.data as any).name || e.entryKey,
      hitDie: (e.data as any).hitDie ?? 8,
      primaryAbilities: (e.data as any).primaryAbilities ?? [],
      savingThrows: (e.data as any).savingThrows ?? [],
      proficiencies: (e.data as any).proficiencies ?? {},
      skills: (e.data as any).skills ?? { choose: 0, from: [] },
      equipment: (e.data as any).equipment ?? [],
      features: (e.data as any).features ?? [],
      levels: (e.data as any).levels ?? [],
      subclasses: (e.data as any).subclasses,
      spellcasting: (e.data as any).spellcasting,
      spells: (e.data as any).spells,
      hitPoints: (e.data as any).hitPoints,
      source: (e.data as any).source,
    }));
    this.cache[cacheKey] = { list, mtime: Date.now() };
    return this.cache[cacheKey];
  }

  /**
   * Async load: tries file-based first, falls back to DB manual entries.
   */
  private async loadAsync(lang: 'en' | 'es', manualId?: string) {
    const fileResult = this.load(lang, manualId);
    if (fileResult.list.length > 0) return fileResult;
    if (!manualId) return fileResult;
    return this.loadFromDb(lang, manualId);
  }

  /**
   * Async version of list() with DB manual fallback.
   */
  async listAsync(lang: 'en' | 'es', manualId?: string): Promise<CharacterClass[]> {
    const { list } = await this.loadAsync(lang, manualId);
    return list;
  }

  /**
   * Async version of getById() with DB manual fallback.
   */
  async getByIdAsync(lang: 'en' | 'es', id: string, manualId?: string): Promise<CharacterClass | undefined> {
    const { list } = await this.loadAsync(lang, manualId);
    return list.find(r => r.id === id);
  }
}
