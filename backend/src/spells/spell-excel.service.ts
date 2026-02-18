import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignSpell } from './entities/campaign-spell.entity';
import { SpellsService, SpellDetail } from './spells.service';
import * as fs from 'fs';
import * as path from 'path';

type LanguageCode = 'en' | 'es';

/**
 * Canonical column headers used in the exported Excel file.
 * Import expects these same headers (case-insensitive match).
 */
const HEADERS = [
  'Nombre',
  'Nivel',
  'Escuela',
  'Tiempo de lanzamiento',
  'Alcance',
  'Duración',
  'Componentes',
  'Materiales',
  'Ritual',
  'Concentración',
  'Clases',
  'Tirada de salvación',
  'Área de efecto',
  'Descripción',
  'Origen',
];

/** Manual registry entry. */
interface ManualEntry {
  id: string;
  title: string;
}

/**
 * Service responsible for exporting campaign spells to Excel (.xlsx)
 * and importing spells from an Excel file.
 */
@Injectable()
export class SpellExcelService {
  constructor(
    @InjectRepository(CampaignSpell)
    private campaignSpellRepo: Repository<CampaignSpell>,
    @InjectRepository(Campaign)
    private campaignRepo: Repository<Campaign>,
    private spellsService: SpellsService,
  ) {}

  /* ─────────────────────── EXPORT ─────────────────────── */

  /**
   * Generates an Excel buffer containing every spell available to the campaign
   * (manual + manual-edited + homebrew).
   *
   * @param campaignId - Campaign UUID.
   * @param lang       - Language code for manual spells ('en' | 'es').
   * @returns          - A Buffer with the .xlsx file content.
   */
  async exportToExcel(campaignId: string, lang: LanguageCode = 'en'): Promise<Buffer> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new BadRequestException('Campaign not found');

    const manualIds = campaign.selectedManualIds || [];
    const manualTitles = this.loadManualTitles();

    const rows: Record<string, any>[] = [];

    // 1. Campaign-specific spells (edited + homebrew)
    const campaignSpells = await this.campaignSpellRepo.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    for (const cs of campaignSpells) {
      const data: any =
        cs.customData ||
        (cs.sourceManualId && cs.sourceSpellId
          ? this.spellsService.getById(lang, cs.sourceSpellId, cs.sourceManualId)
          : null);
      if (!data) continue;

      let originLabel: string;
      if (cs.sourceManualId) {
        originLabel = `${manualTitles[cs.sourceManualId] || cs.sourceManualId} (Editado)`;
      } else {
        originLabel = cs.customOriginName || 'Homebrew';
      }

      rows.push(this.spellToRow(data, originLabel));
    }

    // 2. Manual spells (read-only originals)
    for (const manualId of manualIds) {
      const label = manualTitles[manualId] || manualId;
      const summaries = this.spellsService.list(lang, {}, manualId);
      for (const s of summaries) {
        const detail = this.spellsService.getById(lang, s.id, manualId);
        rows.push(this.spellToRow(detail || s, label));
      }
    }

    // Sort by name for convenience
    rows.sort((a, b) => (a['Nombre'] || '').localeCompare(b['Nombre'] || ''));

    const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hechizos');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /* ─────────────────────── IMPORT ─────────────────────── */

