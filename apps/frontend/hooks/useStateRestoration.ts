'use client';

import { useEffect, useRef, useState } from 'react';

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
 * Hook to manage component state persistence across navigation
 * Automatically saves and restores state from localStorage
 * Supports functional updates like React.useState
 * Only restores state during navigation, NOT on page refresh
 */
export const usePersistentState = <T,>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] => {
  // Initialize state from localStorage if available
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Check if this is a navigation (not a refresh)
      // sessionStorage persists during navigation but clears on refresh
      const isNavigation = sessionStorage.getItem('app-navigation-active') === 'true';
      
      if (isNavigation) {
        // Restore from localStorage during navigation
        const stored = localStorage.getItem(key);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          return parsed;
        }
      } else {
        // On refresh, clear localStorage for this key to start fresh
        localStorage.removeItem(key);
      }
      
      return initialValue;
    } catch (error) {
      console.error(`Failed to load persisted state for key "${key}":`, error);
      return initialValue;
    }
  });

  // Mark navigation as active when component unmounts (user is navigating)
  useEffect(() => {
    return () => {
      sessionStorage.setItem('app-navigation-active', 'true');
    };
  }, []);

  // Save to localStorage whenever value changes
  const setPersistentValue = (newValue: T | ((prev: T) => T)) => {
    setValue((prevValue) => {
      // Handle functional updates
      const valueToStore = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(prevValue)
        : newValue;
      
      // Save to localStorage
      try {
        localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error(`Failed to save state for key "${key}":`, error);
      }
      
      return valueToStore;
    });
  };

  return [value, setPersistentValue];
};
