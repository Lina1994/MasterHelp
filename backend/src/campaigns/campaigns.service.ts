import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InvitePlayerDto } from './dto/invite-player.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { MapEntity } from '../maps/entities/map.entity';
import { GridOverlaySettingsDto } from './dto/grid-overlay-settings.dto';
import { UpdateCampaignManualsDto } from './dto/update-campaign-manuals.dto';
import { Character } from '../characters/entities/character.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(CampaignPlayer)
    private campaignPlayersRepository: Repository<CampaignPlayer>,
    private readonly usersService: UsersService,
  ) {}

  // --- Métodos públicos requeridos por el controller ---
  /**
   * Devuelve todas las campañas donde el usuario es owner o player.
   */
  async findAllForUser(userId: number): Promise<Campaign[]> {
    const asOwner = await this.campaignsRepository.find({
      where: { owner: { id: userId } },
      relations: ['players', 'players.user', 'owner', 'activeSkylineCharacter'],
    });
    const asPlayer = await this.campaignPlayersRepository.find({
      where: { user: { id: userId } },
      relations: ['campaign', 'campaign.owner', 'campaign.players', 'campaign.players.user', 'campaign.activeSkylineCharacter'],
    });
    const playerCampaigns = asPlayer.map((cp) => cp.campaign);
    const all = [...asOwner, ...playerCampaigns];
    const unique = all.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    return unique;
  }

  async findOne(id: string): Promise<Campaign | undefined> {
    return this.campaignsRepository.findOne({
      where: { id },
      relations: ['players', 'players.user', 'owner', 'activeSkylineCharacter'],
    });
  }

  async createWithOwner(createCampaignDto: CreateCampaignDto, ownerId: number): Promise<Campaign> {
    const owner = await this.campaignsRepository.manager.findOne(User, { where: { id: ownerId } });
    if (!owner) throw new Error('Owner user not found');
    const campaign = this.campaignsRepository.create({ ...createCampaignDto, owner });
    const savedCampaign = await this.campaignsRepository.save(campaign);
    return this.findOne(savedCampaign.id) as Promise<Campaign>;
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto): Promise<Campaign> {
    await this.campaignsRepository.update(id, updateCampaignDto);
    return this.findOne(id) as Promise<Campaign>;
  }

  async remove(id: string): Promise<void> {
    await this.campaignsRepository.delete(id);
  }

  async invitePlayer(campaignId: string, dto: InvitePlayerDto) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let user: User | undefined;
    if (dto.email) {
      user = await this.usersService['usersRepository'].findOne({ where: { email: dto.email } });
    } else if (dto.username) {
      user = await this.usersService['usersRepository'].findOne({
        where: { username: dto.username },
      });
    }
    if (!user) throw new NotFoundException('User not found');

    const existing = campaign.players.find((p) => p.user.id === user!.id);
    if (existing) {
      if (existing.status === 'invited') throw new BadRequestException('User already invited');
      if (existing.status === 'active') throw new BadRequestException('User is already a player');
      if (existing.status === 'declined') {
        existing.status = 'invited';
        await this.campaignPlayersRepository.save(existing);
        return { message: 'User re-invited' };
      }
    } else {
      const invitation = this.campaignPlayersRepository.create({
        campaign,
        user,
        role: 'player',
        status: 'invited',
      });
      await this.campaignPlayersRepository.save(invitation);
    }
    return { message: 'Invitation sent' };
  }

  async removePlayer(campaignId: string, playerId: string) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const campaignPlayer = await this.campaignPlayersRepository.findOne({
      where: { id: playerId },
      relations: ['user', 'campaign'],
    });
    if (!campaignPlayer) throw new NotFoundException('Player not found');

    if (campaignPlayer.user.id === campaign.owner.id)
      throw new ForbiddenException('Owner cannot remove themselves');

    await this.campaignPlayersRepository.delete(playerId);
    return { message: 'Player removed' };
  }

  async respondInvitation(userId: number, dto: RespondInvitationDto) {
    const invitation = await this.campaignPlayersRepository.findOne({
      where: { id: dto.invitationId },
      relations: ['user'],
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.user.id !== userId) throw new ForbiddenException('Not your invitation');
    if (invitation.status !== 'invited')
      throw new BadRequestException('Invitation already responded');

    if (dto.response === 'accept') {
      invitation.status = 'active';
    } else if (dto.response === 'decline') {
      invitation.status = 'declined';
    } else {
      throw new BadRequestException('Invalid response');
    }
    await this.campaignPlayersRepository.save(invitation);
    return { message: `Invitation ${dto.response}ed` };
  }

  async getPendingInvitations(userId: number) {
    const invitations = await this.campaignPlayersRepository.find({
      where: { user: { id: userId }, status: 'invited' },
      relations: ['campaign', 'campaign.owner'],
    });
    return invitations;
  }

  // --- Active Skyline Character ---
  async getActiveSkylineCharacter(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user', 'activeSkylineCharacter'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some((p) => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return { characterId: campaign.activeSkylineCharacter?.id ?? null };
  }

  async setActiveSkylineCharacter(campaignId: string, characterId: string | null) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'activeSkylineCharacter'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (!characterId) {
      campaign.activeSkylineCharacter = null;
      await this.campaignsRepository.save(campaign);
      return { ok: true };
    }

    const charRepo = this.campaignsRepository.manager.getRepository(Character);
    const character = await charRepo.findOne({
      where: { id: characterId },
      relations: ['campaign', 'createdBy', 'ownerPlayer'],
    });
    if (!character) throw new NotFoundException('Character not found');

    const sameCampaign = character.campaign?.id === campaign.id;
    const createdByOwner = character.createdBy?.id === campaign.owner?.id;
    const ownedByOwner = character.ownerPlayer?.id === campaign.owner?.id;
    if (!sameCampaign && !createdByOwner && !ownedByOwner) {
      throw new ForbiddenException('Character not allowed for this campaign');
    }

    campaign.activeSkylineCharacter = character;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- Active Map ---
  async getActiveMap(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user', 'activeMap'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return { mapId: campaign.activeMap?.id || null };
  }

  async setActiveMap(campaignId: string, mapId: string | null) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'activeMap'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (!mapId) {
      campaign.activeMap = null;
      await this.campaignsRepository.save(campaign);
      return { ok: true };
    }
    const mapRepo = this.campaignsRepository.manager.getRepository(MapEntity);
    const map = await mapRepo.findOne({ where: { id: mapId }, relations: ['owner', 'campaign'] });
    if (!map) throw new NotFoundException('Map not found');
    const sameOwner = map.owner?.id === campaign.owner?.id;
    const sameCampaign = map.campaign?.id === campaign.id;
    if (!sameOwner && !sameCampaign) throw new ForbiddenException('Map not allowed for this campaign');
    campaign.activeMap = map;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- Active Encounter ---
  async getActiveEncounter(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user', 'activeEncounter'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return { encounterId: (campaign as any).activeEncounter?.id || null };
  }

  async setActiveEncounter(campaignId: string, encounterId: string | null) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'activeEncounter'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (!encounterId) {
      (campaign as any).activeEncounter = null;
      await this.campaignsRepository.save(campaign);
      return { ok: true };
    }
    const encRepo = this.campaignsRepository.manager.getRepository(Encounter);
    const enc = await encRepo.findOne({ where: { id: encounterId }, relations: ['campaign'] });
    if (!enc) throw new NotFoundException('Encounter not found');
    const sameCampaign = enc.campaign?.id === campaign.id;
    if (!sameCampaign) throw new ForbiddenException('Encounter not allowed for this campaign');
    (campaign as any).activeEncounter = enc;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- Time-of-day ---
  async getTimeOfDay(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return { timeOfDay: (campaign.timeOfDay as any) || null };
  }

  async setTimeOfDay(campaignId: string, timeOfDay: 'dawn'|'morning'|'afternoon'|'night') {
    const allowed = ['dawn','morning','afternoon','night'] as const;
    if (!timeOfDay || !allowed.includes(timeOfDay)) {
      throw new BadRequestException('Invalid timeOfDay');
    }
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    (campaign as any).timeOfDay = timeOfDay;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- GRID OVERLAY SETTINGS ---
  async getGridOverlaySettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    const fallback = { enabled: false, type: 'square', cellSize: 40, color: '#FFFFFF', opacity: 0.4, lineWidth: 1 } as const;
    return { settings: campaign.gridOverlaySettings ?? fallback };
  }

  async setGridOverlaySettings(campaignId: string, dto: GridOverlaySettingsDto) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    campaign.gridOverlaySettings = { ...dto } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- SELECTED MANUALS ---
  async getSelectedManuals(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return { manualIds: campaign.selectedManualIds ?? [] };
  }

  async setSelectedManuals(campaignId: string, dto: UpdateCampaignManualsDto) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const ids = (dto.manualIds || []).map((x) => (x || '').trim()).filter(Boolean);
    const registryPath = path.resolve(process.cwd(), 'data', 'manuals', 'registry.json');
    let validIds: string[] = [];
    if (fs.existsSync(registryPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        validIds = (raw?.manuals || []).map((m: any) => String(m.id));
      } catch {
        // ignore parse errors
      }
    }
    const unknown = ids.filter((id) => !validIds.includes(id));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown manual ids: ${unknown.join(', ')}`);
    }
    campaign.selectedManualIds = ids;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }
}
