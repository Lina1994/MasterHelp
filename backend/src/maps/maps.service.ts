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
import { MapFogState } from './entities/map-fog-state.entity';
import { MapTokensState, MapTokenItem } from './entities/map-tokens-state.entity';
import sharp from 'sharp';

@Injectable()
export class MapsService {
  constructor(
    @InjectRepository(MapEntity) private readonly repo: Repository<MapEntity>,
    @InjectRepository(MapImage) private readonly imagesRepo: Repository<MapImage>,
    @InjectRepository(MapSkylineImage) private readonly skylinesRepo: Repository<MapSkylineImage>,
    @InjectRepository(MapFogState) private readonly fogRepo: Repository<MapFogState>,
    @InjectRepository(MapTokensState) private readonly tokensRepo: Repository<MapTokensState>,
    @InjectRepository(Campaign) private readonly campaignsRepo: Repository<Campaign>,
    @InjectRepository(MapMarker) private readonly markersRepo: Repository<MapMarker>,
  ) {}

  /**
   * Returns Fog of War cells for the given map+campaign scoped to owner.
   * Validates ownership and existence of referenced entities.
   */
  async getFog(user: User | any, mapId: string, campaignId: string): Promise<string[]> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    const map = await this.repo.findOne({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');
    if (map.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== authUserId) throw new ForbiddenException('Not campaign owner');
    const existing = await this.fogRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    return existing?.cells || [];
  }

  /**
   * Upserts Fog of War cells for the given map+campaign scoped to owner.
   * Validates ownership and prevents unauthorized writes.
   */
  async setFog(user: User | any, mapId: string, campaignId: string, cells: string[]): Promise<{ ok: boolean }>{
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    const map = await this.repo.findOne({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');
    if (map.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== authUserId) throw new ForbiddenException('Not campaign owner');
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
   * Returns token items for the given map+campaign scoped to owner.
   */
  async getTokens(user: User | any, mapId: string, campaignId: string): Promise<MapTokenItem[]> {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    const map = await this.repo.findOne({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');
    if (map.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== authUserId) throw new ForbiddenException('Not campaign owner');
    const existing = await this.tokensRepo.findOne({ where: { owner: { id: authUserId } as any, campaign: { id: campaignId } as any, map: { id: mapId } as any } });
    return existing?.tokens || [];
  }

  /**
   * Upserts token items for the given map+campaign scoped to owner.
   */
  async setTokens(user: User | any, mapId: string, campaignId: string, tokens: MapTokenItem[]): Promise<{ ok: boolean }>{
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    const map = await this.repo.findOne({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');
    if (map.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== authUserId) throw new ForbiddenException('Not campaign owner');
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
      const previewBuf = await sharp(file.buffer).resize({ width: 1280, withoutEnlargement: true }).toBuffer();
      const preview = new MapImage();
      preview.variant = 'preview';
      preview.timeOfDay = timeOfDay ?? null;
      preview.mimeType = file.mimetype;
      preview.size = previewBuf.length;
      preview.data = previewBuf;
      variants.push(preview);
      const thumbBuf = await sharp(file.buffer).resize({ width: 256, withoutEnlargement: true }).toBuffer();
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
      const previewBuf = await sharp(file.buffer).resize({ width: 1280, withoutEnlargement: true }).toBuffer();
      const preview = new MapSkylineImage();
      preview.variant = 'preview';
      preview.timeOfDay = timeOfDay ?? null;
      preview.mimeType = file.mimetype;
      preview.size = previewBuf.length;
      preview.data = previewBuf;
      variants.push(preview);
      const thumbBuf = await sharp(file.buffer).resize({ width: 256, withoutEnlargement: true }).toBuffer();
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
        'm.musicConfig',
        'm.sfxConfig',
        'm.transform',
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
    qb.orderBy('m.updatedAt', 'DESC');
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
      group: (r as any).group,
      timeOfDay: (r as any).timeOfDay,
      isWorldMap: (r as any).isWorldMap ?? false,
      musicConfig: (r as any).musicConfig,
      sfxConfig: (r as any).sfxConfig,
      transform: (r as any).transform,
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
    entity.group = dto.group ?? null;
    entity.timeOfDay = (dto.timeOfDay === '' ? null : dto.timeOfDay) ?? null;
    entity.isWorldMap = dto.isWorldMap ?? false;
    entity.musicConfig = dto.musicConfig ?? null;
    entity.sfxConfig = dto.sfxConfig ?? null;
    (entity as any).transform = (dto as any).transform ?? null;
    if (dto.campaignId) {
      const c = await this.campaignsRepo.findOne({ where: { id: dto.campaignId } });
      if (!c) throw new NotFoundException('Campaign not found');
      // Only allow owner of campaign to link
      if (c.owner?.id !== authUserId) throw new ForbiddenException('Not campaign owner');
      entity.campaign = c;
    }
    if (file) {
      const variants = await this.buildVariants(file);
      // Attach relation
      for (const v of variants) v.map = entity as any;
      // legacy fields mirror
      entity.imageMimeType = file.mimetype;
      entity.imageSize = file.size;
      entity.imageData = file.buffer;
      entity.images = variants;
    }
    const saved = await this.repo.save(entity);
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
    if (dto.group !== undefined) (entity as any).group = dto.group ?? null;
    if (dto.timeOfDay !== undefined) (entity as any).timeOfDay = (dto.timeOfDay === '' ? null : dto.timeOfDay) ?? null;
    if (dto.isWorldMap !== undefined) (entity as any).isWorldMap = dto.isWorldMap;
    if (dto.musicConfig !== undefined) (entity as any).musicConfig = dto.musicConfig ?? null;
    if (dto.sfxConfig !== undefined) (entity as any).sfxConfig = dto.sfxConfig ?? null;
    if ((dto as any).transform !== undefined) (entity as any).transform = (dto as any).transform ?? null;
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
        await this.imagesRepo.createQueryBuilder()
          .delete()
          .from(MapImage)
          .where('mapId = :id', { id })
          .andWhere('timeOfDay = :tod', { tod: imageTimeOfDay })
          .execute();
        const variants = await this.buildVariants(file, imageTimeOfDay);
        for (const v of variants) v.map = entity as any;
        await this.imagesRepo.save(variants);
      } else {
        // Replace the base (no TOD) image only, preserving existing TOD-specific variants
        entity.imageMimeType = file.mimetype;
        entity.imageSize = file.size;
        entity.imageData = file.buffer;
        await this.imagesRepo.createQueryBuilder()
          .delete()
          .from(MapImage)
          .where('mapId = :id', { id })
          .andWhere('timeOfDay IS NULL')
          .execute();
        const variants = await this.buildVariants(file, null);
        for (const v of variants) v.map = entity as any;
        await this.imagesRepo.save(variants);
      }
    } else if (file === null) {
      // Explicit remove image when null is passed
      entity.imageMimeType = null;
      entity.imageSize = null;
      entity.imageData = null;
      // Remove all variants
      await this.imagesRepo.createQueryBuilder()
        .delete()
        .from(MapImage)
        .where('mapId = :id', { id })
        .execute();
    }
    await this.repo.save(entity);
    return { ok: true };
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

    await this.repo.remove(entity);
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
    // Try variant first
    const variant = size || 'full';
    // Try to fetch variant matching timeOfDay first (if provided)
    let img: MapImage | null = null as any;
    if (timeOfDay !== undefined && timeOfDay !== null) {
      img = await this.imagesRepo.findOne({ where: { map: { id } as any, variant, timeOfDay: timeOfDay as any } });
      if (!strict) {
        // If not found, try base (null TOD)
        if (!img) img = await this.imagesRepo.findOne({ where: { map: { id } as any, variant, timeOfDay: null as any } });
        // Finally, any TOD
        if (!img) img = await this.imagesRepo.findOne({ where: { map: { id } as any, variant } });
      }
    } else {
      if (!strict) {
        // No specific TOD requested: prefer base (null TOD), then any
        img = await this.imagesRepo.findOne({ where: { map: { id } as any, variant, timeOfDay: null as any } });
        if (!img) img = await this.imagesRepo.findOne({ where: { map: { id } as any, variant } });
      }
    }
    if (img) return { buffer: img.data, mimeType: img.mimeType };
    // Fallback to legacy
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
    if (img) return { buffer: img.data, mimeType: img.mimeType };
    throw new NotFoundException('No skyline image');
  }

  /** Attach a new skyline image specifically for a given time-of-day, keeping existing skyline images for other TODs. */
  async uploadSkylineForTod(user: User | any, id: string, file: { buffer: Buffer; mimetype: string; size: number }, tod: 'dawn' | 'morning' | 'afternoon' | 'night') {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Map not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    await this.skylinesRepo.createQueryBuilder()
      .delete()
      .from(MapSkylineImage)
      .where('mapId = :id', { id })
      .andWhere('timeOfDay = :tod', { tod })
      .execute();
    const variants = await this.buildSkylineVariants(file, tod);
    for (const v of variants) v.map = entity as any;
    await this.skylinesRepo.save(variants);
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
    await this.imagesRepo.createQueryBuilder()
      .delete()
      .from(MapImage)
      .where('mapId = :id', { id })
      .andWhere('timeOfDay = :tod', { tod })
      .execute();
    const variants = await this.buildVariants(file, tod);
    for (const v of variants) v.map = entity as any;
    await this.imagesRepo.save(variants);
    return { ok: true };
  }

  /**
   * Returns total storage usage (in bytes) for all map-related binary data and the count of maps.
   * - totalSize includes: MapImage variants, MapSkylineImage variants, and legacy MapEntity.imageSize when present.
   * - Always scoped to the authenticated owner; optionally filtered by campaignId.
   */
  async getUsage(user: User | any, campaignId?: string | null): Promise<{ totalSize: number; count: number }> {
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
    return { totalSize, count };
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
