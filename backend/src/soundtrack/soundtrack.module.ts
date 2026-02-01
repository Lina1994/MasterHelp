import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Song } from './entities/song.entity';
import { SoundtrackService } from './soundtrack.service';
import { SoundtrackController } from './soundtrack.controller';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignPlayer } from '../campaigns/entities/campaign-player.entity';
import { User } from '../users/entities/user.entity';
import { Playlist } from './entities/playlist.entity';
import { SongPlayLog } from './entities/song-play-log.entity';
import { SoundEffect } from './soundeffects/entities/sound-effect.entity';
import { SoundPreset } from './soundeffects/entities/sound-preset.entity';
import { SoundPresetItem } from './soundeffects/entities/sound-preset-item.entity';
import { SoundEffectsService } from './soundeffects/soundeffects.service';
import { SoundEffectsController } from './soundeffects/soundeffects.controller';
import { SoundPresetsController } from './soundeffects/soundpresets.controller';

@Module({
  // Necesitamos incluir User y CampaignPlayer para que las relaciones eager (owner, players)
  // en Campaign y Song se hidraten correctamente durante las consultas del servicio.
  imports: [TypeOrmModule.forFeature([Song, Campaign, CampaignPlayer, User, Playlist, SongPlayLog, SoundEffect, SoundPreset, SoundPresetItem])],
  providers: [SoundtrackService, SoundEffectsService],
  controllers: [SoundtrackController, SoundEffectsController, SoundPresetsController],
  exports: [SoundtrackService, SoundEffectsService],
})
export class SoundtrackModule {}
