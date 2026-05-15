import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignPlayer } from '../campaigns/entities/campaign-player.entity';
import { Shortcut } from './entities/shortcut.entity';
import { ShortcutsController } from './shortcuts.controller';
import { ShortcutsRepository } from './shortcuts.repository';
import { ShortcutsService } from './shortcuts.service';
import { SfxMetadataService } from './services/sfx-metadata.service';
import { SoundEffect } from '../soundtrack/soundeffects/entities/sound-effect.entity';

/**
 * Shortcuts feature module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Shortcut, Campaign, CampaignPlayer, SoundEffect])],
  controllers: [ShortcutsController],
  providers: [ShortcutsRepository, ShortcutsService, SfxMetadataService],
  exports: [ShortcutsService],
})
export class ShortcutsModule {}