import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { CampaignCalendar } from './entities/campaign-calendar.entity';
import { DiaryEntry } from './entities/diary-entry.entity';
import { DiaryEntryItem } from './entities/diary-entry-item.entity';
import { DiarySession } from './entities/diary-session.entity';
import { DiarySessionItem } from './entities/diary-session-item.entity';
import { DiaryController } from './diary.controller';
import { DiaryService } from './diary.service';
import { CampaignCalendarRepository } from './repositories/campaign-calendar.repository';
import { DiaryEntryRepository } from './repositories/diary-entry.repository';
import { DiaryEntryItemRepository } from './repositories/diary-entry-item.repository';
import { DiarySessionRepository } from './repositories/diary-session.repository';
import { DiarySessionItemRepository } from './repositories/diary-session-item.repository';

@Module({
  imports: [CampaignsModule, TypeOrmModule.forFeature([CampaignCalendar, DiaryEntry, DiaryEntryItem, DiarySession, DiarySessionItem])],
  controllers: [DiaryController],
  providers: [
    DiaryService,
    CampaignCalendarRepository,
    DiaryEntryRepository,
    DiaryEntryItemRepository,
    DiarySessionRepository,
    DiarySessionItemRepository,
  ],
})
export class DiaryModule {}
