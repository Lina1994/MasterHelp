import { Injectable } from '@nestjs/common';
import { MonstersRepository } from './monsters.repository';
import type { LanguageCode, MonsterDetail, MonsterIndexItem } from './monster.types';

@Injectable()
export class MonstersService {
  private readonly repo = new MonstersRepository();

  list(lang: LanguageCode, filters?: { q?: string; type?: string; size?: string; crMin?: string; crMax?: string }): MonsterIndexItem[] {
    const items = this.repo.list(lang);

    const normalized = (s?: string) => s?.toString().trim().toLowerCase();
    const parseCr = (s?: string) => {
      if (!s) return undefined;
      if (s.includes('/')) {
        const [a, b] = s.split('/').map(Number);
        return b ? a / b : undefined;
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    };

    const q = normalized(filters?.q);
    const type = normalized(filters?.type);
    const size = normalized(filters?.size);
    const crMin = parseCr(filters?.crMin);
    const crMax = parseCr(filters?.crMax);

    return items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (type && (it.type ? it.type.toLowerCase() !== type : true)) return false;
      if (size && (it.size ? it.size.toLowerCase() !== size : true)) return false;
      const itemCr = parseCr(it.challengeRating);
      if (crMin !== undefined && (itemCr === undefined || itemCr < crMin)) return false;
      if (crMax !== undefined && (itemCr === undefined || itemCr > crMax)) return false;
      return true;
    });
  }

  get(lang: LanguageCode, slug: string): MonsterDetail | null {
    return this.repo.get(lang, slug);
  }
}
