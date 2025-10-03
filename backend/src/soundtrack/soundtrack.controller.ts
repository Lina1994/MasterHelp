import { Controller, Post, UseGuards, Req, Body, UploadedFile, UseInterceptors, Get, Param, Query, Patch, Delete, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SoundtrackService } from './soundtrack.service';
import { CreateSongDto } from './dto/create-song.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateSongDto } from './dto/update-song.dto';
import { AssociateSongDto } from './dto/associate-song.dto';
import fetch from 'node-fetch';
import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('soundtrack')
export class SoundtrackController {
  constructor(private readonly service: SoundtrackService) {}

  @Post('songs')
  @UseInterceptors(FileInterceptor('file'))
  async create(@Req() req, @Body() dto: CreateSongDto, @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number }) {
    // campaignId (opcional) puede venir en el multipart form-data y el DTO lo recogerá
    let fetched: { data: Buffer; mimeType: string } | undefined;
    if (!file && dto.url) {
      const r = await fetch(dto.url);
      if (!r.ok) throw new Error('Failed to fetch url');
      const arrayBuffer = await r.arrayBuffer();
      fetched = { data: Buffer.from(arrayBuffer), mimeType: r.headers.get('content-type') || 'audio/mpeg' };
    }
    return this.service.create(req.user, dto, file, fetched);
  }

  @Get('campaigns/:campaignId/songs')
  async listForCampaign(@Req() req, @Param('campaignId') campaignId: string, @Query('q') q?: string, @Query('group') group?: string) {
    return this.service.findSectionedForCampaign(req.user, campaignId, q, group, true);
  }

  @Get('songs')
  async listOwned(@Req() req, @Query('q') q?: string, @Query('group') group?: string) {
    // Lista canciones propias del usuario (sin separar asociadas) cuando no se especifica campaignId.
    return this.service.listOwned(req.user, q, group);
  }

  @Patch('songs/:songId')
  async update(@Req() req, @Param('songId') songId: string, @Body() dto: UpdateSongDto) {
    return this.service.update(req.user, songId, dto);
  }

  @Post('songs/:songId/associate')
  async associate(@Req() req, @Param('songId') songId: string, @Body() body: AssociateSongDto) {
    return this.service.associate(req.user, songId, body.campaignIds);
  }

  @Delete('songs/:songId/associate/:campaignId')
  async unassociate(@Req() req, @Param('songId') songId: string, @Param('campaignId') campaignId: string) {
    return this.service.unassociate(req.user, songId, campaignId);
  }

  @Delete('songs/:songId')
  async remove(@Req() req, @Param('songId') songId: string) {
    return this.service.remove(req.user, songId);
  }

  @Get('songs/:songId/stream')
  async stream(@Req() req, @Param('songId') songId: string, @Query('campaignId') campaignId: string | undefined, @Res() res: Response) {
    const normalizedCampaignId = campaignId && campaignId.trim().length > 0 ? campaignId : undefined;
    const song = await this.service.getStreamable(req.user, songId, normalizedCampaignId);
    const range = req.headers['range'];
    const buffer = song.data;
    const total = buffer.length;
    if (range) {
      // Formato esperado: bytes=start-end
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : Math.min(start + 1_048_576, total - 1); // máx ~1MB por chunk
      if (start >= total || end >= total) {
        res.status(416).set({
          'Content-Range': `bytes */${total}`,
        }).end();
        return;
      }
      const chunk = buffer.subarray(start, end + 1);
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk.length.toString(),
        'Content-Type': song.mimeType,
        'Cache-Control': 'no-store',
      });
      res.end(chunk);
      return;
    }
    res.setHeader('Content-Type', song.mimeType);
    res.setHeader('Content-Length', total.toString());
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }
}
