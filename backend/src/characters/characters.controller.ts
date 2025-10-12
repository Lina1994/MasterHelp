import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharactersController {
  constructor(private readonly service: CharactersService) {}

  /** List characters for a campaign, filtered by viewer permissions. */
  @Get()
  async list(@Request() req, @Query('campaignId') campaignId: string) {
    return this.service.listForUserInCampaign(req.user.userId, campaignId);
  }

  @Post()
  async create(@Request() req, @Body() dto: CreateCharacterDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Get(':id')
  async get(@Request() req, @Param('id') id: string) {
    return this.service.getByIdForUser(req.user.userId, id);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateCharacterDto) {
    return this.service.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
