import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DiaryEntryItem } from '../entities/diary-entry-item.entity';

/**
 * Repository wrapper for diary entry items.
 */
@Injectable()
export class DiaryEntryItemRepository {
  constructor(
    @InjectRepository(DiaryEntryItem)
    private readonly repo: Repository<DiaryEntryItem>,
  ) {}

  async findByEntryId(entryId: string): Promise<DiaryEntryItem[]> {
    return this.repo.find({ where: { entryId }, order: { order: 'ASC', createdAt: 'ASC' } });
  }

  async findByIds(ids: string[]): Promise<DiaryEntryItem[]> {
    if (!ids.length) return [];
    return this.repo.find({ where: { id: In(ids) } });
  }

  async save(item: DiaryEntryItem): Promise<DiaryEntryItem> {
    return this.repo.save(item);
  }

  async saveMany(items: DiaryEntryItem[]): Promise<DiaryEntryItem[]> {
    return this.repo.save(items);
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.repo.delete({ id: In(ids) });
  }
}
