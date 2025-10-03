// Simple parity checker to ensure EN and ES spells datasets have the same ids
// Usage: node scripts/check-spells-parity.cjs
const { readFileSync } = require('fs');
const { resolve } = require('path');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function getIds(list) {
  return list.map((s) => s.id);
}

function findDuplicates(ids) {
  const seen = new Set();
  const dups = new Set();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    else seen.add(id);
  }
  return [...dups];
}

const dataDir = resolve(__dirname, '..', 'data', 'spells');
const enPath = resolve(dataDir, 'spells.en.json');
const esPath = resolve(dataDir, 'spells.es.json');

const en = loadJson(enPath);
const es = loadJson(esPath);

const enIds = getIds(en);
const esIds = getIds(es);

const enDup = findDuplicates(enIds);
const esDup = findDuplicates(esIds);

const enOnly = enIds.filter((id) => !esIds.includes(id));
const esOnly = esIds.filter((id) => !enIds.includes(id));

let hasIssues = false;
if (enDup.length) {
  hasIssues = true;
  console.error('[ERROR] Duplicate ids in EN:', enDup);
}
if (esDup.length) {
  hasIssues = true;
  console.error('[ERROR] Duplicate ids in ES:', esDup);
}
if (enOnly.length) {
  hasIssues = true;
  console.error('[ERROR] Missing in ES (present in EN):', enOnly);
}
if (esOnly.length) {
  hasIssues = true;
  console.error('[ERROR] Missing in EN (present in ES):', esOnly);
}

if (hasIssues) {
  process.exit(1);
}

console.log(`[OK] Parity check passed. Count EN=${en.length} ES=${es.length}.`);
process.exit(0);
