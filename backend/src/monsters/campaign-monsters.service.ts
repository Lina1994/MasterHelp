import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignMonster } from './entities/campaign-monster.entity';
import { CreateCampaignMonsterDto } from './dto/create-campaign-monster.dto';
import { UpdateCampaignMonsterDto } from './dto/update-campaign-monster.dto';
import { ListCampaignMonstersDto } from './dto/list-campaign-monsters.dto';
import { MonstersRepository } from './monsters.repository';
import { CustomManualsService } from '../manuals/custom-manuals.service';
import { ManualsService } from '../manuals/manuals.service';
import type { LanguageCode, MonsterDetail, MonsterIndexItem } from './monster.types';
import * as sharp from 'sharp';

@Injectable()
export class CampaignMonstersService {
  private readonly monstersRepo = new MonstersRepository();

  constructor(
    @InjectRepository(CampaignMonster)
    private campaignMonsterRepository: Repository<CampaignMonster>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    private readonly customManualsService: CustomManualsService,
    private readonly manualsService: ManualsService,
  ) {}

  /**
   * List all monsters available for a campaign:
   * - Monsters from assigned manuals (read-only unless copied)
   * - Campaign-specific monsters (homebrew or edited copies)
   */
  async list(
    campaignId: string,
    requestingUserId: number,
    filters: ListCampaignMonstersDto,
    lang: LanguageCode = 'en',
  ) {
    // Verify access
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const manualIds = campaign.selectedManualIds || [];
    const results: any[] = [];

    // Get campaign-specific monsters
    const campaignMonsters = await this.campaignMonsterRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    // Map campaign monsters (homebrew and edited)
    for (const cm of campaignMonsters) {
      const data = cm.customData || this.getManualMonsterData(cm.sourceManualId, cm.sourceSlug, lang);
      if (data) {
        results.push({
          id: cm.id,
          name: data.name,
          type: data.type,
          size: data.size,
          alignment: data.alignment,
          challengeRating: data.challengeRating,
          origin: cm.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cm.sourceManualId || null,
          customOriginName: cm.customOriginName || null,
          tokenKind: cm.tokenKind,
          tokenColor: cm.tokenColor,
          tokenImageUrl: cm.tokenImageUrl,
          imageUrls: cm.imageUrls,
          isCustom: true,
        });
      }
    }

    // Get manual monsters (always include, even if edited in campaign)
    for (const manualId of manualIds) {
      if (!this.manualsService.isFileManual(manualId)) continue;
      const manualMonsters = this.monstersRepo.list(lang, manualId);
      for (const mm of manualMonsters) {
        // Include all manual monsters (originals remain visible even if edited)
        results.push({
          id: `${manualId}:${mm.slug}`,
          name: mm.name,
          type: mm.type,
          size: mm.size,
          alignment: mm.alignment,
          challengeRating: mm.challengeRating,
          origin: 'manual',
          sourceManual: manualId,
          isCustom: false,
        });
      }
    }

    // Get DB manual monsters
    for (const manualId of manualIds) {
      if (this.manualsService.isFileManual(manualId)) continue;
      const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'monster', lang);
      for (const entry of entries) {
        const d = entry.data as any;
        results.push({
          id: `${manualId}:${entry.entryKey}`,
          name: d.name || entry.entryKey,
          type: d.type,
          size: d.size,
          alignment: d.alignment,
          challengeRating: d.challengeRating,
          origin: 'manual',
          sourceManual: manualId,
          isCustom: false,
        });
      }
    }

    // Apply filters
    let filtered = this.applyFilters(results, filters);

    // Apply sorting
    filtered = this.applySorting(filtered, filters.sort);

