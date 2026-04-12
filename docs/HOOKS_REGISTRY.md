# HOOKS_REGISTRY

Registro de hooks y sus usos detectados en frontend/src.

| Hook | Archivo | Usos | Estado | Archivos que lo usan |
| --- | --- | ---: | --- | --- |
| useBattleState | frontend/src/hooks/useBattleState.ts | 1 | EN_USO | frontend/src/components/Combat/CombatView.tsx |
| useCampaignId | frontend/src/hooks/useCampaignId.ts | 6 | EN_USO | frontend/src/components/Campaign/CampaignContext.tsx, frontend/src/components/characters/CharacterList.tsx, frontend/src/components/quests/QuestList.tsx, frontend/src/components/Worldpedia/WorldpediaImportExport.tsx, frontend/src/components/Worldpedia/WorldpediaSearchBar.tsx, frontend/src/pages/WorldpediaPage.tsx |
| useCharacterTokenImageResolver | frontend/src/hooks/useCharacterTokenImageResolver.ts | 1 | EN_USO | frontend/src/components/Map/ProjectedMapMirror.tsx |
| useCombatNotes | frontend/src/hooks/useCombatNotes.ts | 3 | EN_USO | frontend/src/components/Combat/CombatNotesBox.tsx, frontend/src/components/Combat/CombatView.tsx, frontend/src/components/Map/TokenQuickInfoPopover.tsx |
| useDeleteCampaign | frontend/src/hooks/useDeleteCampaign.ts | 1 | EN_USO | frontend/src/components/Campaign/CampaignSettingsModal.tsx |
| useEncounterAudio | frontend/src/hooks/useEncounterAudio.ts | 1 | EN_USO | frontend/src/hooks/useEncounterMusic.ts |
| useEncounterMusic | frontend/src/hooks/useEncounterMusic.ts | 1 | EN_USO | frontend/src/components/Combat/CombatView.tsx |
| useFogOfWar | frontend/src/hooks/useFogOfWar.ts | 3 | EN_USO | frontend/src/components/Map/ProjectedMapMirror.tsx, frontend/src/hooks/useOrganicFog.ts, frontend/src/pages/ProjectionMapPage.tsx |
| useInvitations | frontend/src/hooks/useInvitations.ts | 1 | EN_USO | frontend/src/pages/InvitationsList.tsx |
| useManualNames | frontend/src/hooks/useManualNames.ts | 10 | EN_USO | frontend/src/components/characters/CharacterEditorModal.tsx, frontend/src/components/characters/SpellAutocomplete.tsx, frontend/src/pages/CampaignBackgroundsPage.tsx, frontend/src/pages/CampaignBestiaryPage.tsx, frontend/src/pages/CampaignClassesPage.tsx, frontend/src/pages/CampaignFeatsPage.tsx, frontend/src/pages/CampaignRacesPage.tsx, frontend/src/pages/CampaignSkillsPage.tsx |
| useMapElements | frontend/src/hooks/useMapElements.ts | 3 | EN_USO | frontend/src/components/Map/ProjectedMapMirror.tsx, frontend/src/components/Map/WorldMapView.tsx, frontend/src/pages/ProjectionMapPage.tsx |
| useMapFogPreviewStyle | frontend/src/hooks/useMapFogPreviewStyle.ts | 1 | EN_USO | frontend/src/components/Map/ProjectedMapMirror.tsx |
| useMapSoundPlayback | frontend/src/hooks/useMapSoundPlayback.ts | 1 | EN_USO | frontend/src/components/Map/ProjectedMapMirror.tsx |
| useMapTokens | frontend/src/hooks/useMapTokens.ts | 3 | EN_USO | frontend/src/components/Combat/CombatView.tsx, frontend/src/components/Map/ProjectedMapMirror.tsx, frontend/src/pages/ProjectionMapPage.tsx |
| useOrganicFog | frontend/src/hooks/useOrganicFog.ts | 5 | EN_USO | frontend/src/components/Map/OrganicFogEditorLayer.tsx, frontend/src/components/Map/OrganicFogOverlay.tsx, frontend/src/components/Map/ProjectedMapMirror.tsx, frontend/src/hooks/useMapElements.ts, frontend/src/pages/ProjectionMapPage.tsx |
| useSecondaryWindowSizes | frontend/src/hooks/useSecondaryWindowSizes.ts | 4 | EN_USO | frontend/src/components/Combat/CombatSettingsView.tsx, frontend/src/components/Combat/CombatView.tsx, frontend/src/components/common/SecondaryWindowSizesSettings.tsx, frontend/src/pages/MapsPage.tsx |
| useSkylineInitiativeSync | frontend/src/hooks/useSkylineInitiativeSync.ts | 3 | EN_USO | frontend/src/components/Combat/CombatView.tsx, frontend/src/overlays/SkylinePreviewOverlay.tsx, frontend/src/pages/ProjectionMapPage.tsx |
| useSoundtrackMode | frontend/src/hooks/useSoundtrackMode.ts | 4 | EN_USO | frontend/src/components/Combat/CombatView.tsx, frontend/src/components/Map/MapAudioOrchestrator.tsx, frontend/src/components/soundtrack/SoundtrackSettingsCard.tsx, frontend/src/components/soundtrack/SoundtrackSettingsPanel.tsx |
| useStopSfxOnMapChange | frontend/src/hooks/useStopSfxOnMapChange.ts | 2 | EN_USO | frontend/src/components/Map/MapAudioOrchestrator.tsx, frontend/src/components/soundtrack/SoundtrackSettingsPanel.tsx |
| useTokenImageResolver | frontend/src/hooks/useTokenImageResolver.ts | 1 | EN_USO | frontend/src/pages/ProjectionMapPage.tsx |
| useTurnOrder | frontend/src/hooks/useTurnOrder.ts | 2 | EN_USO | frontend/src/components/Combat/CombatView.tsx, frontend/src/overlays/SkylinePreviewOverlay.tsx |
