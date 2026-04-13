import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shortcut } from './entities/shortcut.entity';
import { ShortcutsController } from './shortcuts.controller';
import { ShortcutsRepository } from './shortcuts.repository';
import { ShortcutsService } from './shortcuts.service';

/**
 * Shortcuts feature module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Shortcut])],
  controllers: [ShortcutsController],
  providers: [ShortcutsRepository, ShortcutsService],
  exports: [ShortcutsService],
})
export class ShortcutsModule {}