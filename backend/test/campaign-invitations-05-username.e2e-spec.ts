import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * Escenario: invitación usando username (sin email en el body) para cubrir la rama alternativa del DTO.
 * Verifica: invited -> accept -> segundo invite (activo) => 400 'User is already a player'.
 */

describe('Campaign Invitation via Username (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let playerToken: string;
  let campaignId: string;
  let invitationId: string;
  const suf = uniqueSuffix();
  const ownerUser = `usr_owner_${suf}`;
  const playerUser = `usr_player_${suf}`;
  const ownerEmail = `usr_owner_${suf}@example.com`;
  const playerEmail = `usr_player_${suf}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Register owner & player', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: ownerUser, email: ownerEmail, password: 'Passw0rd!' });
    expect(r1.status).toBe(201);
    const r2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: playerUser, email: playerEmail, password: 'Passw0rd!' });
    expect(r2.status).toBe(201);
  });

  it('Login owner & player', async () => {
    const l1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: ownerUser, password: 'Passw0rd!' });
    expect(l1.status).toBe(201);
    ownerToken = l1.body.access_token;
    const l2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: playerUser, password: 'Passw0rd!' });
    expect(l2.status).toBe(201);
    playerToken = l2.body.access_token;
  });

  it('Owner creates campaign', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Username Invite Flow', description: 'Invite using username only' });
    expect(res.status).toBe(201);
    campaignId = res.body.id;
  });

  it('Owner invites player via username (no email)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: playerUser });
    expect(res.status).toBe(201);
    const list = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    const invited = list.body.players.find((p: any) => p.user?.username === playerUser);
    expect(invited).toBeDefined();
    expect(invited.status).toBe('invited');
    invitationId = invited.id;
  });

  it('Player accepts invitation', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ invitationId, response: 'accept' });
    expect([200, 201]).toContain(res.status);
  });

  it('Owner attempts to invite again (already active) -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: playerUser });
    expect(res.status).toBe(400);
    expect(typeof res.body.message === 'string' || Array.isArray(res.body.message)).toBe(true);
  });
});
