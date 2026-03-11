import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffinityLink } from './entities/affinity-link.entity';
import { Character } from './entities/character.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CreateAffinityLinkDto } from './dto/create-affinity-link.dto';
import { UpdateAffinityLinkDto } from './dto/update-affinity-link.dto';

/**
 * Service responsible for CRUD operations on affinity links (relationships
 * between characters displayed on the affinity chart).
 */
@Injectable()
export class AffinityLinksService {
  constructor(
    @InjectRepository(AffinityLink) private readonly repo: Repository<AffinityLink>,
    @InjectRepository(Character) private readonly charRepo: Repository<Character>,
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
  ) {}

  /**
   * Validates that the requesting user is a member of the given campaign.
   * Returns the campaign entity and whether the user is the owner.
   */
  private async assertMember(userId: number, campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === userId;
    const isPlayer = (campaign.players || []).some(
      (p) => p.user?.id === userId,
    );
    if (!isOwner && !isPlayer) {
      throw new ForbiddenException('Not a member of this campaign');
    }
    return { campaign, isOwner };
  }

  /**
   * Lists all affinity links for a campaign.
   *
   * @param userId      - ID of the requesting user.
   * @param campaignId  - Campaign to fetch links for.
   * @returns Array of AffinityLink entities with characterA and characterB populated.
   */
  async list(userId: number, campaignId: string): Promise<AffinityLink[]> {
    await this.assertMember(userId, campaignId);
    return this.repo.find({
      where: { campaign: { id: campaignId } },
      relations: ['characterA', 'characterB'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Creates a new affinity link between two characters.
   *
   * @param userId - ID of the requesting user (must be campaign owner/master).
   * @param dto    - Payload with campaignId, characterAId, characterBId, label, color.
   * @returns The newly created AffinityLink entity.
   */
  async create(userId: number, dto: CreateAffinityLinkDto): Promise<AffinityLink> {
    const { campaign, isOwner } = await this.assertMember(userId, dto.campaignId);
    if (!isOwner) throw new ForbiddenException('Only the campaign owner can manage the affinity chart');

    if (dto.characterAId === dto.characterBId) {
      throw new BadRequestException('Cannot link a character to itself');
    }

    const [charA, charB] = await Promise.all([
      this.charRepo.findOne({ where: { id: dto.characterAId, campaign: { id: dto.campaignId } } }),
      this.charRepo.findOne({ where: { id: dto.characterBId, campaign: { id: dto.campaignId } } }),
    ]);
    if (!charA || !charB) throw new NotFoundException('One or both characters not found in this campaign');

    const link = this.repo.create({
      campaign,
      characterA: charA,
      characterB: charB,
      labelAtoB: dto.labelAtoB ?? '',
      labelBtoA: dto.labelBtoA ?? '',
      sentiment: dto.sentiment ?? 0,
      color: dto.color ?? '#90caf9',
    });
    return this.repo.save(link);
  }

  /**
   * Updates an existing affinity link (label and/or colour).
   *
   * @param userId - ID of the requesting user (must be campaign owner/master).
   * @param linkId - UUID of the link to update.
   * @param dto    - Fields to update.
   * @returns The updated AffinityLink entity.
   */
  async update(userId: number, linkId: string, dto: UpdateAffinityLinkDto): Promise<AffinityLink> {
    const link = await this.repo.findOne({
      where: { id: linkId },
      relations: ['campaign', 'campaign.owner', 'characterA', 'characterB'],
    });
    if (!link) throw new NotFoundException('Affinity link not found');
    if (link.campaign.owner?.id !== userId) {
      throw new ForbiddenException('Only the campaign owner can manage the affinity chart');
    }

    if (dto.labelAtoB !== undefined) link.labelAtoB = dto.labelAtoB;
    if (dto.labelBtoA !== undefined) link.labelBtoA = dto.labelBtoA;
    if (dto.sentiment !== undefined) link.sentiment = dto.sentiment;
    if (dto.color !== undefined) link.color = dto.color;
    return this.repo.save(link);
  }

  /**
   * Deletes an affinity link.
   *
   * @param userId - ID of the requesting user (must be campaign owner/master).
   * @param linkId - UUID of the link to delete.
   */
  async remove(userId: number, linkId: string): Promise<void> {
    const link = await this.repo.findOne({
      where: { id: linkId },
      relations: ['campaign', 'campaign.owner'],
    });
    if (!link) throw new NotFoundException('Affinity link not found');
    if (link.campaign.owner?.id !== userId) {
      throw new ForbiddenException('Only the campaign owner can manage the affinity chart');
    }
    await this.repo.remove(link);
  }
}
