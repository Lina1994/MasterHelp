import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Song } from './entities/song.entity';
import { SoundtrackService } from './soundtrack.service';
import { SoundtrackController } from './soundtrack.controller';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignPlayer } from '../campaigns/entities/campaign-player.entity';
import { User } from '../users/entities/user.entity';

@Module({
  // Necesitamos incluir User y CampaignPlayer para que las relaciones eager (owner, players)
  // en Campaign y Song se hidraten correctamente durante las consultas del servicio.
  imports: [TypeOrmModule.forFeature([Song, Campaign, CampaignPlayer, User])],
  providers: [SoundtrackService],
  controllers: [SoundtrackController],
  exports: [SoundtrackService],
})
export class SoundtrackModule {}
