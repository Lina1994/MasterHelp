#!/usr/bin/env node
/*
  Marca automáticamente "translated": true en los JSON ES cuyo SRD esté en español.

  Uso:
    node scripts/mark-translated-es.cjs --manual dnd5e-2014 [--dry]

  Comportamiento:
  - Recorre backend/data/manuals/<manual>/monsters/es/*.json
  - Heurística de detección de español basada en tokens frecuentes y caracteres acentuados
  - Si supera el umbral, añade/actualiza translated=true y guarda el archivo
  - Al final muestra un resumen y sugiere reindexar
*/
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { manual: 'dnd5e-2014', dry: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--manual') out.manual = args[++i];
    else if (a === '--dry') out.dry = true;
  }
  return out;
}

function resolveEsDir(manual) {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'data', 'manuals', manual, 'monsters', 'es'),
    path.resolve(cwd, 'backend', 'data', 'manuals', manual, 'monsters', 'es'),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return candidates[0];
}

const SP_TOKENS = [
  ' de ', ' el ', ' la ', ' los ', ' las ', ' un ', ' una ', ' y ', ' con ', ' o ', ' que ',
  'clase de armadura', 'puntos de golpe', 'velocidad', 'ataque', 'arma', 'cuerpo a cuerpo', 'a distancia',
  'impacto', 'daño', 'salvación', 'tirada', 'percepción pasiva', 'visión', 'oscura', 'idiomas', 'lenguas',
  'resistencias', 'inmunidades', 'vulnerabilidades', 'acciones legendarias', 'acción legendaria', 'acciones', 'rasgos',
  'recarga', 'alcance', 'objetivo', 'golpe', 'golpes', 'a pie', 'volar', 'nadar', 'trepar', 'excavar',
];

function scoreSpanishFromText(text) {
  if (!text) return 0;
  let s = String(text).toLowerCase();
  let score = 0;
  // acentos comunes
  if (/[áéíóúñü]/.test(s)) score += 2;
  for (const tok of SP_TOKENS) {
    if (s.includes(tok)) score += 1;
  }
  return score;
}

function isSpanishSRD(srd) {
  if (!srd || typeof srd !== 'object') return false;
  let total = 0;
  const stack = [srd];
  while (stack.length) {
    const cur = stack.pop();
    if (typeof cur === 'string') {
      total += scoreSpanishFromText(cur);
    } else if (Array.isArray(cur)) {
      for (const it of cur) stack.push(it);
    } else if (cur && typeof cur === 'object') {
      for (const k of Object.keys(cur)) stack.push(cur[k]);
    }
  }
  return total >= 4; // umbral conservador
}

function main() {
  const { manual, dry } = parseArgs();
  const dir = resolveEsDir(manual);
  if (!fs.existsSync(dir)) {
    console.error('No existe el directorio ES:', dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('index.'));
  let marked = 0, skipped = 0;
  for (const f of files) {
    const full = path.join(dir, f);
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    const srd = data.srd || {};
    const es = isSpanishSRD(srd);
    if (es) {
      if (!data.translated) {
        data.translated = true;
        if (!dry) fs.writeFileSync(full, JSON.stringify(data, null, 2));
        marked++;
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  }
  console.log(`Analizados ${files.length} archivos. Marcados translated=true: ${marked}. Sin cambios: ${skipped}.`);
  console.log('Sugerencia: reindexa con: npm --prefix backend run monsters:reindex:es');
}

main();
