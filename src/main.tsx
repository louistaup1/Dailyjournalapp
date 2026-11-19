import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { startReminders } from './lib/reminderClient';
import { runAutoRecap, setRecapRequester } from './recaps';
import './styles.css';

// Loaded on demand so the SDK isn't part of the everyday app bundle.
setRecapRequester(() => import('./lib/recapApi').then((m) => m.requestAiRecap));
registerSW({ immediate: true });
startReminders();
void runAutoRecap();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void runAutoRecap();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
