import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * Escenario: un usuario (no destinatario) intenta responder una invitación de otro -> 403.
 */

describe('Campaign Invitation Forbidden Respond (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let invitedToken: string;
  let intruderToken: string;
  let campaignId: string;
  let invitationId: string;
  const suf = uniqueSuffix();

  const ownerUser = `forb_owner_${suf}`;
  const invitedUser = `forb_invited_${suf}`;
  const intruderUser = `forb_intruder_${suf}`;

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

  it('Register three users', async () => {
    for (const u of [ownerUser, invitedUser, intruderUser]) {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: u, email: `${u}@example.com`, password: 'Passw0rd!' });
      expect(res.status).toBe(201);
    }
  });

  it('Login users', async () => {
    const l1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: ownerUser, password: 'Passw0rd!' });
    ownerToken = l1.body.access_token;
    const l2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: invitedUser, password: 'Passw0rd!' });
    invitedToken = l2.body.access_token;
    const l3 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: intruderUser, password: 'Passw0rd!' });
    intruderToken = l3.body.access_token;
    [l1, l2, l3].forEach((r) => expect(r.status).toBe(201));
  });

  it('Owner creates campaign & invites invitedUser', async () => {
    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Forbidden Respond Campaign', description: 'Test forbidden respond' });
    expect(create.status).toBe(201);
    campaignId = create.body.id;

    const invite = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: invitedUser });
    expect(invite.status).toBe(201);

    const campaign = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(campaign.status).toBe(200);
    const invited = campaign.body.players.find((p: any) => p.user?.username === invitedUser);
    expect(invited).toBeDefined();
    invitationId = invited.id;
  });

  it('Intruder attempts to respond -> 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ invitationId, response: 'accept' });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Not your invitation');
  });

  it('Original invited can accept normally', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${invitedToken}`)
      .send({ invitationId, response: 'accept' });
    expect([200, 201]).toContain(res.status);
  });
});
