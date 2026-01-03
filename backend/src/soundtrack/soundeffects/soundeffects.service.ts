import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { SoundEffect } from './entities/sound-effect.entity';
import { CreateSoundEffectDto } from './dto/create-sound-effect.dto';
import { UpdateSoundEffectDto } from './dto/update-sound-effect.dto';
import { SoundPreset } from './entities/sound-preset.entity';
import { SoundPresetItem } from './entities/sound-preset-item.entity';
import { CreateSoundPresetDto } from './dto/create-sound-preset.dto';
import { UpdateSoundPresetDto } from './dto/update-sound-preset.dto';

@Injectable()
export class SoundEffectsService {
  constructor(
    @InjectRepository(SoundEffect) private effectsRepo: Repository<SoundEffect>,
    @InjectRepository(SoundPreset) private presetsRepo: Repository<SoundPreset>,
    @InjectRepository(SoundPresetItem) private presetItemsRepo: Repository<SoundPresetItem>,
    @InjectRepository(Campaign) private campaignsRepo: Repository<Campaign>,
  ) {}

  private userId(user: any) { return user?.id ?? user?.userId; }

  /** Crea un efecto (archivo o URL descargada) y opcionalmente lo asocia a una campaña del dueño */
  async createEffect(owner: User | any, dto: CreateSoundEffectDto, file?: { buffer: Buffer; mimetype: string; size: number }, fetched?: { data: Buffer; mimeType: string }) {
    if (!file && !dto.url) throw new BadRequestException('Provide either a file or an url');
    if (file && dto.url) throw new BadRequestException('Provide file or url, not both');
    const effect = new SoundEffect();
    effect.name = dto.name;
    effect.category = dto.category ?? null;
    effect.isPublic = dto.isPublic ?? false;
    if (!owner?.id) {
      const id = this.userId(owner); if (!id) throw new ForbiddenException('Invalid auth');
      const full = await (this.effectsRepo.manager).findOne(User, { where: { id: id as any } });
      if (!full) throw new ForbiddenException('User not found');
      effect.owner = full;
    } else { effect.owner = owner; }
    if (file) { effect.data = file.buffer; effect.mimeType = file.mimetype; effect.size = file.size; }
    else if (fetched) { effect.data = fetched.data; effect.mimeType = fetched.mimeType; effect.size = fetched.data.length; }
    else { throw new BadRequestException('No audio source provided'); }
    effect.campaigns = [];
    if (dto.campaignId) {
      const campaign = await this.campaignsRepo.findOne({ where: { id: dto.campaignId }, relations: ['owner'] });
      const id = this.userId(owner);
      if (campaign && campaign.owner.id === id) effect.campaigns = [campaign];
    }
    return this.effectsRepo.save(effect);
  }

  async listEffectsForCampaign(user: any, campaignId: string) {
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const userId = this.userId(user);
    const isMaster = campaign.owner.id === userId;
    const qb = this.effectsRepo.createQueryBuilder('se')
      .leftJoin('se.campaigns', 'c')
      .select(['se.id','se.name','se.category','se.size','se.mimeType','se.isPublic','se.lastPlayedAt','se.createdAt','se.updatedAt'])
      .where('c.id = :campaignId', { campaignId });
    if (!isMaster) qb.andWhere('se.isPublic = :pub', { pub: true });
    const associated = await qb.getMany();
    let reusable: any[] = [];
    if (isMaster) {
      const rqb = this.effectsRepo.createQueryBuilder('se')
        .leftJoin('se.campaigns', 'c')
        .select(['se.id','se.name','se.category','se.size','se.mimeType','se.isPublic','se.lastPlayedAt','se.createdAt','se.updatedAt'])
        .where('se.ownerId = :ownerId', { ownerId: userId })
        .andWhere('(c.id IS NULL OR c.id != :campaignId)', { campaignId });
      reusable = await rqb.getMany();
    }
    return { associated, reusable };
  }

  async listOwnedEffects(user: any) {
    const id = this.userId(user); if (!id) throw new ForbiddenException('Invalid auth');
    return this.effectsRepo.createQueryBuilder('se')
      .select(['se.id','se.name','se.category','se.size','se.mimeType','se.isPublic','se.lastPlayedAt','se.createdAt','se.updatedAt'])
      .where('se.ownerId = :ownerId', { ownerId: id })
      .orderBy('se.createdAt','DESC').getMany();
  }

  async updateEffect(user: any, id: string, dto: UpdateSoundEffectDto) {
    const se = await this.effectsRepo.findOne({ where: { id }, relations: ['owner'] });
    if (!se) throw new NotFoundException('SoundEffect not found');
    const uid = this.userId(user);
    if (se.owner.id !== uid) throw new ForbiddenException('Not owner');
    if (dto.name !== undefined) se.name = dto.name;
    if (dto.category !== undefined) se.category = dto.category as any;
    if (dto.isPublic !== undefined) se.isPublic = dto.isPublic;
    return this.effectsRepo.save(se);
  }

