import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { MonstersService } from './monsters.service';
import { CampaignMonstersService } from './campaign-monsters.service';
import { ListMonstersDto } from './dto/list-monsters.dto';
import { ListCampaignMonstersDto } from './dto/list-campaign-monsters.dto';
import { CreateCampaignMonsterDto } from './dto/create-campaign-monster.dto';
import { UpdateCampaignMonsterDto } from './dto/update-campaign-monster.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class MonstersController {
  constructor(
    private readonly service: MonstersService,
    private readonly campaignMonstersService: CampaignMonstersService,
  ) {}

  // --- Manual monsters (read-only from files) ---

  @Get('manuals/:manualId/monsters')
  list(@Param('manualId') manualId: string, @Query() query: ListMonstersDto) {
    const lang = (query.lang || 'en') as 'en' | 'es';
    const { q, type, size, crMin, crMax, page = 1, pageSize = 20 } = query;
    const items = this.service.list(manualId, lang, { q, type, size, crMin, crMax });

    // Paginación en memoria (suficiente para el SRD y primera versión)
    const total = items.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = items.slice(start, end);
    return { items: paged, total, page, pageSize };
  }

  @Get('manuals/:manualId/monsters/:slug')
  get(@Param('manualId') manualId: string, @Param('slug') slug: string, @Query('lang') lang: 'en' | 'es' = 'en') {
    return this.service.get(manualId, lang, slug);
  }

  // --- Campaign monsters (CRUD with permissions) ---

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/bestiary')
  async listCampaignMonsters(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Query() query: ListCampaignMonstersDto,
  ) {
    const lang = query.lang || 'en';
    return this.campaignMonstersService.list(campaignId, req.user.userId, query, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/bestiary/:monsterId')
  async getCampaignMonster(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('monsterId') monsterId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignMonstersService.get(campaignId, monsterId, req.user.userId, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/bestiary')
  async createCampaignMonster(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignMonsterDto,
  ) {
    return this.campaignMonstersService.create(campaignId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('campaigns/:campaignId/bestiary/:monsterId')
  async updateCampaignMonster(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('monsterId') monsterId: string,
    @Body() dto: UpdateCampaignMonsterDto,
  ) {
    return this.campaignMonstersService.update(campaignId, monsterId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('campaigns/:campaignId/bestiary/:monsterId')
  async deleteCampaignMonster(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('monsterId') monsterId: string,
  ) {
    await this.campaignMonstersService.delete(campaignId, monsterId, req.user.userId);
    return { message: 'Monster deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/bestiary/copy/:manualId/:slug')
  async copyFromManual(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('manualId') manualId: string,
    @Param('slug') slug: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignMonstersService.copyFromManual(campaignId, manualId, slug, req.user.userId, lang);
  }
}
