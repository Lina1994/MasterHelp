import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonstersController } from './monsters.controller';
import { MonstersService } from './monsters.service';
import { CampaignMonstersService } from './campaign-monsters.service';
import { CampaignMonster } from './entities/campaign-monster.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { ManualsModule } from '../manuals/manuals.module';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignMonster, Campaign]), ManualsModule],
  controllers: [MonstersController],
  providers: [MonstersService, CampaignMonstersService],
  exports: [CampaignMonstersService],
})
export class MonstersModule {}
