import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignRace } from './entities/campaign-race.entity';
import { RacesService, Race } from './races.service';
import { CustomManualsService } from '../manuals/custom-manuals.service';
import { ManualsService } from '../manuals/manuals.service';
import { CreateCampaignRaceDto } from './dto/create-campaign-race.dto';
import { UpdateCampaignRaceDto } from './dto/update-campaign-race.dto';
import { ListCampaignRacesDto } from './dto/list-campaign-races.dto';

type LanguageCode = 'en' | 'es';

/**
 * Service for campaign-specific races (CRUD with manual merge).
 */
@Injectable()
export class CampaignRacesService {
  constructor(
    @InjectRepository(CampaignRace)
    private campaignRaceRepository: Repository<CampaignRace>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    private racesService: RacesService,
    private readonly customManualsService: CustomManualsService,
    private readonly manualsService: ManualsService,
  ) {}

  /**
   * List all races for a campaign (manual + custom).
   */
  async list(
    campaignId: string,
    requestingUserId: number,
    filters: ListCampaignRacesDto,
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

    // Campaign-specific races
    const campaignRaces = await this.campaignRaceRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    for (const cr of campaignRaces) {
      const data = cr.customData || this.getManualRaceData(cr.sourceManualId, cr.sourceRaceId, lang);
      if (data) {
        results.push({
          id: cr.id,
          name: data.name,
          size: data.size,
          speed: data.speed,
          origin: cr.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cr.sourceManualId || null,
          customOriginName: cr.customOriginName || null,
          isCustom: true,
        });
      }
    }

    // Manual races (file-based)
    for (const manualId of manualIds) {
      if (!this.manualsService.isFileManual(manualId)) continue;
      const manualRaces = this.racesService.list(lang, manualId);
      for (const mr of manualRaces) {
        results.push({
          id: `${manualId}:${mr.id}`,
          name: mr.name,
          size: mr.size,
          speed: mr.speed,
          origin: 'manual',
          sourceManual: manualId,
          isCustom: false,
        });
      }
    }

    // DB manual races
    for (const manualId of manualIds) {
      if (this.manualsService.isFileManual(manualId)) continue;
      const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'race', lang);
      for (const entry of entries) {
        const d = entry.data as any;
        results.push({
          id: `${manualId}:${entry.entryKey}`,
          name: d.name || entry.entryKey,
          size: d.size,
          speed: d.speed,
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
   * Get details of a specific race.
   */
  async get(campaignId: string, raceId: string, requestingUserId: number, lang: LanguageCode = 'en') {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    if (!raceId.includes(':') && raceId.length > 30) {
      const cr = await this.campaignRaceRepository.findOne({
        where: { id: raceId, campaign: { id: campaignId } },
        relations: ['campaign'],
      });
      if (!cr) throw new NotFoundException('Race not found');

      if (cr.customData) {
        return {
          ...cr.customData,
          id: cr.id,
          origin: cr.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cr.sourceManualId,
          customOriginName: cr.customOriginName,
          isCustom: true,
        };
      } else if (cr.sourceManualId && cr.sourceRaceId) {
        const detail = this.racesService.getById(lang, cr.sourceRaceId, cr.sourceManualId);
        if (!detail) throw new NotFoundException('Manual race not found');
        return { ...detail, id: cr.id, origin: 'manual', sourceManual: cr.sourceManualId, isCustom: false };
      }
      throw new NotFoundException('Race data not found');
    }

    const [manualId, originalRaceId] = raceId.split(':');
    if (!manualId || !originalRaceId) throw new NotFoundException('Invalid race ID format');
    const detail = this.racesService.getById(lang, originalRaceId, manualId);
    if (!detail) throw new NotFoundException('Race not found in manual');
    return { ...detail, id: raceId, origin: 'manual', sourceManual: manualId, isCustom: false };
  }

  /**
   * Create a new campaign race (homebrew).
   */
  async create(campaignId: string, dto: CreateCampaignRaceDto, requestingUserId: number): Promise<CampaignRace> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const race = this.campaignRaceRepository.create({
      campaign,
      sourceManualId: dto.sourceManualId || null,
      sourceRaceId: dto.sourceRaceId || null,
      customOriginName: dto.customOriginName || null,
      customData: dto.customData || null,
    });
    return this.campaignRaceRepository.save(race);
  }

  /**
   * Update a campaign race.
   */
  async update(campaignId: string, raceId: string, dto: UpdateCampaignRaceDto, requestingUserId: number): Promise<CampaignRace> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const race = await this.campaignRaceRepository.findOne({
      where: { id: raceId, campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    if (!race) throw new NotFoundException('Race not found');
    Object.assign(race, dto);
    return this.campaignRaceRepository.save(race);
  }

  /**
   * Delete a campaign race.
   */
  async delete(campaignId: string, raceId: string, requestingUserId: number): Promise<void> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const race = await this.campaignRaceRepository.findOne({
      where: { id: raceId, campaign: { id: campaignId } },
    });
    if (!race) throw new NotFoundException('Race not found');
    await this.campaignRaceRepository.remove(race);
  }

  /**
   * Copy a manual race to campaign for editing.
   */
  async copyFromManual(
    campaignId: string, manualId: string, raceId: string,
    requestingUserId: number, lang: LanguageCode = 'en',
  ): Promise<CampaignRace> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const manualRace = this.racesService.getById(lang, raceId, manualId);
    if (!manualRace) throw new NotFoundException('Manual race not found');

    const existing = await this.campaignRaceRepository.findOne({
      where: { campaign: { id: campaignId }, sourceManualId: manualId, sourceRaceId: raceId },
    });
    if (existing) return existing;

    const race = this.campaignRaceRepository.create({
      campaign,
      sourceManualId: manualId,
      sourceRaceId: raceId,
      customData: { ...manualRace },
    });
    return this.campaignRaceRepository.save(race);
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
    if (!isOwner && !isMaster) throw new ForbiddenException('Only master can modify races');
  }

  private getManualRaceData(manualId: string | null | undefined, raceId: string | null | undefined, lang: LanguageCode): any {
    if (!manualId || !raceId) return null;
    return this.racesService.getById(lang, raceId, manualId);
  }

  private applyFilters(items: any[], filters: ListCampaignRacesDto): any[] {
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
      case 'size': return sorted.sort((a, b) => (a.size || '').localeCompare(b.size || ''));
      case 'size_desc': return sorted.sort((a, b) => (b.size || '').localeCompare(a.size || ''));
      case 'origin': return sorted.sort((a, b) => (a.origin || '').localeCompare(b.origin || ''));
      case 'origin_desc': return sorted.sort((a, b) => (b.origin || '').localeCompare(a.origin || ''));
      default: return sorted;
    }
  }
}
