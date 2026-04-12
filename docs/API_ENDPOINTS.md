# API_ENDPOINTS

Registro de endpoints backend y funciones API frontend.

## Backend (controllers)

| Modulo | Metodo | Ruta | Handler | Archivo |
| --- | --- | --- | --- | --- |
| affinity-links | DELETE | /affinity-links/:id | remove | backend/src/characters/affinity-links.controller.ts |
| affinity-links | PATCH | /affinity-links/:id | update | backend/src/characters/affinity-links.controller.ts |
| affinity-links | GET | /affinity-links | list | backend/src/characters/affinity-links.controller.ts |
| affinity-links | POST | /affinity-links | create | backend/src/characters/affinity-links.controller.ts |
| auth | PUT | /auth/change-password | ApiBearerAuth | backend/src/auth/auth.controller.ts |
| auth | POST | /auth/forgot-password | forgotPassword | backend/src/auth/auth.controller.ts |
| auth | POST | /auth/login | login | backend/src/auth/auth.controller.ts |
| auth | POST | /auth/register | register | backend/src/auth/auth.controller.ts |
| auth | POST | /auth/reset-password | resetPassword | backend/src/auth/auth.controller.ts |
| backgrounds | DELETE | /campaigns/:campaignId/backgrounds/:backgroundId | deleteCampaignBackground | backend/src/backgrounds/backgrounds.controller.ts |
| backgrounds | GET | /campaigns/:campaignId/backgrounds/:backgroundId | getCampaignBackground | backend/src/backgrounds/backgrounds.controller.ts |
| backgrounds | PATCH | /campaigns/:campaignId/backgrounds/:backgroundId | updateCampaignBackground | backend/src/backgrounds/backgrounds.controller.ts |
| backgrounds | POST | /campaigns/:campaignId/backgrounds/copy/:manualId/:backgroundId | copyBackgroundFromManual | backend/src/backgrounds/backgrounds.controller.ts |
| backgrounds | GET | /campaigns/:campaignId/backgrounds | listCampaignBackgrounds | backend/src/backgrounds/backgrounds.controller.ts |
| backgrounds | POST | /campaigns/:campaignId/backgrounds | createCampaignBackground | backend/src/backgrounds/backgrounds.controller.ts |
| monsters | DELETE | /campaigns/:campaignId/bestiary/:monsterId | deleteCampaignMonster | backend/src/monsters/monsters.controller.ts |
| monsters | GET | /campaigns/:campaignId/bestiary/:monsterId | getCampaignMonster | backend/src/monsters/monsters.controller.ts |
| monsters | PATCH | /campaigns/:campaignId/bestiary/:monsterId | updateCampaignMonster | backend/src/monsters/monsters.controller.ts |
| monsters | POST | /campaigns/:campaignId/bestiary/copy/:manualId/:slug | copyFromManual | backend/src/monsters/monsters.controller.ts |
| monsters | GET | /campaigns/:campaignId/bestiary | listCampaignMonsters | backend/src/monsters/monsters.controller.ts |
| monsters | POST | /campaigns/:campaignId/bestiary | createCampaignMonster | backend/src/monsters/monsters.controller.ts |
| classes | DELETE | /campaigns/:campaignId/classes/:classId | deleteCampaignClass | backend/src/classes/classes.controller.ts |
| classes | GET | /campaigns/:campaignId/classes/:classId | getCampaignClass | backend/src/classes/classes.controller.ts |
| classes | PATCH | /campaigns/:campaignId/classes/:classId | updateCampaignClass | backend/src/classes/classes.controller.ts |
| classes | POST | /campaigns/:campaignId/classes/copy/:manualId/:classId | copyClassFromManual | backend/src/classes/classes.controller.ts |
| classes | GET | /campaigns/:campaignId/classes | listCampaignClasses | backend/src/classes/classes.controller.ts |
| classes | POST | /campaigns/:campaignId/classes | createCampaignClass | backend/src/classes/classes.controller.ts |
| encounters | DELETE | /campaigns/:campaignId/encounters/:id | remove | backend/src/encounters/encounters.controller.ts |
| encounters | PATCH | /campaigns/:campaignId/encounters/:id | update | backend/src/encounters/encounters.controller.ts |
| encounters | GET | /campaigns/:campaignId/encounters | list | backend/src/encounters/encounters.controller.ts |
| encounters | POST | /campaigns/:campaignId/encounters | create | backend/src/encounters/encounters.controller.ts |
| feats | DELETE | /campaigns/:campaignId/feats/:featId | deleteCampaignFeat | backend/src/feats/feats.controller.ts |
| feats | GET | /campaigns/:campaignId/feats/:featId | getCampaignFeat | backend/src/feats/feats.controller.ts |
| feats | PATCH | /campaigns/:campaignId/feats/:featId | updateCampaignFeat | backend/src/feats/feats.controller.ts |
| feats | POST | /campaigns/:campaignId/feats/copy/:manualId/:featId | copyFeatFromManual | backend/src/feats/feats.controller.ts |
| feats | GET | /campaigns/:campaignId/feats | listCampaignFeats | backend/src/feats/feats.controller.ts |
| feats | POST | /campaigns/:campaignId/feats | createCampaignFeat | backend/src/feats/feats.controller.ts |
| campaigns | DELETE | /campaigns/:campaignId/player/:playerId | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| races | DELETE | /campaigns/:campaignId/races/:raceId | deleteCampaignRace | backend/src/races/races.controller.ts |
| races | GET | /campaigns/:campaignId/races/:raceId | getCampaignRace | backend/src/races/races.controller.ts |
| races | PATCH | /campaigns/:campaignId/races/:raceId | updateCampaignRace | backend/src/races/races.controller.ts |
| races | POST | /campaigns/:campaignId/races/copy/:manualId/:raceId | copyRaceFromManual | backend/src/races/races.controller.ts |
| races | GET | /campaigns/:campaignId/races | listCampaignRaces | backend/src/races/races.controller.ts |
| races | POST | /campaigns/:campaignId/races | createCampaignRace | backend/src/races/races.controller.ts |
| skills | DELETE | /campaigns/:campaignId/skills/:skillId | deleteCampaignSkill | backend/src/skills/skills.controller.ts |
| skills | GET | /campaigns/:campaignId/skills/:skillId | getCampaignSkill | backend/src/skills/skills.controller.ts |
| skills | PATCH | /campaigns/:campaignId/skills/:skillId | updateCampaignSkill | backend/src/skills/skills.controller.ts |
| skills | POST | /campaigns/:campaignId/skills/copy/:manualId/:skillId | copySkillFromManual | backend/src/skills/skills.controller.ts |
| skills | GET | /campaigns/:campaignId/skills | listCampaignSkills | backend/src/skills/skills.controller.ts |
| skills | POST | /campaigns/:campaignId/skills | createCampaignSkill | backend/src/skills/skills.controller.ts |
| spells | DELETE | /campaigns/:campaignId/spells/:spellId | deleteCampaignSpell | backend/src/spells/spells.controller.ts |
| spells | GET | /campaigns/:campaignId/spells/:spellId | getCampaignSpell | backend/src/spells/spells.controller.ts |
| spells | PATCH | /campaigns/:campaignId/spells/:spellId | updateCampaignSpell | backend/src/spells/spells.controller.ts |
| spells | POST | /campaigns/:campaignId/spells/copy/:manualId/:spellId | copySpellFromManual | backend/src/spells/spells.controller.ts |
| spells | GET | /campaigns/:campaignId/spells/export | exportSpells | backend/src/spells/spells.controller.ts |
| spells | POST | /campaigns/:campaignId/spells/import | UseInterceptors | backend/src/spells/spells.controller.ts |
| spells | GET | /campaigns/:campaignId/spells | listCampaignSpells | backend/src/spells/spells.controller.ts |
| spells | POST | /campaigns/:campaignId/spells | createCampaignSpell | backend/src/spells/spells.controller.ts |
| traits | DELETE | /campaigns/:campaignId/traits/:traitId | deleteCampaignTrait | backend/src/traits/traits.controller.ts |
| traits | GET | /campaigns/:campaignId/traits/:traitId | getCampaignTrait | backend/src/traits/traits.controller.ts |
| traits | PATCH | /campaigns/:campaignId/traits/:traitId | updateCampaignTrait | backend/src/traits/traits.controller.ts |
| traits | POST | /campaigns/:campaignId/traits/copy/:manualId/:traitId | copyTraitFromManual | backend/src/traits/traits.controller.ts |
| traits | GET | /campaigns/:campaignId/traits | listCampaignTraits | backend/src/traits/traits.controller.ts |
| traits | POST | /campaigns/:campaignId/traits | createCampaignTrait | backend/src/traits/traits.controller.ts |
| campaigns | GET | /campaigns/:id/active-encounter | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/active-encounter | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/active-map | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/active-map | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/active-skyline-character | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/active-skyline-character | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/battle-state | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/battle-state | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/default-skyline/exists | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | DELETE | /campaigns/:id/default-skyline | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/default-skyline | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | POST | /campaigns/:id/default-skyline | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/fog-of-war | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/fog-of-war | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/grid-overlay | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/grid-overlay | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | POST | /campaigns/:id/invite | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/manuals | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/manuals | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | DELETE | /campaigns/:id/skyline-items | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/skyline-items | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | POST | /campaigns/:id/skyline-items | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/skyline-overlay | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/skyline-overlay | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/soundtrack-settings | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/soundtrack-settings | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id/time-of-day | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id/time-of-day | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | DELETE | /campaigns/:id | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/:id | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | PATCH | /campaigns/:id | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | POST | /campaigns/invitation/respond | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/invitations/pending | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/projection/:id/battle-state | getBattleStatePublic | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/projection/:id/default-skyline/exists | hasDefaultSkylinePublic | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/projection/:id/default-skyline | getDefaultSkylinePublic | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/projection/:id/participant-monster-map | getParticipantMonsterMapPublic | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns/projection/:id/skyline-overlay | getSkylineOverlayPublic | backend/src/campaigns/campaigns.controller.ts |
| campaigns | DELETE | /campaigns/skyline-items/:itemId | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | GET | /campaigns | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| campaigns | POST | /campaigns | UseGuards | backend/src/campaigns/campaigns.controller.ts |
| characters | DELETE | /characters/:id | remove | backend/src/characters/characters.controller.ts |
| characters | GET | /characters/:id | get | backend/src/characters/characters.controller.ts |
| characters | PATCH | /characters/:id | update | backend/src/characters/characters.controller.ts |
| characters | GET | /characters | list | backend/src/characters/characters.controller.ts |
| characters | POST | /characters | create | backend/src/characters/characters.controller.ts |
| custom-manuals | DELETE | /custom-manuals/:id/cover | HttpCode | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | GET | /custom-manuals/:id/cover | getCover | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | POST | /custom-manuals/:id/cover | UseInterceptors | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | DELETE | /custom-manuals/:id/entries/:entryId | HttpCode | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | GET | /custom-manuals/:id/entries/:entryId | getEntry | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | PATCH | /custom-manuals/:id/entries/:entryId | updateEntry | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | GET | /custom-manuals/:id/entries | getEntries | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | POST | /custom-manuals/:id/entries | addEntry | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | GET | /custom-manuals/:id/export | exportManual | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | DELETE | /custom-manuals/:id | HttpCode | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | GET | /custom-manuals/:id | findOne | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | PATCH | /custom-manuals/:id | update | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | POST | /custom-manuals/import | importManual | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | GET | /custom-manuals | findAll | backend/src/manuals/custom-manuals.controller.ts |
| custom-manuals | POST | /custom-manuals | create | backend/src/manuals/custom-manuals.controller.ts |
| diary | PATCH | /diary/campaigns/:campaignId/calendar/current-day | updateCurrentDay | backend/src/diary/diary.controller.ts |
| diary | GET | /diary/campaigns/:campaignId/calendar | getCalendar | backend/src/diary/diary.controller.ts |
| diary | PATCH | /diary/campaigns/:campaignId/calendar | updateCalendar | backend/src/diary/diary.controller.ts |
| diary | GET | /diary/campaigns/:campaignId/entries/:year/:monthIndex/:dayIndex | getEntry | backend/src/diary/diary.controller.ts |
| diary | GET | /diary/campaigns/:campaignId/entries/by-id/:id | getEntryById | backend/src/diary/diary.controller.ts |
| diary | POST | /diary/campaigns/:campaignId/entries/upsert | upsertEntry | backend/src/diary/diary.controller.ts |
| diary | GET | /diary/campaigns/:campaignId/entries | listEntries | backend/src/diary/diary.controller.ts |
| diary | POST | /diary/campaigns/:campaignId/sessions/:sessionId/end | endSession | backend/src/diary/diary.controller.ts |
| diary | POST | /diary/campaigns/:campaignId/sessions/:sessionId/visit-day | visitDay | backend/src/diary/diary.controller.ts |
| diary | DELETE | /diary/campaigns/:campaignId/sessions/:sessionId | HttpCode | backend/src/diary/diary.controller.ts |
| diary | PATCH | /diary/campaigns/:campaignId/sessions/:sessionId | updateSession | backend/src/diary/diary.controller.ts |
| diary | GET | /diary/campaigns/:campaignId/sessions/active | getActiveSession | backend/src/diary/diary.controller.ts |
| diary | POST | /diary/campaigns/:campaignId/sessions/start | startSession | backend/src/diary/diary.controller.ts |
| diary | GET | /diary/campaigns/:campaignId/sessions | listSessions | backend/src/diary/diary.controller.ts |
| diary | POST | /diary/campaigns/:campaignId/sessions | createSession | backend/src/diary/diary.controller.ts |
| backgrounds | GET | /manuals/:manualId/backgrounds/:id | getForManual | backend/src/backgrounds/backgrounds.controller.ts |
| backgrounds | GET | /manuals/:manualId/backgrounds | listForManual | backend/src/backgrounds/backgrounds.controller.ts |
| classes | GET | /manuals/:manualId/classes/:id | get | backend/src/classes/classes.controller.ts |
| classes | GET | /manuals/:manualId/classes | list | backend/src/classes/classes.controller.ts |
| feats | GET | /manuals/:manualId/feats/:id | getForManual | backend/src/feats/feats.controller.ts |
| feats | GET | /manuals/:manualId/feats | listForManual | backend/src/feats/feats.controller.ts |
| monsters | GET | /manuals/:manualId/monsters/:slug | get | backend/src/monsters/monsters.controller.ts |
| monsters | GET | /manuals/:manualId/monsters | list | backend/src/monsters/monsters.controller.ts |
| races | GET | /manuals/:manualId/races/:id | getForManual | backend/src/races/races.controller.ts |
| races | GET | /manuals/:manualId/races | listForManual | backend/src/races/races.controller.ts |
| manuals | GET | /manuals/:manualId/search | search | backend/src/manuals/manuals.controller.ts |
| manuals | GET | /manuals/:manualId/sections/:nodeId | section | backend/src/manuals/manuals.controller.ts |
| skills | GET | /manuals/:manualId/skills/:id | getForManual | backend/src/skills/skills.controller.ts |
| skills | GET | /manuals/:manualId/skills | listForManual | backend/src/skills/skills.controller.ts |
| spells | GET | /manuals/:manualId/spells/:id | getForManual | backend/src/spells/spells.controller.ts |
| spells | GET | /manuals/:manualId/spells/meta/all | metaForManual | backend/src/spells/spells.controller.ts |
| spells | GET | /manuals/:manualId/spells | listForManual | backend/src/spells/spells.controller.ts |
| manuals | GET | /manuals/:manualId/toc | toc | backend/src/manuals/manuals.controller.ts |
| traits | GET | /manuals/:manualId/traits/:id | getForManual | backend/src/traits/traits.controller.ts |
| traits | GET | /manuals/:manualId/traits | listForManual | backend/src/traits/traits.controller.ts |
| manuals | GET | /manuals | UseGuards | backend/src/manuals/manuals.controller.ts |
| maps | GET | /maps/:id/elements | getElements | backend/src/maps/maps.controller.ts |
| maps | PATCH | /maps/:id/elements | setElements | backend/src/maps/maps.controller.ts |
| maps | GET | /maps/:id/fog | getFog | backend/src/maps/maps.controller.ts |
| maps | PATCH | /maps/:id/fog | setFog | backend/src/maps/maps.controller.ts |
| maps | GET | /maps/:id/image | streamImage | backend/src/maps/maps.controller.ts |
| maps | POST | /maps/:id/image | UseInterceptors | backend/src/maps/maps.controller.ts |
| maps | POST | /maps/:id/import | importMap | backend/src/maps/maps.controller.ts |
| maps | DELETE | /maps/:id/markers/:markerId | deleteMarker | backend/src/maps/maps.controller.ts |
| maps | PATCH | /maps/:id/markers/:markerId | updateMarker | backend/src/maps/maps.controller.ts |
| maps | GET | /maps/:id/markers | listMarkers | backend/src/maps/maps.controller.ts |
| maps | POST | /maps/:id/markers | createMarker | backend/src/maps/maps.controller.ts |
| maps | GET | /maps/:id/organic-fog | getOrganicFog | backend/src/maps/maps.controller.ts |
| maps | PATCH | /maps/:id/organic-fog | setOrganicFog | backend/src/maps/maps.controller.ts |
| maps | PATCH | /maps/:id/prepared | togglePrepared | backend/src/maps/maps.controller.ts |
| maps | GET | /maps/:id/skyline | streamSkyline | backend/src/maps/maps.controller.ts |
| maps | POST | /maps/:id/skyline | UseInterceptors | backend/src/maps/maps.controller.ts |
| maps | GET | /maps/:id/tokens | getTokens | backend/src/maps/maps.controller.ts |
| maps | PATCH | /maps/:id/tokens | setTokens | backend/src/maps/maps.controller.ts |
| maps | DELETE | /maps/:id | remove | backend/src/maps/maps.controller.ts |
| maps | PATCH | /maps/:id | UseInterceptors | backend/src/maps/maps.controller.ts |
| maps | POST | /maps/bulk | UseInterceptors | backend/src/maps/maps.controller.ts |
| maps | GET | /maps/other-campaigns | listOtherCampaigns | backend/src/maps/maps.controller.ts |
| maps | GET | /maps/usage | getUsage | backend/src/maps/maps.controller.ts |
| maps | GET | /maps | list | backend/src/maps/maps.controller.ts |
| maps | POST | /maps | UseInterceptors | backend/src/maps/maps.controller.ts |
| network-info | GET | /network-info | getNetworkInfo | backend/src/network-info/network-info.controller.ts |
| quests | DELETE | /quests/:id | remove | backend/src/quests/quests.controller.ts |
| quests | GET | /quests/:id | get | backend/src/quests/quests.controller.ts |
| quests | PATCH | /quests/:id | update | backend/src/quests/quests.controller.ts |
| quests | GET | /quests | list | backend/src/quests/quests.controller.ts |
| quests | POST | /quests | create | backend/src/quests/quests.controller.ts |
| shops | POST | /shops/:shopId/sections | createSection | backend/src/shops/shops.controller.ts |
| shops | DELETE | /shops/:shopId | deleteShop | backend/src/shops/shops.controller.ts |
| shops | GET | /shops/:shopId | getShop | backend/src/shops/shops.controller.ts |
| shops | PATCH | /shops/:shopId | updateShop | backend/src/shops/shops.controller.ts |
| shops | GET | /shops/cells/:cellId/stream | streamCell | backend/src/shops/shops.controller.ts |
| shops | PATCH | /shops/cells/:cellId/text | updateCellText | backend/src/shops/shops.controller.ts |
| shops | DELETE | /shops/columns/:columnId | deleteColumn | backend/src/shops/shops.controller.ts |
| shops | PATCH | /shops/columns/:columnId | updateColumn | backend/src/shops/shops.controller.ts |
| shops | POST | /shops/entries/:entryId/cells/:columnId/media | UseInterceptors | backend/src/shops/shops.controller.ts |
| shops | DELETE | /shops/entries/:entryId | deleteEntry | backend/src/shops/shops.controller.ts |
| shops | PATCH | /shops/entries/:entryId | updateEntry | backend/src/shops/shops.controller.ts |
| shops | GET | /shops/search | searchEntries | backend/src/shops/shops.controller.ts |
| shops | POST | /shops/sections/:sectionId/columns | createColumn | backend/src/shops/shops.controller.ts |
| shops | POST | /shops/sections/:sectionId/entries | createEntry | backend/src/shops/shops.controller.ts |
| shops | DELETE | /shops/sections/:sectionId | deleteSection | backend/src/shops/shops.controller.ts |
| shops | PATCH | /shops/sections/:sectionId | updateSection | backend/src/shops/shops.controller.ts |
| shops | GET | /shops | listShops | backend/src/shops/shops.controller.ts |
| shops | POST | /shops | createShop | backend/src/shops/shops.controller.ts |
| soundtrack | GET | /soundtrack/campaigns/:campaignId/filters | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | DELETE | /soundtrack/campaigns/:campaignId/history | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | GET | /soundtrack/campaigns/:campaignId/history | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | GET | /soundtrack/campaigns/:campaignId/now-playing | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | DELETE | /soundtrack/campaigns/:campaignId/playlists/:playlistId | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | PATCH | /soundtrack/campaigns/:campaignId/playlists/:playlistId | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | GET | /soundtrack/campaigns/:campaignId/playlists | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | POST | /soundtrack/campaigns/:campaignId/playlists | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | GET | /soundtrack/campaigns/:campaignId/songs | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundeffects | DELETE | /soundtrack/effects/:id/associate/:campaignId | unassociate | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundeffects | POST | /soundtrack/effects/:id/associate | associate | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundeffects | POST | /soundtrack/effects/:id/played | markPlayed | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundeffects | GET | /soundtrack/effects/:id/stream | stream | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundeffects | DELETE | /soundtrack/effects/:id | remove | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundeffects | PATCH | /soundtrack/effects/:id | update | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundeffects | GET | /soundtrack/effects/campaigns/:campaignId | listForCampaign | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundeffects | GET | /soundtrack/effects | listOwned | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundeffects | POST | /soundtrack/effects | UseInterceptors | backend/src/soundtrack/soundeffects/soundeffects.controller.ts |
| soundtrack | GET | /soundtrack/filters | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundpresets | PATCH | /soundtrack/presets/:presetId | update | backend/src/soundtrack/soundeffects/soundpresets.controller.ts |
| soundpresets | DELETE | /soundtrack/presets/campaigns/:campaignId/:presetId | remove | backend/src/soundtrack/soundeffects/soundpresets.controller.ts |
| soundpresets | GET | /soundtrack/presets/campaigns/:campaignId | list | backend/src/soundtrack/soundeffects/soundpresets.controller.ts |
| soundpresets | POST | /soundtrack/presets | create | backend/src/soundtrack/soundeffects/soundpresets.controller.ts |
| soundtrack | GET | /soundtrack/projection/campaigns/:campaignId/now-playing | getNowPlayingPublic | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | DELETE | /soundtrack/songs/:songId/associate/:campaignId | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | POST | /soundtrack/songs/:songId/associate | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | POST | /soundtrack/songs/:songId/played | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | GET | /soundtrack/songs/:songId/stream | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | DELETE | /soundtrack/songs/:songId | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | PATCH | /soundtrack/songs/:songId | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | GET | /soundtrack/songs | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | POST | /soundtrack/songs | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| soundtrack | GET | /soundtrack/usage | UseGuards | backend/src/soundtrack/soundtrack.controller.ts |
| spells | GET | /spells/:id | get | backend/src/spells/spells.controller.ts |
| spells | GET | /spells/meta/all | meta | backend/src/spells/spells.controller.ts |
| spells | GET | /spells | list | backend/src/spells/spells.controller.ts |
| users | GET | /users/:id | findOne | backend/src/users/users.controller.ts |
| users | PATCH | /users/me/preferences | UseGuards | backend/src/users/users.controller.ts |
| users | DELETE | /users/me | UseGuards | backend/src/users/users.controller.ts |
| users | GET | /users/me | UseGuards | backend/src/users/users.controller.ts |
| worldpedia | GET | /worldpedia/campaigns/:campaignId/export/folders/:folderId | exportFolder | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | GET | /worldpedia/campaigns/:campaignId/export/notes/:noteId | exportNote | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | GET | /worldpedia/campaigns/:campaignId/export | exportAll | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | DELETE | /worldpedia/campaigns/:campaignId/folders/:folderId | HttpCode | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | PATCH | /worldpedia/campaigns/:campaignId/folders/:folderId | updateFolder | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | POST | /worldpedia/campaigns/:campaignId/folders | createFolder | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | POST | /worldpedia/campaigns/:campaignId/import | importData | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | GET | /worldpedia/campaigns/:campaignId/notes/:noteId/links | getNoteLinks | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | PATCH | /worldpedia/campaigns/:campaignId/notes/:noteId/move | moveNote | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | DELETE | /worldpedia/campaigns/:campaignId/notes/:noteId | HttpCode | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | GET | /worldpedia/campaigns/:campaignId/notes/:noteId | getNote | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | PATCH | /worldpedia/campaigns/:campaignId/notes/:noteId | updateNote | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | POST | /worldpedia/campaigns/:campaignId/notes | createNote | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | PATCH | /worldpedia/campaigns/:campaignId/reorder | reorder | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | GET | /worldpedia/campaigns/:campaignId/search | search | backend/src/worldpedia/worldpedia.controller.ts |
| worldpedia | GET | /worldpedia/campaigns/:campaignId/tree | getTree | backend/src/worldpedia/worldpedia.controller.ts |

