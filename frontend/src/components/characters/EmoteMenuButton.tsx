import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import { useTranslation } from 'react-i18next';
import { EmoteRadialMenu } from './EmoteRadialMenu';

/** Single emote entry as stored in `character.characterImages`. */
export interface CharacterEmote {
  url: string;
  name?: string;
  isDefault: boolean;
}

interface EmoteMenuButtonProps {
  /** Available emotes for the character. */
  emotes: CharacterEmote[];
  /** URL of the emote currently active in the Skyline (highlighted in the menu). */
  activeUrl?: string | null;
  /** Invoked with the chosen emote URL when the user selects one. */
  onSelectEmote: (url: string) => void;
  /** Disables interaction (e.g. while a request is in flight). */
  disabled?: boolean;
  /** MUI color applied to the icon button. */
  color?: React.ComponentProps<typeof IconButton>['color'];
  /** Icon button size. */
  size?: 'small' | 'medium';
}

/**
 * Reusable control that opens a radial menu to switch the active Skyline emote
 * of a character. Encapsulates the trigger button, the popover anchoring and
 * the active-emote highlighting so it can be dropped into any character UI
 * (list, sheet header, affinity chart, skyline preview).
 *
 * The button stays disabled unless the character has at least two valid emotes,
 * since there is nothing to switch between otherwise.
 */
export const EmoteMenuButton: React.FC<EmoteMenuButtonProps> = ({
  emotes,
  activeUrl = null,
  onSelectEmote,
  disabled = false,
  color = 'default',
  size = 'small',
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const validEmotes = (emotes || []).filter((e) => e.url);
  const hasMultiple = validEmotes.length > 1;
  const isDisabled = disabled || !hasMultiple;

  const tooltip = hasMultiple
    ? t('emotes', 'Emotes')
    : t('emotes_disabled', 'Sin emotes adicionales');

  return (
    <>
      <Tooltip title={tooltip}>
        <span>
          <IconButton
            size={size}
            color={color}
            disabled={isDisabled}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ opacity: hasMultiple ? 1 : 0.4 }}
          >
            <EmojiEmotionsIcon fontSize={size === 'small' ? 'small' : 'medium'} />
          </IconButton>
        </span>
      </Tooltip>

      <EmoteRadialMenu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        emotes={validEmotes}
        activeUrl={activeUrl}
        onSelectEmote={(url) => {
          onSelectEmote(url);
          setAnchorEl(null);
        }}
      />
    </>
  );
};

export default EmoteMenuButton;
