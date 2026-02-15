import React from 'react';
import { Paper, Stack, Typography, LinearProgress, Divider, Box } from '@mui/material';
import { EncounterSummary } from '../../api/encounters';
import { CharacterPayload } from '../../api/characters';
import type { CampaignMonsterDetail } from '../../api/bestiary/bestiaryApi';
import { prettySkill, prettySense } from './utils';
import AuthImage from '../common/AuthImage';

export interface DetailCardProps {
  /**
   * Participante a mostrar en la ficha de detalle. Puede ser `null` para estado vacío.
   */
  participant?: EncounterSummary['participants'][number] | null;
  /**
   * Color de acento para el borde de la ficha.
   */
  colorKey?: 'primary' | 'secondary';
  /**
   * Mapa de personajes (aliados) por `id` para resolver ficha extendida.
   */
  charMap: Map<string, CharacterPayload>;
  /**
   * Detalles del bestiario por `participantId` para enemigos.
   */
  monsterDetailByPid: Record<string, CampaignMonsterDetail | null>;
  /**
   * Diccionario de nombre mostrado por enemigo (`participantId`).
   */
  enemyDisplayNameById: Record<string, string>;
}

/**
 * Renderiza una ficha de detalle compacta para un participante de combate.
 * Muestra nombre, rol, iniciativa y barra de HP (incluye Temp HP para aliados).
 * `colorKey` controla el color de acento de la ficha.
 */
