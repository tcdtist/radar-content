import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import { generateCardMarkdown } from '../utils/markdown-export';
import { useCardTranslation } from '../hooks/useCardTranslation';
import { getSavedDetailScroll, saveDetailScroll } from '../hooks/useMobileScrollPersistence';
import { DetailCardHeader } from './DetailCardHeader';
import { DetailDrawerFooter } from './DetailDrawerFooter';
import { DetailDrawerHeader } from './DetailDrawerHeader';
import { DetailTabsContent, TabKey } from './DetailTabsContent';
import { DetailTabsNav, TabItem } from './DetailTabsNav';

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
  const rawTab = controlledTab || internalTab;
  const activeTab: TabKey = rawTab === 'sources' ? 'threads' : rawTab;
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

  const uniqueSources = useMemo(() => {
    if (!card?.sources) return [];
    const seen = new Set<string>();
    return card.sources.filter((s) => {
      const key = s.url || s.title || `${s.source}_${s.author}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [card?.sources]);

  const sanitizedCard = useMemo(() => {
    if (!card) return null;
    return {
      ...card,
      sources: uniqueSources,
    };
  }, [card, uniqueSources]);

  if (!card || !sanitizedCard) return null;

  const padItems = (t?: string[], orig: string[] = []): string[] =>
    !t || !t.length ? orig : t.length >= orig.length ? t : [...t, ...orig.slice(t.length)];

  const displaySummary = activeTranslation?.summary || sanitizedCard.summary;
  const displayEvidence = padItems(activeTranslation?.evidence, sanitizedCard.evidence);
  const displayCounter = padItems(activeTranslation?.counter, sanitizedCard.counter);
  const displayContext = padItems(activeTranslation?.context, sanitizedCard.context);
  const displayVerify = padItems(activeTranslation?.verification_questions, sanitizedCard.verification_questions);


  const copyMarkdown = () => {
    const md = generateCardMarkdown(sanitizedCard, {
      summary: displaySummary,
      evidence: displayEvidence,
      counter: displayCounter,
      context: displayContext,
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

  const tabs: TabItem[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'evidence', label: `Evidence (${displayEvidence.length})` },
    { id: 'counter', label: `Counter (${displayCounter.length})` },
    { id: 'context', label: `Context (${displayContext.length})` },
    { id: 'verify', label: `Verify (${displayVerify.length})` },
    { id: 'threads', label: `Threads (${uniqueSources.length})` },
  ];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <DetailDrawerHeader
          card={sanitizedCard}
          isAdmin={isAdmin}
          isTranslating={isTranslating}
          currentLang={currentLang}
          onToggleLanguage={toggleLanguage}
          onClose={onClose}
        />

        <div className="drawer-body" ref={drawerBodyRef}>
          <DetailCardHeader card={sanitizedCard} />

          <DetailTabsNav
            tabs={tabs}
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
          />

          {isTranslating && activeTab !== 'threads' ? (
            <div className="card" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <p className="font-mono text-coral" style={{ fontSize: '0.85rem' }}>
                &gt; Đang dịch phân tích kỹ thuật sang tiếng Việt với Gemini AI...
              </p>
            </div>
          ) : error && currentLang === 'vi' && activeTab !== 'threads' ? (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', borderColor: 'var(--color-danger)' }}>
              <p className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>{error}</p>
            </div>
          ) : (
            <DetailTabsContent
              card={sanitizedCard}
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

