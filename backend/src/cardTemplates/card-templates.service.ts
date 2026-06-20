import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCardTemplateDto } from './dto/create-card-template.dto';
import { UpdateCardTemplateDto } from './dto/update-card-template.dto';
import { CardTemplate } from './entities/card-template.entity';

/**
 * Application service for user-owned card templates.
 *
 * Templates are global (not campaign-scoped) and are owned by a single
 * account. Any operation requires the templated to belong to the caller.
 */
@Injectable()
export class CardTemplatesService {
  constructor(
    @InjectRepository(CardTemplate)
    private readonly repository: Repository<CardTemplate>,
  ) {}

  /** Lists every template owned by the authenticated user, newest first. */
  async findAllForOwner(ownerId: number): Promise<CardTemplate[]> {
    return this.repository.find({
      where: { owner: { id: ownerId } as any },
      order: { updatedAt: 'DESC' },
    });
  }

  /** Returns a single template owned by the user. */
  async findOneForOwner(id: string, ownerId: number): Promise<CardTemplate> {
    const template = await this.repository.findOne({
      where: { id, owner: { id: ownerId } as any },
    });
    if (!template) {
      throw new NotFoundException(`Card template with ID "${id}" not found`);
    }
    return template;
  }

  /** Creates a new template for the user, applying sane defaults. */
  async createForOwner(ownerId: number, dto: CreateCardTemplateDto): Promise<CardTemplate> {
    const template = this.repository.create({
      name: dto.name,
      description: dto.description ?? null,
      widthMm: dto.widthMm ?? 63,
      heightMm: dto.heightMm ?? 88,
      orientation: dto.orientation ?? 'portrait',
      sizePreset: dto.sizePreset ?? 'POKER',
      globalStyle: dto.globalStyle ?? {},
      slots: dto.slots ?? [],
      owner: { id: ownerId } as any,
    });
    return this.repository.save(template);
  }

  /** Updates an existing owned template. */
  async updateForOwner(id: string, ownerId: number, dto: UpdateCardTemplateDto): Promise<CardTemplate> {
    const template = await this.findOneForOwner(id, ownerId);
    if (dto.name !== undefined) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.widthMm !== undefined) template.widthMm = dto.widthMm;
    if (dto.heightMm !== undefined) template.heightMm = dto.heightMm;
    if (dto.orientation !== undefined) template.orientation = dto.orientation;
    if (dto.sizePreset !== undefined) template.sizePreset = dto.sizePreset;
    if (dto.globalStyle !== undefined) template.globalStyle = dto.globalStyle;
    if (dto.slots !== undefined) template.slots = dto.slots;
    return this.repository.save(template);
  }

  /** Removes a template if owned by the user. */
  async removeForOwner(id: string, ownerId: number): Promise<void> {
    const template = await this.findOneForOwner(id, ownerId);
    await this.repository.remove(template);
  }

  /** Duplicates a template under a new "(Copia)" name. */
  async duplicateForOwner(id: string, ownerId: number): Promise<CardTemplate> {
    const original = await this.findOneForOwner(id, ownerId);
    return this.createForOwner(ownerId, {
      name: `${original.name} (Copia)`,
      description: original.description,
      widthMm: original.widthMm,
      heightMm: original.heightMm,
      orientation: original.orientation,
      sizePreset: original.sizePreset,
      globalStyle: original.globalStyle,
      slots: original.slots,
    });
  }
}
