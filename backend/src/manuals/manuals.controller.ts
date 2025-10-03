import { Controller, Get, Param, Query } from '@nestjs/common';
import { ManualsService } from './manuals.service';

@Controller('manuals')
export class ManualsController {
  constructor(private readonly service: ManualsService) {}

  /** Lista de manuales disponibles (pública) */
  @Get()
  list(): any {
    return this.service.listManuals();
  }

  /** Árbol de contenidos (TOC) de un manual */
  @Get(':manualId/toc')
  toc(@Param('manualId') manualId: string): any {
    return this.service.getToc(manualId);
  }

  /** Contenido de una sección/página */
  @Get(':manualId/sections/:nodeId')
  section(
    @Param('manualId') manualId: string,
    @Param('nodeId') nodeId: string,
    @Query('lang') lang?: string,
  ): any {
    return this.service.getSection(manualId, nodeId, lang);
  }

  /** Búsqueda simple por título/contenido */
  @Get(':manualId/search')
  search(@Param('manualId') manualId: string, @Query('q') q?: string): any {
    return this.service.search(manualId, q || '');
  }
}
