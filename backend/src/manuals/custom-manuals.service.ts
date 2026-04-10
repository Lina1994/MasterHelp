import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Manual } from './entities/manual.entity';
import { ManualEntry } from './entities/manual-entry.entity';
import { CreateManualDto } from './dto/create-manual.dto';
import { UpdateManualDto } from './dto/update-manual.dto';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { UpdateManualEntryDto } from './dto/update-manual-entry.dto';
import { ImportManualDto } from './dto/import-manual.dto';
import type { ManualEntryType } from './entities/manual-entry.entity';

/**
 * Service that manages user-created custom manuals stored in the database.
 *
 * File-based manuals (dnd5e-2014 / dnd5e-2024) are handled by
 * `ManualsService`; this service only deals with DB-backed manuals.
 */
@Injectable()
export class CustomManualsService {
  constructor(
    @InjectRepository(Manual)
    private readonly manualRepo: Repository<Manual>,
    @InjectRepository(ManualEntry)
    private readonly entryRepo: Repository<ManualEntry>,
  ) {}

  /* ═══════════════════════════ MANUAL CRUD ═══════════════════════════ */

  /**
   * Create a new custom manual owned by the specified user.
   * @param userId - ID of the authenticated user.
   * @param dto    - Manual metadata.
   * @returns The created Manual entity.
   */
  async create(userId: number, dto: CreateManualDto): Promise<Manual> {
    const manual = this.manualRepo.create({
      ...dto,
      createdByUserId: userId,
    });
    return this.manualRepo.save(manual);
  }

