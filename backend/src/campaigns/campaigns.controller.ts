import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InvitePlayerDto } from './dto/invite-player.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req) {
    // Solo campañas donde el usuario es owner o player
    return this.campaignsService.findAllForUser(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(Number(id));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() createCampaignDto: CreateCampaignDto) {
    // req.user.userId viene del JWT
    return this.campaignsService.createWithOwner(createCampaignDto, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCampaignDto: UpdateCampaignDto) {
    return this.campaignsService.update(Number(id), updateCampaignDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(Number(id));
  }

  // --- INVITATION ENDPOINTS ---

  @Post('invite')
  @UseGuards(JwtAuthGuard)
  invitePlayer(@Request() req, @Body() invitePlayerDto: InvitePlayerDto) {
    // Only campaign owner can invite
    return this.campaignsService.invitePlayer(req.user.userId, invitePlayerDto);
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
  @UseGuards(JwtAuthGuard)
  async removePlayer(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('playerId') playerId: string
	) {
	  // Solo el owner puede eliminar
	  return this.campaignsService.removePlayer(req.user.userId, campaignId, playerId);
  }
}
