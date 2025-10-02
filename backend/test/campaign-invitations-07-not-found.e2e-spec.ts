import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { uniqueSuffix } from './utils';

/**
 * Escenario: usuario intenta responder invitación inexistente -> 404 'Invitation not found'.
 */

describe('Campaign Invitation Not Found (e2e)', () => {
  let app: INestApplication;
  let playerToken: string;
  const suf = uniqueSuffix();
  const playerUser = `nf_player_${suf}`;

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

  it('Register & login player', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: playerUser, email: `${playerUser}@example.com`, password: 'Passw0rd!' });
    expect(reg.status).toBe(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: playerUser, password: 'Passw0rd!' });
    expect(login.status).toBe(201);
    playerToken = login.body.access_token;
  });

  it('Responding non-existing invitation -> 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns/invitation/respond')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ invitationId: '00000000-0000-0000-0000-000000000000', response: 'accept' });
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Invitation not found');
  });
});
