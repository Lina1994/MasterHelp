import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from './entities/character.entity';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class CharactersService {
  private readonly logger = new Logger(CharactersService.name);
  constructor(
    @InjectRepository(Character) private charactersRepo: Repository<Character>,
    @InjectRepository(Campaign) private campaignsRepo: Repository<Campaign>,
  ) {}

  /** List characters visible to requesting user in the given campaign. */
  async listForUserInCampaign(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some((p) => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');

    if (isOwner) {
      return this.charactersRepo.find({ where: { campaign: { id: campaignId } }, order: { name: 'ASC' } });
    }
    // Player: can see own PCs and any visible ones
    return this.charactersRepo
      .createQueryBuilder('ch')
      .leftJoin('ch.ownerPlayer', 'ownerPlayer')
      .leftJoin('ch.campaign', 'campaign')
      .where('campaign.id = :campaignId', { campaignId })
      .andWhere('(ownerPlayer.id = :uid OR ch.visibleToPlayers = 1)', { uid: requestingUserId })
      .orderBy('ch.name', 'ASC')
      .getMany();
  }

  /** Create character; owner can create any; player can create only PC owned by themselves. */
  async create(requestingUserId: number, dto: CreateCharacterDto) {
    this.logger.debug({ msg: 'create dto', requestingUserId, dto });
    const campaign = await this.campaignsRepo.findOne({ where: { id: dto.campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some((p) => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');

    let ownerPlayer: User | null = null;
    if (dto.ownerPlayerId) {
      // Only owner or the ownerPlayer user can set ownerPlayerId
      if (!isOwner && dto.ownerPlayerId !== requestingUserId) {
        throw new ForbiddenException('Cannot assign owner to another user');
      }
      // Validate that the ownerPlayerId belongs to this campaign (owner or active player)
      const allowedUserIds = new Set<number>([
        campaign.owner?.id,
        ...((campaign.players || []).map((p) => p.user?.id) as number[]),
      ].filter((x): x is number => typeof x === 'number'));
      if (!allowedUserIds.has(dto.ownerPlayerId)) {
        this.logger.debug({ msg: 'owner not member (create)', ownerPlayerId: dto.ownerPlayerId, allowedUserIds: Array.from(allowedUserIds) });
        throw new BadRequestException('ownerPlayerId is not a member of this campaign');
      }
      ownerPlayer = { id: dto.ownerPlayerId } as any;
    } else if (dto.kind === 'pc') {
      // For PCs created by a player, default owner is themselves
      ownerPlayer = { id: requestingUserId } as any;
    }

    if (!isOwner && dto.kind === 'npc') {
      throw new ForbiddenException('Players cannot create NPCs');
    }

    const character = this.charactersRepo.create({
      ...dto,
      campaign: { id: dto.campaignId } as any,
      ownerPlayer: ownerPlayer || null,
      createdBy: { id: requestingUserId } as any,
    });
    return this.charactersRepo.save(character);
  }

  async getByIdForUser(requestingUserId: number, id: string) {
    const ch = await this.charactersRepo.findOne({ where: { id }, relations: ['campaign', 'campaign.owner', 'ownerPlayer'] });
    if (!ch) throw new NotFoundException('Character not found');
    const campaign = ch.campaign;
    const isOwner = campaign.owner?.id === requestingUserId;
    const isOwnerPlayer = ch.ownerPlayer?.id === requestingUserId;
    if (!isOwner && !isOwnerPlayer && !ch.visibleToPlayers) {
      throw new ForbiddenException('Character not visible');
    }
    return ch;
  }

  /** Update character with permissions: owner (master) can edit all; player can edit only their PCs. */
  async update(requestingUserId: number, id: string, dto: UpdateCharacterDto) {
    this.logger.debug({ msg: 'update dto', id, requestingUserId, dto });
    const ch = await this.charactersRepo.findOne({ where: { id }, relations: ['campaign', 'campaign.owner', 'ownerPlayer', 'campaign.players', 'campaign.players.user'] });
    if (!ch) throw new NotFoundException('Character not found');
    const isOwner = ch.campaign.owner?.id === requestingUserId;
    const isOwnerPlayer = ch.ownerPlayer?.id === requestingUserId;
    if (!isOwner && !isOwnerPlayer) throw new ForbiddenException('No permission to edit');

    // Prevent players from converting to NPC or reassigning owner to other users
    if (!isOwner) {
      if (dto.kind && dto.kind !== ch.kind) throw new ForbiddenException('Cannot change kind');
      if (typeof dto.ownerPlayerId !== 'undefined' && dto.ownerPlayerId !== requestingUserId) {
        throw new ForbiddenException('Cannot reassign owner');
      }
      // Players cannot toggle global visibility
      if (typeof dto.visibleToPlayers !== 'undefined' && dto.visibleToPlayers !== ch.visibleToPlayers) {
        throw new ForbiddenException('Cannot change visibility');
      }
    }

    Object.assign(ch, dto);
    // Normalize spells arrays/objects if present
    if (dto.cantrips) ch.cantrips = dto.cantrips.map(String);
    if (dto.spellsByLevel) ch.spellsByLevel = dto.spellsByLevel;
    if (typeof dto.ownerPlayerId !== 'undefined') {
      if (dto.ownerPlayerId === null) {
        ch.ownerPlayer = null; // unassign
      } else {
        // If changing owner, validate membership; keeping same id is allowed
        const isChanging = ch.ownerPlayer?.id !== dto.ownerPlayerId;
        if (isChanging) {
          const allowedUserIds = new Set<number>([
            ch.campaign.owner?.id,
            ...((ch.campaign.players || []).map((p) => p.user?.id) as number[]),
          ].filter((x): x is number => typeof x === 'number'));
          if (!allowedUserIds.has(dto.ownerPlayerId)) {
            this.logger.debug({ msg: 'owner not member (update)', ownerPlayerId: dto.ownerPlayerId, allowedUserIds: Array.from(allowedUserIds) });
            throw new BadRequestException('ownerPlayerId is not a member of this campaign');
          }
        }
        ch.ownerPlayer = { id: dto.ownerPlayerId } as any;
      }
    }
    return this.charactersRepo.save(ch);
  }

  async remove(requestingUserId: number, id: string) {
    const ch = await this.charactersRepo.findOne({ where: { id }, relations: ['campaign', 'campaign.owner', 'ownerPlayer'] });
    if (!ch) throw new NotFoundException('Character not found');
    const isOwner = ch.campaign.owner?.id === requestingUserId;
    const isOwnerPlayer = ch.ownerPlayer?.id === requestingUserId;
    if (!isOwner && !isOwnerPlayer) throw new ForbiddenException('No permission to delete');
    await this.charactersRepo.delete(id);
    return { ok: true };
  }
}
