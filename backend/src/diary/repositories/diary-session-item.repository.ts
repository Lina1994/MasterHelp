import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DiarySessionItem } from '../entities/diary-session-item.entity';

/**
 * Repository wrapper for diary session items.
 */
@Injectable()
export class DiarySessionItemRepository {
  constructor(
    @InjectRepository(DiarySessionItem)
    private readonly repo: Repository<DiarySessionItem>,
  ) {}

  async findBySessionId(sessionId: string): Promise<DiarySessionItem[]> {
    return this.repo.find({ where: { sessionId }, order: { order: 'ASC', createdAt: 'ASC' } });
  }

  async saveMany(items: DiarySessionItem[]): Promise<DiarySessionItem[]> {
    return this.repo.save(items);
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.repo.delete({ id: In(ids) });
  }
}
