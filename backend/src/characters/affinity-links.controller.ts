import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AffinityLinksService } from './affinity-links.service';
import { CreateAffinityLinkDto } from './dto/create-affinity-link.dto';
import { UpdateAffinityLinkDto } from './dto/update-affinity-link.dto';

/**
 * REST controller for managing affinity links (character relationship chart).
 *
 * All endpoints are JWT-protected.
 */
@Controller('affinity-links')
@UseGuards(JwtAuthGuard)
export class AffinityLinksController {
  constructor(private readonly service: AffinityLinksService) {}

  /** List all affinity links for a campaign. */
  @Get()
  async list(@Request() req, @Query('campaignId') campaignId: string) {
    return this.service.list(req.user.userId, campaignId);
  }

  /** Create a new affinity link between two characters. */
  @Post()
  async create(@Request() req, @Body() dto: CreateAffinityLinkDto) {
    return this.service.create(req.user.userId, dto);
  }

  /** Update an existing affinity link (label / colour). */
  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateAffinityLinkDto,
  ) {
    return this.service.update(req.user.userId, id, dto);
  }

  /** Delete an affinity link. */
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
