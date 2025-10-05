import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

export interface SpellSummary {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  /** True if the spell requires concentration (derived from duration) */
  isConcentration?: boolean;
  /** True if the spell can be cast as a ritual (derived from school text) */
  isRitual?: boolean;
}

export interface SpellDetail extends SpellSummary {
  classes?: string[];
  materials?: string;
  ritual?: boolean;
  concentration?: boolean;
  description?: string; // markdown
  savingThrow?: string;
  areaOfEffect?: string;
}

@Injectable()
export class SpellsService {
  // Cache keyed by `${manualId}:${lang}`
  private cache: Record<string, { list: SpellSummary[]; map: Record<string, SpellDetail>; mtime: number }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  constructor() {
  }

  /**
   * Compute the base directory for a given manual's spells data.
   */
  private getBaseDir(manualId?: string) {
    const safeManual = (manualId || this.defaultManualId).replace(/[^a-zA-Z0-9-_]/g, '');
    return resolve(process.cwd(), 'data', 'manuals', safeManual, 'spells');
  }

  /**
   * Loads spells for a locale from backend/data/manuals/<manualId>/spells/spells.<lang>.json
   * and caches them in memory. Input file contains an array of details.
   */
  private load(lang: 'en' | 'es', manualId?: string) {
    const baseDir = this.getBaseDir(manualId);
    const file = join(baseDir, `spells.${lang}.json`);
    try {
      const mtime = statSync(file).mtimeMs;
      const cacheKey = `${manualId || this.defaultManualId}:${lang}`;
      const cached = this.cache[cacheKey];
      if (cached && cached.mtime === mtime) {
        return cached;
      }
      // If no cache or file changed, (re)load
      let data: SpellDetail[] = [];
      try {
        const raw = readFileSync(file, 'utf-8');
        data = JSON.parse(raw);
      } catch {
        data = [];
      }
      const map: Record<string, SpellDetail> = {};
      const list: SpellSummary[] = [];
      for (const s of data) {
        const isConcentration = typeof s.duration === 'string' && s.duration.toLowerCase().trim().startsWith('concentr');
        const isRitual = typeof s.school === 'string' && /\(\s*ritual\s*\)/i.test(s.school);
        const detail: SpellDetail = {
          ...s,
          concentration: isConcentration,
          ritual: isRitual,
          isConcentration,
          isRitual,
        } as SpellDetail;
        map[s.id] = detail;
        list.push({
          id: s.id,
          name: s.name,
          level: s.level,
          school: s.school,
          castingTime: s.castingTime,
          range: s.range,
          duration: s.duration,
          components: s.components,
          isConcentration,
          isRitual,
        });
      }
      this.cache[cacheKey] = { list, map, mtime };
      return this.cache[cacheKey];
    } catch {
      // If file stat/read fails, keep (or create) an empty cache
      const cacheKey = `${manualId || this.defaultManualId}:${lang}`;
      if (!this.cache[cacheKey]) this.cache[cacheKey] = { list: [], map: {}, mtime: 0 };
      return this.cache[cacheKey];
    }
  }

  /**
   * Returns a filtered list of spells.
   * @param lang Locale code ('en' | 'es')
   * @param filters Optional filters (search, level, school, concentration, ritual)
   * @param manualId Optional manual id; defaults to dnd5e-2014
   */
  list(lang: 'en' | 'es', filters?: { search?: string; level?: number; school?: string; concentration?: boolean; ritual?: boolean }, manualId?: string): SpellSummary[] {
    const { list } = this.load(lang, manualId);
    let out = list;
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      out = out.filter((s) =>
        s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q) || s.components.toLowerCase().includes(q)
      );
    }
    if (typeof filters?.level === 'number') {
      out = out.filter((s) => s.level === filters.level);
    }
    if (filters?.school) {
      const sc = filters.school.toLowerCase();
      out = out.filter((s) => s.school.toLowerCase() === sc);
    }
    if (typeof filters?.concentration === 'boolean') {
      out = out.filter((s) => !!s.isConcentration === filters.concentration);
    }
    if (typeof filters?.ritual === 'boolean') {
      out = out.filter((s) => !!s.isRitual === filters.ritual);
    }
    return out;
  }

  /**
   * Returns a spell detail by id.
   * @param lang Locale code ('en' | 'es')
   * @param id Spell id
   * @param manualId Optional manual id; defaults to dnd5e-2014
   */
  getById(lang: 'en' | 'es', id: string, manualId?: string): SpellDetail | undefined {
    const { map } = this.load(lang, manualId);
    return map[id];
  }

  listPaged(
    lang: 'en' | 'es',
    params: { search?: string; level?: number; school?: string; concentration?: boolean; ritual?: boolean; page?: number; pageSize?: number; sortBy?: 'name' | 'level' | 'school'; sortDir?: 'asc' | 'desc' },
    manualId?: string,
  ): { items: SpellSummary[]; total: number } {
    const all = this.list(lang, { search: params.search, level: params.level, school: params.school, concentration: params.concentration, ritual: params.ritual }, manualId);
    const total = all.length;
    let sorted = all;
    if (params.sortBy) {
      const dir = params.sortDir === 'desc' ? -1 : 1;
      const key = params.sortBy;
      sorted = [...all].sort((a: any, b: any) => {
        const av = a[key];
        const bv = b[key];
        if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
        return (av === bv ? 0 : av > bv ? 1 : -1) * dir;
      });
    }
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(200, params.pageSize || 25));
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);
    return { items, total };
  }

  /**
   * Returns basic metadata like existing levels and schools for filters.
   * @param lang Locale code ('en' | 'es')
   * @param manualId Optional manual id; defaults to dnd5e-2014
   */
  meta(lang: 'en' | 'es', manualId?: string): { levels: number[]; schools: string[] } {
    const { list } = this.load(lang, manualId);
    const levels = Array.from(new Set(list.map(s => s.level))).sort((a,b) => a-b);
    const schools = Array.from(new Set(list.map(s => s.school))).sort((a,b) => a.localeCompare(b));
    return { levels, schools };
  }
}
