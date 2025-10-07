#!/usr/bin/env node
/*
  Valida archivos per-monstruo EN/ES:
  - Estructura mínima (id, slug, name, lang)
  - Unicidad de id y slug dentro de cada idioma
  - Alineación EN/ES por slug (mismo id)
  Usage:
    node ./scripts/validate-monsters.cjs --manual dnd5e-2014
*/
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function readDirJson(dir) {
  let files = [];
  try {
    files = (await fsp.readdir(dir)).filter(f => {
      if (!f.endsWith('.json')) return false;
      if (f.startsWith('index.')) return false;
      if (f === 'srd_5e_monsters.json') return false; // ignorar monolítico
      return true;
    });
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    const raw = await fsp.readFile(path.join(dir, f), 'utf-8');
    try {
      out.push(JSON.parse(raw));
    } catch (e) {
      throw new Error(`JSON inválido: ${path.join(dir, f)} → ${e.message}`);
    }
  }
  return out;
}

async function main() {
  const manualId = getArg('--manual', 'dnd5e-2014');
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'data', 'manuals', manualId, 'monsters'),
    path.join(cwd, 'backend', 'data', 'manuals', manualId, 'monsters'),
  ];
  const baseDir = candidates.find((p) => fs.existsSync(p)) || candidates[0];
  const enDir = path.join(baseDir, 'en');
  const esDir = path.join(baseDir, 'es');

  const en = await readDirJson(enDir);
  const es = await readDirJson(esDir);

  const enIds = new Set();
  const enSlugs = new Set();
  for (const m of en) {
    if (!m.id || !m.slug || !m.name || m.lang !== 'en') throw new Error(`Estructura mínima ausente/incorrecta en EN: ${m?.slug || m?.name}`);
    if (enIds.has(m.id)) throw new Error(`ID duplicado EN: ${m.id}`);
    if (enSlugs.has(m.slug)) throw new Error(`Slug duplicado EN: ${m.slug}`);
    enIds.add(m.id);
    enSlugs.add(m.slug);
  }

  for (const m of es) {
    if (!m.id || !m.slug || !m.name || m.lang !== 'es') throw new Error(`Estructura mínima ausente/incorrecta en ES: ${m?.slug || m?.name}`);
    const match = en.find(e => e.slug === m.slug);
    if (match && match.id !== m.id) throw new Error(`Desalineación EN/ES para slug ${m.slug}: EN.id=${match.id}, ES.id=${m.id}`);
  }

  console.log(`Validación OK: EN=${en.length}, ES=${es.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
