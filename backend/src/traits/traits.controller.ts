import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { TraitsService } from './traits.service';
import { CampaignTraitsService } from './campaign-traits.service';
import { ListCampaignTraitsDto } from './dto/list-campaign-traits.dto';
import { CreateCampaignTraitDto } from './dto/create-campaign-trait.dto';
import { UpdateCampaignTraitDto } from './dto/update-campaign-trait.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class TraitsController {
  constructor(
    private readonly traitsService: TraitsService,
    private readonly campaignTraitsService: CampaignTraitsService,
  ) {}

  // --- Read-only manual endpoints ---

  /**
   * GET /manuals/:manualId/traits?lang=
   * @param manualId Manual identifier (e.g., 'dnd5e-2014')
   * @param lang Locale code ('en' | 'es')
   * @returns Array of traits
   */
  @Get('manuals/:manualId/traits')
  listForManual(@Param('manualId') manualId: string, @Query('lang') lang?: 'en' | 'es') {
    return this.traitsService.list(lang || 'en', manualId);
  }

  /**
   * GET /manuals/:manualId/traits/:id?lang=
   * @param manualId Manual identifier
   * @param id Trait id
   * @param lang Locale code
   * @returns A single trait
   */
  @Get('manuals/:manualId/traits/:id')
  getForManual(
    @Param('manualId') manualId: string,
    @Param('id') id: string,
    @Query('lang') lang?: 'en' | 'es',
  ) {
    return this.traitsService.getById(lang || 'en', id, manualId);
  }

  // --- Campaign traits (CRUD with permissions) ---

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/traits')
  async listCampaignTraits(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Query() query: ListCampaignTraitsDto,
  ) {
    const lang = query.lang || 'en';
    return this.campaignTraitsService.list(campaignId, req.user.userId, query, lang as any);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/traits/:traitId')
  async getCampaignTrait(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('traitId') traitId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignTraitsService.get(campaignId, traitId, req.user.userId, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/traits')
  async createCampaignTrait(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignTraitDto,
  ) {
    return this.campaignTraitsService.create(campaignId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('campaigns/:campaignId/traits/:traitId')
  async updateCampaignTrait(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('traitId') traitId: string,
    @Body() dto: UpdateCampaignTraitDto,
  ) {
    return this.campaignTraitsService.update(campaignId, traitId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('campaigns/:campaignId/traits/:traitId')
  async deleteCampaignTrait(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('traitId') traitId: string,
  ) {
    await this.campaignTraitsService.delete(campaignId, traitId, req.user.userId);
    return { message: 'Trait deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/traits/copy/:manualId/:traitId')
  async copyTraitFromManual(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('manualId') manualId: string,
    @Param('traitId') traitId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignTraitsService.copyFromManual(campaignId, manualId, traitId, req.user.userId, lang);
  }
}
