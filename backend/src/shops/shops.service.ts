import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Shop } from './entities/shop.entity';
import { ShopSection } from './entities/shop-section.entity';
import { ShopColumn } from './entities/shop-column.entity';
import { ShopEntry } from './entities/shop-entry.entity';
import { ShopCell } from './entities/shop-cell.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../users/entities/user.entity';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import fetch from 'node-fetch';

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    @InjectRepository(Shop)
    private readonly shopsRepo: Repository<Shop>,
    @InjectRepository(ShopSection)
    private readonly sectionsRepo: Repository<ShopSection>,
    @InjectRepository(ShopColumn)
    private readonly columnsRepo: Repository<ShopColumn>,
    @InjectRepository(ShopEntry)
    private readonly entriesRepo: Repository<ShopEntry>,
    @InjectRepository(ShopCell)
    private readonly cellsRepo: Repository<ShopCell>,
    @InjectRepository(Campaign)
    private readonly campaignsRepo: Repository<Campaign>,
  ) {}

  /**
   * Check if user is master (owner) of the campaign.
   */
  private async assertMaster(campaignId: string, userId: number): Promise<Campaign> {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner?.id !== userId) {
      throw new ForbiddenException('Only campaign master can perform this action');
    }
    return campaign;
  }

  /**
   * Check if user has access to campaign (master or player).
   */
  private async assertAccess(campaignId: string, userId: number): Promise<{ campaign: Campaign; isMaster: boolean }> {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const isMaster = campaign.owner?.id === userId;
    const isPlayer = (campaign.players || []).some((p) => p.user?.id === userId && p.status === 'active');

    if (!isMaster && !isPlayer) {
      throw new ForbiddenException('Not a member of this campaign');
    }

    return { campaign, isMaster };
  }

  // ===== SHOPS =====

  /**
   * List all shops for a campaign. Only master can access.
   */
  async listShops(userId: number, campaignId: string): Promise<Shop[]> {
    await this.assertMaster(campaignId, userId);
    return this.shopsRepo.find({
      where: { campaignId },
      relations: ['sections', 'sections.columns', 'sections.entries', 'sections.entries.cells', 'sections.entries.cells.column'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single shop by ID. Only master can access.
   */
  async getShop(userId: number, shopId: string): Promise<Shop> {
    const shop = await this.shopsRepo.findOne({
      where: { id: shopId },
      relations: ['campaign', 'campaign.owner', 'sections', 'sections.columns', 'sections.entries', 'sections.entries.cells', 'sections.entries.cells.column'],
    });
    if (!shop) throw new NotFoundException('Shop not found');
    
    await this.assertMaster(shop.campaignId, userId);
    return shop;
  }

  /**
   * Create a new shop. Only master can create.
   */
  async createShop(userId: number, dto: CreateShopDto): Promise<Shop> {
    await this.assertMaster(dto.campaignId, userId);

    // Get the user entity to assign as owner
    const user = await this.campaignsRepo.manager.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const shop = this.shopsRepo.create({
      name: dto.name,
      description: dto.description || null,
      campaignId: dto.campaignId,
      owner: user,
    });

    return this.shopsRepo.save(shop);
  }

  /**
   * Update a shop. Only master can update.
   */
  async updateShop(userId: number, shopId: string, dto: UpdateShopDto): Promise<Shop> {
    const shop = await this.shopsRepo.findOne({
      where: { id: shopId },
      relations: ['campaign', 'campaign.owner'],
    });
    if (!shop) throw new NotFoundException('Shop not found');
    
    await this.assertMaster(shop.campaignId, userId);

    if (dto.name !== undefined) shop.name = dto.name;
    if (dto.description !== undefined) shop.description = dto.description || null;

    return this.shopsRepo.save(shop);
  }

  /**
   * Delete a shop. Only master can delete.
   */
  async deleteShop(userId: number, shopId: string): Promise<void> {
    const shop = await this.shopsRepo.findOne({
      where: { id: shopId },
      relations: ['campaign', 'campaign.owner'],
    });
    if (!shop) throw new NotFoundException('Shop not found');
    
    await this.assertMaster(shop.campaignId, userId);
    await this.shopsRepo.remove(shop);
  }

  // ===== SECTIONS =====

  /**
   * Create a section in a shop.
   */
  async createSection(userId: number, shopId: string, dto: CreateSectionDto): Promise<ShopSection> {
    const shop = await this.shopsRepo.findOne({
      where: { id: shopId },
      relations: ['campaign', 'campaign.owner'],
    });
    if (!shop) throw new NotFoundException('Shop not found');
    
    await this.assertMaster(shop.campaignId, userId);

    const section = this.sectionsRepo.create({
      name: dto.name,
      order: dto.order ?? 0,
      shopId: shop.id,
    });

    return this.sectionsRepo.save(section);
  }

  /**
   * Update a section.
   */
  async updateSection(userId: number, sectionId: string, dto: UpdateSectionDto): Promise<ShopSection> {
    const section = await this.sectionsRepo.findOne({
      where: { id: sectionId },
      relations: ['shop', 'shop.campaign', 'shop.campaign.owner'],
    });
    if (!section) throw new NotFoundException('Section not found');
    
    await this.assertMaster(section.shop.campaignId, userId);

    if (dto.name !== undefined) section.name = dto.name;
    if (dto.order !== undefined) section.order = dto.order;

    return this.sectionsRepo.save(section);
  }

  /**
   * Delete a section.
   */
  async deleteSection(userId: number, sectionId: string): Promise<void> {
    const section = await this.sectionsRepo.findOne({
      where: { id: sectionId },
      relations: ['shop', 'shop.campaign', 'shop.campaign.owner'],
    });
    if (!section) throw new NotFoundException('Section not found');
    
    await this.assertMaster(section.shop.campaignId, userId);
    await this.sectionsRepo.remove(section);
  }

  // ===== COLUMNS =====

  /**
   * Create a column in a section.
   */
  async createColumn(userId: number, sectionId: string, dto: CreateColumnDto): Promise<ShopColumn> {
    const section = await this.sectionsRepo.findOne({
      where: { id: sectionId },
      relations: ['shop', 'shop.campaign', 'shop.campaign.owner', 'entries'],
    });
    if (!section) throw new NotFoundException('Section not found');
    
    await this.assertMaster(section.shop.campaignId, userId);

    const column = this.columnsRepo.create({
      name: dto.name,
      cellType: dto.cellType,
      order: dto.order ?? 0,
      sectionId: section.id,
    });

    const savedColumn = await this.columnsRepo.save(column);

    // Create empty cells for this column in all existing entries
    if (section.entries && section.entries.length > 0) {
      for (const entry of section.entries) {
        const cell = this.cellsRepo.create({
          entryId: entry.id,
          columnId: savedColumn.id,
          textValue: null,
          blobData: null,
          mimeType: null,
          size: null,
          originalUrl: null,
        });
        await this.cellsRepo.save(cell);
      }
    }

    return savedColumn;
  }

  /**
   * Update a column.
   */
  async updateColumn(userId: number, columnId: string, dto: UpdateColumnDto): Promise<ShopColumn> {
    const column = await this.columnsRepo.findOne({
      where: { id: columnId },
      relations: ['section', 'section.shop', 'section.shop.campaign', 'section.shop.campaign.owner'],
    });
    if (!column) throw new NotFoundException('Column not found');
    
    await this.assertMaster(column.section.shop.campaignId, userId);

    if (dto.name !== undefined) column.name = dto.name;
    if (dto.cellType !== undefined) column.cellType = dto.cellType;
    if (dto.order !== undefined) column.order = dto.order;

    return this.columnsRepo.save(column);
  }

  /**
   * Delete a column.
   */
  async deleteColumn(userId: number, columnId: string): Promise<void> {
    const column = await this.columnsRepo.findOne({
      where: { id: columnId },
      relations: ['section', 'section.shop', 'section.shop.campaign', 'section.shop.campaign.owner'],
    });
    if (!column) throw new NotFoundException('Column not found');
    
    await this.assertMaster(column.section.shop.campaignId, userId);
    
    // Delete all cells associated with this column first
    await this.cellsRepo.delete({ columnId: column.id });
    await this.columnsRepo.remove(column);
  }

  // ===== ENTRIES =====

  /**
   * Create an entry in a section.
   */
  async createEntry(userId: number, sectionId: string, dto: CreateEntryDto): Promise<ShopEntry> {
    const section = await this.sectionsRepo.findOne({
      where: { id: sectionId },
      relations: ['shop', 'shop.campaign', 'shop.campaign.owner', 'columns'],
    });
    if (!section) throw new NotFoundException('Section not found');
    
    await this.assertMaster(section.shop.campaignId, userId);

    const entry = this.entriesRepo.create({
      order: dto.order ?? 0,
      sectionId: section.id,
    });

    const savedEntry = await this.entriesRepo.save(entry);

    // Create cells for all columns (empty by default)
    for (const column of section.columns || []) {
      const providedCellValue = dto.cells?.find(c => c.columnId === column.id);
      
      const cell = this.cellsRepo.create({
        entryId: savedEntry.id,
        columnId: column.id,
        textValue: providedCellValue?.textValue || null,
        blobData: null,
        mimeType: null,
        size: null,
        originalUrl: null,
      });
      await this.cellsRepo.save(cell);
    }

    return this.entriesRepo.findOne({
      where: { id: savedEntry.id },
      relations: ['cells', 'cells.column'],
    });
  }

  /**
   * Update an entry.
   */
  async updateEntry(userId: number, entryId: string, dto: UpdateEntryDto): Promise<ShopEntry> {
    const entry = await this.entriesRepo.findOne({
      where: { id: entryId },
      relations: ['section', 'section.shop', 'section.shop.campaign', 'section.shop.campaign.owner', 'cells'],
    });
    if (!entry) throw new NotFoundException('Entry not found');
    
    await this.assertMaster(entry.section.shop.campaignId, userId);

    if (dto.order !== undefined) {
      entry.order = dto.order;
      await this.entriesRepo.save(entry);
    }

    // Update cells
    if (dto.cells && dto.cells.length > 0) {
      for (const cellDto of dto.cells) {
        if (cellDto.cellId) {
          // Update existing cell
          const cell = await this.cellsRepo.findOne({ where: { id: cellDto.cellId } });
          if (cell) {
            cell.textValue = cellDto.textValue || null;
            await this.cellsRepo.save(cell);
          }
        } else {
          // Create new cell
          const cell = this.cellsRepo.create({
            entryId: entry.id,
            columnId: cellDto.columnId,
            textValue: cellDto.textValue || null,
          });
          await this.cellsRepo.save(cell);
        }
      }
    }

    return this.entriesRepo.findOne({
      where: { id: entryId },
      relations: ['cells', 'cells.column'],
    });
  }

  /**
   * Delete an entry.
   */
  async deleteEntry(userId: number, entryId: string): Promise<void> {
    const entry = await this.entriesRepo.findOne({
      where: { id: entryId },
      relations: ['section', 'section.shop', 'section.shop.campaign', 'section.shop.campaign.owner'],
    });
    if (!entry) throw new NotFoundException('Entry not found');
    
    await this.assertMaster(entry.section.shop.campaignId, userId);
    await this.entriesRepo.remove(entry);
  }

  // ===== CELLS & MEDIA =====

  /**
   * Upload or update media for a cell.
   */
  async uploadCellMedia(
    userId: number,
    entryId: string,
    columnId: string,
    file?: { buffer: Buffer; mimetype: string; size: number },
    url?: string,
  ): Promise<ShopCell> {
    const entry = await this.entriesRepo.findOne({
      where: { id: entryId },
      relations: ['section', 'section.shop', 'section.shop.campaign', 'section.shop.campaign.owner'],
    });
    if (!entry) throw new NotFoundException('Entry not found');
    
    await this.assertMaster(entry.section.shop.campaignId, userId);

    const column = await this.columnsRepo.findOne({ where: { id: columnId } });
    if (!column) throw new NotFoundException('Column not found');

    // Validate that column accepts media
    if (column.cellType === 'text') {
      throw new BadRequestException('Cannot upload media to a text column');
    }

    let blobData: Buffer;
    let mimeType: string;
    let size: number;
    let originalUrl: string | null = null;

    if (file) {
      blobData = file.buffer;
      mimeType = file.mimetype;
      size = file.size;
    } else if (url) {
      // Fetch from URL
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch URL');
        const arrayBuffer = await response.arrayBuffer();
        blobData = Buffer.from(arrayBuffer);
        mimeType = response.headers.get('content-type') || 'application/octet-stream';
        size = blobData.length;
        originalUrl = url;
      } catch (error) {
        throw new BadRequestException('Failed to fetch media from URL');
      }
    } else {
      throw new BadRequestException('Either file or URL must be provided');
    }

    // Validate MIME type based on column type
    this.validateMimeType(column.cellType, mimeType);

    // TODO: For PNG images, preserve transparency using 'sharp' library if needed
    // This would require installing: npm install sharp
    // Example: if (mimeType === 'image/png') { blobData = await processTransparentPng(blobData); }

    // Find or create cell
    let cell = await this.cellsRepo.findOne({
      where: { entryId, columnId },
    });

    if (cell) {
      cell.blobData = blobData;
      cell.mimeType = mimeType;
      cell.size = size;
      cell.originalUrl = originalUrl;
    } else {
      cell = this.cellsRepo.create({
        entryId,
        columnId,
        blobData,
        mimeType,
        size,
        originalUrl,
      });
    }

    const saved = await this.cellsRepo.save(cell);
    // Return with relations
    return this.cellsRepo.findOne({
      where: { id: saved.id },
      relations: ['column'],
    });
  }

  /**
   * Update cell text value.
   */
  async updateCellText(userId: number, cellId: string, textValue: string): Promise<ShopCell> {
    const cell = await this.cellsRepo.findOne({
      where: { id: cellId },
      relations: ['entry', 'entry.section', 'entry.section.shop', 'entry.section.shop.campaign', 'entry.section.shop.campaign.owner', 'column'],
    });
    if (!cell) throw new NotFoundException('Cell not found');
    
    await this.assertMaster(cell.entry.section.shop.campaignId, userId);

    if (cell.column.cellType !== 'text') {
      throw new BadRequestException('Can only update text value for text columns');
    }

    cell.textValue = textValue;
    const saved = await this.cellsRepo.save(cell);
    // Return with relations
    return this.cellsRepo.findOne({
      where: { id: saved.id },
      relations: ['column'],
    });
  }

  /**
   * Get cell for streaming.
   */
  async getCellForStreaming(userId: number, cellId: string): Promise<ShopCell> {
    const cell = await this.cellsRepo.findOne({
      where: { id: cellId },
      relations: ['entry', 'entry.section', 'entry.section.shop', 'entry.section.shop.campaign'],
      select: ['id', 'blobData', 'mimeType', 'size', 'entryId', 'columnId'],
    });
    if (!cell) throw new NotFoundException('Cell not found');
    
    // Only master can access (players don't have access to shops)
    await this.assertMaster(cell.entry.section.shop.campaignId, userId);
    
    if (!cell.blobData) {
      throw new NotFoundException('Cell has no media data');
    }

    return cell;
  }

  /**
   * Search entries by text in cells.
   */
  async searchEntries(userId: number, campaignId: string, query: string): Promise<ShopEntry[]> {
    await this.assertMaster(campaignId, userId);

    // Find all cells matching the query
    const cells = await this.cellsRepo.find({
      where: { textValue: Like(`%${query}%`) },
      relations: ['entry', 'entry.section', 'entry.section.shop'],
    });

    // Filter by campaign and deduplicate entries
    const entryIds = new Set<string>();
    const entries: ShopEntry[] = [];

    for (const cell of cells) {
      if (cell.entry?.section?.shop?.campaignId === campaignId) {
        if (!entryIds.has(cell.entry.id)) {
          entryIds.add(cell.entry.id);
          const fullEntry = await this.entriesRepo.findOne({
            where: { id: cell.entry.id },
            relations: ['cells', 'cells.column', 'section'],
          });
          if (fullEntry) entries.push(fullEntry);
        }
      }
    }

    return entries;
  }

  /**
   * Validate MIME type based on cell type.
   */
  private validateMimeType(cellType: string, mimeType: string): void {
    const validTypes: Record<string, string[]> = {
      image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
      audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
      gif: ['image/gif'],
    };

    const allowed = validTypes[cellType] || [];
    if (!allowed.some(type => mimeType.startsWith(type.split('/')[0]) || mimeType === type)) {
      throw new BadRequestException(`Invalid MIME type for ${cellType} cell: ${mimeType}`);
    }
  }
}
