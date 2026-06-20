import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardTemplate } from './entities/card-template.entity';
import { CardTemplatesController } from './card-templates.controller';
import { CardTemplatesService } from './card-templates.service';

/**
 * Card Templates feature module. Templates are owned by a single user and
 * stored as JSON-backed records for flexibility.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CardTemplate])],
  controllers: [CardTemplatesController],
  providers: [CardTemplatesService],
  exports: [CardTemplatesService],
})
export class CardTemplatesModule {}
