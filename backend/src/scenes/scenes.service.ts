import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SCENE_SCHEDULE_LEAD_MS,
  SCENE_SCHEDULE_VERSION,
  SCENE_SCHEMA_VERSION,
  type SceneExecutionStatus,
  type SceneScope,
} from './actionTypes';
import { CreateSceneDto } from './dto/create-scene.dto';
import { ExecuteSceneDto } from './dto/execute-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { SceneExecution } from './entities/scene-execution.entity';
import { Scene } from './entities/scene.entity';
import { SceneRunnerService } from './scene-runner.service';
import { SceneVideosService } from './scene-videos.service';
import { ScenesRepository } from './scenes.repository';
import { validateAndNormalizeSceneActions } from './validators/scene-action.validator';

export interface SceneExecutionResponse {
  executionId: string;
  status: SceneExecutionStatus;
  scene: Scene;
  scheduleVersion: number;
  serverNowMs: number;
  startAtMs: number;
  commands: SceneExecution['emittedCommands'];
  summary: SceneExecution['summary'];
}

export interface SceneClockSyncResponse {
  serverNowMs: number;
  scheduleVersion: number;
  leadMs: number;
}

/**
 * Application service for user-owned scenes and scene execution history.
 */
@Injectable()
export class ScenesService {
  constructor(
    private readonly scenesRepository: ScenesRepository,
    private readonly sceneRunnerService: SceneRunnerService,
    private readonly sceneVideosService: SceneVideosService,
  ) {}

  /**
   * Lists all scenes accessible to the owner for the current scope.
   */
  async findAllForOwner(ownerId: number, campaignId?: string): Promise<Scene[]> {
    const scenes = await this.scenesRepository.findAllByOwner(ownerId, campaignId);
    return this.enrichScenesWithVideoDurations(scenes, ownerId);
  }

  /**
   * Loads a single owned scene.
   */
  async findOneForOwner(id: string, ownerId: number): Promise<Scene> {
    const scene = await this.scenesRepository.findByIdForOwner(id, ownerId);
    if (!scene) {
      throw new NotFoundException(`Scene with ID "${id}" not found`);
    }
    return this.enrichSceneWithVideoDurations(scene, ownerId);
  }

  /**
   * Creates a scene owned by the authenticated user.
   */
  async createForOwner(ownerId: number, dto: CreateSceneDto): Promise<Scene> {
    const scope = this.resolveScope(dto.scope, dto.campaignId ?? null);
    const campaignRef = await this.resolveCampaignReference(ownerId, scope, dto.campaignId ?? null);
    const loopConfig = this.resolveLoopConfig(dto.loop, dto.loopDelayMs, dto.loopDelayRandomMinMs, dto.loopDelayRandomMaxMs);
    const loopWindow = this.resolveLoopWindow(
      loopConfig.loop,
      dto.loopWindowStartMs,
      dto.loopWindowEndMs,
    );
    const scene = this.scenesRepository.createScene({
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      loop: loopConfig.loop,
      loopDelayMs: loopConfig.loopDelayMs,
      loopDelayRandomMinMs: loopConfig.loopDelayRandomMinMs,
      loopDelayRandomMaxMs: loopConfig.loopDelayRandomMaxMs,
      loopWindowStartMs: loopWindow.loopWindowStartMs,
      loopWindowEndMs: loopWindow.loopWindowEndMs,
      takeOverMusicOnStart: dto.takeOverMusicOnStart ?? false,
      restorePreviousMusicOnFinish: dto.restorePreviousMusicOnFinish ?? true,
      icon: this.normalizeOptionalText(dto.icon),
      imageUrl: this.normalizeOptionalText(dto.imageUrl),
      scope,
      schemaVersion: dto.schemaVersion ?? SCENE_SCHEMA_VERSION,
      actions: validateAndNormalizeSceneActions(dto.actions as unknown as Record<string, unknown>[]),
      owner: this.scenesRepository.createOwnerReference(ownerId),
      campaign: campaignRef.campaignId ? this.scenesRepository.createCampaignReference(campaignRef.campaignId) : null,
    });
    return this.scenesRepository.saveScene(scene);
  }

