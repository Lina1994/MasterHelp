import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { MapEntity } from './entities/map.entity';
import { MapImage } from './entities/map-image.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { MapSkylineImage } from './entities/map-skyline-image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MapEntity, MapImage, MapSkylineImage, Campaign])],
  controllers: [MapsController],
  providers: [MapsService],
  exports: [MapsService],
})
export class MapsModule {}
