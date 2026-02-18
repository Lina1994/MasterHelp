import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml: any = require('sanitize-html');

import { CampaignsService } from '../campaigns/campaigns.service';
import { WorldpediaFolderRepository } from './repositories/worldpedia-folder.repository';
import { WorldpediaNoteRepository } from './repositories/worldpedia-note.repository';
import { WorldpediaNoteLinkRepository } from './repositories/worldpedia-note-link.repository';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateNoteDto, NoteLinkDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { MoveNoteDto } from './dto/move-note.dto';
import { ImportWorldpediaDto } from './dto/import-worldpedia.dto';

/* ───────────────────────── HTML sanitisation ─────────────────────────── */

/**
 * Sanitise rich-text HTML content for Worldpedia notes.
 *
 * Allows the same tag set as the diary editor plus custom `data-*` attributes
 * used for internal note / entity links.
 */
function sanitizeWorldpediaHtml(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  return sanitizeHtml(trimmed, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'span']),
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'data-link-type', 'data-target-note-id', 'data-entity-type', 'data-entity-id'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['style'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      li: ['style'],
    },
    allowedSchemes: ['http', 'https', 'data', 'mailto', 'worldpedia'],
    allowProtocolRelative: false,
    transformTags: {
      /** Add target/_blank only for external links; internal worldpedia:// links stay as-is. */
      a: (tagName: string, attribs: Record<string, string>) => {
        const href = attribs.href || '';
        if (href.startsWith('worldpedia://')) {
          return { tagName, attribs: { ...attribs } };
        }
        return { tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } };
      },
    },
  });
}

/* ═══════════════════════════ SERVICE ══════════════════════════════════ */

