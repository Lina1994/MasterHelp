import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapEntity } from './entities/map.entity';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { User } from '../users/entities/user.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { MapImage } from './entities/map-image.entity';
import sharp from 'sharp';

@Injectable()
export class MapsService {
  constructor(
    @InjectRepository(MapEntity) private readonly repo: Repository<MapEntity>,
    @InjectRepository(MapImage) private readonly imagesRepo: Repository<MapImage>,
    @InjectRepository(Campaign) private readonly campaignsRepo: Repository<Campaign>,
  ) {}

  /** Generate sharp-based variants. Falls back to only 'full' if processing fails. */
  private async buildVariants(file: { buffer: Buffer; mimetype: string; size: number }): Promise<MapImage[]> {
    const variants: MapImage[] = [];
    // Full (original)
    const full = new MapImage();
    full.variant = 'full';
    full.mimeType = file.mimetype;
    full.size = file.size;
    full.data = file.buffer;
    variants.push(full);
    try {
      const previewBuf = await sharp(file.buffer).resize({ width: 1280, withoutEnlargement: true }).toBuffer();
      const preview = new MapImage();
      preview.variant = 'preview';
      preview.mimeType = file.mimetype;
      preview.size = previewBuf.length;
      preview.data = previewBuf;
      variants.push(preview);
      const thumbBuf = await sharp(file.buffer).resize({ width: 256, withoutEnlargement: true }).toBuffer();
      const thumb = new MapImage();
      thumb.variant = 'thumb';
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

  /** Extract consistent user id from JWT payload or entity */
  private extractAuthUserId(user: any): string | number | undefined {
    return user?.id ?? user?.userId;
  }

  /**
   * Returns maps owned by the user, optionally filtered by campaignId and search query.
   */
  async listOwned(user: User | any, q?: string, campaignId?: string) {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    const qb = this.repo.createQueryBuilder('m')
      .leftJoin('m.campaign', 'c')
      .leftJoinAndSelect('m.images', 'images')
      .where('m.ownerId = :ownerId', { ownerId: authUserId });
    if (campaignId) {
      qb.andWhere('c.id = :cid', { cid: campaignId });
    }
    if (q) {
      qb.andWhere('(LOWER(m.name) LIKE :q OR LOWER(m.description) LIKE :q)', { q: `%${q.toLowerCase()}%` });
    }
    qb.orderBy('m.updatedAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      group: (r as any).group,
      timeOfDay: (r as any).timeOfDay,
      isWorldMap: (r as any).isWorldMap ?? false,
      musicConfig: (r as any).musicConfig,
      sfxConfig: (r as any).sfxConfig,
      campaignId: r.campaign?.id,
      imageAvailable: !!r.imageData || (Array.isArray((r as any).images) && (r as any).images.length > 0),
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
  entity.timeOfDay = dto.timeOfDay ?? null;
  entity.isWorldMap = dto.isWorldMap ?? false;
  entity.musicConfig = dto.musicConfig ?? null;
  entity.sfxConfig = dto.sfxConfig ?? null;
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

  async update(user: User | any, id: string, dto: UpdateMapDto, file?: { buffer: Buffer; mimetype: string; size: number } | null) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Map not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.description !== undefined) entity.description = dto.description;
  if (dto.group !== undefined) (entity as any).group = dto.group ?? null;
  if (dto.timeOfDay !== undefined) (entity as any).timeOfDay = dto.timeOfDay ?? null;
  if (dto.isWorldMap !== undefined) (entity as any).isWorldMap = dto.isWorldMap;
  if (dto.musicConfig !== undefined) (entity as any).musicConfig = dto.musicConfig ?? null;
  if (dto.sfxConfig !== undefined) (entity as any).sfxConfig = dto.sfxConfig ?? null;
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
      entity.imageMimeType = file.mimetype;
      entity.imageSize = file.size;
      entity.imageData = file.buffer;
      // Regenerate all variants
      await this.imagesRepo.delete({ map: { id } as any });
      const variants = await this.buildVariants(file);
      for (const v of variants) v.map = entity as any;
      await this.imagesRepo.save(variants);
    } else if (file === null) {
      // Explicit remove image when null is passed
      entity.imageMimeType = null;
      entity.imageSize = null;
      entity.imageData = null;
      // Remove all variants
      await this.imagesRepo.delete({ map: { id } as any });
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
    await this.repo.remove(entity);
    return { ok: true };
  }

  async streamImage(user: User | any, id: string, size?: 'thumb' | 'preview' | 'full') {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Map not found');
    // Owner of the map or owner of the campaign can stream. For simplicity use owner check.
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    if (entity.owner.id !== authUserId) throw new ForbiddenException('Not allowed');
    // Try variant first
    const variant = size || 'full';
    const img = await this.imagesRepo.findOne({ where: { map: { id } as any, variant } });
    if (img) return { buffer: img.data, mimeType: img.mimeType };
    // Fallback to legacy
    if (entity.imageData && entity.imageMimeType) return { buffer: entity.imageData, mimeType: entity.imageMimeType };
    throw new NotFoundException('No image');
  }
}
