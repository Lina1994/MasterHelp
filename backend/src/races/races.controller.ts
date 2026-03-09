import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RacesService } from './races.service';
import { CampaignRacesService } from './campaign-races.service';
import { CreateCampaignRaceDto } from './dto/create-campaign-race.dto';
import { UpdateCampaignRaceDto } from './dto/update-campaign-race.dto';
import { ListCampaignRacesDto } from './dto/list-campaign-races.dto';

@Controller()
export class RacesController {
  constructor(
    private readonly races: RacesService,
    private readonly campaignRacesService: CampaignRacesService,
  ) {}

  // --- Manual (read-only) ---

  /**
   * Manual-aware endpoints for races
   * GET /manuals/:manualId/races?lang=
   * @param manualId Manual identifier (e.g., 'dnd5e-2014')
   * @param lang Locale code ('en' | 'es')
   */
  @Get('manuals/:manualId/races')
  listForManual(@Param('manualId') manualId: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.races.list(l, manualId);
  }

  /**
   * GET /manuals/:manualId/races/:id?lang=
   * Returns a single race by id.
   * @param manualId Manual identifier
   * @param id Race id
   * @param lang Locale code ('en' | 'es')
   */
  @Get('manuals/:manualId/races/:id')
  getForManual(
    @Param('manualId') manualId: string,
    @Param('id') id: string,
    @Query('lang') lang?: 'en' | 'es',
  ) {
    const l = lang || 'en';
    return this.races.getById(l, id, manualId);
  }

  // --- Campaign CRUD ---

  @UseGuards(AuthGuard('jwt'))
  @Get('campaigns/:campaignId/races')
  listCampaignRaces(
    @Param('campaignId') campaignId: string,
    @Query() filters: ListCampaignRacesDto,
    @Req() req: any,
  ) {
    return this.campaignRacesService.list(campaignId, req.user.userId, filters, filters.lang as any || 'en');
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('campaigns/:campaignId/races/:raceId')
  getCampaignRace(
    @Param('campaignId') campaignId: string,
    @Param('raceId') raceId: string,
    @Query('lang') lang: 'en'|'es' = 'en',
    @Req() req: any,
  ) {
    return this.campaignRacesService.get(campaignId, raceId, req.user.userId, lang);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('campaigns/:campaignId/races')
  createCampaignRace(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignRaceDto,
    @Req() req: any,
  ) {
    return this.campaignRacesService.create(campaignId, dto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('campaigns/:campaignId/races/:raceId')
  updateCampaignRace(
    @Param('campaignId') campaignId: string,
    @Param('raceId') raceId: string,
    @Body() dto: UpdateCampaignRaceDto,
    @Req() req: any,
  ) {
    return this.campaignRacesService.update(campaignId, raceId, dto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('campaigns/:campaignId/races/:raceId')
  deleteCampaignRace(
    @Param('campaignId') campaignId: string,
    @Param('raceId') raceId: string,
    @Req() req: any,
  ) {
    return this.campaignRacesService.delete(campaignId, raceId, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('campaigns/:campaignId/races/copy/:manualId/:raceId')
  copyRaceFromManual(
    @Param('campaignId') campaignId: string,
    @Param('manualId') manualId: string,
    @Param('raceId') raceId: string,
    @Query('lang') lang: 'en'|'es' = 'en',
    @Req() req: any,
  ) {
    return this.campaignRacesService.copyFromManual(campaignId, manualId, raceId, req.user.userId, lang);
  }
}
