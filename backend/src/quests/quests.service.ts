import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quest } from './entities/quest.entity';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../users/entities/user.entity';
import { CampaignCalendar } from '../diary/entities/campaign-calendar.entity';
import { DiaryEntry } from '../diary/entities/diary-entry.entity';
import { DiaryEntryItem } from '../diary/entities/diary-entry-item.entity';

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(
    @InjectRepository(Quest)
    private readonly questsRepo: Repository<Quest>,
    @InjectRepository(Campaign)
    private readonly campaignsRepo: Repository<Campaign>,
    @InjectRepository(CampaignCalendar)
    private readonly calendarRepo: Repository<CampaignCalendar>,
    @InjectRepository(DiaryEntry)
    private readonly diaryEntryRepo: Repository<DiaryEntry>,
    @InjectRepository(DiaryEntryItem)
    private readonly diaryEntryItemRepo: Repository<DiaryEntryItem>,
  ) {}

  /**
   * Check if user is master (owner) of the campaign.
   */
  private async assertMaster(campaignId: string, userId: number): Promise<Campaign> {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== userId) {
      throw new ForbiddenException('Only campaign master can perform this action');
    }
    return campaign;
  }

  /**
   * Check if user is member (master or player) of the campaign.
   */
  private async assertMember(campaignId: string, userId: number): Promise<{ campaign: Campaign; isMaster: boolean }> {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const isMaster = campaign.owner?.id === userId;
    const isPlayer = (campaign.players || []).some((p) => p.user?.id === userId);

    if (!isMaster && !isPlayer) {
      throw new ForbiddenException('Not a member of this campaign');
    }

    return { campaign, isMaster };
  }

  /**
   * Create a public diary entry for quest status change.
   * Uses the current day from the campaign calendar.
   */
  private async createDiaryEntry(
    campaignId: string,
    questTitle: string,
    status: 'accepted' | 'completed',
    userId: number,
  ): Promise<void> {
    try {
      // Get campaign calendar to find current day
      const calendar = await this.calendarRepo.findOne({ where: { campaignId } });
      
      // Default to year 1, month 0, day 1 if no calendar configured
      const year = calendar?.config?.currentYear ?? 1;
      const monthIndex = calendar?.config?.currentMonthIndex ?? 0;
      const dayIndex = calendar?.config?.currentDayIndex ?? 1;

      // Find or create diary entry for current day
      let entry = await this.diaryEntryRepo.findOne({
        where: { campaignId, year, monthIndex, dayIndex },
      });

      if (!entry) {
        entry = this.diaryEntryRepo.create({
          campaignId,
          year,
          monthIndex,
          dayIndex,
          publicHtml: null,
          privateHtml: null,
          lastEditedByUserId: userId,
        });
        entry = await this.diaryEntryRepo.save(entry);
      }

      // Count existing items to determine order
      const itemCount = await this.diaryEntryItemRepo.count({ where: { entryId: entry.id } });

      // Create the diary entry item
      const html = status === 'accepted' 
        ? `<p>Misión aceptada: <strong>${questTitle}</strong></p>`
        : `<p>Misión completada: <strong>${questTitle}</strong></p>`;

      const item = this.diaryEntryItemRepo.create({
        entryId: entry.id,
        entry,
        title: status === 'accepted' ? `Misión aceptada` : `Misión completada`,
        html,
        isPublic: true,
        order: itemCount,
        lastEditedByUserId: userId,
      });

      await this.diaryEntryItemRepo.save(item);
      this.logger.log(`Created diary entry for quest "${questTitle}" status: ${status} on day ${year}-${monthIndex}-${dayIndex}`);
    } catch (error) {
      this.logger.error(`Failed to create diary entry for quest: ${error.message}`, error.stack);
      // Don't throw - diary creation is optional/best-effort
    }
  }

  /**
   * List quests for a campaign.
   * - Masters see all quests
   * - Players see only accepted and completed quests
   */
  async list(userId: number, campaignId: string): Promise<Quest[]> {
    const { isMaster } = await this.assertMember(campaignId, userId);

    const queryBuilder = this.questsRepo
      .createQueryBuilder('quest')
      .leftJoinAndSelect('quest.prerequisiteQuest', 'prereq')
      .leftJoinAndSelect('quest.createdBy', 'createdBy')
      .leftJoinAndSelect('quest.lastStatusChangedBy', 'lastStatusChangedBy')
      .where('quest.campaignId = :campaignId', { campaignId })
      .orderBy('quest.order', 'ASC')
      .addOrderBy('quest.createdAt', 'ASC');

    if (!isMaster) {
      // Players only see accepted or completed quests
      queryBuilder.andWhere('quest.status IN (:...statuses)', {
        statuses: ['accepted', 'completed'],
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * Get a single quest by ID.
   * - Masters can see any quest
   * - Players can only see accepted or completed quests
   */
  async getById(userId: number, id: string): Promise<Quest> {
    const quest = await this.questsRepo.findOne({
      where: { id },
      relations: ['campaign', 'campaign.owner', 'prerequisiteQuest', 'createdBy', 'lastStatusChangedBy'],
    });

    if (!quest) throw new NotFoundException('Quest not found');

    const { isMaster } = await this.assertMember(quest.campaignId, userId);

    if (!isMaster && quest.status === 'not_accepted') {
      throw new ForbiddenException('Quest not visible to players');
    }

    return quest;
  }

  /**
   * Create a new quest (master only).
   */
  async create(userId: number, dto: CreateQuestDto): Promise<Quest> {
    await this.assertMaster(dto.campaignId, userId);

    // Validate prerequisite quest if provided
    if (dto.prerequisiteQuestId) {
      const prereq = await this.questsRepo.findOne({
        where: { id: dto.prerequisiteQuestId, campaignId: dto.campaignId },
      });
      if (!prereq) {
        throw new BadRequestException('Prerequisite quest not found in this campaign');
      }
    }

    const quest = this.questsRepo.create({
      campaignId: dto.campaignId,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status || 'not_accepted',
      prerequisiteQuestId: dto.prerequisiteQuestId ?? null,
      order: dto.order ?? 0,
      campaign: { id: dto.campaignId } as any,
      createdBy: { id: userId } as any,
    });

    const saved = await this.questsRepo.save(quest);
    
    // Reload with all relations for complete response
    return this.questsRepo.findOne({
      where: { id: saved.id },
      relations: ['campaign', 'prerequisiteQuest', 'createdBy', 'lastStatusChangedBy'],
    });
  }

  /**
   * Update a quest.
   * - Masters can update everything
   * - Players can only change status from not_accepted to accepted, or from accepted to completed
   */
  async update(userId: number, id: string, dto: UpdateQuestDto): Promise<Quest> {
    const quest = await this.questsRepo.findOne({
      where: { id },
      relations: [
        'campaign', 
        'campaign.owner', 
        'campaign.players', 
        'campaign.players.user',
        'createdBy',
        'lastStatusChangedBy',
        'prerequisiteQuest',
      ],
    });

    if (!quest) throw new NotFoundException('Quest not found');

    const { isMaster } = await this.assertMember(quest.campaignId, userId);

    // Validate prerequisite quest if being updated
    if (dto.prerequisiteQuestId !== undefined) {
      if (!isMaster) {
        throw new ForbiddenException('Only master can change quest prerequisites');
      }
      if (dto.prerequisiteQuestId) {
        const prereq = await this.questsRepo.findOne({
          where: { id: dto.prerequisiteQuestId, campaignId: quest.campaignId },
        });
        if (!prereq) {
          throw new BadRequestException('Prerequisite quest not found in this campaign');
        }
      }
    }

    const oldStatus = quest.status;
    const newStatus = dto.status ?? oldStatus;

    // Players can only change status, and only in specific ways
    if (!isMaster) {
      const hasOnlyStatusChange = Object.keys(dto).length === 1 && 'status' in dto;
      if (!hasOnlyStatusChange) {
        throw new ForbiddenException('Players can only change quest status');
      }

      // Validate status transition
      if (oldStatus === 'not_accepted' && newStatus !== 'accepted') {
        throw new ForbiddenException('Can only accept not_accepted quests');
      }
      if (oldStatus === 'accepted' && newStatus !== 'completed') {
        throw new ForbiddenException('Can only complete accepted quests');
      }
      if (oldStatus === 'completed') {
        throw new ForbiddenException('Cannot change completed quest status');
      }
    }

    // Update quest
    if (dto.title !== undefined) quest.title = dto.title;
    if (dto.description !== undefined) quest.description = dto.description;
    if (dto.status !== undefined) quest.status = dto.status;
    if (dto.order !== undefined) quest.order = dto.order;
    
    // Handle prerequisite separately to avoid TypeORM relation conflicts
    if (dto.prerequisiteQuestId !== undefined) {
      quest.prerequisiteQuestId = dto.prerequisiteQuestId;
      if (dto.prerequisiteQuestId) {
        quest.prerequisiteQuest = { id: dto.prerequisiteQuestId } as any;
      } else {
        quest.prerequisiteQuest = null;
      }
    }

    // Track status change
    if (newStatus !== oldStatus) {
      quest.lastStatusChangedBy = { id: userId } as any;
      quest.statusChangedAt = new Date();

      // Create diary entry for accepted or completed status
      if (newStatus === 'accepted' || newStatus === 'completed') {
        await this.createDiaryEntry(quest.campaignId, quest.title, newStatus, userId);
      }
    }

    const saved = await this.questsRepo.save(quest);
    
    // Reload with all relations for complete response
    return this.questsRepo.findOne({
      where: { id: saved.id },
      relations: ['campaign', 'prerequisiteQuest', 'createdBy', 'lastStatusChangedBy'],
    });
  }

  /**
   * Delete a quest (master only).
   */
  async remove(userId: number, id: string): Promise<void> {
    const quest = await this.questsRepo.findOne({
      where: { id },
      relations: ['campaign', 'campaign.owner'],
    });

    if (!quest) throw new NotFoundException('Quest not found');

    const campaignId = quest.campaign?.id || quest.campaignId;
    await this.assertMaster(campaignId, userId);

    // Check if any other quest depends on this one
    const dependentQuests = await this.questsRepo.count({
      where: { prerequisiteQuestId: id },
    });

    if (dependentQuests > 0) {
      throw new BadRequestException(
        'Cannot delete quest that is a prerequisite for other quests',
      );
    }

    await this.questsRepo.delete(id);
  }
}
