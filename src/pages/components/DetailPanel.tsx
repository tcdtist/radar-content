import React, { useState } from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import { BaseButton } from './BaseButton';
import { DetailTabsContent, TabKey } from './DetailTabsContent';
import { CheckIcon, CloseIcon, CopyIcon, StarIcon, TrashIcon } from './Icons';

interface DetailPanelProps {
  card: ScoredIntelligenceCard | null;
  onClose: () => void;
  onAction: (id: string, action: CardStatus) => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ card, onClose, onAction }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [copied, setCopied] = useState(false);

  if (!card) return null;

  const copyMarkdown = () => {
    const md = `## ${card.label} (Score: ${card.score}/100)
**Status:** ${card.status} | **Topics:** ${card.topic_tags.join(', ')}

### Summary
${card.summary}

### Key Evidence
${card.evidence.map((e) => `- ${e}`).join('\n') || '- None recorded'}

### Counterarguments
${card.counter.map((c) => `- ${c}`).join('\n') || '- None recorded'}

### Verification Checklist
${card.verification_questions.map((q) => `- [ ] ${q}`).join('\n') || '- None'}

### Sources
${card.sources.map((s) => `- [${s.source.toUpperCase()}] ${s.title}: ${s.url}`).join('\n')}`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Sticky Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="terminal-prompt" style={{ fontSize: '1.05rem' }}>&gt; intelligence_detail</span>
            <span className={`badge badge-${card.status.toLowerCase()}`}>{card.status}</span>
          </div>
          <button
            data-testid="btn-close-drawer"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
            aria-label="Đóng (Close)"
            title="Đóng (Close)"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="drawer-body">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
              <h2 className="font-mono" style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4 }}>
                {card.label}
              </h2>
              <div className="badge" style={{ backgroundColor: 'rgba(217, 119, 87, 0.15)', borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)', fontSize: '0.85rem' }}>
                SCORE {card.score}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {card.topic_tags.map((t) => (
                <span key={t} className="badge" style={{ backgroundColor: 'transparent', borderColor: 'var(--bg-tertiary)', color: 'var(--accent-bronze)' }}>
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="drawer-tabs-nav">
            {[
              { id: 'summary', label: 'Summary' },
              { id: 'evidence', label: `Evidence (${card.evidence.length})` },
              { id: 'counter', label: `Counter (${card.counter.length})` },
              { id: 'context', label: 'Context' },
              { id: 'verify', label: `Verify (${card.verification_questions.length})` },
              { id: 'sources', label: `Sources (${card.sources.length})` },
            ].map((tab) => (
              <BaseButton
                key={tab.id}
                variant={activeTab === tab.id ? 'coral' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab.id as TabKey)}
              >
                {tab.label}
              </BaseButton>
            ))}
          </div>

          {/* Tab Content Panels */}
          <DetailTabsContent card={card} activeTab={activeTab} />
        </div>

        {/* Footer Actions */}
        <div className="drawer-footer">
          <BaseButton
            data-testid="btn-copy-draft"
            className="btn-copy-draft"
            variant="ghost"
            size="sm"
            onClick={copyMarkdown}
          >
            <CopyIcon size={14} />
            <span>{copied ? 'Copied Markdown' : 'Copy Draft'}</span>
          </BaseButton>
          <div className="drawer-footer-actions">
            <BaseButton
              data-testid="btn-drawer-save"
              variant="ghost"
              size="sm"
              onClick={() => onAction(card.id, 'SAVED')}
              title="Lưu tín hiệu (Save)"
              aria-label="Lưu tín hiệu (Save)"
            >
              <StarIcon size={14} color="var(--accent-bronze)" />
              <span>Save</span>
            </BaseButton>
            <BaseButton
              data-testid="btn-drawer-written"
              variant="bronze"
              size="sm"
              onClick={() => onAction(card.id, 'WRITTEN')}
              title="Đã viết bài (Mark Written)"
              aria-label="Đã viết bài (Mark Written)"
            >
              <CheckIcon size={14} />
              <span>Written</span>
            </BaseButton>
            <BaseButton
              data-testid="btn-drawer-dismiss"
              variant="danger"
              size="sm"
              onClick={() => onAction(card.id, 'DISMISSED')}
              title="Bỏ qua (Dismiss)"
              aria-label="Bỏ qua (Dismiss)"
            >
              <TrashIcon size={14} />
              <span>Dismiss</span>
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  );
};
