"""Builds one static page per provider (/deals/providers/<slug>/), a provider
index (/deals/providers/), the provider link list on /deals/, and the
provider block in sitemap.xml -- all from the scraper's published data.

Everything on these pages is generated from data (plans, policies, recorded
price changes). No hand-written claims, so pages stay accurate as data moves.

Usage: python scripts/build_provider_pages.py
Run after scripts/prerender.py (same CI job). Needs no browser.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from prerender import (  # noqa: E402
    REPO_ROOT,
    base_bucket_key,
    billing_cycle_label,
    build_deal_schema,
    render_mobile_page_grid,
    render_speed_page_grid,
    splice,
)

SITE = "https://jrsdigital.net"
RAW = "https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/"
TEMPLATE = REPO_ROOT / "deals" / "nbn-50" / "index.html"
OUT_DIR = REPO_ROOT / "deals" / "providers"
HUB_HTML = REPO_ROOT / "deals" / "index.html"
HOME_HTML = REPO_ROOT / "index.html"
HWC_HTML = REPO_ROOT / "how-we-compare" / "index.html"
CHANGES_DIR = REPO_ROOT / "deals" / "price-changes"
HOME_TIERS = [  # (label, bucket or "mobile", page path)
    ("NBN 25", "NBN 25", "/deals/nbn-25/"),
    ("NBN 50", "NBN 50", "/deals/nbn-50/"),
    ("NBN 100", "NBN 100", "/deals/nbn-100/"),
    ("NBN 250", "NBN 250", "/deals/nbn-250/"),
    ("NBN 1000", "NBN 1000", "/deals/nbn-1000/"),
    ("Mobile SIM", "mobile", "/deals/mobile-plans/"),
]
SITEMAP = REPO_ROOT / "sitemap.xml"
STALE_AFTER_FAILURES = 3
BROADBAND_TYPES = ("nbn", "opticomm", "satellite")
TYPE_LABEL = {"nbn": "NBN", "opticomm": "OptiComm", "satellite": "satellite", "mobile": "mobile"}
SPEED_PAGES = {"NBN 50": "nbn-50", "NBN 100": "nbn-100", "NBN 250": "nbn-250", "NBN 1000": "nbn-1000"}
CHEVRON = ('<svg class="deals-faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
           '<path d="m6 9 6 6 6-6"/></svg>')


def esc(s) -> str:
    return html.escape(str(s if s is not None else ""))


def money(v) -> str:
    v = float(v)
    return f"${v:,.0f}" if v == int(v) else f"${v:,.2f}"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ---------------------------------------------------------------- data

def load(name: str, default):
    for base in (REPO_ROOT.parent / "au-plans-scraper" / "data",
                 REPO_ROOT.parent / "Desktop" / "au-plans-scraper" / "data",
                 REPO_ROOT / "data"):
        p = base / name
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    try:
        with urllib.request.urlopen(RAW + name, timeout=20) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"Notice: could not load {name} ({e}); continuing without it")
        return default


def js_meta() -> tuple[dict, dict]:
    """Provider policy + mobile network metadata, parsed from the JS files the
    live pages already use, so there is one place to edit them."""
    policy = {}
    src = (REPO_ROOT / "assets" / "speed-tier.js").read_text(encoding="utf-8")
    for m in re.finditer(r"'([^']+)':\s*\{\s*cgnat:\s*'(\w+)',\s*notice:\s*'(\w+)'(?:,\s*cisUrl:\s*'([^']*)')?", src):
        policy[m.group(1)] = {"cgnat": m.group(2), "notice": m.group(3), "cisUrl": m.group(4)}
    network = {}
    src = (REPO_ROOT / "assets" / "mobile-plans.js").read_text(encoding="utf-8")
    for m in re.finditer(r"'([^']+)':\s*\{\s*network:\s*'([^']+)',\s*popCoverage:\s*'([^']+)'", src):
        network[m.group(1)] = {"network": m.group(2), "coverage": m.group(3)}
    return policy, network


def first_year(d: dict) -> float:
    """Total cost over the first 12 months. Mirrors calc_costs() in
    prerender.render_mobile_page_grid and the speed-page sort, so the numbers
    here always match the grids on the same page."""
    def num(v, cast=float):
        try:
            return cast(v or 0)
        except (TypeError, ValueError):
            return cast(0)
    promo, regular = num(d.get("promoPrice")), num(d.get("regularPrice"))
    months, days = num(d.get("promoMonths"), int), num(d.get("billingCycleDays"), int) or 30
    has_promo = promo > 0 and months > 0 and promo != regular
    reg = regular if regular > 0 else promo
    if 360 <= days <= 370:
        return promo if promo > 0 else regular
    if 170 <= days <= 190:
        return (promo if promo > 0 else regular) * 2
    if days == 28:
        n = min(months, 13)
        return promo * n + reg * (13 - n) if has_promo else reg * 13
    if days == 7:
        return reg * 52
    n = min(months, 12)
    return promo * n + reg * (12 - n) if has_promo else reg * 12


def per_cycle(d: dict) -> str:
    return billing_cycle_label(d.get("billingCycleDays")).replace("month", "mo")


def provider_freshness(meta: dict, provider: str) -> tuple[str | None, bool]:
    """(last successful check date, is_stale)"""
    rows = [v for k, v in meta.items() if k.startswith(provider + " (")]
    dates = [r.get("last_success") for r in rows if r.get("last_success")]
    last = max(dates)[:10] if dates else None
    stale = any(r.get("consecutive_failures", 0) >= STALE_AFTER_FAILURES for r in rows)
    return last, stale


def fmt_date(iso: str | None, short: bool = False) -> str:
    if not iso:
        return ""
    d = dt.date.fromisoformat(iso[:10])
    return f"{d.day} {d.strftime('%b %Y' if short else '%B %Y')}"


# ---------------------------------------------------------------- template

def template_parts() -> dict:
    t = TEMPLATE.read_text(encoding="utf-8")
    grab = lambda pat: re.search(pat, t, re.S).group(0)  # noqa: E731
    return {
        "header": grab(r'<header class="w-header">.*?</header>'),
        "footer": grab(r'<footer class="w-footer">.*?</footer>'),
        "support": grab(r'<section class="deals-support-section".*?</section>'),
        "verification": (m.group(0) if (m := re.search(r'<meta name="commission-factory-verification"[^>]*>', t)) else ""),
    }


def page(parts: dict, *, title: str, description: str, path: str, robots: str,
         main: str, schema: list[dict]) -> str:
    url = SITE + path
    ld = "\n".join('<script type="application/ld+json">' + json.dumps(s, separators=(",", ":")) + "</script>"
                   for s in schema)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Generated by scripts/build_provider_pages.py. Edit the script, not this file. -->
{parts['verification']}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1Z707JNGZS"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', 'G-1Z707JNGZS');
</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#FFFFFF">
<link rel="canonical" href="{url}">
<link rel="preload" href="/assets/fonts/plus-jakarta-sans-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plus-jakarta-sans-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/site-wide.css">
<link rel="stylesheet" href="/assets/site-deals.css">
<link rel="stylesheet" href="/assets/site-providers.css">
<script src="/assets/site-nav.js" defer></script>
<link rel="icon" href="/assets/img/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_AU">
<meta property="og:site_name" content="JRS Digital">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/assets/img/og-default.png">
<meta name="twitter:card" content="summary_large_image">
{ld}
</head>
<body class="wide-theme">
  <div class="w-shell">
    {set_active_nav(parts['header'], path)}

    <main id="main-content">
{main}
      {parts['support']}
    </main>

    {parts['footer']}
  </div>
</body>
</html>
"""


