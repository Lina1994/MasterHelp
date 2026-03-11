import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from './entities/character.entity';
import { AffinityLink } from './entities/affinity-link.entity';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';
import { AffinityLinksService } from './affinity-links.service';
import { AffinityLinksController } from './affinity-links.controller';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Character, AffinityLink, Campaign]), UsersModule],
  providers: [CharactersService, AffinityLinksService],
  controllers: [CharactersController, AffinityLinksController],
  exports: [CharactersService],
})
export class CharactersModule {}
