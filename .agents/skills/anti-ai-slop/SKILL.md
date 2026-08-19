---
name: anti-ai-slop
description: >-
  Workflow for designing and building websites, landing pages, and UI so the output does NOT look like generic "AI slop" (Inter font, purple-blue gradients, 3D SaaS blobs, glassmorphic cards, cookie-cutter hero sections). Use this whenever the user asks to design, build, restyle, or make less generic a landing page, marketing site, website, or web app UI, especially when they say things like "make it look more premium", "this looks AI-generated", "give it more taste", or "don't one-shot it". Covers three stages: curating a personal taste and inspiration library, installing design-quality tools (Impeccable, Taste Skill, Higgsfield MCP, 21st.dev), and running a wide-net, iterate-and-narrow build sequence instead of a single one-shot prompt. Trigger this proactively any time Claude/Antigravity is about to generate a landing page or hero section from a bare prompt, since that is exactly the situation that produces slop.
---

# Anti AI Slop: designing web UI with actual taste

## Why this exists

Left to its own devices, an LLM regresses to the mean: Inter font, blue-purple gradients, glassmorphic cards, 3D blobs, the same hero-section shape everyone else gets. The fix isn't a smarter model — it's injecting **your** taste into the process instead of asking for "a landing page" and hoping. This skill is a workflow, not a template. Never try to one-shot a finished website. The goal is to cast a wide net, narrow down visually, and only get specific once a direction is chosen.

Follow these three stages in order.

---

## Stage 1: Build (or use) a taste library

Before generating anything, gather reference material that reflects what the user actually likes. If no library exists yet, ask the user for some of the following, or offer to help them collect it:

- Screenshots or links from Dribbble, Pinterest, or design-focused Twitter/X accounts (search "web design," "popular," or a specific style)
- Screenshots of specific hero sections, layouts, or components they've admired
- Actual URLs of live websites whose *feel* (not content) they want to echo — Claude/Antigravity can browse these directly

If the user has a folder of screenshots, treat it as a real design library: group images by aesthetic family (e.g. "print tech / paper," "dither mono," "vast quiet cinematic," "classical remix") and, for each, note a short description and keywords. When building a new page, pull from this library instead of generating a style from nothing — reference specific saved images or URLs in the build prompt.

If no library exists and there's no time to build one, at minimum ask the user to describe 1-2 real websites or aesthetics they like before generating anything. Never generate a landing page from a bare functional description alone ("build me a SaaS landing page") — that's the exact path to slop.

---

## Stage 2: Use design-quality tools, not raw generation

Before generating pages, check whether these are available and offer to install what's missing (all are legitimate open-source projects the user can install):

- **Impeccable** (`impeccable.style`) — a skill with ~23 commands (`bolder`, `overdrive`, `clarify`, etc.) that push a design toward more impact or more restraint across typography, color, spatial design, responsiveness, interaction, motion, and UX writing. It also has a "slop" detector across 46 known AI-slop patterns and a live dev-server mode for clicking through and adjusting components visually.
- **Taste Skill** — a comparable skill focused on stronger layout, typography, motion, and spacing, aimed at avoiding boilerplate-looking UI.
- **Higgsfield MCP** (`higgsfield.ai`) — gives image and video generation tools (useful for hero backgrounds and custom assets).
- **21st.dev** — a component reference site (buttons, cards, pricing sections, pagination, etc.). Not an MCP — just browse it for inspiration and copy the prompts it provides for specific components when a lower-level piece needs work.

Use judgment about how many of these to install. Don't chase every niche "one skill solves design" repo — narrow, prescriptive skills tend to produce one kind of output over and over. Impeccable, Taste Skill, and Higgsfield are useful because they're flexible: they push quality in a direction rather than locking in a specific look. The actual "good" output still depends on the taste and prompting brought to Stage 3.

---

## Stage 3: Build via wide-net iteration, never a one-shot

### The funnel

1. **5 wide variants.** Generate 5 different aesthetic directions for the same page at once (not one at a time in the terminal — put them where they can be compared side by side, e.g. as separate preview pages/tabs). Pull the 5 aesthetics from the taste library's style groupings if one exists, or just ask for 5 explicitly distinct styles.
2. **Pick a direction, then 3 refinements.** Once the user picks a favorite of the 5, generate 3 variations within that one aesthetic (different body layouts, information density, navigation treatment, etc.).
3. **Pick one, then nail the hero image.** With a layout chosen, generate several (e.g. 4) hero image options in that aesthetic using an image-generation tool, high resolution. Iterate on the image alone before touching layout further (e.g. "same composition, add a splash of color").
4. **Assemble and polish transitions/motion.** Bring the chosen hero into the chosen layout. Explicitly ask for the hero-to-body transition to feel intentional (no jarring cuts) and for page-load motion to have "weight" — content revealing progressively rather than popping in all at once.
5. **Add a live tweaks panel for fine detail.** Add a floating on-page "tweaks" panel exposing whatever is still a judgment call — heading/body font, font size, accent colors, hero treatment, motion timing, spacing. This lets the user iterate visually in real time instead of guessing blind or re-prompting for every small change. Make it aggressive — expose more knobs rather than fewer.

At every step, prefer generating several options and comparing rather than asking for one output and then verbally trying to fix it ("make it more premium"). Visual comparison beats verbal iteration.

---

### What to include in a build prompt

Every prompt in this workflow (especially the Stage 3 step 1 "5 variants" prompt) should carry four things:

- **Aesthetic** — the general design family being aimed for (e.g. "print tech / paper texture," "vast, quiet, cinematic minimalism").
- **Reference** — a specific image or URL from the taste library. This is about matching *feel*, not copying content or layout.
- **Intent** — what the page is, who it's for, and what the primary action should be (book a demo, sign up, read through, etc.). This shapes structure, not just skin.
- **Guardrails** — explicit "always" and "never" rules, especially to block known slop patterns: no purple/blue gradients, no Inter font by default, no 3D SaaS blobs, no glassmorphic cards, unless the user genuinely wants one of these.

Keep this to a few sentences per point — not a giant fixed template. A rigid, exhaustive `design.md` produces the same narrow output every time; a short, specific brief lets each project actually look different.

---

### Example prompt shape

> "Build a landing page for [Product], [one-line description of what it does and for whom]. Intent: [primary user action, e.g. book a demo]. Guardrails: [things to avoid — purple gradients, Inter, 3D blobs; things to always include — e.g. a full-bleed hero image]. Generate 5 versions, each in a different aesthetic direction: [list 5 style names/descriptions, or 'pick 5 families from my inspiration library']. For each, specify the aesthetic, a reference image/URL, and a one-line description of what the hero should look like."

---

## Common failure mode to watch for

If a user asks for a landing page/UI cold, with no reference material and no stated aesthetic, don't generate a single finished page. Either pull from an existing taste library, ask 1-2 quick questions to establish a direction and guardrails, or — if working unattended — generate the Stage 3 step 1 "5 wide variants" first and present them for a choice, rather than committing to one direction no one has seen.
