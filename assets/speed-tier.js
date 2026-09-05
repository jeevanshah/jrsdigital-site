/**
 * Dedicated Speed Tier Landing Page Controller (JRS Digital)
 * Powers /deals/nbn-50/, /deals/nbn-100/, and /deals/nbn-1000/
 * Reuses site-deals.css design tokens, classes, and calculation models.
 */
(function () {
  'use strict';

  var DATA_URL = 'https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/deals.json';
  var FALLBACK_URL = '/data/deals.json';

  var PROVIDER_METADATA = {
    'Aussie Broadband': { cgnat: 'opt_out_free', notice: 'none', cisUrl: 'https://www.aussiebroadband.com.au/legal/' },
    'Superloop': { cgnat: 'opt_out_free', notice: '30_days', cisUrl: 'https://www.superloop.com/terms' },
    'Leaptel': { cgnat: 'opt_out_free', notice: 'none', cisUrl: 'https://www.leaptel.com.au/terms' },
    'Tangerine': { cgnat: 'opt_out_free', notice: 'none', cisUrl: 'https://www.tangerinetelecom.com.au/terms' },
    'More Telecom': { cgnat: 'opt_out_free', notice: 'none', cisUrl: 'https://www.more.com.au/policies' },
    'Neptune Internet': { cgnat: 'opt_out_free', notice: 'none', cisUrl: 'https://neptuneinternet.com.au/legal' },
    'Telstra': { cgnat: 'paid_only', notice: 'none', cisUrl: 'https://www.telstra.com.au/customer-terms' },
    'Optus': { cgnat: 'paid_only', notice: '30_days', cisUrl: 'https://www.optus.com.au/about/legal' },
    'TPG': { cgnat: 'paid_only', notice: '30_days', cisUrl: 'https://www.tpg.com.au/terms-and-conditions' },
    'iiNet': { cgnat: 'paid_only', notice: '30_days', cisUrl: 'https://www.iinet.net.au/about/legal' },
    'Dodo': { cgnat: 'paid_only', notice: '30_days', cisUrl: 'https://www.dodo.com/legal' },
    'SpinTel': { cgnat: 'paid_only', notice: '30_days', cisUrl: 'https://www.spintel.net.au/legal' },
    'Exetel': { cgnat: 'paid_only', notice: '30_days', cisUrl: 'https://www.exetel.com.au/terms' },
    'Swoop': { cgnat: 'opt_out_free', notice: '30_days', cisUrl: 'https://www.swoop.com.au/legal' },
    'Flip': { cgnat: 'paid_only', notice: 'none', cisUrl: 'https://www.flipconnect.com.au/critical-information-summary' }
  };

  function baseBucketKey(rawTier) {
    if (!rawTier) return 'Other';
    var s = String(rawTier);
    var firstNum = s.match(/(\d+)/);
    if (!firstNum) return s;
    var speed = parseInt(firstNum[1], 10);
    if (speed <= 12) return 'NBN 12';
    if (speed <= 30) return 'NBN 25';
    if (speed <= 60) return 'NBN 50';
    if (speed <= 150) return 'NBN 100';
    if (speed <= 350) return 'NBN 250';
    if (speed <= 600) return 'NBN 500';
    if (speed <= 800) return 'NBN 750';
    if (speed <= 1200) return 'NBN 1000';
    return 'NBN 2000';
  }

  function parsePrice(val) {
    if (val === null || val === undefined || val === '') return 0;
    var n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }

  function totalFirstYear(d) {
    var promo = parsePrice(d.promoPrice);
    var regular = parsePrice(d.regularPrice);
    var months = parseInt(d.promoMonths, 10) || 0;
    if (promo > 0 && months > 0 && promo !== regular) {
      var promoCount = Math.min(months, 12);
      var regularCount = 12 - promoCount;
      return (promo * promoCount) + (regular * regularCount);
    }
    return (regular || promo) * 12;
  }

  function totalSixMonth(d) {
    var promo = parsePrice(d.promoPrice);
    var regular = parsePrice(d.regularPrice);
    var months = parseInt(d.promoMonths, 10) || 0;
    if (promo > 0 && months > 0 && promo !== regular) {
      var promoCount = Math.min(months, 6);
      var regularCount = 6 - promoCount;
      return (promo * promoCount) + (regular * regularCount);
    }
    return (regular || promo) * 6;
  }

  function savingsFirstYear(d) {
    var regular = parsePrice(d.regularPrice || d.promoPrice);
    return (regular * 12) - totalFirstYear(d);
  }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  function providerLogoUrl(deal) {
    var raw = deal.url || '';
    try {
      var host = new URL(raw).hostname;
      return 'https://www.google.com/s2/favicons?sz=64&domain=' + host;
    } catch (e) {
      return '';
    }
  }

  var rootEl = document.querySelector('[data-speed-tier-page]');
  if (!rootEl) return;

  var targetTier = rootEl.getAttribute('data-speed-tier-page') || 'NBN 50';
  var grid = document.querySelector('[data-grid]');
  var sortSelect = document.querySelector('[data-sort-select]');
  var providerFilter = document.querySelector('[data-provider-filter]');
  var mineInput = document.querySelector('[data-mine-input]');
  var mineClear = document.querySelector('[data-mine-clear]');
  var planCountEl = document.querySelector('[data-plan-count]');
  var minPriceEl = document.querySelector('[data-min-price]');

  var allDeals = [];
  var tierDeals = [];
  var activeSort = 'totalfirstyear';
  var selectedProvider = '';
  var userCurrentBill = parseFloat(localStorage.getItem('jrs_user_cost')) || 0;

  if (mineInput && userCurrentBill > 0) {
    mineInput.value = userCurrentBill.toFixed(0);
    if (mineClear) mineClear.hidden = false;
  }

  function topPickLabel() {
    if (activeSort === 'promoprice') return 'Lowest intro price';
    if (activeSort === 'regularprice') return 'Lowest ongoing price';
    return 'Lowest 1st-year cost';
  }

  function sortDeals(list) {
    var sorted = list.slice();
    if (activeSort === 'totalfirstyear') {
      sorted.sort(function (a, b) { return totalFirstYear(a) - totalFirstYear(b); });
    } else if (activeSort === 'promoprice') {
      sorted.sort(function (a, b) {
        return (parsePrice(a.promoPrice) || parsePrice(a.regularPrice)) -
               (parsePrice(b.promoPrice) || parsePrice(b.regularPrice));
      });
    } else if (activeSort === 'regularprice') {
      sorted.sort(function (a, b) {
        return (parsePrice(a.regularPrice) || parsePrice(a.promoPrice)) -
               (parsePrice(b.regularPrice) || parsePrice(b.promoPrice));
      });
    }
    return sorted;
  }

  function vsMineHtml(regularPrice) {
    if (!userCurrentBill || userCurrentBill <= 0) return '';
    var diff = regularPrice - userCurrentBill;
    if (Math.abs(diff) < 0.01) {
      return '<span class="deal-cell-vsmine deal-cell-vsmine--neutral">Same as yours</span>';
    }
    if (diff < 0) {
      return '<span class="deal-cell-vsmine deal-cell-vsmine--good">-$' + Math.abs(diff).toFixed(2) + '/mo vs yours</span>';
    }
    return '<span class="deal-cell-vsmine deal-cell-vsmine--warn">+$' + diff.toFixed(2) + '/mo vs yours</span>';
  }

  function renderList() {
    if (!grid) return;

    var filtered = tierDeals;
    if (selectedProvider) {
      filtered = filtered.filter(function (d) { return d.provider === selectedProvider; });
    }

    var sorted = sortDeals(filtered);

    if (planCountEl) planCountEl.textContent = sorted.length;
    if (minPriceEl && sorted.length > 0) {
      var minPromo = Math.min.apply(null, sorted.map(function (d) {
        return parsePrice(d.promoPrice) || parsePrice(d.regularPrice);
      }));
      minPriceEl.textContent = '$' + minPromo.toFixed(0);
    }

    if (sorted.length === 0) {
      grid.innerHTML = '<div class="deals-empty"><p class="deals-empty-title" style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">No plans found</p><p class="deals-empty-sub" style="color:var(--w-ink-70);">Try resetting your provider filter.</p></div>';
      return;
    }

    var html = '';
    sorted.forEach(function (d, idx) {
      var promo = parsePrice(d.promoPrice);
      var regular = parsePrice(d.regularPrice);
      var months = parseInt(d.promoMonths, 10) || 0;
      var hasPromo = promo > 0 && months > 0 && promo !== regular;
      var firstYear = totalFirstYear(d);
      var sixMonth = totalSixMonth(d);
      var savings = savingsFirstYear(d);
      var meta = PROVIDER_METADATA[d.provider] || {};

      var deltaAnnualHtml = '';
      if (userCurrentBill > 0) {
        var userAnnual = userCurrentBill * 12;
        var diffAnnual = userAnnual - firstYear;
        if (diffAnnual > 5) {
          deltaAnnualHtml = '<span class="deal-essential-saving" style="background:rgba(52,139,39,0.12);color:var(--jrs-green);font-weight:700;display:inline-flex;padding:3px 8px;border-radius:6px;font-size:0.7rem;margin-top:4px;">Save $' + diffAnnual.toFixed(0) + '/yr vs current</span>';
        } else if (diffAnnual < -5) {
          deltaAnnualHtml = '<span class="deal-cell-subnote" style="color:#92400E;display:block;margin-top:2px;">+$' + Math.abs(diffAnnual).toFixed(0) + '/yr vs current</span>';
        }
      }

      var speedVal = d.typicalEveningSpeed ? ('~' + d.typicalEveningSpeed + ' Mbps') : d.tier;
      var speedCaption = 'Typical evening';

      var badgesHtml = '';
      if (meta.cgnat === 'opt_out_free') {
        badgesHtml += '<button type="button" class="deal-badge deal-badge--good" title="Free dynamic public IPv4 available on request">Free CGNAT opt-out</button>';
      }

      var offerFacts = [];
      if (meta.notice === '30_days') {
        offerFacts.push('<button type="button" class="deal-offer-fact-text deal-offer-fact-text--warn" title="Provider requires 30 days written notice to cancel">30-day notice</button>');
      }
      if (hasPromo) {
        offerFacts.push('<span class="deal-offer-fact-text">Save $' + savings.toFixed(0) + ' intro</span>');
      }

      var contractMonths = parseInt(d.contractMonths, 10) || 0;
      var isNoLockIn = contractMonths === 0;

      html +=
        '<article class="deal-entry' + (idx === 0 ? ' deal-entry--top' : '') + '">' +
          (idx === 0 ? '<div class="deal-top-badge">' + esc(topPickLabel()) + '</div>' : '') +
          '<div class="deal-row">' +
            '<div class="deal-group deal-group-plan">' +
              '<div class="deal-cell deal-cell-provider">' +
                '<div class="deal-provider-head">' +
                  '<img class="deal-provider-logo" src="' + escAttr(providerLogoUrl(d)) + '" alt="" width="20" height="20" loading="lazy" onerror="this.remove()">' +
                  '<span class="deal-provider-name">' + esc(d.provider) + '</span>' +
                '</div>' +
                '<span class="deal-plan-tier">' + esc(d.title || d.tier) + '</span>' +
                (badgesHtml ? '<div class="deal-provider-badges">' + badgesHtml + '</div>' : '') +
              '</div>' +
              '<div class="deal-cell deal-cell-speed" data-label="Speed &amp; Tech">' +
                '<span class="deal-cell-body">' +
                  '<span class="deal-cell-value">' + esc(speedVal) + '</span>' +
                  '<span class="deal-cell-caption">' + esc(speedCaption) + '</span>' +
                '</span>' +
              '</div>' +
            '</div>' +
            '<div class="deal-group deal-group-cost">' +
              '<div class="deal-cost-primary">' +
                '<div class="deal-cell deal-cell-promo" data-label="Intro">' +
                  '<span class="deal-cell-body">' +
                    '<span class="deal-price-orange">$' + (hasPromo ? promo.toFixed(2) : regular.toFixed(2)) + '<small>/mo</small></span>' +
                    '<span class="deal-cell-caption">' + (hasPromo ? 'for ' + months + ' mos' : 'ongoing rate') + '</span>' +
                  '</span>' +
                '</div>' +
                '<div class="deal-cell deal-cell-after" data-label="Ongoing">' +
                  '<span class="deal-cell-body">' +
                    '<span class="deal-price-navy">$' + regular.toFixed(2) + '<small>/mo</small></span>' +
                    '<span class="deal-cell-caption">ongoing</span>' +
                    vsMineHtml(regular) +
                  '</span>' +
                '</div>' +
              '</div>' +
              '<div class="deal-cost-totals">' +
                '<div class="deal-cell deal-cell-sixmonth" data-label="6-mo total">' +
                  '<span class="deal-cell-body">' +
                    '<span class="deal-price-navy">$' + sixMonth.toFixed(2) + '</span>' +
                    '<span class="deal-cell-caption">6 months</span>' +
                  '</span>' +
                '</div>' +
                '<div class="deal-cell deal-cell-total" data-label="1-year total">' +
                  '<span class="deal-cell-body">' +
                    '<span class="deal-price-total">$' + firstYear.toFixed(2) + '</span>' +
                    '<span class="deal-cell-caption">first year</span>' +
                    (savings > 0 ? '<span class="deal-essential-saving">Save $' + savings.toFixed(0) + ' promo</span>' : '') +
                    deltaAnnualHtml +
                  '</span>' +
                '</div>' +
                '<div class="deal-cell deal-cell-savings" data-label="Savings">' +
                  '<span class="deal-cell-body">' +
                    (savings > 0
                      ? '<span class="deal-savings-amt">$' + savings.toFixed(2) + '</span><span class="deal-savings-pct">Save ' + Math.round((savings / (regular * 12)) * 100) + '%</span>'
                      : '<span class="deal-cell-caption">—</span>') +
                  '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="deal-group deal-group-offer">' +
              '<div class="deal-offer-summary" data-label="Offer">' +
                (offerFacts.length ? '<div class="deal-offer-facts">' + offerFacts.join('<span class="deal-offer-facts-sep" aria-hidden="true"> &middot; </span>') + '</div>' : '') +
                (isNoLockIn ? '<span class="deal-offer-fact-text deal-offer-fact-text--contract">No lock-in</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="deal-group deal-group-action">' +
              '<div class="deal-cell deal-cell-action">' +
                '<a class="deal-link" href="' + esc(d.url) + '" target="_blank" rel="nofollow noopener" ' +
                  'data-outbound="deal" data-provider="' + escAttr(d.provider) + '" data-plan="' + escAttr(d.title || d.tier) + '" data-tier="' + escAttr(targetTier) + '">' +
                  'View plan' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>' +
                '</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</article>';
    });

    grid.innerHTML = html;
  }

  function initFilters() {
    var providers = [];
    tierDeals.forEach(function (d) {
      if (d.provider && providers.indexOf(d.provider) === -1) {
        providers.push(d.provider);
      }
    });
    providers.sort();

    if (providerFilter) {
      var optHtml = '<option value="">All Providers (' + providers.length + ')</option>';
      providers.forEach(function (p) {
        optHtml += '<option value="' + escAttr(p) + '">' + esc(p) + '</option>';
      });
      providerFilter.innerHTML = optHtml;

      providerFilter.addEventListener('change', function () {
        selectedProvider = providerFilter.value;
        renderList();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        activeSort = sortSelect.value;
        renderList();
      });
    }

    if (mineInput) {
      mineInput.addEventListener('input', function () {
        var val = parseFloat(mineInput.value);
        userCurrentBill = !isNaN(val) && val > 0 ? val : 0;
        if (userCurrentBill > 0) {
          localStorage.setItem('jrs_user_cost', String(userCurrentBill));
          if (mineClear) mineClear.hidden = false;
        } else {
          localStorage.removeItem('jrs_user_cost');
          if (mineClear) mineClear.hidden = true;
        }
        renderList();
      });
    }

    if (mineClear) {
      mineClear.addEventListener('click', function () {
        if (mineInput) mineInput.value = '';
        userCurrentBill = 0;
        localStorage.removeItem('jrs_user_cost');
        mineClear.hidden = true;
        renderList();
      });
    }

    // Delegated click for outbound tracking
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[data-outbound="deal"]');
      if (!link) return;
      if (typeof gtag === 'function') {
        gtag('event', 'outbound_deal_click', {
          event_category: 'Outbound Deal',
          event_label: link.getAttribute('data-provider') + ' - ' + link.getAttribute('data-plan'),
          provider: link.getAttribute('data-provider'),
          plan_name: link.getAttribute('data-plan'),
          tier: link.getAttribute('data-tier')
        });
      }
    });
  }

  function loadDeals() {
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        return res.json();
      })
      .catch(function () {
        return fetch(FALLBACK_URL).then(function (res) { return res.json(); });
      })
      .then(function (data) {
        if (!Array.isArray(data)) return;
        allDeals = data;
        tierDeals = data.filter(function (d) {
          return d.serviceType === 'nbn' && baseBucketKey(d.tier) === targetTier;
        });
        initFilters();
        renderList();
        window.__SPEED_TIER_RENDERED__ = true;
      })
      .catch(function (err) {
        console.warn('Could not load live deals catalog:', err);
      });
  }

  loadDeals();
})();
