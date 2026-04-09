import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualsController } from './manuals.controller';
import { ManualsService } from './manuals.service';
import { CustomManualsController } from './custom-manuals.controller';
import { CustomManualsService } from './custom-manuals.service';
import { Manual } from './entities/manual.entity';
import { ManualEntry } from './entities/manual-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Manual, ManualEntry])],
  controllers: [ManualsController, CustomManualsController],
  providers: [ManualsService, CustomManualsService],
  exports: [CustomManualsService, ManualsService],
})
export class ManualsModule {}
