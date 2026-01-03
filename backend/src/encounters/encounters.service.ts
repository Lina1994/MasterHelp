/** Servicio de encuentros: CRUD básico y control de acceso. */
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from './entities/encounter.entity';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(Encounter) private readonly encountersRepo: Repository<Encounter>,
    @InjectRepository(Campaign) private readonly campaignsRepo: Repository<Campaign>,
  ) {}

  /** Verifica pertenencia y rol en la campaña. */
  private async getCampaignAccess(campaignId: string, userId: number) {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === userId;
    const isPlayer = (campaign.players || []).some((p) => p.user?.id === userId);
    const isMaster = isOwner || (campaign.players || []).some((p) => p.user?.id === userId && p.role === 'master');
    const isMember = isOwner || isPlayer;
    if (!isMember) throw new ForbiddenException('Not part of campaign');
    return { campaign, isMaster } as const;
  }

  /** Lista encuentros de una campaña (miembros pueden leer). */
  async list(userId: number, campaignId: string) {
    await this.getCampaignAccess(campaignId, userId); // solo valida pertenencia
    return this.encountersRepo.find({ where: { campaign: { id: campaignId } as any }, order: { createdAt: 'ASC' } });
  }

  /** Crea un encuentro (solo máster/owner). */
  async create(userId: number, campaignId: string, dto: CreateEncounterDto) {
    const { campaign, isMaster } = await this.getCampaignAccess(campaignId, userId);
    if (!isMaster) throw new ForbiddenException('Only master can create encounters');
    const encounter = this.encountersRepo.create({
      name: dto.name,
      difficulty: dto.difficulty,
      musicLabel: dto.musicLabel ?? null,
      musicSongId: dto.musicSongId ?? null,
      participants: dto.participants ?? [],
      campaign,
    });
    return this.encountersRepo.save(encounter);
  }

  /** Actualiza un encuentro (solo máster/owner). */
  async update(userId: number, campaignId: string, encounterId: string, dto: UpdateEncounterDto) {
    const { campaign, isMaster } = await this.getCampaignAccess(campaignId, userId);
    if (!isMaster) throw new ForbiddenException('Only master can update encounters');
    const encounter = await this.encountersRepo.findOne({ where: { id: encounterId, campaign: { id: campaign.id } as any } });
    if (!encounter) throw new NotFoundException('Encounter not found');
    if (dto.name !== undefined) encounter.name = dto.name;
    if (dto.difficulty !== undefined) encounter.difficulty = dto.difficulty;
    if (dto.musicLabel !== undefined) encounter.musicLabel = dto.musicLabel ?? null;
    if (dto.musicSongId !== undefined) encounter.musicSongId = dto.musicSongId ?? null;
    if (dto.participants !== undefined) encounter.participants = dto.participants ?? [];
    return this.encountersRepo.save(encounter);
  }

  /** Elimina un encuentro (solo máster/owner). */
  async remove(userId: number, campaignId: string, encounterId: string) {
    const { campaign, isMaster } = await this.getCampaignAccess(campaignId, userId);
    if (!isMaster) throw new ForbiddenException('Only master can delete encounters');
    const encounter = await this.encountersRepo.findOne({ where: { id: encounterId, campaign: { id: campaign.id } as any } });
    if (!encounter) throw new NotFoundException('Encounter not found');
    await this.encountersRepo.remove(encounter);
    return { message: 'Encounter deleted' };
  }
}
