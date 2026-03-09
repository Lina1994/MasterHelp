import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BackgroundsService } from './backgrounds.service';
import { CampaignBackgroundsService } from './campaign-backgrounds.service';
import { CreateCampaignBackgroundDto } from './dto/create-campaign-background.dto';
import { UpdateCampaignBackgroundDto } from './dto/update-campaign-background.dto';
import { ListCampaignBackgroundsDto } from './dto/list-campaign-backgrounds.dto';

@Controller()
export class BackgroundsController {
  constructor(
    private readonly backgrounds: BackgroundsService,
    private readonly campaignBackgroundsService: CampaignBackgroundsService,
  ) {}

  // --- Manual (read-only) ---

  /**
   * Manual-aware endpoints for backgrounds
   * GET /manuals/:manualId/backgrounds?lang=
   * @param manualId Manual identifier (e.g., 'dnd5e-2014')
   * @param lang Locale code ('en' | 'es')
   */
  @Get('manuals/:manualId/backgrounds')
  listForManual(@Param('manualId') manualId: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.backgrounds.list(l, manualId);
  }

  /**
   * GET /manuals/:manualId/backgrounds/:id?lang=
   * Returns a single background by id.
   * @param manualId Manual identifier
   * @param id Background id
   * @param lang Locale code ('en' | 'es')
   */
  @Get('manuals/:manualId/backgrounds/:id')
  getForManual(
    @Param('manualId') manualId: string,
    @Param('id') id: string,
    @Query('lang') lang?: 'en' | 'es',
  ) {
    const l = lang || 'en';
    return this.backgrounds.getById(l, id, manualId);
  }

  // --- Campaign CRUD ---

  @UseGuards(AuthGuard('jwt'))
  @Get('campaigns/:campaignId/backgrounds')
  listCampaignBackgrounds(
    @Param('campaignId') campaignId: string,
    @Query() filters: ListCampaignBackgroundsDto,
    @Req() req: any,
  ) {
    return this.campaignBackgroundsService.list(campaignId, req.user.userId, filters, filters.lang as any || 'en');
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('campaigns/:campaignId/backgrounds/:backgroundId')
  getCampaignBackground(
    @Param('campaignId') campaignId: string,
    @Param('backgroundId') backgroundId: string,
    @Query('lang') lang: 'en'|'es' = 'en',
    @Req() req: any,
  ) {
    return this.campaignBackgroundsService.get(campaignId, backgroundId, req.user.userId, lang);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('campaigns/:campaignId/backgrounds')
  createCampaignBackground(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignBackgroundDto,
    @Req() req: any,
  ) {
    return this.campaignBackgroundsService.create(campaignId, dto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('campaigns/:campaignId/backgrounds/:backgroundId')
  updateCampaignBackground(
    @Param('campaignId') campaignId: string,
    @Param('backgroundId') backgroundId: string,
    @Body() dto: UpdateCampaignBackgroundDto,
    @Req() req: any,
  ) {
    return this.campaignBackgroundsService.update(campaignId, backgroundId, dto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('campaigns/:campaignId/backgrounds/:backgroundId')
  deleteCampaignBackground(
    @Param('campaignId') campaignId: string,
    @Param('backgroundId') backgroundId: string,
    @Req() req: any,
  ) {
    return this.campaignBackgroundsService.delete(campaignId, backgroundId, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('campaigns/:campaignId/backgrounds/copy/:manualId/:backgroundId')
  copyBackgroundFromManual(
    @Param('campaignId') campaignId: string,
    @Param('manualId') manualId: string,
    @Param('backgroundId') backgroundId: string,
    @Query('lang') lang: 'en'|'es' = 'en',
    @Req() req: any,
  ) {
    return this.campaignBackgroundsService.copyFromManual(campaignId, manualId, backgroundId, req.user.userId, lang);
  }
}