    // Pagination
    const page = parseInt(filters.page || '1');
    const pageSize = parseInt(filters.pageSize || '20');
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return { items: paged, total, page, pageSize };
  }

  /**
   * Get details of a specific monster (from manual or campaign custom)
   */
  async get(campaignId: string, monsterId: string, requestingUserId: number, lang: LanguageCode = 'en') {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    // Check if it's a campaign monster (UUID format)
    if (monsterId.length > 30) {
      const cm = await this.campaignMonsterRepository.findOne({
        where: { id: monsterId, campaign: { id: campaignId } },
        relations: ['campaign'],
      });
      if (!cm) throw new NotFoundException('Monster not found');

      if (cm.customData) {
        return {
          ...cm.customData,
          id: cm.id,
          tokenKind: cm.tokenKind,
          tokenColor: cm.tokenColor,
          tokenImageUrl: cm.tokenImageUrl,
          imageUrls: cm.imageUrls,
          origin: cm.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cm.sourceManualId,
          customOriginName: cm.customOriginName,
        };
      } else if (cm.sourceManualId && cm.sourceSlug) {
        // Reference only, load from manual
        const detail = this.monstersRepo.get(lang, cm.sourceSlug, cm.sourceManualId);
        if (!detail) throw new NotFoundException('Manual monster not found');
        return {
          ...detail,
          id: cm.id,
          tokenKind: cm.tokenKind,
          tokenColor: cm.tokenColor,
          tokenImageUrl: cm.tokenImageUrl,
          imageUrls: cm.imageUrls,
          origin: 'manual',
          sourceManual: cm.sourceManualId,
        };
      }
      throw new NotFoundException('Monster data not found');
    }

    // Parse manual monster ID format: manualId:slug
    const [manualId, slug] = monsterId.split(':');
    if (!manualId || !slug) throw new NotFoundException('Invalid monster ID format');

    const detail = this.monstersRepo.get(lang, slug, manualId);
    if (!detail) throw new NotFoundException('Monster not found in manual');

    return {
      ...detail,
      id: monsterId,
      origin: 'manual',
      sourceManual: manualId,
    };
  }

  /**
   * Create a new campaign monster (homebrew or copy from manual)
   */
  async create(
    campaignId: string,
    dto: CreateCampaignMonsterDto,
    requestingUserId: number,
  ): Promise<CampaignMonster> {
    // Only master can create
    await this.verifyMasterAccess(campaignId, requestingUserId);

    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Process image URLs if provided
    let processedImageUrls = dto.imageUrls;
    if (dto.imageUrls?.high || dto.imageUrls?.medium) {
      processedImageUrls = await this.processMonsterImages(dto.imageUrls);
    }

    const monster = this.campaignMonsterRepository.create({
      campaign,
      sourceManualId: dto.sourceManualId || null,
      sourceSlug: dto.sourceSlug || null,
      customOriginName: dto.customOriginName || null,
      customData: dto.customData || null,
      tokenKind: dto.tokenKind || null,
      tokenColor: dto.tokenColor || null,
      tokenImageUrl: dto.tokenImageUrl || null,
      imageUrls: processedImageUrls || null,
    });

    const saved = await this.campaignMonsterRepository.save(monster);

    // If the source manual is a DB manual, also persist the monster as a ManualEntry
    if (dto.sourceManualId && dto.customData && !this.manualsService.isFileManual(dto.sourceManualId)) {
      const slug = (dto.customData as any).name
        ? (dto.customData as any).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : saved.id;
      try {
        await this.customManualsService.addEntry(dto.sourceManualId, requestingUserId, {
          entryType: 'monster',
          entryKey: slug,
          lang: 'es',
          data: dto.customData,
        });
      } catch {
        // Entry may already exist (duplicate key); not a blocking error
      }
    }

    return saved;
  }

  /**
   * Update campaign monster
   */
  async update(
    campaignId: string,
    monsterId: string,
    dto: UpdateCampaignMonsterDto,
    requestingUserId: number,
  ): Promise<CampaignMonster> {
    await this.verifyMasterAccess(campaignId, requestingUserId);

    const monster = await this.campaignMonsterRepository.findOne({
      where: { id: monsterId, campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    if (!monster) throw new NotFoundException('Monster not found');

    // Process image URLs if provided
    if (dto.imageUrls) {
      dto.imageUrls = await this.processMonsterImages(dto.imageUrls);
    }

    Object.assign(monster, dto);
    return this.campaignMonsterRepository.save(monster);
  }

  /**
   * Delete campaign monster
   */
  async delete(campaignId: string, monsterId: string, requestingUserId: number): Promise<void> {
    await this.verifyMasterAccess(campaignId, requestingUserId);

    const monster = await this.campaignMonsterRepository.findOne({
      where: { id: monsterId, campaign: { id: campaignId } },
    });
    if (!monster) throw new NotFoundException('Monster not found');

    await this.campaignMonsterRepository.remove(monster);
  }

  /**
   * Copy a manual monster to campaign for editing
   */
  async copyFromManual(
    campaignId: string,
    manualId: string,
    slug: string,
    requestingUserId: number,
    lang: LanguageCode = 'en',
  ): Promise<CampaignMonster> {
    await this.verifyMasterAccess(campaignId, requestingUserId);

    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Get manual monster data
    const manualMonster = this.monstersRepo.get(lang, slug, manualId);
    if (!manualMonster) throw new NotFoundException('Manual monster not found');

    // Check if already copied
    const existing = await this.campaignMonsterRepository.findOne({
      where: {
        campaign: { id: campaignId },
        sourceManualId: manualId,
        sourceSlug: slug,
      },
    });
    if (existing) {
      return existing;
    }

    // Create copy with customData
    const monster = this.campaignMonsterRepository.create({
      campaign,
      sourceManualId: manualId,
      sourceSlug: slug,
      customData: this.convertToCustomData(manualMonster),
    });

    return this.campaignMonsterRepository.save(monster);
  }

  // --- Helper methods ---

  private async verifyCampaignAccess(campaignId: string, userId: number) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const isOwner = campaign.owner.id === userId;
    const isPlayer = campaign.players.some((p) => p.user.id === userId && p.status === 'active');
    if (!isOwner && !isPlayer) {
      throw new ForbiddenException('No access to this campaign');
    }
  }

  private async verifyMasterAccess(campaignId: string, userId: number) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const isOwner = campaign.owner.id === userId;
    const isMaster = campaign.players.some(
      (p) => p.user.id === userId && p.status === 'active' && p.role === 'master',
    );
    if (!isOwner && !isMaster) {
      throw new ForbiddenException('Only master can modify bestiary');
    }
  }

  private getManualMonsterData(manualId: string | null | undefined, slug: string | null | undefined, lang: LanguageCode): any {
    if (!manualId || !slug) return null;
    return this.monstersRepo.get(lang, slug, manualId);
  }

  private convertToCustomData(monster: MonsterDetail): any {
    return {
      name: monster.name,
      size: monster.size,
      type: monster.type,
      subtype: monster.subtype,
      alignment: monster.alignment,
      challengeRating: monster.challengeRating,
      armorClass: monster.armorClass,
      hitPoints: monster.hitPoints,
      speed: monster.speed,
      abilities: monster.abilities,
      savingThrows: monster.savingThrows,
      skills: monster.skills,
      damageVulnerabilities: monster.damageVulnerabilities,
      damageResistances: monster.damageResistances,
      damageImmunities: monster.damageImmunities,
      conditionImmunities: monster.conditionImmunities,
      senses: monster.senses,
      languages: monster.languages,
      traits: monster.traits,
      actions: monster.actions,
      reactions: monster.reactions,
      legendaryActions: monster.legendaryActions,
    };
  }

  private applyFilters(items: any[], filters: ListCampaignMonstersDto): any[] {
    const { q, type, size, alignment, origin, cr } = filters;

    return items.filter((item) => {
      if (q && !item.name?.toLowerCase().includes(q.toLowerCase())) return false;
      if (type && item.type?.toLowerCase() !== type.toLowerCase()) return false;
      if (size && item.size?.toLowerCase() !== size.toLowerCase()) return false;
      if (alignment && item.alignment?.toLowerCase() !== alignment.toLowerCase()) return false;
      if (origin && item.origin !== origin) return false;
      
      // CR filtering - check if item CR is in the selected list
      if (cr) {
        const selectedCRs = cr.split(',').map(c => c.trim());
        const itemCR = item.challengeRating?.toString() || '0';
        if (!selectedCRs.includes(itemCR)) return false;
      }
      
      return true;
    });
  }

  private parseCR(cr: string | undefined): number {
    if (!cr) return 0;
    // Handle fractions like "1/2", "1/4", "1/8"
    if (cr.includes('/')) {
      const [num, den] = cr.split('/').map(n => parseFloat(n));
      return num / den;
    }
    return parseFloat(cr) || 0;
  }

  private applySorting(items: any[], sort?: string): any[] {
    if (!sort) return items;

    const sortedItems = [...items];

    switch (sort) {
      case 'name':
        return sortedItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'name_desc':
        return sortedItems.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      case 'type':
        return sortedItems.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
      case 'type_desc':
        return sortedItems.sort((a, b) => (b.type || '').localeCompare(a.type || ''));
      case 'size':
        const sizeOrder = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
        return sortedItems.sort((a, b) => {
          const aIdx = sizeOrder.indexOf(a.size);
          const bIdx = sizeOrder.indexOf(b.size);
          return aIdx - bIdx;
        });
      case 'size_desc':
        const sizeOrderDesc = ['Gargantuan', 'Huge', 'Large', 'Medium', 'Small', 'Tiny'];
        return sortedItems.sort((a, b) => {
          const aIdx = sizeOrderDesc.indexOf(a.size);
          const bIdx = sizeOrderDesc.indexOf(b.size);
          return aIdx - bIdx;
        });
      case 'cr':
        return sortedItems.sort((a, b) => this.parseCR(a.challengeRating) - this.parseCR(b.challengeRating));
      case 'cr_desc':
        return sortedItems.sort((a, b) => this.parseCR(b.challengeRating) - this.parseCR(a.challengeRating));
      case 'origin':
        return sortedItems.sort((a, b) => (a.origin || '').localeCompare(b.origin || ''));
      case 'origin_desc':
        return sortedItems.sort((a, b) => (b.origin || '').localeCompare(a.origin || ''));
      default:
        return sortedItems;
    }
  }

  /**
   * Process monster images: generate low, medium, high resolutions
   */
  private async processMonsterImages(imageUrls: { low?: string; medium?: string; high?: string }): Promise<{
    low?: string;
    medium?: string;
    high?: string;
  }> {
    try {
      const highRes = imageUrls.high || imageUrls.medium;
      if (!highRes) return imageUrls;

      // If it's a URL, fetch it
      let buffer: Buffer;
      if (highRes.startsWith('http')) {
        const response = await fetch(highRes);
        buffer = Buffer.from(await response.arrayBuffer());
      } else if (highRes.startsWith('data:')) {
        // Extract base64 from data URL
        const base64Data = highRes.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        return imageUrls; // Can't process
      }

      // Check if image has alpha channel (transparency)
      const metadata = await sharp(buffer).metadata();
      const hasAlpha = metadata.hasAlpha;

      // Generate three resolutions - use PNG if has transparency, JPEG otherwise
      let lowBuffer: Buffer;
      let mediumBuffer: Buffer;
      let highBuffer: Buffer;
      let mimeType: string;

      if (hasAlpha) {
        // Preserve transparency with PNG
        lowBuffer = await sharp(buffer).resize(100, 100, { fit: 'inside' }).png({ quality: 80 }).toBuffer();
        mediumBuffer = await sharp(buffer).resize(400, 400, { fit: 'inside' }).png({ quality: 85 }).toBuffer();
        highBuffer = await sharp(buffer).resize(1200, 1200, { fit: 'inside' }).png({ quality: 90 }).toBuffer();
        mimeType = 'image/png';
      } else {
        // Use JPEG for better compression when no transparency
        lowBuffer = await sharp(buffer).resize(100, 100, { fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
        mediumBuffer = await sharp(buffer).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
        highBuffer = await sharp(buffer).resize(1200, 1200, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
        mimeType = 'image/jpeg';
      }

      return {
        low: `data:${mimeType};base64,${lowBuffer.toString('base64')}`,
        medium: `data:${mimeType};base64,${mediumBuffer.toString('base64')}`,
        high: `data:${mimeType};base64,${highBuffer.toString('base64')}`,
      };
    } catch (err) {
      console.error('Error processing monster images:', err);
      return imageUrls; // Return original on error
    }
  }
}
