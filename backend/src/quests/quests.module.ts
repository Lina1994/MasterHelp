import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quest } from './entities/quest.entity';
import { QuestsService } from './quests.service';
import { QuestsController } from './quests.controller';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { UsersModule } from '../users/users.module';
import { AdventureLogModule } from '../adventure-log/adventure-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quest, Campaign]),
    UsersModule,
    AdventureLogModule,
  ],
  providers: [QuestsService],
  controllers: [QuestsController],
  exports: [QuestsService],
})
export class QuestsModule {}
