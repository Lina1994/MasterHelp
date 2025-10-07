import { Controller, Get, Param, Query } from '@nestjs/common';
import { MonstersService } from './monsters.service';
import { ListMonstersDto } from './dto/list-monsters.dto';

@Controller()
export class MonstersController {
  constructor(private readonly service: MonstersService) {}

  @Get('manuals/:manualId/monsters')
  list(@Param('manualId') manualId: string, @Query() query: ListMonstersDto) {
    const lang = (query.lang || 'en');
    const { q, type, size, crMin, crMax, page = 1, pageSize = 20 } = query;
    const items = this.service.list(lang, { q, type, size, crMin, crMax });

    // Paginación en memoria (suficiente para el SRD y primera versión)
    const total = items.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = items.slice(start, end);
    return { items: paged, total, page, pageSize };
  }

  @Get('manuals/:manualId/monsters/:slug')
  get(@Param('manualId') manualId: string, @Param('slug') slug: string, @Query('lang') lang: 'en' | 'es' = 'en') {
    return this.service.get(lang, slug);
  }
}
