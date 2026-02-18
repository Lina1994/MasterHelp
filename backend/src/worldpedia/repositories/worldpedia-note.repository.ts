import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WorldpediaNote } from '../entities/worldpedia-note.entity';

/**
 * Repository wrapper for Worldpedia notes.
 */
@Injectable()
export class WorldpediaNoteRepository {
  constructor(
    @InjectRepository(WorldpediaNote)
    private readonly repo: Repository<WorldpediaNote>,
  ) {}

  /**
   * Return all notes for a campaign, ordered by position.
   */
  async findByCampaign(campaignId: string): Promise<WorldpediaNote[]> {
    return this.repo.find({
      where: { campaignId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Return all notes belonging to a specific folder.
   */
  async findByFolder(folderId: string): Promise<WorldpediaNote[]> {
    return this.repo.find({
      where: { folderId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Return a single note with its outgoing links and backlinks.
   */
  async findByIdWithLinks(id: string): Promise<WorldpediaNote | null> {
    return this.repo
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.links', 'link')
      .leftJoinAndSelect('note.backlinks', 'backlink')
      .leftJoinAndSelect('backlink.note', 'backlinkSource')
      .where('note.id = :id', { id })
      .getOne();
  }

  /**
   * Return a single note by id (without relations).
   */
  async findById(id: string): Promise<WorldpediaNote | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Return max position value for notes in a campaign (optionally within a folder).
   */
  async maxPosition(campaignId: string, folderId: string | null): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('n')
      .select('MAX(n.position)', 'max')
      .where('n.campaignId = :campaignId', { campaignId });

    if (folderId) {
      qb.andWhere('n.folderId = :folderId', { folderId });
    } else {
      qb.andWhere('n.folderId IS NULL');
    }

    const result = await qb.getRawOne();
    return result?.max ?? -1;
  }

  /**
   * Full-text search in title and html for a campaign.
   */
  async search(campaignId: string, query: string): Promise<WorldpediaNote[]> {
    const like = `%${query}%`;
    return this.repo
      .createQueryBuilder('n')
      .where('n.campaignId = :campaignId', { campaignId })
      .andWhere('(LOWER(n.title) LIKE LOWER(:like) OR LOWER(n.html) LIKE LOWER(:like))', { like })
      .orderBy('n.title', 'ASC')
      .getMany();
  }

  async save(note: WorldpediaNote): Promise<WorldpediaNote> {
    return this.repo.save(note);
  }

  async create(data: Partial<WorldpediaNote>): Promise<WorldpediaNote> {
    return this.repo.save(this.repo.create(data));
  }

  async remove(note: WorldpediaNote): Promise<void> {
    await this.repo.remove(note);
  }

  /**
   * Move all notes from a folder to root (set folderId = null).
   */
  async detachFromFolder(folderId: string): Promise<void> {
    await this.repo.update({ folderId }, { folderId: null as any });
  }

  /**
   * Return multiple notes by their ids.
   */
  async findByIds(ids: string[]): Promise<WorldpediaNote[]> {
    if (!ids.length) return [];
    return this.repo.find({ where: { id: In(ids) } });
  }
}
