import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignCalendar, DiaryCalendarConfig } from '../entities/campaign-calendar.entity';

/**
 * Repository wrapper for campaign diary calendar settings.
 */
@Injectable()
export class CampaignCalendarRepository {
  constructor(
    @InjectRepository(CampaignCalendar)
    private readonly repo: Repository<CampaignCalendar>,
  ) {}

  async findByCampaignId(campaignId: string): Promise<CampaignCalendar | null> {
    return this.repo.findOne({ where: { campaignId } });
  }

  async upsertConfig(campaignId: string, config: DiaryCalendarConfig): Promise<CampaignCalendar> {
    const existing = await this.findByCampaignId(campaignId);
    if (existing) {
      existing.config = config;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ campaignId, config }));
  }
}
