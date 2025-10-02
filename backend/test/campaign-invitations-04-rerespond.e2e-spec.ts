import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * Escenarios:
 * 1. Owner invita a player.
 * 2. Player acepta invitación.
 * 3. Player intenta aceptar de nuevo => 400.
 * 4. (Variante) Nuevo set: decline y luego intenta decline otra vez => 400.
 */

describe('Campaign Invitations Re-Respond (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let playerToken: string;
  let campaignId: string;
  let invitationId: string;

  // Segundo set (decline path)
  let ownerToken2: string;
  let playerToken2: string;
  let campaignId2: string;
  let invitationId2: string;

  const suf = uniqueSuffix();

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

  it('Register users accept-path', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `rr_owner_${suf}`,
        email: `rr_owner_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(r1.status).toBe(201);
    const r2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `rr_player_${suf}`,
        email: `rr_player_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(r2.status).toBe(201);
  });

  it('Login users accept-path', async () => {
    const l1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `rr_owner_${suf}`, password: 'Passw0rd!' });
    expect(l1.status).toBe(201);
    ownerToken = l1.body.access_token;
    const l2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `rr_player_${suf}`, password: 'Passw0rd!' });
    expect(l2.status).toBe(201);
    playerToken = l2.body.access_token;
  });

  it('Owner creates campaign (accept-path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Re-Respond Accept Path', description: 'Testing double accept' });
    expect(res.status).toBe(201);
    campaignId = res.body.id;
  });

  it('Owner invites player (accept-path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `rr_player_${suf}@example.com` });
    expect(res.status).toBe(201);
    const list = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    const invited = list.body.players.find(
      (p: any) => p.user?.email === `rr_player_${suf}@example.com`,
    );
    expect(invited).toBeDefined();
    invitationId = invited.id;
  });

  it('Player accepts invitation first time', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ invitationId, response: 'accept' });
    expect([200, 201]).toContain(res.status);
  });

  it('Player attempts to accept again -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ invitationId, response: 'accept' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invitation already responded');
  });

  // --- Decline path ---

  it('Register users decline-path', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `rr2_owner_${suf}`,
        email: `rr2_owner_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(r1.status).toBe(201);
    const r2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `rr2_player_${suf}`,
        email: `rr2_player_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(r2.status).toBe(201);
  });

  it('Login users decline-path', async () => {
    const l1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `rr2_owner_${suf}`, password: 'Passw0rd!' });
    expect(l1.status).toBe(201);
    ownerToken2 = l1.body.access_token;
    const l2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `rr2_player_${suf}`, password: 'Passw0rd!' });
    expect(l2.status).toBe(201);
    playerToken2 = l2.body.access_token;
  });

  it('Owner creates campaign (decline-path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${ownerToken2}`)
      .send({ name: 'Re-Respond Decline Path', description: 'Testing double decline' });
    expect(res.status).toBe(201);
    campaignId2 = res.body.id;
  });

  it('Owner invites player (decline-path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId2}/invite`)
      .set('Authorization', `Bearer ${ownerToken2}`)
      .send({ email: `rr2_player_${suf}@example.com` });
    expect(res.status).toBe(201);
    const list = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId2}`)
      .set('Authorization', `Bearer ${ownerToken2}`);
    expect(list.status).toBe(200);
    const invited = list.body.players.find(
      (p: any) => p.user?.email === `rr2_player_${suf}@example.com`,
    );
    expect(invited).toBeDefined();
    invitationId2 = invited.id;
  });

  it('Player declines invitation first time', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken2}`)
      .send({ invitationId: invitationId2, response: 'decline' });
    expect([200, 201]).toContain(res.status);
  });

  it('Player attempts to decline again -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken2}`)
      .send({ invitationId: invitationId2, response: 'decline' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invitation already responded');
  });
});
