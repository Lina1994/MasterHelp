import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Represents a single feat from a D&D manual.
 */
export interface Feat {
  id: string;
  name: string;
  prerequisite?: string | null;
  description: string;
  source?: string;
}

/**
 * Service to load and serve feats data from manual-specific JSON files.
 * Data lives under backend/data/manuals/<manualId>/feats/feats.<lang>.json
 */
@Injectable()
export class FeatsService {
  /** Cache keyed by `${manualId}:${lang}` */
  private cache: Record<string, { list: Feat[]; mtime: number }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  /**
   * Resolve base directory for feats dataset of a manual.
   */
  private getBaseDir(manualId?: string) {
    const safeManual = (manualId || this.defaultManualId).replace(/[^a-zA-Z0-9-_]/g, '');
    return resolve(process.cwd(), 'data', 'manuals', safeManual, 'feats');
  }

  /**
   * Load and cache feats from the JSON file.
   */
  private load(lang: 'en' | 'es', manualId?: string) {
    const baseDir = this.getBaseDir(manualId);
    const file = join(baseDir, `feats.${lang}.json`);
    const cacheKey = `${manualId || this.defaultManualId}:${lang}`;
    try {
      const mtime = statSync(file).mtimeMs;
      const cached = this.cache[cacheKey];
      if (cached && cached.mtime === mtime) return cached;
      let data: Feat[] = [];
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
   * List all feats from a manual.
   * @param lang Language code
   * @param manualId Manual identifier
   * @returns Array of Feat objects
   */
  list(lang: 'en' | 'es', manualId?: string): Feat[] {
    return this.load(lang, manualId).list;
  }

  /**
   * Get a single feat by ID.
   * @param lang Language code
   * @param id Feat id (e.g. "alert")
   * @param manualId Manual identifier
   * @returns Feat or undefined
   */
  getById(lang: 'en' | 'es', id: string, manualId?: string): Feat | undefined {
    const { list } = this.load(lang, manualId);
    return list.find(f => f.id === id);
  }
}
