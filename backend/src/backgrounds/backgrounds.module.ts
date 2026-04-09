import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackgroundsController } from './backgrounds.controller';
import { BackgroundsService } from './backgrounds.service';
import { CampaignBackgroundsService } from './campaign-backgrounds.service';
import { CampaignBackground } from './entities/campaign-background.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { ManualsModule } from '../manuals/manuals.module';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignBackground, Campaign]), ManualsModule],
  controllers: [BackgroundsController],
  providers: [BackgroundsService, CampaignBackgroundsService],
  exports: [BackgroundsService],
})
export class BackgroundsModule {}
