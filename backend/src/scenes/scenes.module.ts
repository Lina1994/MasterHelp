import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignPlayer } from '../campaigns/entities/campaign-player.entity';
import { ShortcutsModule } from '../shortcuts/shortcuts.module';
import { SceneExecution } from './entities/scene-execution.entity';
import { SceneVideo } from './entities/scene-video.entity';
import { Scene } from './entities/scene.entity';
import { SceneRunnerService } from './scene-runner.service';
import { SceneVideosController } from './scene-videos.controller';
import { SceneVideosRepository } from './scene-videos.repository';
import { SceneVideosService } from './scene-videos.service';
import { ScenesController } from './scenes.controller';
import { ScenesRepository } from './scenes.repository';
import { ScenesService } from './scenes.service';

/**
 * Scenes feature module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Scene, SceneExecution, SceneVideo, Campaign, CampaignPlayer]), ShortcutsModule],
  controllers: [ScenesController, SceneVideosController],
  providers: [ScenesRepository, SceneVideosRepository, ScenesService, SceneVideosService, SceneRunnerService],
  exports: [ScenesService],
})
export class ScenesModule {}