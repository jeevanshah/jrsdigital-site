"""Notify IndexNow (Bing, Yandex, Seznam, Naver; Bing feeds ChatGPT search and
Copilot) about pages that changed in the latest commit.

Usage: python scripts/indexnow_ping.py [--all]
  default  ping only pages whose HTML changed in HEAD (git diff HEAD~1 HEAD)
  --all    ping every URL in sitemap.xml (use once after setup)
"""
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
HOST = "jrsdigital.net"
SITE = f"https://{HOST}"


def find_key() -> str:
    for p in REPO_ROOT.glob("*.txt"):
        k = p.read_text(encoding="utf-8").strip()
        if p.stem == k and re.fullmatch(r"[0-9a-f]{32}", k):
            return k
    raise SystemExit("IndexNow key file (<key>.txt in repo root) not found")


def file_to_url(path: str) -> str | None:
    if not path.endswith(".html"):
        return None
    if path.endswith("index.html"):
        return f"{SITE}/{path[:-len('index.html')]}"
    return f"{SITE}/{path}"


def changed_urls() -> list[str]:
    out = subprocess.run(
        ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    ).stdout.split()
    urls = [file_to_url(p) for p in out]
    if "sitemap.xml" in out:
        urls.append(f"{SITE}/sitemap.xml")
    return sorted({u for u in urls if u})


def sitemap_urls() -> list[str]:
    xml = (REPO_ROOT / "sitemap.xml").read_text(encoding="utf-8")
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def main() -> int:
    key = find_key()
    urls = sitemap_urls() if "--all" in sys.argv else changed_urls()
    if not urls:
        print("IndexNow: nothing to submit")
        return 0
    body = json.dumps({
        "host": HOST,
        "key": key,
        "keyLocation": f"{SITE}/{key}.txt",
        "urlList": urls[:10000],
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow", data=body,
        headers={"Content-Type": "application/json; charset=utf-8"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(f"IndexNow: {resp.status} for {len(urls)} URLs")
    except urllib.error.HTTPError as e:
        # 202 = accepted pending key check; 4xx should not fail the deploy.
        print(f"IndexNow: HTTP {e.code} {e.reason}")
    except Exception as e:
        print(f"IndexNow: request failed ({e})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
