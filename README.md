# Worklog — Personal Daily Work OS

A single-user work operating system for a UI/UX designer: capture the day's work in
seconds, update it as the day changes, turn it into a daily report in the evening, and
retrieve any of it years later.

> Open app → type task → Enter → continue.

Built with React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui and Lucide icons.

---

## Contents

1. [Quick start](#quick-start)
2. [The daily loop](#the-daily-loop)
3. [Keyboard shortcuts](#keyboard-shortcuts)
4. [Quick-add syntax](#quick-add-syntax)
5. [Architecture](#architecture)
6. [Storage: why IndexedDB now and Postgres later](#storage-why-indexeddb-now-and-postgres-later)
7. [Data model](#data-model)
8. [Routing](#routing)
9. [Project structure](#project-structure)
10. [Meetings](#meetings)
11. [Design system](#design-system)
12. [Environment variables](#environment-variables)
13. [Switching to Supabase](#switching-to-supabase)
14. [Backup, export and portability](#backup-export-and-portability)
15. [Notion integration](#notion-integration)
16. [Reminders](#reminders)
17. [PWA](#pwa)
18. [Deployment](#deployment)
19. [Scripts](#scripts)

---

## Quick start

```bash
npm install
cp env.example .env        # optional — the defaults work as-is
npm run dev                # http://localhost:5173
```

The app opens on **Today** with an empty database — no demo rows to clear out before the
archive becomes yours. Projects, requesters and tags are created as you go: type
`#Redesign` or `@David` in the quick-add box and they are added for you, or manage them
on **Projects & people**.

No account, no server, no database setup is required to start.

---

## The daily loop

**Morning.** The app opens on a full-screen check-in: the date, a greeting, and one large
field. Type a task, press Enter, type the next one. Nothing else is required — no project,
no requester, no time. Scroll down and the second act, today's plan, is waiting.

**During the day.** Scrolling past the greeting reveals the day as widgets — the plan, your
meetings, deliveries due, and a progress bar. Tick the checkbox to complete a task, or click
its status chip to move it to In Progress / Blocked / Cancelled. Click a task title to rename it inline. Tasks added
after the morning burst are automatically filed under **Added during the day** and flagged
`Unplanned`, so at review time you can see what was planned versus what arrived.

**Evening.** Press **Review my day**. The review page lists every task with its current
status for a quick confirm-or-correct pass, then asks for the only three things it cannot
derive: Issues / Challenges, Next Step, Notes. Press **Generate daily report**.

**Later.** History (calendar or list) → click 14 August → the report and the full work log
for that day. Or press `⌘K` and type anything you remember.

---

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Enter` | Add the task in the quick-add box |
| `⌘K` / `Ctrl K` | Global search (tasks, deliveries, reports, people, dates) |
| `Escape` | Close a dialog, sheet, popover, or clear the quick-add box |
| `Enter` / `Escape` | Commit / cancel an inline title edit |
| Scroll / click the chevron | Move between the check-in and today's plan |
| `↑ ↓ Enter` | Navigate any searchable dropdown (project, requester, delivery, tags) |

---

## Quick-add syntax

Optional. A plain sentence is always a valid task; these tokens just save a trip to the
details panel. What the parser found is echoed as chips under the input as you type.

| Token | Meaning | Example |
| --- | --- | --- |
| `@name` | Requester (created if unknown) | `@David`, `@"Marketing Team"` |
| `#name` | Project (created if unknown); a second `#tag` becomes a tag | `#CSM`, `#"Reddot CRM"` |
| `09:30`, `at 9` | Planned time | `Standup at 9` |
| `today`, `tomorrow`, `friday`, `aug 28`, `2026-08-28` | Target delivery date | `Send deck tomorrow` |
| `!high`, `!urgent`, `!low` | Priority | `Fix login !urgent` |

```
Revise CSM Calendar @David #CSM tomorrow 09:30 !high
```
becomes: *Revise CSM Calendar* · project CSM · requested by David · planned 09:30 ·
target tomorrow · priority High.

---

## Architecture

```
 React components          presentation only, no data access
        ↓
 hooks/ (TanStack Query)   caching, invalidation, loading + error state
        ↓
 services/                 business rules (status stamps, unplanned detection,
        ↓                  report generation, search, export, Notion payloads)
 repositories/             the persistence contract — one interface, N drivers
        ↓
 IndexedDB (Dexie)  |  Postgres (Supabase)
```

Rules the codebase holds to:

- **No component ever touches the database.** `getRepository()` is called only from
  `src/services/**`. Swapping the storage engine touches one folder.
- **One place per concept.** Status labels and colours live in `src/constants/status.ts`;
  routes in `src/constants/navigation.ts`; query keys in `src/hooks/queryKeys.ts`. There are
  no hardcoded status strings or project names scattered through components.
- **Server state is the only state.** Everything persisted is server state, so TanStack Query
  owns it. What remains genuinely client-side (which sheet is open, the current filter) is
  local `useState`. There is no Redux/Zustand store to keep in sync with the database — a
  global store here would be a second, staler copy of the same rows.
- **Validation at the edge.** Zod schemas in `src/schemas/` validate every form; errors are
  rendered inline and wired with `aria-describedby`. No `alert()`.
- **Audit stamps are written by the service, not the form.** `startedAt`, `completedAt`,
  `deliveredAt` and the activity log are set in `setTaskStatus` / `updateDelivery`, so a
  checkbox, a status chip and the edit sheet all produce identical history.

---

## Storage: why IndexedDB now and Postgres later

The brief asked for a free, relational, low-maintenance, exportable, non-locked-in store.
Nothing satisfies *all* of that on day one, so the app ships with **two drivers behind one
interface**.

| Option | Free tier | Relational | Setup | Trade-off |
| --- | --- | --- | --- | --- |
| **IndexedDB (Dexie)** — default | Unlimited | Indexed key-value with joins in the service layer | None | Single browser; no sync; you own the backups |
| **Supabase (Postgres)** — recommended long-term | 500 MB DB, 2 projects | Yes, real SQL + FKs + RLS | ~10 minutes | Free project pauses after 7 days of inactivity (a daily-use app never hits this) |
| Neon (Postgres) | 0.5 GB | Yes | Medium | No client SDK — you must build and host an API layer |
| Firebase | Generous | No — document store | Low | Task ↔ Delivery ↔ Project ↔ Tag joins fight the model; heaviest vendor lock-in |
| SQLite (WASM + OPFS) | Free | Yes | Medium | Best local SQL, but sync/backup is entirely DIY and browser support is uneven |

**Recommendation: start on IndexedDB, move to Supabase when you want a second device.**

You get a working app in one `npm install`, and the migration is a `.env` change plus one SQL
file — not a rewrite — because `src/repositories/types.ts` is the only contract the rest of
the app knows about. `src/repositories/index.ts` is the single place that decides which driver
is live.

Both drivers return byte-identical domain objects, and they share the same filter predicates
(`src/repositories/filters.ts`) so search behaves the same on either.

---

## Data model

```
Project ──┐                      Requester ──┐
          │                                  │
          ├──< Delivery >────┬───────────────┤
          │                  │               │
          └──< Task >────────┘               │
                 │  (Task.deliveryId)        │
                 └──────────────────────────-┘

Task >──< Tag        (task_tags)
Delivery >──< Tag    (delivery_tags)
DailyReport ── date ── Task    (a report is derived from the day's tasks)
Meeting >── MeetingLog   (a schedule + what happened on each date)
ActivityLog ── entity + entityId  (append-only audit trail)
```

Notable decisions:

- **`date` is a local calendar day** (`YYYY-MM-DD`), never a timestamp. Building it with
  `toISOString().slice(0,10)` would file evening work under tomorrow for anyone east of UTC;
  `src/lib/date.ts` is the only module allowed to construct one.
- **`Task.targetDate`** was added to the suggested schema. Not every task worth a due date
  deserves a full Delivery record; when both exist the Delivery's target wins in the UI.
- **`Task.isPlanned`** distinguishes the morning plan from mid-day arrivals. It is inferred
  (anything typed more than 90 minutes after the day's first entry is unplanned) and always
  overridable.
- **`DailyReport.summary`** is a snapshot taken at generation time, so a report stays truthful
  even if tasks are edited later.
- **`DailyReport.bodyOverride`** lets you hand-edit the generated markdown without losing the
  structured data underneath.
- **Deleting a lookup value never destroys history.** Deleting a project or requester clears
  the reference on affected tasks and deliveries; deleting a delivery unlinks its tasks.

- **Meetings are a rule, not a row per day.** See [Meetings](#meetings).

Full definitions with comments: [`src/types/domain.ts`](src/types/domain.ts).

---

## Routing

| Path | Page |
| --- | --- |
| `/` | Redirects to `/today` |
| `/today` | Daily check-in — the default page |
| `/review` | End-of-day review (`?date=YYYY-MM-DD` to review another day) |
| `/history` | Calendar + list views of the archive |
| `/history/:date` | One day: the daily report and its work log |
| `/deliveries` | Delivery tracker |
| `/deliveries/:id` | Delivery detail + related daily tasks + activity |
| `/meetings` | Recurring meeting schedules |
| `/dashboard` | Secondary overview |
| `/projects` | Projects, requesters and tags — create, edit, archive, delete |
| `/search` | Structured search with filters |
| `/settings` | Profile, reminders, export/backup, integrations |

`/today` is bundled eagerly; every other route is lazy-loaded so the morning path stays small.

---

## Project structure

```
src/
  components/
    ui/            shadcn/ui primitives (button, dialog, command, table, …)
    common/        cross-domain building blocks (Widget, StatTile, PageHeader, EmptyState,
                   FilterBar, Combobox, DatePicker, TagPicker, StatusChip, ActivityTimeline)
    catalog/       ProjectFormDialog, RequesterFormDialog
    meetings/      MeetingFormDialog, MeetingList
    layout/        AppShell, Sidebar, MobileNav, Page
    tasks/         TaskQuickAdd, TaskRow, TaskList, TaskMetadata, TaskDetailsSheet
    deliveries/    DeliveryTable, DeliveryFormSheet
    reports/       DailyReviewChecklist, DailyReportEditor, DailyReportSummary, ReportMarkdown
    history/       MonthCalendar, DaySummaryList
    search/        GlobalSearch (⌘K palette)
  pages/           one file per route
  hooks/           TanStack Query hooks, toast store, keyboard shortcuts
  services/        business logic (task, delivery, report, search, export, backup,
                   catalog, notion, reminder, seed, quickParse)
  repositories/    persistence contract + local (Dexie) and supabase (Postgres) drivers
  integrations/    notion/ — client interface, mock client, proxy client
  schemas/         Zod schemas for every form and the backup file
  types/           domain model
  constants/       statuses, colours, navigation, routes
  lib/             utils, date handling, env
scripts/           headless smoke checks, their fixtures, and a CDP UI driver
supabase/          SQL migrations
docs/              Notion proxy example
```

---

## Meetings

A meeting is stored **once as a rule**, not as a row per day. "Every weekday at 09:15" is a
single record; the app expands it against a date when it renders one. Writing 250 rows a year
for a stand-up would make the schedule impossible to edit and the archive impossible to trust.

| Recurrence | Applies on |
| --- | --- |
| `daily` | Every calendar day |
| `weekdays` | Monday–Friday |
| `weekly` | The ISO weekdays listed on the meeting (1 = Monday … 7 = Sunday) |
| `once` | A single date |

An optional `startDate` / `endDate` window bounds any of them, and pausing a schedule
(`isActive: false`) keeps its history while removing it from Today.

**What actually happened** lives in a second table, `MeetingLog` — one row per meeting per
date, created lazily the first time you mark it attended or skipped. An untouched day stores
nothing at all.

Meetings show up in four places, all derived from the same expansion:

- **Today** — a widget listing the day's meetings, with attend / skip in one click;
- **Review and the daily report** — a *Meetings* section, so a report reflects the whole day
  rather than only the typed tasks;
- **History** — a dot on every calendar day that has meetings;
- **Excel export** — a Meetings sheet across the exported range.

Manage schedules on **/meetings**, which also shows how many hours a week your recurring
meetings already commit you to.

---

## Design system

The interface is built to be opened every morning without friction, so it is deliberately
quiet.

**Colour budget: four families.** Neutral for "nothing to do yet", the brand blue for
"actively moving", amber for "stuck or waiting", emerald for "done". Every status in the app
maps onto one of those — seven delivery statuses share four tints rather than inventing seven
hues. All of it lives in `src/constants/status.ts`; no component names a colour.

**Status chips only when they add information.** A ticked checkbox already says "done" and an
unticked one already says "planned", so those two statuses render no chip at all. Most rows
on a normal day are chip-free.

**Metadata never competes with the task.** The second line is capped at three items and
collapses the rest into a `+N`; the title is the only thing at full contrast.

**Motion.** One easing curve (`cubic-bezier(0.32, 0.72, 0, 1)`, exposed as `ease-fluid`) and
one entrance animation (`animate-rise`, staggered with `--rise-delay`). Buttons scale on
press. The Today hero fades and drifts as the plan scrolls into view, which is a single
rAF-throttled scroll read in `useScrollProgress`. Everything is disabled under
`prefers-reduced-motion`.

**One surface, used everywhere.** Every page is built from `<Widget>` (a card with a
consistent header rhythm) and `<StatTile>` (a single number worth looking at), laid out with
`<WidgetGrid>`. Projects, people and meetings are cards for the same reason: each is a thing
with a shape — a colour, a code, a workload — not a line in a list. When every page is made of
the same block, the app reads as one product rather than eight screens that share a sidebar.

**Layout.** `<main>` is the scroll container rather than the document — that is what lets
Today stack two full-viewport sections with `scroll-snap` while the sidebar and mobile bar
stay fixed. Pages wrap in `<Page>`, which fills the workspace (a 700px column floating in the
middle of a 1440px screen wastes the room it has) and owns the padding Today opts out of.

**Type.** `-apple-system` first, so it renders in SF Pro on Apple platforms. Tighter tracking
as size increases, matching how SF Pro Display behaves.

---

## Environment variables

Copy `env.example` to `.env`. Every variable is optional; the defaults run the app on local
storage with mock Notion.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_DB_DRIVER` | `local` | `local` (IndexedDB) or `supabase` |
| `VITE_SUPABASE_URL` | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | — | Supabase anon key (safe in the browser **only** with RLS on) |
| `VITE_NOTION_DRIVER` | `mock` | `mock` (clipboard) or `proxy` (real sync) |
| `VITE_NOTION_PROXY_URL` | — | URL of your serverless Notion function |
| `VITE_NOTION_REPORTS_DATABASE_ID` | — | Notion database for daily reports |
| `VITE_NOTION_DELIVERIES_DATABASE_ID` | — | Notion database for deliveries |

If `VITE_DB_DRIVER=supabase` but the URL or key is missing, the app falls back to local
storage and shows a banner rather than failing to boot.

**Never put a Notion integration token in a `VITE_` variable** — those are compiled into the
JavaScript your browser downloads.

---

## Switching to Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the migrations in order:
   [`0001_init.sql`](supabase/migrations/0001_init.sql) then
   [`0002_meetings.sql`](supabase/migrations/0002_meetings.sql). They create the tables, enums,
   indexes, `updated_at` triggers and row-level-security policies that scope every row to
   `auth.uid()`.
3. Put the project URL and anon key in `.env` and set `VITE_DB_DRIVER=supabase`.
4. Sign in (Supabase Auth) so `auth.uid()` resolves — with RLS enabled an anonymous client
   sees zero rows, which is the point.
5. Migrate existing data: **Settings → Export all data (JSON)** on the local build, then
   **Import backup** on the Supabase build. Ids are preserved, so the relational graph
   survives the move intact.

No component or hook changes. The Supabase SDK is dynamically imported, so a `local` build
never ships it.

---

## Backup, export and portability

| Output | Where | Contents |
| --- | --- | --- |
| **Excel — daily** | Day page → Excel | Summary sheet, Work Log sheet, Daily Report sheet |
| **Excel — month** | History → Export month | Same three sheets for the whole month |
| **Excel — date range** | Settings → Data | Pick any two dates |
| **Excel — deliveries** | Deliveries → Export | Delivery table + a sheet of the daily tasks behind each one |
| **CSV** | Search → Export CSV, Settings → Data | Flat work-log rows |
| **JSON backup** | Settings → Export all data | Every row of every table, with ids |

**Reset all data** (Settings → Data) deletes every task, delivery, report, project, person and
tag after an explicit confirmation, keeping your settings. Use it once if you are upgrading
from a build that shipped demo rows.

Excel columns are human labels — `Date`, `Task`, `Project`, `Requester`,
`Planned / Unplanned`, `Status`, `Priority`, `Planned Time`, `Start Time`, `End Time`,
`Target Delivery`, `Actual Delivery`, `Delivery`, `Tags`, `Notes` — with frozen headers and
fitted column widths. No ids, no enum codes, no raw table dumps.

**Import backup** (Settings → Data) replaces the entire database with the contents of a JSON
file, after an explicit confirmation. Because ids round-trip, exporting and re-importing is
lossless and works across drivers.

Excel/CSV generation uses [SheetJS](https://sheetjs.com) (Apache-2.0) and is dynamically
imported — a session that never exports never downloads the library.

---

## Notion integration

Notion is an *optional output*, never a dependency. The app produces neutral payloads
(`src/integrations/notion/types.ts`) and hands them to a `NotionClient`:

```
services/notionService.ts    builds the payload from domain objects
        ↓
integrations/notion/index.ts chooses the client from VITE_NOTION_DRIVER
        ↓
mockClient  (default)        logs + copies the markdown to your clipboard
proxyClient (opt-in)         POSTs to your serverless function, which holds the token
```

**Today (mock mode).** "Send to Notion" on a daily report or a delivery copies the exact
markdown a real sync would post. Paste it into Notion and the result is the same — the
feature is useful before any credentials exist.

**Enabling the real sync.**

1. Create a Notion internal integration, copy the token, and share your target databases with it.
2. Deploy [`docs/notion-proxy.example.ts`](docs/notion-proxy.example.ts) as a serverless
   function (Vercel `api/notion.ts`, Netlify `netlify/functions/notion.ts`, or a Supabase Edge
   Function). Set `NOTION_TOKEN` in that platform's environment.
3. Set in `.env`:
   ```
   VITE_NOTION_DRIVER=proxy
   VITE_NOTION_PROXY_URL=https://your-app.vercel.app/api/notion
   VITE_NOTION_REPORTS_DATABASE_ID=…
   VITE_NOTION_DELIVERIES_DATABASE_ID=…
   ```

That is the whole change. No service, hook or component is touched, because nothing above the
integration layer knows Notion exists. Each daily report becomes one page with
`Date / Completed / In Progress / Blocked / Unplanned` properties and the five report sections
as blocks; each delivery becomes a page with its dates, status and its related work log.

---

## Reminders

`src/services/reminderService.ts` schedules a morning ("What are you working on today?") and
an evening ("Ready to review your day?") notification. Enable them in **Settings → Reminders**;
the browser asks for permission on first enable, and a **Test** button verifies the flow
without waiting until 09:00.

The current implementation is an in-tab timer plus the Notification API — deliberately the
smallest thing that works, and sufficient when the app is pinned as a PWA. The escalation path
needs no rewrite because everything goes through `scheduleReminders(settings)`:

1. **In-tab timer** — today. Fires while the app is open.
2. **Service worker + Periodic Background Sync** — replace `notify()` with a message to the
   service worker. Fires when the PWA is installed but closed. Chromium only.
3. **Server cron + Web Push** — replace `notify()` with a push subscription. The schedule
   already lives on `AppSettings` (`morningReminderTime`, `eveningReminderTime`), so a backend
   job can read it directly. This is the only option that works with the browser fully closed
   on every platform.

Recommended: stay on (1) while the app is local-first; move to (3) at the same time you move
to Supabase, since you will then have a server that already knows your schedule.

---

## PWA

`public/manifest.webmanifest` plus a dependency-free service worker (`public/sw.js`) make the
app installable on desktop and mobile. Chrome/Edge: install icon in the address bar. Safari on
iOS: Share → Add to Home Screen.

The service worker uses network-first for navigations (falling back to the cached shell when
offline) and stale-while-revalidate for assets. It is registered in production builds only —
in dev it would serve stale modules and break HMR. Your data is already offline-capable on the
local driver, so an installed app works with no network at all.

---

## Deployment

Any static host — the app is a pure SPA.

```bash
npm run build      # dist/
npm run preview    # verify the production build locally
```

**Vercel / Netlify / Cloudflare Pages:** build command `npm run build`, output directory `dist`.
Add an SPA rewrite so deep links like `/history/2026-08-14` reach `index.html`:

```
# netlify.toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
```json
// vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

With the local driver, data lives in the browser of whatever device you install it on —
deploying to a URL does not move your data between devices. Use Supabase for that.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Typecheck, then production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | Headless checks of quick-add parsing, dates, filters, report rendering |
| `npm run smoke:db` | Full repository → services → report integration run against a fake IndexedDB |
| `npm run check` | All three |

`smoke:db` builds its own fixtures through the public service layer (`scripts/fixtures.ts` —
the shipped app has no demo data) and then exercises quick-add with catalog resolution, status
transitions and their audit stamps, project/requester editing, delivery revision and
delivery-date side effects, meeting recurrence expansion and lazy logging, report upsert, day
summaries, search by title/person/project, carry-over, reference clearing on delete, and a
backup round-trip.

`scripts/uiDrive.mjs` is a manual helper, not part of the suite: with `npm run preview` and a
headless Chrome on `--remote-debugging-port=9222`, it seeds the app through its own UI and
screenshots any route (`node scripts/uiDrive.mjs shot /today /dashboard`).
