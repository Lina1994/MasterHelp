import { useRef, useState } from 'react';
import type { SceneVideoAsset } from '../../../types/scenes';

/**
 * Groups video-library related state used by SceneFormDialog.
 */
export function useSceneVideoLibrary() {
  const [sceneVideoAssets, setSceneVideoAssets] = useState<SceneVideoAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoPreviewUrlsByActionId, setVideoPreviewUrlsByActionId] = useState<Record<string, string>>({});
  const [videoPreviewErrorsByActionId, setVideoPreviewErrorsByActionId] = useState<Record<string, string>>({});
  const [videoLibraryQuery, setVideoLibraryQuery] = useState<string>('');
  const [renamingVideoId, setRenamingVideoId] = useState<string | null>(null);
  const [renamingVideoName, setRenamingVideoName] = useState<string>('');
  const [renamingVideoSubmitting, setRenamingVideoSubmitting] = useState<boolean>(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [derivingClipActionId, setDerivingClipActionId] = useState<string | null>(null);
  const [derivingClipErrorByActionId, setDerivingClipErrorByActionId] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signedVideoUrlCacheRef = useRef<Map<string, { url: string; expiresAtMs: number }>>(new Map());

  return {
    sceneVideoAssets,
    setSceneVideoAssets,
    loadingAssets,
    setLoadingAssets,
    uploadingVideo,
    setUploadingVideo,
    videoPreviewUrlsByActionId,
    setVideoPreviewUrlsByActionId,
    videoPreviewErrorsByActionId,
    setVideoPreviewErrorsByActionId,
    videoLibraryQuery,
    setVideoLibraryQuery,
    renamingVideoId,
    setRenamingVideoId,
    renamingVideoName,
    setRenamingVideoName,
    renamingVideoSubmitting,
    setRenamingVideoSubmitting,
    deletingVideoId,
    setDeletingVideoId,
    derivingClipActionId,
    setDerivingClipActionId,
    derivingClipErrorByActionId,
    setDerivingClipErrorByActionId,
    fileInputRef,
    signedVideoUrlCacheRef,
  };
}
