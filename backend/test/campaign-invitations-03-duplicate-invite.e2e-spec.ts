import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * Escenario: intentar invitar dos veces a un usuario mientras su status sigue siendo 'invited'.
 * Resultado esperado del segundo invite: 400 con mensaje 'User already invited'.
 */

describe('Campaign Invitations Duplicate Invite (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let campaignId: string;
  const suf = uniqueSuffix();
  const playerEmail = `dup_player_${suf}@example.com`;
  const ownerUser = `dup_owner_${suf}`;
  const playerUser = `dup_player_${suf}`;

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
      .send({ username: ownerUser, email: `dup_owner_${suf}@example.com`, password: 'Passw0rd!' });
    expect(r1.status).toBe(201);
    const r2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: playerUser, email: playerEmail, password: 'Passw0rd!' });
    expect(r2.status).toBe(201);
  });

  it('Login owner', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: ownerUser, password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    ownerToken = res.body.access_token;
  });

  it('Owner creates campaign', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Duplicate Invite Flow', description: 'Testing duplicate invite error' });
    expect(res.status).toBe(201);
    campaignId = res.body.id;
  });

  it('First invite succeeds', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: playerEmail });
    expect(res.status).toBe(201);
  });

  it('Second invite (still invited) returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: playerEmail });
    expect(res.status).toBe(400);
    // Mensaje de error opcionalmente comprobable
    expect(typeof res.body.message === 'string' || Array.isArray(res.body.message)).toBe(true);
  });
});
