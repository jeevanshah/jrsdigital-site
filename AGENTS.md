# JRS Digital (`jrsdigital-site`) — Developer & Agent Reference

This document is the core reference and instruction manual for Antigravity and developers working on the `jrsdigital-site` repository.

---

## 1. Project Overview

`jrsdigital-site` is the static website for **JRS Digital** (hosted at [jrsdigital.net](https://jrsdigital.net/)). It hosts:
1. **Corporate & Portfolio Pages**: Homepage (`index.html`), About (`about.html`), Work / Case Studies (`work.html`), Contact (`contact.html`).
2. **Deals & Plan Comparison Engine** (`deals/index.html`): High-performance, live Australian broadband (NBN, 5G Home Wireless, Satellite) and Mobile SIM comparison engine tracking 20+ telcos.
3. **PriceMinder App Landing Page** (`priceminder/index.html` & `priceminder/privacy.html`): Product landing and privacy policy for PriceMinder on-device subscription manager.
4. **Automated SEO Pre-renderer** (`scripts/prerender.py`): Python Playwright script that compiles dynamic deal lists and Schema.org `ItemList`/`Product` JSON-LD into static HTML for search engine crawlers.

---

## 2. Directory Structure

```text
jrsdigital-site/
├── .agents/                        # Antigravity Workspace Customizations
│   ├── rules/
│   │   └── project-conventions.md  # Core project coding rules & standards
│   └── skills/
│       ├── prerender-deals/        # Deal pre-rendering workflow & Playwright automation
│       ├── deals-catalog-management/ # Telco metadata, filters, calculations & schemas
│       ├── design-system-and-ui/   # CSS tokens, typography, 3D heroes, SEO & layout
│       └── community-audit-webhook/# Community plan audit drawer & Apps Script webhook
├── .github/
│   └── workflows/
│       └── prerender-deals.yml     # Automated scheduled pre-rendering GitHub Action
├── assets/                         # Global styles, fonts, images & interactive scripts
│   ├── site-wide.css               # Modern wide-theme design tokens & shared layout
│   ├── site-deals.css              # Deals comparison table & filter UI styles
│   ├── site.css                    # Base styles and legacy dark theme tokens
│   ├── site-nav.js                 # Mobile hamburger menu and drawer controller
│   ├── bonsai-scene.js             # Interactive 3D WebGL bonsai hero animation
│   ├── hero-3d.js                  # Interactive 3D phone canvas render
│   ├── hero-effects.js             # Hero glow and mouse-tracking micro-interactions
│   └── deal-scout-rive.js          # Rive animation runtime wrapper
├── deals/
│   └── index.html                  # Australian NBN & Mobile deals comparison platform
├── priceminder/
│   ├── index.html                  # PriceMinder landing page
│   └── privacy.html                # PriceMinder privacy policy
├── scripts/
│   ├── prerender.py                # Playwright static snapshot and JSON-LD schema generator
│   └── requirements.txt            # Python dependencies (playwright)
├── about.html                      # About JRS Digital
├── contact.html                    # Contact form / contact details
├── index.html                      # Site homepage
├── work.html                       # Portfolio / projects showcase
├── sitemap.xml                     # Search engine sitemap
├── robots.txt                      # Search engine robot directives
└── CNAME                           # Custom domain configuration (jrsdigital.net)
```

---

## 3. Technology Stack & Key Constraints

| Area | Technology / Tooling | Notes |
| :--- | :--- | :--- |
| **Frontend** | Vanilla HTML5, CSS3, ES6+ JS | Zero heavy JavaScript frameworks (no React/Vue/Tailwind). Fast first-paint and lightweight bundle. |
| **Pre-rendering** | Python 3.10+, Playwright | Headless Chromium runs `scripts/prerender.py` to splice pre-rendered DOM into `deals/index.html`. |
| **Data Sources** | Raw JSON via GitHub raw URLs | `deals.json`, `changelog.json`, `poi.json` fetched from `au-plans-scraper` repo. |
| **Telemetry** | Google Analytics 4 (`G-1Z707JNGZS`) | Custom outbound link tracking with plan/provider dimensions + custom audit submission events. |
| **Form Webhook** | Google Apps Script (`no-cors` POST) | Anonymous community audit submission with honeypot anti-spam protection. |
| **Hosting** | GitHub Pages | Static hosting on root branch with custom domain via `CNAME`. |

---

## 4. Key Repetitive Skills & Runbooks

The repository includes pre-packaged skills in `.agents/skills/`:

1. **`prerender-deals`** (`.agents/skills/prerender-deals/SKILL.md`):
   Execute `python scripts/prerender.py` to regenerate static tables and Schema.org JSON-LD before committing deals updates.
2. **`deals-catalog-management`** (`.agents/skills/deals-catalog-management/SKILL.md`):
   Manage provider metadata, CGNAT opt-out statuses, 30-day notice rules, 28-day vs 365-day annual SIM math, filters, and tables.
3. **`design-system-and-ui`** (`.agents/skills/design-system-and-ui/SKILL.md`):
   Maintain color tokens (`--w-bg`, `--w-ink`, `--w-accent`), typography (Playfair / Inter / Outfit), glassmorphism, responsive navigation, and OpenGraph/SEO tags.
4. **`community-audit-webhook`** (`.agents/skills/community-audit-webhook/SKILL.md`):
   Maintain and test the community plan audit bottom sheet drawer, honeypot spam protection, and Google Apps Script endpoint.

---

## 5. Coding & Workflow Guidelines

- **Preserve HTML Splice Markers**: Never delete or rename the `<!-- PRERENDER:*:START -->` and `<!-- PRERENDER:*:END -->` comment tags in `deals/index.html`.
- **Skip CI for Prerender Commits**: When committing automated pre-renders, include `[skip ci]` in the commit message (e.g., `chore: pre-render deals page [skip ci]`).
- **Semantic Color Tokens**: All CSS should utilize the tokens defined in `assets/site-wide.css` (`--w-bg`, `--w-ink`, `--w-accent`, `--w-ink-70`, `--w-border`).
- **Accessible Color Contrast**: Maintain at least WCAG AA contrast (4.5:1 for normal text, 3:1 for large display numerals and UI controls).
- **SEO & Schema Integrity**: Every page must maintain unique `<title>`, `<meta name="description">`, `<link rel="canonical">`, OpenGraph tags, and valid Schema.org JSON-LD.
