import React from 'react';
import { CardStatus } from '../../lib/db/types';
import { BaseButton } from './BaseButton';
import { CheckIcon, CopyIcon, StarIcon, TrashIcon } from './Icons';

interface DetailDrawerFooterProps {
  cardId: string;
  onCopyDraft: () => void;
  copied: boolean;
  onAction: (id: string, action: CardStatus) => void;
}

export const DetailDrawerFooter: React.FC<DetailDrawerFooterProps> = ({
  cardId,
  onCopyDraft,
  copied,
  onAction,
}) => {
  return (
    <div className="drawer-footer">
      <BaseButton
        data-testid="btn-copy-draft"
        className="btn-copy-draft"
        variant="ghost"
        size="sm"
        onClick={onCopyDraft}
      >
        <CopyIcon size={14} />
        <span>{copied ? 'Copied Markdown' : 'Copy Draft'}</span>
      </BaseButton>

      <div className="drawer-footer-actions">
        <BaseButton
          data-testid="btn-drawer-save"
          variant="ghost"
          size="sm"
          onClick={() => onAction(cardId, 'SAVED')}
          aria-label="Save signal"
        >
          <StarIcon size={14} color="var(--accent-bronze)" />
          <span>Save</span>
        </BaseButton>

        <BaseButton
          data-testid="btn-drawer-written"
          variant="bronze"
          size="sm"
          onClick={() => onAction(cardId, 'WRITTEN')}
          aria-label="Mark written"
        >
          <CheckIcon size={14} />
          <span>Written</span>
        </BaseButton>

        <BaseButton
          data-testid="btn-drawer-dismiss"
          variant="danger"
          size="sm"
          onClick={() => onAction(cardId, 'DISMISSED')}
          aria-label="Dismiss"
        >
          <TrashIcon size={14} />
          <span>Dismiss</span>
        </BaseButton>
      </div>
    </div>
  );
};
