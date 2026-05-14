import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateShortcutDto } from './dto/create-shortcut.dto';
import { UpdateShortcutDto } from './dto/update-shortcut.dto';
import { SHORTCUT_SCHEMA_VERSION, type ShortcutActionDefinition, type ShortcutScope } from './actionTypes';
import { Shortcut } from './entities/shortcut.entity';
import { ShortcutsRepository } from './shortcuts.repository';
import { normalizeHotkey, validateAndNormalizeShortcutActions } from './validators/shortcut-action.validator';

/**
 * Application service for user-defined shortcuts.
 */
@Injectable()
export class ShortcutsService {
  constructor(private readonly shortcutsRepository: ShortcutsRepository) {}

  private withLegacyActionConfig(shortcut: Shortcut): Shortcut {
    shortcut.actions = (shortcut.actions || []).map((action) => {
      const legacyConfig = (action as any).config;
      const payload = (action as any).payload;
      if (legacyConfig && !payload) {
        return { ...(action as any), payload: legacyConfig } as ShortcutActionDefinition;
      }
      if (payload && !legacyConfig) {
        return { ...(action as any), config: payload } as ShortcutActionDefinition;
      }
      return action;
    });
    return shortcut;
  }

  private resolveScope(dtoScope?: ShortcutScope, campaignId?: string | null): ShortcutScope {
    if (dtoScope) return dtoScope;
    return campaignId ? 'campaign' : 'global';
  }

  private async resolveCampaignReference(
    ownerId: number,
    scope: ShortcutScope,
    campaignId?: string | null,
  ): Promise<{ campaignId: string | null }> {
    if (scope === 'global') {
      return { campaignId: null };
    }
    if (!campaignId) {
      throw new BadRequestException('campaignId is required when scope is campaign');
    }

    const campaign = await this.shortcutsRepository.findCampaignById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    const isMember = await this.shortcutsRepository.isCampaignMember(campaignId, ownerId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this campaign');
    }
    return { campaignId };
  }

  private async assertHotkeyNotConflicting(
    ownerId: number,
    hotkey: string | null | undefined,
    scope: ShortcutScope,
    campaignId?: string | null,
    excludeId?: string,
  ): Promise<string | null> {
    const normalizedHotkey = normalizeHotkey(hotkey);
    if (!normalizedHotkey) return null;
    const conflict = await this.shortcutsRepository.findHotkeyConflict(
      ownerId,
      normalizedHotkey,
      scope,
      campaignId,
      excludeId,
    );
    if (conflict) {
      throw new BadRequestException(`Hotkey conflict with shortcut "${conflict.name}"`);
    }
    return normalizedHotkey;
  }

  /**
   * Lists all shortcuts owned by the authenticated user.
   */
  async findAllForOwner(ownerId: number, campaignId?: string): Promise<Shortcut[]> {
    const shortcuts = await this.shortcutsRepository.findAllByOwner(ownerId, campaignId);
    const normalized = await Promise.all(shortcuts.map((shortcut) => this.normalizeTemporaryState(shortcut)));
    return normalized.map((shortcut) => this.withLegacyActionConfig(shortcut));
  }

  /**
   * Returns a single shortcut owned by the authenticated user.
   */
  async findOneForOwner(id: string, ownerId: number): Promise<Shortcut> {
    const shortcut = await this.shortcutsRepository.findByIdForOwner(id, ownerId);
    if (!shortcut) {
      throw new NotFoundException(`Shortcut with ID "${id}" not found`);
    }
    const normalized = await this.normalizeTemporaryState(shortcut);
    return this.withLegacyActionConfig(normalized);
  }

  /**
   * Creates a new shortcut definition for the authenticated user.
   */
  async createForOwner(ownerId: number, dto: CreateShortcutDto): Promise<Shortcut> {
    const scope = this.resolveScope(dto.scope, dto.campaignId ?? null);
    const campaignRef = await this.resolveCampaignReference(ownerId, scope, dto.campaignId ?? null);
    const normalizedHotkey = await this.assertHotkeyNotConflicting(ownerId, dto.hotkey, scope, campaignRef.campaignId);
    const actions = validateAndNormalizeShortcutActions(dto.actions as any[]);

    const shortcut = this.shortcutsRepository.create({
      ...dto,
      scope,
      schemaVersion: dto.schemaVersion ?? SHORTCUT_SCHEMA_VERSION,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      imageUrl: dto.imageUrl ?? null,
      hotkey: dto.hotkey ?? null,
      normalizedHotkey,
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
      actions,
      owner: this.shortcutsRepository.createOwnerReference(ownerId),
      campaign: campaignRef.campaignId ? this.shortcutsRepository.createCampaignReference(campaignRef.campaignId) : null,
    });
    const saved = await this.shortcutsRepository.save(shortcut);
    return this.withLegacyActionConfig(saved);
  }

  /**
   * Updates an existing shortcut.
   */
  async updateForOwner(id: string, ownerId: number, dto: UpdateShortcutDto): Promise<Shortcut> {
    const shortcut = await this.findOneForOwner(id, ownerId);
    const scope = dto.scope ?? shortcut.scope;
    const targetCampaignId = dto.campaignId === undefined
      ? shortcut.campaign?.id ?? null
      : dto.campaignId;

    const campaignRef = await this.resolveCampaignReference(ownerId, scope, targetCampaignId ?? null);
    const hotkeyCandidate = dto.hotkey === undefined ? shortcut.hotkey : dto.hotkey;
    const normalizedHotkey = await this.assertHotkeyNotConflicting(
      ownerId,
      hotkeyCandidate,
      scope,
      campaignRef.campaignId,
      shortcut.id,
    );

    Object.assign(shortcut, {
      ...dto,
      scope,
      schemaVersion: dto.schemaVersion ?? shortcut.schemaVersion ?? SHORTCUT_SCHEMA_VERSION,
      description: dto.description ?? shortcut.description,
      icon: dto.icon ?? shortcut.icon,
      imageUrl: dto.imageUrl ?? shortcut.imageUrl,
      hotkey: dto.hotkey ?? shortcut.hotkey,
      normalizedHotkey,
      temporaryDurationMs: dto.temporaryDurationMs ?? shortcut.temporaryDurationMs,
      activeColor: dto.activeColor ?? shortcut.activeColor,
      inactiveColor: dto.inactiveColor ?? shortcut.inactiveColor,
      showOnHome: dto.showOnHome ?? shortcut.showOnHome,
      showInSidebarPanel: dto.showInSidebarPanel ?? shortcut.showInSidebarPanel,
      showInHotbar: dto.showInHotbar ?? shortcut.showInHotbar,
      sortOrder: dto.sortOrder ?? shortcut.sortOrder,
      sidebarPanelOrder: dto.sidebarPanelOrder ?? shortcut.sidebarPanelOrder,
      hotbarOrder: dto.hotbarOrder ?? shortcut.hotbarOrder,
      campaign: campaignRef.campaignId ? this.shortcutsRepository.createCampaignReference(campaignRef.campaignId) : null,
    });
    if (dto.actions) {
      shortcut.actions = validateAndNormalizeShortcutActions(dto.actions as any[]);
    }
    if (dto.mode && dto.mode !== 'temporary') {
      shortcut.activeUntil = null;
    }
    const saved = await this.shortcutsRepository.save(shortcut);
    return this.withLegacyActionConfig(saved);
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
    const normalized = await this.normalizeTemporaryState(saved);
    return this.withLegacyActionConfig(normalized);
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