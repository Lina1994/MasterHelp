import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { CampaignSkillsService } from './campaign-skills.service';
import { ListCampaignSkillsDto } from './dto/list-campaign-skills.dto';
import { CreateCampaignSkillDto } from './dto/create-campaign-skill.dto';
import { UpdateCampaignSkillDto } from './dto/update-campaign-skill.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class SkillsController {
  constructor(
    private readonly skillsService: SkillsService,
    private readonly campaignSkillsService: CampaignSkillsService,
  ) {}

  // --- Read-only manual endpoints ---

  @Get('manuals/:manualId/skills')
  async listForManual(@Param('manualId') manualId: string, @Query('lang') lang?: 'en' | 'es') {
    return this.skillsService.listAsync(lang || 'en', manualId);
  }

  @Get('manuals/:manualId/skills/:id')
  async getForManual(
    @Param('manualId') manualId: string,
    @Param('id') id: string,
    @Query('lang') lang?: 'en' | 'es',
  ) {
    return this.skillsService.getByIdAsync(lang || 'en', id, manualId);
  }

  // --- Campaign skills (CRUD with permissions) ---

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/skills')
  async listCampaignSkills(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Query() query: ListCampaignSkillsDto,
  ) {
    const lang = query.lang || 'en';
    return this.campaignSkillsService.list(campaignId, req.user.userId, query, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:campaignId/skills/:skillId')
  async getCampaignSkill(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('skillId') skillId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignSkillsService.get(campaignId, skillId, req.user.userId, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/skills')
  async createCampaignSkill(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignSkillDto,
  ) {
    return this.campaignSkillsService.create(campaignId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('campaigns/:campaignId/skills/:skillId')
  async updateCampaignSkill(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('skillId') skillId: string,
    @Body() dto: UpdateCampaignSkillDto,
  ) {
    return this.campaignSkillsService.update(campaignId, skillId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('campaigns/:campaignId/skills/:skillId')
  async deleteCampaignSkill(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('skillId') skillId: string,
  ) {
    await this.campaignSkillsService.delete(campaignId, skillId, req.user.userId);
    return { message: 'Skill deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/skills/copy/:manualId/:skillId')
  async copySkillFromManual(
    @Request() req: any,
    @Param('campaignId') campaignId: string,
    @Param('manualId') manualId: string,
    @Param('skillId') skillId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ) {
    return this.campaignSkillsService.copyFromManual(campaignId, manualId, skillId, req.user.userId, lang);
  }
}
