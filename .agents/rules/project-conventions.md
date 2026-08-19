# Project Coding Conventions & Rules for JRS Digital

These rules apply across all modifications to the `jrsdigital-site` codebase.

## 1. Architecture & Dependency Rules
- **No Heavy Frameworks**: Do not introduce node build chains (webpack/vite/next.js) or UI frameworks (React/Vue/Angular) to this static website unless explicitly requested.
- **Vanilla CSS Tokens**: Use existing CSS custom properties (`--w-*` from `assets/site-wide.css`). Avoid inline styles and ad-hoc utility classes.
- **Relative vs Absolute Asset Paths**: Use absolute root paths for static assets (e.g. `/assets/site-wide.css`, `/assets/img/favicon.ico`) to ensure subdirectories (like `/deals/` and `/priceminder/`) resolve assets properly.

## 2. Deals Engine & Pre-rendering Rules
- **Pre-render Markers**: In `deals/index.html`, the following marker pairs must remain intact:
  - `<!-- PRERENDER:UPDATED:START -->` ... `<!-- PRERENDER:UPDATED:END -->`
  - `<!-- PRERENDER:GRID:START -->` ... `<!-- PRERENDER:GRID:END -->`
  - `<!-- PRERENDER:CHANGELOG:START -->` ... `<!-- PRERENDER:CHANGELOG:END -->`
  - `<!-- PRERENDER:SCHEMA:START -->` ... `<!-- PRERENDER:SCHEMA:END -->`
- **Dynamic JS Independence**: The client-side JavaScript in `deals/index.html` re-hydrates dynamic elements from fresh JSON fetched from GitHub raw. Any pre-rendered HTML acts purely as a static snapshot for SEO and first paint.
- **Commit Messages for Pre-render Updates**: Commits that only update the pre-rendered HTML must include `[skip ci]` to prevent looping GitHub Actions workflows:
  ```bash
  git commit -m "chore: pre-render deals page [skip ci]"
  ```

## 3. SEO & Structured Data Rules
- Every page must have:
  - Canonical link: `<link rel="canonical" href="https://jrsdigital.net/...">`
  - OpenGraph tags: `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image`
  - Twitter cards: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
  - Valid Schema.org JSON-LD scripts (`@graph` containing `Organization`, `WebApplication`, or `FAQPage`).

## 4. Privacy & Form Handling
- Community plan audits must NEVER collect personally identifiable information (PII) like names, phone numbers, or email addresses.
- Anti-spam honeypot fields (`hp_company`) must remain hidden with zero tabindex and autocomplete disabled.
- Privacy retention terms specify a 180-day anonymized feedback window.