  /**
   * Updates an existing owned scene.
   */
  async updateForOwner(id: string, ownerId: number, dto: UpdateSceneDto): Promise<Scene> {
    const scene = await this.findOneForOwner(id, ownerId);
    const scope = dto.scope ?? scene.scope;
    const targetCampaignId = dto.campaignId === undefined
      ? scene.campaign?.id ?? null
      : dto.campaignId;
    const campaignRef = await this.resolveCampaignReference(ownerId, scope, targetCampaignId ?? null);
    const loopConfig = this.resolveLoopConfig(
      dto.loop ?? scene.loop,
      dto.loopDelayMs === undefined ? scene.loopDelayMs : dto.loopDelayMs,
      dto.loopDelayRandomMinMs === undefined ? scene.loopDelayRandomMinMs : dto.loopDelayRandomMinMs,
      dto.loopDelayRandomMaxMs === undefined ? scene.loopDelayRandomMaxMs : dto.loopDelayRandomMaxMs,
    );
    const loopWindow = this.resolveLoopWindow(
      loopConfig.loop,
      dto.loopWindowStartMs === undefined ? scene.loopWindowStartMs : dto.loopWindowStartMs,
      dto.loopWindowEndMs === undefined ? scene.loopWindowEndMs : dto.loopWindowEndMs,
    );

    Object.assign(scene, {
      name: dto.name?.trim() ?? scene.name,
      description: dto.description === undefined ? scene.description : dto.description?.trim() ?? null,
      loop: loopConfig.loop,
      loopDelayMs: loopConfig.loopDelayMs,
      loopDelayRandomMinMs: loopConfig.loopDelayRandomMinMs,
      loopDelayRandomMaxMs: loopConfig.loopDelayRandomMaxMs,
      loopWindowStartMs: loopWindow.loopWindowStartMs,
      loopWindowEndMs: loopWindow.loopWindowEndMs,
      takeOverMusicOnStart: dto.takeOverMusicOnStart === undefined ? scene.takeOverMusicOnStart : Boolean(dto.takeOverMusicOnStart),
      restorePreviousMusicOnFinish: dto.restorePreviousMusicOnFinish === undefined ? scene.restorePreviousMusicOnFinish : Boolean(dto.restorePreviousMusicOnFinish),
      icon: dto.icon === undefined ? scene.icon : this.normalizeOptionalText(dto.icon),
      imageUrl: dto.imageUrl === undefined ? scene.imageUrl : this.normalizeOptionalText(dto.imageUrl),
      scope,
      schemaVersion: dto.schemaVersion ?? scene.schemaVersion ?? SCENE_SCHEMA_VERSION,
      campaign: campaignRef.campaignId ? this.scenesRepository.createCampaignReference(campaignRef.campaignId) : null,
    });

    if (dto.actions) {
      scene.actions = validateAndNormalizeSceneActions(dto.actions as unknown as Record<string, unknown>[]);
    }

    return this.scenesRepository.saveScene(scene);
  }

  /**
   * Removes an owned scene.
   */
  async removeForOwner(id: string, ownerId: number): Promise<void> {
    const scene = await this.findOneForOwner(id, ownerId);
    await this.scenesRepository.removeScene(scene);
  }

  /**
   * Lists recent scene execution records for the authenticated owner.
   */
  async listExecutionsForOwner(ownerId: number): Promise<SceneExecution[]> {
    return this.scenesRepository.findExecutionsByOwner(ownerId);
  }

  /**
   * Loads a single owned scene execution record.
   */
  async findExecutionForOwner(id: string, ownerId: number): Promise<SceneExecution> {
    const execution = await this.scenesRepository.findExecutionByIdForOwner(id, ownerId);
    if (!execution) {
      throw new NotFoundException(`Scene execution with ID "${id}" not found`);
    }
    return execution;
  }

  /**
   * Builds and persists a runtime execution plan for a scene.
   */
  async executeForOwner(id: string, ownerId: number, dto?: ExecuteSceneDto): Promise<SceneExecutionResponse> {
    const scene = await this.findOneForOwner(id, ownerId);
    const execution = this.scenesRepository.createExecution({
      scene: this.scenesRepository.createSceneReference(scene.id),
      owner: this.scenesRepository.createOwnerReference(ownerId),
      campaign: scene.campaign ? this.scenesRepository.createCampaignReference(scene.campaign.id) : null,
      status: 'queued',
      currentActionIndex: 0,
      totalActions: scene.actions.length,
      triggerSource: dto?.triggerSource ?? 'manual',
      triggerShortcutId: dto?.triggerShortcutId ?? null,
      parentExecution: dto?.parentExecutionId ? this.scenesRepository.createExecutionReference(dto.parentExecutionId) : null,
      executionPath: [scene.id],
      emittedCommands: [],
      summary: {
        totalActions: scene.actions.length,
        completedActions: 0,
        emittedCommands: 0,
        nestedScenes: 0,
        nestedShortcuts: 0,
        totalDelayMs: 0,
      },
      cancellationRequested: false,
    });
    await this.scenesRepository.saveExecution(execution);

    execution.status = 'running';
    execution.startedAt = new Date();
    await this.scenesRepository.saveExecution(execution);

    try {
      const result = await this.sceneRunnerService.run({
        scene,
        ownerId,
        execution,
        triggerSource: dto?.triggerSource ?? 'manual',
        triggerShortcutId: dto?.triggerShortcutId ?? null,
      });

      const serverNowMs = Date.now();
      const startAtMs = serverNowMs + SCENE_SCHEDULE_LEAD_MS;
      const scheduledCommands = result.commands.map((command, index) => ({
        ...command,
        sequence: index,
        executeAtMs: startAtMs + command.issuedAtOffsetMs,
      }));

      execution.status = 'completed';
      execution.finishedAt = new Date();
      execution.currentActionIndex = Math.max(0, result.summary.completedActions - 1);
      execution.totalActions = result.summary.totalActions;
      execution.emittedCommands = scheduledCommands;
      execution.summary = result.summary;
      await this.scenesRepository.saveExecution(execution);

      return {
        executionId: execution.id,
        status: execution.status,
        scene,
        scheduleVersion: SCENE_SCHEDULE_VERSION,
        serverNowMs,
        startAtMs,
        commands: scheduledCommands,
        summary: result.summary,
      };
    } catch (error) {
      execution.status = 'failed';
      execution.failedAt = new Date();
      execution.error = error instanceof Error ? error.message : 'Unknown scene execution error';
      await this.scenesRepository.saveExecution(execution);
      throw error;
    }
  }

