---
name: community-audit-webhook
description: >-
  Maintain and test the community plan audit feedback drawer, honeypot anti-spam protection,
  Google Apps Script webhook integration, and 180-day privacy retention compliance. Use when modifying
  the plan verification drawer or audit submission logic.
---

# Community Plan Audit Webhook Workflow

This skill documents the anonymous community plan audit verification drawer in `deals/index.html` and its Google Apps Script webhook integration.

---

## Overview

The community audit drawer allows Australian users to submit real-world speed and pricing feedback for specific broadband or mobile plans:
- **Trigger**: Click on `.deal-audit-trigger` next to any plan row or header.
- **Fields**: Speed match rating, price match rating, Australian state selector (NSW, VIC, QLD, WA, SA, TAS, ACT, NT), optional note.
- **Anti-Spam**: Hidden honeypot field (`hp_company`) with `tabindex="-1"` and `autocomplete="off"`. If populated, the submission is silently dropped by the webhook script.
- **Rate-Limiting / Deduplication**: Client records `audit_<provider>` timestamp in `localStorage` to avoid duplicate prompts within the same calendar month.
- **Webhook**: Dispatched via `fetch(COMMUNITY_AUDIT_ENDPOINT, { method: 'POST', mode: 'no-cors' })`.
- **Telemetry**: Emits GA4 event `community_audit_submit`.

---

## Testing & Verification

1. **Local Submission Test**:
   - Open `http://localhost:8123/deals/` in a browser.
   - Click "Verify" or "Audit" on any plan row.
   - Select speed and price feedback chips, select an Australian state chip, and submit.
   - Verify that the success view (`#audit-success-view`) is displayed.
   - Check `localStorage.getItem('audit_<provider>')` in browser DevTools.

2. **Honeypot Validation**:
   - Verify that the honeypot field remains completely invisible to legitimate human users across all screen sizes and mobile viewports.

---

## Detailed References
- For JSON payload schema, Google Apps Script handler snippet, and privacy policies, see [audit-webhook-spec.md](./references/audit-webhook-spec.md).
