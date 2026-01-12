import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { MapEntity } from './entities/map.entity';
import { MapImage } from './entities/map-image.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { MapSkylineImage } from './entities/map-skyline-image.entity';
import { MapFogState } from './entities/map-fog-state.entity';
import { MapTokensState } from './entities/map-tokens-state.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MapEntity, MapImage, MapSkylineImage, MapFogState, MapTokensState, Campaign])],
  controllers: [MapsController],
  providers: [MapsService],
  exports: [MapsService],
})
export class MapsModule {}
