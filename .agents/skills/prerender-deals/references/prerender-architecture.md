# Pre-rendering Architecture & Reference

## Overview of `scripts/prerender.py`

The script executes the following end-to-end lifecycle:

1. **Local Server Setup**:
   Spawns `python -m http.server 8123` pointing to the repository root and waits for the server port to respond.
2. **Headless Chromium Execution**:
   - Launches Playwright Chromium.
   - Navigates to `http://localhost:8123/deals/` with `wait_until="networkidle"`.
   - Awaits selector `.deal-row` (timeout: 15s) to guarantee real data is fetched and hydrated.
   - Iteratively clicks the `[data-more]` "View more" button (up to 200 iterations) to expand the full catalog into the DOM.
   - Evaluates and extracts the `outerHTML` of 3 DOM markers:
     - `UPDATED`: `[data-updated]`
     - `GRID`: `[data-grid]`
     - `CHANGELOG`: `[data-changelog-wrap]`
3. **Structured Data Generation**:
   - Fetches `https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/deals.json`.
   - Constructs a complete `ItemList` with an array of `Product` and `Offer` entries with accurate `brand`, `category`, and pricing descriptions.
4. **HTML Splicing**:
   - Reads `deals/index.html`.
   - Uses regex pattern replacement on each `<!-- PRERENDER:{name}:START -->...<!-- PRERENDER:{name}:END -->` pair.
   - Overwrites `deals/index.html`.

## Marker Specifications

| Marker Name | HTML Start Tag | HTML End Tag | Captured Selector |
| :--- | :--- | :--- | :--- |
| `UPDATED` | `<!-- PRERENDER:UPDATED:START -->` | `<!-- PRERENDER:UPDATED:END -->` | `[data-updated]` |
| `GRID` | `<!-- PRERENDER:GRID:START -->` | `<!-- PRERENDER:GRID:END -->` | `[data-grid]` |
| `CHANGELOG` | `<!-- PRERENDER:CHANGELOG:START -->` | `<!-- PRERENDER:CHANGELOG:END -->` | `[data-changelog-wrap]` |
| `SCHEMA` | `<!-- PRERENDER:SCHEMA:START -->` | `<!-- PRERENDER:SCHEMA:END -->` | `<script type="application/ld+json">...</script>` |

## GitHub Actions CI Workflow

The workflow at `.github/workflows/prerender-deals.yml` runs on a scheduled cron or on workflow_dispatch:
- Sets up Python 3.11.
- Installs Playwright Chromium.
- Runs `python scripts/prerender.py`.
- Commits and pushes changes back to the repository using a bot identity if `git status --porcelain` detects modifications.