  /**
   * List all custom manuals belonging to a user.
   * Cover image blob is excluded by default (select: false on entity).
   * @param userId - ID of the authenticated user.
   */
  async findAllByUser(userId: number): Promise<Manual[]> {
    return this.manualRepo.find({
      where: { createdByUserId: userId },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Find a specific manual by ID, verifying ownership.
   * The cover image blob is excluded by default (select: false on entity).
   * @param manualId - UUID of the manual.
   * @param userId   - ID of the authenticated user.
   * @returns The Manual entity (without entries or cover blob).
   */
  async findOne(manualId: string, userId: number): Promise<Manual> {
    const manual = await this.manualRepo.findOne({ where: { id: manualId } });
    if (!manual) throw new NotFoundException('Manual not found');
    if (manual.createdByUserId !== userId) {
      throw new ForbiddenException('You do not own this manual');
    }
    return manual;
  }

  /**
   * Internal helper: loads the full manual entity (including blob fields)
   * with ownership verification. Used only for operations that modify binary data.
   */
  private async findOneFull(manualId: string, userId: number): Promise<Manual> {
    const manual = await this.manualRepo
      .createQueryBuilder('m')
      .addSelect('m.coverImageData')
      .where('m.id = :id', { id: manualId })
      .getOne();
    if (!manual) throw new NotFoundException('Manual not found');
    if (manual.createdByUserId !== userId) {
      throw new ForbiddenException('You do not own this manual');
    }
    return manual;
  }

  /**
   * Update manual metadata. Only the owner can update.
   * @param manualId - UUID of the manual.
   * @param userId   - ID of the authenticated user.
   * @param dto      - Fields to update.
   */
  async update(manualId: string, userId: number, dto: UpdateManualDto): Promise<Manual> {
    const manual = await this.findOne(manualId, userId);
    Object.assign(manual, dto);
    return this.manualRepo.save(manual);
  }

  /**
   * Delete a manual and all its entries (cascade).
   * @param manualId - UUID of the manual.
   * @param userId   - ID of the authenticated user.
   */
  async remove(manualId: string, userId: number): Promise<void> {
    const manual = await this.findOne(manualId, userId);
    await this.manualRepo.remove(manual);
  }

  /**
   * Check whether a given manual UUID exists in the DB (regardless of owner).
   * Used by other services to distinguish file-based vs DB manuals.
   */
  async exists(manualId: string): Promise<boolean> {
    const count = await this.manualRepo.count({ where: { id: manualId } });
    return count > 0;
  }

  /**
   * Return the title of a DB manual by its ID (no ownership check).
   * @param manualId - UUID of the manual.
   * @returns The title string, or null if not found.
   */
  async getTitleById(manualId: string): Promise<string | null> {
    const manual = await this.manualRepo.findOne({
      where: { id: manualId },
      select: ['id', 'title'],
    });
    return manual?.title ?? null;
  }

  /**
   * Load a manual by ID without ownership verification (public read access).
   * Used by ManualsService when rendering manual viewer sections (e.g. "about").
   * @param manualId - UUID of the manual.
   * @returns The Manual entity (without cover blob), or null if not found.
   */
  async findOnePublic(manualId: string): Promise<Manual | null> {
    return this.manualRepo.findOne({ where: { id: manualId } });
  }

  /* ═══════════════════════════ COVER IMAGE ═══════════════════════════ */

  /**
   * Upload / replace the cover image for a manual.
   * @param manualId - UUID of the manual.
   * @param userId   - ID of the authenticated user (ownership check).
   * @param buffer   - Raw image bytes.
   * @param mimeType - MIME type (e.g. "image/png").
   */
  async uploadCover(
    manualId: string,
    userId: number,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    const manual = await this.findOneFull(manualId, userId);
    manual.coverImageData = buffer;
    manual.coverImageMimeType = mimeType;
    await this.manualRepo.save(manual);
  }

  /**
   * Retrieve the cover image for a manual (no ownership check — any campaign
   * member may see it).
   * @param manualId - UUID of the manual.
   * @returns Object with buffer and mimeType, or null if no cover set.
   */
  async getCover(manualId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const manual = await this.manualRepo
      .createQueryBuilder('m')
      .select(['m.id', 'm.coverImageData', 'm.coverImageMimeType'])
      .where('m.id = :id', { id: manualId })
      .getOne();
    if (!manual?.coverImageData || !manual.coverImageMimeType) return null;
    return { buffer: manual.coverImageData, mimeType: manual.coverImageMimeType };
  }

  /**
   * Remove the cover image from a manual.
   * @param manualId - UUID of the manual.
   * @param userId   - ID of the authenticated user (ownership check).
   */
  async removeCover(manualId: string, userId: number): Promise<void> {
    const manual = await this.findOneFull(manualId, userId);
    manual.coverImageData = null;
    manual.coverImageMimeType = null;
    await this.manualRepo.save(manual);
  }

  /**
   * Check whether a manual has a cover image (lightweight — no blob loaded).
   * @param manualId - UUID of the manual.
   */
  async hasCover(manualId: string): Promise<boolean> {
    const manual = await this.manualRepo.findOne({
      where: { id: manualId },
      select: ['id', 'coverImageMimeType'],
    });
    return !!manual?.coverImageMimeType;
  }

  /* ═══════════════════════════ ENTRY CRUD ════════════════════════════ */

  /**
   * Add a new entry to a manual.
   * @param manualId - UUID of the manual.
   * @param userId   - ID of the authenticated user (ownership check).
   * @param dto      - Entry data.
   */
  async addEntry(
    manualId: string,
    userId: number,
    dto: CreateManualEntryDto,
  ): Promise<ManualEntry> {
    await this.findOne(manualId, userId); // ownership check

    // Check for duplicate (manualId, entryType, entryKey, lang)
    const existing = await this.entryRepo.findOne({
      where: {
        manualId,
        entryType: dto.entryType,
        entryKey: dto.entryKey,
        lang: dto.lang,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Entry "${dto.entryKey}" (${dto.entryType}, ${dto.lang}) already exists in this manual`,
      );
    }

    const entry = this.entryRepo.create({ ...dto, manualId });
    return this.entryRepo.save(entry);
  }

  /**
   * Get all entries of a manual, optionally filtered by type and/or language.
   * @param manualId  - UUID of the manual.
   * @param entryType - Optional filter by entry type.
   * @param lang      - Optional filter by language code.
   */
  async getEntries(
    manualId: string,
    entryType?: ManualEntryType,
    lang?: string,
  ): Promise<ManualEntry[]> {
    const where: Record<string, any> = { manualId };
    if (entryType) where.entryType = entryType;
    if (lang) where.lang = lang;
    return this.entryRepo.find({ where, order: { entryKey: 'ASC' } });
  }

  /**
   * Get a single entry by its UUID.
   * @param manualId - UUID of the manual (for route-level coherence).
   * @param entryId  - UUID of the entry.
   */
  async getEntryById(manualId: string, entryId: string): Promise<ManualEntry> {
    const entry = await this.entryRepo.findOne({
      where: { id: entryId, manualId },
    });
    if (!entry) throw new NotFoundException('Entry not found');
    return entry;
  }

  /**
   * Get a specific entry by (manualId, entryType, entryKey) with language fallback.
   *
   * Fallback order: requested lang → 'en' → any available.
   *
   * @param manualId  - UUID of the manual.
   * @param entryType - Entry category.
   * @param entryKey  - Slug identifier.
   * @param lang      - Preferred language code.
   */
  async getEntry(
    manualId: string,
    entryType: ManualEntryType,
    entryKey: string,
    lang?: string,
  ): Promise<ManualEntry> {
    const candidates = await this.entryRepo.find({
      where: { manualId, entryType, entryKey },
    });
    if (candidates.length === 0) {
      throw new NotFoundException('Entry not found');
    }

    const code = (lang || '').toLowerCase();

    // Exact match
    const exact = candidates.find((c) => c.lang === code);
    if (exact) return exact;

    // English fallback
    const en = candidates.find((c) => c.lang === 'en');
    if (en) return en;

    // Any available
    return candidates[0];
  }

  /**
   * Update an existing entry.
   * @param manualId - UUID of the manual.
   * @param entryId  - UUID of the entry.
   * @param userId   - ID of the authenticated user.
   * @param dto      - Fields to update.
   */
  async updateEntry(
    manualId: string,
    entryId: string,
    userId: number,
    dto: UpdateManualEntryDto,
  ): Promise<ManualEntry> {
    await this.findOne(manualId, userId); // ownership check
    const entry = await this.getEntryById(manualId, entryId);
    if (dto.lang !== undefined) entry.lang = dto.lang;
    if (dto.data !== undefined) entry.data = dto.data;
    return this.entryRepo.save(entry);
  }

  /**
   * Delete a single entry.
   * @param manualId - UUID of the manual.
   * @param entryId  - UUID of the entry.
   * @param userId   - ID of the authenticated user.
   */
  async removeEntry(manualId: string, entryId: string, userId: number): Promise<void> {
    await this.findOne(manualId, userId); // ownership check
    const entry = await this.getEntryById(manualId, entryId);
    await this.entryRepo.remove(entry);
  }

  /* ═══════════════════════════ IMPORT / EXPORT ═══════════════════════ */

  /**
   * Export a manual and all its entries as a plain object ready for JSON serialisation.
   * @param manualId - UUID of the manual.
   * @param userId   - ID of the authenticated user.
   */
  async exportManual(manualId: string, userId: number) {
    const manual = await this.findOne(manualId, userId);
    const entries = await this.entryRepo.find({ where: { manualId } });
    return {
      title: manual.title,
      description: manual.description ?? undefined,
      version: manual.version ?? undefined,
      languages: manual.languages ?? undefined,
      about: manual.about ?? undefined,
      entries: entries.map((e) => ({
        entryType: e.entryType,
        entryKey: e.entryKey,
        lang: e.lang,
        data: e.data,
      })),
    };
  }

  /**
   * Import a full manual from a validated DTO (typically parsed from an uploaded JSON).
   * All entries receive new UUIDs; ownership is assigned to the calling user.
   * @param userId - ID of the authenticated user.
   * @param dto    - Validated import payload.
   * @returns The newly created Manual entity.
   */
  async importManual(userId: number, dto: ImportManualDto): Promise<Manual> {
    const manual = this.manualRepo.create({
      title: dto.title,
      description: dto.description,
      version: dto.version,
      languages: dto.languages,
      about: dto.about,
      createdByUserId: userId,
    });
    const saved = await this.manualRepo.save(manual);

    if (dto.entries?.length) {
      const entities = dto.entries.map((e) =>
        this.entryRepo.create({
          manualId: saved.id,
          entryType: e.entryType,
          entryKey: e.entryKey,
          lang: e.lang,
          data: e.data,
        }),
      );
      await this.entryRepo.save(entities);
    }

    return saved;
  }

  /* ═══════════════════════════ HELPERS (for other services) ══════════ */

  /**
   * Retrieve all entries of a given type from a DB manual, with language fallback.
   *
   * Returns one entry per unique entryKey, preferring the requested language,
   * then 'en', then the first available language.
   *
   * @param manualId  - UUID of the manual.
   * @param entryType - Entry category.
   * @param lang      - Preferred language code.
   */
  async listEntriesWithFallback(
    manualId: string,
    entryType: ManualEntryType,
    lang: string,
  ): Promise<ManualEntry[]> {
    const all = await this.entryRepo.find({
      where: { manualId, entryType },
      order: { entryKey: 'ASC' },
    });

    // Group by entryKey, pick best language
    const grouped = new Map<string, ManualEntry[]>();
    for (const entry of all) {
      const arr = grouped.get(entry.entryKey) ?? [];
      arr.push(entry);
      grouped.set(entry.entryKey, arr);
    }

    const code = (lang || '').toLowerCase();
    const result: ManualEntry[] = [];
    for (const candidates of grouped.values()) {
      const exact = candidates.find((c) => c.lang === code);
      if (exact) {
        result.push(exact);
        continue;
      }
      const en = candidates.find((c) => c.lang === 'en');
      if (en) {
        result.push(en);
        continue;
      }
      result.push(candidates[0]);
    }
    return result;
  }
}