  /**
   * Cancels one execution owned by the authenticated user.
   */
  async cancelExecutionForOwner(executionId: string, ownerId: number): Promise<SceneExecution> {
    const execution = await this.findExecutionForOwner(executionId, ownerId);
    if (execution.status === 'cancelled') {
      return execution;
    }

    execution.cancellationRequested = true;
    execution.status = 'cancelled';
    execution.finishedAt = new Date();
    return this.scenesRepository.saveExecution(execution);
  }

  /**
   * Duplicates one owned scene preserving actions and runtime configuration.
   */
  async duplicateForOwner(id: string, ownerId: number, targetCampaignId?: string | null): Promise<Scene> {
    const scene = await this.findOneForOwner(id, ownerId);
    const scope = targetCampaignId ? 'campaign' : scene.scope;
    const campaignRef = await this.resolveCampaignReference(ownerId, scope, targetCampaignId ?? scene.campaign?.id ?? null);

    const duplicate = this.scenesRepository.createScene({
      name: `${scene.name} (copia)`,
      description: scene.description ?? null,
      scope,
      schemaVersion: scene.schemaVersion,
      loop: scene.loop,
      loopDelayMs: scene.loopDelayMs,
      loopDelayRandomMinMs: scene.loopDelayRandomMinMs,
      loopDelayRandomMaxMs: scene.loopDelayRandomMaxMs,
      loopWindowStartMs: scene.loopWindowStartMs,
      loopWindowEndMs: scene.loopWindowEndMs,
      takeOverMusicOnStart: scene.takeOverMusicOnStart,
      restorePreviousMusicOnFinish: scene.restorePreviousMusicOnFinish,
      icon: scene.icon,
      imageUrl: scene.imageUrl,
      actions: JSON.parse(JSON.stringify(scene.actions ?? [])) as Scene['actions'],
      owner: this.scenesRepository.createOwnerReference(ownerId),
      campaign: campaignRef.campaignId ? this.scenesRepository.createCampaignReference(campaignRef.campaignId) : null,
    });

    return this.scenesRepository.saveScene(duplicate);
  }

  /**
   * Returns a lightweight server clock sample for client-side calibration.
   */
  getClockSync(): SceneClockSyncResponse {
    return {
      serverNowMs: Date.now(),
      scheduleVersion: SCENE_SCHEDULE_VERSION,
      leadMs: SCENE_SCHEDULE_LEAD_MS,
    };
  }

  /**
   * Resolves the persisted scope for a scene DTO.
   */
  private resolveScope(dtoScope?: SceneScope, campaignId?: string | null): SceneScope {
    if (dtoScope) return dtoScope;
    return campaignId ? 'campaign' : 'global';
  }

  /**
   * Validates the campaign reference for campaign-scoped scenes.
   */
  private async resolveCampaignReference(
    ownerId: number,
    scope: SceneScope,
    campaignId?: string | null,
  ): Promise<{ campaignId: string | null }> {
    if (scope === 'global') {
      return { campaignId: null };
    }
    if (!campaignId) {
      throw new BadRequestException('campaignId is required when scope is campaign');
    }

    const campaign = await this.scenesRepository.findCampaignById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    const isMember = await this.scenesRepository.isCampaignMember(campaignId, ownerId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this campaign');
    }

    return { campaignId };
  }

  /**
   * Replaces missing video durations in one scene with the persisted asset duration.
   */
  private async enrichSceneWithVideoDurations(scene: Scene, ownerId: number): Promise<Scene> {
    const scenes = await this.enrichScenesWithVideoDurations([scene], ownerId);
    return scenes[0] ?? scene;
  }

