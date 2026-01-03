import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Song } from './entities/song.entity';
import { User } from '../users/entities/user.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { Playlist } from './entities/playlist.entity';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Injectable()
export class SoundtrackService {
  constructor(
    @InjectRepository(Song) private songsRepo: Repository<Song>,
    @InjectRepository(Campaign) private campaignsRepo: Repository<Campaign>,
    @InjectRepository(Playlist) private playlistsRepo: Repository<Playlist>,
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
  song.artist = dto.artist;
  song.album = dto.album;
  song.atmosphere = dto.atmosphere;
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

  async findSectionedForCampaign(
    user: User | any,
    campaignId: string,
    q?: string,
    _groupDeprecated?: string,
    includeOthers = true,
    extra?: { groups?: string[]; artists?: string[]; albums?: string[]; atmospheres?: string[]; isPublic?: boolean },
    sort?: 'alpha' | 'alpha_desc' | 'newest' | 'oldest' | 'last_used',
  ) {
    // Cargar propietario para determinar si el usuario autenticado es el master
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const authUserId = this.extractAuthUserId(user);

    // Selección común para evitar serializar el binario (song.data)
    const commonSelect = [
      'song.id',
      'song.name',
      'song.group',
      'song.artist',
      'song.album',
      'song.atmosphere',
      'song.mimeType',
      'song.size',
      'song.isPublic',
      'song.createdAt',
      'song.updatedAt',
      'song.lastPlayedAt',
    ];

    // Canciones asociadas a esta campaña
    const associatedQB = this.songsRepo
      .createQueryBuilder('song')
      .leftJoin('song.campaigns', 'c')
      .select(commonSelect)
      .where('c.id = :campaignId', { campaignId })
  .orderBy(this.resolveOrder(sort), this.resolveDirection(sort));
    // Filtros
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      associatedQB.andWhere(
        '(LOWER(song.name) LIKE :like OR LOWER(song.artist) LIKE :like OR LOWER(song.album) LIKE :like OR LOWER(song.group) LIKE :like OR LOWER(song.atmosphere) LIKE :like)',
        { like },
      );
    }
  if (extra?.groups && extra.groups.length) associatedQB.andWhere('song.[group] IN (:...groups)', { groups: extra.groups });
  if (extra?.artists && extra.artists.length) associatedQB.andWhere('song.artist IN (:...artists)', { artists: extra.artists });
  if (extra?.albums && extra.albums.length) associatedQB.andWhere('song.album IN (:...albums)', { albums: extra.albums });
  if (extra?.atmospheres && extra.atmospheres.length) associatedQB.andWhere('song.atmosphere IN (:...atmospheres)', { atmospheres: extra.atmospheres });
    if (typeof extra?.isPublic === 'boolean') associatedQB.andWhere('song.isPublic = :isPublic', { isPublic: extra.isPublic });

    // Jugadores: solo canciones públicas
    const isMaster = campaign.owner && campaign.owner.id === authUserId;
    if (!isMaster) {
      associatedQB.andWhere('song.isPublic = :pub', { pub: true });
    }

    const associated = await associatedQB.getMany();

    let reusable: Song[] = [];
    if (includeOthers && isMaster) {
      const reusableQB = this.songsRepo
        .createQueryBuilder('song')
        .leftJoin('song.campaigns', 'c')
        .select(commonSelect)
        .where('song.ownerId = :ownerId', { ownerId: authUserId })
  .andWhere('(c.id IS NULL OR c.id != :campaignId)', { campaignId })
  .orderBy(this.resolveOrder(sort), this.resolveDirection(sort));
      if (q) {
        const like = `%${q.toLowerCase()}%`;
        reusableQB.andWhere(
          '(LOWER(song.name) LIKE :like OR LOWER(song.artist) LIKE :like OR LOWER(song.album) LIKE :like OR LOWER(song.group) LIKE :like OR LOWER(song.atmosphere) LIKE :like)',
          { like },
        );
      }
  if (extra?.groups && extra.groups.length) reusableQB.andWhere('song.[group] IN (:...groups)', { groups: extra.groups });
  if (extra?.artists && extra.artists.length) reusableQB.andWhere('song.artist IN (:...artists)', { artists: extra.artists });
  if (extra?.albums && extra.albums.length) reusableQB.andWhere('song.album IN (:...albums)', { albums: extra.albums });
  if (extra?.atmospheres && extra.atmospheres.length) reusableQB.andWhere('song.atmosphere IN (:...atmospheres)', { atmospheres: extra.atmospheres });
      if (typeof extra?.isPublic === 'boolean') reusableQB.andWhere('song.isPublic = :isPublic', { isPublic: extra.isPublic });
      reusable = await reusableQB.getMany();
    }
    return { associated, reusable };
  }

