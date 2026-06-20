import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CardTemplatesService } from './card-templates.service';
import { CreateCardTemplateDto } from './dto/create-card-template.dto';
import { UpdateCardTemplateDto } from './dto/update-card-template.dto';

/**
 * REST controller for card templates. All endpoints require a valid JWT and
 * operate on templates owned by the caller.
 */
@ApiTags('card-templates')
@Controller('card-templates')
@UseGuards(JwtAuthGuard)
export class CardTemplatesController {
  constructor(private readonly service: CardTemplatesService) {}

  /** Lists all templates owned by the caller, newest first. */
  @Get()
  findAll(@Request() req) {
    return this.service.findAllForOwner(req.user.userId);
  }

  /** Returns one template, owned by the caller. */
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOneForOwner(id, req.user.userId);
  }

  /** Creates a new template. */
  @Post()
  create(@Request() req, @Body() dto: CreateCardTemplateDto) {
    return this.service.createForOwner(req.user.userId, dto);
  }

  /** Patches an existing template. */
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateCardTemplateDto) {
    return this.service.updateForOwner(id, req.user.userId, dto);
  }

  /** Deletes a template. */
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.service.removeForOwner(id, req.user.userId);
    return { success: true };
  }

  /** Duplicates a template to a new entry with " (Copia)" appended to its name. */
  @Post(':id/duplicate')
  duplicate(@Request() req, @Param('id') id: string) {
    return this.service.duplicateForOwner(id, req.user.userId);
  }
}
