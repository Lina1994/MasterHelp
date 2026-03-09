import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignSkill } from './entities/campaign-skill.entity';
import { SkillsService, Skill } from './skills.service';
import { CreateCampaignSkillDto } from './dto/create-campaign-skill.dto';
import { UpdateCampaignSkillDto } from './dto/update-campaign-skill.dto';
import { ListCampaignSkillsDto } from './dto/list-campaign-skills.dto';

type LanguageCode = 'en' | 'es';

/**
 * Service for campaign-specific skills (CRUD with manual merge).
 */
@Injectable()
export class CampaignSkillsService {
  constructor(
    @InjectRepository(CampaignSkill)
    private campaignSkillRepository: Repository<CampaignSkill>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    private skillsService: SkillsService,
  ) {}

  /**
   * List all skills available for a campaign:
   * - Read-only manual skills
   * - Campaign-specific skills (homebrew or edited copies)
   */
  async list(
    campaignId: string,
    requestingUserId: number,
    filters: ListCampaignSkillsDto,
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

    // Campaign-specific skills
    const campaignSkills = await this.campaignSkillRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    for (const cs of campaignSkills) {
      const data = cs.customData || this.getManualSkillData(cs.sourceManualId, cs.sourceSkillId, lang);
      if (data) {
        results.push({
          id: cs.id,
          name: data.name,
          ability: data.ability,
          description: data.description,
          origin: cs.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cs.sourceManualId || null,
          customOriginName: cs.customOriginName || null,
          isCustom: true,
        });
      }
    }

    // Manual skills
    for (const manualId of manualIds) {
      const manualSkills = this.skillsService.list(lang, manualId);
      for (const ms of manualSkills) {
        results.push({
          id: `${manualId}:${ms.id}`,
          name: ms.name,
          ability: ms.ability,
          description: ms.description,
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
   * Get details of a specific skill.
   */
  async get(campaignId: string, skillId: string, requestingUserId: number, lang: LanguageCode = 'en') {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    if (skillId.length > 30) {
      const cs = await this.campaignSkillRepository.findOne({
        where: { id: skillId, campaign: { id: campaignId } },
        relations: ['campaign'],
      });
      if (!cs) throw new NotFoundException('Skill not found');

      if (cs.customData) {
        return {
          ...cs.customData,
          id: cs.id,
          origin: cs.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cs.sourceManualId,
          customOriginName: cs.customOriginName,
          isCustom: true,
        };
      } else if (cs.sourceManualId && cs.sourceSkillId) {
        const detail = this.skillsService.getById(lang, cs.sourceSkillId, cs.sourceManualId);
        if (!detail) throw new NotFoundException('Manual skill not found');
        return { ...detail, id: cs.id, origin: 'manual', sourceManual: cs.sourceManualId, isCustom: false };
      }
      throw new NotFoundException('Skill data not found');
    }

    const [manualId, originalSkillId] = skillId.split(':');
    if (!manualId || !originalSkillId) throw new NotFoundException('Invalid skill ID format');
    const detail = this.skillsService.getById(lang, originalSkillId, manualId);
    if (!detail) throw new NotFoundException('Skill not found in manual');
    return { ...detail, id: skillId, origin: 'manual', sourceManual: manualId, isCustom: false };
  }

  /**
   * Create a new campaign skill (homebrew).
   */
  async create(campaignId: string, dto: CreateCampaignSkillDto, requestingUserId: number): Promise<CampaignSkill> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const skill = this.campaignSkillRepository.create({
      campaign,
      sourceManualId: dto.sourceManualId || null,
      sourceSkillId: dto.sourceSkillId || null,
      customOriginName: dto.customOriginName || null,
      customData: dto.customData || null,
    });
    return this.campaignSkillRepository.save(skill);
  }

  /**
   * Update a campaign skill.
   */
  async update(campaignId: string, skillId: string, dto: UpdateCampaignSkillDto, requestingUserId: number): Promise<CampaignSkill> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const skill = await this.campaignSkillRepository.findOne({
      where: { id: skillId, campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    if (!skill) throw new NotFoundException('Skill not found');
    Object.assign(skill, dto);
    return this.campaignSkillRepository.save(skill);
  }

  /**
   * Delete a campaign skill.
   */
  async delete(campaignId: string, skillId: string, requestingUserId: number): Promise<void> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const skill = await this.campaignSkillRepository.findOne({
      where: { id: skillId, campaign: { id: campaignId } },
    });
    if (!skill) throw new NotFoundException('Skill not found');
    await this.campaignSkillRepository.remove(skill);
  }

  /**
   * Copy a manual skill to campaign for editing.
   */
  async copyFromManual(
    campaignId: string, manualId: string, skillId: string,
    requestingUserId: number, lang: LanguageCode = 'en',
  ): Promise<CampaignSkill> {
    await this.verifyMasterAccess(campaignId, requestingUserId);
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const manualSkill = this.skillsService.getById(lang, skillId, manualId);
    if (!manualSkill) throw new NotFoundException('Manual skill not found');

    const existing = await this.campaignSkillRepository.findOne({
      where: { campaign: { id: campaignId }, sourceManualId: manualId, sourceSkillId: skillId },
    });
    if (existing) return existing;

    const skill = this.campaignSkillRepository.create({
      campaign,
      sourceManualId: manualId,
      sourceSkillId: skillId,
      customData: { name: manualSkill.name, ability: manualSkill.ability, description: manualSkill.description },
    });
    return this.campaignSkillRepository.save(skill);
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
    if (!isOwner && !isMaster) throw new ForbiddenException('Only master can modify skills');
  }

  private getManualSkillData(manualId: string | null | undefined, skillId: string | null | undefined, lang: LanguageCode): any {
    if (!manualId || !skillId) return null;
    return this.skillsService.getById(lang, skillId, manualId);
  }

  private applyFilters(items: any[], filters: ListCampaignSkillsDto): any[] {
    const { q, ability, origin } = filters;
    return items.filter((item) => {
      if (q && !item.name?.toLowerCase().includes(q.toLowerCase())) return false;
      if (ability && item.ability?.toLowerCase() !== ability.toLowerCase()) return false;
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
      case 'ability': return sorted.sort((a, b) => (a.ability || '').localeCompare(b.ability || ''));
      case 'ability_desc': return sorted.sort((a, b) => (b.ability || '').localeCompare(a.ability || ''));
      case 'origin': return sorted.sort((a, b) => (a.origin || '').localeCompare(b.origin || ''));
      case 'origin_desc': return sorted.sort((a, b) => (b.origin || '').localeCompare(a.origin || ''));
      default: return sorted;
    }
  }
}