@Injectable()
export class WorldpediaService {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly folderRepo: WorldpediaFolderRepository,
    private readonly noteRepo: WorldpediaNoteRepository,
    private readonly linkRepo: WorldpediaNoteLinkRepository,
  ) {}

  /* ───────────────────── auth helpers ────────────────────────────────── */

  /**
   * Assert that the user is a member of the campaign and return whether
   * they are a master.
   */
  private async assertCampaignMember(params: { campaignId: string; userId: number }): Promise<{ isMaster: boolean }> {
    const campaign = await this.campaignsService.findOne(params.campaignId);
    if (!campaign) throw new NotFoundException('Campaign not found');

    const isOwner = campaign.owner?.id === params.userId;
    const isPlayer = !!campaign.players?.some(
      (p: any) => p.user?.id === params.userId && p.status === 'active',
    );
    if (!isOwner && !isPlayer) throw new ForbiddenException('Not a campaign member');

    const isMaster =
      isOwner ||
      !!campaign.players?.some(
        (p: any) => p.user?.id === params.userId && p.status === 'active' && p.role === 'master',
      );

    return { isMaster };
  }

  /**
   * Assert that the user is a master of the campaign.
   */
  private async assertMaster(params: { campaignId: string; userId: number }): Promise<void> {
    const { isMaster } = await this.assertCampaignMember(params);
    if (!isMaster) throw new ForbiddenException('Not campaign master');
  }

  /* ═══════════════════════════ TREE ══════════════════════════════════ */

  /**
   * Return the full Worldpedia tree for a campaign: folders (with their
   * notes) plus root-level notes.
   */
  async getTree(campaignId: string, userId: number) {
    await this.assertMaster({ campaignId, userId });

    const [folders, allNotes] = await Promise.all([
      this.folderRepo.findByCampaign(campaignId),
      this.noteRepo.findByCampaign(campaignId),
    ]);

    // Build folder map
    const folderMap = new Map(folders.map((f) => [f.id, { ...f, notes: [] as any[] }]));
    const rootNotes: any[] = [];

    for (const note of allNotes) {
      // Strip heavy html from tree listing
      const light = { id: note.id, title: note.title, folderId: note.folderId, position: note.position, createdAt: note.createdAt, updatedAt: note.updatedAt };
      if (note.folderId && folderMap.has(note.folderId)) {
        folderMap.get(note.folderId)!.notes.push(light);
      } else {
        rootNotes.push(light);
      }
    }

    return {
      folders: Array.from(folderMap.values()),
      rootNotes,
    };
  }

  /* ═══════════════════════════ FOLDERS ═══════════════════════════════ */

  /**
   * Create a new folder in the campaign's Worldpedia.
   */
  async createFolder(campaignId: string, userId: number, dto: CreateFolderDto) {
    await this.assertMaster({ campaignId, userId });

    const position = dto.position ?? (await this.folderRepo.maxPosition(campaignId)) + 1;
    return this.folderRepo.create({ campaignId, name: dto.name, position });
  }

  /**
   * Update a folder's name or position.
   */
  async updateFolder(campaignId: string, folderId: string, userId: number, dto: UpdateFolderDto) {
    await this.assertMaster({ campaignId, userId });

    const folder = await this.folderRepo.findById(folderId);
    if (!folder || folder.campaignId !== campaignId) throw new NotFoundException('Folder not found');

    if (dto.name !== undefined) folder.name = dto.name;
    if (dto.position !== undefined) folder.position = dto.position;

    return this.folderRepo.save(folder);
  }

  /**
   * Delete a folder.  Notes inside are moved to root level.
   */
  async deleteFolder(campaignId: string, folderId: string, userId: number) {
    await this.assertMaster({ campaignId, userId });

    const folder = await this.folderRepo.findById(folderId);
    if (!folder || folder.campaignId !== campaignId) throw new NotFoundException('Folder not found');

    // Detach notes first
    await this.noteRepo.detachFromFolder(folderId);
    await this.folderRepo.remove(folder);
  }

  /* ═══════════════════════════ NOTES ═════════════════════════════════ */

  /**
   * Create a new note.
   */
  async createNote(campaignId: string, userId: number, dto: CreateNoteDto) {
    await this.assertMaster({ campaignId, userId });

    const position = dto.position ?? (await this.noteRepo.maxPosition(campaignId, dto.folderId ?? null)) + 1;
    const html = sanitizeWorldpediaHtml(dto.html);

    const note = await this.noteRepo.create({
      campaignId,
      title: dto.title,
      html,
      folderId: dto.folderId ?? null,
      position,
    });

    // Persist links
    if (dto.links?.length) {
      await this.linkRepo.replaceForNote(note.id, this.mapLinkDtos(dto.links));
    }

    return this.noteRepo.findByIdWithLinks(note.id);
  }

  /**
   * Return a single note with links and backlinks.
   */
  async getNote(campaignId: string, noteId: string, userId: number) {
    await this.assertMaster({ campaignId, userId });

    const note = await this.noteRepo.findByIdWithLinks(noteId);
    if (!note || note.campaignId !== campaignId) throw new NotFoundException('Note not found');
    return note;
  }

  /**
   * Update an existing note.
   */
  async updateNote(campaignId: string, noteId: string, userId: number, dto: UpdateNoteDto) {
    await this.assertMaster({ campaignId, userId });

    const note = await this.noteRepo.findById(noteId);
    if (!note || note.campaignId !== campaignId) throw new NotFoundException('Note not found');

    if (dto.title !== undefined) note.title = dto.title;
    if (dto.html !== undefined) note.html = sanitizeWorldpediaHtml(dto.html);
    if (dto.folderId !== undefined) note.folderId = dto.folderId ?? null;
    if (dto.position !== undefined) note.position = dto.position;

    await this.noteRepo.save(note);

    // Replace links if provided
    if (dto.links !== undefined) {
      await this.linkRepo.replaceForNote(note.id, this.mapLinkDtos(dto.links ?? []));
    }

    return this.noteRepo.findByIdWithLinks(note.id);
  }

  /**
   * Delete a note and its links.
   */
  async deleteNote(campaignId: string, noteId: string, userId: number) {
    await this.assertMaster({ campaignId, userId });

    const note = await this.noteRepo.findById(noteId);
    if (!note || note.campaignId !== campaignId) throw new NotFoundException('Note not found');

    await this.linkRepo.deleteByNote(noteId);
    await this.noteRepo.remove(note);
  }

  /**
   * Move a note to another folder (or to root).
   */
  async moveNote(campaignId: string, noteId: string, userId: number, dto: MoveNoteDto) {
    await this.assertMaster({ campaignId, userId });

    const note = await this.noteRepo.findById(noteId);
    if (!note || note.campaignId !== campaignId) throw new NotFoundException('Note not found');

    note.folderId = dto.folderId ?? null;
    return this.noteRepo.save(note);
  }

  /* ═══════════════════════════ SEARCH ════════════════════════════════ */

  /**
   * Search notes by title/content.
   */
  async searchNotes(campaignId: string, userId: number, query: string) {
    await this.assertMaster({ campaignId, userId });
    return this.noteRepo.search(campaignId, query);
  }

  /* ═══════════════════════════ LINKS ═════════════════════════════════ */

  /**
   * Return outgoing links + backlinks for a note.
   */
  async getNoteLinks(campaignId: string, noteId: string, userId: number) {
    await this.assertMaster({ campaignId, userId });

    const note = await this.noteRepo.findById(noteId);
    if (!note || note.campaignId !== campaignId) throw new NotFoundException('Note not found');

    const [links, backlinks] = await Promise.all([
      this.linkRepo.findByNote(noteId),
      this.linkRepo.findBacklinks(noteId),
    ]);

    return { links, backlinks };
  }

  /* ═══════════════════════════ EXPORT ════════════════════════════════ */

  /**
   * Export the entire Worldpedia of a campaign as a JSON-friendly object.
   */
  async exportAll(campaignId: string, userId: number) {
    await this.assertMaster({ campaignId, userId });

    const [folders, notes] = await Promise.all([
      this.folderRepo.findByCampaign(campaignId),
      this.noteRepo.findByCampaign(campaignId),
    ]);

    const noteIds = notes.map((n) => n.id);
    const links = await this.linkRepo.findByNoteIds(noteIds);

    return {
      folders: folders.map((f) => ({ originalId: f.id, name: f.name, position: f.position })),
      notes: notes.map((n) => ({
        originalId: n.id,
        title: n.title,
        html: n.html,
        originalFolderId: n.folderId,
        links: links
          .filter((l) => l.noteId === n.id)
          .map((l) => ({
            type: l.type,
            label: l.label,
            targetUrl: l.targetUrl,
            targetNoteId: l.targetNoteId,
            targetEntityType: l.targetEntityType,
            targetEntityId: l.targetEntityId,
          })),
      })),
    };
  }

  /**
   * Export a single folder with its notes.
   */
  async exportFolder(campaignId: string, folderId: string, userId: number) {
    await this.assertMaster({ campaignId, userId });

    const folder = await this.folderRepo.findById(folderId);
    if (!folder || folder.campaignId !== campaignId) throw new NotFoundException('Folder not found');

    const notes = await this.noteRepo.findByFolder(folderId);
    const noteIds = notes.map((n) => n.id);
    const links = await this.linkRepo.findByNoteIds(noteIds);

    return {
      folders: [{ originalId: folder.id, name: folder.name, position: folder.position }],
      notes: notes.map((n) => ({
        originalId: n.id,
        title: n.title,
        html: n.html,
        originalFolderId: n.folderId,
        links: links
          .filter((l) => l.noteId === n.id)
          .map((l) => ({
            type: l.type,
            label: l.label,
            targetUrl: l.targetUrl,
            targetNoteId: l.targetNoteId,
            targetEntityType: l.targetEntityType,
            targetEntityId: l.targetEntityId,
          })),
      })),
    };
  }

  /**
   * Export a single note.
   */
  async exportNote(campaignId: string, noteId: string, userId: number) {
    await this.assertMaster({ campaignId, userId });

    const note = await this.noteRepo.findById(noteId);
    if (!note || note.campaignId !== campaignId) throw new NotFoundException('Note not found');

    const links = await this.linkRepo.findByNote(noteId);

    return {
      folders: [],
      notes: [
        {
          originalId: note.id,
          title: note.title,
          html: note.html,
          originalFolderId: note.folderId,
          links: links.map((l) => ({
            type: l.type,
            label: l.label,
            targetUrl: l.targetUrl,
            targetNoteId: l.targetNoteId,
            targetEntityType: l.targetEntityType,
            targetEntityId: l.targetEntityId,
          })),
        },
      ],
    };
  }

  /* ═══════════════════════════ IMPORT ════════════════════════════════ */

  /**
   * Import Worldpedia data into a campaign.
   *
   * UUIDs are regenerated; internal note links are remapped automatically.
   */
  async importData(campaignId: string, userId: number, dto: ImportWorldpediaDto) {
    await this.assertMaster({ campaignId, userId });

    // Maps: originalId -> newId
    const folderIdMap = new Map<string, string>();
    const noteIdMap = new Map<string, string>();

    // 1. Create folders
    let folderPosition = (await this.folderRepo.maxPosition(campaignId)) + 1;
    for (const f of dto.folders ?? []) {
      const created = await this.folderRepo.create({
        campaignId,
        name: f.name,
        position: folderPosition++,
      });
      if (f.originalId) folderIdMap.set(f.originalId, created.id);
    }

    // 2. Create notes (without links first)
    let notePosition = (await this.noteRepo.maxPosition(campaignId, null)) + 1;
    for (const n of dto.notes ?? []) {
      const mappedFolderId = n.originalFolderId ? (folderIdMap.get(n.originalFolderId) ?? null) : null;
      const created = await this.noteRepo.create({
        campaignId,
        title: n.title,
        html: sanitizeWorldpediaHtml(n.html),
        folderId: mappedFolderId,
        position: notePosition++,
      });
      if (n.originalId) noteIdMap.set(n.originalId, created.id);
    }

    // 3. Create links (remap targetNoteId)
    for (const n of dto.notes ?? []) {
      const newNoteId = n.originalId ? noteIdMap.get(n.originalId) : undefined;
      if (!newNoteId || !n.links?.length) continue;

      const mappedLinks = n.links.map((l) => ({
        type: l.type as 'url' | 'note' | 'entity',
        label: l.label ?? null,
        targetUrl: l.targetUrl ?? null,
        targetNoteId: l.targetNoteId ? (noteIdMap.get(l.targetNoteId) ?? l.targetNoteId) : null,
        targetEntityType: l.targetEntityType ?? null,
        targetEntityId: l.targetEntityId ?? null,
      }));

      await this.linkRepo.replaceForNote(newNoteId, mappedLinks);
    }

    return { foldersCreated: folderIdMap.size, notesCreated: noteIdMap.size };
  }

  /* ───────────────────── private helpers ─────────────────────────────── */

  /**
   * Convert an array of DTO link objects to partial entity objects.
   */
  private mapLinkDtos(dtos: NoteLinkDto[]) {
    return dtos.map((l) => ({
      type: l.type,
      label: l.label ?? null,
      targetUrl: l.targetUrl ?? null,
      targetNoteId: l.targetNoteId ?? null,
      targetEntityType: l.targetEntityType ?? null,
      targetEntityId: l.targetEntityId ?? null,
    }));
  }
}
