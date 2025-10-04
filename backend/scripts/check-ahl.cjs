#!/usr/bin/env node
/*
  Audit AHL (At Higher Levels) presence in EN vs ES datasets for levels 0–4.
  - Reports ids where EN has "At Higher Levels:" but ES lacks "A niveles superiores:", and vice versa.
  - Outputs counts per level and a concise summary.
*/
const fs = require('fs');
const path = require('path');

function loadJson(p) {
  const text = fs.readFileSync(p, 'utf8');
  return JSON.parse(text);
}

const enPath = path.resolve(__dirname, '../data/spells/spells.en.json');
const esPath = path.resolve(__dirname, '../data/spells/spells.es.json');

const en = loadJson(enPath);
const es = loadJson(esPath);

const enById = new Map(en.map((s) => [s.id, s]));
const esById = new Map(es.map((s) => [s.id, s]));

const levels = [0, 1, 2, 3, 4];

const hasAhlEn = (s) => /\bAt\s+Higher\s+Levels\s*[:，,：]?/i.test(s.description || '');
const hasAhlEs = (s) => /\bA\s+niveles\s+superiores\s*[:，,：]?/i.test(s.description || '');

const result = {
  summary: {},
  enHas_esMissing: [],
  esHas_enMissing: [],
  shouldHave_missing_en: [],
  shouldHave_missing_es: [],
};

for (const lvl of levels) {
  const idsLevel = en.filter((s) => s.level === lvl).map((s) => s.id);
  const enHas = idsLevel.filter((id) => {
    const s = enById.get(id);
    return s && hasAhlEn(s);
  });
  const esHas = idsLevel.filter((id) => {
    const s = esById.get(id);
    return s && hasAhlEs(s);
  });

  const enOnly = enHas.filter((id) => !esHas.includes(id));
  const esOnly = esHas.filter((id) => !enHas.includes(id));

  result.summary[lvl] = {
    total: idsLevel.length,
    enHas: enHas.length,
    esHas: esHas.length,
    enOnly: enOnly.length,
    esOnly: esOnly.length,
  };

  for (const id of enOnly) {
    result.enHas_esMissing.push({ level: lvl, id, name_en: enById.get(id)?.name, name_es: esById.get(id)?.name });
  }
  for (const id of esOnly) {
    result.esHas_enMissing.push({ level: lvl, id, name_en: enById.get(id)?.name, name_es: esById.get(id)?.name });
  }
}

function printSection(title, items) {
  console.log(`\n=== ${title} (${items.length}) ===`);
  if (items.length === 0) return;
  for (const it of items) {
    console.log(`L${it.level} | ${it.id} | EN:"${it.name_en}" | ES:"${it.name_es}"`);
  }
}

console.log('AHL audit (levels 0–4)');
for (const lvl of levels) {
  const s = result.summary[lvl];
  console.log(`L${lvl}: total=${s.total} enHas=${s.enHas} esHas=${s.esHas} enOnly=${s.enOnly} esOnly=${s.esOnly}`);
}

printSection('EN has AHL, ES missing', result.enHas_esMissing);
printSection('ES has AHL, EN missing', result.esHas_enMissing);

// Curated list of spells (ids) that should have formal AHL headers in SRD for L1–4
const shouldHaveAhl = new Set([
  // Level 1
  'burning-hands','bless','bane','cure-wounds','magic-missile','guiding-bolt','healing-word','inflict-wounds','sleep','thunderwave','witch-bolt','ray-of-sickness','color-spray',
  // Level 2
  'aid','invisibility','hold-person','scorching-ray','flaming-sphere','moonbeam','shatter','heat-metal','magic-weapon','spiritual-weapon','prayer-of-healing',
  // Level 3
  'fireball','lightning-bolt','fly','animate-dead','call-lightning','bestow-curse','major-image','spirit-guardians','vampiric-touch',
  // Level 4
  'blight','dominate-beast','ice-storm','wall-of-fire',
]);

for (const id of shouldHaveAhl) {
  const sEn = enById.get(id);
  const sEs = esById.get(id);
  if (!sEn || !sEs) continue; // keep audit resilient to dataset choices
  if (sEn.level >= 1 && sEn.level <= 4) {
    if (!hasAhlEn(sEn)) result.shouldHave_missing_en.push({ level: sEn.level, id, name_en: sEn.name, name_es: sEs?.name });
    if (!hasAhlEs(sEs)) result.shouldHave_missing_es.push({ level: sEs.level, id, name_en: sEn.name, name_es: sEs?.name });
  }
}

printSection('Should-have AHL missing in EN', result.shouldHave_missing_en);
printSection('Should-have AHL missing in ES', result.shouldHave_missing_es);

// exit code 0: audit only; CI can grep for enOnly/esOnly to decide.
process.exit(0);
