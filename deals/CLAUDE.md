# Deals page memory

This file loads only when a session works under `deals/`. See the root `CLAUDE.md` for site-wide rules.

## Design direction

The deals comparison table (`deals/index.html`, `assets/site-deals.css`) follows progressive disclosure. The user prefers less information, less repetition, and less wasted space over exposing every available fact.

- `Essentials` is the default table mode.
- A compact row should answer only: who/what is the plan, intro price, ongoing price, first-year cost, how to get it, and any critical warning.
- `Full details`, `Technical details`, and `Terms` retain secondary information.
- Do not put every available fact in the default row merely because the data exists.
- Optimize for scanning and decision-making, not data density.

## UI/UX guardrails

The full mobile-first UI/UX standard (product identity, anti-slop blacklist, hard-gate scorecard, mandatory screenshot review, accessibility minimums) lives in `deals/UI_UX_GUARDRAILS.md`. Read it before any user-facing UI change on this page — it is a hard constraint, not a suggestion.

## Affiliate context

Commission Factory rejected the application. Do not assume Commission Factory affiliate access or invent affiliate URLs. The current offer model uses explicit feed metadata (`deal_channel`, `deal_channel_label`, public/direct price and URL fields), with WhistleOut specials as the current partner-offer example and direct provider routes as fallbacks.

## Guardrail

Preserve every `<!-- PRERENDER:*:START -->` / `<!-- PRERENDER:*:END -->` marker in `deals/index.html`. After any change to the page, run `python scripts/prerender.py` and verify the markers/schema before committing (see the `prerender-deals` skill).
