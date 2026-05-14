import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ShortcutsService } from './shortcuts.service';
import type { ShortcutsRepository } from './shortcuts.repository';

describe('ShortcutsService', () => {
  const baseShortcut = {
    id: 'shortcut-1',
    scope: 'global',
    schemaVersion: 2,
    name: 'Test',
    description: null,
    icon: null,
    imageUrl: null,
    hotkey: 'ctrl+x',
    normalizedHotkey: 'ctrl+x',
    mode: 'button',
    temporaryDurationMs: null,
    isActive: false,
    activeUntil: null,
    activeColor: null,
    inactiveColor: null,
    showOnHome: true,
    showInSidebarPanel: false,
    showInHotbar: false,
    sortOrder: 0,
    sidebarPanelOrder: 0,
    hotbarOrder: 0,
    actions: [{ kind: 'playSoundEffect', payload: { effectId: 'fx-1' } }],
    owner: { id: 10 },
    campaign: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const repositoryMock = {
    findAllByOwner: jest.fn(),
    findByIdForOwner: jest.fn(),
    findHotkeyConflict: jest.fn(),
    findCampaignById: jest.fn(),
    isCampaignMember: jest.fn(),
    createCampaignReference: jest.fn((id: string) => ({ id })),
    createOwnerReference: jest.fn((id: number) => ({ id })),
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
    remove: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<ShortcutsRepository>;

  let service: ShortcutsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShortcutsService(repositoryMock);
  });

  it('returns shortcuts with legacy config compatibility', async () => {
    repositoryMock.findAllByOwner.mockResolvedValueOnce([
      { ...baseShortcut, actions: [{ kind: 'playSoundEffect', payload: { effectId: 'fx-1' } }] } as any,
    ]);

    const result = await service.findAllForOwner(10, 'camp-1');
    expect(result[0].actions[0]).toMatchObject({
      kind: 'playSoundEffect',
      payload: { effectId: 'fx-1' },
      config: { effectId: 'fx-1' },
    });
  });

  it('throws when campaign scope is requested without campaignId', async () => {
    await expect(service.createForOwner(10, {
      name: 'A',
      scope: 'campaign',
      actions: [{ kind: 'toggleState', payload: {} } as any],
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when campaign does not exist', async () => {
    repositoryMock.findCampaignById.mockResolvedValueOnce(null);

    await expect(service.createForOwner(10, {
      name: 'A',
      scope: 'campaign',
      campaignId: 'missing-campaign',
      actions: [{ kind: 'toggleState', payload: {} } as any],
    } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when user is not campaign member', async () => {
    repositoryMock.findCampaignById.mockResolvedValueOnce({ id: 'camp-1', owner: { id: 20 } } as any);
    repositoryMock.isCampaignMember.mockResolvedValueOnce(false);

    await expect(service.createForOwner(10, {
      name: 'A',
      scope: 'campaign',
      campaignId: 'camp-1',
      actions: [{ kind: 'toggleState', payload: {} } as any],
    } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when hotkey conflicts with another shortcut', async () => {
    repositoryMock.findHotkeyConflict.mockResolvedValueOnce({ id: 'other', name: 'Other shortcut' } as any);

    await expect(service.createForOwner(10, {
      name: 'A',
      scope: 'global',
      hotkey: 'ctrl+x',
      actions: [{ kind: 'toggleState', payload: {} } as any],
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
