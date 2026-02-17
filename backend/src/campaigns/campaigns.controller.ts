import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InvitePlayerDto } from './dto/invite-player.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';
import { CampaignOwnerGuard } from './guards/campaign-owner.guard';
import { MapEntity } from '../maps/entities/map.entity';
import { GridOverlaySettingsDto } from './dto/grid-overlay-settings.dto';
import { SkylineOverlaySettingsDto } from './dto/skyline-overlay-settings.dto';
import { FogOfWarSettingsDto } from './dto/fog-of-war-settings.dto';
import { SoundtrackSettingsDto } from './dto/soundtrack-settings.dto';
import { UpdateCampaignManualsDto } from './dto/update-campaign-manuals.dto';
import { BattleStateDto } from './dto/battle-state.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // --- Active Skyline Character endpoints ---
  @Get(':id/active-skyline-character')
  @UseGuards(JwtAuthGuard)
  async getActiveSkylineCharacter(@Request() req, @Param('id') id: string) {
    // Allow owner or players to read; service will validate membership
    return this.campaignsService.getActiveSkylineCharacter(req.user.userId, id);
  }

  @Patch(':id/active-skyline-character')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setActiveSkylineCharacter(@Param('id') id: string, @Body() body: { characterId: string | null }) {
    return this.campaignsService.setActiveSkylineCharacter(id, body?.characterId ?? null);
  }

  // --- Skyline Item Overlays endpoints ---
  @Get(':id/skyline-items')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async getSkylineItems(@Request() req, @Param('id') campaignId: string) {
    return this.campaignsService.getSkylineItems(campaignId, req.user.userId);
  }

  @Post(':id/skyline-items')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async addSkylineItem(@Request() req, @Param('id') campaignId: string, @Body() body: { cellId: string; label?: string; order?: number }) {
    return this.campaignsService.addSkylineItem(campaignId, req.user.userId, body);
  }

  @Delete('skyline-items/:itemId')
  @UseGuards(JwtAuthGuard)
  async removeSkylineItem(@Request() req, @Param('itemId') itemId: string) {
    return this.campaignsService.removeSkylineItem(itemId, req.user.userId);
  }

  @Delete(':id/skyline-items')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async clearSkylineItems(@Request() req, @Param('id') campaignId: string) {
    return this.campaignsService.clearSkylineItems(campaignId, req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req) {
    // Solo campañas donde el usuario es owner o player
    return this.campaignsService.findAllForUser(req.user.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() createCampaignDto: CreateCampaignDto) {
    // req.user.userId viene del JWT
    return this.campaignsService.createWithOwner(createCampaignDto, req.user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  update(@Param('id') id: string, @Body() updateCampaignDto: UpdateCampaignDto) {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  // --- Active Map endpoints ---
  @Get(':id/active-map')
  @UseGuards(JwtAuthGuard)
  async getActiveMap(@Request() req, @Param('id') id: string) {
    // Allow owner or players to read; service will validate membership
    return this.campaignsService.getActiveMap(req.user.userId, id);
  }

  @Patch(':id/active-map')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setActiveMap(@Param('id') id: string, @Body() body: { mapId: string | null }) {
    return this.campaignsService.setActiveMap(id, body?.mapId ?? null);
  }

  // --- Active Encounter endpoints ---
  @Get(':id/active-encounter')
  @UseGuards(JwtAuthGuard)
  async getActiveEncounter(@Request() req, @Param('id') id: string) {
    return this.campaignsService.getActiveEncounter(req.user.userId, id);
  }

  @Patch(':id/active-encounter')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setActiveEncounter(@Param('id') id: string, @Body() body: { encounterId: string | null }) {
    return this.campaignsService.setActiveEncounter(id, body?.encounterId ?? null);
  }

  // --- Campaign time-of-day endpoints ---
  @Get(':id/time-of-day')
  @UseGuards(JwtAuthGuard)
  async getTimeOfDay(@Request() req, @Param('id') id: string) {
    return this.campaignsService.getTimeOfDay(req.user.userId, id);
  }

  @Patch(':id/time-of-day')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setTimeOfDay(@Param('id') id: string, @Body() body: { timeOfDay: 'dawn'|'morning'|'afternoon'|'night' }) {
    return this.campaignsService.setTimeOfDay(id, body?.timeOfDay as any);
  }

  // --- GRID OVERLAY SETTINGS ---
  /**
   * Read grid overlay settings for a campaign. Owner or players can read.
   */
  @Get(':id/grid-overlay')
  @UseGuards(JwtAuthGuard)
  async getGridOverlay(@Request() req, @Param('id') id: string) {
    return this.campaignsService.getGridOverlaySettings(req.user.userId, id);
  }

  /**
   * Update grid overlay settings for a campaign. Only owner can update.
   */
  @Patch(':id/grid-overlay')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setGridOverlay(@Param('id') id: string, @Body() body: GridOverlaySettingsDto) {
    return this.campaignsService.setGridOverlaySettings(id, body);
  }

  // --- FOG OF WAR SETTINGS ---
  /**
   * Read Fog of War settings for a campaign. Owner or players can read.
   */
  @Get(':id/fog-of-war')
  @UseGuards(JwtAuthGuard)
  async getFogOfWar(@Request() req, @Param('id') id: string) {
    return this.campaignsService.getFogOfWarSettings(req.user.userId, id);
  }

  /**
   * Update Fog of War settings for a campaign. Only owner can update.
   */
  @Patch(':id/fog-of-war')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setFogOfWar(@Param('id') id: string, @Body() body: FogOfWarSettingsDto) {
    return this.campaignsService.setFogOfWarSettings(id, body);
  }

  // --- SOUNDTRACK SETTINGS ---
  /**
   * Read soundtrack settings for a campaign. Owner or players can read.
   */
  @Get(':id/soundtrack-settings')
  @UseGuards(JwtAuthGuard)
  async getSoundtrackSettings(@Request() req, @Param('id') id: string) {
    return this.campaignsService.getSoundtrackSettings(req.user.userId, id);
  }

  /**
   * Update soundtrack settings for a campaign. Only owner can update.
   */
  @Patch(':id/soundtrack-settings')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setSoundtrackSettings(@Param('id') id: string, @Body() body: SoundtrackSettingsDto) {
    return this.campaignsService.setSoundtrackSettings(id, body);
  }

  // --- SKYLINE OVERLAY SETTINGS ---
  /**
   * Read skyline overlay settings for a campaign. Owner or players can read.
   */
  @Get(':id/skyline-overlay')
  @UseGuards(JwtAuthGuard)
  async getSkylineOverlay(@Request() req, @Param('id') id: string) {
    return this.campaignsService.getSkylineOverlaySettings(req.user.userId, id);
  }

  /**
   * Update skyline overlay settings for a campaign. Only owner can update.
   */
  @Patch(':id/skyline-overlay')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setSkylineOverlay(@Param('id') id: string, @Body() body: SkylineOverlaySettingsDto) {
    return this.campaignsService.setSkylineOverlaySettings(id, body);
  }

  // --- BATTLE STATE ---
  /**
   * Read persisted battle state for a campaign. Owner or players can read.
   */
  @Get(':id/battle-state')
  @UseGuards(JwtAuthGuard)
  async getBattleState(@Request() req, @Param('id') id: string) {
    return this.campaignsService.getBattleState(req.user.userId, id);
  }
  // --- PUBLIC PROJECTION READS (no auth, read-only) ---
  @Get('projection/:id/skyline-overlay')
  async getSkylineOverlayPublic(@Param('id') id: string) {
    return this.campaignsService.getSkylineOverlaySettingsPublic(id);
  }

  @Get('projection/:id/battle-state')
  async getBattleStatePublic(@Param('id') id: string) {
    return this.campaignsService.getBattleStatePublic(id);
  }

  /**
   * Public mapping of encounter participant IDs to their bestiary monster IDs.
   * Used by the projection window to resolve token images without authentication.
   *
   * @returns Record&lt;participantId, monsterCampaignId&gt;
   */
  @Get('projection/:id/participant-monster-map')
  async getParticipantMonsterMapPublic(@Param('id') id: string) {
    return this.campaignsService.getParticipantMonsterMappingPublic(id);
  }

  /**
   * Update battle state for a campaign. Only owner can update.
   */
  @Patch(':id/battle-state')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setBattleState(@Param('id') id: string, @Body() body: BattleStateDto) {
    return this.campaignsService.setBattleState(id, body);
  }

  // --- SELECTED MANUALS ---
  /**
   * Read selected manual IDs for this campaign. Owner or players can read.
   */
  @Get(':id/manuals')
  @UseGuards(JwtAuthGuard)
  async getSelectedManuals(@Request() req, @Param('id') id: string) {
    return this.campaignsService.getSelectedManuals(req.user.userId, id);
  }

  /**
   * Update selected manual IDs for this campaign. Only owner can update.
   */
  @Patch(':id/manuals')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async setSelectedManuals(@Param('id') id: string, @Body() body: UpdateCampaignManualsDto) {
    return this.campaignsService.setSelectedManuals(id, body);
  }

  // --- INVITATION ENDPOINTS ---

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  invitePlayer(@Param('id') campaignId: string, @Body() invitePlayerDto: InvitePlayerDto) {
    return this.campaignsService.invitePlayer(campaignId, invitePlayerDto);
  }

  @Post('invitation/respond')
  @UseGuards(JwtAuthGuard)
  respondInvitation(@Request() req, @Body() respondInvitationDto: RespondInvitationDto) {
    // Only invited user can accept/decline
    return this.campaignsService.respondInvitation(req.user.userId, respondInvitationDto);
  }

  @Get('invitations/pending')
  @UseGuards(JwtAuthGuard)
  getPendingInvitations(@Request() req) {
    return this.campaignsService.getPendingInvitations(req.user.userId);
  }

  // Eliminar jugador de campaña (solo owner)
  @Delete(':campaignId/player/:playerId')
  @UseGuards(JwtAuthGuard, CampaignOwnerGuard)
  async removePlayer(@Param('campaignId') campaignId: string, @Param('playerId') playerId: string) {
    return this.campaignsService.removePlayer(campaignId, playerId);
  }
}
