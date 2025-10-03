import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

// Utilizamos un hash bcrypt conocido para la contraseña "password123" generado con saltRounds=10.
// Para evitar dependencia de bcrypt interno en unit test, mockeamos bcrypt.compare.
jest.mock('bcrypt', () => ({
  compare: jest.fn((plain: string, hashed: string) => {
    // Simplificación: aceptar si plain === 'password123' y hashed incluye la marca 'hashed'
    return Promise.resolve(plain === 'password123' && hashed.includes('hashed'));
  }),
  hash: jest.fn(),
}));

describe('AuthService (unit)', () => {
  let service: AuthService;
  interface MockUsersRepo {
    findOne: jest.Mock;
  }
  interface MockJwtService {
    sign: jest.Mock;
  }
  let usersRepo: MockUsersRepo;
  let jwtService: MockJwtService;

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(() => 'signed-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('devuelve access_token en login exitoso', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 1,
        username: 'alice',
        password: 'hashed-password',
      });
      const result = await service.login({ username: 'alice', password: 'password123' });
      expect(result).toEqual({ access_token: 'signed-jwt-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({ username: 'alice', sub: 1 });
    });

    it('lanza UnauthorizedException con credenciales inválidas (usuario inexistente)', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ username: 'ghost', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lanza UnauthorizedException con password incorrecto', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 2, username: 'bob', password: 'hashed-password' });
      await expect(service.login({ username: 'bob', password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
