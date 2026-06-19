import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { SkylineItemOverlay } from './entities/skyline-item-overlay.entity';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { UsersModule } from '../users/users.module';
import { CampaignOwnerGuard } from './guards/campaign-owner.guard';
import { ManualsModule } from '../manuals/manuals.module';
import { AdventureLogModule } from '../adventure-log/adventure-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, CampaignPlayer, SkylineItemOverlay]), UsersModule, ManualsModule, AdventureLogModule],
  providers: [CampaignsService, CampaignOwnerGuard],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
