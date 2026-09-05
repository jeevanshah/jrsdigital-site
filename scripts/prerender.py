"""Pre-renders the deals page's dynamic sections into static HTML so
crawlers that don't execute JavaScript still see real pricing data, plus
generates Product/ItemList JSON-LD for the full deals catalog (not just
whatever's paginated into view) so Google has structured data on every
plan regardless of on-page pagination.

The page's own client-side JS always rebuilds these sections' innerHTML
from freshly fetched JSON regardless of what was already there, so this
snapshot is a starting point for first paint / crawlers, not something
the JS needs to know about or reconcile with.

Usage: python scripts/prerender.py [--port 8123] [--base-url URL]
Run from anywhere; paths are resolved relative to the repo root.
"""
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).parent.parent
DEALS_HTML = REPO_ROOT / "deals" / "index.html"

# Must match DATA_URL in deals/index.html.
DEALS_JSON_URL = "https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/deals.json"
BUNDLES_JSON_URL = "https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/bundles.json"

MARKERS = {
    "UPDATED": "[data-updated]",
    "GRID": "[data-grid]",
    "CHANGELOG": "[data-changelog-wrap]",
}

SPEED_PAGES = [
    ("nbn-50", "NBN 50", REPO_ROOT / "deals" / "nbn-50" / "index.html"),
    ("nbn-100", "NBN 100", REPO_ROOT / "deals" / "nbn-100" / "index.html"),
    ("nbn-1000", "NBN 1000", REPO_ROOT / "deals" / "nbn-1000" / "index.html"),
]


def base_bucket_key(raw_tier):
    if not raw_tier:
        return "Other"
    m = re.search(r"(\d+)", str(raw_tier))
    if not m:
        return str(raw_tier)
    speed = int(m.group(1))
    if speed <= 12:
        return "NBN 12"
    if speed <= 30:
        return "NBN 25"
    if speed <= 60:
        return "NBN 50"
    if speed <= 150:
        return "NBN 100"
    if speed <= 350:
        return "NBN 250"
    if speed <= 600:
        return "NBN 500"
    if speed <= 800:
        return "NBN 750"
    if speed <= 1200:
        return "NBN 1000"
    return "NBN 2000"


def wait_for_server(url, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f"Local server never came up at {url}")


def splice(html: str, name: str, replacement: str) -> str:
    start = f"<!-- PRERENDER:{name}:START -->"
    end = f"<!-- PRERENDER:{name}:END -->"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    new_html, count = pattern.subn(start + replacement + end, html, count=1)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {name} marker pair, found {count}")
    return new_html


def billing_cycle_label(days: int | None) -> str:
    """Human-readable cadence matching the labels used by the live table."""
    days = days or 30
    if 29 <= days <= 31:
        return "month"
    if days == 7:
        return "week"
    if days == 14:
        return "fortnight"
    if 80 <= days <= 95:
        return "3 months"
    if 175 <= days <= 190:
        return "6 months"
    if 360 <= days <= 370:
        return "year"
    return f"{days} days"


