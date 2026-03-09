import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Represents a single trait from a D&D manual (e.g. Darkvision, Rage).
 */
export interface Trait {
  id: string;
  name: string;
  description: string;
  source?: string;
}

/**
 * Service to load and serve traits data from manual-specific JSON files.
 * Data lives under backend/data/manuals/<manualId>/traits/traits.<lang>.json
 */
@Injectable()
export class TraitsService {
  /** Cache keyed by `${manualId}:${lang}` */
  private cache: Record<string, { list: Trait[]; mtime: number }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  /**
   * Resolve base directory for traits dataset of a manual.
   */
  private getBaseDir(manualId?: string) {
    const safeManual = (manualId || this.defaultManualId).replace(/[^a-zA-Z0-9-_]/g, '');
    return resolve(process.cwd(), 'data', 'manuals', safeManual, 'traits');
  }

  /**
   * Load and cache traits from the JSON file.
   */
  private load(lang: 'en' | 'es', manualId?: string) {
    const baseDir = this.getBaseDir(manualId);
    const file = join(baseDir, `traits.${lang}.json`);
    const cacheKey = `${manualId || this.defaultManualId}:${lang}`;
    try {
      const mtime = statSync(file).mtimeMs;
      const cached = this.cache[cacheKey];
      if (cached && cached.mtime === mtime) return cached;
      let data: Trait[] = [];
      try {
        data = JSON.parse(readFileSync(file, 'utf-8'));
      } catch { data = []; }
      this.cache[cacheKey] = { list: data, mtime };
      return this.cache[cacheKey];
    } catch {
      if (!this.cache[cacheKey]) this.cache[cacheKey] = { list: [], mtime: 0 };
      return this.cache[cacheKey];
    }
  }

  /**
   * List all traits from a manual.
   * @param lang Language code
   * @param manualId Manual identifier
   * @returns Array of Trait objects
   */
  list(lang: 'en' | 'es', manualId?: string): Trait[] {
    return this.load(lang, manualId).list;
  }

  /**
   * Get a single trait by ID.
   * @param lang Language code
   * @param id Trait id (e.g. "darkvision")
   * @param manualId Manual identifier
   * @returns Trait or undefined
   */
  getById(lang: 'en' | 'es', id: string, manualId?: string): Trait | undefined {
    const { list } = this.load(lang, manualId);
    return list.find(t => t.id === id);
  }
}
