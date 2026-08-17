"""Pre-renders the deals page's dynamic sections into static HTML so
crawlers that don't execute JavaScript still see real pricing data.

The page's own client-side JS always rebuilds these sections' innerHTML
from freshly fetched JSON regardless of what was already there, so this
snapshot is a starting point for first paint / crawlers, not something
the JS needs to know about or reconcile with.

Usage: python scripts/prerender.py [--port 8123] [--base-url URL]
Run from anywhere; paths are resolved relative to the repo root.
"""
import argparse
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).parent.parent
DEALS_HTML = REPO_ROOT / "deals" / "index.html"

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
            # networkidle alone covers all three independent fetches (deals,
            # changelog, poi) settling, but assert real rows actually landed
            # rather than silently snapshotting a stuck "Loading..." state.
            page.wait_for_selector(".deal-row", timeout=15000)

            captured = {
                name: page.eval_on_selector(selector, "el => el.outerHTML")
                for name, selector in MARKERS.items()
            }
            browser.close()
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=5)

    html = DEALS_HTML.read_text(encoding="utf-8")
    for name, outer_html in captured.items():
        html = splice(html, name, outer_html)
    DEALS_HTML.write_text(html, encoding="utf-8")
    print("Pre-rendered deals/index.html:", {k: len(v) for k, v in captured.items()})


if __name__ == "__main__":
    main()
