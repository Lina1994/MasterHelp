import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { CustomManualsService } from '../manuals/custom-manuals.service';

/**
 * Represents a single skill from a D&D manual (e.g. Acrobatics, Stealth).
 */
export interface Skill {
  id: string;
  name: string;
  ability: string; // str | dex | con | int | wis | cha
  description: string;
  source?: string;
}

/**
 * Service to load and serve skills data from manual-specific JSON files.
 * Data lives under backend/data/manuals/<manualId>/skills/skills.<lang>.json
 */
@Injectable()
export class SkillsService {
  /** Cache keyed by `${manualId}:${lang}` */
  private cache: Record<string, { list: Skill[]; mtime: number }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  constructor(private readonly customManualsService: CustomManualsService) {}

  /**
   * Resolve base directory for skills dataset of a manual.
   */
  private getBaseDir(manualId?: string) {
    const safeManual = (manualId || this.defaultManualId).replace(/[^a-zA-Z0-9-_]/g, '');
    return resolve(process.cwd(), 'data', 'manuals', safeManual, 'skills');
  }

  /**
   * Load and cache skills from the JSON file.
   */
  private load(lang: 'en' | 'es', manualId?: string) {
    const baseDir = this.getBaseDir(manualId);
    const file = join(baseDir, `skills.${lang}.json`);
    const cacheKey = `${manualId || this.defaultManualId}:${lang}`;
    try {
      const mtime = statSync(file).mtimeMs;
      const cached = this.cache[cacheKey];
      if (cached && cached.mtime === mtime) return cached;
      let data: Skill[] = [];
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
   * List all skills from a manual.
   * @param lang Language code
   * @param manualId Manual identifier
   * @returns Array of Skill objects
   */
  list(lang: 'en' | 'es', manualId?: string): Skill[] {
    return this.load(lang, manualId).list;
  }

  /**
   * Get a single skill by ID.
   * @param lang Language code
   * @param id Skill id (e.g. "stealth")
   * @param manualId Manual identifier
   * @returns Skill or undefined
   */
  getById(lang: 'en' | 'es', id: string, manualId?: string): Skill | undefined {
    const { list } = this.load(lang, manualId);
    return list.find(s => s.id === id);
  }

  /* ═══════════════ Async variants with DB manual fallback ═══════════════ */

  /**
   * Loads skills from DB manual entries when no file-based data is found.
   */
  private async loadFromDb(lang: 'en' | 'es', manualId: string) {
    const cacheKey = `db:${manualId}:${lang}`;
    const cached = this.cache[cacheKey];
    if (cached) return cached;

    const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'skill', lang);
    const list: Skill[] = entries.map((e) => ({
      id: e.entryKey,
      name: (e.data as any).name || e.entryKey,
      ability: (e.data as any).ability ?? '',
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
  async listAsync(lang: 'en' | 'es', manualId?: string): Promise<Skill[]> {
    const { list } = await this.loadAsync(lang, manualId);
    return list;
  }

  /**
   * Async version of getById() with DB manual fallback.
   */
  async getByIdAsync(lang: 'en' | 'es', id: string, manualId?: string): Promise<Skill | undefined> {
    const { list } = await this.loadAsync(lang, manualId);
    return list.find(s => s.id === id);
  }
}
