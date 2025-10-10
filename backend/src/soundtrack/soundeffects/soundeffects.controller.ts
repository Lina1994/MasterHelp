import { Controller, UseGuards, Post, UseInterceptors, UploadedFile, Body, Req, Get, Param, Patch, Delete, Res, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { SoundEffectsService } from './soundeffects.service';
import { CreateSoundEffectDto } from './dto/create-sound-effect.dto';
import { UpdateSoundEffectDto } from './dto/update-sound-effect.dto';
import fetch from 'node-fetch';
import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('soundtrack/effects')
export class SoundEffectsController {
  constructor(private readonly service: SoundEffectsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(@Req() req, @Body() dto: CreateSoundEffectDto, @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number }) {
    let fetched: { data: Buffer; mimeType: string } | undefined;
    if (!file && dto.url) {
      const r = await fetch(dto.url);
      if (!r.ok) throw new Error('Failed to fetch url');
      const ab = await r.arrayBuffer();
      fetched = { data: Buffer.from(ab), mimeType: r.headers.get('content-type') || 'audio/mpeg' };
    }
    return this.service.createEffect(req.user, dto, file, fetched);
  }

  @Get('campaigns/:campaignId')
  async listForCampaign(@Req() req, @Param('campaignId') campaignId: string) {
    return this.service.listEffectsForCampaign(req.user, campaignId);
  }

  @Get()
  async listOwned(@Req() req) { return this.service.listOwnedEffects(req.user); }

  @Patch(':id')
  async update(@Req() req, @Param('id') id: string, @Body() dto: UpdateSoundEffectDto) {
    return this.service.updateEffect(req.user, id, dto);
  }

  @Post(':id/associate')
  async associate(@Req() req, @Param('id') id: string, @Body() body: { campaignIds: string[] }) {
    return this.service.associateEffect(req.user, id, body.campaignIds);
  }

  @Delete(':id/associate/:campaignId')
  async unassociate(@Req() req, @Param('id') id: string, @Param('campaignId') campaignId: string) {
    return this.service.unassociateEffect(req.user, id, campaignId);
  }

  @Delete(':id')
  async remove(@Req() req, @Param('id') id: string) { return this.service.removeEffect(req.user, id); }

  @Get(':id/stream')
  async stream(@Req() req, @Param('id') id: string, @Query('campaignId') campaignId: string | undefined, @Res() res: Response) {
    const effect = await this.service.getStreamableEffect(req.user, id, campaignId);
    const buffer: Buffer = effect.data;
    const total = buffer.length;
    const range = req.headers['range'];
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range as string);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : Math.min(start + 1_048_576, total - 1);
      if (start >= total || end >= total) {
        res.status(416).set({ 'Content-Range': `bytes */${total}` }).end();
        return;
      }
      const chunk = buffer.subarray(start, end + 1);
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk.length.toString(),
        'Content-Type': effect.mimeType,
        'Cache-Control': 'no-store',
      });
      res.end(chunk);
      return;
    }
    res.setHeader('Content-Type', effect.mimeType);
    res.setHeader('Content-Length', total.toString());
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Post(':id/played')
  async markPlayed(@Req() req, @Param('id') id: string, @Query('campaignId') campaignId?: string) {
    return this.service.markEffectPlayed(req.user, id, campaignId);
  }
}
