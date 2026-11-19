import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { startReminders } from './lib/reminderClient';
import { runAutoRecap } from './recaps';
import './styles.css';

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
