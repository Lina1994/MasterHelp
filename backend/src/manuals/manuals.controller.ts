import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ManualsService } from './manuals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('manuals')
export class ManualsController {
  constructor(private readonly service: ManualsService) {}

  /**
   * Lista de manuales disponibles.
   * Si se proporciona JWT, incluye manuales personalizados del usuario.
   * Si no, solo devuelve los manuales de fichero (públicos).
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: any): Promise<any> {
    const userId = req.user?.userId;
    if (userId) {
      return this.service.listAllManuals(userId);
    }
    return this.service.listManuals();
  }

  /** Árbol de contenidos (TOC) de un manual */
  @Get(':manualId/toc')
  async toc(@Param('manualId') manualId: string): Promise<any> {
    return this.service.getToc(manualId);
  }

  /** Contenido de una sección/página */
  @Get(':manualId/sections/:nodeId')
  async section(
    @Param('manualId') manualId: string,
    @Param('nodeId') nodeId: string,
    @Query('lang') lang?: string,
  ): Promise<any> {
    return this.service.getSection(manualId, nodeId, lang);
  }

  /** Búsqueda simple por título/contenido */
  @Get(':manualId/search')
  search(@Param('manualId') manualId: string, @Query('q') q?: string): any {
    return this.service.search(manualId, q || '');
  }
}