  /**
   * Reads an Excel buffer and upserts spells into the campaign.
   *
   * **Origin rules:**
   * - If the "Origen" column value matches (contains) one of the known manual
   *   titles/ids, the spell is imported as `manual-edited` (sourceManualId set).
   * - Otherwise it is imported as `homebrew`, preserving the origin value in
   *   `customOriginName` (or null if empty / "Homebrew").
   *
   * Matching by name is used to avoid duplicates: if a campaign spell with
   * the same name already exists, it is updated rather than duplicated.
   *
   * @param campaignId - Campaign UUID.
   * @param fileBuffer - The uploaded .xlsx file buffer.
   * @param lang       - Language code for manual spell look-ups.
   * @returns          - Summary of imported / updated counts.
   */
  async importFromExcel(
    campaignId: string,
    fileBuffer: Buffer,
    lang: LanguageCode = 'en',
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new BadRequestException('Campaign not found');

    // Parse workbook
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException('El archivo Excel está vacío');

    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    if (!rawRows.length) throw new BadRequestException('No se encontraron filas en el archivo');

    // Build manual title → id lookup
    const manualTitles = this.loadManualTitles();
    const titleToId: Record<string, string> = {};
    for (const [id, title] of Object.entries(manualTitles)) {
      titleToId[title.toLowerCase()] = id;
      titleToId[id.toLowerCase()] = id;
    }
    const manualNames = Object.keys(titleToId);

    // Pre-load existing campaign spells (for upsert by name)
    const existingSpells = await this.campaignSpellRepo.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    const existingByName = new Map<string, CampaignSpell>();
    for (const cs of existingSpells) {
      const name = ((cs.customData as any)?.name || '').toLowerCase().trim();
      if (name) existingByName.set(name, cs);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const raw of rawRows) {
      const name = this.str(raw['Nombre']);
      if (!name) { skipped++; continue; }

      const originRaw = this.str(raw['Origen']) || '';

      // Determine if origin matches a manual
      const matchedManualId = this.matchManualId(originRaw, manualNames, titleToId);

      // Recombine components + materials into the canonical format: "V, S, M (materials)"
      const compRaw = this.str(raw['Componentes']) || '';
      const matRaw = this.str(raw['Materiales']) || '';
      const components = matRaw ? `${compRaw} (${matRaw})`.trim() : compRaw;

      // Build customData
      const customData = {
        name,
        level: this.num(raw['Nivel']),
        school: this.str(raw['Escuela']) || '',
        castingTime: this.str(raw['Tiempo de lanzamiento']) || '',
        range: this.str(raw['Alcance']) || '',
        duration: this.str(raw['Duración']) || '',
        components,
        materials: matRaw || undefined,
        ritual: this.boolField(raw['Ritual']),
        concentration: this.boolField(raw['Concentración']),
        classes: this.parseClasses(raw['Clases']),
        savingThrow: this.str(raw['Tirada de salvación']) || undefined,
        areaOfEffect: this.str(raw['Área de efecto']) || undefined,
        description: this.str(raw['Descripción']) || undefined,
      } satisfies NonNullable<CampaignSpell['customData']>;

      // Find matching manual spell for sourceSpellId if manual-edited
      let sourceSpellId: string | null = null;
      if (matchedManualId) {
        const manualSpell = this.findManualSpellByName(matchedManualId, name, lang);
        sourceSpellId = manualSpell?.id || null;
      }

      const existing = existingByName.get(name.toLowerCase().trim());

      if (existing) {
        // Update existing campaign spell
        existing.customData = customData;
        if (matchedManualId) {
          existing.sourceManualId = matchedManualId;
          existing.sourceSpellId = sourceSpellId;
          existing.customOriginName = null;
        } else {
          existing.sourceManualId = null;
          existing.sourceSpellId = null;
          const originClean = originRaw.toLowerCase() === 'homebrew' || !originRaw ? null : originRaw;
          existing.customOriginName = originClean;
        }
        await this.campaignSpellRepo.save(existing);
        updated++;
      } else {
        // Create new campaign spell
        const spell = this.campaignSpellRepo.create({
          campaign,
          sourceManualId: matchedManualId || null,
          sourceSpellId: sourceSpellId,
          customOriginName: matchedManualId
            ? null
            : (originRaw.toLowerCase() === 'homebrew' || !originRaw ? null : originRaw),
          customData,
        });
        const saved = await this.campaignSpellRepo.save(spell);
        existingByName.set(name.toLowerCase().trim(), saved);
        created++;
      }
    }

    return { created, updated, skipped };
  }

  /* ─────────────────────── PRIVATE HELPERS ─────────────────────── */