  /**
   * Replaces missing video durations in a scene list with the persisted asset duration.
   */
  private async enrichScenesWithVideoDurations(scenes: Scene[], ownerId: number): Promise<Scene[]> {
    const needsEnrichment = scenes.some((scene) =>
      scene.actions.some((action) => {
        if (action.type !== 'sendVideoToWindow') return false;
        const payload = action.payload as Record<string, unknown>;
        return typeof payload.videoAssetId === 'string' && payload.videoAssetId.trim().length > 0;
      }),
    );

    if (!needsEnrichment) {
      return scenes;
    }

    const videos = await this.sceneVideosService.listForOwner(ownerId);
    const durationByVideoId = new Map<string, number>();

    for (const video of videos) {
      if (typeof video.durationMs === 'number' && Number.isFinite(video.durationMs) && video.durationMs > 0) {
        durationByVideoId.set(video.id, Math.round(video.durationMs));
      }
    }

    if (durationByVideoId.size === 0) {
      return scenes;
    }

    return scenes.map((scene) => ({
      ...scene,
      actions: scene.actions.map((action) => {
        if (action.type !== 'sendVideoToWindow') return action;

        const payload = action.payload as Record<string, unknown>;
        const videoAssetId = typeof payload.videoAssetId === 'string' ? payload.videoAssetId.trim() : '';
        if (!videoAssetId) return action;

        const durationMs = durationByVideoId.get(videoAssetId);
        if (!durationMs) return action;

        return {
          ...action,
          payload: {
            ...payload,
            durationMs,
          },
        };
      }),
    }));
  }

  /**
   * Normalizes optional text values to nullable trimmed strings.
   */
  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Resolves and validates loop configuration for persisted scenes.
   */
  private resolveLoopConfig(
    loopRaw: unknown,
    loopDelayMsRaw: unknown,
    loopDelayRandomMinMsRaw: unknown,
    loopDelayRandomMaxMsRaw: unknown,
  ): {
    loop: boolean;
    loopDelayMs: number | null;
    loopDelayRandomMinMs: number | null;
    loopDelayRandomMaxMs: number | null;
  } {
    const loop = Boolean(loopRaw);
    const loopDelayMs = this.toNullableNonNegativeInt(loopDelayMsRaw);
    const loopDelayRandomMinMs = this.toNullableNonNegativeInt(loopDelayRandomMinMsRaw);
    const loopDelayRandomMaxMs = this.toNullableNonNegativeInt(loopDelayRandomMaxMsRaw);

    if (!loop) {
      return {
        loop: false,
        loopDelayMs: null,
        loopDelayRandomMinMs: null,
        loopDelayRandomMaxMs: null,
      };
    }

    if (loopDelayRandomMinMs !== null || loopDelayRandomMaxMs !== null) {
      if (loopDelayRandomMinMs === null || loopDelayRandomMaxMs === null) {
        throw new BadRequestException('Both loopDelayRandomMinMs and loopDelayRandomMaxMs are required for random loop delay');
      }
      if (loopDelayRandomMinMs > loopDelayRandomMaxMs) {
        throw new BadRequestException('loopDelayRandomMinMs cannot be greater than loopDelayRandomMaxMs');
      }
    }

    return {
      loop: true,
      loopDelayMs,
      loopDelayRandomMinMs,
      loopDelayRandomMaxMs,
    };
  }

  /**
   * Resolves and validates scene-level loop window boundaries.
   */
  private resolveLoopWindow(
    loop: boolean,
    loopWindowStartMsRaw: unknown,
    loopWindowEndMsRaw: unknown,
  ): {
    loopWindowStartMs: number | null;
    loopWindowEndMs: number | null;
  } {
    if (!loop) {
      return {
        loopWindowStartMs: null,
        loopWindowEndMs: null,
      };
    }

    const loopWindowStartMs = this.toNullableNonNegativeInt(loopWindowStartMsRaw);
    const loopWindowEndMs = this.toNullableNonNegativeInt(loopWindowEndMsRaw);

    if (loopWindowStartMs === null && loopWindowEndMs === null) {
      return {
        loopWindowStartMs: null,
        loopWindowEndMs: null,
      };
    }

    if (loopWindowStartMs === null || loopWindowEndMs === null) {
      throw new BadRequestException('loopWindowStartMs and loopWindowEndMs must both be provided for partial scene loop');
    }

    if (loopWindowStartMs >= loopWindowEndMs) {
      throw new BadRequestException('loopWindowEndMs must be greater than loopWindowStartMs');
    }

    return {
      loopWindowStartMs,
      loopWindowEndMs,
    };
  }

  /**
   * Converts unknown values to nullable non-negative integers.
   */
  private toNullableNonNegativeInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException('Loop delay values must be non-negative numbers');
    }
    return Math.round(n);
  }
}