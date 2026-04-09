import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignSpell } from './entities/campaign-spell.entity';
import { SpellsService, SpellDetail } from './spells.service';
import { CustomManualsService } from '../manuals/custom-manuals.service';
import { ManualsService } from '../manuals/manuals.service';
import { CreateCampaignSpellDto } from './dto/create-campaign-spell.dto';
import { UpdateCampaignSpellDto } from './dto/update-campaign-spell.dto';
import { ListCampaignSpellsDto } from './dto/list-campaign-spells.dto';

type LanguageCode = 'en' | 'es';

@Injectable()
export class CampaignSpellsService {
  constructor(
    @InjectRepository(CampaignSpell)
    private campaignSpellRepository: Repository<CampaignSpell>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    private spellsService: SpellsService,
    private readonly customManualsService: CustomManualsService,
    private readonly manualsService: ManualsService,
  ) {}

  /**
   * List all spells available for a campaign:
   * - Spells from assigned manuals (read-only unless copied)
   * - Campaign-specific spells (homebrew or edited copies)
   */
  async list(
    campaignId: string,
    requestingUserId: number,
    filters: ListCampaignSpellsDto,
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
    const titleMap = await this.manualsService.getManualTitleMap(manualIds);
    const results: any[] = [];

    // Get campaign-specific spells
    const campaignSpells = await this.campaignSpellRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });

    // Map campaign spells (homebrew and edited)
    for (const cs of campaignSpells) {
      const data = cs.customData || this.getManualSpellData(cs.sourceManualId, cs.sourceSpellId, lang);
      if (data) {
        results.push({
          id: cs.id,
          name: data.name,
          level: data.level,
          school: data.school,
          castingTime: data.castingTime,
          range: data.range,
          duration: data.duration,
          components: data.components,
          isConcentration: data.concentration || false,
          isRitual: data.ritual || false,
          origin: cs.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cs.sourceManualId || null,
          sourceManualTitle: cs.sourceManualId ? (titleMap[cs.sourceManualId] ?? null) : null,
          customOriginName: cs.customOriginName || null,
          isCustom: true,
        });
      }
    }

    // Get manual spells (always include, even if edited in campaign)
    for (const manualId of manualIds) {
      if (!this.manualsService.isFileManual(manualId)) continue;
      const manualSpells = this.spellsService.list(lang, {}, manualId);
      for (const ms of manualSpells) {
        // Include all manual spells (originals remain visible even if edited)
        results.push({
          id: `${manualId}:${ms.id}`,
          name: ms.name,
          level: ms.level,
          school: ms.school,
          castingTime: ms.castingTime,
          range: ms.range,
          duration: ms.duration,
          components: ms.components,
          isConcentration: ms.isConcentration || false,
          isRitual: ms.isRitual || false,
          origin: 'manual',
          sourceManual: manualId,
          sourceManualTitle: titleMap[manualId] ?? null,
          isCustom: false,
        });
      }
    }

    // Get DB manual spells
    for (const manualId of manualIds) {
      if (this.manualsService.isFileManual(manualId)) continue;
      const entries = await this.customManualsService.listEntriesWithFallback(manualId, 'spell', lang);
      for (const entry of entries) {
        const d = entry.data as any;
        results.push({
          id: `${manualId}:${entry.entryKey}`,
          name: d.name || entry.entryKey,
          level: d.level ?? 0,
          school: d.school || '',
          castingTime: d.castingTime || '',
          range: d.range || '',
          duration: d.duration || '',
          components: d.components || '',
          isConcentration: d.concentration || d.isConcentration || false,
          isRitual: d.ritual || d.isRitual || false,
          origin: 'manual',
          sourceManual: manualId,
          sourceManualTitle: titleMap[manualId] ?? null,
          isCustom: false,
        });
      }
    }

    // Apply filters
    let filtered = this.applyFilters(results, filters);

    // Apply sorting
    filtered = this.applySorting(filtered, filters.sort);

    // Pagination
    const page = parseInt(String(filters.page || 1));
    const pageSize = parseInt(String(filters.pageSize || 20));
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return { items: paged, total, page, pageSize };
  }

  /**
   * Get details of a specific spell (from manual or campaign custom)
   */
  async get(campaignId: string, spellId: string, requestingUserId: number, lang: LanguageCode = 'en') {
    await this.verifyCampaignAccess(campaignId, requestingUserId);

    // Check if it's a campaign spell (UUID format) vs manual reference (manualId:spellId)
    if (!spellId.includes(':') && spellId.length > 30) {
      const cs = await this.campaignSpellRepository.findOne({
        where: { id: spellId, campaign: { id: campaignId } },
        relations: ['campaign'],
      });
      if (!cs) throw new NotFoundException('Spell not found');

      if (cs.customData) {
        const sourceManualTitle = cs.sourceManualId ? await this.manualsService.getManualTitle(cs.sourceManualId) : null;
        return {
          ...cs.customData,
          id: cs.id,
          origin: cs.sourceManualId ? 'manual-edited' : 'homebrew',
          sourceManual: cs.sourceManualId,
          sourceManualTitle,
          customOriginName: cs.customOriginName,
          isCustom: true,
        };
      } else if (cs.sourceManualId && cs.sourceSpellId) {
        // Reference only, load from manual
        const detail = this.spellsService.getById(lang, cs.sourceSpellId, cs.sourceManualId);
        if (!detail) throw new NotFoundException('Manual spell not found');
        const sourceManualTitle = await this.manualsService.getManualTitle(cs.sourceManualId);
        return {
          ...detail,
          id: cs.id,
          origin: 'manual',
          sourceManual: cs.sourceManualId,
          sourceManualTitle,
          isCustom: false,
        };
      }
      throw new NotFoundException('Spell data not found');
    }

    // Parse manual spell ID format: manualId:spellId
    const [manualId, originalSpellId] = spellId.split(':');
    if (!manualId || !originalSpellId) throw new NotFoundException('Invalid spell ID format');

    if (this.manualsService.isFileManual(manualId)) {
      const detail = this.spellsService.getById(lang, originalSpellId, manualId);
      if (!detail) throw new NotFoundException('Spell not found in manual');
      const sourceManualTitle = await this.manualsService.getManualTitle(manualId);
      return {
        ...detail,
        id: spellId,
        origin: 'manual',
        sourceManual: manualId,
        sourceManualTitle,
        isCustom: false,
      };
    }

    const entry = await this.customManualsService.getEntry(manualId, 'spell', originalSpellId, lang);
    const d = entry.data as any;
    const sourceManualTitle = await this.manualsService.getManualTitle(manualId);
    return {
      id: spellId,
      name: d.name || entry.entryKey,
      level: d.level ?? 0,
      school: d.school || '',
      castingTime: d.castingTime || '',
      range: d.range || '',
      duration: d.duration || '',
      components: d.components || '',
      materials: d.materials || '',
      concentration: d.concentration || d.isConcentration || false,
      ritual: d.ritual || d.isRitual || false,
      description: d.description,
      classes: d.classes,
      origin: 'manual',
      sourceManual: manualId,
      sourceManualTitle,
      isCustom: false,
    };
  }

  /**
   * Create a new campaign spell (homebrew or copy from manual)
   */
  async create(
    campaignId: string,
    dto: CreateCampaignSpellDto,
    requestingUserId: number,
  ): Promise<CampaignSpell> {
    // Only master can create
    await this.verifyMasterAccess(campaignId, requestingUserId);

    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const spell = this.campaignSpellRepository.create({
      campaign,
      sourceManualId: dto.sourceManualId || null,
      sourceSpellId: dto.sourceSpellId || null,
      customOriginName: dto.customOriginName || null,
      customData: dto.customData || null,
    });

    const saved = await this.campaignSpellRepository.save(spell);

    // If the source manual is a DB manual, also persist the spell as a ManualEntry
    if (dto.sourceManualId && dto.customData && !this.manualsService.isFileManual(dto.sourceManualId)) {
      const slug = (dto.customData as any).name
        ? (dto.customData as any).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : saved.id;
      try {
        await this.customManualsService.addEntry(dto.sourceManualId, requestingUserId, {
          entryType: 'spell',
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
   * Update campaign spell
   */
  async update(
    campaignId: string,
    spellId: string,
    dto: UpdateCampaignSpellDto,
    requestingUserId: number,
  ): Promise<CampaignSpell> {
    await this.verifyMasterAccess(campaignId, requestingUserId);

    const spell = await this.campaignSpellRepository.findOne({
      where: { id: spellId, campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    if (!spell) throw new NotFoundException('Spell not found');

    Object.assign(spell, dto);
    return this.campaignSpellRepository.save(spell);
  }

  /**
   * Delete campaign spell
   */
  async delete(campaignId: string, spellId: string, requestingUserId: number): Promise<void> {
    await this.verifyMasterAccess(campaignId, requestingUserId);

    const spell = await this.campaignSpellRepository.findOne({
      where: { id: spellId, campaign: { id: campaignId } },
    });
    if (!spell) throw new NotFoundException('Spell not found');

    await this.campaignSpellRepository.remove(spell);
  }

  /**
   * Copy a manual spell to campaign for editing
   */
  async copyFromManual(
    campaignId: string,
    manualId: string,
    spellId: string,
    requestingUserId: number,
    lang: LanguageCode = 'en',
  ): Promise<CampaignSpell> {
    await this.verifyMasterAccess(campaignId, requestingUserId);

    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Get manual spell data
    let manualSpellData: any;
    if (this.manualsService.isFileManual(manualId)) {
      const manualSpell = this.spellsService.getById(lang, spellId, manualId);
      if (!manualSpell) throw new NotFoundException('Manual spell not found');
      manualSpellData = manualSpell;
    } else {
      const entry = await this.customManualsService.getEntry(manualId, 'spell', spellId, lang);
      manualSpellData = entry.data as any;
    }

    // Check if already copied
    const existing = await this.campaignSpellRepository.findOne({
      where: {
        campaign: { id: campaignId },
        sourceManualId: manualId,
        sourceSpellId: spellId,
      },
    });
    if (existing) {
      return existing;
    }

    // Create copy with customData
    const spell = this.campaignSpellRepository.create({
      campaign,
      sourceManualId: manualId,
      sourceSpellId: spellId,
      customData: this.convertToCustomData(manualSpellData),
    });

    return this.campaignSpellRepository.save(spell);
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
      throw new ForbiddenException('Only master can modify spells');
    }
  }

  private getManualSpellData(manualId: string | null | undefined, spellId: string | null | undefined, lang: LanguageCode): any {
    if (!manualId || !spellId) return null;
    return this.spellsService.getById(lang, spellId, manualId);
  }

  private convertToCustomData(spell: SpellDetail): any {
    return {
      name: spell.name,
      level: spell.level,
      school: spell.school,
      castingTime: spell.castingTime,
      range: spell.range,
      duration: spell.duration,
      components: spell.components,
      materials: spell.materials,
      classes: spell.classes,
      ritual: spell.ritual,
      concentration: spell.concentration,
      description: spell.description,
      savingThrow: spell.savingThrow,
      areaOfEffect: spell.areaOfEffect,
    };
  }

  private applyFilters(items: any[], filters: ListCampaignSpellsDto): any[] {
    const { q, school, level, concentration, ritual, origin } = filters;

    return items.filter((item) => {
      // Text search
      if (q) {
        const searchLower = q.toLowerCase();
        if (!item.name?.toLowerCase().includes(searchLower)) return false;
      }

      // School filter
      if (school && item.school?.toLowerCase() !== school.toLowerCase()) return false;

      // Level filter (comma-separated levels)
      if (level) {
        const selectedLevels = level.split(',').map(l => parseInt(l.trim()));
        if (!selectedLevels.includes(item.level)) return false;
      }

      // Concentration filter
      if (concentration !== undefined) {
        const wantConcentration = concentration === 'true';
        if (item.isConcentration !== wantConcentration) return false;
      }

      // Ritual filter
      if (ritual !== undefined) {
        const wantRitual = ritual === 'true';
        if (item.isRitual !== wantRitual) return false;
      }

      // Origin filter
      if (origin && item.origin !== origin) return false;

      return true;
    });
  }

  private applySorting(items: any[], sort?: string): any[] {
    if (!sort) return items;

    const sortedItems = [...items];

    switch (sort) {
      case 'name':
        return sortedItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'name_desc':
        return sortedItems.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      case 'level':
        return sortedItems.sort((a, b) => (a.level || 0) - (b.level || 0));
      case 'level_desc':
        return sortedItems.sort((a, b) => (b.level || 0) - (a.level || 0));
      case 'school':
        return sortedItems.sort((a, b) => (a.school || '').localeCompare(b.school || ''));
      case 'school_desc':
        return sortedItems.sort((a, b) => (b.school || '').localeCompare(a.school || ''));
      case 'origin':
        return sortedItems.sort((a, b) => (a.origin || '').localeCompare(b.origin || ''));
      case 'origin_desc':
        return sortedItems.sort((a, b) => (b.origin || '').localeCompare(a.origin || ''));
      default:
        return sortedItems;
    }
  }
}
