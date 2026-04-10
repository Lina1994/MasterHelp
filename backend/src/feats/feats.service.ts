import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { CustomManualsService } from '../manuals/custom-manuals.service';

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

  constructor(private readonly customManualsService: CustomManualsService) {}

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

  /* ═══════════════ Async variants with DB manual fallback ═══════════════ */

  /**
   * Loads feats from DB manual entries when no file-based data is found.
   */
  private async loadFromDb(lang: 'en' | 'es', manualId: string) {
    const cacheKey = `db:${manualId}:${lang}`;
    const cached = this.cache[cacheKey];
    if (cached) return cached;

    const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'feat', lang);
    const list: Feat[] = entries.map((e) => ({
      id: e.entryKey,
      name: (e.data as any).name || e.entryKey,
      description: (e.data as any).description ?? '',
      prerequisite: (e.data as any).prerequisite,
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
  async listAsync(lang: 'en' | 'es', manualId?: string): Promise<Feat[]> {
    const { list } = await this.loadAsync(lang, manualId);
    return list;
  }

  /**
   * Async version of getById() with DB manual fallback.
   */
  async getByIdAsync(lang: 'en' | 'es', id: string, manualId?: string): Promise<Feat | undefined> {
    const { list } = await this.loadAsync(lang, manualId);
    return list.find(f => f.id === id);
  }
}
