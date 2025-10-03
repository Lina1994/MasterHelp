import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Song } from './entities/song.entity';
import { User } from '../users/entities/user.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';

@Injectable()
export class SoundtrackService {
  constructor(
    @InjectRepository(Song) private songsRepo: Repository<Song>,
    @InjectRepository(Campaign) private campaignsRepo: Repository<Campaign>,
  ) {}

  /**
   * Extrae un identificador de usuario consistente desde el objeto de autenticación.
   * Acepta tanto `user.id` como `user.userId` y devuelve undefined si no existe.
   */
  private extractAuthUserId(user: any): string | number | undefined {
    return user?.id ?? user?.userId;
  }

  async create(owner: User | any, dto: CreateSongDto, file?: { buffer: Buffer; mimetype: string; size: number }, fetched?: { data: Buffer; mimeType: string }): Promise<Song> {
    if (!file && !dto.url) {
      throw new BadRequestException('Provide either a file or an url');
    }
    if (file && dto.url) {
      throw new BadRequestException('Provide file or url, not both');
    }
    const song = new Song();
    song.name = dto.name;
    song.group = dto.group;
    song.isPublic = dto.isPublic ?? false;
    // Si llega sólo el payload JWT (userId, username) necesitaríamos cargar el User completo.
    // Para evitar sobre-consulta, si no existe owner.id hacemos un lookup mínimo.
    if (!owner?.id) {
      const authUserId = this.extractAuthUserId(owner);
      if (!authUserId) throw new ForbiddenException('Invalid auth context');
      const fullOwner = await (this.songsRepo.manager).findOne(User, { where: { id: authUserId as any } });
      if (!fullOwner) throw new ForbiddenException('User not found');
      song.owner = fullOwner;
    } else {
      song.owner = owner;
    }
    if (file) {
      song.data = file.buffer;
      song.mimeType = file.mimetype;
      song.size = file.size;
    } else if (fetched) {
      song.data = fetched.data;
      song.mimeType = fetched.mimeType;
      song.size = fetched.data.length;
      song.originalSource = dto.url;
    } else {
      throw new BadRequestException('No audio source provided');
    }
    song.campaigns = [];
    // Auto-asociar si se proporciona campaignId y la campaña pertenece al owner
    if (dto.campaignId) {
      const campaign = await this.campaignsRepo.findOne({ where: { id: dto.campaignId } });
      const authUserId = this.extractAuthUserId(owner);
      if (campaign && campaign.owner.id === authUserId) {
        song.campaigns = [campaign];
      }
    }
    return this.songsRepo.save(song);
  }

  async findSectionedForCampaign(user: User | any, campaignId: string, q?: string, group?: string, includeOthers = true) {
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const authUserId = this.extractAuthUserId(user);
    // Associated songs to this campaign
    const associatedQB = this.songsRepo
      .createQueryBuilder('song')
      .leftJoin('song.campaigns', 'c')
      .where('c.id = :campaignId', { campaignId });
    // Filtering
    if (q) associatedQB.andWhere('LOWER(song.name) LIKE :q', { q: `%${q.toLowerCase()}%` });
    if (group) associatedQB.andWhere('song.group = :group', { group });

    // Players: only public songs
  const isMaster = campaign.owner.id === authUserId;
    if (!isMaster) {
      associatedQB.andWhere('song.isPublic = :pub', { pub: true });
    }

    const associated = await associatedQB.getMany();

    let reusable: Song[] = [];
    if (includeOthers && isMaster) {
      const reusableQB = this.songsRepo
        .createQueryBuilder('song')
        .leftJoin('song.campaigns', 'c')
        .where('song.ownerId = :ownerId', { ownerId: authUserId })
        .andWhere('(c.id IS NULL OR c.id != :campaignId)', { campaignId });
      if (q) reusableQB.andWhere('LOWER(song.name) LIKE :q', { q: `%${q.toLowerCase()}%` });
      if (group) reusableQB.andWhere('song.group = :group', { group });
      reusable = await reusableQB.getMany();
    }
    return { associated, reusable };
  }

  async update(owner: User | any, songId: string, dto: UpdateSongDto) {
    const song = await this.songsRepo.findOne({ where: { id: songId }, relations: ['owner'] });
    if (!song) throw new NotFoundException('Song not found');
    const authUserId = this.extractAuthUserId(owner);
    if (song.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    if (dto.name !== undefined) song.name = dto.name;
    if (dto.group !== undefined) song.group = dto.group;
    if (dto.isPublic !== undefined) song.isPublic = dto.isPublic;
    return this.songsRepo.save(song);
  }

  async associate(owner: User | any, songId: string, campaignIds: string[]) {
    const song = await this.songsRepo.findOne({ where: { id: songId }, relations: ['owner', 'campaigns'] });
    if (!song) throw new NotFoundException('Song not found');
    const authUserId = this.extractAuthUserId(owner);
    if (song.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    const campaigns = await this.campaignsRepo.find({ where: { id: In(campaignIds) } });
    // Filter ownership: only campaigns owned by this user for association
    const owned = campaigns.filter((c) => c.owner.id === authUserId);
    song.campaigns = Array.from(new Set([...(song.campaigns || []), ...owned]));
    return this.songsRepo.save(song);
  }

  async unassociate(owner: User | any, songId: string, campaignId: string) {
    const song = await this.songsRepo.findOne({ where: { id: songId }, relations: ['owner', 'campaigns'] });
    if (!song) throw new NotFoundException('Song not found');
    const authUserId = this.extractAuthUserId(owner);
    if (song.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    song.campaigns = (song.campaigns || []).filter((c) => c.id !== campaignId);
    return this.songsRepo.save(song);
  }

  async remove(owner: User | any, songId: string) {
    const song = await this.songsRepo.findOne({ where: { id: songId }, relations: ['owner', 'campaigns'] });
    if (!song) throw new NotFoundException('Song not found');
    const authUserId = this.extractAuthUserId(owner);
    if (song.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    if (song.campaigns && song.campaigns.length > 0) {
      throw new ConflictException('Song has active associations');
    }
    await this.songsRepo.remove(song);
    return { message: 'Song deleted' };
  }

  async getStreamable(user: User | any, songId: string, campaignId: string) {
    const song = await this.songsRepo
      .createQueryBuilder('song')
      .leftJoinAndSelect('song.campaigns', 'c')
      .leftJoinAndSelect('song.owner', 'o')
      .where('song.id = :songId', { songId })
      .getOne();
    if (!song) throw new NotFoundException('Song not found');
    const associated = (song.campaigns || []).some((c) => c.id === campaignId);
    if (!associated) throw new ForbiddenException('Song not associated with campaign');
    // Player visibility check: if user is not owner of campaign and song not public -> forbid
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner'] });
    const authUserId = this.extractAuthUserId(user);
    const campaignOwnerId = campaign?.owner?.id;
    const isMaster = campaignOwnerId !== undefined && authUserId !== undefined && String(campaignOwnerId) === String(authUserId);
    if (!isMaster && !song.isPublic) throw new ForbiddenException('Not allowed');
    return song;
  }
}
