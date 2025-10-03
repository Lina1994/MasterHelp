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
import { ManualsModule } from './manuals/manuals.module';
import { SpellsModule } from './spells/spells.module';

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
  // Incluir Song para evitar errores de metadata ausente en consultas del módulo Soundtrack
  entities: [User, Campaign, CampaignPlayer, Song],
        // synchronize: true solo en desarrollo
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
  CampaignsModule,
  SoundtrackModule,
    ManualsModule,
    SpellsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
