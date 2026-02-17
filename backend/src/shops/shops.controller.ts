import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtQueryAuthGuard } from '../auth/guards/jwt-query-auth.guard';
import { ShopsService } from './shops.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { Response } from 'express';

@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  // ===== SHOPS =====

  @UseGuards(JwtAuthGuard)
  @Get()
  async listShops(@Req() req, @Query('campaignId') campaignId: string) {
    return this.shopsService.listShops(req.user.userId, campaignId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':shopId')
  async getShop(@Req() req, @Param('shopId') shopId: string) {
    return this.shopsService.getShop(req.user.userId, shopId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createShop(@Req() req, @Body() dto: CreateShopDto) {
    return this.shopsService.createShop(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':shopId')
  async updateShop(@Req() req, @Param('shopId') shopId: string, @Body() dto: UpdateShopDto) {
    return this.shopsService.updateShop(req.user.userId, shopId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':shopId')
  async deleteShop(@Req() req, @Param('shopId') shopId: string) {
    await this.shopsService.deleteShop(req.user.userId, shopId);
    return { success: true };
  }

  // ===== SECTIONS =====

  @UseGuards(JwtAuthGuard)
  @Post(':shopId/sections')
  async createSection(@Req() req, @Param('shopId') shopId: string, @Body() dto: CreateSectionDto) {
    return this.shopsService.createSection(req.user.userId, shopId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('sections/:sectionId')
  async updateSection(@Req() req, @Param('sectionId') sectionId: string, @Body() dto: UpdateSectionDto) {
    return this.shopsService.updateSection(req.user.userId, sectionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sections/:sectionId')
  async deleteSection(@Req() req, @Param('sectionId') sectionId: string) {
    await this.shopsService.deleteSection(req.user.userId, sectionId);
    return { success: true };
  }

  // ===== COLUMNS =====

  @UseGuards(JwtAuthGuard)
  @Post('sections/:sectionId/columns')
  async createColumn(@Req() req, @Param('sectionId') sectionId: string, @Body() dto: CreateColumnDto) {
    return this.shopsService.createColumn(req.user.userId, sectionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('columns/:columnId')
  async updateColumn(@Req() req, @Param('columnId') columnId: string, @Body() dto: UpdateColumnDto) {
    return this.shopsService.updateColumn(req.user.userId, columnId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('columns/:columnId')
  async deleteColumn(@Req() req, @Param('columnId') columnId: string) {
    await this.shopsService.deleteColumn(req.user.userId, columnId);
    return { success: true };
  }

  // ===== ENTRIES =====

  @UseGuards(JwtAuthGuard)
  @Post('sections/:sectionId/entries')
  async createEntry(@Req() req, @Param('sectionId') sectionId: string, @Body() dto: CreateEntryDto) {
    return this.shopsService.createEntry(req.user.userId, sectionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('entries/:entryId')
  async updateEntry(@Req() req, @Param('entryId') entryId: string, @Body() dto: UpdateEntryDto) {
    return this.shopsService.updateEntry(req.user.userId, entryId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('entries/:entryId')
  async deleteEntry(@Req() req, @Param('entryId') entryId: string) {
    await this.shopsService.deleteEntry(req.user.userId, entryId);
    return { success: true };
  }

  // ===== CELLS =====

  @UseGuards(JwtAuthGuard)
  @Post('entries/:entryId/cells/:columnId/media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCellMedia(
    @Req() req,
    @Param('entryId') entryId: string,
    @Param('columnId') columnId: string,
    @Body('url') url?: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.shopsService.uploadCellMedia(req.user.userId, entryId, columnId, file, url);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('cells/:cellId/text')
  async updateCellText(@Req() req, @Param('cellId') cellId: string, @Body('textValue') textValue: string) {
    return this.shopsService.updateCellText(req.user.userId, cellId, textValue);
  }

  @UseGuards(JwtQueryAuthGuard)
  @Get('cells/:cellId/stream')
  async streamCell(@Req() req, @Param('cellId') cellId: string, @Res() res: Response) {
    const cell = await this.shopsService.getCellForStreaming(req.user.userId, cellId);
    
    const range = req.headers['range'];
    const buffer = cell.blobData;
    const total = buffer.length;

    if (range) {
      // Partial content for video/audio streaming
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : total - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': cell.mimeType || 'application/octet-stream',
      });

      res.end(buffer.slice(start, end + 1));
    } else {
      // Full content
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': cell.mimeType || 'application/octet-stream',
      });
      res.end(buffer);
    }
  }

  // ===== SEARCH =====

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchEntries(@Req() req, @Query('campaignId') campaignId: string, @Query('q') query: string) {
    if (!query || !campaignId) {
      return [];
    }
    return this.shopsService.searchEntries(req.user.userId, campaignId, query);
  }
}
