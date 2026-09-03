import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';

// The default vite-plugin-pwa registration only checks for a new deployed version ONCE, at
// initial page load. Someone who keeps a tab open across a deploy (very common while actively
// testing changes, or just during normal daily use of an admin tool like this one) would never
// be prompted to update — silently running a stale bundle indefinitely, which produces exactly
// the "I fixed the code but nothing changed" confusion. Explicit registration below re-checks
// periodically and on tab focus, and (registerType: 'autoUpdate' in vite.config.ts) activates +
// reloads automatically the moment a new version is found, without waiting for the person to
// manually close every tab.
const updateSW = registerSW({ immediate: true });
setInterval(() => updateSW(), 60 * 60 * 1000); // hourly, in case the tab is left open for a long time
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateSW();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
);
