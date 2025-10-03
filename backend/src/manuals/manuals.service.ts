import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface ManualSummaryDto {
  id: string;
  title: string;
  version?: string;
  licenseName?: string;
  licenseUrl?: string;
  locale?: string;
  slug?: string;
}

@Injectable()
export class ManualsService {
  private baseDir: string;
  private cache = new Map<string, any>(); // manualId -> { toc, sections }

  constructor() {
    // Base en tiempo de ejecución del backend: <repo>/backend como cwd
    // Apuntar a backend/data/manuals
    this.baseDir = path.resolve(process.cwd(), 'data', 'manuals');
  }

  /**
   * Devuelve el listado de manuales disponibles (fuente: backend/data/manuals/registry.json).
   */
  listManuals(): ManualSummaryDto[] {
    const registryPath = path.join(this.baseDir, 'registry.json');
    if (!fs.existsSync(registryPath)) return [];
    const raw = fs.readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(raw);
    return registry?.manuals || [];
  }

  /**
   * Obtiene el árbol de contenidos (TOC) para un manual dado.
   */
  getToc(manualId: string) {
    const { toc } = this.ensureManualLoaded(manualId);
    return toc;
  }

  /**
   * Devuelve el contenido de una sección/página identificada por nodeId dentro de un manual.
   */
  getSection(manualId: string, nodeId: string, lang?: string) {
    const { sections } = this.ensureManualLoaded(manualId);
    const entry = sections[nodeId];
    if (!entry) throw new NotFoundException('Section not found');
    const code = (lang || '').toLowerCase();
    if (entry.locales) {
      if (code && entry.locales[code]) return entry.locales[code];
      if (entry.locales['en']) return entry.locales['en'];
      if (entry.locales['default']) return entry.locales['default'];
      const first = Object.values(entry.locales)[0];
      if (first) return first;
    }
    // retrocompat: si era un objeto plano
    return entry;
  }

  /**
   * Búsqueda simple por título y texto plano en el manual especificado.
   */
  search(manualId: string, q: string) {
    const { sections } = this.ensureManualLoaded(manualId);
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const results: any[] = [];
    for (const [id, sec] of Object.entries<any>(sections)) {
      const hay = `${sec.title || ''} ${sec.plainText || ''}`.toLowerCase();
      if (hay.includes(term)) {
        results.push({ nodeId: id, title: sec.title, snippet: this.buildSnippet(sec.plainText || '', term) });
      }
    }
    return results.slice(0, 50);
  }

  private buildSnippet(text: string, term: string) {
    const idx = text.toLowerCase().indexOf(term);
    if (idx === -1) return text.slice(0, 160);
    const start = Math.max(0, idx - 60);
    return (start > 0 ? '…' : '') + text.slice(start, idx + 100) + '…';
  }

  private ensureManualLoaded(manualId: string) {
    const safe = manualId.replace(/[^a-zA-Z0-9-_]/g, '');
    if (safe !== manualId) throw new NotFoundException('Manual not found');
    if (this.cache.has(manualId)) return this.cache.get(manualId);
    const dir = path.join(this.baseDir, manualId);
    const tocPath = path.join(dir, 'toc.json');
    if (!fs.existsSync(tocPath)) throw new NotFoundException('Manual not found');
    const toc = JSON.parse(fs.readFileSync(tocPath, 'utf-8'));
    const contentDir = path.join(dir, 'content');
    const sections: Record<string, any> = {};
    if (fs.existsSync(contentDir)) {
      for (const file of fs.readdirSync(contentDir)) {
        if (!file.endsWith('.json')) continue;
        const match = /^(.*?)(?:\.(\w{2}))?\.json$/.exec(file);
        if (!match) continue;
        const baseId = match[1];
        const locale = match[2] || 'default';
        const data = JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf-8'));
        if (!sections[baseId]) sections[baseId] = { locales: {} };
        sections[baseId].locales[locale] = data;
      }
    }
    const packed = { toc, sections };
    this.cache.set(manualId, packed);
    return packed;
  }
}
