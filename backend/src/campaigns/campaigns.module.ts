import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { UsersModule } from '../users/users.module';
import { CampaignOwnerGuard } from './guards/campaign-owner.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, CampaignPlayer]), UsersModule],
  providers: [CampaignsService, CampaignOwnerGuard],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}