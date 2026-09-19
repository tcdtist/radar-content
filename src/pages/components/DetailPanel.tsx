import React, { useEffect, useRef, useState } from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import { generateCardMarkdown } from '../utils/markdown-export';
import { useCardTranslation } from '../hooks/useCardTranslation';
import { getSavedDetailScroll, saveDetailScroll } from '../hooks/useMobileScrollPersistence';
import { BaseButton } from './BaseButton';
import { DetailCardHeader } from './DetailCardHeader';
import { DetailDrawerFooter } from './DetailDrawerFooter';
import { DetailDrawerHeader } from './DetailDrawerHeader';
import { DetailTabsContent, TabKey } from './DetailTabsContent';

interface DetailPanelProps {
  card: ScoredIntelligenceCard | null;
  onClose: () => void;
  onAction: (id: string, action: CardStatus) => void;
  isAdmin?: boolean;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  card,
  onClose,
  onAction,
  isAdmin = false,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<TabKey>('summary');
  const activeTab = controlledTab || internalTab;
  const [copied, setCopied] = useState(false);
  const drawerBodyRef = useRef<HTMLDivElement>(null);

  const { currentLang, isTranslating, error, activeTranslation, toggleLanguage } =
    useCardTranslation(card?.id);

  useEffect(() => {
    if (!card) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [card]);

  // Restore saved scroll position for this card if available, otherwise start at top
  useEffect(() => {
    if (!card?.id) return;
    const savedTop = getSavedDetailScroll(card.id);
    if (drawerBodyRef.current) {
      drawerBodyRef.current.scrollTop = savedTop;
    }
  }, [card?.id]);

  // Persist scroll position as user scrolls inside detail drawer
  useEffect(() => {
    const el = drawerBodyRef.current;
    if (!el || !card?.id) return;

    let timeoutId: number | null = null;
    const handleScroll = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        saveDetailScroll(card.id, el.scrollTop);
      }, 100);
    };

    const handleSave = () => saveDetailScroll(card.id, el.scrollTop);

    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', handleSave);
    window.addEventListener('beforeunload', handleSave);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', handleSave);
      window.removeEventListener('beforeunload', handleSave);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [card?.id]);

  if (!card) return null;

  const displaySummary = activeTranslation?.summary || card.summary;
  const displayEvidence = activeTranslation?.evidence?.length
    ? activeTranslation.evidence
    : card.evidence;
  const displayCounter = activeTranslation?.counter?.length
    ? activeTranslation.counter
    : card.counter;
  const displayVerify = activeTranslation?.verification_questions?.length
    ? activeTranslation.verification_questions
    : card.verification_questions;

  const copyMarkdown = () => {
    const md = generateCardMarkdown(card, {
      summary: displaySummary,
      evidence: displayEvidence,
      counter: displayCounter,
      verification_questions: displayVerify,
    });
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectTab = (tabId: TabKey) => {
    setInternalTab(tabId);
    onTabChange?.(tabId);
    if (drawerBodyRef.current && drawerBodyRef.current.scrollTop > 100) {
      drawerBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const tabs: { id: TabKey; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'evidence', label: `Evidence (${displayEvidence.length})` },
    { id: 'counter', label: `Counter (${displayCounter.length})` },
    { id: 'context', label: 'Context' },
    { id: 'verify', label: `Verify (${displayVerify.length})` },
    { id: 'sources', label: `Sources (${card.sources.length})` },
  ];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <DetailDrawerHeader
          card={card}
          isAdmin={isAdmin}
          isTranslating={isTranslating}
          currentLang={currentLang}
          onToggleLanguage={toggleLanguage}
          onClose={onClose}
        />

        <div className="drawer-body" ref={drawerBodyRef}>
          <DetailCardHeader card={card} />

          <div className="drawer-tabs-nav">
            {tabs.map((tab) => (
              <BaseButton
                key={tab.id}
                variant={activeTab === tab.id ? 'coral' : 'ghost'}
                size="sm"
                onClick={() => handleSelectTab(tab.id)}
              >
                {tab.label}
              </BaseButton>
            ))}
          </div>

          {isTranslating ? (
            <div className="card" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <p className="font-mono text-coral" style={{ fontSize: '0.85rem' }}>
                &gt; Đang dịch phân tích kỹ thuật sang tiếng Việt với Gemini AI...
              </p>
            </div>
          ) : error && currentLang === 'vi' ? (
            <div
              className="card"
              style={{ padding: '1.5rem', textAlign: 'center', borderColor: 'var(--color-danger)' }}
            >
              <p className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
                {error}
              </p>
            </div>
          ) : (
            <DetailTabsContent
              card={card}
              activeTab={activeTab}
              translation={activeTranslation}
            />
          )}
        </div>

        <DetailDrawerFooter
          cardId={card.id}
          onCopyDraft={copyMarkdown}
          copied={copied}
          onAction={onAction}
        />
      </div>
    </div>
  );
};
