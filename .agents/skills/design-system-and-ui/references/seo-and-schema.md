# SEO & Structured Data Reference

## 1. Required HTML Meta Tags

Every page across `jrsdigital-site` must include:

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Descriptive Title — JRS Digital</title>
<meta name="description" content="Accurate 150-160 character summary.">
<link rel="canonical" href="https://jrsdigital.net/path/">

<!-- Open Graph / Facebook / LinkedIn -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="JRS Digital">
<meta property="og:title" content="Descriptive Title">
<meta property="og:description" content="Accurate summary.">
<meta property="og:url" content="https://jrsdigital.net/path/">
<meta property="og:image" content="https://jrsdigital.net/assets/img/og-default.png">

<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Descriptive Title">
<meta name="twitter:description" content="Accurate summary.">
<meta name="twitter:image" content="https://jrsdigital.net/assets/img/og-default.png">
```

---

## 2. Structured Data Schemas (Schema.org)

### Organization Schema (Site-wide)
```json
{
  "@type": "Organization",
  "@id": "https://jrsdigital.net/#organization",
  "name": "JRS Digital",
  "url": "https://jrsdigital.net/",
  "logo": "https://jrsdigital.net/assets/img/logo.png"
}
```

### WebApplication Schema (`deals/index.html`)
```json
{
  "@type": "WebApplication",
  "@id": "https://jrsdigital.net/deals/#app",
  "name": "Australian NBN & Mobile Plan Deals Comparison",
  "url": "https://jrsdigital.net/deals/",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "All",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "AUD"
  }
}
```

### FAQPage Schema
Include structured questions and verified answers for key telco gotchas (CGNAT opt-out, 30-day notice, 28-day vs monthly pricing, Telstra Retail vs Wholesale).
