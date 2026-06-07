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
import { CustomManualsService } from '../manuals/custom-manuals.service';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(CampaignPlayer)
    private campaignPlayersRepository: Repository<CampaignPlayer>,
    private readonly usersService: UsersService,
    private readonly customManualsService: CustomManualsService,
  ) {}

  /** Normalizes manual id arrays by trimming and removing empty values. */
  private normalizeManualIds(ids?: string[] | null): string[] {
    return (ids || []).map((x) => (x || '').trim()).filter(Boolean);
  }

  /**
   * Validates manual ids against file registry and custom manuals DB.
   * Preserves current create/update behavior: if registry cannot be loaded,
   * validation is skipped.
   */
  private async validateManualIdsForCreateOrUpdate(ids: string[]): Promise<void> {
    const registryPath = path.resolve(process.cwd(), 'data', 'manuals', 'registry.json');
    let registryLoaded = false;
    let validIds: string[] = [];
    try {
      const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      validIds = (raw?.manuals || []).map((m: any) => String(m.id));
      registryLoaded = true;
    } catch (e) {
      console.warn('[CampaignsService] Could not read manuals registry, skipping manual ID validation:', e?.message);
    }
    if (!registryLoaded) return;

    const unknown: string[] = [];
    for (const id of ids) {
      if (validIds.includes(id)) continue;
      const existsInDb = await this.customManualsService.exists(id);
      if (!existsInDb) unknown.push(id);
    }
    if (unknown.length) {
      throw new BadRequestException(`Unknown manual ids: ${unknown.join(', ')}`);
    }
  }

  /**
   * Loads campaign with requested relations and asserts the requester is owner or player.
   */
  private async getCampaignForMember(
    campaignId: string,
    requestingUserId: number,
    extraRelations: string[] = [],
  ): Promise<Campaign> {
    const relations = ['owner', 'players', 'players.user', ...extraRelations];
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === requestingUserId;
    const isPlayer = (campaign.players || []).some((p) => p.user?.id === requestingUserId);
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a member of this campaign');
    return campaign;
  }

  /** Loads a campaign by id and throws NotFoundException when missing. */
  private async getCampaignByIdOrThrow(
    campaignId: string,
    relations: string[] = [],
  ): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

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
    if (createCampaignDto.selectedManualIds && createCampaignDto.selectedManualIds.length > 0) {
      const ids = this.normalizeManualIds(createCampaignDto.selectedManualIds);
      await this.validateManualIdsForCreateOrUpdate(ids);
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
      const ids = this.normalizeManualIds(updateCampaignDto.selectedManualIds || []);
      if (ids.length > 0) {
        await this.validateManualIdsForCreateOrUpdate(ids);
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
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId, [
      'activeSkylineCharacter',
    ]);
    return {
      characterId: campaign.activeSkylineCharacter?.id ?? null,
      activeSkylineImageUrl: campaign.activeSkylineImageUrl ?? null,
    };
  }

  async setActiveSkylineCharacter(campaignId: string, characterId: string | null, activeSkylineImageUrl: string | null = null) {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'activeSkylineCharacter'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (!characterId) {
      campaign.activeSkylineCharacter = null;
      campaign.activeSkylineImageUrl = null;
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
    campaign.activeSkylineImageUrl = activeSkylineImageUrl;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- Active Map ---
  async getActiveMap(requestingUserId: number, campaignId: string) {
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId, ['activeMap']);
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
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId, ['activeEncounter']);
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
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId);
    return { timeOfDay: (campaign.timeOfDay as any) || null };
  }

  async setTimeOfDay(campaignId: string, timeOfDay: 'dawn'|'morning'|'afternoon'|'night') {
    const allowed = ['dawn','morning','afternoon','night'] as const;
    if (!timeOfDay || !allowed.includes(timeOfDay)) {
      throw new BadRequestException('Invalid timeOfDay');
    }
    const campaign = await this.getCampaignByIdOrThrow(campaignId);
    (campaign as any).timeOfDay = timeOfDay;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- GRID OVERLAY SETTINGS ---
  async getGridOverlaySettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId);
    const fallback = { enabled: false, type: 'square', cellSize: 40, color: '#FFFFFF', opacity: 0.4, lineWidth: 1 } as const;
    return { settings: campaign.gridOverlaySettings ?? fallback };
  }

  async setGridOverlaySettings(campaignId: string, dto: GridOverlaySettingsDto) {
    const campaign = await this.getCampaignByIdOrThrow(campaignId);
    campaign.gridOverlaySettings = { ...dto } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- FOG OF WAR SETTINGS ---
  async getFogOfWarSettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId);
    const fallback = { allyClearRadius: 1, fogMode: 'grid' as const };
    const s: any = campaign.fogOfWarSettings ?? fallback;
    const settings = {
      allyClearRadius: typeof s.allyClearRadius === 'number' ? Math.max(0, Math.min(10, Math.floor(s.allyClearRadius))) : 1,
      fogMode: s.fogMode === 'organic' ? 'organic' as const : 'grid' as const,
    };
    return { settings };
  }

  async setFogOfWarSettings(campaignId: string, dto: FogOfWarSettingsDto) {
    const campaign = await this.getCampaignByIdOrThrow(campaignId);
    const fogMode = dto.fogMode === 'organic' ? 'organic' : 'grid';
    campaign.fogOfWarSettings = {
      allyClearRadius: Math.max(0, Math.min(10, Math.floor(dto.allyClearRadius))),
      fogMode,
    } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- SOUNDTRACK SETTINGS ---
  async getSoundtrackSettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId);

    const fallback = { mode: 'automatic' as const };
    const s: any = campaign.soundtrackSettings ?? fallback;
    const mode = s.mode === 'manual' ? 'manual' : 'automatic';
    return { settings: { mode } };
  }

  async setSoundtrackSettings(campaignId: string, dto: SoundtrackSettingsDto) {
    const campaign = await this.getCampaignByIdOrThrow(campaignId);
    const mode = dto?.mode === 'manual' ? 'manual' : 'automatic';
    campaign.soundtrackSettings = { mode } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- SKYLINE OVERLAY SETTINGS ---
  async getSkylineOverlaySettings(requestingUserId: number, campaignId: string) {
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId);
    const fallback = { showSongTitle: false, showInitiativeStrip: false, showQr: false, qrUrl: '' } as const;
    const s = campaign.skylineOverlaySettings ?? (fallback as any);
    // Ensure all expected keys exist
    const settings = {
      showSongTitle: !!s.showSongTitle,
      showInitiativeStrip: !!s.showInitiativeStrip,
      showQr: !!s.showQr,
      qrUrl: typeof s.qrUrl === 'string' ? s.qrUrl : '',
    };
    return { settings };
  }

  /**
   * Public read-only skyline overlay settings for projection clients.
   * Does not enforce membership; returns safe defaults.
   */
  async getSkylineOverlaySettingsPublic(campaignId: string) {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId } });
    const fallback = { showSongTitle: false, showInitiativeStrip: false, showQr: false, qrUrl: '' } as const;
    const s: any = (campaign && campaign.skylineOverlaySettings) ?? fallback;
    return {
      showSongTitle: !!s.showSongTitle,
      showInitiativeStrip: !!s.showInitiativeStrip,
      showQr: !!s.showQr,
      qrUrl: typeof s.qrUrl === 'string' ? s.qrUrl : '',
    };
  }

  async setSkylineOverlaySettings(campaignId: string, dto: { showSongTitle?: boolean; showInitiativeStrip?: boolean; showQr?: boolean; qrUrl?: string }) {
    const campaign = await this.getCampaignByIdOrThrow(campaignId);
    const prev = (campaign.skylineOverlaySettings || { showSongTitle: false, showInitiativeStrip: false }) as any;
    campaign.skylineOverlaySettings = { ...prev, ...dto } as any;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- BATTLE STATE ---
  async getBattleState(requestingUserId: number, campaignId: string) {
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId, ['activeEncounter']);
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
    const campaign = await this.getCampaignByIdOrThrow(campaignId, ['activeEncounter']);
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
    const campaign = await this.getCampaignForMember(campaignId, requestingUserId);
    return { manualIds: campaign.selectedManualIds ?? [] };
  }

  async setSelectedManuals(campaignId: string, dto: UpdateCampaignManualsDto) {
    const campaign = await this.getCampaignByIdOrThrow(campaignId);
    const ids = (dto.manualIds || []).map((x) => (x || '').trim()).filter(Boolean);

    // Validate file-based manual IDs from registry.json
    const registryPath = path.resolve(process.cwd(), 'data', 'manuals', 'registry.json');
    let fileManualIds: string[] = [];
    if (fs.existsSync(registryPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        fileManualIds = (raw?.manuals || []).map((m: any) => String(m.id));
      } catch {
        // ignore parse errors
      }
    }

    // Validate: each id must be a known file manual OR exist as a DB manual
    const unknown: string[] = [];
    for (const id of ids) {
      if (fileManualIds.includes(id)) continue;
      const existsInDb = await this.customManualsService.exists(id);
      if (!existsInDb) unknown.push(id);
    }
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown manual ids: ${unknown.join(', ')}`);
    }
    campaign.selectedManualIds = ids;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  // --- DEFAULT SKYLINE IMAGE ---

  /**
   * Upload (or replace) the default/fallback skyline image for a campaign.
   * @param campaignId Campaign UUID.
   * @param file Uploaded file buffer + metadata.
   */
  async uploadDefaultSkyline(campaignId: string, file: { buffer: Buffer; mimetype: string }) {
    const campaign = await this.getCampaignByIdOrThrow(campaignId);
    campaign.defaultSkylineMimeType = file.mimetype;
    (campaign as any).defaultSkylineData = file.buffer;
    await this.campaignsRepository.save(campaign);
    return { ok: true };
  }

  /**
   * Retrieve the default skyline image data for a campaign.
   * We need addSelect because the blob column has `select: false`.
   * @returns `{ buffer, mimeType }` or throws NotFoundException.
   */
  async getDefaultSkyline(campaignId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const campaign = await this.campaignsRepository
      .createQueryBuilder('c')
      .addSelect('c.defaultSkylineData')
      .where('c.id = :id', { id: campaignId })
      .getOne();
    if (!campaign || !campaign.defaultSkylineData || !campaign.defaultSkylineMimeType) {
      throw new NotFoundException('No default skyline image');
    }
    return { buffer: campaign.defaultSkylineData, mimeType: campaign.defaultSkylineMimeType };
  }

  /**
   * Check whether a default skyline image exists for a campaign.
   * @returns `{ exists: boolean }`
   */
  async hasDefaultSkyline(campaignId: string): Promise<{ exists: boolean }> {
    const campaign = await this.campaignsRepository.findOne({ where: { id: campaignId }, select: ['id', 'defaultSkylineMimeType'] });
    return { exists: !!campaign?.defaultSkylineMimeType };
  }

  /**
   * Delete the default skyline image for a campaign.
   */
  async deleteDefaultSkyline(campaignId: string) {
    const campaign = await this.getCampaignByIdOrThrow(campaignId);
    campaign.defaultSkylineMimeType = null;
    (campaign as any).defaultSkylineData = null;
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
