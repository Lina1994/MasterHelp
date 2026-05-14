import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignPlayer } from '../campaigns/entities/campaign-player.entity';
import { Shortcut } from './entities/shortcut.entity';
import { User } from '../users/entities/user.entity';

/**
 * Repository wrapper for shortcut persistence concerns.
 */
@Injectable()
export class ShortcutsRepository {
  constructor(
    @InjectRepository(Shortcut)
    private readonly repository: Repository<Shortcut>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignPlayer)
    private readonly campaignPlayerRepository: Repository<CampaignPlayer>,
  ) {}

  async findAllByOwner(ownerId: number, campaignId?: string | null): Promise<Shortcut[]> {
    const query = this.repository.createQueryBuilder('shortcut')
      .leftJoinAndSelect('shortcut.owner', 'owner')
      .leftJoinAndSelect('shortcut.campaign', 'campaign')
      .where('owner.id = :ownerId', { ownerId });

    if (campaignId) {
      query.andWhere('(shortcut.scope = :globalScope OR (shortcut.scope = :campaignScope AND campaign.id = :campaignId))', {
        globalScope: 'global',
        campaignScope: 'campaign',
        campaignId,
      });
    } else {
      query.andWhere('shortcut.scope = :globalScope', { globalScope: 'global' });
    }

    return query.orderBy('shortcut.sortOrder', 'ASC').addOrderBy('shortcut.createdAt', 'ASC').getMany();
  }

  async findByIdForOwner(id: string, ownerId: number): Promise<Shortcut | null> {
    return this.repository.findOne({
      where: { id, owner: { id: ownerId } },
      relations: { owner: true, campaign: true },
    });
  }

  async findHotkeyConflict(
    ownerId: number,
    normalizedHotkey: string,
    scope: 'global' | 'campaign',
    campaignId?: string | null,
    excludeId?: string,
  ): Promise<Shortcut | null> {
    if (!normalizedHotkey) return null;

    const query = this.repository.createQueryBuilder('shortcut')
      .leftJoin('shortcut.owner', 'owner')
      .leftJoin('shortcut.campaign', 'campaign')
      .where('owner.id = :ownerId', { ownerId })
      .andWhere('shortcut.normalizedHotkey = :normalizedHotkey', { normalizedHotkey });

    if (excludeId) {
      query.andWhere('shortcut.id <> :excludeId', { excludeId });
    }

    if (scope === 'campaign' && campaignId) {
      query.andWhere('((shortcut.scope = :globalScope) OR (shortcut.scope = :campaignScope AND campaign.id = :campaignId))', {
        globalScope: 'global',
        campaignScope: 'campaign',
        campaignId,
      });
    } else {
      query.andWhere('(shortcut.scope = :globalScope OR shortcut.scope = :campaignScope)', {
        globalScope: 'global',
        campaignScope: 'campaign',
      });
    }

    return query.getOne();
  }

  async findCampaignById(campaignId: string): Promise<Campaign | null> {
    return this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
  }

  async isCampaignMember(campaignId: string, ownerId: number): Promise<boolean> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) return false;
    if (campaign.owner?.id === ownerId) return true;

    const membership = await this.campaignPlayerRepository.findOne({
      where: {
        campaign: { id: campaignId },
        user: { id: ownerId },
        status: 'active',
      },
      relations: ['user', 'campaign'],
    });

    return Boolean(membership);
  }

  createCampaignReference(campaignId: string): Campaign {
    return this.repository.manager.create(Campaign, { id: campaignId });
  }

  create(data: Partial<Shortcut>): Shortcut {
    return this.repository.create(data);
  }

  async save(shortcut: Shortcut): Promise<Shortcut> {
    return this.repository.save(shortcut);
  }

  async remove(shortcut: Shortcut): Promise<void> {
    await this.repository.remove(shortcut);
  }

  createOwnerReference(ownerId: number): User {
    return this.repository.manager.create(User, { id: ownerId });
  }
}