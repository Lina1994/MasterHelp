import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * Escenarios cubiertos:
 * 1. Owner crea campaña.
 * 2. Owner invita a player -> status invited.
 * 3. Player decline -> status declined.
 * 4. Owner vuelve a invitar (re-invite) -> status invited otra vez.
 * 5. Player acepta -> status active.
 */

describe('Campaign Invitations Decline/Reinvite (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let playerToken: string;
  let campaignId: string;
  let invitationId: string;

  // Sufijo único para evitar colisiones.
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

  it('Register owner & player', async () => {
    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `decl_owner_${suf}`,
        email: `decl_owner_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(ownerRes.status).toBe(201);

    const playerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `decl_player_${suf}`,
        email: `decl_player_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(playerRes.status).toBe(201);
  });

  it('Login owner & player', async () => {
    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `decl_owner_${suf}`, password: 'Passw0rd!' });
    expect(ownerLogin.status).toBe(201);
    ownerToken = ownerLogin.body.access_token;

    const playerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `decl_player_${suf}`, password: 'Passw0rd!' });
    expect(playerLogin.status).toBe(201);
    playerToken = playerLogin.body.access_token;
  });

  it('Owner creates campaign', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Decline Flow', description: 'Decline and re-invite flow test' });
    expect(res.status).toBe(201);
    campaignId = res.body.id;
  });

  it('Owner invites player', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `decl_player_${suf}@example.com` });
    expect(res.status).toBe(201);
    const list = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    const invited = list.body.players.find(
      (p: any) => p.user?.email === `decl_player_${suf}@example.com`,
    );
    expect(invited).toBeDefined();
    expect(invited.status).toBe('invited');
    invitationId = invited.id;
  });

  it('Player declines invitation', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ invitationId, response: 'decline' });
    expect([200, 201]).toContain(res.status);
  });

  it('Invitation now declined', async () => {
    const campaignRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(campaignRes.status).toBe(200);
    const declined = campaignRes.body.players.find((p: any) => p.id === invitationId);
    expect(declined.status).toBe('declined');
  });

  it('Owner re-invites declined player (same email)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `decl_player_${suf}@example.com` });
    expect(res.status).toBe(201);
    const campaignRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(campaignRes.status).toBe(200);
    const reinvited = campaignRes.body.players.find((p: any) => p.id === invitationId);
    expect(reinvited.status).toBe('invited');
  });

  it('Player accepts after re-invite', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ invitationId, response: 'accept' });
    expect([200, 201]).toContain(res.status);
  });

  it('Invitation is now active', async () => {
    const campaignRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(campaignRes.status).toBe(200);
    const active = campaignRes.body.players.find((p: any) => p.id === invitationId);
    expect(active.status).toBe('active');
  });
});
