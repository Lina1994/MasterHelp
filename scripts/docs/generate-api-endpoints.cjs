const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const docsDir = path.join(root, 'docs');
const backendSrc = path.join(root, 'backend', 'src');
const frontendApi = path.join(root, 'frontend', 'src', 'api');

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

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function parseBackendControllers() {
  const files = walk(backendSrc).filter((f) => f.endsWith('.controller.ts'));
  const out = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    const ctrlMatch = content.match(/@Controller\(([^)]*)\)/);
    const ctrlBase = ctrlMatch ? ctrlMatch[1].replace(/['"`]/g, '').trim() : '';

    let pendingMethod = null;
    let pendingPath = '';

    for (const line of lines) {
      const routeMatch = line.match(/@(Get|Post|Patch|Put|Delete)\(([^)]*)\)/);
      if (routeMatch) {
        pendingMethod = routeMatch[1].toUpperCase();
        pendingPath = routeMatch[2].replace(/['"`]/g, '').trim();
        continue;
      }

      if (pendingMethod) {
        const handlerMatch = line.match(/async\s+([A-Za-z0-9_]+)\s*\(/) || line.match(/([A-Za-z0-9_]+)\s*\(/);
        if (handlerMatch) {
          const handler = handlerMatch[1];
          const fullPath = `${ctrlBase}/${pendingPath}`
            .replace(/\/+/g, '/')
            .replace(/\/$/, '');
          out.push({
            module: path.basename(file).replace('.controller.ts', ''),
            method: pendingMethod,
            path: fullPath.startsWith('/') ? fullPath : `/${fullPath}`,
            handler,
            file: rel(file),
          });
          pendingMethod = null;
          pendingPath = '';
        }
      }
    }
  }

  return out.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
}

function parseFrontendApi() {
  const files = walk(frontendApi).filter((f) => /\.(ts|tsx)$/.test(f));
  const out = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const fnRegex = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)|export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g;
    const endpoints = [...content.matchAll(/api\.(get|post|patch|put|delete)\s*\(\s*([`'\"])(.*?)\2/gis)]
      .map((m) => `${m[1].toUpperCase()} ${m[3]}`);

    let m;
    const fns = [];
    while ((m = fnRegex.exec(content)) !== null) {
      fns.push(m[1] || m[2]);
    }

    out.push({
      file: rel(file),
      functions: fns,
      endpoints,
    });
  }

  return out.sort((a, b) => a.file.localeCompare(b.file));
}

function main() {
  ensureDocsDir();

  const backendRows = parseBackendControllers();
  const frontendRows = parseFrontendApi();

  const lines = [];
  lines.push('# API_ENDPOINTS');
  lines.push('');
  lines.push('Registro de endpoints backend y funciones API frontend.');
  lines.push('');
  lines.push('## Backend (controllers)');
  lines.push('');
  lines.push('| Modulo | Metodo | Ruta | Handler | Archivo |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const row of backendRows) {
    lines.push(`| ${row.module} | ${row.method} | ${row.path} | ${row.handler} | ${row.file} |`);
  }

  lines.push('');
  lines.push('## Frontend (api clients)');
  lines.push('');
  lines.push('| Archivo | Funciones exportadas | Endpoints detectados |');
  lines.push('| --- | --- | --- |');
  for (const row of frontendRows) {
    lines.push(`| ${row.file} | ${row.functions.join(', ')} | ${row.endpoints.join(', ')} |`);
  }

  fs.writeFileSync(path.join(docsDir, 'API_ENDPOINTS.md'), lines.join('\n') + '\n', 'utf8');
  console.log('Generated docs/API_ENDPOINTS.md');
}

main();
