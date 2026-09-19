import { useEffect, useRef, useState } from 'react';
import { CardTranslation, ScoredIntelligenceCard } from '../../lib/db/types';
import { translateCard } from '../services/client';

export function useCardTranslation(cardId: string | undefined) {
  const [currentLang, setCurrentLang] = useState<'en' | 'vi'>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, CardTranslation>>({});
  const activeCardIdRef = useRef<string | undefined>(cardId);

  useEffect(() => {
    activeCardIdRef.current = cardId;
    setCurrentLang('en');
    setIsTranslating(false);
    setError(null);
  }, [cardId]);

  const toggleLanguage = async (card: ScoredIntelligenceCard) => {
    if (currentLang === 'vi') {
      setCurrentLang('en');
      return;
    }

    // Cache hit in client memory (bypass if cached translation is truncated)
    if (translations[card.id]) {
      const memCached = translations[card.id];
      const isMemTruncated =
        (card.evidence?.length && memCached.evidence && card.evidence.length > memCached.evidence.length) ||
        (card.counter?.length && memCached.counter && card.counter.length > memCached.counter.length);
      if (!isMemTruncated) {
        setCurrentLang('vi');
        return;
      }
    }

    if (isTranslating) return;

    setIsTranslating(true);
    setError(null);
    try {
      const res = await translateCard(card.id, card);
      if (res) {
        setTranslations((prev) => ({ ...prev, [card.id]: res }));
        if (activeCardIdRef.current === card.id) {
          setCurrentLang('vi');
        }
      } else {
        throw new Error('Translation failed or server returned empty result');
      }
    } catch (err) {
      if (activeCardIdRef.current === card.id) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        console.error('[Translation Error]:', err);
      }
    } finally {
      if (activeCardIdRef.current === card.id) {
        setIsTranslating(false);
      }
    }
  };

  const activeTranslation = currentLang === 'vi' && cardId ? translations[cardId] || null : null;

  return {
    currentLang,
    isTranslating,
    error,
    activeTranslation,
    toggleLanguage,
  };
}
