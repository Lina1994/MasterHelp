import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { FeatsService } from './feats.service';
import { CampaignFeatsService } from './campaign-feats.service';
import { ListCampaignFeatsDto } from './dto/list-campaign-feats.dto';
import { CreateCampaignFeatDto } from './dto/create-campaign-feat.dto';
import { UpdateCampaignFeatDto } from './dto/update-campaign-feat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class FeatsController {
  constructor(
    private readonly featsService: FeatsService,
    private readonly campaignFeatsService: CampaignFeatsService,
  ) {}

  // --- Read-only manual endpoints ---

  @Get('manuals/:manualId/feats')
  listForManual(@Param('manualId') manualId: string, @Query('lang') lang?: 'en' | 'es') {
    return this.featsService.list(lang || 'en', manualId);
  }

  @Get('manuals/:manualId/feats/:id')
  getForManual(
    @Param('manualId') manualId: string,
    @Param('id') id: string,
    @Query('lang') lang?: 'en' | 'es',
  ) {
    return this.featsService.getById(lang || 'en', id, manualId);
  }

  // --- Campaign feats (CRUD with permissions) ---

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/feats')
  async listCampaignFeats(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Query() query: ListCampaignFeatsDto,
  ) {
    const lang = query.lang || 'en';
    return this.campaignFeatsService.list(campaignId, req.user.userId, query, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/feats/:featId')
  async getCampaignFeat(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('featId') featId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignFeatsService.get(campaignId, featId, req.user.userId, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/feats')
  async createCampaignFeat(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignFeatDto,
  ) {
    return this.campaignFeatsService.create(campaignId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('campaigns/:campaignId/feats/:featId')
  async updateCampaignFeat(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('featId') featId: string,
    @Body() dto: UpdateCampaignFeatDto,
  ) {
    return this.campaignFeatsService.update(campaignId, featId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('campaigns/:campaignId/feats/:featId')
  async deleteCampaignFeat(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('featId') featId: string,
  ) {
    await this.campaignFeatsService.delete(campaignId, featId, req.user.userId);
    return { message: 'Feat deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/feats/copy/:manualId/:featId')
  async copyFeatFromManual(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('manualId') manualId: string,
    @Param('featId') featId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignFeatsService.copyFromManual(campaignId, manualId, featId, req.user.userId, lang);
  }
}
