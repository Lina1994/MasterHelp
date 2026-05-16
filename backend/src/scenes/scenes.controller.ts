import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSceneDto } from './dto/create-scene.dto';
import { DuplicateSceneDto } from './dto/duplicate-scene.dto';
import { ExecuteSceneDto } from './dto/execute-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { ScenesService } from './scenes.service';

/**
 * Controller exposing CRUD and execution endpoints for user-owned scenes.
 */
@ApiTags('scenes')
@Controller('scenes')
@UseGuards(JwtAuthGuard)
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  /**
   * Returns recent execution history for the authenticated user.
   */
  @Get('executions/history')
  async listExecutions(@Request() req) {
    return this.scenesService.listExecutionsForOwner(req.user.userId);
  }

  /**
   * Returns one execution record owned by the authenticated user.
   */
  @Get('executions/:executionId')
  async findExecution(@Request() req, @Param('executionId') executionId: string) {
    return this.scenesService.findExecutionForOwner(executionId, req.user.userId);
  }

  /**
   * Cancels one owned execution.
   */
  @Patch('executions/:executionId/cancel')
  async cancelExecution(@Request() req, @Param('executionId') executionId: string) {
    return this.scenesService.cancelExecutionForOwner(executionId, req.user.userId);
  }

  /**
   * Lists scenes visible to the authenticated user.
   */
  @Get()
  async findAll(@Request() req, @Query('campaignId') campaignId?: string) {
    return this.scenesService.findAllForOwner(req.user.userId, campaignId);
  }

  /**
   * Returns one owned scene.
   */
  @Get('clock-sync')
  getClockSync() {
    return this.scenesService.getClockSync();
  }

  /**
   * Returns one owned scene.
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.scenesService.findOneForOwner(id, req.user.userId);
  }

  /**
   * Creates a scene for the authenticated user.
   */
  @Post()
  async create(@Request() req, @Body() dto: CreateSceneDto) {
    return this.scenesService.createForOwner(req.user.userId, dto);
  }

  /**
   * Updates one owned scene.
   */
  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateSceneDto) {
    return this.scenesService.updateForOwner(id, req.user.userId, dto);
  }

  /**
   * Deletes one owned scene.
   */
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.scenesService.removeForOwner(id, req.user.userId);
    return { success: true };
  }

  /**
   * Builds a runtime execution plan for one owned scene.
   */
  @Post(':id/execute')
  async execute(@Request() req, @Param('id') id: string, @Body() dto: ExecuteSceneDto) {
    return this.scenesService.executeForOwner(id, req.user.userId, dto);
  }

  /**
   * Duplicates one owned scene.
   */
  @Post(':id/duplicate')
  async duplicate(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: DuplicateSceneDto,
  ) {
    return this.scenesService.duplicateForOwner(id, req.user.userId, dto.targetCampaignId);
  }
}