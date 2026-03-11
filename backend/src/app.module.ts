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
import { SkylineItemOverlay } from './campaigns/entities/skyline-item-overlay.entity';
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
import { MapSkylineImage } from './maps/entities/map-skyline-image.entity';
import { CharactersModule } from './characters/characters.module';
import { Character } from './characters/entities/character.entity';
import { AffinityLink } from './characters/entities/affinity-link.entity';
import { Encounter } from './encounters/entities/encounter.entity';
import { EncountersModule } from './encounters/encounters.module';
import { DiaryModule } from './diary/diary.module';
import { QuestsModule } from './quests/quests.module';
import { ShopsModule } from './shops/shops.module';
import { Shop } from './shops/entities/shop.entity';
import { ShopSection } from './shops/entities/shop-section.entity';
import { ShopColumn } from './shops/entities/shop-column.entity';
import { ShopEntry } from './shops/entities/shop-entry.entity';
import { ShopCell } from './shops/entities/shop-cell.entity';
import { WorldpediaModule } from './worldpedia/worldpedia.module';
import { WorldpediaFolder } from './worldpedia/entities/worldpedia-folder.entity';
import { WorldpediaNote } from './worldpedia/entities/worldpedia-note.entity';
import { WorldpediaNoteLink } from './worldpedia/entities/worldpedia-note-link.entity';
import { NetworkInfoModule } from './network-info/network-info.module';
import { SkillsModule } from './skills/skills.module';
import { FeatsModule } from './feats/feats.module';
import { CampaignSkill } from './skills/entities/campaign-skill.entity';
import { CampaignFeat } from './feats/entities/campaign-feat.entity';
import { CampaignClass } from './classes/entities/campaign-class.entity';
import { CampaignRace } from './races/entities/campaign-race.entity';
import { TraitsModule } from './traits/traits.module';
import { CampaignTrait } from './traits/entities/campaign-trait.entity';
import { BackgroundsModule } from './backgrounds/backgrounds.module';
import { CampaignBackground } from './backgrounds/entities/campaign-background.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Especifica el archivo de entorno
      ignoreEnvFile: false, // Intentar leer .env, pero no fallar si no existe
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
          SkylineItemOverlay,
          Song,
          Playlist,
          SoundEffect,
          SoundPreset,
          SoundPresetItem,
          MapEntity,
          MapImage,
          MapSkylineImage,
          Character,
          AffinityLink,
          Encounter,
          Shop,
          ShopSection,
          ShopColumn,
          ShopEntry,
          ShopCell,
          WorldpediaFolder,
          WorldpediaNote,
          WorldpediaNoteLink,
          CampaignSkill,
          CampaignFeat,
          CampaignClass,
          CampaignRace,
          CampaignTrait,
          CampaignBackground,
        ],
        // Además, habilitar autoLoadEntities para cargar entidades registradas vía forFeature
        autoLoadEntities: true,
        // synchronize: true siempre en SQLite (app de escritorio, sin riesgo de pérdida)
        synchronize: true,
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
  CampaignsModule,
  SoundtrackModule,
  MapsModule,
  CharactersModule,
  EncountersModule,
  DiaryModule,
  QuestsModule,
  ShopsModule,
    ManualsModule,
    SpellsModule,
    RacesModule,
    ClassesModule,
    MonstersModule,
    WorldpediaModule,
    NetworkInfoModule,
    SkillsModule,
    FeatsModule,
    TraitsModule,
    BackgroundsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
