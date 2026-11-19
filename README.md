# Journal

A private daily reflection journal that you install on your phone. Once a day it walks you through a short mindfulness and self-reflection worksheet, one step at a time, with a 1–10 mood rating. Once a week it can summarise the past 7 days.

Entries are stored only on your phone. The one exception: when you tap **Generate recap · sends entries to Anthropic**, that week's entries (and the previous week's, for comparison) are sent to the Anthropic API to write the recap. Nothing else leaves the device. There are no analytics, no third-party scripts and no web fonts, and a Content-Security-Policy in the built app blocks connections to any other host.

> **Browser storage can be wiped.** iOS, Android or the browser can clear a web app's storage, for example when the phone runs short of space, when the app goes unused for a long time, or when you remove it from the Home Screen or clear browsing data. **Export regularly** (Settings → Export as JSON) and keep the file somewhere safe. The app asks the browser to keep its storage ("persistent storage"), but that is not a guarantee.

## What it does

- **Daily check-in**: mood (1–10 buttons and an optional note), four reflection questions, and a mindfulness checkbox with optional minutes. One screen per step with Back, Skip and Next. Skipped or blank steps are not stored. A summary at the end lets you edit anything.
- **Home**: today's status ("Start today's check-in" or "Done for today · mood 6/10") and every past day. Missed days are plain dates. Any day can be opened, edited or deleted.
- **Reminders**: a daily notification at a time you choose (default 9:00). Tapping it opens today's check-in. See [Reminders: what to expect](#reminders-what-to-expect).
- **Weekly recap**: mood average, highest and lowest day, day-by-day numbers, mindfulness days and minutes, changes from the previous week, and (when generated) recurring themes for each question and 2–3 open questions you might bring to your therapist. Each recap is saved in history.
- **Local summary**: the same numbers with no network request.
- **PIN lock** on open, **export** to JSON and Markdown, **import** from JSON.
- Works offline once installed. Follows the system's light or dark mode and reduced-motion setting.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # production build into dist/
npm run preview    # serve dist/ at http://localhost:4173
```

The service worker (offline use and notifications) is only active in the production build, so use `npm run build && npm run preview` to try those.

## Put it online so your phone can open it

The app is a static site: the `dist/` folder after `npm run build`. Any static host works. Two free options:

**Cloudflare Pages**

1. Push this repository to GitHub.
2. In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect to Git, and pick the repository.
3. Build command `npm run build`, output directory `dist`.
4. Deploy. You get an address like `https://your-journal.pages.dev`.

**Netlify**

1. Push this repository to GitHub.
2. In Netlify: Add new site → Import an existing project, and pick the repository.
3. Build command `npm run build`, publish directory `dist`.
4. Deploy. You get an address like `https://your-journal.netlify.app`.

Or, without Git: run `npm run build` and drag the `dist` folder onto Netlify's "Deploy manually" area, or use `npx wrangler pages deploy dist` for Cloudflare.

Both need a free account; creating one is up to you. Notes:

- The site must be served over **HTTPS** (both hosts do this) for installation, offline use and notifications.
- The address is public, but the site contains no data: your entries live only in your phone's browser storage. If you'd rather the address not be guessable, pick an unusual project name.
- Entries are tied to the exact address. If you move to a different address, export from the old one and import on the new one.

## Install on your phone

**iPhone (Safari)**

1. Open the site's address in **Safari** (other iOS browsers can't install web apps with notifications).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open **Journal** from the Home Screen. Always use this icon: the Home Screen app has its own storage, separate from Safari's tabs.
4. For reminders: Settings → Daily reminder → turn it on, and allow notifications when asked. This needs iOS 16.4 or later and only works in the Home Screen app.

**Android (Chrome)**

1. Open the site's address in **Chrome**.
2. Tap **Install app** when offered, or the ⋮ menu → **Add to Home screen** / **Install app**.
3. Open **Journal** from the Home Screen or app drawer.
4. For reminders: Settings → Daily reminder → turn it on, and allow notifications when asked.

After installing, open the app once while online; from then on check-ins work without a connection.

## Add your Anthropic API key (for generated recaps)

1. Create a key in the Anthropic Console (console.anthropic.com → API keys). Usage is billed to that account; a weekly recap uses the inexpensive `claude-haiku-5-5` model.
2. In the app: Settings → Weekly recap → Anthropic API key → paste it → **Save key**.

The key is stored only in the app's storage on your phone, is sent only to `api.anthropic.com` when you tap Generate recap, and is never included in exports. Anyone who can open the app on your phone could see it, which is one reason to set a PIN. You can remove it at any time from Settings. Consider setting a monthly spend limit on the key in the Anthropic Console.

Without a key, everything else works, including the local summary.

## Weekly recap

- **Generate recap** (Recap screen, or on any local summary): sends this week's entries and the previous week's to Anthropic and saves the result. The button says so.
- **Local summary**: numbers only (mood, mindfulness, how many days each question was answered). No network.
- **Automatic**: on the evening you choose (Sunday at 19:00 by default, Settings → Weekly recap), the app makes a **local summary** of that week the next time it is opened, and shows a quiet note on the home screen. It never sends entries automatically; you can then tap Generate recap if you want the written version.

The recap is written to be neutral and factual: no diagnosis, no clinical labels, and no advice beyond a few open questions.

## Reminders: what to expect

Reliable, exact-time notifications to a closed web app need a push server, and this app deliberately has none. Without one:

- The reminder is shown while the app is open in the background, when it is sent to the background after the reminder time, and on installed Android Chrome when the system wakes the app (Periodic Background Sync; the system decides how often, so it can be late or skipped).
- On iPhone, a web app that is fully closed can't wake itself, so the reminder may not arrive at the set time.
- Whenever you open the app and today's check-in isn't done, the home screen shows a quiet prompt.

If you want exact-time notifications even when the app is closed, that needs a small push server (Web Push), which would hold a subscription for your phone and send a ping each day. That is not built; it would need your go-ahead first.

## Privacy and data

- Storage: IndexedDB (via Dexie), in your phone's browser storage for this site.
- Export: Settings → **Export as JSON** (full backup, can be imported) or **Export as Markdown** (readable). On phones this opens the share sheet so you can save to Files, Drive or similar.
- Import: Settings → **Import from JSON**. Days are merged: for a day present in both, the more recently edited version wins.
- PIN: a 4–8 digit PIN, asked for when the app opens and after a minute in the background. Only a salted hash is stored. It is a privacy screen, not encryption. If you forget it, the only way in is to clear the site's data, so keep an export.

## Project layout

```
src/
  main.tsx, App.tsx      entry, PIN gate, hash routes
  db.ts                  Dexie database: entries, recaps, settings
  recaps.ts              making local, automatic and generated recaps
  sw.ts                  service worker: offline cache, reminders, notification taps
  lib/
    dates.ts             local-date keys, weeks, schedule maths
    entry.ts             cleaning entries (blank parts are dropped)
    stats.ts             mood average, highest/lowest, mindfulness totals, week comparison
    recapPrompt.ts       the recap prompt and output schema
    recapApi.ts          the single Anthropic API call
    reminders.ts, reminderClient.ts, pin.ts, exportData.ts, files.ts
  screens/               Home, CheckIn, Day, Recaps, RecapView, Settings, Lock
public/                  icons, favicon
scripts/make-icons.cjs   regenerates the PNG icons (needs Playwright)
```

Tests cover date logic, entry cleaning, the mood average, mindfulness totals, week stats and comparison, the recap prompt builder, reminders, PIN hashing, and export/import.
