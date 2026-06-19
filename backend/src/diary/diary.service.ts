import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
// Using require() keeps this compatible with current TS config without extra moduleResolution/type settings.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml: any = require('sanitize-html');
import { CampaignsService } from '../campaigns/campaigns.service';
import { CampaignCalendarRepository } from './repositories/campaign-calendar.repository';
import { DiaryEntryRepository } from './repositories/diary-entry.repository';
import { DiaryEntryItemRepository } from './repositories/diary-entry-item.repository';
import { DiarySessionRepository } from './repositories/diary-session.repository';
import { DiarySessionItemRepository } from './repositories/diary-session-item.repository';
import { DiaryCalendarConfig } from './entities/campaign-calendar.entity';
import { DiaryDayRef, DiarySession } from './entities/diary-session.entity';
import { DiaryEntryItem } from './entities/diary-entry-item.entity';
import { DiarySessionItem } from './entities/diary-session-item.entity';

const DEFAULT_CALENDAR: DiaryCalendarConfig = {
  currentYear: 1,
  currentMonthIndex: 0,
  currentDayIndex: 1,
  yearLabelTemplate: 'Año {year}',
  months: [
    { name: 'Mes 1', days: 30 },
    { name: 'Mes 2', days: 30 },
    { name: 'Mes 3', days: 30 },
    { name: 'Mes 4', days: 30 },
    { name: 'Mes 5', days: 30 },
    { name: 'Mes 6', days: 30 },
    { name: 'Mes 7', days: 30 },
    { name: 'Mes 8', days: 30 },
    { name: 'Mes 9', days: 30 },
    { name: 'Mes 10', days: 30 },
    { name: 'Mes 11', days: 30 },
    { name: 'Mes 12', days: 30 },
  ],
  weekDays: [
    { name: 'Día 1' },
    { name: 'Día 2' },
    { name: 'Día 3' },
    { name: 'Día 4' },
    { name: 'Día 5' },
    { name: 'Día 6' },
    { name: 'Día 7' },
  ],
};

function sanitizeDiaryHtml(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  return sanitizeHtml(trimmed, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'span', 'u', 'hr']),
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['style'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      li: ['style'],
    },
    allowedSchemes: ['http', 'https', 'data', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  });
}

