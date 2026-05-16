import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash, randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, rename, stat, unlink } from 'fs/promises';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'path';
import { CreateSceneVideoClipDto } from './dto/create-scene-video-clip.dto';
import { CreateSceneVideoDto } from './dto/create-scene-video.dto';
import { UpdateSceneVideoDto } from './dto/update-scene-video.dto';
import { SceneVideo } from './entities/scene-video.entity';
import { ScenesRepository } from './scenes.repository';
import { SceneVideosRepository } from './scene-videos.repository';

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
]);

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;
const MAX_SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Scene video asset application service.
 */
@Injectable()
export class SceneVideosService {
  private readonly logger = new Logger(SceneVideosService.name);

  constructor(
    private readonly sceneVideosRepository: SceneVideosRepository,
    private readonly scenesRepository: ScenesRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns all visible scene video assets for the owner.
   */
  async listForOwner(ownerId: number, campaignId?: string): Promise<SceneVideo[]> {
    return this.sceneVideosRepository.findAllByOwner(ownerId, campaignId ?? null);
  }

  /**
   * Returns one owned scene video asset.
   */
  async findOneForOwner(id: string, ownerId: number): Promise<SceneVideo> {
    const video = await this.sceneVideosRepository.findByIdForOwner(id, ownerId);
    if (!video) {
      throw new NotFoundException(`Scene video with ID "${id}" not found`);
    }
    return video;
  }

  /**
   * Updates mutable metadata for one owned scene video.
   */
  async updateMetadataForOwner(
    id: string,
    ownerId: number,
    dto: UpdateSceneVideoDto,
  ): Promise<SceneVideo> {
    const video = await this.findOneForOwner(id, ownerId);

    const nextName = dto.name === undefined ? video.name : dto.name.trim();
    if (!nextName || nextName.length < 1 || nextName.length > 120) {
      throw new BadRequestException('Scene video name must be between 1 and 120 characters');
    }

    if (nextName.toLowerCase() !== video.name.trim().toLowerCase()) {
      const conflict = await this.sceneVideosRepository.findByNameForOwnerAndScope(
        ownerId,
        nextName,
        video.campaign?.id ?? null,
        video.id,
      );
      if (conflict) {
        throw new BadRequestException('A scene video with this name already exists in this scope');
      }
    }

    video.name = nextName;
    if (dto.description !== undefined) {
      const nextDescription = dto.description.trim();
      video.description = nextDescription || null;
    }

    return this.sceneVideosRepository.save(video);
  }

  /**
   * Schedules one asynchronous clip derivation job from an existing owned source video.
   *
   * @param sourceVideoId ID of the source scene video asset.
   * @param ownerId Authenticated owner ID.
   * @param dto Clip boundaries and optional clip name.
   * @returns Newly created derived asset metadata in processing state.
   */
  async createClipForOwner(
    sourceVideoId: string,
    ownerId: number,
    dto: CreateSceneVideoClipDto,
  ): Promise<SceneVideo> {
    const sourceVideo = await this.findOneForOwner(sourceVideoId, ownerId);
    if (sourceVideo.processingStatus !== 'ready') {
      throw new BadRequestException('Source video is not ready for clip derivation');
    }

    const startSec = Number(dto.startSec);
    const endSec = Number(dto.endSec);
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec <= startSec) {
      throw new BadRequestException('Invalid clip range: endSec must be greater than startSec');
    }

    const maxDurationSec = typeof sourceVideo.durationMs === 'number' && sourceVideo.durationMs > 0
      ? sourceVideo.durationMs / 1000
      : undefined;
    if (maxDurationSec !== undefined && endSec > maxDurationSec + 0.05) {
      throw new BadRequestException('Clip end exceeds source media duration');
    }

    const storageRoot = await this.ensureStorageRoot();
    const ownerFolder = join(storageRoot, String(ownerId));
    await mkdir(ownerFolder, { recursive: true });

    const generatedName = `${Date.now()}-${randomUUID()}-clip.mp4`;
    const finalPath = join(ownerFolder, generatedName);
    const relativePath = this.toStorageRelativePath(storageRoot, finalPath);
    const derivedDurationMs = Math.max(1, Math.round((endSec - startSec) * 1000));

    const requestedName = dto.name?.trim();
    const clipName = requestedName || `${sourceVideo.name} (clip ${startSec.toFixed(2)}s-${endSec.toFixed(2)}s)`;

    const clip = this.sceneVideosRepository.create({
      name: clipName,
      description: sourceVideo.description,
      originalFilename: `${sourceVideo.originalFilename.replace(/\.[^.]+$/, '') || 'clip'}-clip.mp4`,
      mimeType: 'video/mp4',
      size: 0,
      checksumSha256: '',
      relativePath,
      durationMs: derivedDurationMs,
      width: sourceVideo.width,
      height: sourceVideo.height,
      processingStatus: 'processing',
      processingError: null,
      derivationType: 'clip',
      parentVideo: sourceVideo,
      parentVideoId: sourceVideo.id,
      sourceStartSec: startSec,
      sourceEndSec: endSec,
      owner: this.sceneVideosRepository.createOwnerReference(ownerId),
      campaign: sourceVideo.campaign,
    });

    const savedClip = await this.sceneVideosRepository.save(clip);
    void this.processClipDerivationJob(savedClip.id, ownerId, sourceVideo.relativePath, finalPath, startSec, endSec);
    return savedClip;
  }

