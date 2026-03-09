import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClassesService } from './classes.service';
import { CampaignClassesService } from './campaign-classes.service';
import { CreateCampaignClassDto } from './dto/create-campaign-class.dto';
import { UpdateCampaignClassDto } from './dto/update-campaign-class.dto';
import { ListCampaignClassesDto } from './dto/list-campaign-classes.dto';

@Controller()
export class ClassesController {
  constructor(
    private readonly classesService: ClassesService,
    private readonly campaignClassesService: CampaignClassesService,
  ) {}

  // --- Manual (read-only) ---

  @Get('manuals/:manualId/classes')
  list(@Param('manualId') manualId: string, @Query('lang') lang: 'en'|'es' = 'en') {
    return this.classesService.list(lang, manualId);
  }

  @Get('manuals/:manualId/classes/:id')
  get(@Param('manualId') manualId: string, @Param('id') id: string, @Query('lang') lang: 'en'|'es' = 'en') {
    return this.classesService.getById(lang, id, manualId);
  }

  // --- Campaign CRUD ---

  @UseGuards(AuthGuard('jwt'))
  @Get('campaigns/:campaignId/classes')
  listCampaignClasses(
    @Param('campaignId') campaignId: string,
    @Query() filters: ListCampaignClassesDto,
    @Req() req: any,
  ) {
    return this.campaignClassesService.list(campaignId, req.user.userId, filters, filters.lang as any || 'en');
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('campaigns/:campaignId/classes/:classId')
  getCampaignClass(
    @Param('campaignId') campaignId: string,
    @Param('classId') classId: string,
    @Query('lang') lang: 'en'|'es' = 'en',
    @Req() req: any,
  ) {
    return this.campaignClassesService.get(campaignId, classId, req.user.userId, lang);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('campaigns/:campaignId/classes')
  createCampaignClass(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignClassDto,
    @Req() req: any,
  ) {
    return this.campaignClassesService.create(campaignId, dto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('campaigns/:campaignId/classes/:classId')
  updateCampaignClass(
    @Param('campaignId') campaignId: string,
    @Param('classId') classId: string,
    @Body() dto: UpdateCampaignClassDto,
    @Req() req: any,
  ) {
    return this.campaignClassesService.update(campaignId, classId, dto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('campaigns/:campaignId/classes/:classId')
  deleteCampaignClass(
    @Param('campaignId') campaignId: string,
    @Param('classId') classId: string,
    @Req() req: any,
  ) {
    return this.campaignClassesService.delete(campaignId, classId, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('campaigns/:campaignId/classes/copy/:manualId/:classId')
  copyClassFromManual(
    @Param('campaignId') campaignId: string,
    @Param('manualId') manualId: string,
    @Param('classId') classId: string,
    @Query('lang') lang: 'en'|'es' = 'en',
    @Req() req: any,
  ) {
    return this.campaignClassesService.copyFromManual(campaignId, manualId, classId, req.user.userId, lang);
  }
}
