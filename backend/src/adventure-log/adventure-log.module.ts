import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignCalendar } from '../diary/entities/campaign-calendar.entity';
import { DiaryEntry } from '../diary/entities/diary-entry.entity';
import { DiaryEntryItem } from '../diary/entities/diary-entry-item.entity';
import { DiarySession } from '../diary/entities/diary-session.entity';
import { AdventureLogService } from './adventure-log.service';

/**
 * Provides the {@link AdventureLogService} used by various modules to append
 * automatic diary entries. It only depends on TypeORM repositories (no other
 * services) to avoid circular module dependencies.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Campaign, CampaignCalendar, DiaryEntry, DiaryEntryItem, DiarySession])],
  providers: [AdventureLogService],
  exports: [AdventureLogService],
})
export class AdventureLogModule {}