  /**
   * Returns derivation/progress fields for one owned scene video asset.
   *
   * @param id Scene video ID.
   * @param ownerId Authenticated owner ID.
   * @returns Current processing and derivation metadata.
   */
  async getDerivationStatusForOwner(id: string, ownerId: number): Promise<{
    id: string;
    processingStatus: SceneVideo['processingStatus'];
    processingError: string | null;
    derivationType: SceneVideo['derivationType'];
    parentVideoId: string | null;
    sourceStartSec: number | null;
    sourceEndSec: number | null;
    updatedAt: Date;
  }> {
    const video = await this.findOneForOwner(id, ownerId);
    return {
      id: video.id,
      processingStatus: video.processingStatus,
      processingError: video.processingError,
      derivationType: video.derivationType,
      parentVideoId: video.parentVideoId,
      sourceStartSec: video.sourceStartSec,
      sourceEndSec: video.sourceEndSec,
      updatedAt: video.updatedAt,
    };
  }

  /**
   * Creates a new scene video asset from uploaded file metadata and temp path.
   */
  async createForOwner(
    ownerId: number,
    dto: CreateSceneVideoDto,
    file: Express.Multer.File,
  ): Promise<SceneVideo> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    this.assertAllowedMimeType(file.mimetype);

    const targetCampaignId = dto.campaignId ?? null;
    if (targetCampaignId) {
      const campaign = await this.scenesRepository.findCampaignById(targetCampaignId);
      if (!campaign) {
        throw new NotFoundException(`Campaign with ID "${targetCampaignId}" not found`);
      }
      const isMember = await this.scenesRepository.isCampaignMember(targetCampaignId, ownerId);
      if (!isMember) {
        throw new ForbiddenException('You are not a member of this campaign');
      }
    }

    const storageRoot = await this.ensureStorageRoot();
    const ownerFolder = join(storageRoot, String(ownerId));
    await mkdir(ownerFolder, { recursive: true });

    const safeExt = extname(file.originalname || '').slice(0, 10).toLowerCase();
    const generatedName = `${Date.now()}-${randomUUID()}${safeExt || '.bin'}`;
    const finalPath = join(ownerFolder, generatedName);

    await rename(file.path, finalPath);

    const checksumSha256 = await this.calculateFileSha256(finalPath);
    const relativePath = this.toStorageRelativePath(storageRoot, finalPath);

    const video = this.sceneVideosRepository.create({
      name: dto.name?.trim() || file.originalname || generatedName,
      description: dto.description?.trim() ?? null,
      originalFilename: file.originalname || generatedName,
      mimeType: file.mimetype,
      size: file.size,
      checksumSha256,
      relativePath,
      durationMs: null,
      width: null,
      height: null,
      processingStatus: 'ready',
      processingError: null,
      owner: this.sceneVideosRepository.createOwnerReference(ownerId),
      campaign: targetCampaignId
        ? this.sceneVideosRepository.createCampaignReference(targetCampaignId)
        : null,
    });

