# Journal

A private daily reflection journal that you install on your phone. Once a day it walks you through a short mindfulness and self-reflection worksheet, one step at a time, with a 1–10 mood rating. Once a week it can summarise the past 7 days.

Entries are stored only on your phone. The one exception is the weekly recap: when you save an Anthropic API key, that week's entries (and the previous week's, for comparison) are sent to the Anthropic API to write it, automatically on the evening you choose and whenever you tap **Generate recap · sends entries to Anthropic**. They go straight from your phone to Anthropic.

For reminders that arrive with the app closed there is an optional push server (`worker/`, a Cloudflare Worker). It stores only your browser's push subscription, your time zone, the reminder and recap times, and the date of your last finished check-in, so it can skip days you've already done. It never receives entries, moods, recaps or your API key, and the pushes it sends are encrypted end to end and only say "reminder" or "recap".

There are no analytics, no third-party scripts and no web fonts, and a Content-Security-Policy in the built app blocks connections to any host other than the Anthropic API and your push server.

> **Browser storage can be wiped.** iOS, Android or the browser can clear a web app's storage, for example when the phone runs short of space, when the app goes unused for a long time, or when you remove it from the Home Screen or clear browsing data. **Export regularly** (Settings → Export as JSON) and keep the file somewhere safe. The app asks the browser to keep its storage ("persistent storage"), but that is not a guarantee.

## What it does

