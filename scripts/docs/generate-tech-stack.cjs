const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const docsDir = path.join(root, 'docs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDocsDir() {
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
}

function collectDeps(pkgPath, scope) {
  const pkg = readJson(pkgPath);
  const deps = [];
  const sources = [
    { type: 'dependencies', obj: pkg.dependencies || {} },
    { type: 'devDependencies', obj: pkg.devDependencies || {} },
  ];

  for (const source of sources) {
    for (const [name, version] of Object.entries(source.obj)) {
      deps.push({
        name,
        version,
        scope,
        depType: source.type,
      });
    }
  }

  return deps;
}

function categorize(name) {
  const n = name.toLowerCase();
  if (n.includes('nestjs') || n === 'express' || n === 'react' || n.includes('vite') || n.includes('electron')) return 'Core/Framework';
  if (n.includes('mui') || n.includes('emotion')) return 'UI';
  if (n.includes('passport') || n.includes('jwt') || n.includes('bcrypt')) return 'Auth';
  if (n.includes('typeorm') || n.includes('sqlite') || n.includes('better-sqlite3')) return 'Data/ORM';
  if (n.includes('sharp') || n.includes('quill') || n.includes('markdown')) return 'Rich Content/Media';
  if (n.includes('dnd')) return 'Drag & Drop';
  if (n.includes('i18n')) return 'i18n';
  if (n.includes('axios') || n.includes('socket')) return 'Networking';
  if (n.includes('jest') || n.includes('test')) return 'Testing';
  if (n.includes('ts-node') || n.includes('typescript') || n.includes('eslint') || n.includes('prettier')) return 'Tooling';
  return 'Other';
}

function main() {
  ensureDocsDir();

  const allDeps = [
    ...collectDeps(path.join(root, 'package.json'), 'root'),
    ...collectDeps(path.join(root, 'backend', 'package.json'), 'backend'),
    ...collectDeps(path.join(root, 'frontend', 'package.json'), 'frontend'),
  ];

  allDeps.sort((a, b) => a.name.localeCompare(b.name));

  const lines = [];
  lines.push('# TECH_STACK');
  lines.push('');
  lines.push('Registro de tecnologias y dependencias usadas en la app.');
  lines.push('');
  lines.push('## Dependencias');
  lines.push('');
  lines.push('| Categoria | Paquete | Version | Scope | Tipo |');
  lines.push('| --- | --- | --- | --- | --- |');

  for (const dep of allDeps) {
    lines.push(`| ${categorize(dep.name)} | ${dep.name} | ${dep.version} | ${dep.scope} | ${dep.depType} |`);
  }

  lines.push('');
  lines.push('## Tecnologias implicitas');
  lines.push('');
  lines.push('- Web Audio API (audio espacial/proximidad en mapa).');
  lines.push('- BroadcastChannel + localStorage (sincronizacion entre vistas/pestanas).');
  lines.push('- Electron IPC (sincronizacion de ventanas secundarias).');

  fs.writeFileSync(path.join(docsDir, 'TECH_STACK.md'), lines.join('\n') + '\n', 'utf8');
  console.log('Generated docs/TECH_STACK.md');
}

main();
