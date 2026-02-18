import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorldpediaNoteLink } from '../entities/worldpedia-note-link.entity';

/**
 * Repository wrapper for Worldpedia note links.
 */
@Injectable()
export class WorldpediaNoteLinkRepository {
  constructor(
    @InjectRepository(WorldpediaNoteLink)
    private readonly repo: Repository<WorldpediaNoteLink>,
  ) {}

  /**
   * Return all outgoing links from a note.
   */
  async findByNote(noteId: string): Promise<WorldpediaNoteLink[]> {
    return this.repo.find({ where: { noteId } });
  }

  /**
   * Return all incoming links (backlinks) pointing to a note.
   */
  async findBacklinks(targetNoteId: string): Promise<WorldpediaNoteLink[]> {
    return this.repo.find({
      where: { targetNoteId },
      relations: ['note'],
    });
  }

  /**
   * Delete all links belonging to a note and recreate with the provided list.
   */
  async replaceForNote(noteId: string, links: Partial<WorldpediaNoteLink>[]): Promise<WorldpediaNoteLink[]> {
    await this.repo.delete({ noteId });
    if (!links.length) return [];
    const entities = links.map((l) => this.repo.create({ ...l, noteId }));
    return this.repo.save(entities);
  }

  /**
   * Delete all links belonging to a note.
   */
  async deleteByNote(noteId: string): Promise<void> {
    await this.repo.delete({ noteId });
  }

  /**
   * Find all links in a campaign (via a list of noteIds) for export.
   */
  async findByNoteIds(noteIds: string[]): Promise<WorldpediaNoteLink[]> {
    if (!noteIds.length) return [];
    return this.repo
      .createQueryBuilder('link')
      .where('link.noteId IN (:...noteIds)', { noteIds })
      .getMany();
  }
}
