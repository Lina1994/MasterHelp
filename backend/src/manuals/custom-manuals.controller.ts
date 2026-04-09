import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomManualsService } from './custom-manuals.service';
import { CreateManualDto } from './dto/create-manual.dto';
import { UpdateManualDto } from './dto/update-manual.dto';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { UpdateManualEntryDto } from './dto/update-manual-entry.dto';
import { ImportManualDto } from './dto/import-manual.dto';
import type { ManualEntryType } from './entities/manual-entry.entity';

/**
 * REST controller for user-created custom manuals stored in the database.
 *
 * All endpoints require JWT authentication.  Only the manual owner can
 * create, update, or delete manuals and their entries.
 */
@Controller('custom-manuals')
@UseGuards(JwtAuthGuard)
export class CustomManualsController {
  constructor(private readonly service: CustomManualsService) {}

  /* ═══════════════════════════ MANUAL CRUD ═══════════════════════════ */

  /**
   * Create a new custom manual.
   */
  @Post()
  async create(@Body() dto: CreateManualDto, @Req() req: any) {
    return this.service.create(req.user.userId, dto);
  }

  /**
   * List all custom manuals belonging to the authenticated user.
   */
  @Get()
  async findAll(@Req() req: any) {
    return this.service.findAllByUser(req.user.userId);
  }

  /**
   * Get a single manual by ID.
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.userId);
  }

  /**
   * Update manual metadata.
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateManualDto, @Req() req: any) {
    return this.service.update(id, req.user.userId, dto);
  }

  /**
   * Delete a manual and all its entries.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.service.remove(id, req.user.userId);
  }

  /* ═══════════════════════════ ENTRY CRUD ════════════════════════════ */

  /**
   * Add a new entry to a manual.
   */
  @Post(':id/entries')
  async addEntry(
    @Param('id') manualId: string,
    @Body() dto: CreateManualEntryDto,
    @Req() req: any,
  ) {
    return this.service.addEntry(manualId, req.user.userId, dto);
  }

  /**
   * List entries of a manual, optionally filtered by type and language.
   */
  @Get(':id/entries')
  async getEntries(
    @Param('id') manualId: string,
    @Query('type') entryType?: ManualEntryType,
    @Query('lang') lang?: string,
  ) {
    return this.service.getEntries(manualId, entryType, lang);
  }

  /**
   * Get a single entry by its ID.
   */
  @Get(':id/entries/:entryId')
  async getEntry(
    @Param('id') manualId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.service.getEntryById(manualId, entryId);
  }

  /**
   * Update an existing entry.
   */
  @Patch(':id/entries/:entryId')
  async updateEntry(
    @Param('id') manualId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateManualEntryDto,
    @Req() req: any,
  ) {
    return this.service.updateEntry(manualId, entryId, req.user.userId, dto);
  }

  /**
   * Delete an entry.
   */
  @Delete(':id/entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeEntry(
    @Param('id') manualId: string,
    @Param('entryId') entryId: string,
    @Req() req: any,
  ) {
    await this.service.removeEntry(manualId, entryId, req.user.userId);
  }

  /* ═══════════════════════════ COVER IMAGE ═════════════════════════════ */

  /**
   * Upload or replace the cover image of a manual.
   * Accepts multipart form-data with a single file field named "file".
   */
  @Post(':id/cover')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async uploadCover(
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    await this.service.uploadCover(id, req.user.userId, file.buffer, file.mimetype);
  }

  /**
   * Stream the cover image of a manual. No ownership required (any
   * authenticated user may view it, e.g. from the manuals list).
   */
  @Get(':id/cover')
  async getCover(@Param('id') id: string, @Res() res: Response) {
    const cover = await this.service.getCover(id);
    if (!cover) {
      res.status(HttpStatus.NOT_FOUND).json({ message: 'No cover image' });
      return;
    }
    res.setHeader('Content-Type', cover.mimeType);
    res.setHeader('Content-Length', cover.buffer.length.toString());
    res.setHeader('Cache-Control', 'no-store');
    res.end(cover.buffer);
  }

  /**
   * Remove the cover image from a manual.
   */
  @Delete(':id/cover')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCover(@Param('id') id: string, @Req() req: any) {
    await this.service.removeCover(id, req.user.userId);
  }

  /* ═══════════════════════════ IMPORT / EXPORT ═══════════════════════ */

  /**
   * Export a manual as a JSON download.
   */
  @Get(':id/export')
  async exportManual(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const payload = await this.service.exportManual(id, req.user.userId);
    const filename = `manual-${payload.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  }

  /**
   * Import a manual from a JSON payload.
   */
  @Post('import')
  async importManual(@Body() dto: ImportManualDto, @Req() req: any) {
    return this.service.importManual(req.user.userId, dto);
  }
}
