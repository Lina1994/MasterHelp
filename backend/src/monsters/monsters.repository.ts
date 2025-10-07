import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import type { LanguageCode, MonsterDetail, MonsterIndexFile, MonsterIndexItem } from './monster.types';

function safeManualId(manualId: string) {
  return manualId.replace(/[^a-zA-Z0-9-_]/g, '');
}

function baseDir(manualId: string) {
  return resolve(process.cwd(), 'data', 'manuals', safeManualId(manualId), 'monsters');
}

export class MonstersRepository {
  private indexCache: Record<string, { mtime: number; index: MonsterIndexFile | null }> = {};
  private itemCache: Record<string, { mtime: number; item: MonsterDetail | null }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  private readIndex(lang: LanguageCode, manualId?: string): MonsterIndexFile | null {
    const dir = baseDir(manualId || this.defaultManualId);
    const idxFile = join(dir, `index.${lang}.json`);
    try {
      const mtime = statSync(idxFile).mtimeMs;
      const key = `${lang}:${idxFile}`;
      const cached = this.indexCache[key];
      if (cached && cached.mtime === mtime) return cached.index;
      const parsed = JSON.parse(readFileSync(idxFile, 'utf8')) as MonsterIndexFile;
      this.indexCache[key] = { mtime, index: parsed };
      return parsed;
    } catch {
      return null;
    }
  }

  private readPerMonster(lang: LanguageCode, slug: string, manualId?: string): MonsterDetail | null {
    const dir = baseDir(manualId || this.defaultManualId);
    const file = join(dir, lang, `${slug}.json`);
    try {
      const mtime = statSync(file).mtimeMs;
      const key = `${lang}:${file}`;
      const cached = this.itemCache[key];
      if (cached && cached.mtime === mtime) return cached.item;
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as MonsterDetail;
      this.itemCache[key] = { mtime, item: parsed };
      return parsed;
    } catch {
      return null;
    }
  }

  private readFromMonolith(lang: LanguageCode, manualId?: string): MonsterIndexItem[] {
    // Fallback: parse the monolithic EN file and build an in-memory index
    const dir = baseDir(manualId || this.defaultManualId);
    const file = join(dir, 'en', 'srd_5e_monsters.json');
    try {
      const raw = readFileSync(file, 'utf8');
      const data = JSON.parse(raw);
      // El formato del monolítico puede variar; asumimos una lista de criaturas con campos comunes
      // Creamos un índice mínimo: slug derivado del nombre, CR si está, etc.
      const items: MonsterIndexItem[] = [];
      const seen = new Set<string>();
      for (const m of data) {
        const name: string = m.name || m.Name || m.title || 'unknown';
        const slug = (name || 'unknown')
          .toString()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
        if (seen.has(slug)) continue;
        seen.add(slug);
        const item: MonsterIndexItem = {
          id: m.id?.toString?.() || slug,
          slug,
          name,
          type: m.type || m.Type || 'unknown',
          size: (m.size || m.Size || 'Medium') as any,
          alignment: m.alignment || m.Alignment,
          challengeRating: m.challenge_rating?.toString?.() || m.CR?.toString?.(),
          translated: lang === 'es' ? false : undefined,
        };
        items.push(item);
      }
      return items;
    } catch {
      return [];
    }
  }

  list(lang: LanguageCode, manualId?: string) {
    // Primero, si hay índice por idioma, úsalo; si no, construimos uno mínimo del monolítico EN.
    const index = this.readIndex(lang, manualId);
    if (index) return index.items;

    const items = this.readFromMonolith(lang, manualId);
    return items;
  }

  get(lang: LanguageCode, slug: string, manualId?: string): MonsterDetail | null {
    // 1) Intentar per-monster en lang
    const found = this.readPerMonster(lang, slug, manualId);
    if (found) return found;
    // 2) Fallback a EN
    if (lang !== 'en') {
      const en = this.readPerMonster('en', slug, manualId);
      if (en) return en;
    }
    // 3) Último recurso: buscar en monolítico EN un match por slug y construir detalle mínimo
    const dir = baseDir(manualId || this.defaultManualId);
    const file = join(dir, 'en', 'srd_5e_monsters.json');
    try {
      const raw = readFileSync(file, 'utf8');
      const data = JSON.parse(raw);
      for (const m of data) {
        const name: string = m.name || m.Name || m.title || 'unknown';
        const calcSlug = (name || 'unknown')
          .toString()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
        if (calcSlug !== slug) continue;
        const detail: MonsterDetail = {
          id: m.id?.toString?.() || slug,
          slug,
          lang,
          name,
          source: 'SRD 5.1',
          size: (m.size || m.Size || 'Medium') as any,
          type: m.type || m.Type || 'unknown',
          alignment: m.alignment || m.Alignment,
          armorClass: { value: Number(m.armor_class || m.AC || 10) },
          hitPoints: { average: Number(m.hit_points || m.HP || 1), roll: m.hit_dice || m.Hit_Dice },
          speed: { walk: Number((m.speed?.walk || m.speed || '').toString().replace(/[^0-9]/g, '')) || undefined },
          abilities: {
            str: Number(m.strength || m.STR || 10),
            dex: Number(m.dexterity || m.DEX || 10),
            con: Number(m.constitution || m.CON || 10),
            int: Number(m.intelligence || m.INT || 10),
            wis: Number(m.wisdom || m.WIS || 10),
            cha: Number(m.charisma || m.CHA || 10),
          },
          senses: { passivePerception: Number(m.passive_perception || m.Passive_Perception || 10) },
          languages: m.languages || m.Languages,
          proficiencyBonus: Number(m.proficiency_bonus || m.PB || 2),
          challengeRating: m.challenge_rating?.toString?.() || m.CR?.toString?.(),
          traits: [],
          actions: [],
          notes: ['Loaded from monolithic SRD; fields may be partial.'],
        };
        return detail;
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}
