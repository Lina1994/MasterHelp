import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../users/entities/user.entity';
import { SceneVideo } from './entities/scene-video.entity';

/**
 * Repository wrapper for scene video assets.
 */
@Injectable()
export class SceneVideosRepository {
  constructor(
    @InjectRepository(SceneVideo)
    private readonly sceneVideoRepository: Repository<SceneVideo>,
  ) {}

  /**
   * Lists scene videos owned by one user.
   */
  async findAllByOwner(ownerId: number, campaignId?: string | null): Promise<SceneVideo[]> {
    const query = this.sceneVideoRepository.createQueryBuilder('video')
      .leftJoinAndSelect('video.owner', 'owner')
      .leftJoinAndSelect('video.campaign', 'campaign')
      .where('owner.id = :ownerId', { ownerId });

    if (campaignId) {
      query.andWhere('(campaign.id = :campaignId OR campaign.id IS NULL)', { campaignId });
    }

    return query.orderBy('video.createdAt', 'DESC').getMany();
  }

  /**
   * Finds one video by id and owner.
   */
  async findByIdForOwner(id: string, ownerId: number): Promise<SceneVideo | null> {
    return this.sceneVideoRepository.findOne({
      where: { id, owner: { id: ownerId } },
      relations: { owner: true, campaign: true },
    });
  }

  /**
   * Creates an in-memory entity instance.
   */
  create(data: Partial<SceneVideo>): SceneVideo {
    return this.sceneVideoRepository.create(data);
  }

  /**
   * Persists one scene video.
   */
  async save(video: SceneVideo): Promise<SceneVideo> {
    return this.sceneVideoRepository.save(video);
  }

  /**
   * Deletes one video entity.
   */
  async remove(video: SceneVideo): Promise<void> {
    await this.sceneVideoRepository.remove(video);
  }

  /**
   * Creates a lightweight owner relation reference.
   */
  createOwnerReference(ownerId: number): User {
    return this.sceneVideoRepository.manager.create(User, { id: ownerId });
  }

  /**
   * Creates a lightweight campaign relation reference.
   */
  createCampaignReference(campaignId: string): Campaign {
    return this.sceneVideoRepository.manager.create(Campaign, { id: campaignId });
  }
}
