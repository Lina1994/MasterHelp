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
  private cache: Record<string, { list: SpellSummary[]; map: Record<string, SpellDetail>; mtime: number }> = {};
  private baseDir: string;

  constructor() {
    // Align with ManualsService approach: backend as cwd, data under backend/data/spells
    this.baseDir = resolve(process.cwd(), 'data', 'spells');
  }

  /**
   * Loads spells for a locale from backend/data/spells/spells.<lang>.json
   * and caches them in memory. Input file contains an array of details.
   */
  private load(lang: 'en' | 'es') {
  const file = join(this.baseDir, `spells.${lang}.json`);
    try {
      const mtime = statSync(file).mtimeMs;
      const cached = this.cache[lang];
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
      this.cache[lang] = { list, map, mtime };
      return this.cache[lang];
    } catch {
      // If file stat/read fails, keep (or create) an empty cache
      if (!this.cache[lang]) this.cache[lang] = { list: [], map: {}, mtime: 0 };
      return this.cache[lang];
    }
  }

  list(lang: 'en' | 'es', filters?: { search?: string; level?: number; school?: string; concentration?: boolean; ritual?: boolean }): SpellSummary[] {
    const { list } = this.load(lang);
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

  getById(lang: 'en' | 'es', id: string): SpellDetail | undefined {
    const { map } = this.load(lang);
    return map[id];
  }

  listPaged(
    lang: 'en' | 'es',
    params: { search?: string; level?: number; school?: string; concentration?: boolean; ritual?: boolean; page?: number; pageSize?: number; sortBy?: 'name' | 'level' | 'school'; sortDir?: 'asc' | 'desc' }
  ): { items: SpellSummary[]; total: number } {
    const all = this.list(lang, { search: params.search, level: params.level, school: params.school, concentration: params.concentration, ritual: params.ritual });
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

  meta(lang: 'en' | 'es'): { levels: number[]; schools: string[] } {
    const { list } = this.load(lang);
    const levels = Array.from(new Set(list.map(s => s.level))).sort((a,b) => a-b);
    const schools = Array.from(new Set(list.map(s => s.school))).sort((a,b) => a.localeCompare(b));
    return { levels, schools };
  }
}
