---
name: deals-catalog-management
description: >-
  Manage telco provider metadata, speed tier calculations, CGNAT opt-out statuses, 30-day notice rules,
  and filter UI in deals/index.html. Use when adding new telco providers, updating calculation math,
  or modifying plan comparison tabs.
---

# Deals Catalog Management Workflow

This skill outlines how to maintain, update, and extend the Australian broadband and mobile deals engine in `deals/index.html` and its associated CSS in `assets/site-deals.css`.

---

## Key Responsibilities

1. **Provider Metadata & Policy Rules**:
   - CGNAT status: dynamic IPv4 vs paid static IP ($5-$10/mo) vs opt-out policies.
   - 30-day cancellation notice periods (e.g., Superloop, Exetel, Swoop, Dodo, TPG, iiNet, SpinTel) vs pro-rata immediate cancellation (Aussie Broadband, Leaptel, Tangerine, Telstra).
   - Telstra Retail (99.6% pop) vs Telstra Wholesale (98.8% pop) footprint tagging.
2. **Cost & Savings Calculations**:
   - **True 1st-Year Cost**: Combining $X/mo promo rate for $N$ months + regular rate for remainder of year.
   - **28-Day Prepaid Cycle vs Monthly**: 13 recharges per year ($Price \times 13$) vs 12 monthly recharges ($Price \times 12$).
   - **365-Day Annual Packs**: Amortizing upfront pack cost to effective monthly cost ($\frac{Price}{12}$).
   - **My Monthly Price Delta**: Calculating savings compared to the user's custom current monthly bill (`localStorage.my_monthly_price`).
3. **Tabs & Category Filtering**:
   - `nbn`: Standard fixed-line NBN (tiers: 25, 50, 100, 250, 1000).
   - `5g`: 5G Home Wireless (capped 50/100 Mbps or uncapped max speed).
   - `satellite`: Remote & Satellite broadband (Starlink, NBN Sky Muster, Sky Muster Plus).
   - `mobile`: Mobile phone SIMs (Short expiry, 28/30-day monthly, 365-day annual prepaid).

---

## Common Procedures

### Adding a New Provider Explainer or Policy Badge
1. Update badge definitions and tooltip text in `deals/index.html` within `setupBadgeExplainers()` or the deal card renderer.
2. Ensure badge styling exists in `assets/site-deals.css`.
3. If the provider has unique billing terms (e.g. daily billing, setup fee waivers, e-SIM support), add appropriate badge pills to the card generation logic.

### Updating Filter Logic & URL State
- Filter state is synced with URL query parameters (`?tab=...&speed=...&sort=...`).
- When adding new filter controls, ensure both `readUrlState()` and `updateUrlState()` serialize the new parameter.

---

## Detailed References
- For JSON payload structures of `deals.json`, `changelog.json`, and `poi.json`, see [data-schemas.md](./references/data-schemas.md).
- For provider-specific CGNAT, notice period, and wholesale network rules, see [telco-rules.md](./references/telco-rules.md).
