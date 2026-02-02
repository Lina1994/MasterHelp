import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiaryEntry } from '../entities/diary-entry.entity';

/**
 * Repository wrapper for diary entries.
 */
@Injectable()
export class DiaryEntryRepository {
  constructor(
    @InjectRepository(DiaryEntry)
    private readonly repo: Repository<DiaryEntry>,
  ) {}

  async findOneByDate(params: {
    campaignId: string;
    year: number;
    monthIndex: number;
    dayIndex: number;
  }): Promise<DiaryEntry | null> {
    return this.repo.findOne({ where: params });
  }

  async findOneByDateWithItems(params: {
    campaignId: string;
    year: number;
    monthIndex: number;
    dayIndex: number;
  }): Promise<DiaryEntry | null> {
    return this.repo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.items', 'item')
      .where('entry.campaignId = :campaignId', { campaignId: params.campaignId })
      .andWhere('entry.year = :year', { year: params.year })
      .andWhere('entry.monthIndex = :monthIndex', { monthIndex: params.monthIndex })
      .andWhere('entry.dayIndex = :dayIndex', { dayIndex: params.dayIndex })
      .orderBy('item.order', 'ASC')
      .addOrderBy('item.createdAt', 'ASC')
      .getOne();
  }

  async upsertByDate(params: {
    campaignId: string;
    year: number;
    monthIndex: number;
    dayIndex: number;
    publicHtml: string | null;
    privateHtml: string | null;
    lastEditedByUserId: number;
  }): Promise<DiaryEntry> {
    const existing = await this.findOneByDate({
      campaignId: params.campaignId,
      year: params.year,
      monthIndex: params.monthIndex,
      dayIndex: params.dayIndex,
    });

    if (existing) {
      existing.publicHtml = params.publicHtml;
      existing.privateHtml = params.privateHtml;
      existing.lastEditedByUserId = params.lastEditedByUserId;
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        campaignId: params.campaignId,
        year: params.year,
        monthIndex: params.monthIndex,
        dayIndex: params.dayIndex,
        publicHtml: params.publicHtml,
        privateHtml: params.privateHtml,
        lastEditedByUserId: params.lastEditedByUserId,
      }),
    );
  }
}
