#!/usr/bin/env node
/*
  Clona los JSON per-monstruo EN a ES manteniendo id/slug y marcando translated=false.
  Usage (Windows PowerShell):
    node ./scripts/seed-monsters-es.cjs --manual dnd5e-2014
*/
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
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
  await ensureDir(esDir);

  const files = (await fsp.readdir(enDir)).filter(f => f.endsWith('.json') && f !== 'index.en.json');
  let count = 0;
  for (const f of files) {
    const raw = await fsp.readFile(path.join(enDir, f), 'utf-8');
    const obj = JSON.parse(raw);
    const clone = { ...obj, lang: 'es', translated: false };
    await fsp.writeFile(path.join(esDir, f), JSON.stringify(clone, null, 2), 'utf-8');
    count++;
  }

  // Generar index.es.json a partir del index.en.json
  try {
    const idxRaw = await fsp.readFile(path.join(enDir, 'index.en.json'), 'utf-8');
    const idx = JSON.parse(idxRaw);
    const esIdx = { items: (idx.items || []).map(it => ({ ...it, translated: false })) };
    await fsp.writeFile(path.join(esDir, 'index.es.json'), JSON.stringify(esIdx, null, 2), 'utf-8');
  } catch {
    // si no existe el índice EN aún, se puede generar después
  }

  console.log(`Semilla ES generada: ${count} archivos en ${esDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
