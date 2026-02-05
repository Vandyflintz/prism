'use client';


import { useEffect } from 'react';
import { PrismEditor } from '../components/PrismEditor';
import AboutOverlay from '../components/AboutOverlay';
import ShortcutsOverlay from '../components/ShortcutsOverlay';
import { useUIStore } from '../store/uiStore';

export default function Home() {
  const { openAbout, openShortcuts } = useUIStore();

  useEffect(() => {
    // Listen for Electron IPC messages
    if (window.electron && window.electron.onMenuAction) {
      const removeListener = window.electron.onMenuAction((action: string) => {
        if (action === 'menu:open-about') {
          openAbout();
        }
        if (action === 'menu:shortcuts') {
          openShortcuts();
        }
      });
      return () => {
        if (removeListener) removeListener();
      };
    }
  }, [openAbout, openShortcuts]);

  return (
    <main style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }}>
      <PrismEditor />
      <AboutOverlay />
      <ShortcutsOverlay />
    </main>
  );
}
