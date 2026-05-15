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
  ) {}

  /**
   * Lists all scenes accessible to the owner for the current scope.
   */
  async findAllForOwner(ownerId: number, campaignId?: string): Promise<Scene[]> {
    return this.scenesRepository.findAllByOwner(ownerId, campaignId);
  }

  /**
   * Loads a single owned scene.
   */
  async findOneForOwner(id: string, ownerId: number): Promise<Scene> {
    const scene = await this.scenesRepository.findByIdForOwner(id, ownerId);
    if (!scene) {
      throw new NotFoundException(`Scene with ID "${id}" not found`);
    }
    return scene;
  }

  /**
   * Creates a scene owned by the authenticated user.
   */
  async createForOwner(ownerId: number, dto: CreateSceneDto): Promise<Scene> {
    const scope = this.resolveScope(dto.scope, dto.campaignId ?? null);
    const campaignRef = await this.resolveCampaignReference(ownerId, scope, dto.campaignId ?? null);
    const scene = this.scenesRepository.createScene({
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
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

    Object.assign(scene, {
      name: dto.name?.trim() ?? scene.name,
      description: dto.description === undefined ? scene.description : dto.description?.trim() ?? null,
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
}