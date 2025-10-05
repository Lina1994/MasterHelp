import { Controller, Get, Param, Query } from '@nestjs/common';
import { SpellsService } from './spells.service';
import { GetSpellsQueryDto } from './dto/get-spells.query.dto';

@Controller()
export class SpellsController {
  constructor(private readonly spells: SpellsService) {}

  // Back-compat: GET /spells
  @Get('spells')
  list(@Query() q: GetSpellsQueryDto) {
    const lang = (q.lang || 'en');
    return this.spells.listPaged(lang, {
      search: q.search,
      level: q.level,
      school: q.school,
      concentration: q.concentration,
      ritual: q.ritual,
      page: q.page,
      pageSize: q.pageSize,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
    });
  }

  /**
   * GET /spells/:id?lang=
   * Returns the full spell detail for the given id.
   */
  @Get('spells/meta/all')
  meta(@Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.meta(l);
  }

  @Get('spells/:id')
  get(@Param('id') id: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.getById(l, id);
  }

  // Manual-aware endpoints
  @Get('manuals/:manualId/spells')
  listForManual(@Param('manualId') manualId: string, @Query() q: GetSpellsQueryDto) {
    const lang = (q.lang || 'en');
    return this.spells.listPaged(
      lang,
      {
        search: q.search,
        level: q.level,
        school: q.school,
        concentration: q.concentration,
        ritual: q.ritual,
        page: q.page,
        pageSize: q.pageSize,
        sortBy: q.sortBy,
        sortDir: q.sortDir,
      },
      manualId,
    );
  }

  @Get('manuals/:manualId/spells/meta/all')
  metaForManual(@Param('manualId') manualId: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.meta(l, manualId);
  }

  @Get('manuals/:manualId/spells/:id')
  getForManual(@Param('manualId') manualId: string, @Param('id') id: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.getById(l, id, manualId);
  }
}
