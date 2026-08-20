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

MARKERS = {
    "UPDATED": "[data-updated]",
    "GRID": "[data-grid]",
    "CHANGELOG": "[data-changelog-wrap]",
}


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


def build_deal_schema(deals: list[dict]) -> dict:
    """Full ItemList/Product/Offer schema for every deal, independent of
    whatever's paginated into the visible grid -- Google should know about
    all of them even if a human only ever scrolls through the first page."""
    items = []
    for d in deals:
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

        name = f"{d.get('provider', '')} {d.get('tier', '')}".strip()
        deal_url = d.get("url") or "https://jrsdigital.net/deals/"
        items.append({
            "@type": "ListItem",
            "position": len(items) + 1,
            "item": {
                "@type": "Product",
                "name": name,
                "url": deal_url,
                "brand": {"@type": "Brand", "name": d.get("provider", "")},
                "category": {"nbn": "Internet Service", "opticomm": "Fibre Internet Service", "mobile": "Mobile Phone Service", "satellite": "Satellite Internet Service"}.get(
                d.get("serviceType"), "Internet Service"
            ),
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
        "name": "Australian NBN & Mobile Plan Deals",
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
    schema = build_deal_schema(all_deals)
    schema_html = '<script type="application/ld+json">\n' + json.dumps(schema, indent=2) + "\n</script>"

    html = DEALS_HTML.read_text(encoding="utf-8")
    for name, outer_html in captured.items():
        html = splice(html, name, outer_html)
    html = splice(html, "SCHEMA", schema_html)
    DEALS_HTML.write_text(html, encoding="utf-8")
    print(
        "Pre-rendered deals/index.html:",
        {k: len(v) for k, v in captured.items()},
        f"schema items: {len(schema['itemListElement'])}",
    )


if __name__ == "__main__":
    main()
