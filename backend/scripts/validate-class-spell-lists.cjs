// Validate that class spell lists reference existing spells and class tags match (EN/ES)
// Usage: node scripts/validate-class-spell-lists.cjs
const fs = require('fs');
const path = require('path');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadClassesList(base, lang) {
  // Preferred: per-class directory backend/data/manuals/<manual>/classes/<lang>/*.json
  const dir = path.resolve(base, 'classes', lang);
  try {
    const st = fs.statSync(dir);
    if (st.isDirectory()) {
      const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json'));
      const list = [];
      for (const f of files) {
        try {
          list.push(loadJson(path.resolve(dir, f)));
        } catch {
          // skip malformed file
        }
      }
      if (list.length) return list;
    }
  } catch {
    // directory missing, ignore
  }
  // Fallback: monolithic classes.<lang>.json
  const mono = path.resolve(base, 'classes', `classes.${lang}.json`);
  try {
    return loadJson(mono);
  } catch {
    return [];
  }
}

function validateLang(lang) {
  const base = path.resolve(__dirname, '..', 'data', 'manuals', 'dnd5e-2014');
  const spellsPath = path.resolve(base, 'spells', `spells.${lang}.json`);
  const spells = loadJson(spellsPath);
  const classes = loadClassesList(base, lang);

  const spellsByName = new Map();
  const spellsById = new Map();
  for (const s of spells) {
    spellsByName.set(s.name, s);
    spellsById.set(s.id, s);
  }

  const issues = [];
  const warn = [];
  let checkedRefs = 0;

  for (const cls of classes) {
    const className = cls.name;
    const classId = cls.id;
    const byLevel = cls?.spells?.byLevel;
    if (!byLevel) continue; // non-casters

    for (const [lvl, names] of Object.entries(byLevel)) {
      if (!Array.isArray(names)) continue;
      const seen = new Set();
      for (const nm of names) {
        checkedRefs++;
        if (seen.has(nm)) {
          warn.push(`[${lang}] Duplicate spell in class ${classId} (${className}) level ${lvl}: ${nm}`);
          continue;
        }
        seen.add(nm);
        const sp = spellsByName.get(nm);
        if (!sp) {
          issues.push(`[${lang}] Missing spell referenced by class ${classId} (${className}) level ${lvl}: ${nm}`);
          continue;
        }
        // Tag check: spell.classes should include the localized class name, if present
        if (Array.isArray(sp.classes)) {
          if (!sp.classes.includes(className)) {
            warn.push(`[${lang}] Spell class tag mismatch: ${nm} missing '${className}' in classes=[${sp.classes.join(', ')}]`);
          }
        }
      }
    }
  }

  return { lang, issues, warn, checkedRefs };
}

function main() {
  const results = [validateLang('en'), validateLang('es')];
  let hasErrors = false;
  for (const r of results) {
    if (r.warn.length) {
      console.warn(`\n[WARN][${r.lang}] ${r.warn.length} warnings:`);
      for (const w of r.warn) console.warn('  -', w);
    }
    if (r.issues.length) {
      hasErrors = true;
      console.error(`\n[ERROR][${r.lang}] ${r.issues.length} issues:`);
      for (const e of r.issues) console.error('  -', e);
    }
    console.log(`[OK][${r.lang}] Checked ${r.checkedRefs} class spell references.`);
  }
  if (hasErrors) process.exit(1);
  console.log('\n[ALL GOOD] Class spell references validated.');
}

main();