  /**
   * Lista todas las canciones propiedad del usuario autenticado (sin contexto de campaña).
   * No devuelve el binario del audio para reducir payload.
   */
  async listOwned(
    user: User | any,
    q?: string,
    _groupDeprecated?: string,
    extra?: { groups?: string[]; artists?: string[]; albums?: string[]; atmospheres?: string[]; isPublic?: boolean },
    sort?: 'alpha' | 'alpha_desc' | 'newest' | 'oldest' | 'last_used',
  ) {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    const qb = this.songsRepo
      .createQueryBuilder('song')
      .where('song.ownerId = :ownerId', { ownerId: authUserId })
      .select([
        'song.id',
        'song.name',
        'song.group',
        'song.artist',
        'song.album',
        'song.atmosphere',
        'song.mimeType',
        'song.size',
        'song.isPublic',
        'song.createdAt',
        'song.updatedAt',
        'song.lastPlayedAt',
      ])
      .orderBy(this.resolveOrder(sort), this.resolveDirection(sort));
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(song.name) LIKE :like OR LOWER(song.artist) LIKE :like OR LOWER(song.album) LIKE :like OR LOWER(song.group) LIKE :like OR LOWER(song.atmosphere) LIKE :like)',
        { like },
      );
    }
    if (extra?.groups && extra.groups.length) qb.andWhere('song.[group] IN (:...groups)', { groups: extra.groups });
    if (extra?.artists && extra.artists.length) qb.andWhere('song.artist IN (:...artists)', { artists: extra.artists });
    if (extra?.albums && extra.albums.length) qb.andWhere('song.album IN (:...albums)', { albums: extra.albums });
    if (extra?.atmospheres && extra.atmospheres.length) qb.andWhere('song.atmosphere IN (:...atmospheres)', { atmospheres: extra.atmospheres });
    if (typeof extra?.isPublic === 'boolean') qb.andWhere('song.isPublic = :isPublic', { isPublic: extra.isPublic });
    return qb.getMany();
  }

  /** Map sorting token to column */
  private resolveOrder(sort?: 'alpha' | 'alpha_desc' | 'newest' | 'oldest' | 'last_used') {
    switch (sort) {
      case 'alpha':
      case 'alpha_desc':
        return 'song.name';
      case 'oldest':
      case 'newest':
        return 'song.createdAt';
      case 'last_used':
        return 'song.lastPlayedAt';
      default:
        return 'song.createdAt';
    }
  }

  /** Map sorting token to direction */
  private resolveDirection(sort?: 'alpha' | 'alpha_desc' | 'newest' | 'oldest' | 'last_used'): 'ASC' | 'DESC' {
    switch (sort) {
      case 'alpha':
      case 'oldest':
        return 'ASC';
      case 'alpha_desc':
      case 'newest':
      case 'last_used':
      default:
        return 'DESC';
    }
  }

  /** Devuelve opciones de filtros (distintos) para construir desplegables en UI. */
  async getFilterOptions(user: User | any, campaignId?: string) {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const collectDistinct = async (column: 'group' | 'artist' | 'album' | 'atmosphere', qbBase: ReturnType<Repository<Song>['createQueryBuilder']>) => {
      let colExpr = '';
      if (column === 'group') colExpr = 'song.[group]'; else colExpr = `song.${column}`;
      const rows = await qbBase.clone()
        .select(`DISTINCT ${colExpr}`, 'value')
        .andWhere(`${colExpr} IS NOT NULL AND TRIM(${colExpr}) != ''`)
        .orderBy('value', 'ASC')
        .getRawMany<{ value: string }>();
      return rows.map(r => r.value);
    };

    if (!campaignId) {
      const base = this.songsRepo.createQueryBuilder('song').where('song.ownerId = :ownerId', { ownerId: authUserId });
      const [groups, artists, albums, atmospheres] = await Promise.all([
        collectDistinct('group', base),
        collectDistinct('artist', base),
        collectDistinct('album', base),
        collectDistinct('atmosphere', base),
      ]);
      return { groups, artists, albums, atmospheres };
    }

    // Con campaña: opciones de canciones visibles en la campaña + propias
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isMaster = campaign.owner && campaign.owner.id === authUserId;

    const associatedBase = this.songsRepo
      .createQueryBuilder('song')
      .leftJoin('song.campaigns', 'c')
      .where('c.id = :campaignId', { campaignId });
    if (!isMaster) associatedBase.andWhere('song.isPublic = :pub', { pub: true });

    const ownedBase = this.songsRepo.createQueryBuilder('song').where('song.ownerId = :ownerId', { ownerId: authUserId });

    const [groupsA, artistsA, albumsA, atmospheresA] = await Promise.all([
      collectDistinct('group', associatedBase),
      collectDistinct('artist', associatedBase),
      collectDistinct('album', associatedBase),
      collectDistinct('atmosphere', associatedBase),
    ]);
    const [groupsO, artistsO, albumsO, atmospheresO] = await Promise.all([
      collectDistinct('group', ownedBase),
      collectDistinct('artist', ownedBase),
      collectDistinct('album', ownedBase),
      collectDistinct('atmosphere', ownedBase),
    ]);

    const uniq = (arr: string[]) => Array.from(new Set(arr));
    return {
      groups: uniq([...groupsA, ...groupsO]),
      artists: uniq([...artistsA, ...artistsO]),
      albums: uniq([...albumsA, ...albumsO]),
      atmospheres: uniq([...atmospheresA, ...atmospheresO]),
    };
  }

  async update(owner: User | any, songId: string, dto: UpdateSongDto) {
    const song = await this.songsRepo.findOne({ where: { id: songId }, relations: ['owner'] });
    if (!song) throw new NotFoundException('Song not found');
    const authUserId = this.extractAuthUserId(owner);
    if (song.owner.id !== authUserId) throw new ForbiddenException('Not owner');
    if (dto.name !== undefined) song.name = dto.name;
    if (dto.group !== undefined) song.group = dto.group;
  if (dto.artist !== undefined) song.artist = dto.artist;
  if (dto.album !== undefined) song.album = dto.album;
  if (dto.atmosphere !== undefined) song.atmosphere = dto.atmosphere;
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
    // Si tiene asociaciones, limpiarlas automáticamente antes de eliminar
    if (song.campaigns && song.campaigns.length > 0) {
      await this.songsRepo
        .createQueryBuilder()
        .relation(Song, 'campaigns')
        .of(song)
        .remove(song.campaigns.map((c) => c.id));
    }
    await this.songsRepo.remove(song);
    return { message: 'Song deleted' };
  }

  // ===== Playlists =====
  private async assertCampaignOwnership(user: any, campaignId: string) {
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId || campaign.owner.id !== authUserId) throw new ForbiddenException('Not campaign owner');
    return campaign;
  }

  /** Devuelve el uso total de almacenamiento de canciones del usuario autenticado (en bytes). */
  async getUsage(user: any) {
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');
    const raw = await this.songsRepo
      .createQueryBuilder('song')
      .where('song.ownerId = :ownerId', { ownerId: authUserId })
      .select('SUM(song.size)', 'total')
      .addSelect('COUNT(*)', 'count')
      .getRawOne<{ total: string | null; count: string | null }>();
    const totalSize = raw?.total ? parseInt(raw.total, 10) : 0;
    const count = raw?.count ? parseInt(raw.count, 10) : 0;
    return { totalSize, count };
  }

  /** Lista playlists de campaña. */
  async listPlaylists(user: any, campaignId: string) {
    await this.assertCampaignOwnership(user, campaignId);
    const qb = this.playlistsRepo
      .createQueryBuilder('pl')
      .leftJoinAndSelect('pl.songs', 'song')
      .select([
        'pl.id',
        'pl.name',
        'pl.createdAt',
        'pl.updatedAt',
        'song.id',
        'song.name',
        'song.size',
        'song.mimeType',
      ])
      .where('pl.campaignId = :campaignId', { campaignId })
      .orderBy('pl.createdAt', 'DESC');
    return qb.getMany();
  }

  /** Crea una playlist y valida canciones (del owner y asociadas o propias). */
  async createPlaylist(user: any, campaignId: string, dto: CreatePlaylistDto) {
    const campaign = await this.assertCampaignOwnership(user, campaignId);
    const pl = new Playlist();
    pl.name = dto.name;
    pl.campaign = campaign;
    pl.songs = [];
    if (dto.songs && dto.songs.length) {
      const authUserId = this.extractAuthUserId(user);
      const songs = await this.songsRepo.find({ where: { id: In(dto.songs) }, relations: ['campaigns', 'owner'] });
      // Estricto: sólo canciones del owner y asociadas a la campaña
      const valid = songs.filter(s => s.owner.id === authUserId && s.campaigns?.some(c => c.id === campaignId));
      pl.songs = valid;
    }
    return this.playlistsRepo.save(pl);
  }

  /** Actualiza nombre y/o canciones de playlist. */
  async updatePlaylist(user: any, campaignId: string, playlistId: string, dto: UpdatePlaylistDto) {
    await this.assertCampaignOwnership(user, campaignId);
    const pl = await this.playlistsRepo.findOne({ where: { id: playlistId }, relations: ['campaign', 'songs'] });
    if (!pl || pl.campaign.id !== campaignId) throw new NotFoundException('Playlist not found');
    if (dto.name !== undefined) pl.name = dto.name;
    if (dto.songs) {
      const authUserId = this.extractAuthUserId(user);
      const songs = await this.songsRepo.find({ where: { id: In(dto.songs) }, relations: ['campaigns', 'owner'] });
      const valid = songs.filter(s => s.owner.id === authUserId && s.campaigns?.some(c => c.id === campaignId));
      pl.songs = valid;
    }
    return this.playlistsRepo.save(pl);
  }

  /** Elimina una playlist. */
  async deletePlaylist(user: any, campaignId: string, playlistId: string) {
    await this.assertCampaignOwnership(user, campaignId);
    const pl = await this.playlistsRepo.findOne({ where: { id: playlistId }, relations: ['campaign'] });
    if (!pl || pl.campaign.id !== campaignId) throw new NotFoundException('Playlist not found');
    await this.playlistsRepo.remove(pl);
    return { message: 'Playlist deleted' };
  }

  /**
   * Devuelve una canción lista para streaming aplicando reglas de autorización.
   * Reglas:
   * - Si se proporciona campaignId:
   *   - Si la canción está asociada: permitir a owner de campaña o a jugadores si es pública.
   *   - Si NO está asociada: permitir sólo al owner de la campaña (preview) siempre que también sea owner de la canción.
   * - Si NO se proporciona campaignId: permitir sólo al owner de la canción (preview fuera de campaña).
   */
  async getStreamable(user: User | any, songId: string, campaignId?: string) {
    const song = await this.songsRepo
      .createQueryBuilder('song')
      .leftJoinAndSelect('song.campaigns', 'c')
      .leftJoinAndSelect('song.owner', 'o')
      .where('song.id = :songId', { songId })
      .getOne();
    if (!song) throw new NotFoundException('Song not found');
    const authUserId = this.extractAuthUserId(user);
    if (!authUserId) throw new ForbiddenException('Invalid auth context');

    const campaignIdProvided = !!campaignId && campaignId.trim().length > 0;

    if (!campaignIdProvided) {
      // Preview sin campaña: sólo owner
      if (song.owner.id !== authUserId) {
        throw new ForbiddenException('Not allowed');
      }
      return song;
    }

    const associated = (song.campaigns || []).some((c) => c.id === campaignId);
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isMaster = campaign.owner.id === authUserId;

    if (associated) {
      // Si está asociada: jugadores sólo si es pública o son master
      if (!isMaster && !song.isPublic) throw new ForbiddenException('Not allowed');
      return song;
    }

    // No asociada: permitir preview sólo al master que además es owner de la canción
    if (isMaster && song.owner.id === authUserId) {
      return song;
    }
    throw new ForbiddenException('Song not associated with campaign');
  }

  /** Actualiza lastPlayedAt a ahora si el usuario está autorizado a reproducir la canción. */
  async markPlayed(user: User | any, songId: string, campaignId?: string) {
    const song = await this.getStreamable(user, songId, campaignId);
    song.lastPlayedAt = new Date();
    await this.songsRepo.save(song);
    return { message: 'Marked played', lastPlayedAt: song.lastPlayedAt };
  }
}
