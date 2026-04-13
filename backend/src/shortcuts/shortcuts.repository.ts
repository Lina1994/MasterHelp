import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shortcut } from './entities/shortcut.entity';
import { User } from '../users/entities/user.entity';

/**
 * Repository wrapper for shortcut persistence concerns.
 */
@Injectable()
export class ShortcutsRepository {
  constructor(
    @InjectRepository(Shortcut)
    private readonly repository: Repository<Shortcut>,
  ) {}

  async findAllByOwner(ownerId: number): Promise<Shortcut[]> {
    return this.repository.find({
      where: { owner: { id: ownerId } },
      relations: { owner: true },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async findByIdForOwner(id: string, ownerId: number): Promise<Shortcut | null> {
    return this.repository.findOne({
      where: { id, owner: { id: ownerId } },
      relations: { owner: true },
    });
  }

  create(data: Partial<Shortcut>): Shortcut {
    return this.repository.create(data);
  }

  async save(shortcut: Shortcut): Promise<Shortcut> {
    return this.repository.save(shortcut);
  }

  async remove(shortcut: Shortcut): Promise<void> {
    await this.repository.remove(shortcut);
  }

  createOwnerReference(ownerId: number): User {
    return this.repository.manager.create(User, { id: ownerId });
  }
}