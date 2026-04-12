const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const docsDir = path.join(root, 'docs');
const targets = [
  { name: 'frontend', dir: path.join(root, 'frontend', 'src') },
  { name: 'backend', dir: path.join(root, 'backend', 'src') },
];

function ensureDocsDir() {
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
}

function shouldIgnore(p) {
  return p.includes('node_modules') || p.includes('dist') || p.includes('.git');
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (shouldIgnore(full)) continue;
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split(/\r?\n/).length;
      acc.push({ file: full, lines });
    }
  }
  return acc;
}

function classify(filePath) {
  const f = filePath.replace(/\\/g, '/');
  if (f.includes('/components/')) return 'component';
  if (f.includes('/hooks/')) return 'hook';
  if (f.includes('/pages/')) return 'page';
  if (f.includes('/api/')) return 'api';
  if (f.endsWith('.controller.ts')) return 'controller';
  if (f.endsWith('.service.ts')) return 'service';
  if (f.endsWith('.entity.ts')) return 'entity';
  if (f.includes('/utils/')) return 'util';
  if (f.includes('/dto/')) return 'dto';
  return 'other';
}

function stats(items) {
  const sorted = [...items].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  const avg = sorted.length ? (total / sorted.length) : 0;
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  return { total, avg, median };
}

function main() {
  ensureDocsDir();

  const lines = [];
  lines.push('# FILE_REGISTRY');
  lines.push('');
  lines.push('Mapa de archivos TypeScript con conteo de lineas (orden descendente).');
  lines.push('');

  for (const target of targets) {
    const files = walk(target.dir).map((item) => ({
      ...item,
      rel: path.relative(root, item.file).replace(/\\/g, '/'),
      type: classify(item.file),
    }));

    files.sort((a, b) => b.lines - a.lines);
    const s = stats(files.map((f) => f.lines));
    const big = files.filter((f) => f.lines > 300).length;

    lines.push(`## ${target.name}`);
    lines.push('');
    lines.push(`- Archivos: ${files.length}`);
    lines.push(`- Lineas totales: ${s.total}`);
    lines.push(`- Promedio: ${s.avg.toFixed(1)}`);
    lines.push(`- Mediana: ${s.median}`);
    lines.push(`- Archivos > 300 lineas: ${big}`);
    lines.push('');
    lines.push('| Ruta | Lineas | Tipo |');
    lines.push('| --- | ---: | --- |');
    for (const file of files) {
      lines.push(`| ${file.rel} | ${file.lines} | ${file.type} |`);
    }
    lines.push('');
  }

  fs.writeFileSync(path.join(docsDir, 'FILE_REGISTRY.md'), lines.join('\n') + '\n', 'utf8');
  console.log('Generated docs/FILE_REGISTRY.md');
}

main();
