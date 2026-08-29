# JRS Digital — UI/UX Guardrails for Claude Code

> **Purpose:** Prevent generic AI-generated UI, preserve JRS Digital's product identity, and force every frontend change through a consistent mobile-first UX and visual-quality standard.

This file is a **hard constraint**, not inspiration.

Claude Code must read and follow this document before creating, refactoring, or reviewing any user-facing UI for JRS Digital.

---

# 0. Relationship to Project Conventions

This document governs *visual and interaction design*. It does not replace or duplicate the project's engineering conventions — read those first:

- Root `CLAUDE.md` and `deals/CLAUDE.md` are the source of truth for architecture, the progressive-disclosure defaults (`Essentials` vs `Full details`/`Technical details`/`Terms`), affiliate/data-integrity context, and the `<!-- PRERENDER:*:START/END -->` guardrail (never break those markers; re-run `python scripts/prerender.py` after any change to `deals/index.html`).
- This is a **vanilla HTML/CSS/JS site** — no build step, no framework, no component library. Every reference below to a "component" means a reusable CSS class + markup pattern already established in `assets/site-wide.css` / `assets/site-deals.css`, not a JSX/React component.
- Existing design tokens (`--w-accent`, `--w-ink`, `--w-ink-70`, `--w-border`, `--jrs-green`, etc. — defined in `assets/site-wide.css`) are the palette. Reuse them; do not invent parallel one-off colors.
- See **§33 Project File Map** at the end for exactly where things live.

---

# 1. Product Identity

JRS Digital is a **data comparison product**, not a SaaS dashboard, fintech app, affiliate landing page, or marketing template.

The interface should feel:

- factual
- neutral
- compact
- trustworthy
- editorial
- intentional
- consumer-focused
- useful before decorative

The interface should **not** feel:

- AI-generated
- like a Dribbble concept
- like a startup landing page
- like a generic shadcn dashboard
- like a coupon/deal-hunting site
- like a bank/fintech product
- excessively playful
- promotional for its own sake

## Core principle

> **The interface should look designed around the data — not like data was inserted into a pre-made design.**

If a visual element exists only to make the page look "nicer", it should usually be removed.

---

# 2. Non-Negotiable Product Principles

Every UI decision must support at least one of:

1. understanding price
2. comparing plans
3. understanding plan differences
4. filtering faster
5. exposing pricing caveats
6. making technical information easier to inspect
7. improving trust
8. improving accessibility
9. reducing cognitive load

If it supports none of these, remove it.

## JRS comparison philosophy

JRS should never visually imply:

- "this is the best plan"
- "this is the winner"
- "this is recommended"
- "green means good"
- "red means bad"

unless JRS has explicitly implemented and documented such a recommendation system.

Default ranking should feel mathematical and transparent.

**If a UI element highlights the current top-of-sort result, it must (a) carry a label naming the exact sort criterion driving it (e.g. "Lowest 1st-year cost"), never a vague superlative like "Best Deal", and (b) use a neutral/ink visual treatment, not a success-green or red one.** A neutral highlight that names its own math is transparency; a green highlight is an implied endorsement — even with an honest label attached.

---

# 3. Mobile First Is Mandatory

Primary design target:

- **390 × 844**

Also test:

- 360 × 800
- 430 × 932
- 768 × 1024
- 1440 × 900

The mobile version is not a compressed desktop page.

It is the primary product experience.

## Mobile requirements

On mobile:

- plan results must appear quickly
- filtering must not dominate the first screen
- horizontal scrolling must not be required for core comparison
- touch targets should generally be at least 44px
- content must not rely on hover
- text must not become tiny to preserve desktop density
- first-year price and ongoing price must remain easy to locate
- controls must wrap or scroll intentionally
- long technical details should use progressive disclosure
- repeated information must be reduced

### Above-the-fold priority

The first viewport should communicate:

1. what the page is
2. what category is being compared
3. the most important filter
4. number of results
5. the beginning of actual plan results

Avoid large hero sections on comparison pages.

---

# 4. JRS Visual Direction

## Layout

Prefer:

- white or near-white background
- open layout
- strong typographic hierarchy
- subtle dividers
- restrained borders
- small intentional spacing system
- structured rows
- progressive disclosure

Avoid:

