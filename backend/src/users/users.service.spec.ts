import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { NotFoundException } from '@nestjs/common';

describe('UsersService (unit)', () => {
  let service: UsersService;
  interface MockUsersRepo {
    findOneBy: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  }
  let usersRepo: MockUsersRepo;

  beforeEach(async () => {
    usersRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(async (u) => u),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: usersRepo }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('updatePreferences', () => {
    it('actualiza language y theme si el usuario existe', async () => {
      const existing: User = Object.assign(new User(), {
        id: 10,
        username: 'tester',
        email: 'tester@example.com',
        language: 'en',
        theme: 'light',
      });
      usersRepo.findOneBy.mockResolvedValue(existing);

      const updated = await service.updatePreferences(10, 'es', 'dark');
      expect(updated.language).toBe('es');
      expect(updated.theme).toBe('dark');
      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'es', theme: 'dark' }),
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);
      await expect(service.updatePreferences(99, 'es', 'dark')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
