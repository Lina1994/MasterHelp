import { useState } from 'react';
import type { ScenePayload } from '../../../types/scenes';
import { blankDraft } from '../utils/sceneEditorUtils';

export type LeftToolPanelMode = 'media' | 'text';

export type NarrativeCanvasDraft = {
  title: string;
  text: string;
  fontSizePx: number;
  fontColor: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
};

/**
 * Groups SceneFormDialog draft-oriented state in a single hook.
 */
export function useSceneDraft(campaignId?: string | null) {
  const [draft, setDraft] = useState<ScenePayload>(blankDraft(campaignId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [chromaPickActionId, setChromaPickActionId] = useState<string | null>(null);
  const [dragOverActionId, setDragOverActionId] = useState<string | null>(null);
  const [contextualMenu, setContextualMenu] = useState<null | 'image' | 'music' | 'filter' | 'narrator'>(null);
  const [leftToolPanelMode, setLeftToolPanelMode] = useState<LeftToolPanelMode>('media');
  const [narrativeCanvasEditActionId, setNarrativeCanvasEditActionId] = useState<string | null>(null);
  const [narrativeCanvasDraft, setNarrativeCanvasDraft] = useState<NarrativeCanvasDraft | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState<boolean>(false);
  const [uploadingIcon, setUploadingIcon] = useState<boolean>(false);

  return {
    draft,
    setDraft,
    saving,
    setSaving,
    error,
    setError,
    selectedActionId,
    setSelectedActionId,
    chromaPickActionId,
    setChromaPickActionId,
    dragOverActionId,
    setDragOverActionId,
    contextualMenu,
    setContextualMenu,
    leftToolPanelMode,
    setLeftToolPanelMode,
    narrativeCanvasEditActionId,
    setNarrativeCanvasEditActionId,
    narrativeCanvasDraft,
    setNarrativeCanvasDraft,
    iconPickerOpen,
    setIconPickerOpen,
    uploadingIcon,
    setUploadingIcon,
  };
}
