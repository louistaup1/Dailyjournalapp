// Renders the app icons from simple SVG with the preinstalled Playwright Chromium.
// Run: node scripts/make-icons.cjs
const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, '..', 'public');

const BG = '#f5f2ec';
const ACCENT = '#5e705d';
// A plain ring in the accent colour. r and stroke are fractions of the icon size.
const ring = (size, { bg = BG, color = ACCENT, r = 0.25, w = 0.065, radius = 0 } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" rx="${radius * size}" fill="${bg}"/>` : ''}
  <circle cx="${size / 2}" cy="${size / 2}" r="${r * size}" fill="none" stroke="${color}" stroke-width="${w * size}"/>
</svg>`;

const icons = [
  ['pwa-192x192.png', 192, {}],
  ['pwa-512x512.png', 512, {}],
  ['maskable-512x512.png', 512, { r: 0.2, w: 0.055 }], // stays inside the maskable safe zone
  ['apple-touch-icon.png', 180, {}],
  ['badge-96x96.png', 96, { bg: null, color: '#ffffff', r: 0.32, w: 0.12 }], // Android status-bar badge: white on transparent
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [name, size, opts] of icons) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${ring(size, opts)}</body></html>`);
    await p.locator('svg').screenshot({ path: path.join(out, name), omitBackground: true });
    console.log('wrote', name);
  }
  await b.close();
})();
