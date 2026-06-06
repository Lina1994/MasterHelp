import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapEntity } from './entities/map.entity';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { MapMarker } from './entities/map-marker.entity';
import { CreateMapMarkerDto } from './dto/create-map-marker.dto';
import { UpdateMapMarkerDto } from './dto/update-map-marker.dto';
import { User } from '../users/entities/user.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { MapImage } from './entities/map-image.entity';
import { MapSkylineImage } from './entities/map-skyline-image.entity';
import { MapFogState, OrganicFogStroke } from './entities/map-fog-state.entity';
import { MapTokensState, MapTokenItem } from './entities/map-tokens-state.entity';
import { MapElementsState, MapElement } from './entities/map-elements-state.entity';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

const sharpLib = require('sharp');

@Injectable()
export class MapsService {
  private readonly thumbGenerationLocks = new Map<string, Promise<void>>();

  private getSharpInstance(): any {
    return sharpLib;
  }

  constructor(
    @InjectRepository(MapEntity) private readonly repo: Repository<MapEntity>,
    @InjectRepository(MapImage) private readonly imagesRepo: Repository<MapImage>,
    @InjectRepository(MapSkylineImage) private readonly skylinesRepo: Repository<MapSkylineImage>,
    @InjectRepository(MapFogState) private readonly fogRepo: Repository<MapFogState>,
    @InjectRepository(MapTokensState) private readonly tokensRepo: Repository<MapTokensState>,
    @InjectRepository(MapElementsState) private readonly elementsRepo: Repository<MapElementsState>,
    @InjectRepository(Campaign) private readonly campaignsRepo: Repository<Campaign>,
    @InjectRepository(MapMarker) private readonly markersRepo: Repository<MapMarker>,
  ) {}

  private getDbPath(): string {
    return process.env.DB_DATABASE || join(process.cwd(), 'data', 'dm_app.db');
  }

  private getDataDir(): string {
    return join(this.getDbPath(), '..');
  }

  private getMediaRootDir(): string {
    return join(this.getDataDir(), 'media');
  }

  private getMapMediaDir(folderName: string): string {
    return join(this.getMediaRootDir(), 'maps', folderName);
  }

  private slugifyFolderName(name: string): string {
    const base = (name || 'map')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    return base || 'map';
  }

  private buildMediaFolderName(mapId: string, mapName: string): string {
    return `${this.slugifyFolderName(mapName)}-${mapId}`;
  }

