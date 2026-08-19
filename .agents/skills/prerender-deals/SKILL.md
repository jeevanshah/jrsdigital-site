---
name: prerender-deals
description: >-
  Pre-renders the dynamic Australian deals page into static HTML and generates Schema.org JSON-LD
  for search engine crawlers using Playwright. Use when modifying deals data, UI templates, or
  preparing deals/index.html for deployment.
---

# Pre-render Deals Workflow

This skill guides running and troubleshooting the automated pre-rendering script `scripts/prerender.py` for the deals comparison engine in `deals/index.html`.

## Purpose

The deals engine fetches live plan data from GitHub raw JSON at runtime. To ensure search engine crawlers (Googlebot, Bingbot) and non-JavaScript clients can index the latest prices, providers, and structured data, `scripts/prerender.py` runs a headless Chromium browser using Playwright, expands the deals list, captures rendered HTML, and splices it into `deals/index.html` along with comprehensive Schema.org `ItemList`/`Product`/`Offer` JSON-LD.

---

## Execution Steps

### 1. Ensure Dependencies Are Available
The pre-rendering script requires Python 3.10+ and Playwright with Chromium installed:
```powershell
python -m pip install -r scripts/requirements.txt
python -m playwright install chromium
```

### 2. Run the Pre-render Script
Run from anywhere inside the repository (paths resolve relative to the repository root):
```powershell
python scripts/prerender.py
```

Optional arguments:
- `--port 8123`: Specify custom local HTTP port (default: 8123).
- `--base-url http://localhost:8000`: Use an already-running HTTP server rather than starting a new subprocess.

### 3. Verify Generated Output
Check the console output:
- It should log byte lengths for captured sections (`UPDATED`, `GRID`, `CHANGELOG`) and total Schema.org item count:
  ```text
  Pre-rendered deals/index.html: {'UPDATED': 182, 'GRID': 784210, 'CHANGELOG': 4210} schema items: 217
  ```
- Inspect `git diff deals/index.html` to confirm:
  - `<!-- PRERENDER:UPDATED:START -->` has the new timestamp.
  - `<!-- PRERENDER:GRID:START -->` has rendered `.deal-row` elements.
  - `<!-- PRERENDER:SCHEMA:START -->` contains valid JSON-LD.

### 4. Commit Pre-render Output
Always append `[skip ci]` when committing pre-render updates to avoid infinite GitHub Action triggering:
```powershell
git add deals/index.html
git commit -m "chore: pre-render deals page [skip ci]"
```

---

## Detailed References
- For marker structure and Playwright evaluation internals, see [prerender-architecture.md](./references/prerender-architecture.md).
