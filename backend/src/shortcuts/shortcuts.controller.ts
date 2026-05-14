import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateShortcutDto } from './dto/create-shortcut.dto';
import { UpdateShortcutDto } from './dto/update-shortcut.dto';
import { ShortcutsService } from './shortcuts.service';

/**
 * Controller exposing CRUD and execution for user-owned shortcuts.
 */
@ApiTags('shortcuts')
@Controller('shortcuts')
@UseGuards(JwtAuthGuard)
export class ShortcutsController {
  constructor(private readonly shortcutsService: ShortcutsService) {}

  private readonly shortcutsUploadDir = join(process.cwd(), 'uploads', 'shortcuts');

  /**
   * Ensures shortcut upload directory exists before storing files.
   */
  private ensureShortcutsUploadDir(): void {
    if (!existsSync(this.shortcutsUploadDir)) {
      mkdirSync(this.shortcutsUploadDir, { recursive: true });
    }
  }

  /**
   * Sube una imagen/gif para usar como icono de shortcut. Devuelve la URL pública.
   */
  @Post('upload-icon')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = join(process.cwd(), 'uploads', 'shortcuts');
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        // Nombre único: timestamp + random + extensión
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, unique + extname(file.originalname));
      },
    }),
    fileFilter: (req, file, cb) => {
      // Solo imágenes/gif
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Solo se permiten imágenes'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  }))
  async uploadIcon(@UploadedFile() file: Express.Multer.File) {
    this.ensureShortcutsUploadDir();
    if (!file) {
      throw new BadRequestException('No se subió ningún archivo');
    }
    // URL pública relativa
    const url = `/uploads/shortcuts/${file.filename}`;
    return { url };
  }

  @Get()
  async findAll(@Request() req, @Query('campaignId') campaignId?: string) {
    return this.shortcutsService.findAllForOwner(req.user.userId, campaignId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.shortcutsService.findOneForOwner(id, req.user.userId);
  }

  @Post()
  async create(@Request() req, @Body() dto: CreateShortcutDto) {
    return this.shortcutsService.createForOwner(req.user.userId, dto);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateShortcutDto) {
    return this.shortcutsService.updateForOwner(id, req.user.userId, dto);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.shortcutsService.removeForOwner(id, req.user.userId);
    return { success: true };
  }

  @Post(':id/execute')
  async execute(@Request() req, @Param('id') id: string) {
    return this.shortcutsService.executeForOwner(id, req.user.userId);
  }
}