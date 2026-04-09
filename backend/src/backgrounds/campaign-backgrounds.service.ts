import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignBackground } from './entities/campaign-background.entity';
import { BackgroundsService, Background } from './backgrounds.service';
import { CustomManualsService } from '../manuals/custom-manuals.service';
import { ManualsService } from '../manuals/manuals.service';
import { CreateCampaignBackgroundDto } from './dto/create-campaign-background.dto';
import { UpdateCampaignBackgroundDto } from './dto/update-campaign-background.dto';
import { ListCampaignBackgroundsDto } from './dto/list-campaign-backgrounds.dto';

type LanguageCode = 'en' | 'es';

/**
 * Service for campaign-specific backgrounds (CRUD with manual merge).
 */
@Injectable()
export class CampaignBackgroundsService {
  constructor(
    @InjectRepository(CampaignBackground)
    private campaignBackgroundRepository: Repository<CampaignBackground>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    private backgroundsService: BackgroundsService,
    private readonly customManualsService: CustomManualsService,
    private readonly manualsService: ManualsService,
  ) {}

  /**
   * List all backgrounds for a campaign (manual + custom).
   */
  async list(
    campaignId: string,
    requestingUserId: number,
    filters: ListCampaignBackgroundsDto,
    lang: LanguageCode = 'en',
  ) {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const manualIds = campaign.selectedManualIds || [];
    const results: any[] = [];

    // Campaign-specific backgrounds
    const campaignBackgrounds = await this.campaignBackgroundRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    for (const cb of campaignBackgrounds) {
      const data = cb.customData || this.getManualBackgroundData(cb.sourceManualId, cb.sourceBackgroundId, lang);
      if (data) {
        results.push({
          id: cb.id,
          name: data.name,
          description: data.description,
          origin: cb.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cb.sourceManualId || null,
          customOriginName: cb.customOriginName || null,
          isCustom: true,
        });
      }
    }

    // Manual backgrounds (file-based)
    for (const manualId of manualIds) {
      if (!this.manualsService.isFileManual(manualId)) continue;
      const manualBackgrounds = this.backgroundsService.list(lang, manualId);
      for (const mb of manualBackgrounds) {
        results.push({
          id: `${manualId}:${mb.id}`,
          name: mb.name,
          description: mb.description,
          origin: 'manual',
          sourceManual: manualId,
          isCustom: false,
        });
      }
    }

    // DB manual backgrounds
    for (const manualId of manualIds) {
      if (this.manualsService.isFileManual(manualId)) continue;
      const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'background', lang);
      for (const entry of entries) {
        const d = entry.data as any;
        results.push({
          id: `${manualId}:${entry.entryKey}`,
          name: d.name || entry.entryKey,
          description: d.description,
          origin: 'manual',
          sourceManual: manualId,
          isCustom: false,
        });
      }
    }

    let filtered = this.applyFilters(results, filters);
    filtered = this.applySorting(filtered, filters.sort);