  async associateEffect(user: any, id: string, campaignIds: string[]) {
    const se = await this.effectsRepo.findOne({ where: { id }, relations: ['owner','campaigns'] });
    if (!se) throw new NotFoundException('SoundEffect not found');
    const uid = this.userId(user);
    if (se.owner.id !== uid) throw new ForbiddenException('Not owner');
    const camps = await this.campaignsRepo.find({ where: { id: In(campaignIds) }, relations: ['owner'] });
    const owned = camps.filter(c => c.owner.id === uid);
    se.campaigns = Array.from(new Set([...(se.campaigns || []), ...owned]));
    return this.effectsRepo.save(se);
  }

  async unassociateEffect(user: any, id: string, campaignId: string) {
    const se = await this.effectsRepo.findOne({ where: { id }, relations: ['owner','campaigns'] });
    if (!se) throw new NotFoundException('SoundEffect not found');
    const uid = this.userId(user);
    if (se.owner.id !== uid) throw new ForbiddenException('Not owner');
    se.campaigns = (se.campaigns || []).filter(c => c.id !== campaignId);
    return this.effectsRepo.save(se);
  }

  async removeEffect(user: any, id: string) {
    const se = await this.effectsRepo.findOne({ where: { id }, relations: ['owner','campaigns'] });
    if (!se) throw new NotFoundException('SoundEffect not found');
    const uid = this.userId(user);
    if (se.owner.id !== uid) throw new ForbiddenException('Not owner');
    if (se.campaigns?.length) {
      // Explicitly remove many-to-many join rows before deleting the effect
      await this.effectsRepo.createQueryBuilder().relation(SoundEffect, 'campaigns').of(se).remove(se.campaigns);
    }
    await this.effectsRepo.remove(se);
    return { message: 'SoundEffect deleted' };
  }

  // Presets
  private async assertCampaignOwner(user: any, campaignId: string) {
    const camp = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner'] });
    if (!camp) throw new NotFoundException('Campaign not found');
    const uid = this.userId(user);
    if (!uid || camp.owner.id !== uid) throw new ForbiddenException('Not campaign owner');
    return camp;
  }

  async listPresets(user: any, campaignId: string) {
    await this.assertCampaignOwner(user, campaignId);
    const list = await this.presetsRepo.find({ where: { campaign: { id: campaignId } as any } });
    // Map to minimal response shape
    return list.map((p) => ({
      id: p.id,
      name: p.name,
      items: (p.items || []).map((i) => ({
        id: i.id,
        volume: i.volume,
        loopMode: i.loopMode,
        waitMs: i.waitMs,
        randomMinMs: i.randomMinMs,
        randomMaxMs: i.randomMaxMs,
        echoEnabled: i.echoEnabled,
        echoDelayMs: i.echoDelayMs,
        echoFeedback: i.echoFeedback,
        pitchSemitones: i.pitchSemitones,
        soundEffect: {
          id: i.soundEffect.id,
          name: i.soundEffect.name,
          size: i.soundEffect.size,
          mimeType: i.soundEffect.mimeType,
        },
      })),
    }));
  }

  async createPreset(user: any, dto: CreateSoundPresetDto) {
    const camp = await this.assertCampaignOwner(user, dto.campaignId);
    const preset = new SoundPreset();
    preset.name = dto.name;
    preset.campaign = camp;
    preset.items = [];
    if (dto.items?.length) {
      const ids = dto.items.map(i => i.soundEffectId);
      const effects = await this.effectsRepo.find({ where: { id: In(ids) }, relations: ['owner','campaigns'] });
      const uid = this.userId(user);
      for (const item of dto.items) {
        const effect = effects.find(e => e.id === item.soundEffectId);
        if (!effect) continue;
        if (effect.owner.id !== uid) continue; // Only own effects
        const spi = new SoundPresetItem();
        spi.soundEffect = effect;
        spi.volume = Math.max(0, Math.min(1, Number(item.volume ?? 1)));
        spi.loopMode = item.loopMode;
        spi.waitMs = item.loopMode === 'fixed' ? (item.waitMs ?? 0) : null;
        spi.randomMinMs = item.loopMode === 'random' ? (item.randomMinMs ?? 0) : null;
        spi.randomMaxMs = item.loopMode === 'random' ? (item.randomMaxMs ?? 0) : null;
        // modifiers
        spi.echoEnabled = !!item.echoEnabled;
        spi.echoDelayMs = item.echoEnabled ? (item.echoDelayMs ?? 300) : null;
        spi.echoFeedback = item.echoEnabled ? Math.max(0, Math.min(1, Number(item.echoFeedback ?? 0.3))) : null;
        spi.pitchSemitones = Number.isFinite(item.pitchSemitones as any) ? Number(item.pitchSemitones) : 0;
        spi.preset = preset;
        preset.items.push(spi);
      }
    }
    const saved = await this.presetsRepo.save(preset);
    // Devolver respuesta mínima para evitar problemas de serialización/volumen
    return { id: saved.id, name: saved.name, campaignId: camp.id };
  }

