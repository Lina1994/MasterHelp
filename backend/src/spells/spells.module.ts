import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpellsController } from './spells.controller';
import { SpellsService } from './spells.service';
import { CampaignSpellsService } from './campaign-spells.service';
import { CampaignSpell } from './entities/campaign-spell.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignSpell, Campaign])],
  controllers: [SpellsController],
  providers: [SpellsService, CampaignSpellsService],
  exports: [SpellsService, CampaignSpellsService],
})
export class SpellsModule {}
