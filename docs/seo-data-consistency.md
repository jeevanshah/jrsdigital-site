# Price summaries and pre-rendering

The pre-renderer now selects the deals/bundles feed before opening Chromium and routes those feed requests to the selected snapshot. The table captures and generated schema therefore use the same pricing snapshot. By default, published data is preferred over local caches. A local fallback is logged, and `--data-dir` explicitly selects an offline snapshot without mixing in remote data.

The comparison hub signals `window.__DEALS_RENDERED__` only after its fetched catalog has rendered. Waiting for an existing `.deal-row` was insufficient because the previous static snapshot already contained rows. The mobile count/scope/sort paragraph is captured with its own paired `MOBILESUMMARY` marker; existing splice markers remain intact. The empty-results message already uses `hidden` and retains its existing behavior.

All speed-page count spans and introductory-price spans are refreshed during pre-rendering. The live controller updates both count fields, retains price cents and clears stale minimum prices for an empty filter. Existing first-year-cost dashboard fields retain that basis; monthly rate fields explicitly say Lowest intro price. NBN 50/100/1000 price FAQs now explain the comparison basis without maintaining a second set of static price ranges, and their visible answers match their FAQ JSON-LD.

## Checks

```powershell
python -m unittest discover -s tests -p "test_*.py"
node --check assets/speed-tier.js
python scripts/prerender.py
python scripts/build_provider_pages.py
```

For a reproducible local data snapshot:

```powershell
python scripts/prerender.py --data-dir "C:\path\to\au-plans-scraper\data"
```

Use `--browser-executable "C:\path\to\chromium.exe"` when reusing an existing Chromium installation; the default remains Playwright's browser.

Before deploying, verify summary/table agreement and filters at 360, 390, 430, 768 and 1440px. The initial prepared fix was checked with a local October 11 feed snapshot, not asserted to contain current commercial offers. Rebuild using published data before applying/deploying generated HTML. Do not manufacture a current verification timestamp for an old feed.

The existing workflow still runs the normal pre-renderer followed by the provider/homepage builder. Automated pre-render-only commits retain `[skip ci]`. No framework, provider price rule, affiliate route, telemetry configuration or publishing behavior is changed by this fix.
