import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignPlayer } from '../campaigns/entities/campaign-player.entity';
import { User } from '../users/entities/user.entity';
import { SceneExecution } from './entities/scene-execution.entity';
import { Scene } from './entities/scene.entity';

/**
 * Repository wrapper for scene persistence and ownership checks.
 */
@Injectable()
export class ScenesRepository {
  constructor(
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(SceneExecution)
    private readonly executionRepository: Repository<SceneExecution>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignPlayer)
    private readonly campaignPlayerRepository: Repository<CampaignPlayer>,
  ) {}

  /**
   * Lists scenes owned by a user, including global and optionally campaign scoped items.
   */
  async findAllByOwner(ownerId: number, campaignId?: string | null): Promise<Scene[]> {
    const query = this.sceneRepository.createQueryBuilder('scene')
      .leftJoinAndSelect('scene.owner', 'owner')
      .leftJoinAndSelect('scene.campaign', 'campaign')
      .where('owner.id = :ownerId', { ownerId });

    if (campaignId) {
      query.andWhere('(scene.scope = :globalScope OR (scene.scope = :campaignScope AND campaign.id = :campaignId))', {
        globalScope: 'global',
        campaignScope: 'campaign',
        campaignId,
      });
    } else {
      query.andWhere('scene.scope = :globalScope', { globalScope: 'global' });
    }

    return query.orderBy('scene.createdAt', 'ASC').getMany();
  }

  /**
   * Lists all scenes owned by a user without scope filtering.
   */
  async findAllOwned(ownerId: number): Promise<Scene[]> {
    return this.sceneRepository.find({
      where: { owner: { id: ownerId } },
      relations: { owner: true, campaign: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Finds one owned scene with owner and campaign relations.
   */
  async findByIdForOwner(id: string, ownerId: number): Promise<Scene | null> {
    return this.sceneRepository.findOne({
      where: { id, owner: { id: ownerId } },
      relations: { owner: true, campaign: true },
    });
  }

  /**
   * Lists recent executions owned by a user.
   */
  async findExecutionsByOwner(ownerId: number, limit = 25): Promise<SceneExecution[]> {
    return this.executionRepository.find({
      where: { owner: { id: ownerId } },
      relations: { scene: true, parentExecution: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Returns one execution owned by a user.
   */
  async findExecutionByIdForOwner(id: string, ownerId: number): Promise<SceneExecution | null> {
    return this.executionRepository.findOne({
      where: { id, owner: { id: ownerId } },
      relations: { scene: true, parentExecution: true },
    });
  }

  /**
   * Loads a campaign by id.
   */
  async findCampaignById(campaignId: string): Promise<Campaign | null> {
    return this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
  }

  /**
   * Checks whether a user belongs to the given campaign.
   */
  async isCampaignMember(campaignId: string, ownerId: number): Promise<boolean> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) return false;
    if (campaign.owner?.id === ownerId) return true;

    const membership = await this.campaignPlayerRepository.findOne({
      where: {
        campaign: { id: campaignId },
        user: { id: ownerId },
        status: 'active',
      },
      relations: ['user', 'campaign'],
    });

    return Boolean(membership);
  }

  /**
   * Creates a scene entity instance.
   */
  createScene(data: Partial<Scene>): Scene {
    return this.sceneRepository.create(data);
  }

  /**
   * Persists a scene entity.
   */
  async saveScene(scene: Scene): Promise<Scene> {
    return this.sceneRepository.save(scene);
  }

  /**
   * Removes a scene entity.
   */
  async removeScene(scene: Scene): Promise<void> {
    await this.sceneRepository.remove(scene);
  }

  /**
   * Creates a scene execution entity instance.
   */
  createExecution(data: Partial<SceneExecution>): SceneExecution {
    return this.executionRepository.create(data);
  }

  /**
   * Persists a scene execution entity.
   */
  async saveExecution(execution: SceneExecution): Promise<SceneExecution> {
    return this.executionRepository.save(execution);
  }

  /**
   * Creates a lightweight user reference.
   */
  createOwnerReference(ownerId: number): User {
    return this.sceneRepository.manager.create(User, { id: ownerId });
  }

  /**
   * Creates a lightweight campaign reference.
   */
  createCampaignReference(campaignId: string): Campaign {
    return this.sceneRepository.manager.create(Campaign, { id: campaignId });
  }

  /**
   * Creates a lightweight scene reference.
   */
  createSceneReference(sceneId: string): Scene {
    return this.sceneRepository.manager.create(Scene, { id: sceneId });
  }

  /**
   * Creates a lightweight execution reference.
   */
  createExecutionReference(executionId: string): SceneExecution {
    return this.executionRepository.manager.create(SceneExecution, { id: executionId });
  }
}