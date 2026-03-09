import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignTrait } from './entities/campaign-trait.entity';
import { TraitsService, Trait } from './traits.service';
import { CreateCampaignTraitDto } from './dto/create-campaign-trait.dto';
import { UpdateCampaignTraitDto } from './dto/update-campaign-trait.dto';
import { ListCampaignTraitsDto } from './dto/list-campaign-traits.dto';

type LanguageCode = 'en' | 'es';

/**
 * Service for campaign-specific traits (CRUD with manual merge).
 */
@Injectable()
export class CampaignTraitsService {
  constructor(
    @InjectRepository(CampaignTrait)
    private campaignTraitRepository: Repository<CampaignTrait>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    private traitsService: TraitsService,
  ) {}

  /**
   * List all traits available for a campaign:
   * - Read-only manual traits
   * - Campaign-specific traits (homebrew or edited copies)
   */
  async list(
    campaignId: string,
    requestingUserId: number,
    filters: ListCampaignTraitsDto,
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

    // Campaign-specific traits
    const campaignTraits = await this.campaignTraitRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    for (const ct of campaignTraits) {
      const data = ct.customData || this.getManualTraitData(ct.sourceManualId, ct.sourceTraitId, lang);
      if (data) {
        results.push({
          id: ct.id,
          name: data.name,
          description: data.description,
          origin: ct.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: ct.sourceManualId || null,
          customOriginName: ct.customOriginName || null,
          isCustom: true,
        });
      }
    }

    // Manual traits
    for (const manualId of manualIds) {
      const manualTraits = this.traitsService.list(lang, manualId);
      for (const mt of manualTraits) {
        results.push({
          id: `${manualId}:${mt.id}`,
          name: mt.name,
          description: mt.description,
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
   * Get details of a specific trait.
   */
  async get(campaignId: string, traitId: string, requestingUserId: number, lang: LanguageCode = 'en') {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    if (traitId.length > 30) {
      const ct = await this.campaignTraitRepository.findOne({
        where: { id: traitId, campaign: { id: campaignId } },
        relations: ['campaign'],
      });
      if (!ct) throw new NotFoundException('Trait not found');

      if (ct.customData) {
        return {
          ...ct.customData,
          id: ct.id,
          origin: ct.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: ct.sourceManualId,
          customOriginName: ct.customOriginName,
          isCustom: true,
        };
      } else if (ct.sourceManualId && ct.sourceTraitId) {
        const detail = this.traitsService.getById(lang, ct.sourceTraitId, ct.sourceManualId);
        if (!detail) throw new NotFoundException('Manual trait not found');
        return { ...detail, id: ct.id, origin: 'manual', sourceManual: ct.sourceManualId, isCustom: false };
      }
      throw new NotFoundException('Trait data not found');
    }

    const [manualId, originalTraitId] = traitId.split(':');
    if (!manualId || !originalTraitId) throw new NotFoundException('Invalid trait ID format');
    const detail = this.traitsService.getById(lang, originalTraitId, manualId);
    if (!detail) throw new NotFoundException('Trait not found in manual');
    return { ...detail, id: traitId, origin: 'manual', sourceManual: manualId, isCustom: false };
  }

  /**
   * Create a new campaign trait (homebrew).
   */
  async create(campaignId: string, dto: CreateCampaignTraitDto, requestingUserId: number): Promise<CampaignTrait> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const trait = this.campaignTraitRepository.create({
      campaign,
      sourceManualId: dto.sourceManualId || null,
      sourceTraitId: dto.sourceTraitId || null,
      customOriginName: dto.customOriginName || null,
      customData: dto.customData || null,
    });
    return this.campaignTraitRepository.save(trait);
  }

  /**
   * Update a campaign trait.
   */
  async update(campaignId: string, traitId: string, dto: UpdateCampaignTraitDto, requestingUserId: number): Promise<CampaignTrait> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const trait = await this.campaignTraitRepository.findOne({
      where: { id: traitId, campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    if (!trait) throw new NotFoundException('Trait not found');
    Object.assign(trait, dto);
    return this.campaignTraitRepository.save(trait);
  }

  /**
   * Delete a campaign trait.
   */
  async delete(campaignId: string, traitId: string, requestingUserId: number): Promise<void> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const trait = await this.campaignTraitRepository.findOne({
      where: { id: traitId, campaign: { id: campaignId } },
    });
    if (!trait) throw new NotFoundException('Trait not found');
    await this.campaignTraitRepository.remove(trait);
  }

  /**
   * Copy a manual trait to campaign for editing.
   */
  async copyFromManual(
    campaignId: string, manualId: string, traitId: string,
    requestingUserId: number, lang: LanguageCode = 'en',
  ): Promise<CampaignTrait> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const manualTrait = this.traitsService.getById(lang, traitId, manualId);
    if (!manualTrait) throw new NotFoundException('Manual trait not found');

    const existing = await this.campaignTraitRepository.findOne({
      where: { campaign: { id: campaignId }, sourceManualId: manualId, sourceTraitId: traitId },
    });
    if (existing) return existing;

    const trait = this.campaignTraitRepository.create({
      campaign,
      sourceManualId: manualId,
      sourceTraitId: traitId,
      customData: { name: manualTrait.name, description: manualTrait.description },
    });
    return this.campaignTraitRepository.save(trait);
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
    if (!isOwner && !isMaster) throw new ForbiddenException('Only master can modify traits');
  }

  private getManualTraitData(manualId: string | null | undefined, traitId: string | null | undefined, lang: LanguageCode): any {
    if (!manualId || !traitId) return null;
    return this.traitsService.getById(lang, traitId, manualId);
  }

  private applyFilters(items: any[], filters: ListCampaignTraitsDto): any[] {
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
