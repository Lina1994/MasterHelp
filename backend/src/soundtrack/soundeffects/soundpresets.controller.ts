import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SoundEffectsService } from './soundeffects.service';
import { CreateSoundPresetDto } from './dto/create-sound-preset.dto';
import { UpdateSoundPresetDto } from './dto/update-sound-preset.dto';

@UseGuards(JwtAuthGuard)
@Controller('soundtrack/presets')
export class SoundPresetsController {
  constructor(private readonly service: SoundEffectsService) {}

  @Get('campaigns/:campaignId')
  async list(@Req() req, @Param('campaignId') campaignId: string) {
    return this.service.listPresets(req.user, campaignId);
  }

  @Post()
  async create(@Req() req, @Body() dto: CreateSoundPresetDto) {
    return this.service.createPreset(req.user, dto);
  }

  @Patch(':presetId')
  async update(@Req() req, @Param('presetId') presetId: string, @Body() dto: UpdateSoundPresetDto) {
    return this.service.updatePreset(req.user, presetId, dto);
  }

  @Delete('campaigns/:campaignId/:presetId')
  async remove(@Req() req, @Param('campaignId') campaignId: string, @Param('presetId') presetId: string) {
    return this.service.deletePreset(req.user, campaignId, presetId);
  }
}