- **Daily check-in**: mood (1–10 buttons and an optional note), four reflection questions, and a mindfulness checkbox with optional minutes. One screen per step with Back, Skip and Next. Skipped or blank steps are not stored. A summary at the end lets you edit anything.
- **Home**: today's status ("Start today's check-in" or "Done for today · mood 6/10") and every past day. Missed days are plain dates. Any day can be opened, edited or deleted.
- **Reminders**: a daily notification at a time you choose (default 9:00), even when the app is closed (with the push server). Days you've already checked in are skipped. Tapping it opens today's check-in. See [Reminders with the app closed](#reminders-with-the-app-closed).
- **Weekly recap**, made automatically on the evening you choose (Sunday 19:00 by default) or on demand: mood average, highest and lowest day, day-by-day numbers, mindfulness days and minutes, changes from the previous week, and (when generated) recurring themes for each question and 2–3 open questions you might bring to your therapist. Each recap is saved in history.
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

If you set up the push server (below), add one environment variable to the site's build settings before deploying: `VITE_PUSH_URL` = your Worker's address (Cloudflare Pages: Settings → Variables and Secrets; Netlify: Site configuration → Environment variables). Then redeploy.

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

The key is stored only in the app's storage on your phone, is sent only to `api.anthropic.com` when a recap is generated (weekly and when you tap Generate recap), and is never included in exports or sent to the push server. Anyone who can open the app on your phone could see it, which is one reason to set a PIN. You can remove it at any time from Settings. Consider setting a monthly spend limit on the key in the Anthropic Console.

Without a key, everything else works; the weekly recap is then a local summary.

## Weekly recap

- **Automatic**: on the evening you choose (Settings → Weekly recap; Sunday at 19:00 by default) the recap for the past 7 days is made and saved. With an API key saved, it sends that week's entries and the previous week's to Anthropic to write the full recap; without a key, or if the request fails, it saves a local summary instead and says why. With the push server set up this happens with the app closed and a notification lets you know; without it, it happens the next time you open the app.
- **Generate recap** (Recap screen, or on any local summary): the same, on demand. The button says that entries are sent.
- **Local summary**: numbers only (mood, mindfulness, how many days each question was answered). No network.

The recap is written to be neutral and factual: no diagnosis, no clinical labels, and no advice beyond a few open questions.

## Reminders with the app closed

A closed web app can only be woken by a push message from a server, so this repository includes a small one in `worker/`. It runs on Cloudflare Workers' free tier (a Worker, a cron trigger every 5 minutes, and one KV namespace); for one person it stays far inside the free limits. Every step below happens in your own Cloudflare account, which you create; nothing here creates it for you.

```bash
cd worker
npm install
npx wrangler login                      # opens the browser to sign in to Cloudflare
npx wrangler kv namespace create SUBS   # paste the id it prints into wrangler.toml
npm run vapid                           # prints a key pair
```

Then edit `worker/wrangler.toml`:

- `id` under `kv_namespaces`: the KV id from above.
- `ALLOWED_ORIGIN`: the address your journal is served from, e.g. `https://my-journal.pages.dev`.
- `VAPID_SUBJECT`: `mailto:` followed by an email address of yours (push services require a contact).
- `VAPID_PUBLIC_KEY`: the public key from `npm run vapid`.

```bash
npx wrangler secret put VAPID_PRIVATE_KEY   # paste the private key from npm run vapid
npm run deploy                              # prints https://journal-push.<you>.workers.dev
```

Finally set `VITE_PUSH_URL` to that address in your site's build settings (see above), redeploy the site, open the installed app, and turn on Settings → Daily reminder. **Send a test reminder** goes through the server, so it confirms the whole path. Keep the VAPID keys: if they change, the app has to subscribe again (turn the reminder off and on).

What to expect:

- The server checks every 5 minutes, so a reminder set for 9:00 arrives between 9:00 and about 9:05. If a check is missed it still sends up to 3 hours late, never later.
- On iPhone, notifications need iOS 16.4 or later and the app added to the Home Screen.
- If the phone is off or offline, the push service holds the reminder for up to 6 hours and the recap push for up to a day.
- Whenever you open the app and today's check-in isn't done, the home screen also shows a quiet prompt.

Without the push server, the app still reminds you when it can: while it is open or in the background, and when Android wakes an installed app (Periodic Background Sync, at times the system chooses).

`cd worker && npm test` runs the server's tests, including one that decrypts a push exactly as a phone would.

## Privacy and data

- Storage: IndexedDB (via Dexie), in your phone's browser storage for this site.
- Leaves the phone: the week's entries to Anthropic for the recap (only with an API key saved); the push subscription, schedule, time zone and last check-in date to your push server (only if you set one up).
- Export: Settings → **Export as JSON** (full backup, can be imported) or **Export as Markdown** (readable). On phones this opens the share sheet so you can save to Files, Drive or similar.
- Import: Settings → **Import from JSON**. Days are merged: for a day present in both, the more recently edited version wins.
- PIN: a 4–8 digit PIN, asked for when the app opens and after a minute in the background. Only a salted hash is stored. It is a privacy screen, not encryption. If you forget it, the only way in is to clear the site's data, so keep an export.

## Project layout

```
src/
  main.tsx, App.tsx      entry, PIN gate, hash routes
  db.ts                  Dexie database: entries, recaps, settings
  recaps.ts              making local, automatic and generated recaps
  sw.ts                  service worker: offline cache, push handling, weekly recap in the background, notification taps
  lib/
    dates.ts             local-date keys, weeks, schedule maths
    entry.ts             cleaning entries (blank parts are dropped)
    stats.ts             mood average, highest/lowest, mindfulness totals, week comparison
    recapPrompt.ts       the recap prompt and output schema
    recapApi.ts          the single Anthropic API call
    push.ts              talks to the push server
    reminders.ts, reminderClient.ts, pin.ts, exportData.ts, files.ts
  screens/               Home, CheckIn, Day, Recaps, RecapView, Settings, Lock
public/                  icons, favicon
worker/                  optional push server (Cloudflare Worker) for closed-app reminders and the weekly recap
scripts/make-icons.cjs   regenerates the PNG icons (needs Playwright)
```

Tests cover date logic, entry cleaning, the mood average, mindfulness totals, week stats and comparison, the recap prompt builder, reminders, PIN hashing, and export/import.
