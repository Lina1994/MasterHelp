import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RacesController } from './races.controller';
import { RacesService } from './races.service';
import { CampaignRacesService } from './campaign-races.service';
import { CampaignRace } from './entities/campaign-race.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignRace, Campaign])],
  controllers: [RacesController],
  providers: [RacesService, CampaignRacesService],
  exports: [RacesService],
})
export class RacesModule {}
