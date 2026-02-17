import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { Shop } from './entities/shop.entity';
import { ShopSection } from './entities/shop-section.entity';
import { ShopColumn } from './entities/shop-column.entity';
import { ShopEntry } from './entities/shop-entry.entity';
import { ShopCell } from './entities/shop-cell.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shop,
      ShopSection,
      ShopColumn,
      ShopEntry,
      ShopCell,
      Campaign,
    ]),
  ],
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
