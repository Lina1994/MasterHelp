import { Controller, Get, Param, Query } from '@nestjs/common';
import { SpellsService } from './spells.service';
import { GetSpellsQueryDto } from './dto/get-spells.query.dto';

@Controller('spells')
export class SpellsController {
  constructor(private readonly spells: SpellsService) {}

  @Get()
  list(@Query() q: GetSpellsQueryDto) {
    const lang = (q.lang || 'en');
    return this.spells.listPaged(lang, {
      search: q.search,
      level: q.level,
      school: q.school,
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
  @Get('meta/all')
  meta(@Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.meta(l);
  }

  @Get(':id')
  get(@Param('id') id: string, @Query('lang') lang?: 'en' | 'es') {
    const l = lang || 'en';
    return this.spells.getById(l, id);
  }
}
