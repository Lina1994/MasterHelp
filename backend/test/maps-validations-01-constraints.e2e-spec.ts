import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * E2E validations for maps DTOs.
 * Scenarios:
 * 1. create rejects empty name.
 * 2. create rejects name > 200 chars.
 * 3. update rejects name > 200 chars.
 * 4. tokens rejects token id > 255 chars.
 * 5. elements rejects label > 255 chars.
 */
describe('Maps Validations Constraints (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let campaignId: string;
  let mapId: string;
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
    const username = `map_val_owner_${suf}`;
    const email = `map_val_owner_${suf}@example.com`;

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

  it('Creates a campaign for map scoping', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Map Validation Campaign ${suf}` });

    expect(res.status).toBe(201);
    campaignId = res.body.id;
    expect(campaignId).toBeDefined();
  });

  it('Rejects create map with empty name', async () => {
    const res = await request(app.getHttpServer())
      .post('/maps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', campaignId });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('Map name must not be empty');
  });

  it('Rejects create map with name > 200 chars', async () => {
    const res = await request(app.getHttpServer())
      .post('/maps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'm'.repeat(201), campaignId });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('Map name must not exceed 200 characters');
  });

  it('Creates map with valid name', async () => {
    const res = await request(app.getHttpServer())
      .post('/maps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Map Valid ${suf}`, campaignId });

    expect([200, 201]).toContain(res.status);
    mapId = res.body.id;
    expect(mapId).toBeDefined();
  });

  it('Rejects update map with name > 200 chars', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/maps/${mapId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'u'.repeat(201) });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('Map name must not exceed 200 characters');
  });

  it('Rejects tokens with token id > 255 chars', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/maps/${mapId}/tokens`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        tokens: [
          {
            id: 't'.repeat(256),
            cellKey: '1:1',
            type: 'ally',
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('Token id must not exceed 255 characters');
  });

  it('Rejects elements with label > 255 chars', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/maps/${mapId}/elements`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        elements: [
          {
            id: 'light-1',
            type: 'light',
            label: 'l'.repeat(256),
            position: { x: 0.5, y: 0.5 },
            radius: 100,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('label must be shorter than or equal to 255 characters');
  });
});
