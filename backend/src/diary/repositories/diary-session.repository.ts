import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiarySession, DiaryDayRef } from '../entities/diary-session.entity';

/**
 * Repository wrapper for diary sessions.
 */
@Injectable()
export class DiarySessionRepository {
  constructor(
    @InjectRepository(DiarySession)
    private readonly repo: Repository<DiarySession>,
  ) {}

  async findAllForCampaign(campaignId: string): Promise<DiarySession[]> {
    return this.repo.find({ where: { campaignId }, order: { startedAt: 'DESC' } });
  }

  async findAllForCampaignWithItems(campaignId: string): Promise<DiarySession[]> {
    return this.repo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.items', 'item')
      .where('session.campaignId = :campaignId', { campaignId })
      .orderBy('session.startedAt', 'DESC')
      .addOrderBy('item.order', 'ASC')
      .addOrderBy('item.createdAt', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<DiarySession | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdWithItems(id: string): Promise<DiarySession | null> {
    return this.repo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.items', 'item')
      .where('session.id = :id', { id })
      .orderBy('item.order', 'ASC')
      .addOrderBy('item.createdAt', 'ASC')
      .getOne();
  }

  async findActiveForCampaign(campaignId: string): Promise<DiarySession | null> {
    return this.repo
      .createQueryBuilder('session')
      .where('session.campaignId = :campaignId', { campaignId })
      .andWhere('session.endedAt IS NULL')
      .orderBy('session.startedAt', 'DESC')
      .getOne();
  }

  async findActiveForCampaignWithItems(campaignId: string): Promise<DiarySession | null> {
    return this.repo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.items', 'item')
      .where('session.campaignId = :campaignId', { campaignId })
      .andWhere('session.endedAt IS NULL')
      .orderBy('session.startedAt', 'DESC')
      .addOrderBy('item.order', 'ASC')
      .addOrderBy('item.createdAt', 'ASC')
      .getOne();
  }

  async createSession(params: {
    campaignId: string;
    title: string | null;
    isPublic: boolean;
    publicHtml: string | null;
    privateHtml: string | null;
    days: DiaryDayRef[];
    createdByUserId: number;
    startedAt?: Date;
  }): Promise<DiarySession> {
    return this.repo.save(
      this.repo.create({
        campaignId: params.campaignId,
        title: params.title,
        isPublic: params.isPublic,
        publicHtml: params.publicHtml,
        privateHtml: params.privateHtml,
        days: params.days,
        startedAt: params.startedAt ?? new Date(),
        endedAt: null,
        createdByUserId: params.createdByUserId,
      }),
    );
  }

  async save(session: DiarySession): Promise<DiarySession> {
    return this.repo.save(session);
  }
}
