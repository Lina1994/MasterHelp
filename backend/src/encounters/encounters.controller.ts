/** Controller de encuentros. Expuesto bajo /campaigns/:campaignId/encounters. */
import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';

@Controller('campaigns/:campaignId/encounters')
@UseGuards(JwtAuthGuard)
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Get()
  list(@Request() req, @Param('campaignId') campaignId: string) {
    return this.encountersService.list(Number(req.user.userId), campaignId);
  }

  @Post()
  create(@Request() req, @Param('campaignId') campaignId: string, @Body() dto: CreateEncounterDto) {
    return this.encountersService.create(Number(req.user.userId), campaignId, dto);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEncounterDto,
  ) {
    return this.encountersService.update(Number(req.user.userId), campaignId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('campaignId') campaignId: string, @Param('id') id: string) {
    return this.encountersService.remove(Number(req.user.userId), campaignId, id);
  }
}
