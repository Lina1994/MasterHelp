import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CustomManualsService } from './custom-manuals.service';

interface ManualSummaryDto {
  id: string;
  title: string;
  description?: string;
  version?: string;
  licenseName?: string;
  licenseUrl?: string;
  locale?: string;
  slug?: string;
  /** 'file' for hardcoded manuals, 'db' for user-created. */
  source?: 'file' | 'db';
  /** Whether the manual can be edited/deleted by the user. */
  editable?: boolean;
  /** Whether the manual has a cover image (DB manuals only). */
  hasCover?: boolean;
  /** Whether the manual has an "About" section. */
  hasAbout?: boolean;
}

@Injectable()
export class ManualsService {
  private baseDir: string;
  private cache = new Map<string, any>(); // manualId -> { toc, sections }

  constructor(private readonly customManualsService: CustomManualsService) {
    // Base en tiempo de ejecución del backend: <repo>/backend como cwd
    // Apuntar a backend/data/manuals
    this.baseDir = path.resolve(process.cwd(), 'data', 'manuals');
  }

  /**
   * Devuelve el listado de manuales disponibles (fuente: backend/data/manuals/registry.json).
   * Si se proporciona userId, también incluye los manuales personalizados del usuario.
   */
  listManuals(userId?: number): ManualSummaryDto[] {
    const fileManuals = this.listFileManuals();
    return fileManuals;
  }

