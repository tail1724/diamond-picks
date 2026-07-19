# Simplify to Top Picks + All Games by Date

The current dashboard buries the useful information under a hero, lineage panels, stats grid, gate lists, and a six-tile "Platform Workspaces" section. Nav also exposes seven power-user routes (Parlays, Lab, Scenario, Simulation, Replay, Ops, Models, Performance, Props, Settings). Goal: a fan opens the app and immediately sees today's best picks, and can flip to a full slate view for any date.

## New shape

Two primary views only:

1. **`/` — Top Picks** (default landing)
   - Small header: date + prev/next-day arrows + date picker
   - Section: **Top Picks Today** — the top 3–5 recommended games rendered with the existing `GameCard`, sorted by decision score
   - One-line explainer above the list (what "top pick" means, in plain English)
   - Link/tab to "See all games →"

2. **`/games` — All Games by Date**
   - Same date control at top
   - Every game on that date rendered with `GameCard` (grouped/sorted by start time ET)
   - Filter chip row: All · Recommended · Monitor (client-side)

## Nav simplification

Replace the current nav with just two items: **Top Picks** (`/`) and **All Games** (`/games`). Keep the Regenerate button. Move the workspace/research routes (`/parlays`, `/lab`, `/scenario`, `/simulation`, `/replay`, `/ops`, `/models`, `/performance`, `/props`) into a single "Advanced" dropdown in the header so power users still have access without cluttering the main surface. Keep `/settings` under a user icon.

## Removals from the landing page

- Hero paragraph, production-pipeline aside, stat cards row
- "TAIL Sports Score" ring + gate list panel
- "Model Lineage" panel
- "Platform Workspaces" 6-tile grid
- The AL/NL filter dropdown and sort selector (default sort = score)

These keep existing routes; they just leave the home page.

## Date navigation

`useSlate()` currently exposes a single slate. Add a date param:
- `/` reads today's slate as-is
- `/games` uses a search param `?date=YYYY-MM-DD` (via `validateSearch` + `fallback`), defaulting to `slate.date`
- Prev/next buttons update the search param; a real backend-backed date switch can come later. For now, if a requested date has no slate, show an empty state ("No games scheduled") — do not fabricate one.

## Technical notes

- Add `src/routes/games.tsx` with `validateSearch` (zod + `fallback`) for `date`.
- Rewrite `src/routes/index.tsx` to render only the Top Picks list + date strip + link to `/games`.
- Update `src/components/tail/Header.tsx` nav to the two-item version + Advanced dropdown; update `navItems` in `src/lib/tail/format.ts` accordingly (keep the other route definitions for the dropdown).
- Reuse `GameCard` unchanged — it already shows date, time, venue.
- Update `head()` titles/descriptions on `/` and `/games` to match the new focus.

## Out of scope

- No changes to forecasting, simulation, decision engine, or `GameCard` internals.
- Existing advanced routes remain reachable and unchanged.