@Injectable()
export class DiaryService {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly calendarRepo: CampaignCalendarRepository,
    private readonly entryRepo: DiaryEntryRepository,
    private readonly entryItemRepo: DiaryEntryItemRepository,
    private readonly sessionRepo: DiarySessionRepository,
    private readonly sessionItemRepo: DiarySessionItemRepository,
  ) {}

  /**
   * Converts legacy public/private fields into items (read-only compatibility).
   * Does not persist anything.
   */
  private legacyEntryToItems(entry: { publicHtml: string | null; privateHtml: string | null }, isMaster: boolean) {
    const items: Array<{
      id: string;
      title: string | null;
      html: string | null;
      isPublic: boolean;
      order: number;
      updatedAt: Date;
      lastEditedByUserId: number | null;
    }> = [];

    if (entry.publicHtml) {
      items.push({
        id: 'legacy-public',
        title: 'Notas públicas (legacy)',
        html: entry.publicHtml,
        isPublic: true,
        order: 0,
        updatedAt: new Date(0),
        lastEditedByUserId: null,
      });
    }
    if (isMaster && entry.privateHtml) {
      items.push({
        id: 'legacy-private',
        title: 'Notas privadas (legacy)',
        html: entry.privateHtml,
        isPublic: false,
        order: items.length,
        updatedAt: new Date(0),
        lastEditedByUserId: null,
      });
    }

    return items;
  }

  private legacySessionToItems(session: { publicHtml: string | null; privateHtml: string | null }, isMaster: boolean) {
    const items: Array<{
      id: string;
      title: string | null;
      html: string | null;
      isPublic: boolean;
      order: number;
      updatedAt: Date;
      lastEditedByUserId: number | null;
    }> = [];

    if (session.publicHtml) {
      items.push({
        id: 'legacy-public',
        title: 'Notas públicas (legacy)',
        html: session.publicHtml,
        isPublic: true,
        order: 0,
        updatedAt: new Date(0),
        lastEditedByUserId: null,
      });
    }
    if (isMaster && session.privateHtml) {
      items.push({
        id: 'legacy-private',
        title: 'Notas privadas (legacy)',
        html: session.privateHtml,
        isPublic: false,
        order: items.length,
        updatedAt: new Date(0),
        lastEditedByUserId: null,
      });
    }

    return items;
  }

  /**
   * Ensures the user is a member (owner or active player) of the campaign.
   */
  private async assertCampaignMember(params: { campaignId: string; userId: number }): Promise<{ isMaster: boolean }> {
    const campaign = await this.campaignsService.findOne(params.campaignId);
    if (!campaign) throw new NotFoundException('Campaign not found');

    const isOwner = campaign.owner?.id === params.userId;
    const isPlayer = !!campaign.players?.some((p) => p.user?.id === params.userId && p.status === 'active');
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a campaign member');

    const isMaster =
      isOwner ||
      !!campaign.players?.some((p) => p.user?.id === params.userId && p.status === 'active' && p.role === 'master');

    return { isMaster };
  }

  private async assertMaster(params: { campaignId: string; userId: number }): Promise<void> {
    const { isMaster } = await this.assertCampaignMember(params);
    if (!isMaster) throw new ForbiddenException('Not campaign master');
  }

  async getCalendar(campaignId: string, userId: number) {
    await this.assertCampaignMember({ campaignId, userId });
    const existing = await this.calendarRepo.findByCampaignId(campaignId);
    if (existing) {
      // Ensure backward compatibility: add default values if missing
      if (existing.config.currentMonthIndex === undefined) existing.config.currentMonthIndex = 0;
      if (existing.config.currentDayIndex === undefined) existing.config.currentDayIndex = 1;
      return existing;
    }
    return this.calendarRepo.upsertConfig(campaignId, DEFAULT_CALENDAR);
  }

  async updateCalendar(campaignId: string, userId: number, config: DiaryCalendarConfig) {
    await this.assertMaster({ campaignId, userId });

    if (!config.months?.length || !config.weekDays?.length) throw new BadRequestException('Invalid calendar config');
    if (config.months.some((m) => !m.name || !m.days || m.days < 1)) throw new BadRequestException('Invalid month config');
    if (config.weekDays.some((d) => !d.name)) throw new BadRequestException('Invalid week day config');
    if (config.yearLabelTemplate !== undefined) {
      const tmpl = String(config.yearLabelTemplate).trim();
      if (!tmpl) throw new BadRequestException('yearLabelTemplate cannot be empty');
      if (!tmpl.includes('{year}')) throw new BadRequestException('yearLabelTemplate must include {year}');
      config.yearLabelTemplate = tmpl;
    }

    return this.calendarRepo.upsertConfig(campaignId, config);
  }

  async updateCurrentDay(campaignId: string, userId: number, monthIndex: number, dayIndex: number) {
    await this.assertMaster({ campaignId, userId });

    const calendar = await this.calendarRepo.findByCampaignId(campaignId);
    if (!calendar) throw new BadRequestException('Calendar not found');

    // Validate month and day indices
    if (monthIndex < 0 || monthIndex >= calendar.config.months.length) {
      throw new BadRequestException('Invalid month index');
    }
    const maxDays = calendar.config.months[monthIndex].days;
    if (dayIndex < 1 || dayIndex > maxDays) {
      throw new BadRequestException(`Invalid day index. Month ${monthIndex} has ${maxDays} days`);
    }

    // Update only the current day fields
    calendar.config.currentMonthIndex = monthIndex;
    calendar.config.currentDayIndex = dayIndex;

    return this.calendarRepo.upsertConfig(campaignId, calendar.config);
  }

  async getDiaryEntry(params: {
    campaignId: string;
    userId: number;
    year: number;
    monthIndex: number;
    dayIndex: number;
  }) {
    const { isMaster } = await this.assertCampaignMember({ campaignId: params.campaignId, userId: params.userId });

    const existing = await this.entryRepo.findOneByDateWithItems({
      campaignId: params.campaignId,
      year: params.year,
      monthIndex: params.monthIndex,
      dayIndex: params.dayIndex,
    });

    if (!existing) {
      return {
        id: null,
        campaignId: params.campaignId,
        year: params.year,
        monthIndex: params.monthIndex,
        dayIndex: params.dayIndex,
        items: [],
        updatedAt: null,
      };
    }

    const itemsFromDb = (existing.items || [])
      .filter((it) => isMaster || it.isPublic)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((it) => ({
        id: it.id,
        title: it.title,
        html: it.html,
        isPublic: !!it.isPublic,
        order: it.order ?? 0,
        updatedAt: it.updatedAt,
        lastEditedByUserId: it.lastEditedByUserId,
      }));

    // Backwards compat: if no items exist yet but legacy fields exist, expose them as derived items.
    const legacyItems = itemsFromDb.length === 0 ? this.legacyEntryToItems(existing, isMaster) : [];

    return {
      id: existing.id,
      campaignId: existing.campaignId,
      year: existing.year,
      monthIndex: existing.monthIndex,
      dayIndex: existing.dayIndex,
      items: itemsFromDb.length ? itemsFromDb : legacyItems,
      updatedAt: existing.updatedAt,
      lastEditedByUserId: existing.lastEditedByUserId,
    };
  }

  /**
   * Returns a lightweight summary of all diary entries for a campaign.
   * Used by the world-map marker picker to let the DM associate calendar entries.
   */
  async listDiaryEntries(campaignId: string, userId: number) {
    await this.assertCampaignMember({ campaignId, userId });
    const entries = await this.entryRepo.findAllForCampaignWithItems(campaignId);
    return entries.map((e) => ({
      id: e.id,
      year: e.year,
      monthIndex: e.monthIndex,
      dayIndex: e.dayIndex,
      itemCount: (e.items ?? []).length,
      firstTitle: (e.items ?? []).find((i) => i.title)?.title ?? null,
      updatedAt: e.updatedAt,
    }));
  }

  /**
   * Returns a single diary entry by UUID (for the marker detail subview).
   */
  async getDiaryEntryById(id: string, campaignId: string, userId: number) {
    const { isMaster } = await this.assertCampaignMember({ campaignId, userId });
    const existing = await this.entryRepo.findOneByIdWithItems(id, campaignId);
    if (!existing) return null;

    const itemsFromDb = (existing.items || [])
      .filter((it) => isMaster || it.isPublic)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((it) => ({
        id: it.id,
        title: it.title,
        html: it.html,
        isPublic: !!it.isPublic,
        order: it.order ?? 0,
        updatedAt: it.updatedAt,
      }));

    return {
      id: existing.id,
      campaignId: existing.campaignId,
      year: existing.year,
      monthIndex: existing.monthIndex,
      dayIndex: existing.dayIndex,
      items: itemsFromDb,
      updatedAt: existing.updatedAt,
    };
  }

  async upsertDiaryEntry(params: {
    campaignId: string;
    userId: number;
    year: number;
    monthIndex: number;
    dayIndex: number;
    publicHtml?: string | null;
    privateHtml?: string | null;
    items?: Array<{ id?: string; title?: string | null; html?: string | null; isPublic?: boolean; order?: number }>;
  }) {
    await this.assertMaster({ campaignId: params.campaignId, userId: params.userId });

    // Ensure entry exists (also keeps legacy columns for now).
    const savedEntry = await this.entryRepo.upsertByDate({
      campaignId: params.campaignId,
      year: params.year,
      monthIndex: params.monthIndex,
      dayIndex: params.dayIndex,
      publicHtml: sanitizeDiaryHtml(params.publicHtml ?? null),
      privateHtml: sanitizeDiaryHtml(params.privateHtml ?? null),
      lastEditedByUserId: params.userId,
    });

    // New format: items
    if (Array.isArray(params.items)) {
      const existingItems = await this.entryItemRepo.findByEntryId(savedEntry.id);
      const existingById = new Map(existingItems.map((it) => [it.id, it] as const));

      const toSave: DiaryEntryItem[] = [];
      const keptIds: string[] = [];

      params.items.forEach((raw, idx) => {
        const normalizedOrder = typeof raw.order === 'number' ? raw.order : idx;
        const normalizedIsPublic = raw.isPublic === true;
        const normalizedTitle = raw.title === undefined ? null : raw.title;
        const normalizedHtml = sanitizeDiaryHtml(raw.html ?? null);

        if (raw.id && existingById.has(raw.id)) {
          const it = existingById.get(raw.id)!;
          it.title = normalizedTitle;
          it.html = normalizedHtml;
          it.isPublic = normalizedIsPublic;
          it.order = normalizedOrder;
          it.lastEditedByUserId = params.userId;
          toSave.push(it);
          keptIds.push(it.id);
        } else {
          const it = new DiaryEntryItem();
          it.entryId = savedEntry.id;
          it.title = normalizedTitle;
          it.html = normalizedHtml;
          it.isPublic = normalizedIsPublic;
          it.order = normalizedOrder;
          it.lastEditedByUserId = params.userId;
          toSave.push(it);
        }
      });

      const savedItems = await this.entryItemRepo.saveMany(toSave);

      // Delete items omitted from payload (only those that existed before).
      const toDelete = existingItems.filter((it) => !keptIds.includes(it.id)).map((it) => it.id);
      await this.entryItemRepo.deleteByIds(toDelete);

      const visibleItems = savedItems
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((it) => ({
          id: it.id,
          title: it.title,
          html: it.html,
          isPublic: !!it.isPublic,
          order: it.order ?? 0,
          updatedAt: it.updatedAt,
          lastEditedByUserId: it.lastEditedByUserId,
        }));

      return {
        id: savedEntry.id,
        campaignId: savedEntry.campaignId,
        year: savedEntry.year,
        monthIndex: savedEntry.monthIndex,
        dayIndex: savedEntry.dayIndex,
        items: visibleItems,
        updatedAt: savedEntry.updatedAt,
        lastEditedByUserId: savedEntry.lastEditedByUserId,
      };
    }

    // Legacy behavior fallback
    return {
      id: savedEntry.id,
      campaignId: savedEntry.campaignId,
      year: savedEntry.year,
      monthIndex: savedEntry.monthIndex,
      dayIndex: savedEntry.dayIndex,
      items: this.legacyEntryToItems(savedEntry, true),
      updatedAt: savedEntry.updatedAt,
      lastEditedByUserId: savedEntry.lastEditedByUserId,
    };
  }

  async listSessions(campaignId: string, userId: number) {
    const { isMaster } = await this.assertCampaignMember({ campaignId, userId });
    const all = await this.sessionRepo.findAllForCampaignWithItems(campaignId);

    return all
      .filter((s) => isMaster || s.isPublic)
      .map((s) => this.toSessionDto(s, isMaster));
  }

  async createSession(
    campaignId: string,
    userId: number,
    dto: {
      title: string | null;
      isPublic: boolean;
      publicHtml: string | null;
      privateHtml: string | null;
      items?: Array<{ id?: string; title?: string | null; html?: string | null; isPublic?: boolean; order?: number }>;
      days: DiaryDayRef[];
    },
  ) {
    await this.assertMaster({ campaignId, userId });

    const created = await this.sessionRepo.createSession({
      campaignId,
      title: dto.title,
      isPublic: dto.isPublic,
      publicHtml: sanitizeDiaryHtml(dto.publicHtml),
      privateHtml: sanitizeDiaryHtml(dto.privateHtml),
      days: dto.days,
      createdByUserId: userId,
      startedAt: new Date(),
    });

    if (Array.isArray(dto.items)) {
      const toSave: DiarySessionItem[] = dto.items.map((raw, idx) => {
        const it = new DiarySessionItem();
        it.sessionId = created.id;
        it.title = raw.title === undefined ? null : raw.title;
        it.html = sanitizeDiaryHtml(raw.html ?? null);
        it.isPublic = raw.isPublic === true;
        it.order = typeof raw.order === 'number' ? raw.order : idx;
        it.lastEditedByUserId = userId;
        return it;
      });
      await this.sessionItemRepo.saveMany(toSave);
    }

    const createdWithItems = await this.sessionRepo.findByIdWithItems(created.id);
    return this.toSessionDto(createdWithItems || created, true);
  }

  async updateSession(
    campaignId: string,
    userId: number,
    sessionId: string,
    dto: {
      title?: string | null;
      isPublic?: boolean;
      publicHtml?: string | null;
      privateHtml?: string | null;
      items?: Array<{ id?: string; title?: string | null; html?: string | null; isPublic?: boolean; order?: number }>;
    },
  ) {
    await this.assertMaster({ campaignId, userId });

    const session = await this.sessionRepo.findByIdWithItems(sessionId);
    if (!session || session.campaignId !== campaignId) throw new NotFoundException('Session not found');

    if (dto.title !== undefined) session.title = dto.title;
    if (dto.isPublic !== undefined) session.isPublic = dto.isPublic;
    if (dto.publicHtml !== undefined) session.publicHtml = sanitizeDiaryHtml(dto.publicHtml);
    if (dto.privateHtml !== undefined) session.privateHtml = sanitizeDiaryHtml(dto.privateHtml);

    if (Array.isArray(dto.items)) {
      const existingItems = await this.sessionItemRepo.findBySessionId(session.id);
      const existingById = new Map(existingItems.map((it) => [it.id, it] as const));

      const toSave: DiarySessionItem[] = [];
      const keptIds: string[] = [];

      dto.items.forEach((raw, idx) => {
        const normalizedOrder = typeof raw.order === 'number' ? raw.order : idx;
        const normalizedIsPublic = raw.isPublic === true;
        const normalizedTitle = raw.title === undefined ? null : raw.title;
        const normalizedHtml = sanitizeDiaryHtml(raw.html ?? null);

        if (raw.id && existingById.has(raw.id)) {
          const it = existingById.get(raw.id)!;
          it.title = normalizedTitle;
          it.html = normalizedHtml;
          it.isPublic = normalizedIsPublic;
          it.order = normalizedOrder;
          it.lastEditedByUserId = userId;
          toSave.push(it);
          keptIds.push(it.id);
        } else {
          const it = new DiarySessionItem();
          it.sessionId = session.id;
          it.title = normalizedTitle;
          it.html = normalizedHtml;
          it.isPublic = normalizedIsPublic;
          it.order = normalizedOrder;
          it.lastEditedByUserId = userId;
          toSave.push(it);
        }
      });

      const savedItems = await this.sessionItemRepo.saveMany(toSave);
      const toDelete = existingItems.filter((it) => !keptIds.includes(it.id)).map((it) => it.id);
      await this.sessionItemRepo.deleteByIds(toDelete);

      session.items = savedItems;
    }

    const saved = await this.sessionRepo.save(session);
    return this.toSessionDto(saved, true);
  }

  async startSession(campaignId: string, userId: number, dto: { title: string | null; isPublic: boolean }) {
    await this.assertMaster({ campaignId, userId });

    const active = await this.getActiveSessionInternal(campaignId);
    if (active) throw new BadRequestException('A session is already active');

    const created = await this.sessionRepo.createSession({
      campaignId,
      title: dto.title,
      isPublic: dto.isPublic,
      publicHtml: null,
      privateHtml: null,
      days: [],
      createdByUserId: userId,
      startedAt: new Date(),
    });

    // Seed the map active at the moment the session starts, so it counts as a
    // place that appeared even if it never changes afterwards.
    try {
      const { mapId } = await this.campaignsService.getActiveMap(userId, campaignId);
      if (mapId) {
        created.mapRefs = [mapId];
        await this.sessionRepo.save(created);
      }
    } catch { /* best-effort: never block session start */ }

    const createdWithItems = await this.sessionRepo.findByIdWithItems(created.id);
    return this.toSessionDto(createdWithItems || created, true);
  }

  async endSession(campaignId: string, userId: number, sessionId: string) {
    await this.assertMaster({ campaignId, userId });

    const session = await this.sessionRepo.findByIdWithItems(sessionId);
    if (!session || session.campaignId !== campaignId) throw new NotFoundException('Session not found');
    if (session.endedAt) throw new BadRequestException('Session already ended');

    session.endedAt = new Date();
    const saved = await this.sessionRepo.save(session);
    return this.toSessionDto(saved, true);
  }

  async getActiveSession(campaignId: string, userId: number) {
    const { isMaster } = await this.assertCampaignMember({ campaignId, userId });
    const active = await this.getActiveSessionInternal(campaignId);
    if (!active) return null;

    // Players can see active session only if public.
    if (!isMaster && !active.isPublic) return null;
    return this.toSessionDto(active, isMaster);
  }

  async visitDay(campaignId: string, userId: number, sessionId: string, day: DiaryDayRef) {
    await this.assertMaster({ campaignId, userId });

    const session = await this.sessionRepo.findById(sessionId);
    if (!session || session.campaignId !== campaignId) throw new NotFoundException('Session not found');
    if (session.endedAt) throw new BadRequestException('Session already ended');

    const key = `${day.year}:${day.monthIndex}:${day.dayIndex}`;
    const existingKeys = new Set(session.days.map((d) => `${d.year}:${d.monthIndex}:${d.dayIndex}`));
    if (!existingKeys.has(key)) {
      session.days = [...session.days, day];
      await this.sessionRepo.save(session);
    }

    const sessionWithItems = await this.sessionRepo.findByIdWithItems(session.id);
    return this.toSessionDto(sessionWithItems || session, true);
  }

  /**
   * Deletes a diary session.
   *
   * Rules:
   * - Only campaign masters can delete sessions.
   * - Only ended sessions can be deleted.
   * - Session must belong to the campaign.
   */
  async deleteSession(campaignId: string, userId: number, sessionId: string): Promise<void> {
    await this.assertMaster({ campaignId, userId });

    const session = await this.sessionRepo.findById(sessionId);
    if (!session || session.campaignId !== campaignId) throw new NotFoundException('Session not found');
    if (!session.endedAt) throw new BadRequestException('Only ended sessions can be deleted');

    await this.sessionRepo.deleteById(session.id);
  }

  private toSessionDto(session: DiarySession, isMaster: boolean) {
    const itemsFromDb = (session.items || [])
      .filter((it) => isMaster || it.isPublic)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((it) => ({
        id: it.id,
        title: it.title,
        html: it.html,
        isPublic: !!it.isPublic,
        order: it.order ?? 0,
        updatedAt: it.updatedAt,
        lastEditedByUserId: it.lastEditedByUserId,
      }));

    const legacyItems = itemsFromDb.length === 0 ? this.legacySessionToItems(session, isMaster) : [];

    return {
      id: session.id,
      campaignId: session.campaignId,
      title: session.title,
      isPublic: session.isPublic,
      items: itemsFromDb.length ? itemsFromDb : legacyItems,
      days: session.days,
      characterRefs: session.characterRefs || [],
      mapRefs: session.mapRefs || [],
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdByUserId: session.createdByUserId,
      updatedAt: session.updatedAt,
    };
  }

  private async getActiveSessionInternal(campaignId: string): Promise<DiarySession | null> {
    const active = await this.sessionRepo.findActiveForCampaignWithItems(campaignId);
    return active ?? null;
  }
}