  /**
   * Devuelve el listado combinado de manuales de fichero + DB del usuario.
   * @param userId - ID del usuario autenticado (para obtener sus manuales personalizados).
   */
  async listAllManuals(userId: number): Promise<ManualSummaryDto[]> {
    const fileManuals = this.listFileManuals();
    const dbManuals = await this.customManualsService.findAllByUser(userId);
    const dbSummaries: ManualSummaryDto[] = dbManuals.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? undefined,
      version: m.version ?? undefined,
      source: 'db' as const,
      editable: true,
      hasCover: !!m.coverImageMimeType,
      hasAbout: !!m.about,
    }));
    return [...fileManuals, ...dbSummaries];
  }

  /**
   * Returns file-based manuals from registry.json.
   */
  private listFileManuals(): ManualSummaryDto[] {
    const registryPath = path.join(this.baseDir, 'registry.json');
    if (!fs.existsSync(registryPath)) return [];
    const raw = fs.readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(raw);
    return (registry?.manuals || []).map((m: any) => ({
      ...m,
      source: 'file' as const,
      editable: false,
    }));
  }

  /**
   * Returns all valid file-based manual IDs (from registry.json).
   */
  getFileManualIds(): string[] {
    return this.listFileManuals().map((m) => m.id);
  }

  /**
   * Checks whether a manualId corresponds to a file-based (hardcoded) manual.
   * @param manualId - Manual ID to check.
   */
  isFileManual(manualId: string): boolean {
    return this.getFileManualIds().includes(manualId);
  }

  /**
   * Returns the human-readable title of a manual (file-based or DB) by its ID.
   * @param manualId - Manual ID (slug for file manuals, UUID for DB manuals).
   * @returns The title string, or null if not found.
   */
  async getManualTitle(manualId: string): Promise<string | null> {
    const fileManual = this.listFileManuals().find((m) => m.id === manualId);
    if (fileManual) return fileManual.title;
    return this.customManualsService.getTitleById(manualId);
  }

  /**
   * Builds a lookup map of manual IDs → titles for a set of manual IDs.
   * Useful for batch-resolving titles when listing campaign items.
   * @param manualIds - Array of manual IDs to resolve.
   * @returns A Record mapping manualId → title (missing manuals are omitted).
   */
  async getManualTitleMap(manualIds: string[]): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    const fileManuals = this.listFileManuals();
    for (const id of manualIds) {
      const fm = fileManuals.find((m) => m.id === id);
      if (fm) {
        map[id] = fm.title;
      }
    }
    const dbIds = manualIds.filter((id) => !map[id]);
    for (const id of dbIds) {
      const title = await this.customManualsService.getTitleById(id);
      if (title) map[id] = title;
    }
    return map;
  }

  /**
   * Obtiene el árbol de contenidos (TOC) para un manual dado.
   * Para manuales de fichero: lee toc.json.
   * Para manuales de DB: genera un TOC dinámico basado en entryTypes presentes.
   */
  async getToc(manualId: string) {
    if (this.isFileManual(manualId)) {
      const { toc } = this.ensureManualLoaded(manualId);
      return toc;
    }
    // DB manual → generate dynamic TOC from entry types
    return this.buildDbManualToc(manualId);
  }

  /**
   * Devuelve el contenido de una sección/página identificada por nodeId dentro de un manual.
   * Para manuales de fichero: busca en los archivos de contenido.
   * Para manuales de DB: busca entries por entryType, o el campo "about" si nodeId === 'about'.
   */
  async getSection(manualId: string, nodeId: string, lang?: string) {
    if (this.isFileManual(manualId)) {
      return this.getFileSection(manualId, nodeId, lang);
    }
    // DB manual: "about" section → return manual.about as markdown
    if (nodeId === 'about') {
      return this.getDbManualAbout(manualId, lang);
    }
    // Reverse-map frontend nodeIds (plural) to DB entryTypes (singular)
    const entryType = this.resolveEntryType(nodeId);
    const code = (lang || 'en').toLowerCase();
    const entries = await this.customManualsService.listEntriesWithFallback(
      manualId,
      entryType as any,
      code,
    );
    return entries.map((e) => ({ id: e.entryKey, lang: e.lang, ...e.data }));
  }

  /**
   * Maps frontend nodeIds (plural) to DB entryType (singular).
   * Falls back to the nodeId itself if no mapping exists.
   */
  private resolveEntryType(nodeId: string): string {
    const map: Record<string, string> = {
      bestiary: 'monster',
      spells: 'spell',
      classes: 'class',
      races: 'race',
      backgrounds: 'background',
      feats: 'feat',
      traits: 'trait',
      skills: 'skill',
      sections: 'section',
    };
    return map[nodeId] || nodeId;
  }

  /**
   * Obtiene el contenido de una sección de un manual de fichero.
   */
  private getFileSection(manualId: string, nodeId: string, lang?: string) {
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
   * Solo soporta manuales de fichero.
   */
  search(manualId: string, q: string) {
    if (!this.isFileManual(manualId)) return [];
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

  /**
   * Builds a dynamic TOC for a DB manual based on the entry types it contains.
   * Maps entry types to the nodeIds the frontend expects (plural/specific names).
   * Includes an "About" node at the top if the manual has an about text.
   */
  private async buildDbManualToc(manualId: string) {
    const manual = await this.customManualsService.findOnePublic(manualId);
    const entries = await this.customManualsService.getEntries(manualId);
    const types = new Set(entries.map((e) => e.entryType));

    /** Maps DB entryType → nodeId used by the frontend ManualViewerPage. */
    const nodeIdMap: Record<string, string> = {
      monster: 'bestiary',
      spell: 'spells',
      class: 'classes',
      race: 'races',
      background: 'backgrounds',
      feat: 'feats',
      trait: 'traits',
      skill: 'skills',
      section: 'sections',
    };
    const tocLabels: Record<string, string> = {
      monster: 'Bestiary',
      spell: 'Spells',
      class: 'Classes',
      race: 'Races',
      background: 'Backgrounds',
      feat: 'Feats',
      trait: 'Traits',
      skill: 'Skills',
      section: 'Content',
    };
    const children: Array<{ id: string; title: string; children: any[] }> = [];
    // Add "About" node if manual has about text
    if (manual?.about) {
      children.push({ id: 'about', title: 'About', children: [] });
    }
    for (const t of types) {
      children.push({
        id: nodeIdMap[t] || t,
        title: tocLabels[t] || t,
        children: [],
      });
    }
    return { id: 'root', title: 'Table of Contents', children };
  }

  /**
   * Returns the "about" section for a DB manual as a markdown section DTO.
   */
  private async getDbManualAbout(manualId: string, _lang?: string) {
    const manual = await this.customManualsService.findOnePublic(manualId);
    if (!manual?.about) {
      throw new NotFoundException('About section not found');
    }
    return {
      id: 'about',
      title: 'About',
      format: 'markdown',
      markdown: manual.about,
    };
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
