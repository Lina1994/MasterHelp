import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateShortcutDto } from './dto/create-shortcut.dto';
import { UpdateShortcutDto } from './dto/update-shortcut.dto';
import { Shortcut } from './entities/shortcut.entity';
import { ShortcutsRepository } from './shortcuts.repository';

/**
 * Application service for user-defined shortcuts.
 */
@Injectable()
export class ShortcutsService {
  constructor(private readonly shortcutsRepository: ShortcutsRepository) {}

  /**
   * Lists all shortcuts owned by the authenticated user.
   */
  async findAllForOwner(ownerId: number): Promise<Shortcut[]> {
    const shortcuts = await this.shortcutsRepository.findAllByOwner(ownerId);
    return Promise.all(shortcuts.map((shortcut) => this.normalizeTemporaryState(shortcut)));
  }

  /**
   * Returns a single shortcut owned by the authenticated user.
   */
  async findOneForOwner(id: string, ownerId: number): Promise<Shortcut> {
    const shortcut = await this.shortcutsRepository.findByIdForOwner(id, ownerId);
    if (!shortcut) {
      throw new NotFoundException(`Shortcut with ID "${id}" not found`);
    }
    return this.normalizeTemporaryState(shortcut);
  }

  /**
   * Creates a new shortcut definition for the authenticated user.
   */
  async createForOwner(ownerId: number, dto: CreateShortcutDto): Promise<Shortcut> {
    const shortcut = this.shortcutsRepository.create({
      ...dto,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      imageUrl: dto.imageUrl ?? null,
      hotkey: dto.hotkey ?? null,
      mode: dto.mode ?? 'button',
      temporaryDurationMs: dto.temporaryDurationMs ?? null,
      activeColor: dto.activeColor ?? null,
      inactiveColor: dto.inactiveColor ?? null,
      showOnHome: dto.showOnHome ?? true,
      showInSidebarPanel: dto.showInSidebarPanel ?? false,
      showInHotbar: dto.showInHotbar ?? false,
      sortOrder: dto.sortOrder ?? 0,
      sidebarPanelOrder: dto.sidebarPanelOrder ?? 0,
      hotbarOrder: dto.hotbarOrder ?? 0,
      actions: dto.actions,
      owner: this.shortcutsRepository.createOwnerReference(ownerId),
    });
    return this.shortcutsRepository.save(shortcut);
  }

  /**
   * Updates an existing shortcut.
   */
  async updateForOwner(id: string, ownerId: number, dto: UpdateShortcutDto): Promise<Shortcut> {
    const shortcut = await this.findOneForOwner(id, ownerId);
    Object.assign(shortcut, {
      ...dto,
      description: dto.description ?? shortcut.description,
      icon: dto.icon ?? shortcut.icon,
      imageUrl: dto.imageUrl ?? shortcut.imageUrl,
      hotkey: dto.hotkey ?? shortcut.hotkey,
      temporaryDurationMs: dto.temporaryDurationMs ?? shortcut.temporaryDurationMs,
      activeColor: dto.activeColor ?? shortcut.activeColor,
      inactiveColor: dto.inactiveColor ?? shortcut.inactiveColor,
      showOnHome: dto.showOnHome ?? shortcut.showOnHome,
      showInSidebarPanel: dto.showInSidebarPanel ?? shortcut.showInSidebarPanel,
      showInHotbar: dto.showInHotbar ?? shortcut.showInHotbar,
      sortOrder: dto.sortOrder ?? shortcut.sortOrder,
      sidebarPanelOrder: dto.sidebarPanelOrder ?? shortcut.sidebarPanelOrder,
      hotbarOrder: dto.hotbarOrder ?? shortcut.hotbarOrder,
    });
    if (dto.actions) shortcut.actions = dto.actions;
    if (dto.mode && dto.mode !== 'temporary') {
      shortcut.activeUntil = null;
    }
    return this.shortcutsRepository.save(shortcut);
  }

  /**
   * Deletes an owned shortcut.
   */
  async removeForOwner(id: string, ownerId: number): Promise<void> {
    const shortcut = await this.findOneForOwner(id, ownerId);
    await this.shortcutsRepository.remove(shortcut);
  }

  /**
   * Executes a shortcut, updating persisted state before the client performs actions.
   */
  async executeForOwner(id: string, ownerId: number): Promise<Shortcut> {
    const shortcut = await this.findOneForOwner(id, ownerId);
    const now = new Date();
    if (shortcut.mode === 'toggle') {
      shortcut.isActive = !shortcut.isActive;
      shortcut.activeUntil = null;
    } else if (shortcut.mode === 'temporary') {
      const duration = shortcut.temporaryDurationMs ?? 5000;
      shortcut.isActive = true;
      shortcut.activeUntil = new Date(now.getTime() + duration);
    }
    const saved = await this.shortcutsRepository.save(shortcut);
    return this.normalizeTemporaryState(saved);
  }

  private async normalizeTemporaryState(shortcut: Shortcut): Promise<Shortcut> {
    if (
      shortcut.mode === 'temporary'
      && shortcut.isActive
      && shortcut.activeUntil
      && shortcut.activeUntil.getTime() <= Date.now()
    ) {
      shortcut.isActive = false;
      shortcut.activeUntil = null;
      return this.shortcutsRepository.save(shortcut);
    }
    return shortcut;
  }
}