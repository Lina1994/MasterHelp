import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { CampaignClassesService } from './campaign-classes.service';
import { CampaignClass } from './entities/campaign-class.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { ManualsModule } from '../manuals/manuals.module';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignClass, Campaign]), ManualsModule],
  controllers: [ClassesController],
  providers: [ClassesService, CampaignClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
