import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatsController } from './feats.controller';
import { FeatsService } from './feats.service';
import { CampaignFeatsService } from './campaign-feats.service';
import { CampaignFeat } from './entities/campaign-feat.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { ManualsModule } from '../manuals/manuals.module';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignFeat, Campaign]), ManualsModule],
  controllers: [FeatsController],
  providers: [FeatsService, CampaignFeatsService],
  exports: [FeatsService, CampaignFeatsService],
})
export class FeatsModule {}
