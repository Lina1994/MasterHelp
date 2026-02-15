import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quest } from './entities/quest.entity';
import { QuestsService } from './quests.service';
import { QuestsController } from './quests.controller';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignCalendar } from '../diary/entities/campaign-calendar.entity';
import { DiaryEntry } from '../diary/entities/diary-entry.entity';
import { DiaryEntryItem } from '../diary/entities/diary-entry-item.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quest, Campaign, CampaignCalendar, DiaryEntry, DiaryEntryItem]),
    UsersModule,
  ],
  providers: [QuestsService],
  controllers: [QuestsController],
  exports: [QuestsService],
})
export class QuestsModule {}
