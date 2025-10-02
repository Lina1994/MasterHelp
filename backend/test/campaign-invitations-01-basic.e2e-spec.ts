import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TestCampaignPlayer } from './types';

/**
 * Escenarios cubiertos:
 * 1. owner crea campaña.
 * 2. owner invita a player -> invitación creada (status invited).
 * 3. player ve invitación pendiente.
 * 4. player acepta -> pasa a active.
 * 5. third user intenta invitar (no-owner) => 403.
 */

describe('Campaign Invitations (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let playerToken: string;
  let thirdToken: string;
  let campaignId: string;
  let invitationId: string;
  const uniq = Date.now();

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

  it('Register owner', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `inv_owner_${uniq}`,
        email: `inv_owner_${uniq}@example.com`,
        password: 'Passw0rd!',
      });
    expect(res.status).toBe(201);
  });

  it('Register player', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `inv_player_${uniq}`,
        email: `inv_player_${uniq}@example.com`,
        password: 'Passw0rd!',
      });
    expect(res.status).toBe(201);
  });

  it('Register third user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `inv_third_${uniq}`,
        email: `inv_third_${uniq}@example.com`,
        password: 'Passw0rd!',
      });
    expect(res.status).toBe(201);
  });

  it('Login owner', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `inv_owner_${uniq}`, password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    ownerToken = res.body.access_token;
  });

  it('Login player', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `inv_player_${uniq}`, password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    playerToken = res.body.access_token;
  });

  it('Login third user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `inv_third_${uniq}`, password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    thirdToken = res.body.access_token;
  });

  it('Owner creates campaign', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Invitation Flow', description: 'Test campaign invitations' });
    expect(res.status).toBe(201);
    campaignId = res.body.id;
    expect(campaignId).toBeDefined();
  });

  it('Owner invites player by email', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `inv_player_${uniq}@example.com` });
    expect(res.status).toBe(201);
    // No se devuelve invitación directa - refrescamos lista campaña para obtener player entry
    const list = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    const invited = (list.body.players as TestCampaignPlayer[]).find(
      (p) => p.user?.email === `inv_player_${uniq}@example.com`,
    );
    expect(invited).toBeDefined();
    expect(invited.status).toBe('invited');
    invitationId = invited.id;
  });

  it('Player sees pending invitation', async () => {
    const res = await request(app.getHttpServer())
      .get('/campaigns/invitations/pending')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    const found = (res.body as { id: string }[]).find((i) => i.id === invitationId);
    expect(found).toBeDefined();
  });

  it('Player accepts invitation', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ invitationId, response: 'accept' });
    expect([200, 201]).toContain(res.status); // Aceptamos 200 o 201
  });

  it('Invitation now active', async () => {
    const campaignRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(campaignRes.status).toBe(200);
    const active = (campaignRes.body.players as TestCampaignPlayer[]).find(
      (p) => p.id === invitationId,
    );
    expect(active.status).toBe('active');
  });

  it('Third user (not owner) cannot invite', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${thirdToken}`)
      .send({ email: `someone_else_${uniq}@example.com` });
    expect(res.status).toBe(403);
  });
});
