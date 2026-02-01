import { Controller, Post, UseGuards, Req, Body, UploadedFile, UseInterceptors, Get, Param, Query, Patch, Delete, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SoundtrackService } from './soundtrack.service';
import { CreateSongDto } from './dto/create-song.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateSongDto } from './dto/update-song.dto';
import { AssociateSongDto } from './dto/associate-song.dto';
import fetch from 'node-fetch';
import { Response } from 'express';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@UseGuards(JwtAuthGuard)
@Controller('soundtrack')
export class SoundtrackController {
  constructor(private readonly service: SoundtrackService) {}

  private toArray(v?: string | string[]): string[] | undefined {
    if (v === undefined) return undefined;
    const arr = Array.isArray(v) ? v : (v.includes(',') ? v.split(',') : [v]);
    const norm = arr.map(s => (s ?? '').trim()).filter(Boolean);
    return norm.length ? Array.from(new Set(norm)) : undefined;
  }

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
  async listForCampaign(
    @Req() req,
    @Param('campaignId') campaignId: string,
    @Query('q') q?: string,
    @Query('sort') sort?: 'alpha' | 'alpha_desc' | 'newest' | 'oldest' | 'last_used',
    @Query('group') group?: string | string[],
    @Query('artist') artist?: string | string[],
    @Query('album') album?: string | string[],
    @Query('atmosphere') atmosphere?: string | string[],
    @Query('isPublic') isPublic?: string,
  ) {
    const isPublicFilter = typeof isPublic === 'string' ? (isPublic.toLowerCase() === 'true' ? true : isPublic.toLowerCase() === 'false' ? false : undefined) : undefined;
    const groups = this.toArray(group);
    const artists = this.toArray(artist);
    const albums = this.toArray(album);
    const atmospheres = this.toArray(atmosphere);
    return this.service.findSectionedForCampaign(req.user, campaignId, q, undefined, true, { groups, artists, albums, atmospheres, isPublic: isPublicFilter }, sort);
  }

  @Get('songs')
  async listOwned(
    @Req() req,
    @Query('q') q?: string,
    @Query('sort') sort?: 'alpha' | 'alpha_desc' | 'newest' | 'oldest' | 'last_used',
    @Query('group') group?: string | string[],
    @Query('artist') artist?: string | string[],
    @Query('album') album?: string | string[],
    @Query('atmosphere') atmosphere?: string | string[],
    @Query('isPublic') isPublic?: string,
  ) {
    // Lista canciones propias del usuario (sin separar asociadas) cuando no se especifica campaignId.
    const isPublicFilter = typeof isPublic === 'string' ? (isPublic.toLowerCase() === 'true' ? true : isPublic.toLowerCase() === 'false' ? false : undefined) : undefined;
    const groups = this.toArray(group);
    const artists = this.toArray(artist);
    const albums = this.toArray(album);
    const atmospheres = this.toArray(atmosphere);
    return this.service.listOwned(req.user, q, undefined, { groups, artists, albums, atmospheres, isPublic: isPublicFilter }, sort);
  }

  @Get('filters')
  async listOwnedFilters(@Req() req) {
    return this.service.getFilterOptions(req.user);
  }

  @Get('campaigns/:campaignId/filters')
  async listCampaignFilters(@Req() req, @Param('campaignId') campaignId: string) {
    return this.service.getFilterOptions(req.user, campaignId);
  }

  @Get('usage')
  async getUsage(@Req() req) {
    return this.service.getUsage(req.user);
  }

  // ===== Playlists =====
  @Get('campaigns/:campaignId/playlists')
  async listPlaylists(@Req() req, @Param('campaignId') campaignId: string) {
    return this.service.listPlaylists(req.user, campaignId);
  }

  @Post('campaigns/:campaignId/playlists')
  async createPlaylist(@Req() req, @Param('campaignId') campaignId: string, @Body() dto: CreatePlaylistDto) {
    return this.service.createPlaylist(req.user, campaignId, dto);
  }

  @Patch('campaigns/:campaignId/playlists/:playlistId')
  async updatePlaylist(
    @Req() req,
    @Param('campaignId') campaignId: string,
    @Param('playlistId') playlistId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.service.updatePlaylist(req.user, campaignId, playlistId, dto);
  }

  @Delete('campaigns/:campaignId/playlists/:playlistId')
  async deletePlaylist(@Req() req, @Param('campaignId') campaignId: string, @Param('playlistId') playlistId: string) {
    return this.service.deletePlaylist(req.user, campaignId, playlistId);
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

  @Post('songs/:songId/played')
  async markPlayed(@Req() req, @Param('songId') songId: string, @Query('campaignId') campaignId?: string) {
    const normalizedCampaignId = campaignId && campaignId.trim().length > 0 ? campaignId : undefined;
    return this.service.markPlayed(req.user, songId, normalizedCampaignId);
  }

  /**
   * Returns recent song play history for a campaign.
   * Consecutive duplicates are already de-duplicated server-side.
   */
  @Get('campaigns/:campaignId/history')
  async getHistory(
    @Req() req,
    @Param('campaignId') campaignId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const l = limit !== undefined ? parseInt(limit, 10) : 50;
    const o = offset !== undefined ? parseInt(offset, 10) : 0;
    return this.service.getCampaignPlayHistory(
      req.user.userId,
      campaignId,
      Number.isFinite(l) ? l : 50,
      Number.isFinite(o) ? o : 0,
    );
  }

  /**
   * Clears song play history for a campaign.
   * Only campaign owner can clear.
   */
  @Delete('campaigns/:campaignId/history')
  async clearHistory(@Req() req, @Param('campaignId') campaignId: string) {
    return this.service.clearCampaignPlayHistory(req.user.userId, campaignId);
  }

  /**
   * Returns the most recently marked played song for a given campaign.
   * Used by Skyline projection windows to show current song title.
   */
  @Get('campaigns/:campaignId/now-playing')
  async getNowPlaying(@Req() req, @Param('campaignId') campaignId: string) {
    return this.service.getNowPlayingTitle(req.user.userId, campaignId);
  }

  /**
   * Public read-only endpoint for projection clients to read now-playing.
   */
  @Get('projection/campaigns/:campaignId/now-playing')
  async getNowPlayingPublic(@Param('campaignId') campaignId: string) {
    return this.service.getNowPlayingTitlePublic(campaignId);
  }
}
