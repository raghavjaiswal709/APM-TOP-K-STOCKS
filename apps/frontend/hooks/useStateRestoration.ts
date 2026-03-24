'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Saves scroll position when component unmounts and restores it when mounted
 * Useful for maintaining scroll state when navigating between pages
 */
export const useScrollRestoration = (scrollContainerId?: string) => {
  const scrollPositionRef = useRef<number>(0);

  // Save scroll position when component unmounts
  useEffect(() => {
    return () => {
      const container = scrollContainerId
        ? document.getElementById(scrollContainerId)
        : window;

      scrollPositionRef.current =
        container instanceof Window
          ? window.scrollY
          : container?.scrollTop || 0;

      // Store in sessionStorage for cross-navigation persistence
      if (scrollContainerId) {
        sessionStorage.setItem(
          `scroll-${scrollContainerId}`,
          scrollPositionRef.current.toString()
        );
      } else {
        sessionStorage.setItem('scroll-position', scrollPositionRef.current.toString());
      }
    };
  }, [scrollContainerId]);

  // Restore scroll position when component mounts
  useEffect(() => {
    const storedPosition = scrollContainerId
      ? sessionStorage.getItem(`scroll-${scrollContainerId}`)
      : sessionStorage.getItem('scroll-position');

    if (storedPosition) {
      const position = parseInt(storedPosition, 10);

      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const container = scrollContainerId
          ? document.getElementById(scrollContainerId)
          : window;

        if (container instanceof Window) {
          window.scrollTo(0, position);
        } else if (container) {
          container.scrollTop = position;
        }
      }, 0);
    }
  }, [scrollContainerId]);
};

/**
 * Hook to manage component state persistence across navigation.
 * Automatically saves and restores state from localStorage.
 * Supports functional updates like React.useState.
 *
 * PERFORMANCE: localStorage writes are debounced (2-second delay) to avoid
 * blocking the main thread on high-frequency state updates (e.g. live ticks).
 * On component unmount (navigation), the latest value is written immediately
 * so it is always available when the user navigates back.
 */
export const usePersistentState = <T,>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] => {
  // Initialize state from localStorage if available (only during navigation, not refresh)
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // sessionStorage persists during tab navigation but clears on hard refresh
      const isNavigation = sessionStorage.getItem('app-navigation-active') === 'true';

      if (isNavigation) {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
          return JSON.parse(stored);
        }
      } else {
        // Fresh page load — clear stale persisted state for this key
        localStorage.removeItem(key);
      }

      return initialValue;
    } catch (error) {
      console.error(`Failed to load persisted state for key "${key}":`, error);
      return initialValue;
    }
  });

  // Always-current ref used by the unmount cleanup (avoids stale closure)
  const valueRef = useRef<T>(value);
  valueRef.current = value;

  // Debounced write: fires 2 seconds after the last change, cancelled on next change.
  // This prevents blocking localStorage I/O on every live-data tick.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore quota / private-mode errors */
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [key, value]);

  // On unmount (user navigating away): cancel pending timer and write immediately
  // so the state is ready when the user navigates back.
  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem('app-navigation-active', 'true');
        localStorage.setItem(key, JSON.stringify(valueRef.current));
      } catch {
        /* ignore */
      }
    };
  }, [key]);

  // Plain setState wrapper — debounce handles persistence, no sync I/O here
  const setPersistentValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(newValue);
  }, []);

  return [value, setPersistentValue];
};
