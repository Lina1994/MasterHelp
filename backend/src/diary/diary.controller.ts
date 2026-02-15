import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiaryService } from './diary.service';
import { UpdateDiaryCalendarDto } from './dto/update-calendar.dto';
import { UpdateCurrentDayDto } from './dto/update-current-day.dto';
import { UpsertDiaryEntryDto } from './dto/upsert-diary-entry.dto';
import {
  CreateDiarySessionDto,
  StartDiarySessionDto,
  UpdateDiarySessionDto,
  VisitDiaryDayDto,
} from './dto/sessions.dto';

/**
 * Diary API.
 *
 * All routes are campaign-scoped and require authentication.
 */
@Controller('diary')
@UseGuards(JwtAuthGuard)
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  @Get('campaigns/:campaignId/calendar')
  async getCalendar(@Param('campaignId') campaignId: string, @Req() req: any) {
    return this.diaryService.getCalendar(campaignId, req.user.userId);
  }

  @Patch('campaigns/:campaignId/calendar')
  async updateCalendar(
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateDiaryCalendarDto,
    @Req() req: any,
  ) {
    return this.diaryService.updateCalendar(campaignId, req.user.userId, {
      currentYear: dto.currentYear,
      currentMonthIndex: dto.currentMonthIndex,
      currentDayIndex: dto.currentDayIndex,
      yearLabelTemplate: dto.yearLabelTemplate,
      months: dto.months,
      weekDays: dto.weekDays,
    });
  }

  @Patch('campaigns/:campaignId/calendar/current-day')
  async updateCurrentDay(
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCurrentDayDto,
    @Req() req: any,
  ) {
    return this.diaryService.updateCurrentDay(campaignId, req.user.userId, dto.monthIndex, dto.dayIndex);
  }

  @Post('campaigns/:campaignId/entries/upsert')
  async upsertEntry(
    @Param('campaignId') campaignId: string,
    @Body() dto: UpsertDiaryEntryDto,
    @Req() req: any,
  ) {
    return this.diaryService.upsertDiaryEntry({
      campaignId,
      userId: req.user.userId,
      year: dto.year,
      monthIndex: dto.monthIndex,
      dayIndex: dto.dayIndex,
      publicHtml: dto.publicHtml ?? null,
      privateHtml: dto.privateHtml ?? null,
      items: dto.items,
    });
  }

  @Get('campaigns/:campaignId/entries/:year/:monthIndex/:dayIndex')
  async getEntry(
    @Param('campaignId') campaignId: string,
    @Param('year') year: string,
    @Param('monthIndex') monthIndex: string,
    @Param('dayIndex') dayIndex: string,
    @Req() req: any,
  ) {
    return this.diaryService.getDiaryEntry({
      campaignId,
      userId: req.user.userId,
      year: Number(year),
      monthIndex: Number(monthIndex),
      dayIndex: Number(dayIndex),
    });
  }

  @Get('campaigns/:campaignId/sessions')
  async listSessions(@Param('campaignId') campaignId: string, @Req() req: any) {
    return this.diaryService.listSessions(campaignId, req.user.userId);
  }

  @Post('campaigns/:campaignId/sessions')
  async createSession(@Param('campaignId') campaignId: string, @Body() dto: CreateDiarySessionDto, @Req() req: any) {
    return this.diaryService.createSession(campaignId, req.user.userId, {
      title: dto.title ?? null,
      isPublic: dto.isPublic ?? false,
      publicHtml: dto.publicHtml ?? null,
      privateHtml: dto.privateHtml ?? null,
      items: dto.items,
      days: dto.days ?? [],
    });
  }

  @Patch('campaigns/:campaignId/sessions/:sessionId')
  async updateSession(
    @Param('campaignId') campaignId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateDiarySessionDto,
    @Req() req: any,
  ) {
    return this.diaryService.updateSession(campaignId, req.user.userId, sessionId, {
      title: dto.title,
      isPublic: dto.isPublic,
      publicHtml: dto.publicHtml,
      privateHtml: dto.privateHtml,
      items: dto.items,
    });
  }

  @Get('campaigns/:campaignId/sessions/active')
  async getActiveSession(@Param('campaignId') campaignId: string, @Req() req: any) {
    return this.diaryService.getActiveSession(campaignId, req.user.userId);
  }

  @Post('campaigns/:campaignId/sessions/start')
  async startSession(@Param('campaignId') campaignId: string, @Body() dto: StartDiarySessionDto, @Req() req: any) {
    return this.diaryService.startSession(campaignId, req.user.userId, {
      title: dto.title ?? null,
      isPublic: dto.isPublic ?? false,
    });
  }

  @Post('campaigns/:campaignId/sessions/:sessionId/end')
  async endSession(@Param('campaignId') campaignId: string, @Param('sessionId') sessionId: string, @Req() req: any) {
    return this.diaryService.endSession(campaignId, req.user.userId, sessionId);
  }

  @Post('campaigns/:campaignId/sessions/:sessionId/visit-day')
  async visitDay(
    @Param('campaignId') campaignId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: VisitDiaryDayDto,
    @Req() req: any,
  ) {
    return this.diaryService.visitDay(campaignId, req.user.userId, sessionId, {
      year: dto.day.year,
      monthIndex: dto.day.monthIndex,
      dayIndex: dto.day.dayIndex,
    });
  }

  @Delete('campaigns/:campaignId/sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @Param('campaignId') campaignId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: any,
  ): Promise<void> {
    await this.diaryService.deleteSession(campaignId, req.user.userId, sessionId);
  }
}
