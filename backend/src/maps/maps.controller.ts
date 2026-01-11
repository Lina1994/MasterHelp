import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MapsService } from './maps.service';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UpdateFogDto } from './dto/update-fog.dto';

@UseGuards(JwtAuthGuard)
@Controller('maps')
export class MapsController {
  constructor(private readonly service: MapsService) {}

  /**
   * Lista los mapas del usuario autenticado, opcionalmente filtrados por campaña activa.
   * - Requiere JWT (JwtAuthGuard a nivel de controlador).
   * - Siempre filtra por propietario = usuario.
   * - Si se pasa campaignId, restringe a los mapas asociados a esa campaña.
   */
  @Get()
  async list(@Req() req, @Query('q') q?: string, @Query('campaignId') campaignId?: string) {
    return this.service.listOwned(req.user, q, campaignId);
  }

  /** Aggregated storage usage for maps (sum of image variants + legacy + skylines) and map count. */
  @Get('usage')
  async getUsage(@Req() req, @Query('campaignId') campaignId?: string) {
    return this.service.getUsage(req.user, campaignId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Req() req,
    @Body() dto: CreateMapDto,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  ) {
    try {
      const debugDto: any = {
        name: dto?.name,
        description: dto?.description,
        campaignId: dto?.campaignId,
        group: dto?.group,
        timeOfDay: (dto as any)?.timeOfDay,
        isWorldMap: (dto as any)?.isWorldMap,
        musicConfigType: dto && typeof dto['musicConfig'],
        sfxConfigType: dto && typeof dto['sfxConfig'],
        hasFile: !!file,
        fileMime: file?.mimetype,
        fileSize: file?.size,
        contentType: req.headers['content-type'],
      };
      // eslint-disable-next-line no-console
      console.log('[MapsController] POST /maps dto debug ->', debugDto);
      return await this.service.create(req.user, dto, file);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MapsController] create error:', err);
      throw err;
    }
  }

  // Bulk create: multiple files in "files" field; optional campaignId in body for association
  @Post('bulk')
  @UseInterceptors(FilesInterceptor('files'))
  async createBulk(
    @Req() req,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname?: string }>,
    @Body('campaignId') campaignId?: string,
  ) {
    return this.service.createBulk(req.user, files || [], campaignId);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateMapDto,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
    @Query('imageTimeOfDay') imageTimeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night',
  ) {
    // Debug: log incoming DTO shape to diagnose 400s from validation
    try {
      // Be careful not to log big binary files
      const debugDto: any = {
        name: dto?.name,
        description: dto?.description,
        campaignId: dto?.campaignId,
        group: dto?.group,
        timeOfDay: (dto as any)?.timeOfDay,
        isWorldMap: (dto as any)?.isWorldMap,
        musicConfigType: dto && typeof dto['musicConfig'],
        sfxConfigType: dto && typeof dto['sfxConfig'],
        hasFile: !!file,
        fileMime: file?.mimetype,
        fileSize: file?.size,
        contentType: req.headers['content-type'],
        imageTimeOfDay,
      };
      // eslint-disable-next-line no-console
      console.log('[MapsController] PATCH /maps/:id dto debug ->', debugDto);
      // To remove image, send file placeholder as explicit null is not possible in multipart; expose separate remove-image endpoint if needed.
      return await this.service.update(req.user, id, dto, file, (imageTimeOfDay && ['dawn','morning','afternoon','night'].includes(imageTimeOfDay) ? imageTimeOfDay : null) as any);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MapsController] update error:', err);
      throw err;
    }
  }

  @Delete(':id')
  async remove(@Req() req, @Param('id') id: string) {
    return this.service.remove(req.user, id);
  }

  @Get(':id/image')
  async streamImage(
    @Req() req,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('size') size?: 'thumb' | 'preview' | 'full',
    @Query('timeOfDay') timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night',
    @Query('strict') strict?: string,
  ) {
    // eslint-disable-next-line no-console
    console.log('[MapsController] GET /maps/:id/image', { id, size, timeOfDay, strict });
    const img = await this.service.streamImage(req.user, id, size, timeOfDay ?? null, strict === '1' || strict === 'true');
    res.setHeader('Content-Type', img.mimeType);
    res.setHeader('Content-Length', img.buffer.length.toString());
    res.setHeader('Cache-Control', 'no-store');
    res.end(img.buffer);
  }

  // SKYLINE endpoints
  @Get(':id/skyline')
  async streamSkyline(
    @Req() req,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('size') size?: 'thumb' | 'preview' | 'full',
    @Query('timeOfDay') timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night',
    @Query('strict') strict?: string,
  ) {
    console.log('[MapsController] GET /maps/:id/skyline', { id, size, timeOfDay, strict });
    const img = await this.service.streamSkyline(req.user, id, size, timeOfDay ?? null, strict === '1' || strict === 'true');
    res.setHeader('Content-Type', img.mimeType);
    res.setHeader('Content-Length', img.buffer.length.toString());
    res.setHeader('Cache-Control', 'no-store');
    res.end(img.buffer);
  }

  /** Uploads a new skyline image to be used for a specific time-of-day without altering other TOD skyline images. */
  @Post(':id/skyline')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSkylineForTod(
    @Req() req,
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
    @Query('timeOfDay') timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night',
  ) {
    console.log('[MapsController] POST /maps/:id/skyline', { id, timeOfDay, fileSize: file?.size, fileMime: file?.mimetype });
    if (!file) return { ok: false, message: 'Missing file' };
    if (!timeOfDay || !['dawn','morning','afternoon','night'].includes(timeOfDay)) {
      return { ok: false, message: 'Invalid or missing timeOfDay' };
    }
    await this.service.uploadSkylineForTod(req.user, id, file, timeOfDay as any);
    return { ok: true };
  }

  /** Uploads a new image to be used for a specific time-of-day without altering other TOD images. */
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImageForTod(
    @Req() req,
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
    @Query('timeOfDay') timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night',
  ) {
    // eslint-disable-next-line no-console
    console.log('[MapsController] POST /maps/:id/image', { id, timeOfDay, fileSize: file?.size, fileMime: file?.mimetype });
    if (!file) return { ok: false, message: 'Missing file' };
    if (!timeOfDay || !['dawn','morning','afternoon','night'].includes(timeOfDay)) {
      return { ok: false, message: 'Invalid or missing timeOfDay' };
    }
    await this.service.uploadImageForTod(req.user, id, file, timeOfDay as any);
    return { ok: true };
  }

  /**
   * Returns Fog of War cells for the given campaign+map, scoped to the authenticated owner.
   */
  @Get(':id/fog')
  async getFog(
    @Req() req,
    @Param('id') id: string,
    @Query('campaignId') campaignId: string,
  ) {
    return { cells: await this.service.getFog(req.user, id, campaignId) };
  }

  /**
   * Sets Fog of War cells for the given campaign+map. Upserts the state.
   */
  @Patch(':id/fog')
  async setFog(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateFogDto,
  ) {
    return this.service.setFog(req.user, id, dto.campaignId, dto.cells);
  }
}
