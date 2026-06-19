import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignCalendar } from '../diary/entities/campaign-calendar.entity';
import { DiaryEntry } from '../diary/entities/diary-entry.entity';
import { DiaryEntryItem } from '../diary/entities/diary-entry-item.entity';
import { DiarySession } from '../diary/entities/diary-session.entity';

/** Categories of automatic adventure-log events. */
export type AdventureLogCategory = 'place' | 'character' | 'quest' | 'combat';

/** Title of the consolidated diary item used for the automatic log. */
const ADVENTURE_LOG_ITEM_TITLE = 'Registro de aventuras';

/**
 * Content of a single automatic log event: a heading title and the body HTML
 * shown on the line(s) below it.
 */
export interface AdventureLogEventContent {
  /** Short heading rendered as an underlined bold H3. */
  title: string;
  /** Pre-built, safe HTML body (e.g. one or more `<p>…</p>`). */
  bodyHtml: string;
}

/**
 * Maps each category to its corresponding toggle on `Campaign.autoLogSettings`.
 */
const CATEGORY_TO_TOGGLE: Record<AdventureLogCategory, 'logPlaces' | 'logCharacters' | 'logQuests' | 'logCombat'> = {
  place: 'logPlaces',
  character: 'logCharacters',
  quest: 'logQuests',
  combat: 'logCombat',
};

/**
 * AdventureLogService
 *
 * Best-effort, backend-driven automatic diary logging. When a campaign has
 * auto-log enabled (globally + per category) AND a diary session is currently
 * active, it appends a line to a single "Registro de aventuras" diary item on
 * the campaign's current calendar day.
 *
 * It injects diary repositories directly (mirroring QuestsService) to avoid a
 * circular dependency with DiaryService/CampaignsService.
 */
@Injectable()
export class AdventureLogService {
  private readonly logger = new Logger(AdventureLogService.name);

  constructor(
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignCalendar) private readonly calendarRepo: Repository<CampaignCalendar>,
    @InjectRepository(DiaryEntry) private readonly entryRepo: Repository<DiaryEntry>,
    @InjectRepository(DiaryEntryItem) private readonly itemRepo: Repository<DiaryEntryItem>,
    @InjectRepository(DiarySession) private readonly sessionRepo: Repository<DiarySession>,
  ) {}

  /**
   * Escapes a plain-text string for safe inclusion in diary HTML.
   * @param text - Untrusted text (e.g. a map or character name).
   */
  static escapeHtml(text: string): string {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Appends an event to the campaign's automatic adventure log for the current
   * in-game day, if auto-logging is enabled for the given category and a diary
   * session is active. Never throws: logging is best-effort.
   *
   * Each event renders as an underlined, bold H3 title with its body below, and
   * consecutive events are separated by a horizontal rule.
   *
   * @param campaignId - Target campaign.
   * @param category - Event category (gated by the matching toggle).
   * @param content - Heading title and body HTML for this event.
   * @param userId - Optional author id recorded on the entry/item.
   */
  async logEvent(
    campaignId: string,
    category: AdventureLogCategory,
    content: AdventureLogEventContent,
    userId?: number | null,
  ): Promise<void> {
    try {
      if (!campaignId || !content?.bodyHtml) return;

      const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
      const settings = campaign?.autoLogSettings;
      if (!settings?.enabled) return;
      if (!settings[CATEGORY_TO_TOGGLE[category]]) return;

      // No active session => do not auto-log anything.
      const activeSession = await this.sessionRepo.findOne({
        where: { campaignId, endedAt: IsNull() },
      });
      if (!activeSession) return;

      // Resolve the current campaign calendar day (defaults: year 1, month 0, day 1).
      const calendar = await this.calendarRepo.findOne({ where: { campaignId } });
      const year = calendar?.config?.currentYear ?? 1;
      const monthIndex = calendar?.config?.currentMonthIndex ?? 0;
      const dayIndex = calendar?.config?.currentDayIndex ?? 1;

      // Find or create the diary entry for the current day.
      let entry = await this.entryRepo.findOne({ where: { campaignId, year, monthIndex, dayIndex } });
      if (!entry) {
        entry = await this.entryRepo.save(
          this.entryRepo.create({
            campaignId,
            year,
            monthIndex,
            dayIndex,
            publicHtml: null,
            privateHtml: null,
            lastEditedByUserId: userId ?? null,
          }),
        );
      }

      // Find or create the single consolidated "Registro de aventuras" item.
      let item = await this.itemRepo.findOne({
        where: { entryId: entry.id, title: ADVENTURE_LOG_ITEM_TITLE },
      });
      if (!item) {
        const itemCount = await this.itemRepo.count({ where: { entryId: entry.id } });
        item = this.itemRepo.create({
          entryId: entry.id,
          entry,
          title: ADVENTURE_LOG_ITEM_TITLE,
          html: '',
          isPublic: true,
          order: itemCount,
          lastEditedByUserId: userId ?? null,
        });
      }

      const titleHtml = `<h3><strong><u>${AdventureLogService.escapeHtml(content.title)}</u></strong></h3>`;
      const block = `${titleHtml}${content.bodyHtml}`;
      const hasExisting = !!(item.html && item.html.trim());
      item.html = `${item.html ?? ''}${hasExisting ? '<hr>' : ''}${block}`;
      item.lastEditedByUserId = userId ?? item.lastEditedByUserId ?? null;
      await this.itemRepo.save(item);

      this.logger.log(`[auto-log] ${category} appended to day ${year}-${monthIndex}-${dayIndex} (campaign ${campaignId})`);
    } catch (error: any) {
      // Best-effort: never break the triggering operation.
      this.logger.error(`[auto-log] failed (${category}): ${error?.message ?? error}`);
    }
  }

  /**
   * Records that one or more characters and/or maps "appeared" during the
   * currently active diary session (deduped). Independent of auto-log settings:
   * it only requires an active session. Best-effort — never throws.
   *
   * @param campaignId - Target campaign.
   * @param refs - Character ids and/or map ids that appeared.
   */
  async recordSessionAppearance(
    campaignId: string,
    refs: { characterIds?: (string | null | undefined)[]; mapIds?: (string | null | undefined)[] },
  ): Promise<void> {
    try {
      const characterIds = (refs.characterIds || []).filter((id): id is string => !!id);
      const mapIds = (refs.mapIds || []).filter((id): id is string => !!id);
      if (!campaignId || (characterIds.length === 0 && mapIds.length === 0)) return;

      const active = await this.sessionRepo.findOne({ where: { campaignId, endedAt: IsNull() } });
      if (!active) return;

      let changed = false;
      if (characterIds.length) {
        const set = new Set(active.characterRefs || []);
        for (const id of characterIds) {
          if (!set.has(id)) { set.add(id); changed = true; }
        }
        active.characterRefs = [...set];
      }
      if (mapIds.length) {
        const set = new Set(active.mapRefs || []);
        for (const id of mapIds) {
          if (!set.has(id)) { set.add(id); changed = true; }
        }
        active.mapRefs = [...set];
      }
      if (changed) await this.sessionRepo.save(active);
    } catch (error: any) {
      this.logger.error(`[auto-log] recordSessionAppearance failed: ${error?.message ?? error}`);
    }
  }
}
