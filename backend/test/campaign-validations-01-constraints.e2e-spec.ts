import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * E2E validations for campaigns DTOs.
 * Scenarios:
 * 1. create rejects empty name.
 * 2. create rejects name > 200 chars.
 * 3. update rejects description > 1000 chars.
 * 4. invite rejects email > 255 chars.
 */
describe('Campaign Validations Constraints (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let campaignId: string;
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

  it('Register and login owner', async () => {
    const username = `val_owner_${suf}`;
    const email = `val_owner_${suf}@example.com`;

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username, email, password: 'Passw0rd!' });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password: 'Passw0rd!' });
    expect(loginRes.status).toBe(201);
    token = loginRes.body.access_token;
    expect(token).toBeDefined();
  });

  it('Rejects create campaign with empty name', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', description: 'invalid' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('Campaign name must not be empty');
  });

  it('Rejects create campaign with name > 200 chars', async () => {
    const longName = 'a'.repeat(201);
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: longName, description: 'invalid' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('Campaign name must not exceed 200 characters');
  });

  it('Creates campaign with valid data', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Valid Campaign ${suf}`, description: 'valid description' });

    expect(res.status).toBe(201);
    campaignId = res.body.id;
    expect(campaignId).toBeDefined();
  });

  it('Rejects update campaign with description > 1000 chars', async () => {
    const longDescription = 'd'.repeat(1001);
    const res = await request(app.getHttpServer())
      .patch(`/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: longDescription });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain(
      'Campaign description must not exceed 1000 characters',
    );
  });

  it('Rejects invite with email > 255 chars', async () => {
    const localPart = 'x'.repeat(250);
    const longEmail = `${localPart}@test.com`;
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: longEmail });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('email must not exceed 255 characters');
  });
});
