# Australian Telco Business Rules Reference

## 1. CGNAT (Carrier-Grade NAT) Policies

CGNAT shares public IPv4 addresses across multiple customers. This impacts home hosting, Plex, NAS access, port forwarding, VPN servers, and peer-to-peer gaming.

| Provider | CGNAT Policy | Static IP Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Aussie Broadband** | Free Opt-out | $0/mo (dynamic public IPv4) / $5/mo static | Opt-out available via app / support chat |
| **Leaptel** | Free Opt-out | $0/mo (dynamic public IPv4) / $10/mo static | Public dynamic IPv4 provided on request |
| **Superloop** | Free Opt-out | $0/mo (dynamic public IPv4) / $5/mo static | Available through portal toggle |
| **Tangerine** | Free Opt-out | $0/mo (dynamic) | Request via customer support |
| **Neptune Internet** | Free Opt-out | $0/mo | Native IPv6 + public dynamic IPv4 |
| **Dodo** | CGNAT Enforced | $5/mo static IP | No free opt-out |
| **Flip** | CGNAT Enforced | $5/mo static IP | No free opt-out |
| **SpinTel** | CGNAT Enforced | $5/mo static IP | No free opt-out |
| **Vodafone NBN** | CGNAT Enforced | $5/mo static IP | No free opt-out |
| **TPG / iiNet** | CGNAT Enforced | $10/mo static IP | Legacy TPG customers may still have dynamic IPv4 |

---

## 2. Cancellation Notice Periods & Gotchas

When a customer churns to a new provider:
- **No Notice / Pro-Rata**: Customer is billed only up to the exact transfer timestamp.
  - *Providers*: Aussie Broadband, Leaptel, Tangerine, Telstra, Optus.
- **30-Day Notice Required**: Customer must submit 30 calendar days of written notice prior to churn or pay for a remaining month of service even if the line is disconnected.
  - *Providers*: Superloop, Exetel, Swoop, Dodo, TPG, iiNet, SpinTel.

---

## 3. Mobile Billing Math & 28-Day Cycle Discrepancies

- **28-Day Cycles**:
  - $365 \div 28 = 13.035$ recharges per year (13 billing cycles).
  - Effective monthly cost $= \frac{\text{Recharge Price} \times 13}{12}$.
  - *Example*: A $30 advertised recharge is actually $\$32.50/\text{month}$ ($390/year).
- **365-Day Annual SIMs**:
  - Paid upfront once per year.
  - Effective monthly cost $= \frac{\text{Upfront Price}}{12}$.
  - *Example*: ALDImobile $95/year 30GB pack is $\$7.92/\text{month}$.

---

## 4. Mobile Network Coverage

- **Telstra Direct Retail** (99.6% Australian population coverage): Telstra, Boost Mobile.
- **Telstra Wholesale** (98.8% Australian population coverage): ALDImobile, Belong, Tangerine, Woolworths Mobile, More Telecom.
- **Optus Network** (98.5% population coverage): Optus, amaysim, Moose Mobile, Dodo, SpinTel, Catch Connect, Southern Phone.
- **Vodafone / TPG Network** (96% population coverage): Vodafone, Felix Mobile, TPG, iiNet, Kogan Mobile, Lebara.