def build_deal_schema(deals: list[dict], bundles: list[dict] | None = None) -> dict:
    """Full ItemList/Product/Offer schema for every deal and bundle package,
    independent of whatever's paginated into the visible grid -- Google should
    know about all of them even if a human only ever scrolls through the first page."""
    items = []
    catalog = list(deals) + (list(bundles) if bundles else [])
    for d in catalog:
        promo = d.get("promoPrice")
        regular = d.get("regularPrice")
        months = d.get("promoMonths")
        price = promo if promo is not None else regular
        if price is None:
            continue

        promo = float(promo) if promo is not None else None
        regular = float(regular) if regular is not None else None
        price = float(price)
        cycle = billing_cycle_label(d.get("billingCycleDays"))
        cycle_phrase = f"per {cycle}"

        if promo is not None and regular is not None and promo != regular and months:
            month_word = "month" if int(months) == 1 else "months"
            description = (
                f"Introductory charge ${promo:.2f} {cycle_phrase} for {months} {month_word}, "
                f"then ${regular:.2f} {cycle_phrase} ongoing."
            )
        else:
            ongoing = regular if regular is not None else price
            description = f"${ongoing:.2f} {cycle_phrase}, with no introductory period."

        name = d.get("title") or f"{d.get('provider', '')} {d.get('tier', '')}".strip()
        if not name.startswith(d.get("provider", "")):
            name = f"{d.get('provider', '')} {name}".strip()
        deal_url = d.get("url") or "https://jrsdigital.net/deals/"
        items.append({
            "@type": "ListItem",
            "position": len(items) + 1,
            "item": {
                "@type": "Product",
                "name": name,
                "url": deal_url,
                "brand": {"@type": "Brand", "name": d.get("provider", "")},
                "category": {
                    "nbn": "Internet Service",
                    "opticomm": "Fibre Internet Service",
                    "mobile": "Mobile Phone Service",
                    "satellite": "Satellite Internet Service",
                    "bundle": "Bundled Internet and Mobile Service",
                }.get(d.get("serviceType"), "Internet Service"),
                "description": description,
                "offers": {
                    "@type": "Offer",
                    "price": f"{price:.2f}",
                    "priceCurrency": "AUD",
                    "url": deal_url,
                    "availability": "https://schema.org/InStock",
                    "eligibleRegion": {
                        "@type": "Country",
                        "name": "Australia",
                    },
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": f"{price:.2f}",
                        "priceCurrency": "AUD",
                        "unitText": cycle,
                    },
                },
            },
        })

    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Australian NBN, Mobile & Bundle Deals",
        "numberOfItems": len(items),
        "itemListElement": items,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8123)
    parser.add_argument("--base-url", default=None, help="Skip starting a local server and use this URL instead")
    args = parser.parse_args()

    server = None
    base_url = args.base_url
    if base_url is None:
        base_url = f"http://localhost:{args.port}"
        server = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(args.port)],
            cwd=REPO_ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        wait_for_server(base_url)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(f"{base_url}/deals/", wait_until="networkidle", timeout=30000)
            page.wait_for_selector(".deal-row, .deals-card", state="attached", timeout=15000)

            # Default pagination only shows the first page of results (cheapest
            # ~8) -- expand fully via the real "View more" control so the
            # snapshot represents the whole (default-tab) catalog, not an
            # arbitrary slice.
            more_button = page.locator("[data-more]")
            for _ in range(200):  # generous cap, not an expected iteration count
                if not more_button.is_visible():
                    break
                more_button.click()
                page.wait_for_timeout(100)

            captured = {
                name: page.eval_on_selector(selector, "el => el.outerHTML")
                for name, selector in MARKERS.items()
            }

            speed_grids = {}
            for slug, target_tier, sp_path in SPEED_PAGES:
                try:
                    page.goto(f"{base_url}/deals/{slug}/", wait_until="networkidle", timeout=30000)
                    page.wait_for_selector(".deal-entry, .deal-row", state="attached", timeout=15000)
                    speed_grids[slug] = page.eval_on_selector("[data-grid]", "el => el.outerHTML")
                except Exception as e:
                    print(f"Warning: could not prerender speed page {slug}: {e}")

            browser.close()
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=5)

    try:
        with urllib.request.urlopen(DEALS_JSON_URL, timeout=15) as resp:
            all_deals = json.loads(resp.read())
    except Exception:
        local_candidates = [
            REPO_ROOT / "data" / "deals.json",
            REPO_ROOT.parent / "au-plans-scraper" / "data" / "deals.json",
        ]
        local_path = next((path for path in local_candidates if path.exists()), None)
        if local_path:
            all_deals = json.loads(local_path.read_text(encoding="utf-8"))
        else:
            raise
    all_bundles = []
    try:
        with urllib.request.urlopen(BUNDLES_JSON_URL, timeout=15) as resp:
            all_bundles = json.loads(resp.read())
    except Exception:
        local_bundles_candidates = [
            REPO_ROOT / "data" / "bundles.json",
            REPO_ROOT.parent / "au-plans-scraper" / "data" / "bundles.json",
        ]
        local_b_path = next((path for path in local_bundles_candidates if path.exists()), None)
        if local_b_path:
            all_bundles = json.loads(local_b_path.read_text(encoding="utf-8"))

    schema = build_deal_schema(all_deals, all_bundles)
    schema_html = '<script type="application/ld+json">\n' + json.dumps(schema, indent=2) + "\n</script>"

    plan_count = len(all_deals)
    provider_count = len({d["provider"] for d in (all_deals + all_bundles) if d.get("provider")})
    # Two presentations share this one marker: the long descriptive sentence
    # (desktop) and a compact "N plans / M providers" label (mobile) -- see
    # the .deals-hero-longform/.deals-hero-compact CSS toggle in
    # site-deals.css. Keeping both in the single HEROSTATS splice point
    # avoids a second marker just to restate the same two numbers.
    herostats_html = (
        f'<strong>{plan_count}</strong>'
        f'<span class="deals-hero-longform"> NBN, OptiComm, mobile, satellite and bundle plans from </span>'
        f'<span class="deals-hero-compact"> plans</span>'
        f'<span class="deals-hero-dot"> &bull; </span>'
        f'<strong>{provider_count}</strong>'
        f'<span class="deals-hero-longform"> Australian providers</span>'
        f'<span class="deals-hero-compact"> providers</span>'
    )

    html = DEALS_HTML.read_text(encoding="utf-8")
    for name, outer_html in captured.items():
        html = splice(html, name, outer_html)
    html = splice(html, "SCHEMA", schema_html)
    html = splice(html, "HEROSTATS", herostats_html)
    DEALS_HTML.write_text(html, encoding="utf-8")
    print(
        "Pre-rendered deals/index.html:",
        {k: len(v) for k, v in captured.items()},
        f"schema items: {len(schema['itemListElement'])}",
    )

    for slug, target_tier, sp_path in SPEED_PAGES:
        if not sp_path.exists():
            continue
        tier_deals = [
            d for d in all_deals
            if d.get("serviceType") == "nbn" and base_bucket_key(d.get("tier")) == target_tier
        ]
        tier_schema = build_deal_schema(tier_deals)
        tier_schema["name"] = f"Cheapest {target_tier} Plans Australia"
        tier_schema_html = '<script type="application/ld+json">\n' + json.dumps(tier_schema, indent=2) + "\n</script>"

        sp_html = sp_path.read_text(encoding="utf-8")
        if slug in speed_grids:
            sp_html = splice(sp_html, "GRID", speed_grids[slug])
        sp_html = splice(sp_html, "SCHEMA", tier_schema_html)
        sp_path.write_text(sp_html, encoding="utf-8")
        print(f"Pre-rendered deals/{slug}/index.html: {len(tier_deals)} schema items")


if __name__ == "__main__":
    main()
