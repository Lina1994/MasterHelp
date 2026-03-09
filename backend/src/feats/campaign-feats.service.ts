import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignFeat } from './entities/campaign-feat.entity';
import { FeatsService, Feat } from './feats.service';
import { CreateCampaignFeatDto } from './dto/create-campaign-feat.dto';
import { UpdateCampaignFeatDto } from './dto/update-campaign-feat.dto';
import { ListCampaignFeatsDto } from './dto/list-campaign-feats.dto';

type LanguageCode = 'en' | 'es';

/**
 * Service for campaign-specific feats (CRUD with manual merge).
 */
@Injectable()
export class CampaignFeatsService {
  constructor(
    @InjectRepository(CampaignFeat)
    private campaignFeatRepository: Repository<CampaignFeat>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    private featsService: FeatsService,
  ) {}

  /**
   * List all feats for a campaign (manual + custom).
   */
  async list(
    campaignId: string,
    requestingUserId: number,
    filters: ListCampaignFeatsDto,
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

    // Campaign-specific feats
    const campaignFeats = await this.campaignFeatRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    for (const cf of campaignFeats) {
      const data = cf.customData || this.getManualFeatData(cf.sourceManualId, cf.sourceFeatId, lang);
      if (data) {
        results.push({
          id: cf.id,
          name: data.name,
          prerequisite: data.prerequisite || null,
          description: data.description,
          origin: cf.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cf.sourceManualId || null,
          customOriginName: cf.customOriginName || null,
          isCustom: true,
        });
      }
    }

    // Manual feats
    for (const manualId of manualIds) {
      const manualFeats = this.featsService.list(lang, manualId);
      for (const mf of manualFeats) {
        results.push({
          id: `${manualId}:${mf.id}`,
          name: mf.name,
          prerequisite: mf.prerequisite || null,
          description: mf.description,
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
   * Get details of a specific feat.
   */
  async get(campaignId: string, featId: string, requestingUserId: number, lang: LanguageCode = 'en') {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    if (featId.length > 30) {
      const cf = await this.campaignFeatRepository.findOne({
        where: { id: featId, campaign: { id: campaignId } },
        relations: ['campaign'],
      });
      if (!cf) throw new NotFoundException('Feat not found');

      if (cf.customData) {
        return {
          ...cf.customData,
          id: cf.id,
          origin: cf.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cf.sourceManualId,
          customOriginName: cf.customOriginName,
          isCustom: true,
        };
      } else if (cf.sourceManualId && cf.sourceFeatId) {
        const detail = this.featsService.getById(lang, cf.sourceFeatId, cf.sourceManualId);
        if (!detail) throw new NotFoundException('Manual feat not found');
        return { ...detail, id: cf.id, origin: 'manual', sourceManual: cf.sourceManualId, isCustom: false };
      }
      throw new NotFoundException('Feat data not found');
    }

    const [manualId, originalFeatId] = featId.split(':');
    if (!manualId || !originalFeatId) throw new NotFoundException('Invalid feat ID format');
    const detail = this.featsService.getById(lang, originalFeatId, manualId);
    if (!detail) throw new NotFoundException('Feat not found in manual');
    return { ...detail, id: featId, origin: 'manual', sourceManual: manualId, isCustom: false };
  }

  /**
   * Create a new campaign feat (homebrew).
   */
  async create(campaignId: string, dto: CreateCampaignFeatDto, requestingUserId: number): Promise<CampaignFeat> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const feat = this.campaignFeatRepository.create({
      campaign,
      sourceManualId: dto.sourceManualId || null,
      sourceFeatId: dto.sourceFeatId || null,
      customOriginName: dto.customOriginName || null,
      customData: dto.customData || null,
    });
    return this.campaignFeatRepository.save(feat);
  }

  /**
   * Update a campaign feat.
   */
  async update(campaignId: string, featId: string, dto: UpdateCampaignFeatDto, requestingUserId: number): Promise<CampaignFeat> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const feat = await this.campaignFeatRepository.findOne({
      where: { id: featId, campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    if (!feat) throw new NotFoundException('Feat not found');
    Object.assign(feat, dto);
    return this.campaignFeatRepository.save(feat);
  }

  /**
   * Delete a campaign feat.
   */
  async delete(campaignId: string, featId: string, requestingUserId: number): Promise<void> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const feat = await this.campaignFeatRepository.findOne({
      where: { id: featId, campaign: { id: campaignId } },
    });
    if (!feat) throw new NotFoundException('Feat not found');
    await this.campaignFeatRepository.remove(feat);
  }

  /**
   * Copy a manual feat to campaign for editing.
   */
  async copyFromManual(
    campaignId: string, manualId: string, featId: string,
    requestingUserId: number, lang: LanguageCode = 'en',
  ): Promise<CampaignFeat> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const manualFeat = this.featsService.getById(lang, featId, manualId);
    if (!manualFeat) throw new NotFoundException('Manual feat not found');

    const existing = await this.campaignFeatRepository.findOne({
      where: { campaign: { id: campaignId }, sourceManualId: manualId, sourceFeatId: featId },
    });
    if (existing) return existing;

    const feat = this.campaignFeatRepository.create({
      campaign,
      sourceManualId: manualId,
      sourceFeatId: featId,
      customData: { name: manualFeat.name, prerequisite: manualFeat.prerequisite || null, description: manualFeat.description },
    });
    return this.campaignFeatRepository.save(feat);
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
    if (!isOwner && !isMaster) throw new ForbiddenException('Only master can modify feats');
  }

  private getManualFeatData(manualId: string | null | undefined, featId: string | null | undefined, lang: LanguageCode): any {
    if (!manualId || !featId) return null;
    return this.featsService.getById(lang, featId, manualId);
  }

  private applyFilters(items: any[], filters: ListCampaignFeatsDto): any[] {
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
