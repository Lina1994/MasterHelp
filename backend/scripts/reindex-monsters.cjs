#!/usr/bin/env node
/*
  Rebuild monsters index for a given manual and language from per-monster files.
  Usage:
    node scripts/reindex-monsters.cjs --manual dnd5e-2014 --lang es

  Behavior:
  - Scans backend/data/manuals/<manual>/monsters/<lang>/*.json
  - Extracts { id, slug, name, challengeRating, translated? } per item
  - Writes index.<lang>.json in the same directory
  - "translated" is taken from top-level boolean field in each file (optional)
*/
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { manual: 'dnd5e-2014', lang: 'es' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--manual') out.manual = args[++i];
    else if (args[i] === '--lang') out.lang = args[++i];
  }
  return out;
}

function resolveMonstersDir(manual, lang) {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'data', 'manuals', manual, 'monsters', lang),
    path.resolve(cwd, 'backend', 'data', 'manuals', manual, 'monsters', lang),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function extractCR(val) {
  if (!val) return '';
  const m = String(val).match(/([0-9/]+)\b/);
  return m ? m[1] : '';
}

function main() {
  const { manual, lang } = parseArgs();
  const dir = resolveMonstersDir(manual, lang);
  if (!fs.existsSync(dir)) {
    console.error('No existe el directorio:', dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('index.'));
  const items = [];
  for (const f of files) {
    const full = path.join(dir, f);
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    const srd = data.srd || {};
    items.push({
      id: String(data.id || ''),
      slug: String(data.slug || path.basename(f, '.json')),
      name: String(data.name || srd.name || path.basename(f, '.json')),
      challengeRating: extractCR(srd['Challenge']),
      translated: data.translated === true ? true : undefined,
    });
  }
  // Orden simple por nombre
  items.sort((a, b) => a.name.localeCompare(b.name));
  const outFile = path.join(path.dirname(dir), lang, `index.${lang}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ items }, null, 2));
  console.log(`Index reconstruido: ${outFile} (${items.length} items)`);
}

main();
