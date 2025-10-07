// Usage: node scripts/extract-class-spells.cjs <ClassName> <lang>
const fs = require('fs');
const path = require('path');
const cls = process.argv[2] || 'Druid';
const lang = process.argv[3] || 'en';
const base = path.resolve(__dirname, '..', 'data', 'manuals', 'dnd5e-2014');
const spellsPath = path.resolve(base, 'spells', `spells.${lang}.json`);
const data = JSON.parse(fs.readFileSync(spellsPath, 'utf8'));
const byLevel = {};
for (const s of data) {
  if (Array.isArray(s.classes) && s.classes.includes(cls)) {
    const key = s.level === 0 ? 'cantrip' : String(s.level);
    byLevel[key] = byLevel[key] || [];
    byLevel[key].push(s.name);
  }
}
for (const k of Object.keys(byLevel)) byLevel[k].sort((a,b)=>a.localeCompare(b));
console.log(JSON.stringify({ class: cls, lang, byLevel }, null, 2));
