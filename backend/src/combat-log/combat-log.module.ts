import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CombatLog } from './entities/combat-log.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignCalendar } from '../diary/entities/campaign-calendar.entity';
import { CombatLogService } from './combat-log.service';
import { CombatLogController } from './combat-log.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CombatLog, Campaign, CampaignCalendar])],
  controllers: [CombatLogController],
  providers: [CombatLogService],
  exports: [CombatLogService],
})
export class CombatLogModule {}