    const page = parseInt(String(filters.page || 1));
    const pageSize = parseInt(String(filters.pageSize || 50));
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return { items: paged, total, page, pageSize };
  }

  /**
   * Get details of a specific background.
   */
  async get(campaignId: string, backgroundId: string, requestingUserId: number, lang: LanguageCode = 'en') {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    if (!backgroundId.includes(':') && backgroundId.length > 30) {
      const cb = await this.campaignBackgroundRepository.findOne({
        where: { id: backgroundId, campaign: { id: campaignId } },
        relations: ['campaign'],
      });
      if (!cb) throw new NotFoundException('Background not found');

      if (cb.customData) {
        return {
          ...cb.customData,
          id: cb.id,
          origin: cb.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cb.sourceManualId,
          customOriginName: cb.customOriginName,
          isCustom: true,
        };
      } else if (cb.sourceManualId && cb.sourceBackgroundId) {
        const detail = this.backgroundsService.getById(lang, cb.sourceBackgroundId, cb.sourceManualId);
        if (!detail) throw new NotFoundException('Manual background not found');
        return { ...detail, id: cb.id, origin: 'manual', sourceManual: cb.sourceManualId, isCustom: false };
      }
      throw new NotFoundException('Background data not found');
    }

    const [manualId, originalBackgroundId] = backgroundId.split(':');
    if (!manualId || !originalBackgroundId) throw new NotFoundException('Invalid background ID format');

    if (this.manualsService.isFileManual(manualId)) {
      const detail = this.backgroundsService.getById(lang, originalBackgroundId, manualId);
      if (!detail) throw new NotFoundException('Background not found in manual');
      return { ...detail, id: backgroundId, origin: 'manual', sourceManual: manualId, isCustom: false };
    }

    const entry = await this.customManualsService.getEntry(manualId, 'background', originalBackgroundId, lang);
    const d = entry.data as any;
    return {
      id: backgroundId,
      name: d.name || entry.entryKey,
      description: d.description,
      origin: 'manual',
      sourceManual: manualId,
      isCustom: false,
    };
  }

  /**
   * Create a new campaign background (homebrew).
   */
  async create(campaignId: string, dto: CreateCampaignBackgroundDto, requestingUserId: number): Promise<CampaignBackground> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const background = this.campaignBackgroundRepository.create({
      campaign,
      sourceManualId: dto.sourceManualId || null,
      sourceBackgroundId: dto.sourceBackgroundId || null,
      customOriginName: dto.customOriginName || null,
      customData: dto.customData || null,
    });
    return this.campaignBackgroundRepository.save(background);
  }

  /**
   * Update a campaign background.
   */
  async update(campaignId: string, backgroundId: string, dto: UpdateCampaignBackgroundDto, requestingUserId: number): Promise<CampaignBackground> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const background = await this.campaignBackgroundRepository.findOne({
      where: { id: backgroundId, campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    if (!background) throw new NotFoundException('Background not found');
    Object.assign(background, dto);
    return this.campaignBackgroundRepository.save(background);
  }

  /**
   * Delete a campaign background.
   */
  async delete(campaignId: string, backgroundId: string, requestingUserId: number): Promise<void> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const background = await this.campaignBackgroundRepository.findOne({
      where: { id: backgroundId, campaign: { id: campaignId } },
    });
    if (!background) throw new NotFoundException('Background not found');
    await this.campaignBackgroundRepository.remove(background);
  }

  /**
   * Copy a manual background to campaign for editing.
   */
  async copyFromManual(
    campaignId: string, manualId: string, backgroundId: string,
    requestingUserId: number, lang: LanguageCode = 'en',
  ): Promise<CampaignBackground> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let manualBackgroundData: any;
    if (this.manualsService.isFileManual(manualId)) {
      const manualBackground = this.backgroundsService.getById(lang, backgroundId, manualId);
      if (!manualBackground) throw new NotFoundException('Manual background not found');
      manualBackgroundData = manualBackground;
    } else {
      const entry = await this.customManualsService.getEntry(manualId, 'background', backgroundId, lang);
      manualBackgroundData = entry.data as any;
    }

    const existing = await this.campaignBackgroundRepository.findOne({
      where: { campaign: { id: campaignId }, sourceManualId: manualId, sourceBackgroundId: backgroundId },
    });
    if (existing) return existing;

    const background = this.campaignBackgroundRepository.create({
      campaign,
      sourceManualId: manualId,
      sourceBackgroundId: backgroundId,
      customData: { ...manualBackgroundData },
    });
    return this.campaignBackgroundRepository.save(background);
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
    if (!isOwner && !isPlayer) throw new ForbiddenException('No access to this campaign');
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
    if (!isOwner && !isMaster) throw new ForbiddenException('Only master can modify backgrounds');
  }

  private getManualBackgroundData(manualId: string | null | undefined, backgroundId: string | null | undefined, lang: LanguageCode): any {
    if (!manualId || !backgroundId) return null;
    return this.backgroundsService.getById(lang, backgroundId, manualId);
  }

  private applyFilters(items: any[], filters: ListCampaignBackgroundsDto): any[] {
    const { q, origin } = filters;
    return items.filter((item) => {
      if (q && !item.name?.toLowerCase().includes(q.toLowerCase())) return false;
      if (origin && item.origin !== origin) return false;
      return true;
    });
  }

  private applySorting(items: any[], sort?: string): any[] {
    if (!sort) return items;
    const sorted = [...items];
    switch (sort) {
      case 'name': return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'name_desc': return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      case 'origin': return sorted.sort((a, b) => (a.origin || '').localeCompare(b.origin || ''));
      case 'origin_desc': return sorted.sort((a, b) => (b.origin || '').localeCompare(a.origin || ''));
      default: return sorted;
    }
  }
}
