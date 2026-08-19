# Community Audit Webhook Specification

## 1. Webhook Payload Format

Dispatched as JSON via HTTP POST (`mode: 'no-cors'`) to Google Apps Script:

```typescript
interface AuditSubmissionPayload {
  provider: string;                // e.g. "Leaptel", "Aussie Broadband"
  tier: string;                    // e.g. "NBN 100/20"
  speedMatch: "meets" | "below" | "exceeds";
  priceMatch: "matches" | "higher" | "hidden_fees";
  state: "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT" | null;
  note?: string;                   // Optional user feedback (max 280 chars)
  hp_company: string;              // Anti-spam honeypot (MUST be empty "")
  submittedAt: string;             // ISO 8601 string
}
```

---

## 2. Google Apps Script Endpoint Implementation Example

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Honeypot check: reject bots immediately
    if (data.hp_company && data.hp_company.length > 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: "ignored" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([
      new Date(),
      data.provider,
      data.tier,
      data.speedMatch,
      data.priceMatch,
      data.state || "unspecified",
      data.note || "",
      data.submittedAt
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 3. Privacy Terms & Compliance

- **No Personal Identifiers**: No IP address logging, no cookie tracking, no email/name collection.
- **180-Day Retention Window**: Raw feedback is aggregated and anonymized after 180 days to compute community confidence scores.
