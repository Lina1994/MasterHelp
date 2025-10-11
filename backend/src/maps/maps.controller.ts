import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MapsService } from './maps.service';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('maps')
export class MapsController {
  constructor(private readonly service: MapsService) {}

  @Get()
  async list(@Req() req, @Query('q') q?: string, @Query('campaignId') campaignId?: string) {
    return this.service.listOwned(req.user, q, campaignId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Req() req,
    @Body() dto: CreateMapDto,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  ) {
    return this.service.create(req.user, dto, file);
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
  ) {
    // To remove image, send file placeholder as explicit null is not possible in multipart; expose separate remove-image endpoint if needed.
    return this.service.update(req.user, id, dto, file);
  }

  @Delete(':id')
  async remove(@Req() req, @Param('id') id: string) {
    return this.service.remove(req.user, id);
  }

  @Get(':id/image')
  async streamImage(@Req() req, @Param('id') id: string, @Res() res: Response, @Query('size') size?: 'thumb' | 'preview' | 'full') {
    const img = await this.service.streamImage(req.user, id, size);
    res.setHeader('Content-Type', img.mimeType);
    res.setHeader('Content-Length', img.buffer.length.toString());
    res.setHeader('Cache-Control', 'no-store');
    res.end(img.buffer);
  }
}
