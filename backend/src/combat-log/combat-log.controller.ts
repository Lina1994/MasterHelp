import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CombatLogService } from './combat-log.service';
import {
  AppendCombatSnapshotDto,
  EndCombatLogDto,
  StartCombatLogDto,
} from './dto/combat-log.dto';

/** Combat history + timeline API, scoped per campaign. */
@Controller('campaigns/:campaignId/combat-logs')
@UseGuards(JwtAuthGuard)
export class CombatLogController {
  constructor(private readonly service: CombatLogService) {}

  @Get()
  list(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Query('encounterId') encounterId?: string,
  ) {
    return this.service.list(Number(req.user.userId), campaignId, encounterId);
  }

  @Get(':id')
  getOne(@Request() req, @Param('campaignId') campaignId: string, @Param('id') id: string) {
    return this.service.getOne(Number(req.user.userId), campaignId, id);
  }

  @Post('start')
  start(@Request() req, @Param('campaignId') campaignId: string, @Body() dto: StartCombatLogDto) {
    return this.service.start(Number(req.user.userId), campaignId, dto);
  }

  @Post(':id/snapshot')
  appendSnapshot(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
    @Body() dto: AppendCombatSnapshotDto,
  ) {
    return this.service.appendSnapshot(Number(req.user.userId), campaignId, id, dto);
  }

  @Post(':id/end')
  end(
    @Request() req,
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
    @Body() dto: EndCombatLogDto,
  ) {
    return this.service.end(Number(req.user.userId), campaignId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('campaignId') campaignId: string, @Param('id') id: string) {
    return this.service.remove(Number(req.user.userId), campaignId, id);
  }
}