const DetailCard: React.FC<DetailCardProps> = ({ participant, colorKey = 'primary', charMap, monsterDetailByPid, enemyDisplayNameById }) => {
  if (!participant) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, flex: '1 1 320px', minWidth: 280 }}>
        <Typography variant="body2" color="text.secondary">Sin selección</Typography>
      </Paper>
    );
  }

  const isEnemy = participant.role === 'foe';
  const isAlly = !isEnemy;
  const char = isAlly && participant.kind === 'character' ? charMap.get(participant.id) : undefined;
  const ch = isAlly ? (char?.currentHp ?? participant.currentHp) : (typeof participant.currentHp === 'number' ? participant.currentHp : undefined);
  const mx = isAlly ? (char?.maxHp ?? participant.maxHp) : (typeof participant.maxHp === 'number' ? participant.maxHp : undefined);
  const temp = isAlly ? (char?.tempHp) : undefined;
  const hasCh = typeof ch === 'number' && !Number.isNaN(ch as any);
  const hasMx = typeof mx === 'number' && !Number.isNaN(mx as any) && (mx as number) > 0;
  const percent = hasCh && hasMx ? Math.max(0, Math.min(100, (Number(ch) / Number(mx)) * 100)) : undefined;

  const md = isEnemy && participant.kind !== 'character' ? monsterDetailByPid[participant.id] : undefined;
  const armorClass = isAlly ? char?.armorClass : md?.armorClass?.value;
  const speedStrAlly = char?.speed;
  const speedStrEnemy = md?.speed ? Object.entries(md.speed).filter(([_, v]) => typeof v === 'number').map(([k, v]) => `${k} ${v} ft`).join(', ') : undefined;
  const illustrationUrl = isEnemy && md ? (md.imageUrls?.medium || md.imageUrls?.low || md.imageUrls?.high) : undefined;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, borderColor: `${colorKey}.main`, borderWidth: 1, borderStyle: 'solid', flex: '1 1 320px', minWidth: 280 }}>
      <Stack spacing={0.75}>
        {illustrationUrl && (
          <Box sx={{ width: '100%', height: 120, borderRadius: 1, overflow: 'hidden', mb: 1 }}>
            <AuthImage
              src={illustrationUrl}
              alt={participant.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        )}
        <Typography variant="body1">{isEnemy ? (enemyDisplayNameById[participant.id] || participant.name) : participant.name}</Typography>
        <Typography variant="caption" color="text.secondary">{(isEnemy ? 'Enemigo' : 'Aliado')} · Ini {participant.initiative ?? '—'}</Typography>
        {/* Sección: Datos de combate clave */}
        <Typography variant="caption" color="text.secondary">
          {typeof armorClass === 'number' ? `CA ${armorClass}` : ''}{participant.initiative !== undefined ? ` · Ini ${participant.initiative}` : ''}{(isAlly && speedStrAlly) ? ` · Vel ${speedStrAlly}` : ''}{(isEnemy && speedStrEnemy) ? ` · Vel ${speedStrEnemy}` : ''}
        </Typography>
        {percent !== undefined ? (
          <Stack spacing={0.5}>
            <LinearProgress variant="determinate" value={percent} />
            <Typography variant="caption" color="text.secondary">
              HP {hasCh ? ch : '—'}/{hasMx ? mx : '—'}{isAlly && typeof temp === 'number' ? ` · Temp ${temp}` : ''}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">HP —</Typography>
        )}
        {/* Sección: Meta */}
        {isAlly && (
          <>
            <Divider />
            <Typography variant="subtitle2">Ficha del aliado</Typography>
            <Typography variant="caption" color="text.secondary">
              {(char?.className ? `Clase ${char.className}` : '')}{typeof char?.level === 'number' ? ` · Nivel ${char.level}` : ''}{char?.race ? ` · Raza ${char.race}` : ''}{char?.background ? ` · Trasfondo ${char.background}` : ''}{char?.alignment ? ` · Alineamiento ${char.alignment}` : ''}{char?.playerName ? ` · Jugador ${char.playerName}` : ''}
            </Typography>
            {/* Atributos */}
            {char && (
              <Typography variant="caption" color="text.secondary">
                {typeof char.str === 'number' ? `STR ${char.str}` : ''}{typeof char.dex === 'number' ? ` · DEX ${char.dex}` : ''}{typeof char.con === 'number' ? ` · CON ${char.con}` : ''}{typeof char.int === 'number' ? ` · INT ${char.int}` : ''}{typeof char.wis === 'number' ? ` · WIS ${char.wis}` : ''}{typeof char.cha === 'number' ? ` · CHA ${char.cha}` : ''}
              </Typography>
            )}
            {/* Competencia y hechicería */}
            {char && (
              <Typography variant="caption" color="text.secondary">
                {typeof char.proficiencyBonus === 'number' ? `PB +${char.proficiencyBonus}` : ''}{char.spellcastingAbility ? ` · Lanzamiento ${char.spellcastingAbility.toUpperCase()}` : ''}{typeof char.spellSaveDC === 'number' ? ` · CD Hechizo ${char.spellSaveDC}` : ''}{typeof char.spellAttackBonus === 'number' ? ` · Ataque Hechizo +${char.spellAttackBonus}` : ''}{char.hitDice ? ` · Dados de golpe ${char.hitDice}` : ''}
              </Typography>
            )}
            {/* Apariencia */}
            {char && (
              <Typography variant="caption" color="text.secondary">
                {char.age ? `Edad ${char.age}` : ''}{char.height ? ` · Altura ${char.height}` : ''}{char.weight ? ` · Peso ${char.weight}` : ''}{char.eyes ? ` · Ojos ${char.eyes}` : ''}{char.skin ? ` · Piel ${char.skin}` : ''}{char.hair ? ` · Pelo ${char.hair}` : ''}
              </Typography>
            )}
            {/* Listas largas */}
            {char?.otherProficienciesAndLanguages && (
              <Typography variant="caption" color="text.secondary">Proficiencias e idiomas: {char.otherProficienciesAndLanguages}</Typography>
            )}
            {char?.equipment && (
              <Typography variant="caption" color="text.secondary">Equipo: {char.equipment}</Typography>
            )}
            {char?.traitsAndFeatures && (
              <Typography variant="caption" color="text.secondary">Rasgos y características: {char.traitsAndFeatures}</Typography>
            )}
            {char?.alliesAndOrganizations && (
              <Typography variant="caption" color="text.secondary">Aliados y organizaciones: {char.alliesAndOrganizations}</Typography>
            )}
            {char?.backstory && (
              <Typography variant="caption" color="text.secondary">Historia: {char.backstory}</Typography>
            )}
            {char?.treasure && (
              <Typography variant="caption" color="text.secondary">Tesoro: {char.treasure}</Typography>
            )}
            {/* Hechizos */}
            {(char?.cantrips?.length || (char?.spellsByLevel && Object.keys(char.spellsByLevel).length)) ? (
              <Stack spacing={0.5}>
                {char?.cantrips?.length ? (
                  <Typography variant="caption" color="text.secondary">Trucos: {char.cantrips.join(', ')}</Typography>
                ) : null}
                {char?.spellsByLevel ? (
                  Object.entries(char.spellsByLevel).map(([lvl, names]) => (
                    <Typography key={lvl} variant="caption" color="text.secondary">Nivel {lvl}: {names.join(', ')}</Typography>
                  ))
                ) : null}
              </Stack>
            ) : null}
          </>
        )}

        {isEnemy && (
          <>
            <Divider />
            <Typography variant="subtitle2">Ficha del enemigo</Typography>
            <Typography variant="caption" color="text.secondary">
              {md?.size ? `${md.size} ` : ''}{md?.type || ''}{md?.alignment ? `, ${md.alignment}` : ''}{md?.challengeRating ? ` • CR ${md.challengeRating}` : ''}{typeof md?.proficiencyBonus === 'number' ? ` • PB +${md.proficiencyBonus}` : ''}
            </Typography>
            {/* AC, HP, velocidad */}
            <Typography variant="caption" color="text.secondary">
              {typeof md?.armorClass?.value === 'number' ? `CA ${md.armorClass.value}${md.armorClass.type ? ` (${md.armorClass.type})` : ''}` : ''}{md?.hitPoints?.average ? ` · HP medio ${md.hitPoints.average}` : ''}{md?.hitPoints?.roll ? ` · HP dados ${md.hitPoints.roll}` : ''}{speedStrEnemy ? ` · Vel ${speedStrEnemy}` : ''}
            </Typography>
            {/* Habilidades y salvaciones */}
            {md?.abilities && (
              <Typography variant="caption" color="text.secondary">
                {typeof md.abilities.str === 'number' ? `STR ${md.abilities.str}` : ''}{typeof md.abilities.dex === 'number' ? ` · DEX ${md.abilities.dex}` : ''}{typeof md.abilities.con === 'number' ? ` · CON ${md.abilities.con}` : ''}{typeof md.abilities.int === 'number' ? ` · INT ${md.abilities.int}` : ''}{typeof md.abilities.wis === 'number' ? ` · WIS ${md.abilities.wis}` : ''}{typeof md.abilities.cha === 'number' ? ` · CHA ${md.abilities.cha}` : ''}
              </Typography>
            )}
            {md?.savingThrows && (
              <Typography variant="caption" color="text.secondary">
                Salvaciones: {Object.entries(md.savingThrows).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')}
              </Typography>
            )}
            {md?.skills && Object.keys(md.skills).length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Habilidades: {Object.entries(md.skills).map(([k, v]) => `${prettySkill(k)} +${v}`).join(', ')}
              </Typography>
            )}
            {/* Resistencias e inmunidades */}
            {md?.damageVulnerabilities?.length ? (
              <Typography variant="caption" color="text.secondary">Vulnerabilidades: {md.damageVulnerabilities.join(', ')}</Typography>
            ) : null}
            {md?.damageResistances?.length ? (
              <Typography variant="caption" color="text.secondary">Resistencias: {md.damageResistances.join(', ')}</Typography>
            ) : null}
            {md?.damageImmunities?.length ? (
              <Typography variant="caption" color="text.secondary">Inmunidades: {md.damageImmunities.join(', ')}</Typography>
            ) : null}
            {md?.conditionImmunities?.length ? (
              <Typography variant="caption" color="text.secondary">Inmunidades de estado: {md.conditionImmunities.join(', ')}</Typography>
            ) : null}
            {/* Sentidos e idiomas */}
            {md?.senses && (
              <Typography variant="caption" color="text.secondary">
                Sentidos: {Object.entries(md.senses).map(([k, v]) => `${prettySense(k)}: ${v}`).join(', ')}
              </Typography>
            )}
            {md?.languages && (
              <Typography variant="caption" color="text.secondary">Idiomas: {md.languages}</Typography>
            )}
            {/* Entorno y notas */}
            {md?.environment?.length ? (
              <Typography variant="caption" color="text.secondary">Entorno: {md.environment.join(', ')}</Typography>
            ) : null}
            {md?.notes?.length ? (
              <Stack spacing={0.25}>
                {md.notes.map((n, i) => (
                  <Typography key={i} variant="caption" color="text.secondary">Nota: {n}</Typography>
                ))}
              </Stack>
            ) : null}
            {/* Rasgos y acciones completas */}
            {md?.traits?.length ? (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">Rasgos:</Typography>
                {md.traits.map((t, i) => {
                  const text = (t as any)?.text || t.desc;
                  const name = t.name;
                  return (
                    <Typography key={i} variant="caption" color="text.secondary">
                      • {name ? `${name}: ` : ''}{text}
                    </Typography>
                  );
                })}
              </Stack>
            ) : null}
            {md?.actions?.length ? (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">Acciones:</Typography>
                {md.actions.map((t, i) => {
                  const text = (t as any)?.text || t.desc;
                  const name = t.name;
                  return (
                    <Typography key={i} variant="caption" color="text.secondary">
                      • {name ? `${name}: ` : ''}{text}
                    </Typography>
                  );
                })}
              </Stack>
            ) : null}
            {md?.reactions?.length ? (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">Reacciones:</Typography>
                {md.reactions.map((t, i) => {
                  const text = (t as any)?.text || t.desc;
                  const name = t.name;
                  return (
                    <Typography key={i} variant="caption" color="text.secondary">
                      • {name ? `${name}: ` : ''}{text}
                    </Typography>
                  );
                })}
              </Stack>
            ) : null}
            {md?.legendaryActions?.length ? (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">Acciones legendarias:</Typography>
                {md.legendaryActions.map((t, i) => {
                  const text = (t as any)?.text || t.desc;
                  const name = t.name;
                  return (
                    <Typography key={i} variant="caption" color="text.secondary">
                      • {name ? `${name}: ` : ''}{text}
                    </Typography>
                  );
                })}
              </Stack>
            ) : null}
            {md?.lairActions?.length ? (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">Acciones de guarida:</Typography>
                {md.lairActions.map((t, i) => {
                  const text = (t as any)?.text || t.desc;
                  const name = t.name;
                  return (
                    <Typography key={i} variant="caption" color="text.secondary">
                      • {name ? `${name}: ` : ''}{text}
                    </Typography>
                  );
                })}
              </Stack>
            ) : null}
            {md?.regionalEffects?.length ? (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">Efectos regionales:</Typography>
                {md.regionalEffects.map((t, i) => {
                  const text = (t as any)?.text || t.desc;
                  const name = t.name;
                  return (
                    <Typography key={i} variant="caption" color="text.secondary">
                      • {name ? `${name}: ` : ''}{text}
                    </Typography>
                  );
                })}
              </Stack>
            ) : null}
          </>
        )}
      </Stack>
    </Paper>
  );
};

export default DetailCard;
