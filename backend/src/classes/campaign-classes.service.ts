import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignClass } from './entities/campaign-class.entity';
import { ClassesService, CharacterClass } from './classes.service';
import { CustomManualsService } from '../manuals/custom-manuals.service';
import { ManualsService } from '../manuals/manuals.service';
import { CreateCampaignClassDto } from './dto/create-campaign-class.dto';
import { UpdateCampaignClassDto } from './dto/update-campaign-class.dto';
import { ListCampaignClassesDto } from './dto/list-campaign-classes.dto';

type LanguageCode = 'en' | 'es';

/**
 * Service for campaign-specific classes (CRUD with manual merge).
 */
@Injectable()
export class CampaignClassesService {
  constructor(
    @InjectRepository(CampaignClass)
    private campaignClassRepository: Repository<CampaignClass>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    private classesService: ClassesService,
    private readonly customManualsService: CustomManualsService,
    private readonly manualsService: ManualsService,
  ) {}

  /**
   * List all classes for a campaign (manual + custom).
   */
  async list(
    campaignId: string,
    requestingUserId: number,
    filters: ListCampaignClassesDto,
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

    // Campaign-specific classes
    const campaignClasses = await this.campaignClassRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    for (const cc of campaignClasses) {
      const data = cc.customData || this.getManualClassData(cc.sourceManualId, cc.sourceClassId, lang);
      if (data) {
        results.push({
          id: cc.id,
          name: data.name,
          hitDie: data.hitDie,
          primaryAbilities: data.primaryAbilities,
          savingThrows: data.savingThrows,
          origin: cc.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cc.sourceManualId || null,
          customOriginName: cc.customOriginName || null,
          isCustom: true,
        });
      }
    }

    // Manual classes (file-based)
    for (const manualId of manualIds) {
      if (!this.manualsService.isFileManual(manualId)) continue;
      const manualClasses = this.classesService.list(lang, manualId);
      for (const mc of manualClasses) {
        results.push({
          id: `${manualId}:${mc.id}`,
          name: mc.name,
          hitDie: mc.hitDie,
          primaryAbilities: mc.primaryAbilities,
          savingThrows: mc.savingThrows,
          origin: 'manual',
          sourceManual: manualId,
          isCustom: false,
        });
      }
    }

    // DB manual classes
    for (const manualId of manualIds) {
      if (this.manualsService.isFileManual(manualId)) continue;
      const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'class', lang);
      for (const entry of entries) {
        const d = entry.data as any;
        results.push({
          id: `${manualId}:${entry.entryKey}`,
          name: d.name || entry.entryKey,
          hitDie: d.hitDie,
          primaryAbilities: d.primaryAbilities,
          savingThrows: d.savingThrows,
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
   * Get details of a specific class.
   */
  async get(campaignId: string, classId: string, requestingUserId: number, lang: LanguageCode = 'en') {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    if (!classId.includes(':') && classId.length > 30) {
      const cc = await this.campaignClassRepository.findOne({
        where: { id: classId, campaign: { id: campaignId } },
        relations: ['campaign'],
      });
      if (!cc) throw new NotFoundException('Class not found');

      if (cc.customData) {
        return {
          ...cc.customData,
          id: cc.id,
          origin: cc.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cc.sourceManualId,
          customOriginName: cc.customOriginName,
          isCustom: true,
        };
      } else if (cc.sourceManualId && cc.sourceClassId) {
        const detail = this.classesService.getById(lang, cc.sourceClassId, cc.sourceManualId);
        if (!detail) throw new NotFoundException('Manual class not found');
        return { ...detail, id: cc.id, origin: 'manual', sourceManual: cc.sourceManualId, isCustom: false };
      }
      throw new NotFoundException('Class data not found');
    }

    const [manualId, originalClassId] = classId.split(':');
    if (!manualId || !originalClassId) throw new NotFoundException('Invalid class ID format');
    const detail = this.classesService.getById(lang, originalClassId, manualId);
    if (!detail) throw new NotFoundException('Class not found in manual');
    return { ...detail, id: classId, origin: 'manual', sourceManual: manualId, isCustom: false };
  }

  /**
   * Create a new campaign class (homebrew).
   */
  async create(campaignId: string, dto: CreateCampaignClassDto, requestingUserId: number): Promise<CampaignClass> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const cls = this.campaignClassRepository.create({
      campaign,
      sourceManualId: dto.sourceManualId || null,
      sourceClassId: dto.sourceClassId || null,
      customOriginName: dto.customOriginName || null,
      customData: dto.customData || null,
    });
    return this.campaignClassRepository.save(cls);
  }

  /**
   * Update a campaign class.
   */
  async update(campaignId: string, classId: string, dto: UpdateCampaignClassDto, requestingUserId: number): Promise<CampaignClass> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const cls = await this.campaignClassRepository.findOne({
      where: { id: classId, campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    if (!cls) throw new NotFoundException('Class not found');
    Object.assign(cls, dto);
    return this.campaignClassRepository.save(cls);
  }

  /**
   * Delete a campaign class.
   */
  async delete(campaignId: string, classId: string, requestingUserId: number): Promise<void> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const cls = await this.campaignClassRepository.findOne({
      where: { id: classId, campaign: { id: campaignId } },
    });
    if (!cls) throw new NotFoundException('Class not found');
    await this.campaignClassRepository.remove(cls);
  }

  /**
   * Copy a manual class to campaign for editing.
   */
  async copyFromManual(
    campaignId: string, manualId: string, classId: string,
    requestingUserId: number, lang: LanguageCode = 'en',
  ): Promise<CampaignClass> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const manualClass = this.classesService.getById(lang, classId, manualId);
    if (!manualClass) throw new NotFoundException('Manual class not found');

    const existing = await this.campaignClassRepository.findOne({
      where: { campaign: { id: campaignId }, sourceManualId: manualId, sourceClassId: classId },
    });
    if (existing) return existing;

    const cls = this.campaignClassRepository.create({
      campaign,
      sourceManualId: manualId,
      sourceClassId: classId,
      customData: { ...manualClass },
    });
    return this.campaignClassRepository.save(cls);
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
    if (!isOwner && !isMaster) throw new ForbiddenException('Only master can modify classes');
  }

  private getManualClassData(manualId: string | null | undefined, classId: string | null | undefined, lang: LanguageCode): any {
    if (!manualId || !classId) return null;
    return this.classesService.getById(lang, classId, manualId);
  }

  private applyFilters(items: any[], filters: ListCampaignClassesDto): any[] {
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
      case 'hitDie': return sorted.sort((a, b) => (a.hitDie || 0) - (b.hitDie || 0));
      case 'hitDie_desc': return sorted.sort((a, b) => (b.hitDie || 0) - (a.hitDie || 0));
      case 'origin': return sorted.sort((a, b) => (a.origin || '').localeCompare(b.origin || ''));
      case 'origin_desc': return sorted.sort((a, b) => (b.origin || '').localeCompare(a.origin || ''));
      default: return sorted;
    }
  }
}
