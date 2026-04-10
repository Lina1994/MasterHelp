import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { CustomManualsService } from '../manuals/custom-manuals.service';

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

  constructor(private readonly customManualsService: CustomManualsService) {}

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

  /* ═══════════════ Async variants with DB manual fallback ═══════════════ */

  /**
   * Loads traits from DB manual entries when no file-based data is found.
   */
  private async loadFromDb(lang: 'en' | 'es', manualId: string) {
    const cacheKey = `db:${manualId}:${lang}`;
    const cached = this.cache[cacheKey];
    if (cached) return cached;

    const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'trait', lang);
    const list: Trait[] = entries.map((e) => ({
      id: e.entryKey,
      name: (e.data as any).name || e.entryKey,
      description: (e.data as any).description ?? '',
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
  async listAsync(lang: 'en' | 'es', manualId?: string): Promise<Trait[]> {
    const { list } = await this.loadAsync(lang, manualId);
    return list;
  }

  /**
   * Async version of getById() with DB manual fallback.
   */
  async getByIdAsync(lang: 'en' | 'es', id: string, manualId?: string): Promise<Trait | undefined> {
    const { list } = await this.loadAsync(lang, manualId);
    return list.find(t => t.id === id);
  }
}
