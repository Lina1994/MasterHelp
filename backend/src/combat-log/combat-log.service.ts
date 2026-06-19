import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CombatLog, CombatTurnSnapshot } from './entities/combat-log.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignCalendar } from '../diary/entities/campaign-calendar.entity';
import {
  AppendCombatSnapshotDto,
  EndCombatLogDto,
  StartCombatLogDto,
} from './dto/combat-log.dto';

/**
 * Stores per-campaign combat "runs" and their turn-by-turn snapshots.
 *
 * The rich combat data (HP, notes, turn order) lives in the frontend combat
 * view, so this service is frontend-driven: the client posts start / snapshot /
 * end. Each run is an independent row tagged with the campaign calendar day, so
 * repeated or concurrent combats never mix.
 */
@Injectable()
export class CombatLogService {
  constructor(
    @InjectRepository(CombatLog) private readonly repo: Repository<CombatLog>,
    @InjectRepository(Campaign) private readonly campaignsRepo: Repository<Campaign>,
    @InjectRepository(CampaignCalendar) private readonly calendarRepo: Repository<CampaignCalendar>,
  ) {}

  /** Verifies campaign membership and resolves master role. */
  private async getCampaignAccess(campaignId: string, userId: number) {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const isOwner = campaign.owner?.id === userId;
    const isPlayer = (campaign.players || []).some((p) => p.user?.id === userId);
    const isMaster = isOwner || (campaign.players || []).some((p) => p.user?.id === userId && p.role === 'master');
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not part of campaign');
    return { campaign, isMaster } as const;
  }

  /** Loads a combat log ensuring it belongs to the campaign. */
  private async getOwnedLog(campaignId: string, logId: string): Promise<CombatLog> {
    const log = await this.repo.findOne({ where: { id: logId, campaignId } });
    if (!log) throw new NotFoundException('Combat log not found');
    return log;
  }

  /**
   * Starts a new combat run, tagged with the current campaign calendar day.
   * Master only.
   */
  async start(userId: number, campaignId: string, dto: StartCombatLogDto): Promise<CombatLog> {
    const { isMaster } = await this.getCampaignAccess(campaignId, userId);
    if (!isMaster) throw new ForbiddenException('Only the master can record combat');

    const calendar = await this.calendarRepo.findOne({ where: { campaignId } });
    const year = calendar?.config?.currentYear ?? 1;
    const monthIndex = calendar?.config?.currentMonthIndex ?? 0;
    const dayIndex = calendar?.config?.currentDayIndex ?? 1;

    const log = this.repo.create({
      campaignId,
      encounterId: dto.encounterId ?? null,
      encounterName: dto.encounterName ?? null,
      mapId: dto.mapId ?? null,
      mapName: dto.mapName ?? null,
      year,
      monthIndex,
      dayIndex,
      snapshots: [],
      startedAt: new Date(),
      endedAt: null,
      outcome: null,
    });
    return this.repo.save(log);
  }

  /** Appends a turn snapshot to an active combat run. Master only. */
  async appendSnapshot(userId: number, campaignId: string, logId: string, dto: AppendCombatSnapshotDto): Promise<{ ok: true }> {
    const { isMaster } = await this.getCampaignAccess(campaignId, userId);
    if (!isMaster) throw new ForbiddenException('Only the master can record combat');

    const log = await this.getOwnedLog(campaignId, logId);
    const snapshot: CombatTurnSnapshot = {
      round: dto.snapshot.round,
      turnIndex: dto.snapshot.turnIndex,
      turnParticipantId: dto.snapshot.turnParticipantId ?? null,
      turnParticipantName: dto.snapshot.turnParticipantName ?? null,
      at: new Date().toISOString(),
      participants: (dto.snapshot.participants || []).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        kind: p.kind,
        currentHp: p.currentHp ?? null,
        maxHp: p.maxHp ?? null,
        note: p.note ?? null,
      })),
    };
    log.snapshots = [...(log.snapshots || []), snapshot];
    await this.repo.save(log);
    return { ok: true };
  }

  /** Marks a combat run as finished with an optional outcome. Master only. */
  async end(userId: number, campaignId: string, logId: string, dto: EndCombatLogDto): Promise<{ ok: true }> {
    const { isMaster } = await this.getCampaignAccess(campaignId, userId);
    if (!isMaster) throw new ForbiddenException('Only the master can record combat');

    const log = await this.getOwnedLog(campaignId, logId);
    if (!log.endedAt) {
      log.endedAt = new Date();
      log.outcome = dto.outcome ?? null;
      await this.repo.save(log);
    }
    return { ok: true };
  }

  /**
   * Lists combat runs for a campaign (most recent first), optionally filtered
   * by encounter. Any campaign member can read the history.
   */
  async list(userId: number, campaignId: string, encounterId?: string): Promise<CombatLog[]> {
    await this.getCampaignAccess(campaignId, userId);
    const where: any = { campaignId };
    if (encounterId) where.encounterId = encounterId;
    return this.repo.find({ where, order: { startedAt: 'DESC' } });
  }

  /** Returns a single combat run with its snapshots. */
  async getOne(userId: number, campaignId: string, logId: string): Promise<CombatLog> {
    await this.getCampaignAccess(campaignId, userId);
    return this.getOwnedLog(campaignId, logId);
  }

  /** Deletes a combat run. Master only. */
  async remove(userId: number, campaignId: string, logId: string): Promise<{ ok: true }> {
    const { isMaster } = await this.getCampaignAccess(campaignId, userId);
    if (!isMaster) throw new ForbiddenException('Only the master can delete combat history');
    const log = await this.getOwnedLog(campaignId, logId);
    await this.repo.remove(log);
    return { ok: true };
  }
}
