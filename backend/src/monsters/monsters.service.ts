import { Injectable } from '@nestjs/common';
import { MonstersRepository } from './monsters.repository';
import { CustomManualsService } from '../manuals/custom-manuals.service';
import type { LanguageCode, MonsterDetail, MonsterIndexItem } from './monster.types';

/**
 * EN canonical type -> Spanish SRD v5.2 synonyms. Used to normalise
 * the Spanish `it.type` strings (e.g. "Humanoide (Cualquier Raza)",
 * "Muerto viviente", "Elemental") to the EN-canonical key sent by the
 * UI filter dropdown. Without this normalisation, any filter fired on
 * a Spanish list would always return empty results.
 */
const EN_TO_ES_TYPE_SYNONYMS: Record<string, string[]> = {
  aberration: ['aberración', 'aberracion'],
  beast: ['bestia'],
  celestial: ['celestial'],
  construct: ['constructo'],
  dragon: ['dragón', 'dragon'],
  elemental: ['elemental'],
  fey: ['feérico', 'feerico'],
  fiend: ['infernal'],
  giant: ['gigante'],
  humanoid: ['humanoide'],
  monstrosity: ['monstruosidad'],
  ooze: ['cieno'],
  plant: ['planta'],
  undead: ['muerto viviente', 'no-muerto', 'no muerto'],
};

/** EN canonical size -> Spanish SRD v5.2 size tokens (incl. gender). */
const EN_TO_ES_SIZE: Record<string, string[]> = {
  tiny: ['diminuto', 'diminuta', 'menudo', 'menuda'],
  small: ['pequeño', 'pequeña'],
  medium: ['mediano', 'mediana'],
  large: ['grande'],
  huge: ['enorme'],
  gargantuan: ['gargantuesco', 'gargantuesca'],
};

function canonicalTypeKey(rawType: string | undefined, lang: LanguageCode): string {
  if (!rawType) return '';
  // Strip parenthetical subtype "Humanoide (Cualquier Raza)" → "Humanoide".
  const head = rawType.toLowerCase().split('(')[0].trim();
  for (const [enKey, syns] of Object.entries(EN_TO_ES_TYPE_SYNONYMS)) {
    if (lang === 'es') {
      for (const syn of syns) {
        if (head === syn || head.startsWith(syn + ' ')) return enKey;
      }
    }
    if (head === enKey || head.startsWith(enKey + ' ')) return enKey;
  }
  return head;
}

function canonicalSizeKey(size: string | undefined): string {
  if (!size) return '';
  const lower = size.toLowerCase().trim();
  for (const [enKey, syns] of Object.entries(EN_TO_ES_SIZE)) {
    for (const syn of syns) {
      if (lower === syn) return enKey;
    }
    if (lower === enKey) return enKey;
  }
  return lower;
}

@Injectable()
export class MonstersService {
  private readonly repo = new MonstersRepository();
  private dbCache: Record<string, { list: MonsterIndexItem[]; map: Record<string, MonsterDetail>; ts: number }> = {};

  constructor(private readonly customManualsService: CustomManualsService) {}

  list(manualId: string, lang: LanguageCode, filters?: { q?: string; type?: string; size?: string; crMin?: string; crMax?: string }): MonsterIndexItem[] {
    const items = this.repo.list(lang, manualId);

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
      if (type) {
        const key = canonicalTypeKey(it.type, lang);
        if (key !== type) return false;
      }
      if (size) {
        const key = canonicalSizeKey(it.size);
        if (key !== size) return false;
      }
      const itemCr = parseCr(it.challengeRating);
      if (crMin !== undefined && (itemCr === undefined || itemCr < crMin)) return false;
      if (crMax !== undefined && (itemCr === undefined || itemCr > crMax)) return false;
      return true;
    });
  }

  get(manualId: string, lang: LanguageCode, slug: string): MonsterDetail | null {
    return this.repo.get(lang, slug, manualId);
  }

  /* ═══════════════ Async variants with DB manual fallback ═══════════════ */

  /**
   * Loads monsters from DB manual entries when no file-based data is found.
   */
  private async loadFromDb(lang: LanguageCode, manualId: string) {
    const cacheKey = `db:${manualId}:${lang}`;
    const cached = this.dbCache[cacheKey];
    if (cached) return cached;

    const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'monster', lang);
    const list: MonsterIndexItem[] = [];
    const map: Record<string, MonsterDetail> = {};
    for (const e of entries) {
      const d = e.data as any;
      const slug = e.entryKey;
      const indexItem: MonsterIndexItem = {
        id: slug,
        slug,
        name: d.name || slug,
        type: d.type ?? 'Unknown',
        size: d.size ?? 'Medium',
        alignment: d.alignment,
        challengeRating: d.challengeRating,
      };
      list.push(indexItem);
      map[slug] = {
        ...indexItem,
        lang,
        armorClass: d.armorClass ?? { value: 10 },
        hitPoints: d.hitPoints ?? { average: 1 },
        speed: d.speed ?? {},
        abilities: d.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        savingThrows: d.savingThrows,
        skills: d.skills,
        damageVulnerabilities: d.damageVulnerabilities,
        damageResistances: d.damageResistances,
        damageImmunities: d.damageImmunities,
        conditionImmunities: d.conditionImmunities,
        senses: d.senses,
        languages: d.languages,
        proficiencyBonus: d.proficiencyBonus,
        traits: d.traits,
        actions: d.actions,
        reactions: d.reactions,
        legendaryActions: d.legendaryActions,
        lairActions: d.lairActions,
        regionalEffects: d.regionalEffects,
        spellcasting: d.spellcasting,
        environment: d.environment,
        source: d.source,
        sourcePage: d.sourcePage,
        notes: d.notes,
        subtype: d.subtype,
      };
    }
    this.dbCache[cacheKey] = { list, map, ts: Date.now() };
    return this.dbCache[cacheKey];
  }

  /**
   * Async version of list() with DB manual fallback.
   */
  async listAsync(
    manualId: string,
    lang: LanguageCode,
    filters?: { q?: string; type?: string; size?: string; crMin?: string; crMax?: string },
  ): Promise<MonsterIndexItem[]> {
    const fileItems = this.list(manualId, lang, filters);
    if (fileItems.length > 0) return fileItems;

    const { list } = await this.loadFromDb(lang, manualId);
    if (!filters) return list;

    const normalized = (s?: string) => s?.toString().trim().toLowerCase();
    const parseCr = (s?: string) => {
      if (!s) return undefined;
      if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : undefined; }
      const n = Number(s); return Number.isFinite(n) ? n : undefined;
    };
    const q = normalized(filters.q);
    const type = normalized(filters.type);
    const size = normalized(filters.size);
    const crMin = parseCr(filters.crMin);
    const crMax = parseCr(filters.crMax);

    return list.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (type) {
        const key = canonicalTypeKey(it.type, lang);
        if (key !== type) return false;
      }
      if (size) {
        const key = canonicalSizeKey(it.size);
        if (key !== size) return false;
      }
      const itemCr = parseCr(it.challengeRating);
      if (crMin !== undefined && (itemCr === undefined || itemCr < crMin)) return false;
      if (crMax !== undefined && (itemCr === undefined || itemCr > crMax)) return false;
      return true;
    });
  }

  /**
   * Async version of get() with DB manual fallback.
   */
  async getAsync(manualId: string, lang: LanguageCode, slug: string): Promise<MonsterDetail | null> {
    const fileResult = this.get(manualId, lang, slug);
    if (fileResult) return fileResult;

    const { map } = await this.loadFromDb(lang, manualId);
    return map[slug] ?? null;
  }
}
