import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { User } from './users/entities/user.entity';
import { Campaign } from './campaigns/entities/campaign.entity';
import { CampaignPlayer } from './campaigns/entities/campaign-player.entity';

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
        type: configService.get<string>('DB_TYPE') as any,
        database: configService.get<string>('DB_DATABASE'),
  entities: [User, Campaign, CampaignPlayer],
        // synchronize: true solo en desarrollo
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: false,
      }),
    }),
  AuthModule,
  UsersModule,
  CampaignsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}