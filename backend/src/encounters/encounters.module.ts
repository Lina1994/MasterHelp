import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncountersService } from './encounters.service';
import { EncountersController } from './encounters.controller';
import { Encounter } from './entities/encounter.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter, Campaign])],
  controllers: [EncountersController],
  providers: [EncountersService],
})
export class EncountersModule {}
