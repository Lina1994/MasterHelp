const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const docsDir = path.join(root, 'docs');
const hooksDir = path.join(root, 'frontend', 'src', 'hooks');
const frontendSrc = path.join(root, 'frontend', 'src');

function ensureDocsDir() {
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function toRel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function getHookName(filePath) {
  const base = path.basename(filePath).replace(/\.(ts|tsx)$/i, '');
  if (base.startsWith('use')) return base;
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/export\s+function\s+(use[A-Za-z0-9_]+)/);
  return match ? match[1] : base;
}

function main() {
  ensureDocsDir();

  const hookFiles = walk(hooksDir);
  const allFiles = walk(frontendSrc);

  const rows = [];

  for (const hookFile of hookFiles) {
    const hookName = getHookName(hookFile);
    const usedBy = [];

    for (const file of allFiles) {
      if (file === hookFile) continue;
      const content = fs.readFileSync(file, 'utf8');
      const re = new RegExp(`\\b${hookName}\\b`);
      if (re.test(content)) usedBy.push(toRel(file));
    }

    rows.push({
      hookName,
      file: toRel(hookFile),
      uses: usedBy.length,
      usedBy,
    });
  }

  rows.sort((a, b) => a.hookName.localeCompare(b.hookName));

  const lines = [];
  lines.push('# HOOKS_REGISTRY');
  lines.push('');
  lines.push('Registro de hooks y sus usos detectados en frontend/src.');
  lines.push('');
  lines.push('| Hook | Archivo | Usos | Estado | Archivos que lo usan |');
  lines.push('| --- | --- | ---: | --- | --- |');

  for (const row of rows) {
    const state = row.uses === 0 ? 'CANDIDATO_A_ELIMINAR' : 'EN_USO';
    const usedBy = row.usedBy.slice(0, 8).join(', ');
    lines.push(`| ${row.hookName} | ${row.file} | ${row.uses} | ${state} | ${usedBy} |`);
  }

  fs.writeFileSync(path.join(docsDir, 'HOOKS_REGISTRY.md'), lines.join('\n') + '\n', 'utf8');
  console.log('Generated docs/HOOKS_REGISTRY.md');
}

main();