def set_active_nav(header: str, path: str) -> str:
    header = header.replace(' class="active" aria-current="page"', "")
    for prefix in ("/deals/price-changes/", "/deals/providers/", "/deals/mobile-plans/", "/deals/"):
        if path.startswith(prefix):
            return header.replace(f'<a href="{prefix}">', f'<a href="{prefix}" class="active" aria-current="page">', 1)
    return header


def breadcrumb(items: list[tuple[str, str | None]]) -> tuple[str, dict]:
    html_items, ld_items = [], []
    for i, (name, href) in enumerate(items):
        if i:
            html_items.append('<span class="deals-breadcrumb-sep">&rsaquo;</span>')
        if href:
            html_items.append(f'<a href="{href}">{esc(name)}</a>')
        else:
            html_items.append(f'<span class="deals-breadcrumb-current">{esc(name)}</span>')
        ld_items.append({"@type": "ListItem", "position": i + 1, "name": name,
                         **({"item": SITE + href} if href else {})})
    nav = ('      <nav class="deals-breadcrumb" aria-label="Breadcrumb">\n        '
           + "\n        ".join(html_items) + "\n      </nav>")
    return nav, {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": ld_items}


def faq_block(title: str, qa: list[tuple[str, str]]) -> tuple[str, dict | None]:
    if not qa:
        return "", None
    items = "".join(
        f'\n          <details class="deals-faq-item">\n            <summary class="deals-faq-question">'
        f"<span>{esc(q)}</span>{CHEVRON}</summary>\n"
        f'            <div class="deals-faq-answer"><p>{esc(a)}</p></div>\n          </details>'
        for q, a in qa)
    block = (f'      <section class="w-section deals-faq-section provider-section">\n'
             f'        <h2 class="w-h2">{esc(title)}</h2>\n        <div class="deals-faq-grid">{items}\n'
             f'        </div>\n      </section>\n')
    ld = {"@context": "https://schema.org", "@type": "FAQPage",
          "mainEntity": [{"@type": "Question", "name": q,
                          "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qa]}
    return block, ld


# ---------------------------------------------------------------- provider page

def describe_change(e: dict) -> str:
    unit = "/mo"
    cycle = e.get("billingCycleDays")
    if cycle and not (29 <= int(cycle) <= 31):
        unit = " per " + billing_cycle_label(cycle)
    parts = []
    ch = e["changes"]
    if "regularPrice" in ch:
        a, b = ch["regularPrice"]
        verb = "rose" if b > a else "dropped"
        parts.append(f"Ongoing price {verb}: {money(a)} &rarr; {money(b)}{unit}")
    if "promoPrice" in ch:
        a, b = ch["promoPrice"]
        months = (ch.get("promoMonths") or [None, None])[1]
        tail = f" for {months} months" if months else ""
        parts.append(f"Promo price: {money(a)} &rarr; {money(b)}{unit}{tail}")
    return "; ".join(parts)


def build_provider(parts, provider, deals, policy, network, history, meta, peers, today):
    slug = slugify(provider)
    path = f"/deals/providers/{slug}/"
    bb = sorted([d for d in deals if d.get("serviceType") in BROADBAND_TYPES], key=first_year)
    mob = sorted([d for d in deals if d.get("serviceType") == "mobile"], key=first_year)
    pol = policy.get(provider)
    net = network.get(provider) if mob else None
    events = [e for e in history if e.get("provider") == provider]
    last_check, stale = provider_freshness(meta, provider)
    month = dt.date.fromisoformat(today).strftime("%b %Y")

    kinds = " & ".join(x for x in (("NBN" if bb else ""), ("Mobile" if mob else "")) if x) or "Internet"
    title = f"{provider} {kinds} Plans & Prices ({month})"
    if len(title) > 60:
        title = f"{provider} {kinds} Plans ({month})"
    cheapest_bb = bb[0] if bb else None
    cheapest_mob = mob[0] if mob else None
    lead = cheapest_bb or cheapest_mob
    desc = (f"{len(deals)} {provider} plans compared by real first-year cost"
            + (f", from {money(first_year(lead))} in year one" if lead else "")
            + ". Price changes, notice period and CGNAT policy, checked daily.")

    thin = len(deals) < 2 and not pol and not events
    robots = ("noindex, follow" if thin else
              "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1")

    crumbs, crumbs_ld = breadcrumb([("Home", "/"), ("Deals", "/deals/"),
                                    ("Providers", "/deals/providers/"), (provider, None)])

    # hero
    sub_bits = [f"We track <strong>{len(deals)}</strong> {esc(provider)} plan{'s' if len(deals) != 1 else ''}"]
    if cheapest_bb:
        sub_bits.append(f"The cheapest broadband plan, {esc(cheapest_bb.get('title'))}, costs "
                        f"<strong>{money(first_year(cheapest_bb))}</strong> over the first 12 months")
    if cheapest_mob:
        sub_bits.append(f"The cheapest SIM works out to <strong>{money(first_year(cheapest_mob))}</strong> a year")
    if stale and last_check:
        fresh = (f'<p class="provider-stale" role="note">We couldn\'t refresh {esc(provider)} prices '
                 f'since {fmt_date(last_check)}. Check the provider\'s site before you sign up.</p>')
    else:
        fresh = (f'<p class="provider-checked">Prices checked {fmt_date(last_check or today)} '
                 f'from {esc(provider)}\'s official plan pages.</p>')

    # facts
    facts = [("Plans tracked", str(len(deals)))]
    if cheapest_bb:
        facts.append(("Cheapest broadband, year one", money(first_year(cheapest_bb))))
    if cheapest_mob:
        facts.append(("Cheapest SIM, year one", money(first_year(cheapest_mob))))
    if pol:
        facts.append(("CGNAT opt-out", {"opt_out_free": "Free on request", "paid_only": "Paid static IP only"}
                      .get(pol["cgnat"], "Unknown")))
        facts.append(("Notice to cancel", "30 days" if pol["notice"] == "30_days" else "No notice period"))
    if net:
        facts.append(("Mobile network", f"{net['network']} ({net['coverage']} population coverage)"))
    facts_html = "".join(f"<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in facts)
    cis = (f'<p class="provider-cis"><a href="{esc(pol["cisUrl"])}" rel="nofollow noopener" target="_blank">'
           f'{esc(provider)} legal and Critical Information Summaries</a></p>') if pol and pol.get("cisUrl") else ""

    # grids
    grids = ""
    if bb:
        grids += (f'      <section class="w-section deals-table-section provider-section">\n'
                  f'        <h2 class="w-h2">{esc(provider)} NBN &amp; broadband plans</h2>\n'
                  f'        <p class="provider-note">Sorted by total cost over the first 12 months, including the promo period.</p>\n'
                  f'        <div class="deals-table">{render_speed_page_grid(bb, provider)}</div>\n      </section>\n')
    if mob:
        grids += (f'      <section class="w-section deals-table-section provider-section">\n'
                  f'        <h2 class="w-h2">{esc(provider)} mobile plans</h2>\n'
                  f'        <div class="deals-table">{render_mobile_page_grid(mob)}</div>\n      </section>\n')

    # history
    hist = ""
    if events:
        rows = "".join(f"<tr><td>{fmt_date(e['date'], short=True)}</td><td>{esc(e.get('title') or e.get('tier'))}</td>"
                       f"<td>{describe_change(e)}</td></tr>" for e in events[:15])
        hist = (f'      <section class="w-section provider-section">\n'
                f'        <h2 class="w-h2">{esc(provider)} price changes</h2>\n'
                f'        <p class="provider-note">Every price change our daily checks have recorded, newest first.</p>\n'
                f'        <div class="provider-table-wrap"><table class="provider-table">'
                f'<thead><tr><th scope="col">Date</th><th scope="col">Plan</th><th scope="col">Change</th></tr></thead>'
                f'<tbody>{rows}</tbody></table></div>\n      </section>\n')

    # faq (data-backed only)
    qa = []
    if cheapest_bb:
        d = cheapest_bb
        promo, reg, m = d.get("promoPrice"), d.get("regularPrice"), d.get("promoMonths")
        if promo and reg and m and promo != reg:
            price_txt = f"{money(promo)}/mo for {m} months, then {money(reg)}/mo"
        else:
            price_txt = f"{money(reg or promo)}/mo"
        qa.append((f"What is the cheapest {provider} NBN plan?",
                   f"{d.get('title')} at {price_txt}. That is {money(first_year(d))} over the first year "
                   f"(checked {fmt_date(last_check or today)})."))
    if pol:
        qa.append((f"Does {provider} let you opt out of CGNAT?",
                   f"Yes, {provider} gives customers a public IP address free on request." if pol["cgnat"] == "opt_out_free"
                   else f"Not for free. {provider} only offers a public IP through a paid static IP add-on."))
        qa.append((f"Do you need to give {provider} 30 days notice to cancel?",
                   f"Yes. {provider} asks for 30 days notice, so you may pay for part of a month after you switch."
                   if pol["notice"] == "30_days" else
                   f"No. {provider} doesn't require a 30-day notice period to cancel."))
    if net:
        qa.append((f"Which mobile network does {provider} use?",
                   f"{provider} runs on the {net['network']}, which covers about {net['coverage']} of Australians."))
    rises = [e for e in events if "regularPrice" in e["changes"]
             and e["changes"]["regularPrice"][1] > e["changes"]["regularPrice"][0]]
    if events:
        if rises:
            e = rises[0]
            a, b = e["changes"]["regularPrice"]
            qa.append((f"Has {provider} raised its prices recently?",
                       f"Yes. The most recent ongoing price rise we recorded was {e.get('title') or e.get('tier')} "
                       f"on {fmt_date(e['date'])}, from {money(a)} to {money(b)}."))
        else:
            oldest = min(e["date"] for e in events)
            qa.append((f"Has {provider} raised its prices recently?",
                       f"We haven't recorded any ongoing price rises for {provider} since {fmt_date(oldest)}. "
                       f"Promo prices have changed; see the table above."))
    faq_html, faq_ld = faq_block(f"{provider} questions", qa)

    # internal links
    tiers = sorted({base_bucket_key(d.get("tier")) for d in bb if d.get("serviceType") == "nbn"}
                   & set(SPEED_PAGES), key=lambda t: int(t.split()[1]))
    links = [f'<a class="deals-speed-pill" href="/deals/{SPEED_PAGES[t]}/"><span>{t} plans</span></a>' for t in tiers]
    if mob:
        links.append('<a class="deals-speed-pill" href="/deals/mobile-plans/"><span>All mobile plans</span></a>')
    links += [f'<a class="deals-speed-pill" href="/deals/providers/{slugify(p)}/"><span>{esc(p)}</span></a>'
              for p in peers]
    links.append('<a class="deals-speed-pill deals-speed-pill--all" href="/deals/providers/"><span>All providers &rarr;</span></a>')
    related = (f'      <section class="w-section provider-section">\n        <h2 class="w-h2">Compare with</h2>\n'
               f'        <div class="deals-speed-hub-pills" role="navigation" aria-label="Related comparisons">'
               + "".join(links) + "</div>\n      </section>\n")

    main = f"""{crumbs}

      <section class="deals-speed-hero provider-hero">
        <div class="deals-hero-copy">
          <p class="deals-eyebrow">Provider guide</p>
          <h1 class="deals-h1"><span class="deals-h1-accent">{esc(provider)}</span> plans compared.</h1>
          <p class="deals-hero-sub">{'. '.join(sub_bits)}.</p>
          {fresh}
        </div>
        <dl class="provider-facts">{facts_html}</dl>
        {cis}
      </section>

{grids}{hist}{faq_html}{related}"""

    item_list = build_deal_schema(deals)
    item_list["name"] = f"{provider} plans"
    schema = [crumbs_ld, item_list] + ([faq_ld] if faq_ld else [])
    out = page(parts, title=title, description=desc, path=path, robots=robots, main=main, schema=schema)
    return slug, out, (not thin), {"provider": provider, "slug": slug, "plans": len(deals), "bb": cheapest_bb,
                                   "mob": cheapest_mob, "policy": pol, "network": net}


# ---------------------------------------------------------------- index + hub

def build_index(parts, rows, today):
    month = dt.date.fromisoformat(today).strftime("%b %Y")
    crumbs, crumbs_ld = breadcrumb([("Home", "/"), ("Deals", "/deals/"), ("Providers", None)])
    body = []
    for r in sorted(rows, key=lambda r: r["provider"].lower()):
        pol = r["policy"] or {}
        body.append(
            f'<tr><th scope="row"><a href="/deals/providers/{r["slug"]}/">{esc(r["provider"])}</a></th>'
            f'<td>{r["plans"]}</td>'
            f'<td>{money(first_year(r["bb"])) if r["bb"] else "&ndash;"}</td>'
            f'<td>{money(first_year(r["mob"])) if r["mob"] else "&ndash;"}</td>'
            f'<td>{ {"opt_out_free": "Free", "paid_only": "Paid only"}.get(pol.get("cgnat"), "&ndash;") }</td>'
            f'<td>{ {"30_days": "30 days", "none": "None"}.get(pol.get("notice"), "&ndash;") }</td></tr>')
    main = f"""{crumbs}

      <section class="deals-speed-hero provider-hero">
        <div class="deals-hero-copy">
          <p class="deals-eyebrow">Provider guides</p>
          <h1 class="deals-h1">Every provider we <span class="deals-h1-accent">track</span>.</h1>
          <p class="deals-hero-sub">{len(rows)} Australian NBN and mobile providers, with each one's cheapest plan over the first year, CGNAT policy and notice period. Updated {fmt_date(today)}.</p>
        </div>
      </section>

      <section class="w-section provider-section">
        <div class="provider-table-wrap"><table class="provider-table provider-table--index">
          <thead><tr><th scope="col">Provider</th><th scope="col">Plans</th><th scope="col">Cheapest broadband, year one</th><th scope="col">Cheapest SIM, year one</th><th scope="col">CGNAT opt-out</th><th scope="col">Notice to cancel</th></tr></thead>
          <tbody>{''.join(body)}</tbody>
        </table></div>
      </section>
"""
    return page(parts, title=f"Australian NBN & Mobile Providers Compared ({month})",
                description=f"{len(rows)} Australian NBN and mobile providers compared: cheapest first-year cost, "
                            "CGNAT opt-out and notice periods, updated daily.",
                path="/deals/providers/", robots="index, follow, max-snippet:-1",
                main=main, schema=[crumbs_ld])


def update_hub(rows):
    links = "".join(f'<a href="/deals/providers/{r["slug"]}/">{esc(r["provider"])}</a>'
                    for r in sorted(rows, key=lambda r: r["provider"].lower()))
    h = HUB_HTML.read_text(encoding="utf-8")
    h = splice(h, "PROVIDERLINKS", f'<div class="provider-link-list">{links}</div>')
    HUB_HTML.write_text(h, encoding="utf-8")


def update_sitemap(slugs, today):
    xml = SITEMAP.read_text(encoding="utf-8")
    nl = "\r\n" if "\r\n" in xml else "\n"
    entries = ([("/deals/providers/", "0.8"), ("/deals/price-changes/", "0.8"), ("/how-we-compare/", "0.6")]
               + [(f"/deals/providers/{s}/", "0.7") for s in sorted(slugs)])
    block = nl.join(f"  <url>{nl}    <loc>{SITE}{p}</loc>{nl}    <lastmod>{today}</lastmod>{nl}"
                    f"    <changefreq>daily</changefreq>{nl}    <priority>{pr}</priority>{nl}  </url>"
                    for p, pr in entries)
    start, end = "<!-- PROVIDERS:START -->", "<!-- PROVIDERS:END -->"
    if start in xml:
        xml = re.sub(re.escape(start) + r".*?" + re.escape(end), start + nl + block + nl + "  " + end, xml, flags=re.S)
    else:
        xml = xml.replace("</urlset>", f"  {start}{nl}{block}{nl}  {end}{nl}</urlset>")
    SITEMAP.write_text(xml, encoding="utf-8")



# ---------------------------------------------------------------- homepage, price changes, how we compare

def clean_title(t) -> str:
    """Clean scraped plan titles from repeated words or duplicated provider prefix."""
    s = str(t or "").strip()
    words = s.split()
    half = len(words) // 2
    if words and len(words) % 2 == 0 and words[:half] == words[half:]:
        s = " ".join(words[:half])
    # Collapse repeated consecutive words/phrases (e.g. "Carbon Fixed Wireless Carbon Fixed Wireless" or "NBN NBN")
    prev = ""
    while s != prev:
        prev = s
        s = re.sub(r'\b(.+?)\s+\1\b', r'\1', s, flags=re.IGNORECASE).strip()
    # Collapse repeated speed pattern like '250/20 NBN 250/20' -> 'NBN 250/20'
    s = re.sub(r'(\d+(?:/\d+)?)\s+NBN\s+\1', r'NBN \1', s, flags=re.IGNORECASE)
    s = re.sub(r'\bNBN\s+NBN\b', 'NBN', s, flags=re.IGNORECASE)
    return " ".join(s.split())



def price_line(d: dict) -> str:
    promo, reg, m = d.get("promoPrice"), d.get("regularPrice"), d.get("promoMonths")
    cycle = int(d.get("billingCycleDays") or 30)
    if 360 <= cycle <= 370:
        return f"{money(promo or reg)} paid once for the year"
    unit = "/mo" if 29 <= cycle <= 31 else f" per {billing_cycle_label(cycle)}"
    if promo and reg and m and promo != reg:
        span = f"{m} months" if 29 <= cycle <= 31 else f"{m} renewals"
        return f"{money(promo)}{unit} for {span}, then {money(reg)}{unit}"
    return f"{money(reg or promo)}{unit}"


def change_text(e: dict) -> str:
    ch = e["changes"]
    unit = "/mo"
    cycle = e.get("billingCycleDays")
    if cycle and not (29 <= int(cycle) <= 31):
        unit = " per " + billing_cycle_label(cycle)
    bits = []
    if "regularPrice" in ch:
        a, b = ch["regularPrice"]
        bits.append(f"Ongoing {'up' if b > a else 'down'} {money(a)} &rarr; {money(b)}{unit}")
    if "promoPrice" in ch:
        a, b = ch["promoPrice"]
        months = (ch.get("promoMonths") or [None, None])[1]
        monthly = not cycle or 29 <= int(cycle) <= 31
        tail = f" for {months} months" if (months and monthly and int(months) > 1) else ""
        bits.append(f"Promo {'up' if b > a else 'down'} {money(a)} &rarr; {money(b)}{unit}{tail}")
    return "; ".join(bits)


def change_pills(e: dict) -> str:
    ch = e["changes"]
    unit = "/mo"
    cycle = e.get("billingCycleDays")
    if cycle and not (29 <= int(cycle) <= 31):
        unit = " per " + billing_cycle_label(cycle)
    pills = []
    if "regularPrice" in ch:
        a, b = ch["regularPrice"]
        is_down = (b < a)
        cls = "is-drop" if is_down else "is-rise"
        arrow = "&darr;" if is_down else "&uarr;"
        label = "Ongoing drop" if is_down else "Ongoing rise"
        pills.append(
            f'<span class="home-change-pill {cls}">'
            f'<span class="home-pill-badge">{arrow} {label}</span>'
            f'<span class="home-pill-math"><del>{money(a)}</del> &rarr; <strong>{money(b)}</strong>{unit}</span>'
            f'</span>'
        )
    if "promoPrice" in ch:
        a, b = ch["promoPrice"]
        is_down = (b < a)
        cls = "is-drop" if is_down else "is-rise"
        arrow = "&darr;" if is_down else "&uarr;"
        label = "Promo drop" if is_down else "Promo rise"
        months = (ch.get("promoMonths") or [None, None])[1]
        monthly = not cycle or 29 <= int(cycle) <= 31
        tail = f' <span class="home-pill-tail">({months} mos)</span>' if (months and monthly and int(months) > 1) else ""
        pills.append(
            f'<span class="home-change-pill {cls}">'
            f'<span class="home-pill-badge">{arrow} {label}</span>'
            f'<span class="home-pill-math"><del>{money(a)}</del> &rarr; <strong>{money(b)}</strong>{unit}{tail}</span>'
            f'</span>'
        )
    return "".join(pills) if pills else f'<span class="home-change-fallback">{change_text(e)}</span>'


def change_rows(events: list[dict]) -> str:
    rows = []
    for e in events:
        prov = esc(e["provider"])
        prov_slug = slugify(e["provider"])
        title = esc(clean_title(e.get("title") or e.get("tier")))
        date_fmt = fmt_date(e["date"], short=True)
        ch_html = change_pills(e)
        rows.append(
            f'<div class="home-change">'
            f'<time datetime="{e["date"]}" class="home-change-date">{date_fmt}</time>'
            f'<div class="home-change-plan">'
            f'<a href="/deals/providers/{prov_slug}/" class="home-change-provider"><strong>{prov}</strong></a>'
            f'<span class="home-change-dot">&middot;</span>'
            f'<span class="home-change-name">{title}</span>'
            f'</div>'
            f'<div class="home-change-badges">{ch_html}</div>'
            f'</div>'
        )
    return "".join(rows)


def build_home(deals, history, meta, rows, today):
    if not HOME_HTML.exists() or "PRERENDER:HOMETIERS" not in HOME_HTML.read_text(encoding="utf-8"):
        return
    providers = {d["provider"] for d in deals if d.get("provider")}
    checks = [v.get("last_success") for v in meta.values() if v.get("last_success")]
    checked = fmt_date(max(checks)[:10]) if checks else fmt_date(today)
    stats = (f"{len(deals)} plans &middot; {len(providers)} providers &middot; Prices checked {checked} "
             f"from each provider's official plan pages")

    tiers, calc = [], {}
    for label, bucket, href in HOME_TIERS:
        if bucket == "mobile":
            pool = [d for d in deals if d.get("serviceType") == "mobile"]
        else:
            pool = [d for d in deals if d.get("serviceType") == "nbn" and base_bucket_key(d.get("tier")) == bucket]
        if not pool:
            continue
        best = min(pool, key=first_year)
        key = slugify(label)
        item = {"label": label, "count": len(pool), "provider": best.get("provider"),
                "plan": clean_title(best.get("title") or best.get("tier")), "priceLine": price_line(best),
                "firstYear": round(first_year(best), 2), "href": href}
        tiers.append(item)
        calc[key] = item

    tier_rows = "".join(
        f'<a class="home-row" href="{t["href"]}">'
        f'<div class="home-row-tier">'
        f'<span class="home-tier-badge">{esc(t["label"])}</span>'
        f'<span class="home-tier-count">{t["count"]} plans</span>'
        f'</div>'
        f'<div class="home-row-plan">'
        f'<div class="home-plan-head">'
        f'<strong class="home-provider-name">{esc(t["provider"])}</strong>'
        f'<span class="home-plan-dot">&middot;</span>'
        f'<span class="home-plan-name">{esc(t["plan"])}</span>'
        f'</div>'
        f'<div class="home-plan-pricing">{t["priceLine"]}</div>'
        f'</div>'
        f'<div class="home-row-price">'
        f'<span class="home-price-caption">First year</span>'
        f'<strong class="home-price-val">{money(t["firstYear"])}</strong>'
        f'</div>'
        f'<div class="home-row-arrow" aria-hidden="true">&rarr;</div>'
        f'</a>' for t in tiers)

    default = calc.get("nbn-50") or next(iter(calc.values()))
    options = "".join(f'<option value="{k}"{" selected" if v is default else ""}>{esc(v["label"])}</option>'
                      for k, v in calc.items())
    diff = 75 * 12 - default["firstYear"]
    save = (f'<p class="home-save">{money(diff)} less than you&rsquo;d pay this year</p>' if diff > 0.5 else
            f'<p class="home-save is-neutral">You already pay less than the cheapest {esc(default["label"])} plan we track.</p>')
    result = (f'<p class="home-label">Cheapest {esc(default["label"])} plan we track</p>'
              f'<p class="home-plan"><strong>{esc(default["provider"])}</strong> &middot; {esc(default["plan"])}</p>'
              f'<p class="home-price-line">{default["priceLine"]}</p>'
              f'<div class="home-figure"><p class="home-first-year">First year <strong>{money(default["firstYear"])}</strong></p>{save}</div>'
              f'<div class="home-calc-links">'
              f'<a class="home-more" href="{default["href"]}">See all {default["count"]} {esc(default["label"])} plans &rarr;</a>'
              f'<a class="home-calc-deals-link" href="/deals/">Open full deals table &rarr;</a>'
              f'</div>')
    calc_json = json.dumps({k: {**v, "priceLine": html.unescape(v["priceLine"])} for k, v in calc.items()},
                           separators=(",", ":")).replace("</", "<\\/")
    calc_data = f'<script type="application/json" id="home-calc-data">{calc_json}</script>'

    week_ago = (dt.date.fromisoformat(today) - dt.timedelta(days=7)).isoformat()
    recent = [e for e in history if e["date"] >= week_ago]
    if len(recent) < 4:
        recent = history[:6]
    changes = change_rows(recent[:8])

    featured = sorted(rows, key=lambda r: -r["plans"])[:12]
    prov_links = "".join(f'<a href="/deals/providers/{r["slug"]}/">{esc(r["provider"])}</a>'
                         for r in sorted(featured, key=lambda r: r["provider"].lower()))
    prov_links += f'<a class="home-link-strong" href="/deals/providers/">All {len(rows)} providers &rarr;</a>'

    h = HOME_HTML.read_text(encoding="utf-8")
    for name, val in (("HOMESTATS", stats), ("HOMECALCOPTIONS", options), ("HOMECALCRESULT", result),
                      ("HOMETIERS", tier_rows), ("HOMECHANGES", changes), ("HOMEPROVIDERS", prov_links),
                      ("HOMECALCDATA", calc_data)):
        h = splice(h, name, val)
    HOME_HTML.write_text(h, encoding="utf-8")


def build_changes_page(parts, history, today):
    cutoff = (dt.date.fromisoformat(today) - dt.timedelta(days=90)).isoformat()
    events = [e for e in history if e["date"] >= cutoff]
    rises = sum(1 for e in events if "regularPrice" in e["changes"]
                and e["changes"]["regularPrice"][1] > e["changes"]["regularPrice"][0])
    crumbs, crumbs_ld = breadcrumb([("Home", "/"), ("Deals", "/deals/"), ("Price changes", None)])
    groups, cur = [], None
    for e in events:
        if e["date"] != cur:
            cur = e["date"]
            groups.append(f'<h2 class="w-h2 provider-day">{fmt_date(cur)}</h2>')
        groups.append(change_rows([e]))
    month = dt.date.fromisoformat(today).strftime("%b %Y")
    main = f"""{crumbs}

      <section class="deals-speed-hero provider-hero">
        <div class="deals-hero-copy">
          <p class="deals-eyebrow">Price tracker</p>
          <h1 class="deals-h1">NBN and mobile <span class="deals-h1-accent">price changes</span>.</h1>
          <p class="deals-hero-sub">Every price change our daily checks recorded in the last 90 days: <strong>{len(events)}</strong> changes, including <strong>{rises}</strong> ongoing price rises. Updated {fmt_date(today)}.</p>
          <p class="provider-note">"Ongoing" is the price you pay after the promo ends. Changes to promo prices are listed too.</p>
        </div>
      </section>

      <section class="w-section provider-section home-rows">
        {''.join(groups) or '<p>No price changes recorded yet.</p>'}
      </section>
"""
    CHANGES_DIR.mkdir(parents=True, exist_ok=True)
    (CHANGES_DIR / "index.html").write_text(page(
        parts, title=f"NBN & Mobile Price Changes ({month}) | JRS Digital",
        description=f"Every Australian NBN and mobile plan price change we recorded in the last 90 days, "
                    f"including {rises} ongoing price rises. Updated daily.",
        path="/deals/price-changes/", robots="index, follow, max-snippet:-1",
        main=main, schema=[crumbs_ld]).replace(
        '<link rel="stylesheet" href="/assets/site-providers.css">',
        '<link rel="stylesheet" href="/assets/site-providers.css">\n<link rel="stylesheet" href="/assets/site-home.css">'),
        encoding="utf-8")


def build_hwc(deals, meta, today):
    if not HWC_HTML.exists():
        return
    providers = {d["provider"] for d in deals if d.get("provider")}
    stale = []
    for p in sorted(providers):
        last, is_stale = provider_freshness(meta, p)
        if is_stale and last:
            stale.append(f'<a href="/deals/providers/{slugify(p)}/">{esc(p)}</a> (last confirmed {fmt_date(last)})')
    stale_txt = ("Right now we're waiting on fresh prices from " + ", ".join(stale) + "."
                 if stale else "Right now every provider we track was checked successfully.")
    h = HWC_HTML.read_text(encoding="utf-8")
    h = splice(h, "HWCSTATS", f"{len(deals)} plans from {len(providers)} providers")
    h = splice(h, "HWCSTALE", stale_txt)
    HWC_HTML.write_text(h, encoding="utf-8")

def update_tier_best(deals):
    """Speed pages with a TIERBEST marker show the tier's cheapest first-year cost."""
    for label, bucket, href in HOME_TIERS:
        if not href.startswith("/deals/nbn-"):
            continue
        path = REPO_ROOT / href.strip("/") / "index.html"
        if not path.exists():
            continue
        h = path.read_text(encoding="utf-8")
        if "PRERENDER:TIERBEST:START" not in h:
            continue
        pool = [d for d in deals if d.get("serviceType") == "nbn" and base_bucket_key(d.get("tier")) == bucket]
        if pool:
            path.write_text(splice(h, "TIERBEST", money(min(first_year(d) for d in pool))), encoding="utf-8")

MONTH_YEAR_RE = re.compile(
    r"\b(?:(?:January|February|March|April|May|June|July|August|September|"
    r"October|November|December) )?20\d\d\b")


def update_page_meta(deals, today):
    """Keep tier-page titles and descriptions current: the month in the title
    and the cheapest plan in the description. Both are what searchers scan on
    "best X plans" results, so stale copy costs clicks."""
    month_year = dt.date.fromisoformat(today).strftime("%B %Y")
    for label, bucket, href in HOME_TIERS:
        path = REPO_ROOT / href.strip("/") / "index.html"
        if not path.exists():
            continue
        if bucket == "mobile":
            pool = [d for d in deals if d.get("serviceType") == "mobile"]
        else:
            pool = [d for d in deals if d.get("serviceType") == "nbn"
                    and base_bucket_key(d.get("tier")) == bucket]
        if not pool:
            continue
        best = min(pool, key=first_year)
        n_prov = len({d.get("provider") for d in pool})
        cost = money(round(first_year(best)))
        if bucket == "mobile":
            desc = (f"Cheapest SIM-only plan today: {best.get('provider')} at {cost} for the year. "
                    f"Compare {len(pool)} plans from {n_prov} providers by true yearly cost, "
                    f"28-day billing included. Checked daily.")
        else:
            desc = (f"Cheapest {label} plan today: {best.get('provider')} at {cost} for the first year. "
                    f"Compare {len(pool)} plans from {n_prov} providers by first-year cost, "
                    f"not promo price. Checked daily.")
        desc = esc(desc)
        raw = path.read_bytes().decode("utf-8")
        nl = "\r\n" if "\r\n" in raw else "\n"
        h = raw

        def retitle(m):
            return m.group(1) + MONTH_YEAR_RE.sub(month_year, m.group(2), count=1) + m.group(3)
        h = re.sub(r"(<title>)(.*?)(</title>)", retitle, h, count=1)
        h = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")([^"]*)(")', retitle, h)
        h = re.sub(r'(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*(")',
                   lambda m: m.group(1) + desc + m.group(2), h)
        if h != raw:
            path.write_bytes(h.replace("\r\n", "\n").replace("\n", nl).encode("utf-8"))


def main():
    today = dt.date.today().isoformat()
    deals = load("deals.json", [])
    if not deals:
        raise SystemExit("No deals data")
    history = load("price_history.json", [])
    meta = load("meta.json", {})
    policy, network = js_meta()
    parts = template_parts()

    by_provider: dict[str, list] = {}
    for d in deals:
        if d.get("provider"):
            by_provider.setdefault(d["provider"], []).append(d)

    # peers: cheapest other providers offering the same main service
    def main_type(ds):
        return "mobile" if all(d.get("serviceType") == "mobile" for d in ds) else "broadband"
    def cheapest_of_type(p, t):
        ds = [d for d in by_provider[p]
              if (d.get("serviceType") == "mobile") == (t == "mobile")]
        return min((first_year(d) for d in ds), default=float("inf"))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows, indexable = [], []
    for provider, ds in by_provider.items():
        t = main_type(ds)
        peers = sorted((p for p in by_provider if p != provider and main_type(by_provider[p]) == t),
                       key=lambda p: cheapest_of_type(p, t))[:4]
        slug, out, index_it, row = build_provider(parts, provider, ds, policy, network, history, meta, peers, today)
        (OUT_DIR / slug).mkdir(exist_ok=True)
        (OUT_DIR / slug / "index.html").write_text(out, encoding="utf-8")
        rows.append(row)
        if index_it:
            indexable.append(slug)

    (OUT_DIR / "index.html").write_text(build_index(parts, rows, today), encoding="utf-8")
    update_hub(rows)
    build_home(deals, history, meta, rows, today)
    build_changes_page(parts, history, today)
    build_hwc(deals, meta, today)
    update_tier_best(deals)
    update_page_meta(deals, today)
    update_sitemap(indexable, today)
    print(f"Built {len(rows)} provider pages ({len(indexable)} indexable) + providers index")


if __name__ == "__main__":
    main()
