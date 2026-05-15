import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash, randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, rename, stat, unlink } from 'fs/promises';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'path';
import { CreateSceneVideoDto } from './dto/create-scene-video.dto';
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

    const signed = await this.createSignedStreamUrlForOwner(videoAssetId, ownerId);
    return {
      ...payload,
      videoAssetId,
      videoUrl: signed.url,
      signedExpiresAt: signed.expiresAt,
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
}