    return this.sceneVideosRepository.save(video);
  }

  /**
   * Deletes one owned scene video if it is not currently referenced by scene actions.
   */
  async removeForOwner(id: string, ownerId: number): Promise<void> {
    const video = await this.findOneForOwner(id, ownerId);

    const derivedCount = await this.sceneVideosRepository.countDerivedByParentForOwner(id, ownerId);
    if (derivedCount > 0) {
      throw new BadRequestException('This video has derived clips and cannot be deleted');
    }

    const scenes = await this.scenesRepository.findAllOwned(ownerId);
    const isReferenced = scenes.some((scene) =>
      scene.actions.some((action: any) => action?.type === 'sendVideoToWindow' && action?.payload?.videoAssetId === id),
    );

    if (isReferenced) {
      throw new BadRequestException('This video is used by one or more scenes and cannot be deleted');
    }

    const absolutePath = await this.resolveAbsoluteVideoPath(video.relativePath);
    await this.sceneVideosRepository.remove(video);

    if (existsSync(absolutePath)) {
      await unlink(absolutePath);
    }
  }

  /**
   * Creates a temporary signed stream URL for a scene video.
   */
  async createSignedStreamUrlForOwner(
    videoId: string,
    ownerId: number,
    ttlSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<{ url: string; expiresAt: number }> {
    await this.findOneForOwner(videoId, ownerId);

    const cappedTtl = Math.max(30, Math.min(MAX_SIGNED_URL_TTL_SECONDS, ttlSeconds));
    const expiresAt = Math.floor(Date.now() / 1000) + cappedTtl;
    const signature = this.signStreamToken(videoId, ownerId, expiresAt);

    return {
      url: `/scenes/videos/${videoId}/stream?uid=${ownerId}&expires=${expiresAt}&sig=${signature}`,
      expiresAt,
    };
  }

  /**
   * Resolves payload for runtime command emission.
   */
  async resolveRuntimeVideoPayload(
    ownerId: number,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const videoAssetId = typeof payload.videoAssetId === 'string' ? payload.videoAssetId.trim() : '';
    const videoUrl = typeof payload.videoUrl === 'string' ? payload.videoUrl.trim() : '';

    if (!videoAssetId && !videoUrl) {
      throw new BadRequestException('sendVideoToWindow requires videoAssetId or videoUrl');
    }

    if (!videoAssetId) {
      return payload;
    }

    const video = await this.findOneForOwner(videoAssetId, ownerId);
    const currentDurationMs = Number(payload.durationMs);
    const shouldInjectDuration = (!Number.isFinite(currentDurationMs) || currentDurationMs <= 0)
      && typeof video.durationMs === 'number'
      && Number.isFinite(video.durationMs)
      && video.durationMs > 0;

    const signed = await this.createSignedStreamUrlForOwner(videoAssetId, ownerId);
    return {
      ...payload,
      videoAssetId,
      videoUrl: signed.url,
      signedExpiresAt: signed.expiresAt,
      ...(shouldInjectDuration ? { durationMs: Math.round(video.durationMs as number) } : {}),
    };
  }

  /**
   * Validates one signed stream request and returns the owned scene video.
   */
  async getVideoForSignedStream(
    videoId: string,
    ownerId: number,
    expiresAt: number,
    signature: string,
  ): Promise<SceneVideo> {
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(expiresAt) || expiresAt <= now) {
      throw new ForbiddenException('Signed URL expired');
    }

    const expected = this.signStreamToken(videoId, ownerId, expiresAt);
    if (signature !== expected) {
      throw new ForbiddenException('Invalid stream signature');
    }

    const video = await this.findOneForOwner(videoId, ownerId);
    if (video.processingStatus !== 'ready') {
      throw new BadRequestException('Video asset is not ready for streaming');
    }

    return video;
  }

  /**
   * Resolves one video absolute path from relative storage path.
   */
  async resolveAbsoluteVideoPath(relativePathValue: string): Promise<string> {
    const storageRoot = await this.ensureStorageRoot();
    const normalizedRelative = normalize(relativePathValue).replace(/^([/\\])+/, '');
    const absolutePath = normalize(join(storageRoot, normalizedRelative));

    if (!absolutePath.startsWith(normalize(storageRoot))) {
      throw new ForbiddenException('Invalid video path');
    }

    return absolutePath;
  }

  /**
   * Returns file size for one absolute path.
   */
  async getFileSize(absolutePath: string): Promise<number> {
    const fileStats = await stat(absolutePath);
    return fileStats.size;
  }

  /**
   * Creates a readable stream over a byte range.
   */
  createReadStreamForRange(absolutePath: string, start?: number, end?: number) {
    return createReadStream(absolutePath, start !== undefined && end !== undefined ? { start, end } : undefined);
  }

  private assertAllowedMimeType(mimeType: string): void {
    if (!ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(`Unsupported video mime type: ${mimeType}`);
    }
  }

  private getStorageRootBaseDir(): string {
    const configuredDbPath = this.configService.get<string>('DB_DATABASE') || join(process.cwd(), 'data', 'dm_app.db');
    const absoluteDbPath = isAbsolute(configuredDbPath)
      ? configuredDbPath
      : join(process.cwd(), configuredDbPath);
    return dirname(absoluteDbPath);
  }

  private async ensureStorageRoot(): Promise<string> {
    const root = join(this.getStorageRootBaseDir(), 'media', 'scene-videos');
    await mkdir(root, { recursive: true });
    return root;
  }

  private toStorageRelativePath(storageRoot: string, absolutePath: string): string {
    return relative(storageRoot, absolutePath).replace(/\\/g, '/');
  }

  private signStreamToken(videoId: string, ownerId: number, expiresAt: number): string {
    const secret =
      this.configService.get<string>('SCENE_VIDEO_SIGNING_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'scene-video-dev-secret';

    return createHmac('sha256', secret)
      .update(`${videoId}:${ownerId}:${expiresAt}`)
      .digest('hex');
  }

  private async calculateFileSha256(absolutePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);

    return new Promise<string>((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  private async processClipDerivationJob(
    clipId: string,
    ownerId: number,
    sourceRelativePath: string,
    targetAbsolutePath: string,
    startSec: number,
    endSec: number,
  ): Promise<void> {
    const clip = await this.sceneVideosRepository.findByIdForOwner(clipId, ownerId);
    if (!clip) {
      return;
    }

    try {
      const sourceAbsolutePath = await this.resolveAbsoluteVideoPath(sourceRelativePath);
      await this.runFfmpegClipRender(sourceAbsolutePath, targetAbsolutePath, startSec, endSec);

      const checksumSha256 = await this.calculateFileSha256(targetAbsolutePath);
      const renderedStats = await stat(targetAbsolutePath);

      clip.size = Math.max(0, Number(renderedStats.size) || 0);
      clip.checksumSha256 = checksumSha256;
      clip.processingStatus = 'ready';
      clip.processingError = null;

      await this.sceneVideosRepository.save(clip);
    } catch (error: any) {
      this.logger.error(`Clip derivation failed for ${clipId}: ${String(error?.message || error)}`);
      clip.processingStatus = 'failed';
      clip.processingError = String(error?.message || 'Clip derivation failed');
      await this.sceneVideosRepository.save(clip);

      if (existsSync(targetAbsolutePath)) {
        await unlink(targetAbsolutePath);
      }
    }
  }

  private runFfmpegClipRender(
    sourceAbsolutePath: string,
    targetAbsolutePath: string,
    startSec: number,
    endSec: number,
  ): Promise<void> {
    const durationSec = Math.max(0.001, endSec - startSec);
    const args = [
      '-y',
      '-ss',
      startSec.toFixed(3),
      '-i',
      sourceAbsolutePath,
      '-t',
      durationSec.toFixed(3),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      targetAbsolutePath,
    ];

    return this.runFfmpegWithFallback(args);
  }

  private async runFfmpegWithFallback(args: string[]): Promise<void> {
    const binaries = this.resolveFfmpegBinaryCandidates();
    const attempted: string[] = [];
    let lastFailure: Error | null = null;

    for (const binary of binaries) {
      attempted.push(binary);
      try {
        await this.spawnFfmpeg(binary, args);
        return;
      } catch (error: any) {
        const message = String(error?.message || error);
        const isMissingBinary = message.includes('ENOENT') || message.includes('not found');
        if (!isMissingBinary) {
          throw error;
        }
        lastFailure = error instanceof Error ? error : new Error(message);
      }
    }

    throw new Error(
      [
        'Unable to run ffmpeg. Ensure FFmpeg is installed or set FFMPEG_PATH.',
        `Tried: ${attempted.join(', ')}`,
        lastFailure ? `Last error: ${lastFailure.message}` : '',
      ].filter(Boolean).join(' '),
    );
  }

  private resolveFfmpegBinaryCandidates(): string[] {
    const configured = this.configService.get<string>('FFMPEG_PATH')?.trim();
    const envConfigured = process.env.FFMPEG_PATH?.trim();
    const ffmpegStaticBinary = this.resolveFfmpegStaticBinary();

    const windowsCandidates = process.platform === 'win32'
      ? [
          this.joinIfDefined(process.env.ProgramFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'),
          this.joinIfDefined(process.env['ProgramFiles(x86)'], 'ffmpeg', 'bin', 'ffmpeg.exe'),
          this.joinIfDefined(process.env.ChocolateyInstall, 'bin', 'ffmpeg.exe'),
        ]
      : [];

    const candidates = [
      configured,
      envConfigured,
      ffmpegStaticBinary,
      'ffmpeg',
      'ffmpeg.exe',
      ...windowsCandidates,
    ].filter((value): value is string => Boolean(value && value.trim()));

    return [...new Set(candidates)];
  }

  private resolveFfmpegStaticBinary(): string | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const resolved = require('ffmpeg-static');
      if (typeof resolved === 'string' && resolved.trim()) {
        return resolved;
      }
      if (resolved && typeof resolved.path === 'string' && resolved.path.trim()) {
        return resolved.path;
      }
      return null;
    } catch {
      return null;
    }
  }

  private joinIfDefined(basePath: string | undefined, ...parts: string[]): string | null {
    if (!basePath || !basePath.trim()) return null;
    return join(basePath, ...parts);
  }

  private spawnFfmpeg(binary: string, args: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderrOutput = '';

      child.on('error', (error) => {
        reject(new Error(`spawn ${binary} failed: ${error.message}`));
      });

      child.stderr.on('data', (chunk) => {
        stderrOutput += String(chunk || '');
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`FFmpeg exited with code ${code}. ${stderrOutput.slice(-600)}`));
      });
    });
  }
}
