import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { SpellsService } from './spells.service';
import { CampaignSpellsService } from './campaign-spells.service';
import { GetSpellsQueryDto } from './dto/get-spells.query.dto';
import { ListCampaignSpellsDto } from './dto/list-campaign-spells.dto';
import { CreateCampaignSpellDto } from './dto/create-campaign-spell.dto';
import { UpdateCampaignSpellDto } from './dto/update-campaign-spell.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class SpellsController {
  constructor(
    private readonly spells: SpellsService,
    private readonly campaignSpellsService: CampaignSpellsService,
  ) {}

  // Back-compat: GET /spells
  @Get('spells')
  list(@Query() q: GetSpellsQueryDto) {
    const lang = (q.lang || 'en');
    return this.spells.listPaged(lang, {
      search: q.search,
      level: q.level,
      school: q.school,
      concentration: q.concentration,
      ritual: q.ritual,
      page: q.page,
      pageSize: q.pageSize,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
    });
  }

  /**
   * GET /spells/:id?lang=
   * Returns the full spell detail for the given id.
   */
  @Get('spells/meta/all')
  meta(@Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.meta(l);
  }

  @Get('spells/:id')
  get(@Param('id') id: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.getById(l, id);
  }

  // Manual-aware endpoints
  @Get('manuals/:manualId/spells')
  listForManual(@Param('manualId') manualId: string, @Query() q: GetSpellsQueryDto) {
    const lang = (q.lang || 'en');
    return this.spells.listPaged(
      lang,
      {
        search: q.search,
        level: q.level,
        school: q.school,
        concentration: q.concentration,
        ritual: q.ritual,
        page: q.page,
        pageSize: q.pageSize,
        sortBy: q.sortBy,
        sortDir: q.sortDir,
      },
      manualId,
    );
  }

  @Get('manuals/:manualId/spells/meta/all')
  metaForManual(@Param('manualId') manualId: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.meta(l, manualId);
  }

  @Get('manuals/:manualId/spells/:id')
  getForManual(@Param('manualId') manualId: string, @Param('id') id: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.getById(l, id, manualId);
  }

  // --- Campaign spells (CRUD with permissions) ---

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/spells')
  async listCampaignSpells(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Query() query: ListCampaignSpellsDto,
  ) {
    const lang = query.lang || 'en';
    return this.campaignSpellsService.list(campaignId, req.user.userId, query, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/spells/:spellId')
  async getCampaignSpell(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('spellId') spellId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignSpellsService.get(campaignId, spellId, req.user.userId, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/spells')
  async createCampaignSpell(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignSpellDto,
  ) {
    return this.campaignSpellsService.create(campaignId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('campaigns/:campaignId/spells/:spellId')
  async updateCampaignSpell(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('spellId') spellId: string,
    @Body() dto: UpdateCampaignSpellDto,
  ) {
    return this.campaignSpellsService.update(campaignId, spellId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('campaigns/:campaignId/spells/:spellId')
  async deleteCampaignSpell(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('spellId') spellId: string,
  ) {
    await this.campaignSpellsService.delete(campaignId, spellId, req.user.userId);
    return { message: 'Spell deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/spells/copy/:manualId/:spellId')
  async copySpellFromManual(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('manualId') manualId: string,
    @Param('spellId') spellId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignSpellsService.copyFromManual(campaignId, manualId, spellId, req.user.userId, lang);
  }
}
