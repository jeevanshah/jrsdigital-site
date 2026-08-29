# Deals Data Schemas Reference

The deals page ingests three JSON data sources hosted on GitHub Raw (`au-plans-scraper` repo).

---

## 1. `deals.json` Schema

URL: `https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/deals.json`

Each element in the array represents a single plan offer:

```typescript
interface DealPlan {
  id: string;                      // Unique slug/hash for the plan
  provider: string;                // e.g. "Aussie Broadband", "Leaptel", "Superloop"
  serviceType: "nbn" | "mobile" | "satellite" | "5g";
  tier: string;                    // e.g. "NBN 50/20", "NBN 100/20", "300GB 365-Day"
  downloadSpeed?: number;          // Nominal download speed in Mbps (e.g. 50, 100, 1000)
  uploadSpeed?: number;            // Nominal upload speed in Mbps (e.g. 20, 40, 50)
  typicalEveningSpeed?: number;    // ACCC reported evening speed in Mbps (7-11pm)
  regularPrice: number;            // Standard ongoing monthly/cycle price in AUD
  promoPrice?: number;             // Discounted rate during promotional period
  promoMonths?: number;            // Number of months promo price is active (e.g. 6, 12)
  billingCycleDays?: number;       // 28 for prepaid mobile, 30/31 for monthly, 365 for annual
  dataGb?: number | "unlimited";   // Monthly data allowance
  networkHost?: "Telstra Direct" | "Telstra Wholesale" | "Optus" | "Vodafone"; // Mobile network
  url: string;                     // Affiliate or direct signup URL
  deal_channel?: "partner_exclusive" | "bank_perk" | "promo_code" | "direct";
  deal_channel_label?: string;      // Human label, e.g. "WhistleOut Special"
  direct_public_promo_price?: number; // Direct-store promo baseline when the listed route is cheaper
  how_to_get?: string;              // Plain-English steps needed to claim the listed price
  direct_url?: string;              // Provider storefront when url points to a partner/bank route
  cgnatOptOut?: "free" | "paid" | "unavailable";
  cgnatPrice?: number;             // Static IP monthly cost if paid (e.g. 5.00, 10.00)
  noticePeriodDays?: number;       // 0 for pro-rata, 30 for 30-day cancellation notice
  contractMonths?: number;         // 0 for no lock-in
  notes?: string;                  // Additional disclosures
  updatedAt: string;               // ISO 8601 timestamp
}
```

---

## 2. `changelog.json` Schema

URL: `https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/changelog.json`

Tracks price hikes, price drops, new plan launches, and discontinued plans across telcos:

```typescript
interface PlanChangeLogEntry {
  date: string;                    // "YYYY-MM-DD"
  provider: string;
  planName: string;
  changeType: "price_drop" | "price_hike" | "new_plan" | "promo_added" | "discontinued";
  oldPrice?: number;
  newPrice?: number;
  details: string;                 // Human-readable summary of change
}
```

---

## 3. `poi.json` Schema

URL: `https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/poi.json`

Contains Points of Interconnect (POI) coverage data and direct backhaul connection status across the 121 Australian NBN POIs.

```typescript
interface PoiData {
  providers: {
    [providerName: string]: {
      directPoiCount: number;      // e.g. 121 for full direct national backhaul
      backhaulNetwork?: string;    // e.g. "Telstra Wholesale", "Aussie Broadband Bv4"
      cgnatPolicy: string;
    }
  }
}
```
