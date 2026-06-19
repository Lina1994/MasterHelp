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
import { AdventureLogService } from '../adventure-log/adventure-log.service';

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(
    @InjectRepository(Quest)
    private readonly questsRepo: Repository<Quest>,
    @InjectRepository(Campaign)
    private readonly campaignsRepo: Repository<Campaign>,
    private readonly adventureLog: AdventureLogService,
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
   * Appends a quest status change to the campaign's automatic adventure log.
   * Gated by the campaign's auto-log settings and active diary session
   * (handled inside {@link AdventureLogService}).
   */
  private async logQuestStatusChange(
    campaignId: string,
    questTitle: string,
    status: 'accepted' | 'completed',
    userId: number,
  ): Promise<void> {
    const title = status === 'accepted' ? 'Misión aceptada' : 'Misión completada';
    const bodyHtml = `<p>${AdventureLogService.escapeHtml(questTitle)}.</p>`;
    await this.adventureLog.logEvent(campaignId, 'quest', { title, bodyHtml }, userId);
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
        await this.logQuestStatusChange(quest.campaignId, quest.title, newStatus, userId);
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
