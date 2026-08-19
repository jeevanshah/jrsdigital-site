# Design Tokens & Typography Reference

## 1. CSS Custom Properties (`assets/site-wide.css`)

```css
:root {
  /* Surface & Background */
  --w-bg: #FFFFFF;
  --w-surface: #FFFFFF;
  --w-border: #E4E7EC;

  /* Typography / Ink */
  --w-ink: #111827;            /* Headings & dark accents (16:1 contrast) */
  --w-ink-70: #475467;         /* Body copy & descriptions (7.7:1 contrast) */
  --w-ink-50: rgba(17, 24, 39, 0.6); /* Low-emphasis captions, footer (4.7:1 contrast) */

  /* Primary Action & Brand Accents */
  --w-accent: #FF4B16;         /* Primary brand orange CTA */
  --w-accent-strong: #E0430F;  /* Hover / active state */
  --w-accent-ink: #FFFFFF;     /* White text on accent fill */

  /* Secondary Accents */
  --jrs-orange-bright: #FF6A00;
  --jrs-yellow: #FFC83D;
  --jrs-green: #348B27;        /* Savings / verified status */
  --jrs-green-strong: #2A6F1F; /* Savings hover state */

  /* Radius & Spacing */
  --w-radius: 10px;
  --w-radius-sm: 6px;
  --w-radius-lg: 14px;
}
```

---

## 2. Typography Hierarchy

1. **Display & Headings**:
   - Font Family: `Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
   - Weight: `600` / `700`
   - Letter Spacing: `-0.02em` to `-0.03em` for crisp modern display
2. **Body Prose & Data**:
   - Font Family: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
   - Weight: `400` (Regular), `500` (Medium), `600` (Semibold)
   - Line Height: `1.55` - `1.6` for readable body paragraphs
3. **Monospace & Numeric Code**:
   - Font Family: `"JetBrains Mono", "Fira Code", monospace`
   - Used for IP addresses, POI codes, and technical badge indicators.

---

## 3. Standard UI Components

- **Pills / Badges (`.deal-badge`)**:
  Compact rounded pills with subtle backgrounds and high-contrast labels.
- **Buttons (`.w-btn`, `.w-btn-primary`, `.w-btn-ghost`)**:
  Standardized 10px radius with smooth 150ms ease transition on hover and focus outline rings for accessibility.
- **Card Containers (`.w-card`)**:
  Subtle 1px solid border (`var(--w-border)`), soft shadow, white surface background.
