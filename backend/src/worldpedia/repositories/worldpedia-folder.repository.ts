import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorldpediaFolder } from '../entities/worldpedia-folder.entity';

/**
 * Repository wrapper for Worldpedia folders.
 */
@Injectable()
export class WorldpediaFolderRepository {
  constructor(
    @InjectRepository(WorldpediaFolder)
    private readonly repo: Repository<WorldpediaFolder>,
  ) {}

  /**
   * Return all folders for a campaign, ordered by position.
   */
  async findByCampaign(campaignId: string): Promise<WorldpediaFolder[]> {
    return this.repo.find({
      where: { campaignId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Return a single folder by id.
   */
  async findById(id: string): Promise<WorldpediaFolder | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Return max position value for a campaign's folders.
   */
  async maxPosition(campaignId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('f')
      .select('MAX(f.position)', 'max')
      .where('f.campaignId = :campaignId', { campaignId })
      .getRawOne();
    return result?.max ?? -1;
  }

  async save(folder: WorldpediaFolder): Promise<WorldpediaFolder> {
    return this.repo.save(folder);
  }

  async create(data: Partial<WorldpediaFolder>): Promise<WorldpediaFolder> {
    return this.repo.save(this.repo.create(data));
  }

  async remove(folder: WorldpediaFolder): Promise<void> {
    await this.repo.remove(folder);
  }
}
