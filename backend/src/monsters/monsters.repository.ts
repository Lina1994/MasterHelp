import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import type { LanguageCode, MonsterDetail, MonsterIndexFile, MonsterIndexItem, SenseMap, SavingThrows, SkillMap } from './monster.types';

function safeManualId(manualId: string) {
  return manualId.replace(/[^a-zA-Z0-9-_]/g, '');
}

function baseDir(manualId: string) {
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, 'data', 'manuals', safeManualId(manualId), 'monsters'),
    resolve(cwd, 'backend', 'data', 'manuals', safeManualId(manualId), 'monsters'),
  ];
  for (const p of candidates) {
    try { if (existsSync(p)) return p; } catch {}
  }
  return candidates[0];
}

export class MonstersRepository {
  private indexCache: Record<string, { mtime: number; index: MonsterIndexFile | null }> = {};
  private itemCache: Record<string, { mtime: number; item: MonsterDetail | null }> = {};
  private readonly defaultManualId = 'dnd5e-2014';

  private readIndex(lang: LanguageCode, manualId?: string): MonsterIndexFile | null {
    const dir = baseDir(manualId || this.defaultManualId);
    // Los índices generados se guardan dentro de la subcarpeta de idioma
    const idxFile = join(dir, lang, `index.${lang}.json`);
    try {
      const mtime = statSync(idxFile).mtimeMs;
      const key = `${lang}:${idxFile}`;
      const cached = this.indexCache[key];
      if (cached && cached.mtime === mtime) return cached.index;
      const parsed = JSON.parse(readFileSync(idxFile, 'utf8')) as MonsterIndexFile;
      this.indexCache[key] = { mtime, index: parsed };
      return parsed;
    } catch {
      // Fallback: si no existe índice para ES, intentar EN
      if (lang === 'es') {
        try {
          const enIdx = join(dir, 'en', 'index.en.json');
          const mtime = statSync(enIdx).mtimeMs;
          const key = `en:${enIdx}`;
          const cached = this.indexCache[key];
          if (cached && cached.mtime === mtime) return cached.index;
          const parsed = JSON.parse(readFileSync(enIdx, 'utf8')) as MonsterIndexFile;
          this.indexCache[key] = { mtime, index: parsed };
          return parsed;
        } catch { /* ignore */ }
      }
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
      const raw = JSON.parse(readFileSync(file, 'utf8')) as any;
      const normalized = this.normalizeFromSrd(raw, lang);
      this.itemCache[key] = { mtime, item: normalized };
      return normalized;
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
      // El formato del monolítico puede variar; soportar array directo o wrapper con "results"
      const list: any[] = Array.isArray(data)
        ? data
        : (Array.isArray((data as any).results) ? (data as any).results : []);
      // Creamos un índice mínimo: slug derivado del nombre, CR si está, etc.
      const items: MonsterIndexItem[] = [];
      const seen = new Set<string>();
      for (const m of list) {
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
    if (index) {
      return index.items.map((it) => {
        const needsEnrich = !it.challengeRating || !it.type || !it.size;
        if (!needsEnrich) return it;
        const detail = this.readPerMonster(lang, it.slug, manualId) || (lang !== 'en' ? this.readPerMonster('en', it.slug, manualId) : null);
        if (!detail) return it;
        const translated = lang === 'es' && detail.lang === 'en' ? false : it.translated;
        return {
          id: detail.id,
          slug: detail.slug,
          name: detail.name || it.name,
          type: detail.type,
          size: detail.size,
          alignment: detail.alignment,
          challengeRating: detail.challengeRating || it.challengeRating,
          translated,
        } as MonsterIndexItem;
      });
    }

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
      const list: any[] = Array.isArray(data)
        ? data
        : (Array.isArray((data as any).results) ? (data as any).results : []);
      for (const m of list) {
        const name: string = m.name || m.Name || m.title || 'unknown';
        const calcSlug = (name || 'unknown')
          .toString()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
        if (calcSlug !== slug) continue;
        // Reusar la lógica de normalización contra un objeto SRD plano
        const srdLike = {
          id: m.id?.toString?.(),
          slug,
          lang,
          source: 'SRD 5.1',
          name,
          srd: {
            name,
            meta: `${m.size || m.Size || 'Medium'} ${m.type || m.Type || 'creature'}${m.alignment || m.Alignment ? `, ${m.alignment || m.Alignment}` : ''}`,
            'Armor Class': m.armor_class || m.AC,
            'Hit Points': m.hit_points || m.HP,
            'Speed': typeof m.speed === 'string' ? m.speed : [m.speed?.walk && `${m.speed.walk} ft.`].filter(Boolean).join(', '),
            'STR': m.STR || m.strength,
            'DEX': m.DEX || m.dexterity,
            'CON': m.CON || m.constitution,
            'INT': m.INT || m.intelligence,
            'WIS': m.WIS || m.wisdom,
            'CHA': m.CHA || m.charisma,
            'Saving Throws': m['Saving Throws'],
            'Skills': m['Skills'],
            'Damage Immunities': m['Damage Immunities'],
            'Damage Resistances': m['Damage Resistances'],
            'Damage Vulnerabilities': m['Damage Vulnerabilities'],
            'Condition Immunities': m['Condition Immunities'],
            'Senses': m['Senses'] || (m.passive_perception && `Passive Perception ${m.passive_perception}`),
            'Languages': m['Languages'] || m.languages,
            'Challenge': m.challenge_rating || m.CR,
            'Traits': m['Traits'],
            'Actions': m['Actions'],
            'Legendary Actions': m['Legendary Actions'],
          },
        };
        return this.normalizeFromSrd(srdLike, lang);
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private normalizeFromSrd(raw: any, lang: LanguageCode): MonsterDetail {
    // Si ya viene normalizado (sin "srd"), devolver tal cual
    if (!raw?.srd) {
      return raw as MonsterDetail;
    }
    const srd = raw.srd as Record<string, string>;
    const id = raw.id || raw.slug || (srd.name || '').toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    const slug = raw.slug || id;
    const name = raw.name || srd.name || slug;

    // Meta: "Large dragon, chaotic evil"
    let size: any = 'Medium';
    let type = 'creature';
    let alignment: string | undefined;
    if (srd.meta) {
      const [left, right] = srd.meta.split(',').map(p => p.trim());
      alignment = right || undefined;
      if (left) {
        const parts = left.split(/\s+/);
        size = (parts[0]?.charAt(0).toUpperCase() + parts[0]?.slice(1).toLowerCase()) as any;
        type = parts.slice(1).join(' ') || type;
      }
    }

    // Armor Class: "18 (Natural Armor)"
    let acVal = NaN; let acType: string | undefined;
    if (srd['Armor Class']) {
      const m = srd['Armor Class'].match(/(\d+)/);
      acVal = m ? Number(m[1]) : NaN;
      const t = srd['Armor Class'].match(/\(([^\)]+)\)/);
      acType = t ? t[1] : undefined;
    }

    // Hit Points: "127 (15d10 + 45)"
    let hpAvg = NaN; let hpRoll: string | undefined;
    if (srd['Hit Points']) {
      const m = srd['Hit Points'].match(/(\d+)/);
      hpAvg = m ? Number(m[1]) : NaN;
      const r = srd['Hit Points'].match(/\(([^\)]+)\)/);
      hpRoll = r ? r[1] : undefined;
    }

    // Speed: soporta EN y ES ("40 ft., fly 80 ft., swim 40 ft." | "a pie 40 ft., volar 80 ft.")
    const speedStr = (srd['Speed'] || '').toLowerCase();
    const speed: any = {};
    const speedParts = speedStr.split(',').map(s => s.trim()).filter(Boolean);
    const modeMap: Record<string, 'walk' | 'fly' | 'swim' | 'climb' | 'burrow'> = {
      walk: 'walk', fly: 'fly', swim: 'swim', climb: 'climb', burrow: 'burrow',
      'a pie': 'walk', volar: 'fly', nadar: 'swim', trepar: 'climb', excavar: 'burrow',
    };
    for (const part of speedParts) {
      const m = part.match(/([a-záéíóúüñ ]+)?\s*(\d+)/i);
      if (m) {
        const rawMode = (m[1] || '').trim();
        const key = modeMap[rawMode] || 'walk';
        speed[key] = Number(m[2]);
      }
    }

    // Abilities
    const abilities = {
      str: Number(srd['STR']) || 0,
      dex: Number(srd['DEX']) || 0,
      con: Number(srd['CON']) || 0,
      int: Number(srd['INT']) || 0,
      wis: Number(srd['WIS']) || 0,
      cha: Number(srd['CHA']) || 0,
    };

    // Senses + Passive Perception
    const senses: SenseMap = {};
    if (srd['Senses']) {
      const sens = srd['Senses'];
      // Passive Perception / Percepción pasiva
      let mm = sens.match(/passive\s*perception\s*(\d+)/i) || sens.match(/percepci[óo]n\s*pasiva\s*(\d+)/i);
      if (mm) senses.passivePerception = Number(mm[1]);
      // EN
      if (/blindsight/i.test(sens)) senses.blindsight = sens.match(/blindsight[^,]*/i)?.[0];
      if (/darkvision/i.test(sens)) senses.darkvision = sens.match(/darkvision[^,]*/i)?.[0];
      if (/tremorsense/i.test(sens)) senses.tremorsense = sens.match(/tremorsense[^,]*/i)?.[0];
      if (/truesight/i.test(sens)) senses.truesight = sens.match(/truesight[^,]*/i)?.[0];
      // ES
      if (/visi[óo]n\s+en\s+la\s+oscuridad/i.test(sens)) senses.darkvision = sens.match(/visi[óo]n\s+en\s+la\s+oscuridad[^,]*/i)?.[0];
      if (/vista\s+ciega/i.test(sens)) senses.blindsight = sens.match(/vista\s+ciega[^,]*/i)?.[0];
      if (/(sentido|sentidos)\s+de\s+vibraci[óo]n/i.test(sens)) senses.tremorsense = sens.match(/vibraci[óo]n[^,]*/i)?.[0];
      if (/visi[óo]n\s+verdadera/i.test(sens)) senses.truesight = sens.match(/visi[óo]n\s+verdadera[^,]*/i)?.[0];
    }

    // Saving Throws
    const savingThrows: SavingThrows = {};
    if (srd['Saving Throws']) {
      srd['Saving Throws'].split(',').map(s => s.trim()).forEach(tok => {
        const m = tok.match(/(STR|DEX|CON|INT|WIS|CHA)\s*([+\-]?\d+)/i);
        if (m) {
          const key = m[1].toLowerCase() as keyof SavingThrows;
          (savingThrows as any)[key] = Number(m[2]);
        }
      });
    }

    // Skills
    const skills: SkillMap = {};
    if (srd['Skills']) {
      srd['Skills'].split(',').map(s => s.trim()).forEach(tok => {
        const m = tok.match(/([A-Za-z ]+)\s*([+\-]?\d+)/);
        if (m) skills[m[1].toLowerCase()] = Number(m[2]);
      });
    }

    // Damage/Condition arrays
    const toArray = (v?: string) => v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    // Challenge Rating
    let cr: string | undefined;
    if (srd['Challenge']) {
      const m = srd['Challenge'].toString().match(/([0-9/]+)\b/);
      cr = m ? m[1] : undefined;
    }

    // Blocks: Traits/Actions/Legendary Actions (HTML -> plano)
    const htmlToBlocks = (html?: string) => {
      if (!html) return undefined;
      const text = html
        .replace(/<br\s*\/>/gi, '\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+\n/g, '\n')
        .trim();
      if (!text) return undefined;
      return text.split(/\n+/).map(t => ({ text: t.trim() })).filter(b => b.text);
    };

    const detail: MonsterDetail = {
      id: id.toString(),
      slug,
      lang,
      name,
      source: raw.source || 'SRD 5.1',
      type,
      size,
      alignment,
      armorClass: { value: isNaN(acVal) ? 0 : acVal, type: acType },
      hitPoints: { average: isNaN(hpAvg) ? 0 : hpAvg, roll: hpRoll },
      speed,
      abilities,
      savingThrows: Object.keys(savingThrows).length ? savingThrows : undefined,
      skills: Object.keys(skills).length ? skills : undefined,
      damageImmunities: toArray(srd['Damage Immunities']),
      damageResistances: toArray(srd['Damage Resistances']),
      damageVulnerabilities: toArray(srd['Damage Vulnerabilities']),
      conditionImmunities: toArray(srd['Condition Immunities']),
      senses,
      languages: srd['Languages'],
      proficiencyBonus: undefined,
      challengeRating: cr,
      traits: htmlToBlocks(srd['Traits']),
      actions: htmlToBlocks(srd['Actions']),
      legendaryActions: htmlToBlocks(srd['Legendary Actions']),
      notes: undefined,
    };
    return detail;
  }
}
