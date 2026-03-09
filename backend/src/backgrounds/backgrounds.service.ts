import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

export interface BackgroundFeature {
  id: string;
  name: string;
  description?: string;
}

export interface Background {
  id: string;
  name: string;
  source?: string;
  description?: string;
  skillProficiencies?: string[];
  toolProficiencies?: string[];
  languages?: number;
  equipment?: string[];
  feature?: BackgroundFeature;
  suggestedCharacteristics?: {
    personalityTraits?: string[];
    ideals?: string[];
    bonds?: string[];
    flaws?: string[];
  };
}

/**
 * Service to load and serve backgrounds data from manual-specific JSON files.
 * Data lives under backend/data/manuals/<manualId>/backgrounds/backgrounds.<lang>.json
 */
@Injectable()
export class BackgroundsService {
  /** Cache keyed by `${manualId}:${lang}` */
  private cache: Record<string, { list: Background[]; mtime: number }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  /**
   * Resolve base directory for backgrounds dataset of a manual.
   */
  private getBaseDir(manualId?: string) {
    const safeManual = (manualId || this.defaultManualId).replace(/[^a-zA-Z0-9-_]/g, '');
    return resolve(process.cwd(), 'data', 'manuals', safeManual, 'backgrounds');
  }

  /**
   * Load and cache backgrounds from backend/data/manuals/<manualId>/backgrounds/backgrounds.<lang>.json
   * If file is missing, returns empty list.
   */
  private load(lang: 'en' | 'es', manualId?: string) {
    const baseDir = this.getBaseDir(manualId);
    const file = join(baseDir, `backgrounds.${lang}.json`);
    const cacheKey = `${manualId || this.defaultManualId}:${lang}`;
    try {
      const mtime = statSync(file).mtimeMs;
      const cached = this.cache[cacheKey];
      if (cached && cached.mtime === mtime) return cached;
      let data: Background[] = [];
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
   * Returns the list of backgrounds for a manual and language.
   * @param lang Locale code ('en' | 'es')
   * @param manualId Optional manual id; defaults to 'dnd5e-2014'
   * @returns Array of Background objects
   */
  list(lang: 'en' | 'es', manualId?: string): Background[] {
    return this.load(lang, manualId).list;
  }

  /**
   * Returns a background by id.
   * @param lang Locale code ('en' | 'es')
   * @param id Background id (stable across locales)
   * @param manualId Optional manual id; defaults to 'dnd5e-2014'
   * @returns Background or undefined if not found
   */
  getById(lang: 'en' | 'es', id: string, manualId?: string): Background | undefined {
    const { list } = this.load(lang, manualId);
    return list.find(b => b.id === id);
  }
}
