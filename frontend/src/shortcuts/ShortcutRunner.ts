import { setActiveMapId } from '../api/campaigns/activeMap';
import { getCampaignBattleState, setCampaignBattleState } from '../api/campaigns/battleState';
import { getCampaignTimeOfDay, setCampaignTimeOfDay, type TimeOfDay } from '../api/campaigns/timeOfDay';
import { api } from '../apiBase';
import type { SfxLoopMode, SfxPlayOptions } from '../components/player/SfxPlayerContext';
import { getAuthHeaders } from '../utils/auth';
import { clamp01 } from '../utils/soundEffects';
import type { ShortcutActionDefinition, ShortcutItem, SoundEffectOption } from '../types/shortcuts';
import { dispatchWindowShortcutAction } from './ipcActions';
import { getActionPayload } from './validators';

type RunnerDeps = {
  campaignId?: string | null;
  soundEffects: SoundEffectOption[];
  shortcutName: string;
  playSfx: (
    effect: { effectId: string; name: string },
    fetchSource: () => Promise<string>,
    options?: SfxPlayOptions,
  ) => Promise<string>;
  buildEffectUrl: (effectId: string, campaignId?: string | null) => string;
  onSfxEnded?: (effectId: string, instanceId: string) => void; // called when SFX ends
};

export type ShortcutActionExecutionResult = {
  index: number;
  kind: string;
  ok: boolean;
  message?: string;
};

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const MOMENT_STEPS: TimeOfDay[] = ['dawn', 'morning', 'afternoon', 'night'];

const rotateMoment = (current: TimeOfDay | null, direction: 1 | -1): TimeOfDay => {
  const currentIndex = current ? MOMENT_STEPS.indexOf(current) : 0;
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const next = (safeIndex + direction + MOMENT_STEPS.length) % MOMENT_STEPS.length;
  return MOMENT_STEPS[next];
};

const normalizeLoopMode = (value: unknown): SfxLoopMode => {
  if (value === 'continuous' || value === 'fixed' || value === 'random' || value === 'once') {
    return value;
  }
  return 'once';
};

const runAudioAction = async (action: ShortcutActionDefinition, deps: RunnerDeps): Promise<void> => {
  const payload = getActionPayload(action);

  if (action.kind === 'playSoundEffect') {
    const effectId = typeof payload.effectId === 'string' ? payload.effectId : '';
    if (!effectId) return;
    const effectName = deps.soundEffects.find((effect) => effect.id === effectId)?.name || deps.shortcutName;
    await deps.playSfx(
      { effectId, name: effectName },
      async () => {
        const response = await api.get(deps.buildEffectUrl(effectId, deps.campaignId), {
          headers: getAuthHeaders(),
          responseType: 'blob',
        });
        return URL.createObjectURL(response.data);
      },
      {
        volume: clamp01(Number(payload.volume ?? 1)),
        loopMode: normalizeLoopMode(payload.loopMode),
        uniquePerEffect: Boolean(payload.uniquePerEffect ?? true),
        onEnded: (instanceId) => deps.onSfxEnded?.(effectId, instanceId), // call when SFX ends
      },
    );
    return;
  }

  if (action.kind.startsWith('audio.')) {
    try {
      window.dispatchEvent(new CustomEvent('shortcut:audio-action', { detail: action }));
    } catch {
      // no-op fallback
    }
  }
};

const runTimeAction = async (action: ShortcutActionDefinition, deps: RunnerDeps): Promise<void> => {
  if (!deps.campaignId) return;
  const payload = getActionPayload(action);

  if (action.kind === 'time.setMoment' && typeof payload.value === 'string') {
    await setCampaignTimeOfDay(deps.campaignId, payload.value as TimeOfDay);
    return;
  }

  if (action.kind === 'time.advanceMoment' || action.kind === 'time.rewindMoment') {
    const current = await getCampaignTimeOfDay(deps.campaignId);
    const next = rotateMoment(current, action.kind === 'time.advanceMoment' ? 1 : -1);
    await setCampaignTimeOfDay(deps.campaignId, next);
    return;
  }

  if (action.kind === 'time.advanceDay' || action.kind === 'time.rewindDay') {
    window.dispatchEvent(new CustomEvent('shortcut:calendar-action', { detail: action }));
  }
};

