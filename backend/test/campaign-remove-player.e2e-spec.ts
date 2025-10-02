import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TestCampaignPlayer } from './types';
import { uniqueSuffix } from './utils';

/**
 * Escenarios cubiertos:
 * 1. Owner crea campaña.
 * 2. Owner invita player -> invited -> accept (player activo).
 * 3. Tercer usuario login (non-owner) intenta eliminar player => 403.
 * 4. Non-existing player id => 404.
 * 5. Owner elimina player activo => OK y desaparece de la lista.
 */

describe('Campaign Remove Player (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let playerToken: string;
  let thirdToken: string;
  let campaignId: string;
  let playerInvitationId: string; // id en CampaignPlayer

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

  it('Register users', async () => {
    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `rem_owner_${suf}`,
        email: `rem_owner_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(ownerRes.status).toBe(201);
    const playerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `rem_player_${suf}`,
        email: `rem_player_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(playerRes.status).toBe(201);
    const thirdRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `rem_third_${suf}`,
        email: `rem_third_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(thirdRes.status).toBe(201);
  });

  it('Login users', async () => {
    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `rem_owner_${suf}`, password: 'Passw0rd!' });
    expect(ownerLogin.status).toBe(201);
    ownerToken = ownerLogin.body.access_token;

    const playerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `rem_player_${suf}`, password: 'Passw0rd!' });
    expect(playerLogin.status).toBe(201);
    playerToken = playerLogin.body.access_token;

    const thirdLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `rem_third_${suf}`, password: 'Passw0rd!' });
    expect(thirdLogin.status).toBe(201);
    thirdToken = thirdLogin.body.access_token;
  });

  it('Owner creates campaign', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Remove Player Flow', description: 'Remove player test' });
    expect(res.status).toBe(201);
    campaignId = res.body.id;
  });

  it('Owner invites player and player accepts', async () => {
    const invite = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `rem_player_${suf}@example.com` });
    expect(invite.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    const invited = (list.body.players as TestCampaignPlayer[]).find(
      (p) => p.user?.email === `rem_player_${suf}@example.com`,
    );
    expect(invited).toBeDefined();
    expect(invited.status).toBe('invited');
    playerInvitationId = invited.id;

    const accept = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ invitationId: playerInvitationId, response: 'accept' });
    expect([200, 201]).toContain(accept.status);
  });

  it('Third user cannot remove player', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/campaigns/${campaignId}/player/${playerInvitationId}`)
      .set('Authorization', `Bearer ${thirdToken}`);
    expect(res.status).toBe(403);
  });

  it('Owner removing non-existing player returns 404', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/campaigns/${campaignId}/player/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });

  it('Owner removes active player', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/campaigns/${campaignId}/player/${playerInvitationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect([200, 204]).toContain(res.status);

    const campaignRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(campaignRes.status).toBe(200);
    const removed = (campaignRes.body.players as TestCampaignPlayer[]).find(
      (p) => p.id === playerInvitationId,
    );
    expect(removed).toBeUndefined();
  });
});