## Frontend (api clients)

| Archivo | Funciones exportadas | Endpoints detectados |
| --- | --- | --- |
| frontend/src/api/affinityLinks/index.ts | listAffinityLinks, createAffinityLink, updateAffinityLink, deleteAffinityLink | GET /affinity-links, POST /affinity-links, PATCH /affinity-links/${id}, DELETE /affinity-links/${id} |
| frontend/src/api/backgrounds/backgroundsApi.ts | listCampaignBackgrounds, getCampaignBackground, createCampaignBackground, updateCampaignBackground, deleteCampaignBackground, copyBackgroundFromManual | GET /campaigns/${campaignId}/backgrounds, GET /campaigns/${campaignId}/backgrounds/${backgroundId}, POST /campaigns/${campaignId}/backgrounds, PATCH /campaigns/${campaignId}/backgrounds/${backgroundId}, DELETE /campaigns/${campaignId}/backgrounds/${backgroundId}, POST /campaigns/${campaignId}/backgrounds/copy/${manualId}/${backgroundId} |
| frontend/src/api/bestiary/bestiaryApi.ts | listCampaignMonsters, getCampaignMonster, createCampaignMonster, updateCampaignMonster, deleteCampaignMonster, copyMonsterFromManual | GET /campaigns/${campaignId}/bestiary, GET /campaigns/${campaignId}/bestiary/${monsterId}, POST /campaigns/${campaignId}/bestiary, PATCH /campaigns/${campaignId}/bestiary/${monsterId}, DELETE /campaigns/${campaignId}/bestiary/${monsterId}, POST /campaigns/${campaignId}/bestiary/copy/${manualId}/${slug} |
| frontend/src/api/campaigns/activeEncounter.ts | getActiveEncounterId, setActiveEncounterId | PATCH /campaigns/${campaignId}/active-encounter |
| frontend/src/api/campaigns/activeMap.ts | getActiveMapId, setActiveMapId | PATCH /campaigns/${campaignId}/active-map |
| frontend/src/api/campaigns/activeSkylineCharacter.ts | getActiveSkylineCharacterId, setActiveSkylineCharacterId | PATCH /campaigns/${campaignId}/active-skyline-character |
| frontend/src/api/campaigns/battleState.ts | getCampaignBattleState, getCampaignBattleStatePublic, setCampaignBattleState, getParticipantMonsterMapPublic | PATCH /campaigns/${campaignId}/battle-state |
| frontend/src/api/campaigns/defaultSkyline.ts | uploadDefaultSkyline, getDefaultSkylineUrl, getDefaultSkylinePublicUrl, hasDefaultSkyline, hasDefaultSkylinePublic, deleteDefaultSkyline |  |
| frontend/src/api/campaigns/deleteCampaign.ts | deleteCampaign | DELETE /campaigns/${campaignId} |
| frontend/src/api/campaigns/fogOfWar.ts | getFogOfWarSettings, setFogOfWarSettings | PATCH /campaigns/${campaignId}/fog-of-war |
| frontend/src/api/campaigns/gridOverlay.ts | getGridOverlaySettings, setGridOverlaySettings | PATCH /campaigns/${campaignId}/grid-overlay |
| frontend/src/api/campaigns/manuals.ts | getCampaignManuals, setCampaignManuals | PATCH /campaigns/${campaignId}/manuals |
| frontend/src/api/campaigns/skylineItems.ts | getSkylineItems, addSkylineItem, removeSkylineItem, clearSkylineItems | DELETE /campaigns/skyline-items/${itemId}, DELETE /campaigns/${campaignId}/skyline-items |
| frontend/src/api/campaigns/skylineOverlay.ts | getSkylineOverlaySettings, getSkylineOverlaySettingsPublic, setSkylineOverlaySettings | PATCH /campaigns/${campaignId}/skyline-overlay |
| frontend/src/api/campaigns/soundtrackSettings.ts | getSoundtrackSettings, setSoundtrackSettings | PATCH /campaigns/${campaignId}/soundtrack-settings |
| frontend/src/api/campaigns/timeOfDay.ts | getCampaignTimeOfDay, setCampaignTimeOfDay | PATCH /campaigns/${campaignId}/time-of-day |
| frontend/src/api/characters/index.ts | listCharacters, createCharacter, updateCharacter, deleteCharacter, getCharacter | GET /characters, POST /characters, PATCH /characters/${id}, DELETE /characters/${id}, GET /characters/${id} |
| frontend/src/api/classes/classesApi.ts | listCampaignClasses, getCampaignClass, createCampaignClass, updateCampaignClass, deleteCampaignClass, copyClassFromManual | GET /campaigns/${campaignId}/classes, GET /campaigns/${campaignId}/classes/${classId}, POST /campaigns/${campaignId}/classes, PATCH /campaigns/${campaignId}/classes/${classId}, DELETE /campaigns/${campaignId}/classes/${classId}, POST /campaigns/${campaignId}/classes/copy/${manualId}/${classId} |
| frontend/src/api/customManuals.ts | listCustomManuals, createManual, getManual, updateManual, deleteManual, listEntries, createEntry, getEntry, updateEntry, deleteEntry, exportManual, downloadManualExport, importManual, uploadManualCover, removeManualCover, getManualCoverUrl | DELETE /custom-manuals/${id}, DELETE /custom-manuals/${manualId}/entries/${entryId}, POST /custom-manuals/${manualId}/cover, DELETE /custom-manuals/${manualId}/cover |
| frontend/src/api/diary/diaryApi.ts | getDiaryCalendar, updateDiaryCalendar, updateCurrentDay, getDiaryEntry, upsertDiaryEntry, listDiarySessions, listAllDiaryEntries, getDiaryEntryById, getActiveDiarySession, startDiarySession, endDiarySession, visitDiaryDay, updateDiarySession, deleteDiarySession | DELETE /diary/campaigns/${campaignId}/sessions/${sessionId} |
| frontend/src/api/encounters.ts | listEncounters, createEncounter, updateEncounter, deleteEncounter | GET /campaigns/${campaignId}/encounters, POST /campaigns/${campaignId}/encounters, PATCH /campaigns/${campaignId}/encounters/${encounterId}, DELETE /campaigns/${campaignId}/encounters/${encounterId} |
| frontend/src/api/feats/featsApi.ts | listCampaignFeats, getCampaignFeat, createCampaignFeat, updateCampaignFeat, deleteCampaignFeat, copyFeatFromManual | GET /campaigns/${campaignId}/feats, GET /campaigns/${campaignId}/feats/${featId}, POST /campaigns/${campaignId}/feats, PATCH /campaigns/${campaignId}/feats/${featId}, DELETE /campaigns/${campaignId}/feats/${featId}, POST /campaigns/${campaignId}/feats/copy/${manualId}/${featId} |
| frontend/src/api/mapElements.ts | getMapElements, setMapElements |  |
| frontend/src/api/maps.ts | listMaps, createMap, updateMap, deleteMap, toggleMapPrepared, getMapImageUrl, getMapImageUrlSized, getMapSkylineUrl, getMapSkylineUrlSized, uploadMapSkylineForTod, hasMapSkylineForTod, createMapsBulk, getMapsUsage, uploadMapImageForTod, hasMapImageForTod, getMapTokens, setMapTokens, listMapMarkers, createMapMarker, updateMapMarker, deleteMapMarker, listOtherCampaignMaps, importMapToCampaign | GET /maps/${id}/skyline, GET /maps/${id}/image |
| frontend/src/api/monsters.ts | fetchMonsters, fetchMonster | GET /manuals/${manualId}/monsters, GET /manuals/${manualId}/monsters/${slug} |
| frontend/src/api/quests/index.ts | listQuests, getQuest, createQuest, updateQuest, deleteQuest | GET /quests, GET /quests/${id}, POST /quests, PATCH /quests/${id}, DELETE /quests/${id} |
| frontend/src/api/races/racesApi.ts | listCampaignRaces, getCampaignRace, createCampaignRace, updateCampaignRace, deleteCampaignRace, copyRaceFromManual | GET /campaigns/${campaignId}/races, GET /campaigns/${campaignId}/races/${raceId}, POST /campaigns/${campaignId}/races, PATCH /campaigns/${campaignId}/races/${raceId}, DELETE /campaigns/${campaignId}/races/${raceId}, POST /campaigns/${campaignId}/races/copy/${manualId}/${raceId} |
| frontend/src/api/shops.ts | listShops, getShop, createShop, updateShop, deleteShop, createSection, updateSection, deleteSection, createColumn, updateColumn, deleteColumn, createEntry, updateEntry, deleteEntry, uploadCellMedia, updateCellText, getCellStreamUrl, searchEntries | GET /shops?campaignId=${campaignId}, GET /shops/${shopId}, POST /shops, PATCH /shops/${shopId}, DELETE /shops/${shopId}, POST /shops/${shopId}/sections, PATCH /shops/sections/${sectionId}, DELETE /shops/sections/${sectionId}, POST /shops/sections/${sectionId}/columns, PATCH /shops/columns/${columnId}, DELETE /shops/columns/${columnId}, POST /shops/sections/${sectionId}/entries, PATCH /shops/entries/${entryId}, DELETE /shops/entries/${entryId}, POST /shops/entries/${entryId}/cells/${columnId}/media, PATCH /shops/cells/${cellId}/text, GET /shops/search?campaignId=${campaignId}&q=${encodeURIComponent(query)} |
| frontend/src/api/shopsApi.ts |  |  |
| frontend/src/api/skills/skillsApi.ts | listCampaignSkills, getCampaignSkill, createCampaignSkill, updateCampaignSkill, deleteCampaignSkill, copySkillFromManual | GET /campaigns/${campaignId}/skills, GET /campaigns/${campaignId}/skills/${skillId}, POST /campaigns/${campaignId}/skills, PATCH /campaigns/${campaignId}/skills/${skillId}, DELETE /campaigns/${campaignId}/skills/${skillId}, POST /campaigns/${campaignId}/skills/copy/${manualId}/${skillId} |
| frontend/src/api/soundeffects.ts | listSfxPresets |  |
| frontend/src/api/soundtrack.ts | listSongsForCampaign, listPlaylists, getSongPlayHistory, clearSongPlayHistory |  |
| frontend/src/api/soundtrack/nowPlaying.ts | getCampaignNowPlayingTitle, getCampaignNowPlayingTitlePublic |  |
| frontend/src/api/spells/spellsApi.ts | listCampaignSpells, getCampaignSpell, createCampaignSpell, updateCampaignSpell, deleteCampaignSpell, copySpellFromManual, exportSpellsExcel, importSpellsExcel | GET /campaigns/${campaignId}/spells, GET /campaigns/${campaignId}/spells/${spellId}, POST /campaigns/${campaignId}/spells, PATCH /campaigns/${campaignId}/spells/${spellId}, DELETE /campaigns/${campaignId}/spells/${spellId}, POST /campaigns/${campaignId}/spells/copy/${manualId}/${spellId}, GET /campaigns/${campaignId}/spells/export, POST /campaigns/${campaignId}/spells/import |
| frontend/src/api/traits/traitsApi.ts | listCampaignTraits, getCampaignTrait, createCampaignTrait, updateCampaignTrait, deleteCampaignTrait, copyTraitFromManual | GET /campaigns/${campaignId}/traits, GET /campaigns/${campaignId}/traits/${traitId}, POST /campaigns/${campaignId}/traits, PATCH /campaigns/${campaignId}/traits/${traitId}, DELETE /campaigns/${campaignId}/traits/${traitId}, POST /campaigns/${campaignId}/traits/copy/${manualId}/${traitId} |
| frontend/src/api/worldpedia/worldpediaApi.ts | getWorldpediaTree, createFolder, updateFolder, deleteFolder, createNote, getNote, updateNote, deleteNote, moveNote, reorderWorldpedia, searchNotes, getNoteLinks, exportAll, exportFolder, exportNote, importData | DELETE /worldpedia/campaigns/${campaignId}/folders/${folderId}, DELETE /worldpedia/campaigns/${campaignId}/notes/${noteId}, PATCH /worldpedia/campaigns/${campaignId}/reorder |
