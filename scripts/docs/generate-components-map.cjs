const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const docsDir = path.join(root, 'docs');
const targetDirs = [
  path.join(root, 'frontend', 'src', 'components'),
  path.join(root, 'frontend', 'src', 'pages'),
];

function ensureDocsDir() {
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).length;

  const hookImports = [...content.matchAll(/import\s+.*\b(use[A-Za-z0-9_]+)\b.*from\s+['\"](.*?)['\"]/g)]
    .map((m) => m[1]);
  const hooks = [...new Set(hookImports)].sort();

  const contextCalls = [...content.matchAll(/\b(use[A-Za-z0-9_]*Context|useActiveCampaign|useCampaignId)\b/g)]
    .map((m) => m[1]);
  const contexts = [...new Set(contextCalls)].sort();

  const localImports = [...content.matchAll(/import\s+([A-Za-z0-9_{}\s,]+)\s+from\s+['\"](\.{1,2}\/[^'\"]+)['\"]/g)]
    .map((m) => m[1].replace(/[{}\s]/g, ''))
    .filter(Boolean);
  const children = [...new Set(localImports)].sort();

  return { lines, hooks, contexts, children };
}

function main() {
  ensureDocsDir();

  const files = targetDirs.flatMap((d) => walk(d));
  const rows = files.map((file) => ({
    file: rel(file),
    ...parseFile(file),
  }));

  rows.sort((a, b) => b.lines - a.lines);

  const lines = [];
  lines.push('# COMPONENTS_MAP');
  lines.push('');
  lines.push('Mapa de componentes/pages con dependencias de hooks y contextos.');
  lines.push('');
  lines.push('| Archivo | Lineas | Hooks | Contextos | Componentes locales importados | Flags |');
  lines.push('| --- | ---: | --- | --- | --- | --- |');

  for (const row of rows) {
    const flags = [];
    if (row.lines > 400) flags.push('MONOLITO_400+');
    if (row.hooks.length > 6) flags.push('MUCHOS_HOOKS');
    lines.push(`| ${row.file} | ${row.lines} | ${row.hooks.join(', ')} | ${row.contexts.join(', ')} | ${row.children.join(', ')} | ${flags.join(', ')} |`);
  }

  fs.writeFileSync(path.join(docsDir, 'COMPONENTS_MAP.md'), lines.join('\n') + '\n', 'utf8');
  console.log('Generated docs/COMPONENTS_MAP.md');
}

main();
