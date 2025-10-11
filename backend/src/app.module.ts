import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { SoundtrackModule } from './soundtrack/soundtrack.module';
import { User } from './users/entities/user.entity';
import { Campaign } from './campaigns/entities/campaign.entity';
import { CampaignPlayer } from './campaigns/entities/campaign-player.entity';
import { Song } from './soundtrack/entities/song.entity';
import { Playlist } from './soundtrack/entities/playlist.entity';
import { SoundEffect } from './soundtrack/soundeffects/entities/sound-effect.entity';
import { SoundPreset } from './soundtrack/soundeffects/entities/sound-preset.entity';
import { SoundPresetItem } from './soundtrack/soundeffects/entities/sound-preset-item.entity';
import { ManualsModule } from './manuals/manuals.module';
import { SpellsModule } from './spells/spells.module';
import { RacesModule } from './races/races.module';
import { ClassesModule } from './classes/classes.module';
import { MonstersModule } from './monsters/monsters.module';
import { MapsModule } from './maps/maps.module';
import { MapEntity } from './maps/entities/map.entity';
import { MapImage } from './maps/entities/map-image.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Especifica el archivo de entorno
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // Using explicit union of supported driver types instead of casting to any
        type: (configService.get<string>('DB_TYPE') || 'sqlite') as 'sqlite' | 'better-sqlite3',
        database: configService.get<string>('DB_DATABASE'),
        // Incluir todas las entidades usadas por módulos (evitar metadata ausente)
        entities: [
          User,
          Campaign,
          CampaignPlayer,
          Song,
          Playlist,
          SoundEffect,
          SoundPreset,
          SoundPresetItem,
          MapEntity,
          MapImage,
        ],
        // Además, habilitar autoLoadEntities para cargar entidades registradas vía forFeature
        autoLoadEntities: true,
        // synchronize: true en cualquier entorno que no sea producción (facilita dev local)
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
  CampaignsModule,
  SoundtrackModule,
  MapsModule,
    ManualsModule,
    SpellsModule,
    RacesModule,
    ClassesModule,
    MonstersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
