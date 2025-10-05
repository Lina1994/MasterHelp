import { Controller, Get, Param, Query } from '@nestjs/common';
import { RacesService } from './races.service';

@Controller()
export class RacesController {
  constructor(private readonly races: RacesService) {}

  /**
   * Manual-aware endpoints for races
   * GET /manuals/:manualId/races?lang=
   * @param manualId Manual identifier (e.g., 'dnd5e-2014')
   * @param lang Locale code ('en' | 'es')
   */
  @Get('manuals/:manualId/races')
  listForManual(@Param('manualId') manualId: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.races.list(l, manualId);
  }

  /**
   * GET /manuals/:manualId/races/:id?lang=
   * Returns a single race by id.
   * @param manualId Manual identifier
   * @param id Race id
   * @param lang Locale code ('en' | 'es')
   */
  @Get('manuals/:manualId/races/:id')
  getForManual(
    @Param('manualId') manualId: string,
    @Param('id') id: string,
    @Query('lang') lang?: 'en' | 'es',
  ) {
    const l = lang || 'en';
    return this.races.getById(l, id, manualId);
  }
}
