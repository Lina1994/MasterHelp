import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * E2E Ownership tests for Campaign endpoints.
 * Escenarios:
 * 1. user1 crea campaña -> puede editar y borrar.
 * 2. user2 no puede editar ni borrar campaña de user1 (403).
 */

describe('Campaign Ownership (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let user1Token: string;
  let user2Token: string;
  let campaignId: string;

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

  it('Register user1', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `owner_user_${suf}`,
        email: `owner_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(res.status).toBe(201);
  });

  it('Register user2', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `other_user_${suf}`,
        email: `other_${suf}@example.com`,
        password: 'Passw0rd!',
      });
    expect(res.status).toBe(201);
  });

  it('Login user1', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `owner_user_${suf}`, password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    user1Token = res.body.access_token;
    expect(user1Token).toBeDefined();
  });

  it('Login user2', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `other_user_${suf}`, password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    user2Token = res.body.access_token;
    expect(user2Token).toBeDefined();
  });

  it('User1 creates a campaign', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Ownership Test Campaign', description: 'A test campaign' });
    expect(res.status).toBe(201);
    campaignId = res.body.id;
    expect(campaignId).toBeDefined();
  });

  it('User2 cannot update user1 campaign (403)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ name: 'Hacked Name' });
    expect(res.status).toBe(403);
  });

  it('User2 cannot delete user1 campaign (403)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${user2Token}`);
    expect(res.status).toBe(403);
  });

  it('User1 CAN update their campaign', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Updated Ownership Campaign' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Ownership Campaign');
  });

  it('User1 CAN delete their campaign', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    // DELETE puede devolver 200/204 según convención, aquí asumimos 200/204 aceptable
    expect([200, 204]).toContain(res.status);
  });
});
