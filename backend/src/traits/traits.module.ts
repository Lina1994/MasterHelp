import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TraitsController } from './traits.controller';
import { TraitsService } from './traits.service';
import { CampaignTraitsService } from './campaign-traits.service';
import { CampaignTrait } from './entities/campaign-trait.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { ManualsModule } from '../manuals/manuals.module';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignTrait, Campaign]), ManualsModule],
  controllers: [TraitsController],
  providers: [TraitsService, CampaignTraitsService],
  exports: [TraitsService, CampaignTraitsService],
})
export class TraitsModule {}
