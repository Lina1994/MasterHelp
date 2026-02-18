import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { WorldpediaFolder } from './entities/worldpedia-folder.entity';
import { WorldpediaNote } from './entities/worldpedia-note.entity';
import { WorldpediaNoteLink } from './entities/worldpedia-note-link.entity';
import { WorldpediaController } from './worldpedia.controller';
import { WorldpediaService } from './worldpedia.service';
import { WorldpediaFolderRepository } from './repositories/worldpedia-folder.repository';
import { WorldpediaNoteRepository } from './repositories/worldpedia-note.repository';
import { WorldpediaNoteLinkRepository } from './repositories/worldpedia-note-link.repository';

@Module({
  imports: [
    CampaignsModule,
    TypeOrmModule.forFeature([WorldpediaFolder, WorldpediaNote, WorldpediaNoteLink]),
  ],
  controllers: [WorldpediaController],
  providers: [
    WorldpediaService,
    WorldpediaFolderRepository,
    WorldpediaNoteRepository,
    WorldpediaNoteLinkRepository,
  ],
})
export class WorldpediaModule {}
