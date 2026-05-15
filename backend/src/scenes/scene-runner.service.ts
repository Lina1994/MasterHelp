import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ShortcutsService } from '../shortcuts/shortcuts.service';
import {
  SCENE_MAX_DEPTH,
  type SceneActionDefinition,
  type SceneExecutionSummary,
  type SceneRuntimeCommand,
  type SceneRuntimeCommandKind,
  type SceneTriggerSource,
} from './actionTypes';
import { SceneExecution } from './entities/scene-execution.entity';
import { Scene } from './entities/scene.entity';
import { ScenesRepository } from './scenes.repository';
import { SceneVideosService } from './scene-videos.service';

interface SceneRunnerContext {
  ownerId: number;
  rootExecution: SceneExecution;
  path: string[];
  depth: number;
  currentOffsetMs: number;
}

export interface SceneRunnerRequest {
  scene: Scene;
  ownerId: number;
  execution: SceneExecution;
  triggerSource: SceneTriggerSource;
  triggerShortcutId?: string | null;
}

export interface SceneRunnerResult {
  commands: SceneRuntimeCommand[];
  summary: SceneExecutionSummary;
}

/**
 * Builds a serializable execution plan for scenes while persisting progress.
 */
@Injectable()
export class SceneRunnerService {
  constructor(
    private readonly scenesRepository: ScenesRepository,
    private readonly shortcutsService: ShortcutsService,
    private readonly sceneVideosService: SceneVideosService,
  ) {}

  /**
   * Expands a scene into runtime commands, nested scene calls, and shortcut executions.
   */
  async run(request: SceneRunnerRequest): Promise<SceneRunnerResult> {
    const summary: SceneExecutionSummary = {
      totalActions: request.scene.actions.length,
      completedActions: 0,
      emittedCommands: 0,
      nestedScenes: 0,
      nestedShortcuts: 0,
      totalDelayMs: 0,
    };

    const commands = await this.processScene(request.scene, {
      ownerId: request.ownerId,
      rootExecution: request.execution,
      path: [request.scene.id],
      depth: 0,
      currentOffsetMs: 0,
    }, summary);

    return {
      commands,
      summary,
    };
  }

  /**
   * Processes one scene definition recursively into runtime commands.
   */
  private async processScene(
    scene: Scene,
    context: SceneRunnerContext,
    summary: SceneExecutionSummary,
  ): Promise<SceneRuntimeCommand[]> {
    if (context.depth > SCENE_MAX_DEPTH) {
      throw new BadRequestException(`Scene nesting depth cannot exceed ${SCENE_MAX_DEPTH}`);
    }

    const commands: SceneRuntimeCommand[] = [];

    for (let index = 0; index < scene.actions.length; index += 1) {
      const action = scene.actions[index];
      if (action.delay && action.delay > 0) {
        context.currentOffsetMs += action.delay;
        summary.totalDelayMs += action.delay;
      }
      const issuedAtOffsetMs = this.resolveIssuedAtOffsetMs(action, context.currentOffsetMs);

      context.rootExecution.currentActionIndex = index;
      context.rootExecution.totalActions = summary.totalActions;
      context.rootExecution.executionPath = [...context.path];
      context.rootExecution.summary = { ...summary };
      await this.scenesRepository.saveExecution(context.rootExecution);

      if (action.type === 'delay') {
        const durationMs = Number(action.payload.durationMs ?? 0);
        context.currentOffsetMs += durationMs;
        summary.totalDelayMs += durationMs;
        summary.completedActions += 1;
        continue;
      }

      if (action.type === 'runScene') {
        const nestedSceneId = String(action.payload.sceneId || '');
        if (context.path.includes(nestedSceneId)) {
          throw new BadRequestException(`Scene cycle detected for scene "${nestedSceneId}"`);
        }
        const nestedScene = await this.scenesRepository.findByIdForOwner(nestedSceneId, context.ownerId);
        if (!nestedScene) {
          throw new NotFoundException(`Scene with ID "${nestedSceneId}" not found`);
        }
        summary.nestedScenes += 1;
        summary.totalActions += nestedScene.actions.length;
        const nestedCommands = await this.processScene(nestedScene, {
          ...context,
          path: [...context.path, nestedScene.id],
          depth: context.depth + 1,
        }, summary);
        commands.push(...nestedCommands);
        summary.completedActions += 1;
        continue;
      }

      if (action.type === 'runShortcut') {
        const shortcutId = String(action.payload.shortcutId || '');
        const shortcut = await this.shortcutsService.executeForOwner(shortcutId, context.ownerId);
        commands.push({
          actionId: action.id,
          kind: 'shortcut.execute',
          payload: {
            shortcutId,
            shortcut,
          },
          issuedAtOffsetMs,
        });
        summary.nestedShortcuts += 1;
        summary.emittedCommands += 1;
        summary.completedActions += 1;
        continue;
      }

      commands.push(await this.toRuntimeCommand(action, context.ownerId, issuedAtOffsetMs));
      summary.emittedCommands += 1;
      summary.completedActions += 1;
    }

    return commands;
  }

  /**
   * Resolves absolute schedule offset when an action provides timelineStartMs.
   */
  private resolveIssuedAtOffsetMs(action: SceneActionDefinition, fallbackOffsetMs: number): number {
    const payload = action.payload as Record<string, unknown>;
    const timelineStartRaw = Number(payload.timelineStartMs);
    if (!Number.isFinite(timelineStartRaw) || timelineStartRaw < 0) {
      return fallbackOffsetMs;
    }
    return Math.round(timelineStartRaw);
  }

  /**
   * Maps one scene action into a runtime command for the frontend/Electron bridge.
   */
  private async toRuntimeCommand(
    action: SceneActionDefinition,
    ownerId: number,
    issuedAtOffsetMs: number,
  ): Promise<SceneRuntimeCommand> {
    const kindMap: Record<Exclude<SceneActionDefinition['type'], 'delay' | 'runScene' | 'runShortcut'>, SceneRuntimeCommandKind> = {
      playMusic: 'audio.playMusic',
      stopMusic: 'audio.stopMusic',
      playSound: 'audio.playSound',
      setMusicVolume: 'audio.setMusicVolume',
      sendImageToWindow: 'window.sendImage',
      sendVideoToWindow: 'window.sendVideo',
      setWindowBackground: 'window.setBackground',
      applyWindowFilter: 'window.applyFilter',
      clearWindowFilter: 'window.clearFilter',
      setWeather: 'weather.set',
      setNarrativeText: 'narrative.setText',
    };

    const kind = kindMap[action.type as keyof typeof kindMap];
    if (!kind) {
      throw new BadRequestException(`Action type "${action.type}" cannot be emitted as a runtime command`);
    }

    let payload = action.payload as Record<string, unknown>;
    if (action.type === 'sendVideoToWindow') {
      payload = await this.sceneVideosService.resolveRuntimeVideoPayload(ownerId, payload);
    }

    return {
      actionId: action.id,
      kind,
      payload,
      ...(action.targetWindow ? { targetWindow: action.targetWindow } : {}),
      issuedAtOffsetMs,
    };
  }
}