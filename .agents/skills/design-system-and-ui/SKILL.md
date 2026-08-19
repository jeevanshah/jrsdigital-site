---
name: design-system-and-ui
description: >-
  Maintain and build web UI components, CSS design tokens, typography, glassmorphism, responsive navigation,
  3D WebGL heroes, and SEO metadata across jrsdigital.net pages. Use when editing styles, creating new pages,
  or updating visual assets.
---

# Design System & UI Workflow

This skill guides the design standards, CSS architecture, interactive animations, and responsive layout guidelines for JRS Digital website pages.

---

## Design System Architecture

The site uses a modern **wide theme** palette defined in `assets/site-wide.css`:
- **Page Background**: Pure white (`--w-bg: #FFFFFF`)
- **Headings & Primary Text**: Deep Navy / Charcoal (`--w-ink: #111827`)
- **Body & Secondary Text**: Muted Navy-Grey (`--w-ink-70: #475467`) (Passes 7.7:1 AA contrast)
- **Primary Accent / Promo**: High-energy Orange (`--w-accent: #FF4B16`, hover: `#E0430F`)
- **Savings / Trust Accent**: Green (`--jrs-green: #348B27`, hover: `#2A6F1F`)
- **Border & Dividers**: Light slate (`--w-border: #E4E7EC`)
- **Corner Radius**: Standardized compact radius (`--w-radius: 10px`)

### In-App (PriceMinder) vs Marketing Site Palettes
- **Marketing Site Chrome**: Wide white/slate/orange theme (`assets/site-wide.css`).
- **PriceMinder App UI Mockups**: Dark charcoal (`#0B0B11`-`#14141C`), warm gold accent (`#C8A96E`), violet accent (`#6C63FF` to `#8B7FFF`), serif display numerals (Playfair Display).

---

## Interactive Components & Scripts

1. **Navigation (`assets/site-nav.js`)**:
   Controls mobile hamburger drawer toggling, backdrop blurring, and escape key listener.
2. **3D WebGL Bonsai Canvas (`assets/bonsai-scene.js`)**:
   Custom Three.js procedural bonsai tree render on homepage hero with mouse-driven camera panning and bloom lighting.
3. **3D Phone Render (`assets/hero-3d.js`)**:
   Interactive 3D smartphone floating at a $3/4$ angle with screen lighting and ambient rotation.
4. **Hero Glow & Effects (`assets/hero-effects.js`)**:
   Mouse-following radial gradient glow on hero sections.

---

## Workflow Rules

1. **Always Use CSS Custom Properties**: Never hardcode colors when corresponding `--w-*` or `--jrs-*` variables exist.
2. **Accessible Contrast Ratios**: Ensure all text elements meet WCAG AA (4.5:1 for normal text, 3:1 for large headings and UI icons).
3. **No External Frameworks**: Do not add Tailwind CSS or component libraries unless explicitly approved.
4. **Preserve SEO Tags**: When updating or creating HTML pages, preserve `<link rel="canonical">`, OpenGraph tags, and Schema.org JSON-LD scripts.

---

## Detailed References
- For full token catalog, fonts, and component patterns, see [tokens-and-typography.md](./references/tokens-and-typography.md).
- For OpenGraph, Twitter cards, and Schema.org graph configurations, see [seo-and-schema.md](./references/seo-and-schema.md).
