import { useEffect, useRef } from 'react';

const HOME_SCROLL_KEY = 'radar_mobile_scroll_home';
const DETAIL_SCROLL_PREFIX = 'radar_mobile_scroll_detail_';

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function saveDetailScroll(cardId: string, scrollTop: number): void {
  if (typeof window === 'undefined' || !cardId) return;
  try {
    sessionStorage.setItem(`${DETAIL_SCROLL_PREFIX}${cardId}`, String(Math.max(0, Math.round(scrollTop))));
  } catch {
    // sessionStorage quota / private browsing fallback
  }
}

export function getSavedDetailScroll(cardId: string): number {
  if (typeof window === 'undefined' || !cardId) return 0;
  try {
    const raw = sessionStorage.getItem(`${DETAIL_SCROLL_PREFIX}${cardId}`);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function useMobileScrollPersistence(isReady: boolean = true) {
  const hasRestoredHome = useRef(false);

  // 1. Record home scroll position on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: number | null = null;

    const handleScroll = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        try {
          sessionStorage.setItem(HOME_SCROLL_KEY, String(Math.round(window.scrollY)));
        } catch {
          // Ignore storage errors
        }
      }, 100);
    };

    const handlePageHide = () => {
      try {
        sessionStorage.setItem(HOME_SCROLL_KEY, String(Math.round(window.scrollY)));
      } catch {
        // Ignore storage errors
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  // 2. Restore home scroll position once data is ready
  useEffect(() => {
    if (!isReady || hasRestoredHome.current || typeof window === 'undefined') return;

    try {
      const saved = sessionStorage.getItem(HOME_SCROLL_KEY);
      if (saved) {
        const top = parseInt(saved, 10);
        if (!isNaN(top) && top > 0) {
          hasRestoredHome.current = true;
          // Use requestAnimationFrame and small timeout to ensure DOM layout has rendered
          requestAnimationFrame(() => {
            window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
          });
          setTimeout(() => {
            window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
          }, 60);
        }
      }
    } catch {
      // Ignore
    }
  }, [isReady]);
}
