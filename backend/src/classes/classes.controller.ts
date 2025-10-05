import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClassesService } from './classes.service';

@Controller()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get('manuals/:manualId/classes')
  list(@Param('manualId') manualId: string, @Query('lang') lang: 'en'|'es' = 'en') {
    return this.classesService.list(lang, manualId);
  }

  @Get('manuals/:manualId/classes/:id')
  get(@Param('manualId') manualId: string, @Param('id') id: string, @Query('lang') lang: 'en'|'es' = 'en') {
    return this.classesService.getById(lang, id, manualId);
  }
}