const runCombatAction = async (action: ShortcutActionDefinition, deps: RunnerDeps): Promise<void> => {
  if (!deps.campaignId) return;
  const state = await getCampaignBattleState(deps.campaignId);

  if (action.kind === 'combat.start') {
    await setCampaignBattleState(deps.campaignId, { started: true });
    return;
  }

  if (action.kind === 'combat.end' || action.kind === 'combat.escape') {
    await setCampaignBattleState(deps.campaignId, { started: false });
    return;
  }

  if (!state.items?.length) return;
  const size = state.items.length;
  if (action.kind === 'combat.nextTurn') {
    const nextIndex = ((state.turnIndex || 0) + 1) % size;
    await setCampaignBattleState(deps.campaignId, {
      started: true,
      turnIndex: nextIndex,
      currentTurnId: state.items[nextIndex]?.id || null,
    });
    return;
  }

  if (action.kind === 'combat.previousTurn') {
    const prevIndex = ((state.turnIndex || 0) - 1 + size) % size;
    await setCampaignBattleState(deps.campaignId, {
      started: true,
      turnIndex: prevIndex,
      currentTurnId: state.items[prevIndex]?.id || null,
    });
  }
};

const runWindowAction = async (action: ShortcutActionDefinition, deps: RunnerDeps): Promise<void> => {
  const payload = getActionPayload(action);
  if (action.kind === 'window.setActiveMap' && deps.campaignId && typeof payload.mapId === 'string') {
    await setActiveMapId(deps.campaignId, payload.mapId);
  }
  await dispatchWindowShortcutAction(action, deps.campaignId);
};

const runConfigAction = async (action: ShortcutActionDefinition): Promise<void> => {
  try {
    window.dispatchEvent(new CustomEvent('shortcut:config-action', { detail: action }));
  } catch {
    // no-op fallback
  }
};

const runAction = async (action: ShortcutActionDefinition, deps: RunnerDeps): Promise<void> => {
  if (action.delayMs && action.delayMs > 0) {
    await wait(action.delayMs);
  }

  if (action.kind === 'delay.wait') {
    const payload = getActionPayload(action);
    const delay = typeof payload.durationMs === 'number' ? payload.durationMs : 0;
    if (delay > 0) await wait(delay);
    return;
  }

  if (action.kind === 'toggleState') return;
  if (action.kind === 'playSoundEffect' || action.kind.startsWith('audio.')) {
    await runAudioAction(action, deps);
    return;
  }
  if (action.kind.startsWith('time.')) {
    await runTimeAction(action, deps);
    return;
  }
  if (action.kind.startsWith('combat.')) {
    await runCombatAction(action, deps);
    return;
  }
  if (action.kind.startsWith('window.')) {
    await runWindowAction(action, deps);
    return;
  }
  if (action.kind.startsWith('config.')) {
    await runConfigAction(action);
    return;
  }
};

/**
 * Executes shortcut actions in strict sequence.
 */
export const runShortcutActions = async (shortcut: ShortcutItem, deps: RunnerDeps): Promise<ShortcutActionExecutionResult[]> => {
  const report: ShortcutActionExecutionResult[] = [];
  const actions = shortcut.actions || [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    try {
      await runAction(action, deps);
      report.push({ index, kind: action.kind, ok: true });
    } catch (error: any) {
      report.push({
        index,
        kind: action.kind,
        ok: false,
        message: error?.message || 'Unknown shortcut action error',
      });
      throw error;
    }
  }
  return report;
};

export const runShortcutDraftActions = async (
  actions: ShortcutActionDefinition[],
  deps: Omit<RunnerDeps, 'shortcutName'> & { shortcutName?: string },
): Promise<ShortcutActionExecutionResult[]> => {
  const virtualShortcut: ShortcutItem = {
    id: 'draft',
    scope: 'campaign',
    campaignId: deps.campaignId || null,
    schemaVersion: 2,
    name: deps.shortcutName || 'Draft shortcut',
    description: null,
    icon: null,
    imageUrl: null,
    hotkey: null,
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
    actions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return runShortcutActions(virtualShortcut, {
    ...deps,
    shortcutName: virtualShortcut.name,
  });
};