- card-on-card layouts
- excessive containers
- floating panels for ordinary information
- unnecessary sidebars on mobile
- huge empty areas
- ornamental sections

## Radius

Default:

- 4px–8px

Use larger radius only when there is a clear interaction or brand reason (e.g. a bottom sheet's rounded top edge signaling "this slides up/down").

Do not use 16px–32px rounded corners across every component.

## Shadows

Default:

- none

Use shadows only where elevation communicates actual interaction or layering (e.g. a modal/sheet floating above dimmed content).

Prefer:

- `1px` borders
- dividers
- spacing

over drop shadows.

## Colour

Brand colour should be used selectively.

Avoid using colour merely to create visual excitement.

Do not use:

- decorative purple/blue gradients
- glow effects
- gradient cards
- gradient text
- random green success surfaces
- red warning surfaces for normal price differences

**Project palette (see `:root` in `assets/site-wide.css`):** `--w-accent` (orange) is the one primary-action/promo color. `--jrs-green` is reserved specifically for genuine savings/trust signals (an actual dollar discount, a real trust badge) — never for "this row is better than that row" (see §2). Any new color must map to an existing token, not a new hex literal.

## Typography

Typography should create hierarchy before boxes do.

Recommended direction:

- Page title: 26–30px
- Section heading: 18–22px
- Plan/provider title: 18–22px
- Important price: 22–28px
- Body: 15–16px
- Metadata: 13–14px

Avoid 40px+ marketing headings on comparison pages unless explicitly justified.

---

# 5. AI-Slop Blacklist

A UI should be considered suspicious if it contains multiple items below.

## Automatic anti-patterns

Do NOT default to:

- purple/blue gradients
- gradient text
- glowing surfaces
- glassmorphism
- large-radius cards everywhere
- excessive cards
- cards nested inside cards
- floating cards for ordinary data
- fake KPI dashboards
- giant hero numbers without information context
- feature-card grids
- "Trusted by..." strips
- fake testimonials
- decorative blobs
- floating sparkles
- generic 3D mascots
- random illustrations
- excessive soft shadows
- badge/pill soup
- icon beside every label
- arbitrary success-green treatments
- generic SaaS CTA bars
- oversized marketing copy
- giant "Get Started" buttons
- decorative sticky bars (a promotional/CTA bar with no functional purpose — a genuine persistent utility control, like a page-wide price-comparison input, is not this, provided it stays compact, single-purpose, and doesn't duplicate a CTA that already exists elsewhere on the page)
- default shadcn aesthetics
- default Tailwind demo layouts
- generic Lucide icon spam

## Hard rule

If the design resembles a generic SaaS template more than a consumer comparison tool:

> **FAIL THE DESIGN.**

---

# 6. Cards Are Not the Default

Do not automatically use a `Card` component.

**This project already has one established bordered-row convention: `.deal-entry`, one per plan result.** That is the accepted exception §6 allows for below. Do not introduce a *second, visually different* card style elsewhere (a card-in-a-card for a single badge, a floating panel for one stat) without asking the same question.

Before adding a card, ask:

> Does this information need a visually contained surface to be understood?

If no:

- use spacing
- use dividers
- use headings
- use grouping

instead.

## Plan results

Plan results may use a bordered container if it improves scanning, but should remain:

- compact
- factual
- visually restrained
- easy to compare vertically

Do not turn each plan into an ecommerce tile.

---

# 7. Pills and Badges

Use pills only for:

- active filters
- selectable states
- genuinely exceptional plan attributes

Do not convert normal metadata into pills.

Bad:

- `NBN`
- `50 Mbps`
- `30-day notice`
- `No lock-in`
- `CGNAT`
- `IPv6`
- `Australia`

all displayed as separate pills.

Better:

> 50 Mbps evening · 30-day notice · CGNAT opt-out available

## Badge limit

Plan result:

- ideally 0–1
- maximum 2 unless there is a strong product reason

A normal plan property is not a badge.

---

# 8. Icons

Icons are optional.

Do not add an icon merely because an icon exists.

Use an icon only when it:

- improves scanning
- communicates a familiar action
- reduces wording
- clarifies state

Avoid:

- icon + label for every data point
- decorative icons
- generic icon grids

Text is often better.

---

# 9. Plan Information Hierarchy

For consumer plan comparison, prioritise:

1. provider
2. plan name / speed tier
3. promotional monthly price
4. promo duration
5. ongoing monthly price
6. first-year total
7. important contract / cancellation terms
8. typical evening speed
9. unusual pricing route
10. technical details

Not every item must have equal visual weight.

## First-year cost

First-year cost is a key JRS differentiator.

It should be easy to find but must not become a giant decorative fintech-style hero number.

Good:

> First year
> **$665.70**

Bad:

> giant glowing green `$665.70` panel

---

# 10. Pricing Language

JRS should use precise, neutral language.

Avoid ambiguous wording such as:

> Save $173.70

when the calculation actually means:

> introductory discount compared with paying the ongoing monthly rate for 12 months

Prefer wording such as:

- Introductory discount
- First-year total
- Ongoing monthly price
- Public offer
- Partner offer
- Cheaper signup route found

Do not imply savings against an external baseline unless that baseline is explicitly defined.

---

# 11. Signup Route Differences

This is valuable JRS-specific information.

If the same provider/plan has different pricing through different signup routes:

show it clearly and neutrally.

Example:

**Cheaper signup route found**

WhistleOut offer: **$41/mo**
Public offer: **$44/mo**

Do not turn this into:

- a giant affiliate banner
- an aggressive "DEAL" badge
- flashing promotional UI
- fake urgency

The value is transparency.

---

# 12. Filters

Filters should help users narrow results without overwhelming them.

## Primary filters

Expose only the most common decisions upfront.

Examples:

- plan type
- speed
- sort order

## Secondary filters

Place advanced filters behind a dedicated filter control or sheet.

Examples:

- provider
- network
- CGNAT
- static IP
- upload characteristics
- cancellation notice
- technical network properties

Do not require a non-technical household user to understand advanced networking terminology before seeing results.

---

# 13. Progressive Disclosure

Technical detail is valuable, but should not compete with core price comparison.

Use:

- "More details"
- expandable rows
- disclosure sections
- dedicated technical details area

for:

- CGNAT
- static IP
- IPv6
- IX presence
- upload information
- network routing details
- niche infrastructure metadata

Essential pricing should remain visible without expansion.

---

# 14. Navigation and Header

Comparison pages should have a compact header.

Do not use a marketing hero unless explicitly requested.

Preferred structure:

- JRS identity
- page title
- concise data freshness / provider count
- category controls
- comparison content

Navigation should not push useful plan data far below the fold.

---

# 15. Data Integrity

Never invent:

- provider names
- provider logos
- plan prices
- promotion duration
- speeds
- technical properties
- availability
- discounts
- rankings
- review counts
- savings claims

If data is unavailable:

- omit it
- use an intentional empty state
- mark it as unavailable

Never fabricate realistic-looking placeholder commercial data in production UI.

---

# 16. Loading, Empty and Error States

Every data-dependent interface must account for:

## Loading

Use:

- subtle skeletons
- layout-preserving placeholders

Avoid flashy shimmer effects if unnecessary.

## Empty

Explain:

- why no plans are shown
- which filters may be restricting results
- the easiest recovery action

## Error

State:

- that data could not be loaded
- what the user can do
- whether retry is available

Do not blame the user.

---

# 17. Accessibility

Minimum requirements:

- semantic HTML
- keyboard-accessible controls
- visible focus states
- sufficient text contrast
- no information communicated by colour alone
- descriptive button/link labels
- form labels
- accessible expandable sections
- readable text at mobile sizes
- respect `prefers-reduced-motion`

Interactive UI must work without a mouse.

**A modal/sheet/drawer must additionally:** trap focus while open, close on `Escape`, restore focus to whatever opened it on close, and carry `role="dialog"` + `aria-modal="true"` + an `aria-labelledby` pointing at its visible title.

---

# 18. Motion

Motion should clarify state or navigation.

Allowed examples:

- filter drawer transition
- expand/collapse
- subtle content transition
- state change feedback

Avoid:

- decorative floating objects
- random parallax
- glowing animated gradients
- bouncing CTA buttons
- unnecessary micro-animation on every element

If motion does not improve comprehension:

> remove it.

---

# 19. No Frameworks, No Component Libraries

This project is intentionally vanilla HTML/CSS/JS (see root `CLAUDE.md`) — no React/Vue/Svelte, no bundler, no utility-class or component library (shadcn, Radix, Tailwind, Material, Bootstrap, etc.). Do not introduce one to solve a UI problem, however small.

## Before writing new CSS

Ask:

1. Does an existing class in `assets/site-wide.css` or `assets/site-deals.css` already do this?
2. Can an existing design token (`--w-*`, `--jrs-*`) express the color/spacing/radius instead of a new literal value?
3. Does this need a new class at all, or does composing existing classes solve it?
4. If genuinely new: does it match the radius/shadow/color defaults in §4, not a library's defaults recalled from elsewhere?

The final product must look like JRS's own established system, not a library's default aesthetic reproduced by hand.

---

# 20. Mandatory Design Reasoning Before Coding

Before implementing a significant new screen or redesign, Claude must first write a short internal design plan covering:

1. user goal
2. top 3 pieces of information
3. above-the-fold content
4. information that can be hidden initially
5. elements that deserve containers
6. elements that should not use cards
7. primary interaction
8. mobile behaviour

Do not begin with markup or CSS.

Start with hierarchy.

---

# 21. Real Content Requirement

Design with realistic production content.

Do not design around:

- "Plan Name"
- `$XX.XX`
- "Feature 1"
- lorem ipsum

Use realistic plan lengths, names and metadata when available.

This reveals real wrapping, density and hierarchy problems.

---

# 22. Mandatory Screenshot Review

After implementing significant UI changes:

1. run the site (see `run` skill / local static server)
2. capture screenshots
3. inspect actual rendered output
4. review at the §3 breakpoints:
   - 360 × 800
   - 390 × 844
   - 430 × 932
   - 768 × 1024
   - 1440 × 900
5. revise based on the screenshot

Do not approve a UI solely by reading its code.

---

# 23. Independent Critic Mindset

When reviewing completed UI, behave as if another designer created it.

Do not defend the implementation.

Do not use vague praise such as:

- clean and modern
- polished
- beautiful
- great UX
- looks good

Every assessment must cite specific evidence.

---

# 24. UI Evaluation Scorecard

Score each category from 1–10.

| Category | Minimum |
|---|---:|
| Information hierarchy | 8 |
| Mobile usability | 8 |
| Product clarity | 8 |
| Originality / anti-slop | 8 |
| Visual craft | 7 |
| Accessibility | 8 |
| Data density | 7 |
| Interaction clarity | 8 |

## Hard gate

The UI automatically fails if any of these are below 8:

- Information hierarchy
- Mobile usability
- Product clarity
- Originality / anti-slop

Do not average a weak score away.

Example:

- hierarchy: 9
- mobile: 9
- product clarity: 9
- originality: 5

Result:

> **FAIL**

not 8/10.

---

# 25. Anti-Slop Review

Before declaring work complete, perform one final pass that only removes or simplifies.

Review:

- cards
- borders
- shadows
- radius
- pills
- badges
- icons
- decorative colours
- duplicated labels
- excessive headings
- redundant CTAs
- unnecessary helper text
- unnecessary containers
- excessive spacing

For every element ask:

> Does this help the user understand, compare, decide, navigate, or act?

If no:

> remove it.

---

# 26. Mobile UX Tasks

A design should be manually tested against tasks such as:

### Task 1
Find the lowest first-year-cost NBN 50 plan.

### Task 2
Determine what the plan costs after the promotion.

### Task 3
Find whether CGNAT can be disabled.

### Task 4
Identify whether a cheaper signup route exists.

### Task 5
Change from NBN 50 to NBN 100.

### Task 6
Filter by provider.

### Task 7
Open technical details.

If these tasks are visually confusing or require unnecessary scrolling:

> revise the design.

---

# 27. Comparison Screen Acceptance Criteria

A plan-comparison screen should not be considered finished unless:

- [ ] real results begin quickly on mobile
- [ ] users can identify promo and ongoing price
- [ ] first-year total is easy to locate
- [ ] price hierarchy is neutral
- [ ] filters do not overwhelm the initial experience
- [ ] advanced technical data is progressively disclosed
- [ ] no horizontal overflow exists
- [ ] touch targets are usable
- [ ] provider rows remain easy to compare
- [ ] no badge soup exists
- [ ] no generic SaaS hero exists
- [ ] no unnecessary card nesting exists
- [ ] no decorative gradients exist
- [ ] the screen passes the anti-slop score
- [ ] screenshots were inspected at target widths

---

# 28. Default Mobile Structure

Use this as a structural reference, not as a pixel-perfect template.

```text
JRS DIGITAL                                  Menu

Internet & mobile plans
264 plans · 37 providers · Updated today

NBN       OptiComm       Mobile       Satellite
──────────────────────────────────────────────

Speed
25   50   100   500   750   1000

42 plans

Lowest first-year cost                 Filters
──────────────────────────────────────────────


SpinTel
NBN 50/20

$41/mo × 6 months
then $69.95/mo

First year                              $665.70

50 Mbps evening · 30-day notice
CGNAT opt-out available

Cheaper signup route found ↓

View plan →


──────────────────────────────────────────────

Superloop
NBN 50/20

$69/mo × 6 months
then $85/mo

First year                              $924.00

50 Mbps evening · No lock-in

View plan →
```

Important:

- this is an information hierarchy reference
- do not reproduce it blindly
- adapt to real data and interaction needs

---

# 29. When Adding New UI

Before introducing a new visual concept, answer:

1. What user problem does it solve?
2. Why does it need a new component?
3. Could existing typography or spacing solve it?
4. Does it increase cognitive load?
5. Does it resemble a common AI-generated pattern?
6. Does it make plan comparison faster?

If answers are weak:

> do not add it.

---

# 30. Claude Code Completion Protocol

For meaningful frontend work, final output should include:

## Changed

A concise summary of what changed.

## UX rationale

Why the chosen hierarchy improves the task.

## Mobile checks

Which mobile widths were reviewed.

## Removed / avoided

List any slop patterns intentionally avoided.

## Known issues

Any remaining visual or interaction issues.

## Result

`PASS` or `FAIL` against this guardrail.

Do not claim `PASS` unless all hard gates are met.

---

# 31. Review Prompt

When reviewing an existing JRS UI, use this mindset:

> You are a highly critical senior product designer reviewing a production consumer comparison product.
>
> You did not create this interface.
>
> Your job is not to encourage the developer. Your job is to prevent generic, misleading, low-quality, or AI-generated-looking UI from reaching production.
>
> Identify specific evidence.
>
> For each issue state:
>
> **WHAT** is wrong
> **WHY** it harms the experience
> **CHANGE** required
>
> Explicitly inspect:
>
> - information hierarchy
> - price comprehension
> - mobile usability
> - unnecessary cards
> - excessive radius
> - badge soup
> - unnecessary icons
> - decorative gradients
> - generic SaaS patterns
> - component-library defaults
> - excessive copy
> - redundant actions
> - accessibility
>
> Finish with:
>
> `PASS`
>
> or
>
> `FAIL`
>
> A design cannot pass if Information Hierarchy, Product Clarity, Mobile Usability, or Originality scores below 8/10.

---

# 32. Final Rule

When choosing between:

> **more visually impressive**

and

> **easier to understand**

choose:

> **easier to understand**

When choosing between:

> **more components**

and

> **better hierarchy**

choose:

> **better hierarchy**

When choosing between:

> **generic polish**

and

> **JRS-specific clarity**

choose:

> **JRS-specific clarity**

---

# 33. Project File Map

Quick reference for where things actually live, so this document doesn't have to be re-derived from scratch each session:

- Design tokens, shared header/footer: `assets/site-wide.css`
- Deals-page-specific styles (cards, filters, toolbar, hero, mobile sheet): `assets/site-deals.css`
- Deals page markup + all client-side JS (one inline `<script>`): `deals/index.html`
- Prerender / static-snapshot generation for crawlers: `scripts/prerender.py` — re-run after any `deals/index.html` change; never hand-edit content between `<!-- PRERENDER:*:START/END -->` markers
- Project conventions: root `CLAUDE.md`, `deals/CLAUDE.md`

---

# Summary for Claude

Do not make JRS look "modern" by adding common AI-generated patterns.

Make it better by:

- clarifying hierarchy
- improving data presentation
- reducing unnecessary UI
- testing mobile layouts
- exposing pricing truth
- making advanced detail optional
- preserving visual restraint
- reviewing rendered screenshots
- rejecting generic design patterns

**JRS Digital is a comparison utility. Design it like one.**
