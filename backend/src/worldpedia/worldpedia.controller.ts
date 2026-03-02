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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorldpediaService } from './worldpedia.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { MoveNoteDto } from './dto/move-note.dto';
import { ImportWorldpediaDto } from './dto/import-worldpedia.dto';
import { ReorderWorldpediaDto } from './dto/reorder-worldpedia.dto';

/**
 * REST controller for the Worldpedia module.
 *
 * All endpoints require JWT authentication.  Access is restricted to
 * campaign masters via service-level checks.
 */
@Controller('worldpedia')
@UseGuards(JwtAuthGuard)
export class WorldpediaController {
  constructor(private readonly worldpediaService: WorldpediaService) {}

  /* ═══════════════════════════ TREE ══════════════════════════════════ */

  /**
   * Return the folder / note tree for a campaign.
   */
  @Get('campaigns/:campaignId/tree')
  async getTree(@Param('campaignId') campaignId: string, @Req() req: any) {
    return this.worldpediaService.getTree(campaignId, req.user.userId);
  }

  /* ═══════════════════════════ FOLDERS ═══════════════════════════════ */

  /**
   * Create a folder.
   */
  @Post('campaigns/:campaignId/folders')
  async createFolder(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateFolderDto,
    @Req() req: any,
  ) {
    return this.worldpediaService.createFolder(campaignId, req.user.userId, dto);
  }

  /**
   * Update a folder (name / position).
   */
  @Patch('campaigns/:campaignId/folders/:folderId')
  async updateFolder(
    @Param('campaignId') campaignId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
    @Req() req: any,
  ) {
    return this.worldpediaService.updateFolder(campaignId, folderId, req.user.userId, dto);
  }

  /**
   * Delete a folder (notes are moved to root).
   */
  @Delete('campaigns/:campaignId/folders/:folderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFolder(
    @Param('campaignId') campaignId: string,
    @Param('folderId') folderId: string,
    @Req() req: any,
  ) {
    await this.worldpediaService.deleteFolder(campaignId, folderId, req.user.userId);
  }

  /* ═══════════════════════════ NOTES ═════════════════════════════════ */

  /**
   * Create a note.
   */
  @Post('campaigns/:campaignId/notes')
  async createNote(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: any,
  ) {
    return this.worldpediaService.createNote(campaignId, req.user.userId, dto);
  }

  /**
   * Get a single note with links and backlinks.
   */
  @Get('campaigns/:campaignId/notes/:noteId')
  async getNote(
    @Param('campaignId') campaignId: string,
    @Param('noteId') noteId: string,
    @Req() req: any,
  ) {
    return this.worldpediaService.getNote(campaignId, noteId, req.user.userId);
  }

  /**
   * Update a note (title, html, folder, position, links).
   */
  @Patch('campaigns/:campaignId/notes/:noteId')
  async updateNote(
    @Param('campaignId') campaignId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
    @Req() req: any,
  ) {
    return this.worldpediaService.updateNote(campaignId, noteId, req.user.userId, dto);
  }

  /**
   * Delete a note.
   */
  @Delete('campaigns/:campaignId/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNote(
    @Param('campaignId') campaignId: string,
    @Param('noteId') noteId: string,
    @Req() req: any,
  ) {
    await this.worldpediaService.deleteNote(campaignId, noteId, req.user.userId);
  }

  /**
   * Move a note to another folder (or to root).
   */
  @Patch('campaigns/:campaignId/notes/:noteId/move')
  async moveNote(
    @Param('campaignId') campaignId: string,
    @Param('noteId') noteId: string,
    @Body() dto: MoveNoteDto,
    @Req() req: any,
  ) {
    return this.worldpediaService.moveNote(campaignId, noteId, req.user.userId, dto);
  }

  /* ═══════════════════════════ REORDER ════════════════════════════════ */

  /**
   * Batch-update positions of folders and/or notes after drag-and-drop.
   */
  @Patch('campaigns/:campaignId/reorder')
  async reorder(
    @Param('campaignId') campaignId: string,
    @Body() dto: ReorderWorldpediaDto,
    @Req() req: any,
  ) {
    return this.worldpediaService.reorder(campaignId, req.user.userId, dto);
  }

  /* ═══════════════════════════ SEARCH ════════════════════════════════ */

  /**
   * Search notes by title / content.
   */
  @Get('campaigns/:campaignId/search')
  async search(
    @Param('campaignId') campaignId: string,
    @Query('q') query: string,
    @Req() req: any,
  ) {
    return this.worldpediaService.searchNotes(campaignId, req.user.userId, query ?? '');
  }

  /* ═══════════════════════════ LINKS ═════════════════════════════════ */

  /**
   * Return outgoing links + backlinks for a note.
   */
  @Get('campaigns/:campaignId/notes/:noteId/links')
  async getNoteLinks(
    @Param('campaignId') campaignId: string,
    @Param('noteId') noteId: string,
    @Req() req: any,
  ) {
    return this.worldpediaService.getNoteLinks(campaignId, noteId, req.user.userId);
  }

  /* ═══════════════════════════ EXPORT ════════════════════════════════ */

  /**
   * Export the entire Worldpedia.
   */
  @Get('campaigns/:campaignId/export')
  async exportAll(@Param('campaignId') campaignId: string, @Req() req: any) {
    return this.worldpediaService.exportAll(campaignId, req.user.userId);
  }

  /**
   * Export a single folder with its notes.
   */
  @Get('campaigns/:campaignId/export/folders/:folderId')
  async exportFolder(
    @Param('campaignId') campaignId: string,
    @Param('folderId') folderId: string,
    @Req() req: any,
  ) {
    return this.worldpediaService.exportFolder(campaignId, folderId, req.user.userId);
  }

  /**
   * Export a single note.
   */
  @Get('campaigns/:campaignId/export/notes/:noteId')
  async exportNote(
    @Param('campaignId') campaignId: string,
    @Param('noteId') noteId: string,
    @Req() req: any,
  ) {
    return this.worldpediaService.exportNote(campaignId, noteId, req.user.userId);
  }

  /* ═══════════════════════════ IMPORT ════════════════════════════════ */

  /**
   * Import Worldpedia data into a campaign.
   */
  @Post('campaigns/:campaignId/import')
  async importData(
    @Param('campaignId') campaignId: string,
    @Body() dto: ImportWorldpediaDto,
    @Req() req: any,
  ) {
    return this.worldpediaService.importData(campaignId, req.user.userId, dto);
  }
}
