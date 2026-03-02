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
import { CampaignMonster } from '../monsters/entities/campaign-monster.entity';
import * as fs from 'fs';
import * as path from 'path';
import { BattleStateDto } from './dto/battle-state.dto';
import { FogOfWarSettingsDto } from './dto/fog-of-war-settings.dto';
import { SoundtrackSettingsDto } from './dto/soundtrack-settings.dto';

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
    
    // Validate manual IDs if provided
    let validatedManualIds: string[] | undefined;
    if (createCampaignDto.manualIds && createCampaignDto.manualIds.length > 0) {
      const ids = createCampaignDto.manualIds.map((x) => (x || '').trim()).filter(Boolean);
      const registryPath = path.resolve(process.cwd(), 'data', 'manuals', 'registry.json');
      let validIds: string[] = [];
      try {
        const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        validIds = (raw?.manuals || []).map((m: any) => String(m.id));
      } catch {}
      const unknown = ids.filter((id) => !validIds.includes(id));
      if (unknown.length) {
        throw new BadRequestException(`Unknown manual ids: ${unknown.join(', ')}`);
      }
      validatedManualIds = ids;
    }
    
    const campaign = this.campaignsRepository.create({ 
      ...createCampaignDto, 
      owner,
      selectedManualIds: validatedManualIds || null
    });
    const savedCampaign = await this.campaignsRepository.save(campaign);
    return this.findOne(savedCampaign.id) as Promise<Campaign>;
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto): Promise<Campaign> {
    // Validate manual IDs if provided
    if (updateCampaignDto.selectedManualIds !== undefined) {
      const ids = (updateCampaignDto.selectedManualIds || []).map((x) => (x || '').trim()).filter(Boolean);
      if (ids.length > 0) {
        const registryPath = path.resolve(process.cwd(), 'data', 'manuals', 'registry.json');
        let validIds: string[] = [];
        try {
          const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
          validIds = (raw?.manuals || []).map((m: any) => String(m.id));
        } catch {}
        const unknown = ids.filter((id) => !validIds.includes(id));
        if (unknown.length) {
          throw new BadRequestException(`Unknown manual ids: ${unknown.join(', ')}`);
        }
      }
    }
    
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

  // --- FOG OF WAR SETTINGS ---
  async getFogOfWarSettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    const fallback = { allyClearRadius: 1 } as const;
    const s: any = campaign.fogOfWarSettings ?? fallback;
    const settings = {
      allyClearRadius: typeof s.allyClearRadius === 'number' ? Math.max(0, Math.min(10, Math.floor(s.allyClearRadius))) : 1,
    };
    return { settings };
  }

  async setFogOfWarSettings(campaignId: string, dto: FogOfWarSettingsDto) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    campaign.fogOfWarSettings = { allyClearRadius: Math.max(0, Math.min(10, Math.floor(dto.allyClearRadius))) } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- SOUNDTRACK SETTINGS ---
  async getSoundtrackSettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');

    const fallback = { mode: 'automatic' as const };
    const s: any = campaign.soundtrackSettings ?? fallback;
    const mode = s.mode === 'manual' ? 'manual' : 'automatic';
    return { settings: { mode } };
  }

  async setSoundtrackSettings(campaignId: string, dto: SoundtrackSettingsDto) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const mode = dto?.mode === 'manual' ? 'manual' : 'automatic';
    campaign.soundtrackSettings = { mode } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- SKYLINE OVERLAY SETTINGS ---
  async getSkylineOverlaySettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    const fallback = { showSongTitle: false, showInitiativeStrip: false } as const;
    const s = campaign.skylineOverlaySettings ?? (fallback as any);
    // Ensure both keys exist
    const settings = { showSongTitle: !!s.showSongTitle, showInitiativeStrip: !!s.showInitiativeStrip };
    return { settings };
  }

  /**
   * Public read-only skyline overlay settings for projection clients.
   * Does not enforce membership; returns safe defaults.
   */
  async getSkylineOverlaySettingsPublic(campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    const fallback = { showSongTitle: false, showInitiativeStrip: false } as const;
    const s: any = (campaign && campaign.skylineOverlaySettings) ?? fallback;
    return {
      showSongTitle: !!s.showSongTitle,
      showInitiativeStrip: !!s.showInitiativeStrip,
    };
  }

  async setSkylineOverlaySettings(campaignId: string, dto: { showSongTitle?: boolean; showInitiativeStrip?: boolean }) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const prev = (campaign.skylineOverlaySettings || { showSongTitle: false, showInitiativeStrip: false }) as any;
    campaign.skylineOverlaySettings = { ...prev, ...dto } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- BATTLE STATE ---
  async getBattleState(requestingUserId: number, campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['owner', 'players', 'players.user', 'activeEncounter'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some(p => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    const fallback = { started: false, encounterId: campaign.activeEncounter?.id || null, round: 1, turnIndex: 0, currentTurnId: null, items: [] } as const;
    const s = campaign.battleState ?? (fallback as any);
    const state = { started: !!s.started, encounterId: s.encounterId ?? (campaign.activeEncounter?.id || null), round: typeof s.round === 'number' ? s.round : 1, turnIndex: typeof s.turnIndex === 'number' ? s.turnIndex : 0, currentTurnId: typeof s.currentTurnId === 'string' || s.currentTurnId === null ? (s.currentTurnId ?? null) : null, items: Array.isArray(s.items) ? s.items : [] };
    return { state };
  }

  /**
   * Public read-only battle state for projection clients.
   * No membership check; exposes minimal non-sensitive data.
   */
  async getBattleStatePublic(campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    const fallback = { started: false, encounterId: campaign?.activeEncounter?.id || null, round: 1, turnIndex: 0, currentTurnId: null, items: [] } as const;
    const s: any = (campaign && campaign.battleState) ?? fallback;
    return {
      started: !!s.started,
      encounterId: s.encounterId ?? (campaign?.activeEncounter?.id || null),
      round: typeof s.round === 'number' ? s.round : 1,
      turnIndex: typeof s.turnIndex === 'number' ? s.turnIndex : 0,
      currentTurnId: typeof s.currentTurnId === 'string' || s.currentTurnId === null ? (s.currentTurnId ?? null) : null,
      items: Array.isArray(s.items) ? s.items : [],
    };
  }

  /**
   * Public read-only mapping of encounter participant IDs to their bestiary
   * monster `monsterCampaignId`. The projection window uses this to match
   * tokens (keyed by participant ID) to the monster images it already has.
   *
   * @returns Record where key = participantId, value = monsterCampaignId.
   */
  async getParticipantMonsterMappingPublic(
    campaignId: string,
  ): Promise<Record<string, string>> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['activeEncounter'],
    });
    if (!campaign?.activeEncounter?.participants?.length) return {};

    const result: Record<string, string> = {};
    for (const p of campaign.activeEncounter.participants) {
      if (p.monsterCampaignId) {
        result[p.id] = p.monsterCampaignId;
      }
    }
    return result;
  }

  async setBattleState(campaignId: string, dto: BattleStateDto) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, relations: ['activeEncounter'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const prev = (campaign.battleState || { started: false, encounterId: campaign.activeEncounter?.id || null, round: 1, turnIndex: 0, currentTurnId: null, items: [] }) as any;
    // Shallow merge with validation defaults
    const next = {
      started: typeof dto.started === 'boolean' ? dto.started : prev.started,
      encounterId: dto.encounterId !== undefined ? dto.encounterId : (prev.encounterId ?? (campaign.activeEncounter?.id || null)),
      round: typeof dto.round === 'number' && dto.round > 0 ? dto.round : prev.round,
      turnIndex: typeof dto.turnIndex === 'number' && dto.turnIndex >= 0 ? dto.turnIndex : prev.turnIndex,
      currentTurnId: dto.currentTurnId !== undefined ? dto.currentTurnId : (prev.currentTurnId ?? null),
      items: Array.isArray((dto as any).items) ? (dto as any).items : (Array.isArray(prev.items) ? prev.items : []),
    } as any;
    campaign.battleState = next;
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

  // --- Skyline Item Overlays ---
  
  /**
   * Get all skyline item overlays for a campaign.
   * Only owner can view (players don't control skyline).
   */
  async getSkylineItems(campaignId: string, requestingUserId: number) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Allow any member of the campaign to read skyline items (owner or active player).
    // Items are already publicly visible in the projection window.
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = campaign.players?.some(
      (p: any) => p?.user?.id === requestingUserId && p?.status === 'active',
    );
    if (!isOwner && !isPlayer) {
      throw new ForbiddenException('Only campaign members can read skyline items');
    }

    const SkylineItemOverlay = this.campaignsRepository.manager.getRepository('SkylineItemOverlay');
    const items = await SkylineItemOverlay.find({
      where: { campaignId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
    return items;
  }

  /**
   * Add a new skyline item overlay.
   * Only owner can add.
   * Removes all existing items before adding the new one (only one item at a time).
   */
  async addSkylineItem(campaignId: string, requestingUserId: number, dto: { cellId: string; label?: string; order?: number }) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== requestingUserId) {
      throw new ForbiddenException('Only campaign owner can add skyline items');
    }

    const SkylineItemOverlay = this.campaignsRepository.manager.getRepository('SkylineItemOverlay');
    
    // Remove all existing items for this campaign (only one item at a time)
    await SkylineItemOverlay.delete({ campaignId });
    
    const item = SkylineItemOverlay.create({
      campaignId,
      cellId: dto.cellId,
      label: dto.label || null,
      order: dto.order ?? 0,
    });
    await SkylineItemOverlay.save(item);
    return item;
  }

  /**
   * Remove a skyline item overlay.
   * Only owner can remove.
   */
  async removeSkylineItem(itemId: string, requestingUserId: number) {
    const SkylineItemOverlay = this.campaignsRepository.manager.getRepository('SkylineItemOverlay');
    const item = await SkylineItemOverlay.findOne({
      where: { id: itemId },
      relations: ['campaign', 'campaign.owner'],
    });
    if (!item) throw new NotFoundException('Skyline item not found');
    
    const campaign = item.campaign as any;
    if (campaign?.owner?.id !== requestingUserId) {
      throw new ForbiddenException('Only campaign owner can remove skyline items');
    }

    await SkylineItemOverlay.remove(item);
    return { ok: true };
  }

  /**
   * Remove all skyline items for a campaign.
   * Only owner can clear.
   */
  async clearSkylineItems(campaignId: string, requestingUserId: number) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== requestingUserId) {
      throw new ForbiddenException('Only campaign owner can clear skyline items');
    }

    const SkylineItemOverlay = this.campaignsRepository.manager.getRepository('SkylineItemOverlay');
    await SkylineItemOverlay.delete({ campaignId });
    return { ok: true };
  }
}
