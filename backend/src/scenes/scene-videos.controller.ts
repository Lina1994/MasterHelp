import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSceneVideoDto } from './dto/create-scene-video.dto';
import { GenerateSceneVideoStreamUrlDto } from './dto/generate-scene-video-stream-url.dto';
import { SceneVideosService } from './scene-videos.service';

/**
 * Controller exposing scene video asset upload, listing and streaming endpoints.
 */
@ApiTags('scenes-videos')
@Controller('scenes/videos')
export class SceneVideosController {
  constructor(private readonly sceneVideosService: SceneVideosService) {}

  /**
   * Uploads one scene video asset for the authenticated user.
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const tmpDir = join(process.cwd(), 'data', 'tmp', 'scene-videos');
          if (!existsSync(tmpDir)) {
            mkdirSync(tmpDir, { recursive: true });
          }
          cb(null, tmpDir);
        },
        filename: (req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, unique);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype?.startsWith('video/')) {
          return cb(new BadRequestException('Only video files are allowed'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 1024 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @Req() req,
    @Body() dto: CreateSceneVideoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.sceneVideosService.createForOwner(req.user.userId, dto, file);
  }

  /**
   * Lists scene video assets visible to the authenticated user.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req, @Query('campaignId') campaignId?: string) {
    return this.sceneVideosService.listForOwner(req.user.userId, campaignId);
  }

  /**
   * Returns one owned scene video metadata record.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Req() req, @Param('id') id: string) {
    return this.sceneVideosService.findOneForOwner(id, req.user.userId);
  }

  /**
   * Deletes one owned scene video asset.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Req() req, @Param('id') id: string) {
    await this.sceneVideosService.removeForOwner(id, req.user.userId);
    return { success: true };
  }

  /**
   * Creates a temporary signed stream URL for one scene video.
   */
  @Post(':id/signed-stream-url')
  @UseGuards(JwtAuthGuard)
  async createSignedStreamUrl(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: GenerateSceneVideoStreamUrlDto,
  ) {
    return this.sceneVideosService.createSignedStreamUrlForOwner(id, req.user.userId, dto.ttlSeconds);
  }

  /**
   * Streams one scene video using a signed URL token, supporting HTTP range requests.
   */
  @Get(':id/stream')
  async stream(
    @Param('id') id: string,
    @Query('uid') uid: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Req() req,
    @Res() res: Response,
  ) {
    const ownerId = Number(uid);
    const expiresAt = Number(expires);
    const signature = String(sig || '');

    if (!Number.isInteger(ownerId) || ownerId <= 0) {
      throw new BadRequestException('Invalid uid query parameter');
    }

    const video = await this.sceneVideosService.getVideoForSignedStream(id, ownerId, expiresAt, signature);
    const absolutePath = await this.sceneVideosService.resolveAbsoluteVideoPath(video.relativePath);
    const total = await this.sceneVideosService.getFileSize(absolutePath);
    const rangeHeader = req.headers.range as string | undefined;

    if (rangeHeader) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      const start = match && match[1] ? Number(match[1]) : 0;
      const end = match && match[2] ? Number(match[2]) : Math.min(start + 1_048_576, total - 1);

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
        res.status(416).set({ 'Content-Range': `bytes */${total}` }).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': video.mimeType,
        'Cache-Control': 'no-store',
      });
      this.sceneVideosService.createReadStreamForRange(absolutePath, start, end).pipe(res);
      return;
    }

    res.status(200).set({
      'Content-Length': String(total),
      'Content-Type': video.mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    this.sceneVideosService.createReadStreamForRange(absolutePath).pipe(res);
  }
}
