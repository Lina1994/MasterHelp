const fs = require('fs');
const path = require('path');

function loadSpells(filename) {
  const p = path.resolve(__dirname, '..', 'data', 'manuals', 'dnd5e-2014', 'spells', filename);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function countsByLevel(list) {
  return list.reduce((acc, s) => {
    acc[s.level] = (acc[s.level] || 0) + 1;
    return acc;
  }, {});
}

function namesAtLevel(list, lvl) {
  return list
    .filter((s) => s.level === lvl)
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b));
}

const en = loadSpells('spells.en.json');
const es = loadSpells('spells.es.json');

console.log('Counts EN:', countsByLevel(en));
console.log('Counts ES:', countsByLevel(es));
console.log('Total EN:', en.length, 'Total ES:', es.length);
console.log('Level 9 EN names:', namesAtLevel(en, 9));
console.log('Level 9 ES names:', namesAtLevel(es, 9));
