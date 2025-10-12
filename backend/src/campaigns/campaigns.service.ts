import { User } from '../users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InvitePlayerDto } from './dto/invite-player.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';
import { UsersService } from '../users/users.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { MapEntity } from '../maps/entities/map.entity';
import { GridOverlaySettingsDto } from './dto/grid-overlay-settings.dto';
import { UpdateCampaignManualsDto } from './dto/update-campaign-manuals.dto';
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

  // --- Eliminar jugador de campaña (solo owner) ---
  async removePlayer(campaignId: string, playerId: string) {
    // La propiedad ya fue verificada por CampaignOwnerGuard.
    // Aún necesitamos la campaña para la lógica interna.
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

    // Lógica de negocio: El owner no puede eliminarse a sí mismo por esta vía.
    if (campaignPlayer.user.id === campaign.owner.id)
      throw new ForbiddenException('Owner cannot remove themselves');

    await this.campaignPlayersRepository.delete(playerId);
    return { message: 'Player removed' };
  }

  async findAllForUser(userId: number): Promise<Campaign[]> {
    const asOwner = await this.campaignsRepository.find({
      where: { owner: { id: userId } },
      relations: ['players', 'players.user', 'owner'],
    });
    const asPlayer = await this.campaignPlayersRepository.find({
      where: { user: { id: userId } },
      relations: ['campaign', 'campaign.owner', 'campaign.players', 'campaign.players.user'],
    });
    const playerCampaigns = asPlayer.map((cp) => cp.campaign);
    const all = [...asOwner, ...playerCampaigns];
    const unique = all.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    return unique;
  }

  async findOne(id: string): Promise<Campaign | undefined> {
    return this.campaignsRepository.findOne({
      where: { id },
      relations: ['players', 'players.user', 'owner'],
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
    // La propiedad ya fue verificada por CampaignOwnerGuard.
    await this.campaignsRepository.update(id, updateCampaignDto);
    return this.findOne(id) as Promise<Campaign>;
  }

  async remove(id: string): Promise<void> {
    // La propiedad ya fue verificada por CampaignOwnerGuard.
    await this.campaignsRepository.delete(id);
  }

  // --- INVITATION LOGIC ---

  async invitePlayer(campaignId: string, dto: InvitePlayerDto) {
    // La propiedad ya fue verificada por CampaignOwnerGuard.
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

  // --- Active Map ---
  /**
   * Get active map for a campaign. Owner or players can read.
   */
  async getActiveMap(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user', 'activeMap'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return { mapId: campaign.activeMap?.id || null };
  }

  /**
   * Set active map for a campaign (owner only via guard). If mapId is null, clears the active map.
   */
  async setActiveMap(campaignId: string, mapId: string | null) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'activeMap'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (!mapId) {
      campaign.activeMap = null;
      await this.campaignsRepository.save(campaign);
      return { ok: true };
    }
    // Validate the map exists and belongs to the same owner or is linked to this campaign
    const mapRepo = this.campaignsRepository.manager.getRepository(MapEntity);
    const map = await mapRepo.findOne({ where: { id: mapId }, relations: ['owner', 'campaign'] });
    if (!map) throw new NotFoundException('Map not found');
    // Restrict: the map must either belong to the campaign (campaign.id) or be owned by the same owner as the campaign
    const sameOwner = map.owner?.id === campaign.owner?.id;
    const sameCampaign = map.campaign?.id === campaign.id;
    if (!sameOwner && !sameCampaign) throw new ForbiddenException('Map not allowed for this campaign');
    campaign.activeMap = map;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- Time-of-day ---
  /**
   * Get time-of-day for a campaign. Owner or players can read.
   */
  async getTimeOfDay(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return { timeOfDay: (campaign.timeOfDay as any) || null };
  }

  /**
   * Set time-of-day for a campaign (owner only via guard).
   */
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
  /**
   * Get grid overlay settings for a campaign. Owner or players can read.
   * @param requestingUserId - ID of the user requesting the settings (to validate membership)
   * @param campaignId - Campaign ID
   * @returns The settings object, or a default with enabled=false when not set
   */
  async getGridOverlaySettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    const fallback = { enabled: false, type: 'square', cellSize: 40, color: '#FFFFFF', opacity: 0.4, lineWidth: 1 } as const;
    return { settings: campaign.gridOverlaySettings ?? fallback };
  }

  /**
   * Set grid overlay settings for a campaign. Only owner via guard.
   * @param campaignId - Campaign ID
   * @param dto - Validated settings
   */
  async setGridOverlaySettings(campaignId: string, dto: GridOverlaySettingsDto) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    campaign.gridOverlaySettings = { ...dto } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- SELECTED MANUALS ---
  /**
   * Read selected manual IDs for a campaign. Owner or players can read.
   */
  async getSelectedManuals(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return { manualIds: campaign.selectedManualIds ?? [] };
  }

  /**
   * Update selected manuals for a campaign. Owner only via guard.
   * Validates against backend manuals registry.
   */
  async setSelectedManuals(campaignId: string, dto: UpdateCampaignManualsDto) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const ids = (dto.manualIds || []).map((x) => (x || '').trim()).filter(Boolean);
    // Validate IDs against manuals registry
    const registryPath = path.resolve(process.cwd(), 'data', 'manuals', 'registry.json');
    let validIds: string[] = [];
    if (fs.existsSync(registryPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        validIds = (raw?.manuals || []).map((m: any) => String(m.id));
      } catch {
        // ignore parse errors; will treat as empty registry
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
