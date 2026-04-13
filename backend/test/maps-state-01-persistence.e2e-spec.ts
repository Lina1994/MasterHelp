import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * E2E state checks for maps module.
 * Scenarios:
 * 1. set/get fog persists and deduplicates cells.
 * 2. set/get tokens persists and deduplicates by id.
 * 3. set/get elements persists payload.
 */
describe('Maps State Persistence (e2e)', () => {
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
    const username = `map_state_owner_${suf}`;
    const email = `map_state_owner_${suf}@example.com`;

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

  it('Creates campaign and map', async () => {
    const campaignRes = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Map State Campaign ${suf}` });
    expect(campaignRes.status).toBe(201);
    campaignId = campaignRes.body.id;

    const mapRes = await request(app.getHttpServer())
      .post('/maps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Map State ${suf}`, campaignId });
    expect([200, 201]).toContain(mapRes.status);
    mapId = mapRes.body.id;
    expect(mapId).toBeDefined();
  });

  it('Rejects fog with duplicate cells, then persists valid cells', async () => {
    const invalidRes = await request(app.getHttpServer())
      .patch(`/maps/${mapId}/fog`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        cells: ['1:1', '2:2', '1:1'],
      });

    expect(invalidRes.status).toBe(400);

    const setRes = await request(app.getHttpServer())
      .patch(`/maps/${mapId}/fog`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        cells: ['1:1', '2:2'],
      });

    expect(setRes.status).toBe(200);
    expect(setRes.body.ok).toBe(true);

    const getRes = await request(app.getHttpServer())
      .get(`/maps/${mapId}/fog`)
      .query({ campaignId })
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.cells).toEqual(['1:1', '2:2']);
  });

  it('Persists tokens and deduplicates by id', async () => {
    const setRes = await request(app.getHttpServer())
      .patch(`/maps/${mapId}/tokens`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        tokens: [
          { id: 'ally-1', cellKey: '1:1', type: 'ally', label: 'A' },
          { id: 'ally-1', cellKey: '2:2', type: 'ally', label: 'A2' },
        ],
      });
    expect(setRes.status).toBe(200);
    expect(setRes.body.ok).toBe(true);

    const getRes = await request(app.getHttpServer())
      .get(`/maps/${mapId}/tokens`)
      .query({ campaignId })
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.tokens).toHaveLength(1);
    expect(getRes.body.tokens[0].id).toBe('ally-1');
    expect(getRes.body.tokens[0].cellKey).toBe('2:2');
  });

  it('Persists map elements and returns same state', async () => {
    const payload = [
      {
        id: 'light-1',
        type: 'light',
        label: 'Torch',
        position: { x: 0.5, y: 0.5 },
        radius: 80,
        isOn: true,
      },
    ];

    const setRes = await request(app.getHttpServer())
      .patch(`/maps/${mapId}/elements`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        elements: payload,
      });
    expect(setRes.status).toBe(200);
    expect(setRes.body.ok).toBe(true);

    const getRes = await request(app.getHttpServer())
      .get(`/maps/${mapId}/elements`)
      .query({ campaignId })
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.elements).toHaveLength(1);
    expect(getRes.body.elements[0].id).toBe('light-1');
    expect(getRes.body.elements[0].label).toBe('Torch');
  });
});
