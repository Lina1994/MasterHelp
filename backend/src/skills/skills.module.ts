import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { CampaignSkillsService } from './campaign-skills.service';
import { CampaignSkill } from './entities/campaign-skill.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { ManualsModule } from '../manuals/manuals.module';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignSkill, Campaign]), ManualsModule],
  controllers: [SkillsController],
  providers: [SkillsService, CampaignSkillsService],
  exports: [SkillsService, CampaignSkillsService],
})
export class SkillsModule {}
