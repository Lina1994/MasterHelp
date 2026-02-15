import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuestsService } from './quests.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';

@Controller('quests')
@UseGuards(JwtAuthGuard)
export class QuestsController {
  constructor(private readonly service: QuestsService) {}

  /**
   * List quests for a campaign.
   * - Master sees all quests
   * - Players see only accepted and completed quests
   */
  @Get()
  async list(@Request() req, @Query('campaignId') campaignId: string) {
    return this.service.list(req.user.userId, campaignId);
  }

  /**
   * Get a specific quest by ID.
   */
  @Get(':id')
  async get(@Request() req, @Param('id') id: string) {
    return this.service.getById(req.user.userId, id);
  }

  /**
   * Create a new quest (master only).
   */
  @Post()
  async create(@Request() req, @Body() dto: CreateQuestDto) {
    return this.service.create(req.user.userId, dto);
  }

  /**
   * Update a quest.
   * - Master can update everything
   * - Players can only change status (accept/complete)
   */
  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateQuestDto) {
    return this.service.update(req.user.userId, id, dto);
  }

  /**
   * Delete a quest (master only).
   */
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.service.remove(req.user.userId, id);
    return { success: true };
  }
}