  private extractMediaFolderFromRelativePath(relativePath?: string | null): string | null {
    if (!relativePath) return null;
    const normalized = relativePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 3) return null;
    if (parts[0] !== 'maps') return null;
    return parts[1] || null;
  }

  private async resolveExistingFolderFromMapAssets(mapId: string): Promise<string | null> {
    const [mapRows, skylineRows] = await Promise.all([
      this.imagesRepo.createQueryBuilder('img')
        .select('img.relativePath', 'relativePath')
        .where('img.mapId = :mapId', { mapId })
        .andWhere('img.relativePath IS NOT NULL')
        .orderBy('img.migratedAt', 'DESC')
        .addOrderBy('img.id', 'DESC')
        .limit(1)
        .getRawMany<{ relativePath: string | null }>(),
      this.skylinesRepo.createQueryBuilder('img')
        .select('img.relativePath', 'relativePath')
        .where('img.mapId = :mapId', { mapId })
        .andWhere('img.relativePath IS NOT NULL')
        .orderBy('img.migratedAt', 'DESC')
        .addOrderBy('img.id', 'DESC')
        .limit(1)
        .getRawMany<{ relativePath: string | null }>(),
    ]);

    const folders = [
      this.extractMediaFolderFromRelativePath(mapRows[0]?.relativePath ?? null),
      this.extractMediaFolderFromRelativePath(skylineRows[0]?.relativePath ?? null),
    ].filter((v): v is string => !!v);

    return folders.length > 0 ? folders[0] : null;
  }

  private async resolveMediaFolderName(mapId: string): Promise<string> {
    const map = await this.repo.findOne({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');
    if (map.mediaFolder) return map.mediaFolder;

    const existingFolder = await this.resolveExistingFolderFromMapAssets(map.id);
    if (existingFolder) {
      await this.repo.createQueryBuilder()
        .update(MapEntity)
        .set({ mediaFolder: existingFolder } as any)
        .where('id = :id', { id: map.id })
        .andWhere('mediaFolder IS NULL')
        .execute();
      return existingFolder;
    }

    const generated = this.buildMediaFolderName(map.id, map.name || 'map');
    await this.repo.createQueryBuilder()
      .update(MapEntity)
      .set({ mediaFolder: generated } as any)
      .where('id = :id', { id: map.id })
      .andWhere('mediaFolder IS NULL')
      .execute();

    return generated;
  }

  private async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  private sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private extensionFromMime(mimeType: string): string {
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    if (mimeType === 'image/gif') return '.gif';
    if (mimeType === 'image/avif') return '.avif';
    return '.bin';
  }

  private buildVariantFileName(
    kind: 'map' | 'skyline',
    variant: 'thumb' | 'preview' | 'full',
    timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | null | undefined,
    mimeType: string,
  ): string {
    const safeTod = timeOfDay ? this.sanitizePathSegment(timeOfDay) : 'base';
    const ext = this.extensionFromMime(mimeType);
    return `${kind}-${variant}-${safeTod}${ext}`;
  }

  private async writeMapMediaFile(
    mapId: string,
    kind: 'map' | 'skyline',
    variant: 'thumb' | 'preview' | 'full',
    timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | null | undefined,
    mimeType: string,
    buffer: Buffer,
    mediaFolder?: string,
  ): Promise<{ relativePath: string; size: number }> {
    const effectiveFolder = mediaFolder || await this.resolveMediaFolderName(mapId);
    const mapDir = this.getMapMediaDir(effectiveFolder);
    await this.ensureDir(mapDir);
    const fileName = this.buildVariantFileName(kind, variant, timeOfDay, mimeType);
    const absolutePath = join(mapDir, fileName);
    await fs.writeFile(absolutePath, buffer);
    const relativePath = join('maps', effectiveFolder, fileName).replace(/\\/g, '/');
    return { relativePath, size: buffer.length };
  }

  private async readFsBuffer(relativePath: string): Promise<Buffer | null> {
    const mediaRoot = this.getMediaRootDir();
    const normalizedRelative = relativePath.replace(/\\/g, '/');
    const safeSegments = normalizedRelative.split('/').filter(Boolean);
    if (safeSegments.some((segment) => segment === '.' || segment === '..')) {
      return null;
    }
    const absolutePath = join(mediaRoot, ...safeSegments);
    try {
      return await fs.readFile(absolutePath);
    } catch {
      return null;
    }
  }

  private async migrateMapImageToFs(img: MapImage, mapId: string): Promise<void> {
    if (img.relativePath || !img.data) return;
    const saved = await this.writeMapMediaFile(
      mapId,
      'map',
      img.variant,
      img.timeOfDay ?? null,
      img.mimeType,
      img.data,
    );
    img.storageKind = 'fs';
    img.relativePath = saved.relativePath;
    img.size = saved.size;
    img.migratedAt = new Date();
    await this.imagesRepo.save(img);
  }

  private async migrateSkylineImageToFs(img: MapSkylineImage, mapId: string): Promise<void> {
    if (img.relativePath || !img.data) return;
    const saved = await this.writeMapMediaFile(
      mapId,
      'skyline',
      img.variant,
      img.timeOfDay ?? null,
      img.mimeType,
      img.data,
    );
    img.storageKind = 'fs';
    img.relativePath = saved.relativePath;
    img.size = saved.size;
    img.migratedAt = new Date();
    await this.skylinesRepo.save(img);
  }

  private async getMapImageBuffer(img: MapImage, mapId: string): Promise<Buffer | null> {
    if (img.relativePath) {
      const fsBuffer = await this.readFsBuffer(img.relativePath);
      if (fsBuffer) return fsBuffer;
    }
    if (img.data) {
      await this.migrateMapImageToFs(img, mapId);
      return img.data;
    }
    return null;
  }

  private async getSkylineImageBuffer(img: MapSkylineImage, mapId: string): Promise<Buffer | null> {
    if (img.relativePath) {
      const fsBuffer = await this.readFsBuffer(img.relativePath);
      if (fsBuffer) return fsBuffer;
    }
    if (img.data) {
      await this.migrateSkylineImageToFs(img, mapId);
      return img.data;
    }
    return null;
  }

  private async persistMapVariantsToFs(mapId: string, variants: MapImage[], mediaFolder?: string): Promise<void> {
    const effectiveFolder = mediaFolder || await this.resolveMediaFolderName(mapId);
    for (const variant of variants) {
      if (!variant.data) continue;
      const saved = await this.writeMapMediaFile(
        mapId,
        'map',
        variant.variant,
        variant.timeOfDay ?? null,
        variant.mimeType,
        variant.data,
        effectiveFolder,
      );
      variant.storageKind = 'fs';
      variant.relativePath = saved.relativePath;
      variant.size = saved.size;
      variant.migratedAt = new Date();
    }
    await this.imagesRepo.save(variants);
  }

  private async persistSkylineVariantsToFs(mapId: string, variants: MapSkylineImage[], mediaFolder?: string): Promise<void> {
    const effectiveFolder = mediaFolder || await this.resolveMediaFolderName(mapId);
    for (const variant of variants) {
      if (!variant.data) continue;
      const saved = await this.writeMapMediaFile(
        mapId,
        'skyline',
        variant.variant,
        variant.timeOfDay ?? null,
        variant.mimeType,
        variant.data,
        effectiveFolder,
      );
      variant.storageKind = 'fs';
      variant.relativePath = saved.relativePath;
      variant.size = saved.size;
      variant.migratedAt = new Date();
    }
    await this.skylinesRepo.save(variants);
  }

  private async deleteMapMediaDirectory(mapId: string, mediaFolder?: string | null): Promise<void> {
    const targets = new Set<string>([mapId]);
    if (mediaFolder) targets.add(mediaFolder);
    for (const folderName of targets) {
      const mapDir = this.getMapMediaDir(folderName);
      try {
        await fs.rmdir(mapDir);
      } catch {
        // Best-effort cleanup only.
      }
    }
  }

  private async listFilesRecursive(rootDir: string): Promise<string[]> {
    const out: string[] = [];
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = [];
    try {
      entries = await fs.readdir(rootDir, { withFileTypes: true }) as any;
    } catch {
      return out;
    }
    for (const entry of entries) {
      const absolute = join(rootDir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.listFilesRecursive(absolute);
        out.push(...nested);
      } else if (entry.isFile()) {
        out.push(absolute);
      }
    }
    return out;
  }

  private normalizeToRelativeMediaPath(absolutePath: string): string {
    const mediaRoot = this.getMediaRootDir().replace(/\\/g, '/');
    const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
    if (!normalizedAbsolute.startsWith(mediaRoot)) return '';
    return normalizedAbsolute.slice(mediaRoot.length).replace(/^\/+/, '');
  }

  private async getReferencedRelativePathsForOwner(
    ownerId: string | number,
    campaignId?: string | null,
  ): Promise<Set<string>> {
    const mapRows = await this.imagesRepo.createQueryBuilder('img')
      .innerJoin('img.map', 'map')
      .where('map.ownerId = :ownerId', { ownerId })
      .andWhere(campaignId ? 'map.campaignId = :campaignId' : '1=1', { campaignId })
      .andWhere('img.relativePath IS NOT NULL')
      .select('DISTINCT img.relativePath', 'relativePath')
      .getRawMany<{ relativePath: string | null }>();

    const skylineRows = await this.skylinesRepo.createQueryBuilder('img')
      .innerJoin('img.map', 'map')
      .where('map.ownerId = :ownerId', { ownerId })
      .andWhere(campaignId ? 'map.campaignId = :campaignId' : '1=1', { campaignId })
      .andWhere('img.relativePath IS NOT NULL')
      .select('DISTINCT img.relativePath', 'relativePath')
      .getRawMany<{ relativePath: string | null }>();

    return new Set([
      ...mapRows.map((r) => r.relativePath).filter((p): p is string => !!p),
      ...skylineRows.map((r) => r.relativePath).filter((p): p is string => !!p),
    ]);
  }

  private async getOwnedMaps(ownerId: string | number): Promise<Array<{ id: string; mediaFolder: string | null }>> {
    const rows = await this.repo.createQueryBuilder('map')
      .select(['map.id AS id', 'map.mediaFolder AS mediaFolder'])
      .where('map.ownerId = :ownerId', { ownerId })
      .getRawMany<{ id: string; mediaFolder: string | null }>();
    return rows;
  }

  private async computePhysicalSize(relativePaths: Set<string>): Promise<number> {
    let total = 0;
    for (const relativePath of relativePaths) {
      const absPath = this.getAbsoluteMediaPath(relativePath);
      try {
        const stats = await fs.stat(absPath);
        if (stats.isFile()) total += stats.size;
      } catch {
        // Ignore missing files here; diagnostics method reports them.
      }
    }
    return total;
  }

  /**
   * Inspects owner-scoped map media consistency across database and filesystem.
   * Returns counts and sample paths to help detect orphaned files or broken DB pointers.
   */
  async getMediaDiagnostics(user: User | any, campaignId?: string | null): Promise<{
    referencedPathCount: number;
    existingReferencedPathCount: number;
    missingReferencedPathCount: number;
    unreferencedDiskFileCount: number;
    sampleMissingReferencedPaths: string[];
    sampleUnreferencedDiskFiles: string[];
  }> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const referenced = await this.getReferencedRelativePathsForOwner(authUserId, campaignId);
    const ownedMaps = await this.getOwnedMaps(authUserId);

    const missingReferencedPaths: string[] = [];
    for (const path of referenced) {
      const absPath = this.getAbsoluteMediaPath(path);
      try {
        await fs.access(absPath);
      } catch {
        missingReferencedPaths.push(path);
      }
    }

    const diskFiles: string[] = [];
    for (const mapInfo of ownedMaps) {
      const candidateFolders = new Set<string>([mapInfo.id]);
      if (mapInfo.mediaFolder) candidateFolders.add(mapInfo.mediaFolder);
      for (const folderName of candidateFolders) {
        const dir = this.getMapMediaDir(folderName);
        const files = await this.listFilesRecursive(dir);
        for (const absolute of files) {
          const relative = this.normalizeToRelativeMediaPath(absolute);
          if (relative) diskFiles.push(relative);
        }
      }
    }

    const diskSet = new Set(diskFiles);
    const unreferencedDiskFiles = Array.from(diskSet).filter((p) => !referenced.has(p));

    return {
      referencedPathCount: referenced.size,
      existingReferencedPathCount: referenced.size - missingReferencedPaths.length,
      missingReferencedPathCount: missingReferencedPaths.length,
      unreferencedDiskFileCount: unreferencedDiskFiles.length,
      sampleMissingReferencedPaths: missingReferencedPaths.slice(0, 25),
      sampleUnreferencedDiskFiles: unreferencedDiskFiles.slice(0, 25),
    };
  }

  private getAbsoluteMediaPath(relativePath: string): string {
    const mediaRoot = this.getMediaRootDir();
    const normalizedRelative = relativePath.replace(/\\/g, '/');
    const safeSegments = normalizedRelative.split('/').filter(Boolean);
    return join(mediaRoot, ...safeSegments);
  }

  private async countRelativePathReferences(relativePath: string): Promise<number> {
    const [mapRefs, skylineRefs] = await Promise.all([
      this.imagesRepo.count({ where: { relativePath } as any }),
      this.skylinesRepo.count({ where: { relativePath } as any }),
    ]);
    return mapRefs + skylineRefs;
  }

  private async getOwnersForRelativePath(relativePath: string): Promise<Set<string>> {
    const [mapRows, skylineRows] = await Promise.all([
      this.imagesRepo.createQueryBuilder('img')
        .innerJoin('img.map', 'map')
        .select('DISTINCT map.ownerId', 'ownerId')
        .where('img.relativePath = :relativePath', { relativePath })
        .getRawMany<{ ownerId: string | null }>(),
      this.skylinesRepo.createQueryBuilder('img')
        .innerJoin('img.map', 'map')
        .select('DISTINCT map.ownerId', 'ownerId')
        .where('img.relativePath = :relativePath', { relativePath })
        .getRawMany<{ ownerId: string | null }>(),
    ]);

    return new Set([
      ...mapRows.map((r) => r.ownerId).filter((v): v is string => !!v),
      ...skylineRows.map((r) => r.ownerId).filter((v): v is string => !!v),
    ]);
  }

  private async deleteMediaFileIfUnreferenced(relativePath: string): Promise<void> {
    if (!relativePath) return;
    const refs = await this.countRelativePathReferences(relativePath);
    if (refs > 0) return;
    const absPath = this.getAbsoluteMediaPath(relativePath);
    try {
      await fs.unlink(absPath);
    } catch {
      // Best-effort cleanup only.
    }
  }

  private async cleanupUnreferencedPaths(paths: Array<string | null | undefined>): Promise<void> {
    const uniquePaths = Array.from(new Set((paths || []).filter((p): p is string => !!p)));
    for (const path of uniquePaths) {
      await this.deleteMediaFileIfUnreferenced(path);
    }
  }

  private async runWithThumbGenerationLock(lockKey: string, action: () => Promise<void>): Promise<void> {
    const pending = this.thumbGenerationLocks.get(lockKey);
    if (pending) {
      await pending;
      return;
    }
    const running = (async () => {
      await action();
    })().finally(() => {
      this.thumbGenerationLocks.delete(lockKey);
    });
    this.thumbGenerationLocks.set(lockKey, running);
    await running;
  }

  private async findMapImageVariant(
    mapId: string,
    variant: 'thumb' | 'preview' | 'full',
    timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null,
    strict?: boolean,
  ): Promise<MapImage | null> {
    let img: MapImage | null = null;
    if (timeOfDay !== undefined && timeOfDay !== null) {
      img = await this.imagesRepo.findOne({ where: { map: { id: mapId } as any, variant, timeOfDay: timeOfDay as any } });
      if (!strict) {
        if (!img) img = await this.imagesRepo.findOne({ where: { map: { id: mapId } as any, variant, timeOfDay: null as any } });
        if (!img) img = await this.imagesRepo.findOne({ where: { map: { id: mapId } as any, variant } });
      }
      return img;
    }

    if (!strict) {
      img = await this.imagesRepo.findOne({ where: { map: { id: mapId } as any, variant, timeOfDay: null as any } });
      if (!img) img = await this.imagesRepo.findOne({ where: { map: { id: mapId } as any, variant } });
    }
    return img;
  }

  private async resolveThumbGenerationSource(
    map: MapEntity,
    requestedTimeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null,
  ): Promise<{ buffer: Buffer; mimeType: string; targetTimeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | null } | null> {
    const candidateTods: Array<'dawn' | 'morning' | 'afternoon' | 'night' | null> = [];
    if (requestedTimeOfDay !== undefined && requestedTimeOfDay !== null) candidateTods.push(requestedTimeOfDay);
    candidateTods.push(null);

    const seen = new Set<string>();
    for (const tod of candidateTods) {
      const key = tod ?? 'base';
      if (seen.has(key)) continue;
      seen.add(key);

      const fullCandidate = await this.imagesRepo.findOne({ where: { map: { id: map.id } as any, variant: 'full', timeOfDay: tod as any } });
      if (fullCandidate) {
        const buffer = await this.getMapImageBuffer(fullCandidate, map.id);
        if (buffer) return { buffer, mimeType: fullCandidate.mimeType, targetTimeOfDay: tod };
      }

      const anyCandidate = await this.imagesRepo.findOne({ where: { map: { id: map.id } as any, timeOfDay: tod as any } });
      if (anyCandidate) {
        const buffer = await this.getMapImageBuffer(anyCandidate, map.id);
        if (buffer) return { buffer, mimeType: anyCandidate.mimeType, targetTimeOfDay: tod };
      }
    }

    if (map.imageData && map.imageMimeType) {
      return { buffer: map.imageData, mimeType: map.imageMimeType, targetTimeOfDay: null };
    }
    return null;
  }

  private async createThumbVariantFromBuffer(
    map: MapEntity,
    buffer: Buffer,
    mimeType: string,
    targetTimeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | null,
  ): Promise<boolean> {
    try {
      const sharpFn = this.getSharpInstance();
      const thumbBuffer = await sharpFn(buffer).resize({ width: 256, withoutEnlargement: true }).toBuffer();
      await this.imagesRepo.createQueryBuilder()
        .delete()
        .from(MapImage)
        .where('mapId = :id', { id: map.id })
        .andWhere(targetTimeOfDay === null ? 'timeOfDay IS NULL' : 'timeOfDay = :tod', { tod: targetTimeOfDay as any })
        .andWhere('variant = :variant', { variant: 'thumb' })
        .execute();

      const thumb = new MapImage();
      thumb.map = map as any;
      thumb.variant = 'thumb';
      thumb.timeOfDay = targetTimeOfDay;
      thumb.mimeType = mimeType;
      thumb.size = thumbBuffer.length;
      thumb.data = thumbBuffer;

      const saved = await this.imagesRepo.save(thumb);
      await this.persistMapVariantsToFs(map.id, [saved]);
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[maps] thumb generation failed', e);
      return false;
    }
  }

  private async ensureThumbVariant(
    map: MapEntity,
    requestedTimeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null,
  ): Promise<boolean> {
    const lockKey = `${map.id}:${requestedTimeOfDay ?? 'base'}:thumb`;
    let created = false;
    await this.runWithThumbGenerationLock(lockKey, async () => {
      const existingExact = await this.findMapImageVariant(map.id, 'thumb', requestedTimeOfDay ?? null, false);
      if (existingExact) return;

      const source = await this.resolveThumbGenerationSource(map, requestedTimeOfDay ?? null);
      if (!source) return;
      created = await this.createThumbVariantFromBuffer(map, source.buffer, source.mimeType, source.targetTimeOfDay);
    });
    return created;
  }

  /**
   * Backfills missing map thumbnail variants (256px) for legacy maps.
   * It can run as dry-run and optionally scoped by campaign.
   */
  async backfillMissingThumbs(
    user: User | any,
    options?: { campaignId?: string | null; dryRun?: boolean; limit?: number },
  ): Promise<{
    dryRun: boolean;
    mapsScanned: number;
    candidateVariants: number;
    thumbsCreated: number;
    skippedNoSource: number;
    errors: number;
    sampleCreated: Array<{ mapId: string; timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | null }>;
  }> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const dryRun = options?.dryRun !== false;
    const limit = options?.limit && options.limit > 0 ? options.limit : undefined;

    const mapsQb = this.repo.createQueryBuilder('map')
      .where('map.ownerId = :ownerId', { ownerId: authUserId });
    if (options?.campaignId) mapsQb.andWhere('map.campaignId = :campaignId', { campaignId: options.campaignId });
    mapsQb.orderBy('map.updatedAt', 'DESC');
    if (limit) mapsQb.limit(limit);
    const maps = await mapsQb.getMany();

    let candidateVariants = 0;
    let thumbsCreated = 0;
    let skippedNoSource = 0;
    let errors = 0;
    const sampleCreated: Array<{ mapId: string; timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | null }> = [];

    for (const map of maps) {
      const todRows = await this.imagesRepo.createQueryBuilder('img')
        .select('DISTINCT img.timeOfDay', 'timeOfDay')
        .where('img.mapId = :mapId', { mapId: map.id })
        .getRawMany<{ timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night' | null }>();

      const tods = new Set<'dawn' | 'morning' | 'afternoon' | 'night' | null>([null]);
      for (const row of todRows) {
        if (row.timeOfDay) tods.add(row.timeOfDay);
      }

      for (const tod of tods) {
        const existingThumb = await this.imagesRepo.findOne({ where: { map: { id: map.id } as any, variant: 'thumb', timeOfDay: tod as any } });
        if (existingThumb) continue;

        candidateVariants += 1;
        const source = await this.resolveThumbGenerationSource(map, tod);
        if (!source) {
          skippedNoSource += 1;
          continue;
        }

        if (dryRun) {
          if (sampleCreated.length < 25) sampleCreated.push({ mapId: map.id, timeOfDay: source.targetTimeOfDay });
          continue;
        }

        try {
          const created = await this.createThumbVariantFromBuffer(map, source.buffer, source.mimeType, source.targetTimeOfDay);
          if (created) {
            thumbsCreated += 1;
            if (sampleCreated.length < 25) sampleCreated.push({ mapId: map.id, timeOfDay: source.targetTimeOfDay });
          } else {
            errors += 1;
          }
        } catch {
          errors += 1;
        }
      }
    }

    return {
      dryRun,
      mapsScanned: maps.length,
      candidateVariants,
      thumbsCreated,
      skippedNoSource,
      errors,
      sampleCreated,
    };
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Migrates legacy media paths from maps/{mapId}/... to maps/{slug-mapId}/...
   * for all maps owned by the authenticated user.
   */
  async migrateLegacyMediaFolders(
    user: User | any,
    dryRun = true,
  ): Promise<{
    dryRun: boolean;
    mapsProcessed: number;
    pathsExamined: number;
    pathsMigrated: number;
    missingSourceFiles: number;
    conflicts: number;
    sampleChanges: Array<{ from: string; to: string }>;
  }> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const maps = await this.repo.find({ where: { owner: { id: authUserId } as any } });
    const sampleChanges: Array<{ from: string; to: string }> = [];

    let pathsExamined = 0;
    let pathsMigrated = 0;
    let missingSourceFiles = 0;
    let conflicts = 0;

    for (const map of maps) {
      const targetFolder = map.mediaFolder || this.buildMediaFolderName(map.id, map.name || 'map');
      const legacyPrefix = `maps/${map.id}/`;
      const newPrefix = `maps/${targetFolder}/`;
      if (legacyPrefix === newPrefix) continue;

      const [imgRows, skylineRows] = await Promise.all([
        this.imagesRepo.createQueryBuilder('img')
          .innerJoin('img.map', 'map')
          .where('map.ownerId = :ownerId', { ownerId: authUserId })
          .andWhere('img.relativePath LIKE :legacyPrefix', { legacyPrefix: `${legacyPrefix}%` })
          .select('DISTINCT img.relativePath', 'relativePath')
          .getRawMany<{ relativePath: string | null }>(),
        this.skylinesRepo.createQueryBuilder('img')
          .innerJoin('img.map', 'map')
          .where('map.ownerId = :ownerId', { ownerId: authUserId })
          .andWhere('img.relativePath LIKE :legacyPrefix', { legacyPrefix: `${legacyPrefix}%` })
          .select('DISTINCT img.relativePath', 'relativePath')
          .getRawMany<{ relativePath: string | null }>(),
      ]);

      const oldPaths = Array.from(new Set([
        ...imgRows.map((r) => r.relativePath).filter((p): p is string => !!p),
        ...skylineRows.map((r) => r.relativePath).filter((p): p is string => !!p),
      ]));

      const validMappings: Array<{ oldPath: string; newPath: string }> = [];
      for (const oldPath of oldPaths) {
        pathsExamined += 1;
        const suffix = oldPath.slice(legacyPrefix.length);
        const newPath = `${newPrefix}${suffix}`;
        const oldAbs = this.getAbsoluteMediaPath(oldPath);
        const newAbs = this.getAbsoluteMediaPath(newPath);

        const oldExists = await this.pathExists(oldAbs);
        if (!oldExists) {
          missingSourceFiles += 1;
          continue;
        }

        const newExists = await this.pathExists(newAbs);
        if (newExists) {
          conflicts += 1;
          continue;
        }

        validMappings.push({ oldPath, newPath });
        if (sampleChanges.length < 25) sampleChanges.push({ from: oldPath, to: newPath });
      }

      if (!dryRun) {
        for (const mapping of validMappings) {
          const oldAbs = this.getAbsoluteMediaPath(mapping.oldPath);
          const newAbs = this.getAbsoluteMediaPath(mapping.newPath);
          await this.ensureDir(dirname(newAbs));
          await fs.rename(oldAbs, newAbs);

          await this.imagesRepo.createQueryBuilder()
            .update(MapImage)
            .set({ relativePath: mapping.newPath, storageKind: 'fs', migratedAt: new Date() } as any)
            .where('relativePath = :oldPath', { oldPath: mapping.oldPath })
            .execute();
          await this.skylinesRepo.createQueryBuilder()
            .update(MapSkylineImage)
            .set({ relativePath: mapping.newPath, storageKind: 'fs', migratedAt: new Date() } as any)
            .where('relativePath = :oldPath', { oldPath: mapping.oldPath })
            .execute();
          pathsMigrated += 1;
        }

        if (!map.mediaFolder) {
          map.mediaFolder = targetFolder;
          await this.repo.save(map);
        }

        await this.deleteMapMediaDirectory(map.id, null);
      }
    }

    return {
      dryRun,
      mapsProcessed: maps.length,
      pathsExamined,
      pathsMigrated,
      missingSourceFiles,
      conflicts,
      sampleChanges,
    };
  }

  /**
   * Reconciles mixed media folders per map so map images and skylines share one folder.
   * Safety rule: only moves paths that are not externally shared with other maps.
   */
  async reconcileMapMediaFolders(
    user: User | any,
    dryRun = true,
    includeSharedSameOwner = false,
  ): Promise<{
    dryRun: boolean;
    includeSharedSameOwner: boolean;
    mapsProcessed: number;
    pathsExamined: number;
    pathsMoved: number;
    skippedShared: number;
    movedSharedSameOwner: number;
    missingSourceFiles: number;
    conflicts: number;
    sampleChanges: Array<{ from: string; to: string }>;
  }> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const maps = await this.repo.find({ where: { owner: { id: authUserId } as any } });
    const sampleChanges: Array<{ from: string; to: string }> = [];

    let pathsExamined = 0;
    let pathsMoved = 0;
    let skippedShared = 0;
    let movedSharedSameOwner = 0;
    let missingSourceFiles = 0;
    let conflicts = 0;

    for (const map of maps) {
      const canonicalFolder = map.mediaFolder
        || (await this.resolveExistingFolderFromMapAssets(map.id))
        || this.buildMediaFolderName(map.id, map.name || 'map');

      if (!map.mediaFolder && !dryRun) {
        map.mediaFolder = canonicalFolder;
        await this.repo.save(map);
      }

      const [imgRows, skylineRows] = await Promise.all([
        this.imagesRepo.createQueryBuilder('img')
          .where('img.mapId = :mapId', { mapId: map.id })
          .andWhere('img.relativePath IS NOT NULL')
          .select('img.relativePath', 'relativePath')
          .getRawMany<{ relativePath: string | null }>(),
        this.skylinesRepo.createQueryBuilder('img')
          .where('img.mapId = :mapId', { mapId: map.id })
          .andWhere('img.relativePath IS NOT NULL')
          .select('img.relativePath', 'relativePath')
          .getRawMany<{ relativePath: string | null }>(),
      ]);

      const localCounts = new Map<string, number>();
      for (const p of [...imgRows, ...skylineRows].map((r) => r.relativePath).filter((v): v is string => !!v)) {
        localCounts.set(p, (localCounts.get(p) || 0) + 1);
      }

      for (const [oldPath, localRefCount] of localCounts.entries()) {
        pathsExamined += 1;

        const currentFolder = this.extractMediaFolderFromRelativePath(oldPath);
        if (!currentFolder || currentFolder === canonicalFolder) continue;

        const suffix = oldPath.split('/').slice(2).join('/');
        if (!suffix) continue;
        const newPath = `maps/${canonicalFolder}/${suffix}`;

        const totalRefs = await this.countRelativePathReferences(oldPath);
        let isSharedExternal = totalRefs > localRefCount;
        if (isSharedExternal) {
          if (!includeSharedSameOwner) {
            skippedShared += 1;
            continue;
          }
          const owners = await this.getOwnersForRelativePath(oldPath);
          if (owners.size !== 1 || !owners.has(String(authUserId))) {
            skippedShared += 1;
            continue;
          }
        }

        const oldAbs = this.getAbsoluteMediaPath(oldPath);
        const newAbs = this.getAbsoluteMediaPath(newPath);
        const oldExists = await this.pathExists(oldAbs);
        if (!oldExists) {
          missingSourceFiles += 1;
          continue;
        }
        const newExists = await this.pathExists(newAbs);
        if (newExists) {
          conflicts += 1;
          continue;
        }

        if (sampleChanges.length < 25) sampleChanges.push({ from: oldPath, to: newPath });

        if (!dryRun) {
          await this.ensureDir(dirname(newAbs));
          await fs.rename(oldAbs, newAbs);

          await this.imagesRepo.createQueryBuilder()
            .update(MapImage)
            .set({ relativePath: newPath, storageKind: 'fs', migratedAt: new Date() } as any)
            .where('mapId = :mapId', { mapId: map.id })
            .andWhere('relativePath = :oldPath', { oldPath })
            .execute();

          await this.skylinesRepo.createQueryBuilder()
            .update(MapSkylineImage)
            .set({ relativePath: newPath, storageKind: 'fs', migratedAt: new Date() } as any)
            .where('mapId = :mapId', { mapId: map.id })
            .andWhere('relativePath = :oldPath', { oldPath })
            .execute();

          pathsMoved += 1;
          if (isSharedExternal) movedSharedSameOwner += 1;
        }
      }

      if (!dryRun) {
        await this.deleteMapMediaDirectory(map.id, null);
      }
    }

    return {
      dryRun,
      includeSharedSameOwner,
      mapsProcessed: maps.length,
      pathsExamined,
      pathsMoved,
      skippedShared,
      movedSharedSameOwner,
      missingSourceFiles,
      conflicts,
      sampleChanges,
    };
  }

  private async ensureMapImageHasSharedPath(img: MapImage, mapId: string): Promise<MapImage> {
    if (!img.relativePath && img.data) {
      await this.migrateMapImageToFs(img, mapId);
    }
    return img;
  }

  private async ensureSkylineImageHasSharedPath(img: MapSkylineImage, mapId: string): Promise<MapSkylineImage> {
    if (!img.relativePath && img.data) {
      await this.migrateSkylineImageToFs(img, mapId);
    }
    return img;
  }

  /**
   * Validates auth context and ownership for a map and campaign pair.
   * Used by fog/tokens/elements state endpoints to keep checks consistent.
   */
  private async assertOwnedMapAndCampaign(
    user: User | any,
    mapId: string,
    campaignId: string,
  ): Promise<{ authUserId: string | number; map: MapEntity; campaign: Campaign }> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const map = await this.repo.findOne({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');
    if (map.owner.id !== authUserId) throw new ForbiddenException('Not owner');

    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== authUserId) throw new ForbiddenException('Not campaign owner');

    return { authUserId, map, campaign };
  }

  /**
   * Returns Fog of War cells for the given map+campaign scoped to owner.
   * Validates ownership and existence of referenced entities.
   */
  async getFog(user: User | any, mapId: string, campaignId: string): Promise<string[]> {
    const { authUserId } = await this.assertOwnedMapAndCampaign(user, mapId, campaignId);
    const existing = await this.fogRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    return existing?.cells || [];
  }

  /**
   * Upserts Fog of War cells for the given map+campaign scoped to owner.
   * Validates ownership and prevents unauthorized writes.
   */
  async setFog(user: User | any, mapId: string, campaignId: string, cells: string[]): Promise<{ ok: boolean }>{
    const { authUserId, map, campaign } = await this.assertOwnedMapAndCampaign(user, mapId, campaignId);
    let existing = await this.fogRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    if (!existing) {
      existing = new MapFogState();
      existing.owner = map.owner;
      existing.campaign = campaign;
      existing.map = map;
      existing.cells = Array.isArray(cells) ? Array.from(new Set(cells)) : [];
      await this.fogRepo.save(existing);
    } else {
      existing.cells = Array.isArray(cells) ? Array.from(new Set(cells)) : [];
      await this.fogRepo.save(existing);
    }
    return { ok: true };
  }

  /**
   * Returns organic fog strokes for the given map+campaign scoped to owner.
   * @param user Authenticated user
   * @param mapId Map UUID
   * @param campaignId Campaign UUID
   * @returns Array of organic fog strokes
   */
  async getOrganicFog(user: User | any, mapId: string, campaignId: string): Promise<OrganicFogStroke[]> {
    const { authUserId } = await this.assertOwnedMapAndCampaign(user, mapId, campaignId);
    const existing = await this.fogRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    return existing?.organicStrokes || [];
  }

  /**
   * Upserts organic fog strokes for the given map+campaign scoped to owner.
   * @param user Authenticated user
   * @param mapId Map UUID
   * @param campaignId Campaign UUID
   * @param strokes Array of organic fog strokes to persist
   * @returns Success indicator
   */
  async setOrganicFog(user: User | any, mapId: string, campaignId: string, strokes: OrganicFogStroke[]): Promise<{ ok: boolean }> {
    const { authUserId, map, campaign } = await this.assertOwnedMapAndCampaign(user, mapId, campaignId);
    let existing = await this.fogRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    if (!existing) {
      existing = new MapFogState();
      existing.owner = map.owner;
      existing.campaign = campaign;
      existing.map = map;
      existing.cells = [];
      existing.organicStrokes = Array.isArray(strokes) ? strokes : [];
      await this.fogRepo.save(existing);
    } else {
      existing.organicStrokes = Array.isArray(strokes) ? strokes : [];
      await this.fogRepo.save(existing);
    }
    return { ok: true };
  }

  /**
   * Returns token items for the given map+campaign scoped to owner.
   */
  async getTokens(user: User | any, mapId: string, campaignId: string): Promise<MapTokenItem[]> {
    const { authUserId } = await this.assertOwnedMapAndCampaign(user, mapId, campaignId);
    const existing = await this.tokensRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    return existing?.tokens || [];
  }

  /**
   * Upserts token items for the given map+campaign scoped to owner.
   */
  async setTokens(user: User | any, mapId: string, campaignId: string, tokens: MapTokenItem[]): Promise<{ ok: boolean }>{
    const { authUserId, map, campaign } = await this.assertOwnedMapAndCampaign(user, mapId, campaignId);
    let existing = await this.tokensRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    const deduped = Array.isArray(tokens) ? Array.from(new Map(tokens.map(t => [t.id, t])).values()) : [];
    if (!existing) {
      existing = new MapTokensState();
      existing.owner = map.owner;
      existing.campaign = campaign;
      existing.map = map;
      existing.tokens = deduped;
      await this.tokensRepo.save(existing);
    } else {
      existing.tokens = deduped;
      await this.tokensRepo.save(existing);
    }
    return { ok: true };
  }

  /**
   * Returns map elements (walls, doors, windows, lights) for the given map+campaign scoped to owner.
   * @param user Authenticated user.
   * @param mapId Map UUID.
   * @param campaignId Campaign UUID.
   * @returns Array of map elements.
   */
  async getElements(user: User | any, mapId: string, campaignId: string): Promise<MapElement[]> {
    const { authUserId } = await this.assertOwnedMapAndCampaign(user, mapId, campaignId);
    const existing = await this.elementsRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    return existing?.elements || [];
  }

  /**
   * Upserts map elements (walls, doors, windows, lights) for the given map+campaign scoped to owner.
   * @param user Authenticated user.
   * @param mapId Map UUID.
   * @param campaignId Campaign UUID.
   * @param elements Full replacement array of map elements.
   * @returns Success indicator.
   */
  async setElements(user: User | any, mapId: string, campaignId: string, elements: MapElement[]): Promise<{ ok: boolean }> {
    const { authUserId, map, campaign } = await this.assertOwnedMapAndCampaign(user, mapId, campaignId);
    let existing = await this.elementsRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    const sanitised = Array.isArray(elements) ? elements : [];
    if (!existing) {
      existing = new MapElementsState();
      existing.owner = map.owner;
      existing.campaign = campaign;
      existing.map = map;
      existing.elements = sanitised;
      await this.elementsRepo.save(existing);
    } else {
      existing.elements = sanitised;
      await this.elementsRepo.save(existing);
    }
    return { ok: true };
  }

  /** Generate sharp-based variants. Falls back to only 'full' if processing fails. */
  private async buildVariants(file: { buffer: Buffer; mimetype: string; size: number }, timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null): Promise<MapImage[]> {
    const variants: MapImage[] = [];
    // Full (original)
    const full = new MapImage();
    full.variant = 'full';
    full.timeOfDay = timeOfDay ?? null;
    full.mimeType = file.mimetype;
    full.size = file.size;
    full.data = file.buffer;
    variants.push(full);
    try {
      const sharpFn = this.getSharpInstance();
      const previewBuf = await sharpFn(file.buffer).resize({ width: 1280, withoutEnlargement: true }).toBuffer();
      const preview = new MapImage();
      preview.variant = 'preview';
      preview.timeOfDay = timeOfDay ?? null;
      preview.mimeType = file.mimetype;
      preview.size = previewBuf.length;
      preview.data = previewBuf;
      variants.push(preview);
      const thumbBuf = await sharpFn(file.buffer).resize({ width: 256, withoutEnlargement: true }).toBuffer();
      const thumb = new MapImage();
      thumb.variant = 'thumb';
      thumb.timeOfDay = timeOfDay ?? null;
      thumb.mimeType = file.mimetype;
      thumb.size = thumbBuf.length;
      thumb.data = thumbBuf;
      variants.push(thumb);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[maps] variant generation failed, using full only', e);
    }
    return variants;
  }

  /** Generate skyline variants mirroring map image variants */
  private async buildSkylineVariants(file: { buffer: Buffer; mimetype: string; size: number }, timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null): Promise<MapSkylineImage[]> {
    const variants: MapSkylineImage[] = [];
    const full = new MapSkylineImage();
    full.variant = 'full';
    full.timeOfDay = timeOfDay ?? null;
    full.mimeType = file.mimetype;
    full.size = file.size;
    full.data = file.buffer;
    variants.push(full);
    try {
      const sharpFn = this.getSharpInstance();
      const previewBuf = await sharpFn(file.buffer).resize({ width: 1280, withoutEnlargement: true }).toBuffer();
      const preview = new MapSkylineImage();
      preview.variant = 'preview';
      preview.timeOfDay = timeOfDay ?? null;
      preview.mimeType = file.mimetype;
      preview.size = previewBuf.length;
      preview.data = previewBuf;
      variants.push(preview);
      const thumbBuf = await sharpFn(file.buffer).resize({ width: 256, withoutEnlargement: true }).toBuffer();
      const thumb = new MapSkylineImage();
      thumb.variant = 'thumb';
      thumb.timeOfDay = timeOfDay ?? null;
      thumb.mimeType = file.mimetype;
      thumb.size = thumbBuf.length;
      thumb.data = thumbBuf;
      variants.push(thumb);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[maps] skyline variant generation failed, using full only', e);
    }
    return variants;
  }

  /** Extract consistent user id from JWT payload or entity */
  private extractAuthUserId(user: any): string | number | undefined {
    return user?.id ?? user?.userId;
  }

  /**
  * Returns maps owned by the authenticated user.
  * - If campaignId is provided, restrict to that campaign.
  * - Supports optional free-text search (q) by name/description.
   */
  async listOwned(user: User | any, q?: string, campaignId?: string) {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    const qb = this.repo.createQueryBuilder('m')
      .leftJoin('m.campaign', 'c')
      .select([
        'm.id',
        'm.name',
        'm.description',
        'm.group',
        'm.timeOfDay',
        'm.isWorldMap',
        'm.isPrepared',
        'm.fogEnabledByDefault',
        'm.musicConfig',
        'm.sfxConfig',
        'm.transform',
        'm.imageFilters',
        'm.skylineFilters',
        'm.updatedAt',
        'm.createdAt',
        'c.id',
      ])
      .where('m.ownerId = :ownerId', { ownerId: authUserId });
    if (campaignId) {
      qb.andWhere('c.id = :cid', { cid: campaignId });
    }
    if (q) {
      qb.andWhere('(LOWER(m.name) LIKE :q OR LOWER(m.description) LIKE :q)', { q: `%${q.toLowerCase()}%` });
    }
    qb.orderBy('m.isPrepared', 'DESC')
      .addOrderBy('m.updatedAt', 'DESC');
    const rows = await qb.getMany();
    // Compute imageAvailable without fetching BLOBs
    const imageCounts = await this.imagesRepo.createQueryBuilder('img')
      .select('img.mapId', 'mapId')
      .addSelect('COUNT(*)', 'cnt')
      .where('img.mapId IN (:...ids)', { ids: rows.map(r => r.id) })
      .groupBy('img.mapId')
      .getRawMany<{ mapId: string; cnt: string }>();
    const skylineCounts = await this.skylinesRepo.createQueryBuilder('img')
      .select('img.mapId', 'mapId')
      .addSelect('COUNT(*)', 'cnt')
      .where('img.mapId IN (:...ids)', { ids: rows.map(r => r.id) })
      .groupBy('img.mapId')
      .getRawMany<{ mapId: string; cnt: string }>();
    const countByMap = new Map(imageCounts.map(r => [r.mapId, Number(r.cnt||0)]));
    const skylineCountByMap = new Map(skylineCounts.map(r => [r.mapId, Number(r.cnt||0)]));
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      group: (r as any).group ?? [],
      timeOfDay: (r as any).timeOfDay,
      isWorldMap: (r as any).isWorldMap ?? false,
      isPrepared: (r as any).isPrepared ?? false,
      fogEnabledByDefault: (r as any).fogEnabledByDefault ?? false,
      musicConfig: (r as any).musicConfig,
      sfxConfig: (r as any).sfxConfig,
      transform: (r as any).transform,
      imageFilters: (r as any).imageFilters,
      skylineFilters: (r as any).skylineFilters,
      campaignId: r.campaign?.id,
      imageAvailable: (countByMap.get(r.id) || 0) > 0,
      skylineAvailable: (skylineCountByMap.get(r.id) || 0) > 0,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Creates a map owned by user. Optionally links to campaign. Optionally stores image.
   */
  /**
   * Create a single map. If dto.name is empty and a file is provided with originalname, use the filename (without extension) as name.
   */
  async create(
    user: User | any,
    dto: CreateMapDto,
    file?: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  ) {
    const entity = new MapEntity();
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    // Load full owner entity to attach relation safely
    const owner = await this.repo.manager.findOne(User, { where: { id: authUserId as any } });
    if (!owner) throw new ForbiddenException('User not found');
    entity.owner = owner;
    // Derive name from file if not provided
    let incomingName = dto.name?.trim();
    if (!incomingName && file?.originalname) {
      const base = file.originalname.replace(/\.[^.]+$/, '');
      incomingName = base.trim();
    }
    entity.name = (incomingName || 'Untitled').slice(0, 200);
    entity.description = dto.description;
    entity.group = dto.group ?? [];
    entity.timeOfDay = (dto.timeOfDay === '' ? null : dto.timeOfDay) ?? null;
    entity.isWorldMap = dto.isWorldMap ?? false;
    (entity as any).fogEnabledByDefault = (dto as any).fogEnabledByDefault ?? false;
    entity.musicConfig = dto.musicConfig ?? null;
    entity.sfxConfig = dto.sfxConfig ?? null;
    (entity as any).transform = (dto as any).transform ?? null;
    (entity as any).imageFilters = (dto as any).imageFilters ?? null;
    (entity as any).skylineFilters = (dto as any).skylineFilters ?? null;
    if (dto.campaignId) {
      const c = await this.campaignsRepo.findOne({ where: { id: dto.campaignId } });
      if (!c) throw new NotFoundException('Campaign not found');
      // Only allow owner of campaign to link
      if (c.owner?.id !== authUserId) throw new ForbiddenException('Not campaign owner');
      entity.campaign = c;
    }
    if (file) {
      // legacy fields mirror
      entity.imageMimeType = file.mimetype;
      entity.imageSize = file.size;
      entity.imageData = file.buffer;
    }
    const saved = await this.repo.save(entity);
    if (file) {
      const variants = await this.buildVariants(file);
      for (const v of variants) v.map = saved as any;
      const savedVariants = await this.imagesRepo.save(variants);
      await this.persistMapVariantsToFs(saved.id, savedVariants);
    }
    return { id: saved.id };
  }

  /**
   * Create multiple maps from a list of files. Names are derived from filenames.
   */
  async createBulk(user: User | any, files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname?: string }>, campaignId?: string) {
    const results: Array<{ id: string; name: string }> = [];
    for (const f of files) {
      const res = await this.create(user, { name: undefined as any, description: undefined, campaignId }, f);
      // Fetch name lightweightly to return it
      const entity = await this.repo.findOne({ where: { id: res.id } });
      results.push({ id: res.id, name: entity?.name || '' });
    }
    return results;
  }

  /**
   * Toggles the isPrepared flag on a map owned by the authenticated user.
   * @returns The new isPrepared value.
   */
  async togglePrepared(user: User | any, id: string) {
    const entity = await this.repo.findOne({ where: { id }, relations: ['owner'] });
    if (!entity) throw new NotFoundException('Map not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    entity.isPrepared = !entity.isPrepared;
    await this.repo.save(entity);
    return { isPrepared: entity.isPrepared };
  }

  async update(
    user: User | any,
    id: string,
    dto: UpdateMapDto,
    file?: { buffer: Buffer; mimetype: string; size: number } | null,
    imageTimeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null,
  ) {
  const entity = await this.repo.findOne({ where: { id }, relations: ['owner'] });
    if (!entity) throw new NotFoundException('Map not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.group !== undefined) (entity as any).group = dto.group ?? [];
    if (dto.timeOfDay !== undefined) (entity as any).timeOfDay = (dto.timeOfDay === '' ? null : dto.timeOfDay) ?? null;
    if (dto.isWorldMap !== undefined) (entity as any).isWorldMap = dto.isWorldMap;
    if (dto.musicConfig !== undefined) (entity as any).musicConfig = dto.musicConfig ?? null;
    if (dto.sfxConfig !== undefined) (entity as any).sfxConfig = dto.sfxConfig ?? null;
    if ((dto as any).transform !== undefined) (entity as any).transform = (dto as any).transform ?? null;
    if ((dto as any).imageFilters !== undefined) (entity as any).imageFilters = (dto as any).imageFilters ?? null;
    if ((dto as any).skylineFilters !== undefined) (entity as any).skylineFilters = (dto as any).skylineFilters ?? null;
    if (dto.isPrepared !== undefined) (entity as any).isPrepared = dto.isPrepared;
    if ((dto as any).fogEnabledByDefault !== undefined) (entity as any).fogEnabledByDefault = (dto as any).fogEnabledByDefault;
    if (dto.campaignId !== undefined) {
      if (!dto.campaignId) {
        entity.campaign = null;
      } else {
        const c = await this.campaignsRepo.findOne({ where: { id: dto.campaignId } });
        if (!c) throw new NotFoundException('Campaign not found');
        if (c.owner?.id !== authUserId) throw new ForbiddenException('Not campaign owner');
        entity.campaign = c;
      }
    }
    if (file) {
      // If a specific TOD is requested for the new image, only replace that TOD's variants
      if (imageTimeOfDay) {
        // Do NOT touch legacy fields to avoid changing the base image unintentionally
        const oldTodVariants = await this.imagesRepo.find({ where: { map: { id } as any, timeOfDay: imageTimeOfDay as any } });
        await this.imagesRepo.createQueryBuilder()
          .delete()
          .from(MapImage)
          .where('mapId = :id', { id })
          .andWhere('timeOfDay = :tod', { tod: imageTimeOfDay })
          .execute();
        await this.cleanupUnreferencedPaths(oldTodVariants.map((v) => v.relativePath));
        const variants = await this.buildVariants(file, imageTimeOfDay);
        for (const v of variants) v.map = entity as any;
        const savedVariants = await this.imagesRepo.save(variants);
        await this.persistMapVariantsToFs(entity.id, savedVariants);
      } else {
        // Replace the base (no TOD) image only, preserving existing TOD-specific variants
        entity.imageMimeType = file.mimetype;
        entity.imageSize = file.size;
        entity.imageData = file.buffer;
        const oldBaseVariants = await this.imagesRepo.find({ where: { map: { id } as any, timeOfDay: null as any } });
        await this.imagesRepo.createQueryBuilder()
          .delete()
          .from(MapImage)
          .where('mapId = :id', { id })
          .andWhere('timeOfDay IS NULL')
          .execute();
        await this.cleanupUnreferencedPaths(oldBaseVariants.map((v) => v.relativePath));
        const variants = await this.buildVariants(file, null);
        for (const v of variants) v.map = entity as any;
        const savedVariants = await this.imagesRepo.save(variants);
        await this.persistMapVariantsToFs(entity.id, savedVariants);
      }
    } else if (file === null) {
      // Explicit remove image when null is passed
      entity.imageMimeType = null;
      entity.imageSize = null;
      entity.imageData = null;
      // Remove all variants
      const oldVariants = await this.imagesRepo.find({ where: { map: { id } as any } });
      await this.imagesRepo.createQueryBuilder()
        .delete()
        .from(MapImage)
        .where('mapId = :id', { id })
        .execute();
      await this.cleanupUnreferencedPaths(oldVariants.map((v) => v.relativePath));
    }
    await this.repo.save(entity);
    return { ok: true };
  }

  /**
   * Lists maps from other campaigns (excluding the given campaign) owned by the user.
   * Returns a lightweight DTO with campaignName for display in the UI.
   * @param user - Authenticated JWT payload.
   * @param excludeCampaignId - The active campaign to exclude from results.
   */
  async listFromOtherCampaigns(user: User | any, excludeCampaignId: string) {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const qb = this.repo.createQueryBuilder('m')
      .leftJoin('m.campaign', 'c')
      .select([
        'm.id',
        'm.name',
        'm.description',
        'm.group',
        'm.timeOfDay',
        'm.isWorldMap',
        'm.isPrepared',
        'm.fogEnabledByDefault',
        'm.musicConfig',
        'm.sfxConfig',
        'm.transform',
        'm.updatedAt',
        'm.createdAt',
        'c.id',
        'c.name',
      ])
      .where('m.ownerId = :ownerId', { ownerId: authUserId })
      .andWhere('c.id IS NOT NULL')
      .andWhere('c.id != :excludeId', { excludeId: excludeCampaignId })
      .orderBy('c.name', 'ASC')
      .addOrderBy('m.name', 'ASC');

    const rows = await qb.getMany();

    // Compute imageAvailable without fetching BLOBs
    const ids = rows.map(r => r.id);
    let countByMap = new Map<string, number>();
    let skylineCountByMap = new Map<string, number>();
    if (ids.length > 0) {
      const imageCounts = await this.imagesRepo.createQueryBuilder('img')
        .select('img.mapId', 'mapId')
        .addSelect('COUNT(*)', 'cnt')
        .where('img.mapId IN (:...ids)', { ids })
        .groupBy('img.mapId')
        .getRawMany<{ mapId: string; cnt: string }>();
      const skylineCounts = await this.skylinesRepo.createQueryBuilder('img')
        .select('img.mapId', 'mapId')
        .addSelect('COUNT(*)', 'cnt')
        .where('img.mapId IN (:...ids)', { ids })
        .groupBy('img.mapId')
        .getRawMany<{ mapId: string; cnt: string }>();
      countByMap = new Map(imageCounts.map(r => [r.mapId, Number(r.cnt || 0)]));
      skylineCountByMap = new Map(skylineCounts.map(r => [r.mapId, Number(r.cnt || 0)]));
    }

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      group: (r as any).group ?? [],
      timeOfDay: (r as any).timeOfDay,
      isWorldMap: (r as any).isWorldMap ?? false,
      isPrepared: (r as any).isPrepared ?? false,
      fogEnabledByDefault: (r as any).fogEnabledByDefault ?? false,
      musicConfig: (r as any).musicConfig,
      sfxConfig: (r as any).sfxConfig,
      transform: (r as any).transform,
      campaignId: r.campaign?.id,
      campaignName: (r.campaign as any)?.name ?? null,
      imageAvailable: (countByMap.get(r.id) || 0) > 0,
      skylineAvailable: (skylineCountByMap.get(r.id) || 0) > 0,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Imports (clones) a map from another campaign into the target campaign.
   * Copies all images, skylines, musicConfig, sfxConfig, transform, and metadata.
   * Adds a note in the description indicating the original campaign.
   * @param user - Authenticated JWT payload.
   * @param sourceMapId - UUID of the map to clone.
   * @param targetCampaignId - UUID of the campaign to import into.
   * @returns The newly created map's id.
   */
  async importMapToCampaign(user: User | any, sourceMapId: string, targetCampaignId: string): Promise<{ id: string }> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    // Load source map with campaign relation
    const source = await this.repo.findOne({
      where: { id: sourceMapId },
      relations: ['owner', 'campaign'],
    });
    if (!source) throw new NotFoundException('Source map not found');
    if (source.owner.id !== authUserId) throw new ForbiddenException('Not owner of source map');

    // Validate target campaign
    const targetCampaign = await this.campaignsRepo.findOne({ where: { id: targetCampaignId } });
    if (!targetCampaign) throw new NotFoundException('Target campaign not found');
    if (targetCampaign.owner?.id !== authUserId) throw new ForbiddenException('Not owner of target campaign');

    // Build origin label for description
    const originCampaignName = (source.campaign as any)?.name ?? 'otra campaña';
    const originNote = `[Importado de: ${originCampaignName}]`;
    const newDescription = source.description
      ? `${originNote}\n${source.description}`
      : originNote;

    // Create new map entity
    const newMap = new MapEntity();
    newMap.owner = source.owner;
    newMap.campaign = targetCampaign;
    newMap.name = source.name;
    newMap.description = newDescription;
    newMap.group = source.group ?? [];
    newMap.timeOfDay = source.timeOfDay ?? null;
    newMap.isWorldMap = source.isWorldMap ?? false;
    newMap.musicConfig = source.musicConfig ?? null;
    newMap.sfxConfig = source.sfxConfig ?? null;
    (newMap as any).transform = (source as any).transform ?? null;
    newMap.isPrepared = false;
    // Copy legacy image fields
    newMap.imageMimeType = source.imageMimeType ?? null;
    newMap.imageSize = source.imageSize ?? null;
    newMap.imageData = source.imageData ?? null;

    const saved = await this.repo.save(newMap);

    // Clone MapImage variants
    const sourceImages = await this.imagesRepo.find({ where: { map: { id: sourceMapId } as any } });
    if (sourceImages.length > 0) {
      const preparedImages = await Promise.all(sourceImages.map((img) => this.ensureMapImageHasSharedPath(img, sourceMapId)));
      const clonedImages = preparedImages.map(img => {
        const clone = new MapImage();
        clone.variant = img.variant;
        clone.timeOfDay = img.timeOfDay;
        clone.mimeType = img.mimeType;
        clone.size = img.size;
        clone.data = img.data;
        clone.storageKind = img.relativePath ? 'fs' : (img.storageKind ?? null);
        clone.relativePath = img.relativePath ?? null;
        clone.originalFileName = img.originalFileName ?? null;
        clone.migratedAt = img.migratedAt ?? null;
        clone.map = saved as any;
        return clone;
      });
      await this.imagesRepo.save(clonedImages);
    }

    // Clone MapSkylineImage variants
    const sourceSkylines = await this.skylinesRepo.find({ where: { map: { id: sourceMapId } as any } });
    if (sourceSkylines.length > 0) {
      const preparedSkylines = await Promise.all(sourceSkylines.map((img) => this.ensureSkylineImageHasSharedPath(img, sourceMapId)));
      const clonedSkylines = preparedSkylines.map(img => {
        const clone = new MapSkylineImage();
        clone.variant = img.variant;
        clone.timeOfDay = img.timeOfDay;
        clone.mimeType = img.mimeType;
        clone.size = img.size;
        clone.data = img.data;
        clone.storageKind = img.relativePath ? 'fs' : (img.storageKind ?? null);
        clone.relativePath = img.relativePath ?? null;
        clone.originalFileName = img.originalFileName ?? null;
        clone.migratedAt = img.migratedAt ?? null;
        clone.map = saved as any;
        return clone;
      });
      await this.skylinesRepo.save(clonedSkylines);
    }

    return { id: saved.id };
  }

  async remove(user: User | any, id: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return { ok: true };
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not owner');

    // Clear FK references from campaigns pointing to this map (activeMap),
    // to avoid SQLITE_CONSTRAINT FOREIGN KEY errors on delete.
    await this.campaignsRepo
      .createQueryBuilder()
      .update(Campaign)
      .set({ activeMap: null } as any)
      .where('activeMapId = :id', { id })
      .execute();

    const [mapVariants, skylineVariants] = await Promise.all([
      this.imagesRepo.find({ where: { map: { id } as any } }),
      this.skylinesRepo.find({ where: { map: { id } as any } }),
    ]);

    await this.repo.remove(entity);

    await this.cleanupUnreferencedPaths([
      ...mapVariants.map((v) => v.relativePath),
      ...skylineVariants.map((v) => v.relativePath),
    ]);

    await this.deleteMapMediaDirectory(id, entity.mediaFolder ?? null);
    return { ok: true };
  }

  async streamImage(
    user: User | any,
    id: string,
    size?: 'thumb' | 'preview' | 'full',
    timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null,
    strict?: boolean,
  ) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Map not found');
    // Owner of the map or owner of the campaign can stream. For simplicity use owner check.
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not allowed');

    const variant = size || 'full';

    let img = await this.findMapImageVariant(id, variant, timeOfDay ?? null, strict);
    if (!img && variant === 'thumb' && !strict) {
      await this.ensureThumbVariant(entity, timeOfDay ?? null);
      img = await this.findMapImageVariant(id, variant, timeOfDay ?? null, false);
    }

    if (img) {
      const imageBuffer = await this.getMapImageBuffer(img, id);
      if (imageBuffer) return { buffer: imageBuffer, mimeType: img.mimeType };
    }

    if (variant === 'thumb') {
      const previewImg = await this.findMapImageVariant(id, 'preview', timeOfDay ?? null, strict);
      if (previewImg) {
        const previewBuffer = await this.getMapImageBuffer(previewImg, id);
        if (previewBuffer) return { buffer: previewBuffer, mimeType: previewImg.mimeType };
      }
    }

    // Fallback to legacy
    if (variant === 'thumb') throw new NotFoundException('No thumbnail image');
    if (entity.imageData && entity.imageMimeType) return { buffer: entity.imageData, mimeType: entity.imageMimeType };
    throw new NotFoundException('No image');
  }

  async streamSkyline(
    user: User | any,
    id: string,
    size?: 'thumb' | 'preview' | 'full',
    timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null,
    strict?: boolean,
  ) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Map not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not allowed');
    const variant = size || 'full';
    let img: MapSkylineImage | null = null as any;
    if (timeOfDay !== undefined && timeOfDay !== null) {
      img = await this.skylinesRepo.findOne({ where: { map: { id } as any, variant, timeOfDay: timeOfDay as any } });
      if (!strict) {
        if (!img) img = await this.skylinesRepo.findOne({ where: { map: { id } as any, variant, timeOfDay: null as any } });
        if (!img) img = await this.skylinesRepo.findOne({ where: { map: { id } as any, variant } });
      }
    } else {
      if (!strict) {
        img = await this.skylinesRepo.findOne({ where: { map: { id } as any, variant, timeOfDay: null as any } });
        if (!img) img = await this.skylinesRepo.findOne({ where: { map: { id } as any, variant } });
      }
    }
    if (img) {
      const imageBuffer = await this.getSkylineImageBuffer(img, id);
      if (imageBuffer) return { buffer: imageBuffer, mimeType: img.mimeType };
    }
    throw new NotFoundException('No skyline image');
  }

  /** Attach a new skyline image specifically for a given time-of-day, keeping existing skyline images for other TODs. */
  async uploadSkylineForTod(user: User | any, id: string, file: { buffer: Buffer; mimetype: string; size: number }, tod: 'dawn' | 'morning' | 'afternoon' | 'night') {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Map not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    const oldVariants = await this.skylinesRepo.find({ where: { map: { id } as any, timeOfDay: tod as any } });
    await this.skylinesRepo.createQueryBuilder()
      .delete()
      .from(MapSkylineImage)
      .where('mapId = :id', { id })
      .andWhere('timeOfDay = :tod', { tod })
      .execute();
    await this.cleanupUnreferencedPaths(oldVariants.map((v) => v.relativePath));
    const variants = await this.buildSkylineVariants(file, tod);
    for (const v of variants) v.map = entity as any;
    const savedVariants = await this.skylinesRepo.save(variants);
    await this.persistSkylineVariantsToFs(entity.id, savedVariants);
    return { ok: true };
  }

  /** Attach a new image specifically for a given time-of-day, keeping existing images for other TODs. */
  async uploadImageForTod(user: User | any, id: string, file: { buffer: Buffer; mimetype: string; size: number }, tod: 'dawn' | 'morning' | 'afternoon' | 'night') {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Map not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    // Remove existing images for this TOD (all variants)
    const oldVariants = await this.imagesRepo.find({ where: { map: { id } as any, timeOfDay: tod as any } });
    await this.imagesRepo.createQueryBuilder()
      .delete()
      .from(MapImage)
      .where('mapId = :id', { id })
      .andWhere('timeOfDay = :tod', { tod })
      .execute();
    await this.cleanupUnreferencedPaths(oldVariants.map((v) => v.relativePath));
    const variants = await this.buildVariants(file, tod);
    for (const v of variants) v.map = entity as any;
    const savedVariants = await this.imagesRepo.save(variants);
    await this.persistMapVariantsToFs(entity.id, savedVariants);
    return { ok: true };
  }

  /**
   * Returns total storage usage (in bytes) for all map-related binary data and the count of maps.
   * - totalSize includes: MapImage variants, MapSkylineImage variants, and legacy MapEntity.imageSize when present.
   * - Always scoped to the authenticated owner; optionally filtered by campaignId.
   */
  async getUsage(
    user: User | any,
    campaignId?: string | null,
  ): Promise<{ totalSize: number; count: number; physicalTotalSize: number; sharedSavings: number }> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    // Count maps owned by user (optionally within campaign)
    const mapCountQb = this.repo.createQueryBuilder('map')
      .where('map.ownerId = :ownerId', { ownerId: authUserId });
    if (campaignId) mapCountQb.andWhere('map.campaignId = :campaignId', { campaignId });
    const count = await mapCountQb.getCount();

    // Sum of MapImage.size (join to map for ownership/campaign filter)
    const imgRaw = await this.imagesRepo.createQueryBuilder('img')
      .innerJoin('img.map', 'map')
      .where('map.ownerId = :ownerId', { ownerId: authUserId })
      .andWhere(campaignId ? 'map.campaignId = :campaignId' : '1=1', { campaignId })
      .select('SUM(img.size)', 'total')
      .getRawOne<{ total: string | null }>();
    const totalImages = imgRaw?.total ? parseInt(imgRaw.total, 10) : 0;

    // Sum of MapSkylineImage.size
    const skyRaw = await this.skylinesRepo.createQueryBuilder('img')
      .innerJoin('img.map', 'map')
      .where('map.ownerId = :ownerId', { ownerId: authUserId })
      .andWhere(campaignId ? 'map.campaignId = :campaignId' : '1=1', { campaignId })
      .select('SUM(img.size)', 'total')
      .getRawOne<{ total: string | null }>();
    const totalSkylines = skyRaw?.total ? parseInt(skyRaw.total, 10) : 0;

    // Sum of legacy MapEntity.imageSize
    const legacyRaw = await this.repo.createQueryBuilder('map')
      .where('map.ownerId = :ownerId', { ownerId: authUserId })
      .andWhere(campaignId ? 'map.campaignId = :campaignId' : '1=1', { campaignId })
      .andWhere('map.imageSize IS NOT NULL')
      .select('SUM(map.imageSize)', 'total')
      .getRawOne<{ total: string | null }>();
    const totalLegacy = legacyRaw?.total ? parseInt(legacyRaw.total, 10) : 0;

    const totalSize = (totalImages || 0) + (totalSkylines || 0) + (totalLegacy || 0);
    const referencedPaths = await this.getReferencedRelativePathsForOwner(authUserId, campaignId);
    const physicalTotalSize = await this.computePhysicalSize(referencedPaths);
    const sharedSavings = Math.max(0, totalSize - physicalTotalSize);
    return { totalSize, count, physicalTotalSize, sharedSavings };
  }

  // ─── World-Map Markers ──────────────────────────────────────────────────────

  /**
   * Returns all markers placed on a map within a campaign, scoped to the
   * authenticated owner.
   *
   * @param user  - Authenticated JWT payload.
   * @param mapId - UUID of the parent MapEntity.
   * @param campaignId - Campaign scope.
   * @returns Ordered list of MapMarker records (oldest first).
   */
  async listMarkers(user: any, mapId: string, campaignId: string): Promise<MapMarker[]> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const map = await this.repo.findOne({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');
    if (map.owner.id !== authUserId) throw new ForbiddenException('Not owner');

    return this.markersRepo.find({
      where: { mapId, campaignId, ownerId: authUserId as any },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Creates a new marker on a world-map for the given campaign.
   *
   * @param user  - Authenticated JWT payload.
   * @param mapId - UUID of the parent MapEntity.
   * @param dto   - Marker creation payload.
   * @returns The newly persisted MapMarker.
   */
  async createMarker(user: any, mapId: string, dto: CreateMapMarkerDto): Promise<MapMarker> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const map = await this.repo.findOne({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');
    if (map.owner.id !== authUserId) throw new ForbiddenException('Not owner');

    const campaign = await this.campaignsRepo.findOne({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const marker = this.markersRepo.create({
      mapId,
      campaignId: dto.campaignId,
      ownerId: authUserId as any,
      name: dto.name,
      icon: dto.icon ?? '📍',
      notes: dto.notes ?? null,
      x: dto.x,
      y: dto.y,
      visibleToPlayers: dto.visibleToPlayers ?? false,
      associated: dto.associated ?? null,
    });

    return this.markersRepo.save(marker);
  }

  /**
   * Applies a partial update to an existing marker, validating ownership.
   *
   * @param user     - Authenticated JWT payload.
   * @param mapId    - UUID of the parent MapEntity.
   * @param markerId - UUID of the marker to update.
   * @param dto      - Partial marker update payload.
   * @returns The updated MapMarker.
   */
  async updateMarker(user: any, mapId: string, markerId: string, dto: UpdateMapMarkerDto): Promise<MapMarker> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const marker = await this.markersRepo.findOne({ where: { id: markerId, mapId } });
    if (!marker) throw new NotFoundException('Marker not found');
    if (marker.ownerId !== authUserId) throw new ForbiddenException('Not owner');

    if (dto.name !== undefined) marker.name = dto.name;
    if (dto.icon !== undefined) marker.icon = dto.icon;
    if (dto.notes !== undefined) marker.notes = dto.notes ?? null;
    if (dto.x !== undefined) marker.x = dto.x;
    if (dto.y !== undefined) marker.y = dto.y;
    if (dto.visibleToPlayers !== undefined) marker.visibleToPlayers = dto.visibleToPlayers;
    if (dto.associated !== undefined) marker.associated = dto.associated ?? null;

    return this.markersRepo.save(marker);
  }

  /**
   * Deletes a marker after verifying ownership.
   *
   * @param user     - Authenticated JWT payload.
   * @param mapId    - UUID of the parent MapEntity.
   * @param markerId - UUID of the marker to delete.
   */
  async deleteMarker(user: any, mapId: string, markerId: string): Promise<{ ok: true }> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const marker = await this.markersRepo.findOne({ where: { id: markerId, mapId } });
    if (!marker) throw new NotFoundException('Marker not found');
    if (marker.ownerId !== authUserId) throw new ForbiddenException('Not owner');

    await this.markersRepo.remove(marker);
    return { ok: true };
  }
}
