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
import { CreateShortcutDto } from './dto/create-shortcut.dto';
import { UpdateShortcutDto } from './dto/update-shortcut.dto';
import { ShortcutsService } from './shortcuts.service';

/**
 * Controller exposing CRUD and execution for user-owned shortcuts.
 */
@ApiTags('shortcuts')
@Controller('shortcuts')
@UseGuards(JwtAuthGuard)
export class ShortcutsController {
  constructor(private readonly shortcutsService: ShortcutsService) {}

  @Get()
  async findAll(@Request() req, @Query('campaignId') campaignId?: string) {
    return this.shortcutsService.findAllForOwner(req.user.userId, campaignId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.shortcutsService.findOneForOwner(id, req.user.userId);
  }

  @Post()
  async create(@Request() req, @Body() dto: CreateShortcutDto) {
    return this.shortcutsService.createForOwner(req.user.userId, dto);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateShortcutDto) {
    return this.shortcutsService.updateForOwner(id, req.user.userId, dto);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.shortcutsService.removeForOwner(id, req.user.userId);
    return { success: true };
  }

  @Post(':id/execute')
  async execute(@Request() req, @Param('id') id: string) {
    return this.shortcutsService.executeForOwner(id, req.user.userId);
  }
}