  async updatePreset(user: any, presetId: string, dto: UpdateSoundPresetDto) {
    const preset = await this.presetsRepo.findOne({ where: { id: presetId }, relations: ['campaign','items','items.soundEffect','campaign.owner'] });
    if (!preset) throw new NotFoundException('Preset not found');
    const uid = this.userId(user);
    if (preset.campaign.owner.id !== uid) throw new ForbiddenException('Not campaign owner');
    if (dto.name !== undefined) preset.name = dto.name;
    if (dto.items) {
      // replace items
      await this.presetItemsRepo.delete({ preset: { id: preset.id } as any });
      preset.items = [];
      const ids = dto.items.map(i => i.soundEffectId);
      const effects = await this.effectsRepo.find({ where: { id: In(ids) }, relations: ['owner'] });
      for (const item of dto.items) {
        const effect = effects.find(e => e.id === item.soundEffectId);
        if (!effect || effect.owner.id !== uid) continue;
        const spi = new SoundPresetItem();
        spi.preset = preset;
        spi.soundEffect = effect;
        spi.volume = Math.max(0, Math.min(1, Number(item.volume ?? 1)));
        spi.loopMode = item.loopMode;
        spi.waitMs = item.loopMode === 'fixed' ? (item.waitMs ?? 0) : null;
        spi.randomMinMs = item.loopMode === 'random' ? (item.randomMinMs ?? 0) : null;
        spi.randomMaxMs = item.loopMode === 'random' ? (item.randomMaxMs ?? 0) : null;
        // modifiers
        spi.echoEnabled = !!item.echoEnabled;
        spi.echoDelayMs = item.echoEnabled ? (item.echoDelayMs ?? 300) : null;
        spi.echoFeedback = item.echoEnabled ? Math.max(0, Math.min(1, Number(item.echoFeedback ?? 0.3))) : null;
        spi.pitchSemitones = Number.isFinite(item.pitchSemitones as any) ? Number(item.pitchSemitones) : 0;
        preset.items.push(spi);
      }
    }
    const saved = await this.presetsRepo.save(preset);
    return { id: saved.id, name: saved.name, campaignId: saved.campaign.id };
  }

  async deletePreset(user: any, campaignId: string, presetId: string) {
    await this.assertCampaignOwner(user, campaignId);
    const preset = await this.presetsRepo.findOne({ where: { id: presetId }, relations: ['campaign'] });
    if (!preset || preset.campaign.id !== campaignId) throw new NotFoundException('Preset not found');
    await this.presetsRepo.remove(preset);
    return { message: 'Preset deleted' };
  }

  /**
   * Autorización y obtención de efecto para streaming.
   * Reglas como canciones: preview owner si no hay campaña; con campaña, permitir master; jugadores sólo si público.
   */
  async getStreamableEffect(user: any, effectId: string, campaignId?: string) {
    const effect = await this.effectsRepo
      .createQueryBuilder('se')
      .addSelect('se.data')
      .leftJoinAndSelect('se.campaigns', 'c')
      .leftJoinAndSelect('se.owner', 'o')
      .where('se.id = :effectId', { effectId })
      .getOne();
    if (!effect) throw new NotFoundException('SoundEffect not found');
    const uid = this.userId(user);
    if (!uid) throw new ForbiddenException('Invalid auth');
    const provided = !!(campaignId && campaignId.trim().length > 0);
    if (!provided) {
      if (effect.owner.id !== uid) throw new ForbiddenException('Not allowed');
      return effect;
    }
    const associated = (effect.campaigns || []).some(c => c.id === campaignId);
    const camp = await this.campaignsRepo.findOne({ where: { id: campaignId }, relations: ['owner'] });
    if (!camp) throw new NotFoundException('Campaign not found');
    const isMaster = camp.owner.id === uid;
    if (associated) {
      if (!isMaster && !effect.isPublic) throw new ForbiddenException('Not allowed');
      return effect;
    }
    if (isMaster && effect.owner.id === uid) return effect;
    throw new ForbiddenException('Effect not associated with campaign');
  }

  async markEffectPlayed(user: any, effectId: string, campaignId?: string) {
    const effect = await this.getStreamableEffect(user, effectId, campaignId);
    effect.lastPlayedAt = new Date();
    await this.effectsRepo.save(effect);
    return { message: 'Marked played', lastPlayedAt: effect.lastPlayedAt };
  }
}
