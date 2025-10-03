import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SoundtrackService } from './soundtrack.service';
import { Song } from './entities/song.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignPlayer } from '../campaigns/entities/campaign-player.entity';
import { User } from '../users/entities/user.entity';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

// Nota: Ajustar entidades mínimas necesarias para las relaciones utilizadas.

describe('SoundtrackService', () => {
  let service: SoundtrackService;
  let usersRepo: Repository<User>;
  let campaignsRepo: Repository<Campaign>;
  let songsRepo: Repository<Song>;
  let owner: User;
  let player: User;
  let campaign: Campaign;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3' as any,
          database: ':memory:',
          dropSchema: true,
          entities: [User, Campaign, CampaignPlayer, Song],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Song, Campaign, User, CampaignPlayer]),
      ],
      providers: [SoundtrackService],
    }).compile();

    service = moduleRef.get(SoundtrackService);
    usersRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    campaignsRepo = moduleRef.get<Repository<Campaign>>(getRepositoryToken(Campaign));
    songsRepo = moduleRef.get<Repository<Song>>(getRepositoryToken(Song));

    owner = await usersRepo.save(Object.assign(new User(), { username: 'owner', email: 'o@example.com', password: 'x' }));
    player = await usersRepo.save(Object.assign(new User(), { username: 'player', email: 'p@example.com', password: 'x' }));

    campaign = new Campaign();
    campaign.name = 'Camp 1';
    (campaign as any).owner = owner;
    campaign.players = [] as any;
    campaign = await campaignsRepo.save(campaign);
  });

  afterAll(async () => {
    const ds = usersRepo.manager.connection as DataSource;
    await ds.destroy();
  });

  it('crea canción y no la asocia por defecto', async () => {
    const song = await service.create(owner, { name: 'Song A' } as any, { buffer: Buffer.from('abc'), mimetype: 'audio/mpeg', size: 3 });
    expect(song.id).toBeDefined();
    expect(song.campaigns?.length).toBe(0);
  });

  it('asocia canción a campaña del owner', async () => {
    const song = await service.create(owner, { name: 'Song B' } as any, { buffer: Buffer.from('ddd'), mimetype: 'audio/mpeg', size: 3 });
    await service.associate(owner, song.id, [campaign.id]);
    const reloaded = await songsRepo.findOne({ where: { id: song.id }, relations: ['campaigns'] });
    expect(reloaded?.campaigns.length).toBe(1);
  });

  it('lista seccionado para master (associated + reusable)', async () => {
    const songC = await service.create(owner, { name: 'Song C' } as any, { buffer: Buffer.from('eee'), mimetype: 'audio/mpeg', size: 3 });
    const sectioned = await service.findSectionedForCampaign(owner, campaign.id);
    // Song B asociada, Song A y C no asociadas => reusable >= 2
    expect(sectioned.associated.length).toBe(1);
    expect(sectioned.reusable.length).toBeGreaterThanOrEqual(2);
  });

  it('jugador solo ve canciones públicas asociadas', async () => {
    // Song B asociada (no pública por defecto) -> no visible
    // Creamos pública y asociamos
    const publicSong = await service.create(owner, { name: 'Song Public', isPublic: true } as any, { buffer: Buffer.from('fff'), mimetype: 'audio/mpeg', size: 3 });
    await service.associate(owner, publicSong.id, [campaign.id]);
    const sectionedPlayer = await service.findSectionedForCampaign(player, campaign.id);
    expect(sectionedPlayer.reusable.length).toBe(0); // player no es master
    // Associated visibles >= 1 (publicSong) y no incluye privadas
    const names = sectionedPlayer.associated.map(s => s.name);
    expect(names).toContain('Song Public');
    expect(names).not.toContain('Song B');
  });

  it('unassociate mueve canción a reusable', async () => {
    const songX = await service.create(owner, { name: 'Song X' } as any, { buffer: Buffer.from('ggg'), mimetype: 'audio/mpeg', size: 3 });
    await service.associate(owner, songX.id, [campaign.id]);
    await service.unassociate(owner, songX.id, campaign.id);
    const sectioned = await service.findSectionedForCampaign(owner, campaign.id);
    const namesAssoc = sectioned.associated.map(s => s.name);
    const namesReu = sectioned.reusable.map(s => s.name);
    expect(namesAssoc).not.toContain('Song X');
    expect(namesReu).toContain('Song X');
  });
});