  /**
   * Converts a spell data object into a row suitable for the Excel sheet.
   */
  private spellToRow(data: any, originLabel: string): Record<string, any> {
    const componentsRaw: string = data.components || '';
    // Extract materials from parentheses in components, e.g. "V, S, M (a bat guano)" → "a bat guano"
    const materialsMatch = componentsRaw.match(/\(([^)]+)\)/);
    const materials = data.materials || (materialsMatch ? materialsMatch[1].trim() : '');
    // Strip parenthetical from components column: "V, S, M (stuff)" → "V, S, M"
    const components = componentsRaw.replace(/\s*\([^)]*\)/, '').trim();

    return {
      Nombre: data.name || '',
      Nivel: data.level ?? 0,
      Escuela: data.school || '',
      'Tiempo de lanzamiento': data.castingTime || '',
      Alcance: data.range || '',
      Duración: data.duration || '',
      Componentes: components,
      Materiales: materials,
      Ritual: data.ritual ? 'Sí' : 'No',
      Concentración: data.concentration ? 'Sí' : 'No',
      Clases: Array.isArray(data.classes) ? data.classes.join(', ') : (data.classes || ''),
      'Tirada de salvación': data.savingThrow || '',
      'Área de efecto': data.areaOfEffect || '',
      Descripción: data.description || '',
      Origen: originLabel,
    };
  }

  /**
   * Loads manual titles from registry.json.
   * @returns Map of manualId → human-readable title.
   */
  private loadManualTitles(): Record<string, string> {
    try {
      const registryPath = path.join(process.cwd(), 'data', 'manuals', 'registry.json');
      const raw = fs.readFileSync(registryPath, 'utf-8');
      const registry = JSON.parse(raw);
      const titles: Record<string, string> = {};
      for (const m of registry.manuals || []) {
        titles[m.id] = m.title;
      }
      return titles;
    } catch {
      return {};
    }
  }

  /**
   * Determines if an origin string matches a known manual.
   * Returns the manualId if matched, null otherwise.
   */
  private matchManualId(
    originRaw: string,
    manualNames: string[],
    titleToId: Record<string, string>,
  ): string | null {
    if (!originRaw) return null;
    const lower = originRaw.toLowerCase().replace(/\s*\(editado\)\s*/i, '').trim();
    if (!lower) return null;

    // Exact match first
    if (titleToId[lower]) return titleToId[lower];

    // Partial match (origin contains the manual title or id)
    for (const name of manualNames) {
      if (lower.includes(name) || name.includes(lower)) {
        return titleToId[name];
      }
    }

    return null;
  }

  /**
   * Looks up a manual spell by name (case-insensitive).
   */
  private findManualSpellByName(
    manualId: string,
    spellName: string,
    lang: LanguageCode,
  ): SpellDetail | null {
    const allSpells = this.spellsService.list(lang, {}, manualId);
    const lowerName = spellName.toLowerCase().trim();
    const found = allSpells.find(
      (s: any) => (s.name || '').toLowerCase().trim() === lowerName,
    );
    if (!found) return null;
    return this.spellsService.getById(lang, found.id, manualId) || null;
  }

  /** Safely coerce a cell value to string. */
  private str(val: any): string {
    if (val === undefined || val === null) return '';
    return String(val).trim();
  }

  /** Safely coerce a cell value to number. */
  private num(val: any): number {
    if (val === undefined || val === null) return 0;
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  /** Parse a boolean-ish cell (Sí/Yes/true/1 → true). */
  private boolField(val: any): boolean {
    if (val === undefined || val === null) return false;
    const s = String(val).toLowerCase().trim();
    return ['sí', 'si', 'yes', 'true', '1', 'x'].includes(s);
  }

  /** Parse a comma-separated classes string into an array. */
  private parseClasses(val: any): string[] | undefined {
    if (!val) return undefined;
    const s = String(val).trim();
    if (!s) return undefined;
    return s.split(',').map((c) => c.trim()).filter(Boolean);
  }
}
