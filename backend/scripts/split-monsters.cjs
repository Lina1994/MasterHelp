#!/usr/bin/env node
/*
  Split monolithic SRD 5.1 monsters JSON into per-monster files and index.en.json
  Usage (Windows PowerShell):
    node ./scripts/split-monsters.cjs --manual dnd5e-2014
*/
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function slugify(input) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function stableId(name, cr) {
  const h = crypto.createHash('sha1').update(`${name}|${cr || ''}|SRD5.1`).digest('hex');
  return h.slice(0, 12);
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

async function main() {
  const manualId = getArg('--manual', 'dnd5e-2014');
  const cwd = process.cwd();
  // Soportar ejecución desde backend/ o desde la raíz del repo
  const candidates = [
    path.join(cwd, 'data', 'manuals', manualId, 'monsters'),
    path.join(cwd, 'backend', 'data', 'manuals', manualId, 'monsters'),
  ];
  const baseDir = candidates.find((p) => fs.existsSync(p)) || candidates[0];
  const monoPath = path.join(baseDir, 'en', 'srd_5e_monsters.json');
  const outDir = path.join(baseDir, 'en');

  const raw = await fsp.readFile(monoPath, 'utf-8');
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    console.error('No se pudo parsear el monolítico:', e.message);
    process.exit(1);
  }

  const monsters = asArray(data);
  if (!monsters.length) {
    console.error('El monolítico no parece contener una lista de monstruos.');
    process.exit(1);
  }

  await ensureDir(outDir);

  const index = [];
  const slugSet = new Set();

  for (const m of monsters) {
    const name = m.name || m.Name || m.title || 'unknown';
    const cr = m.challenge_rating || m.challengeRating || m.CR;
    const id = stableId(String(name), String(cr || ''));

    let baseSlug = slugify(String(name));
    let slug = baseSlug;
    let i = 2;
    while (slugSet.has(slug)) slug = `${baseSlug}-${i++}`;
    slugSet.add(slug);

    const obj = {
      id,
      slug,
      lang: 'en',
      source: 'SRD 5.1',
      name: String(name),
      srd: m,
    };

    await fsp.writeFile(path.join(outDir, `${slug}.json`), JSON.stringify(obj, null, 2), 'utf-8');
    index.push({
      id,
      slug,
      name: String(name),
      type: m.type || m.Type,
      size: m.size || m.Size,
      alignment: m.alignment || m.Alignment,
      challengeRating: String(cr || ''),
    });
  }

  index.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  await fsp.writeFile(path.join(outDir, 'index.en.json'), JSON.stringify({ items: index }, null, 2), 'utf-8');

  console.log(`Split completado: ${index.length} monstruos en ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
