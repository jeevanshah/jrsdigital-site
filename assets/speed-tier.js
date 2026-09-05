/**
 * Dedicated Speed Tier Landing Page Controller (JRS Digital)
 * Powers /deals/nbn-50/, /deals/nbn-100/, and /deals/nbn-1000/
 * Reuses site-deals.css design tokens and calculation models.
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

  var LOGO_FILENAMES = {
    'Aussie Broadband': 'aussie-broadband.webp',
    'Superloop': 'superloop.webp',
    'Leaptel': 'leaptel.webp',
    'Tangerine': 'tangerine.webp',
    'More Telecom': 'more.webp',
    'Telstra': 'telstra.webp',
    'Optus': 'optus.webp',
    'TPG': 'tpg.webp',
    'iiNet': 'iinet.webp',
    'Dodo': 'dodo.webp',
    'SpinTel': 'spintel.webp',
    'Exetel': 'exetel.webp',
    'Swoop': 'swoop.webp',
    'Flip': 'flip.webp',
    'Vodafone': 'vodafone.webp',
    'Origin': 'origin.webp',
    'AGL': 'agl.webp',
    'Mate': 'mate.webp',
    'Belong': 'belong.webp',
    'Kogan Internet': 'kogan.webp',
    'Buddy Telco': 'buddy-telco.webp'
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

  var rootEl = document.querySelector('[data-speed-tier-page]');
  if (!rootEl) return;

  var targetTier = rootEl.getAttribute('data-speed-tier-page') || 'NBN 50';
  var grid = document.querySelector('[data-grid]');
  var sortSelect = document.querySelector('[data-sort-select]');
  var providerFilter = document.querySelector('[data-provider-filter]');
  var mineInput = document.querySelector('[data-mine-input]');
  var planCountEl = document.querySelector('[data-plan-count]');
  var minPriceEl = document.querySelector('[data-min-price]');

  var allDeals = [];
  var tierDeals = [];
  var activeSort = 'totalfirstyear';
  var selectedProvider = '';
  var userCurrentBill = parseFloat(localStorage.getItem('jrs_user_cost')) || 0;

  if (mineInput && userCurrentBill > 0) {
    mineInput.value = userCurrentBill.toFixed(0);
  }

  function getLogoHtml(provider) {
    var filename = LOGO_FILENAMES[provider];
    if (filename) {
      return '<img class="deal-provider-logo" src="/assets/img/logos/' + filename + '" alt="' + escAttr(provider) + ' logo" loading="lazy" width="28" height="28" onerror="this.style.display=\'none\'">';
    }
    var initials = provider.split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    return '<span class="deal-provider-initials" aria-hidden="true">' + esc(initials) + '</span>';
  }

  function sortDeals(list) {
    var sorted = list.slice();
    if (activeSort === 'totalfirstyear') {
      sorted.sort(function (a, b) { return totalFirstYear(a) - totalFirstYear(b); });
    } else if (activeSort === 'promoprice') {
      sorted.sort(function (a, b) { return (parsePrice(a.promoPrice) || parsePrice(a.regularPrice)) - (parsePrice(b.promoPrice) || parsePrice(b.regularPrice)); });
    } else if (activeSort === 'regularprice') {
      sorted.sort(function (a, b) { return (parsePrice(a.regularPrice) || parsePrice(a.promoPrice)) - (parsePrice(b.regularPrice) || parsePrice(b.promoPrice)); });
    }
    return sorted;
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
      var minPromo = Math.min.apply(null, sorted.map(function (d) { return parsePrice(d.promoPrice) || parsePrice(d.regularPrice); }));
      minPriceEl.textContent = '$' + minPromo.toFixed(0);
    }

    if (sorted.length === 0) {
      grid.innerHTML = '<div class="deals-empty"><p class="deals-empty-title">No plans found</p><p class="deals-empty-sub">Try changing your provider filter.</p></div>';
      return;
    }

    var html = '';
    sorted.forEach(function (d, idx) {
      var promo = parsePrice(d.promoPrice);
      var regular = parsePrice(d.regularPrice);
      var months = parseInt(d.promoMonths, 10) || 0;
      var hasPromo = promo > 0 && months > 0 && promo !== regular;
      var firstYear = totalFirstYear(d);
      var savings = savingsFirstYear(d);
      var meta = PROVIDER_METADATA[d.provider] || {};

      var deltaHtml = '';
      if (userCurrentBill > 0) {
        var userAnnual = userCurrentBill * 12;
        var diff = userAnnual - firstYear;
        if (diff > 5) {
          deltaHtml = '<span class="deal-delta deal-delta--cheaper">Save $' + diff.toFixed(0) + '/yr vs current</span>';
        } else if (diff < -5) {
          deltaHtml = '<span class="deal-delta deal-delta--pricier">+$' + Math.abs(diff).toFixed(0) + '/yr</span>';
        }
      }

      var speedDisplay = d.typicalEveningSpeed ? d.typicalEveningSpeed + ' Mbps evening' : d.tier;

      var badgesHtml = '';
      if (meta.cgnat === 'opt_out_free') {
        badgesHtml += '<span class="deal-badge deal-badge--info" title="Dynamic public IPv4 available on request">Free CGNAT opt-out</span>';
      }
      if (meta.notice === '30_days') {
        badgesHtml += '<span class="deal-badge deal-badge--warn" title="Requires 30 days notice to cancel">30-day notice</span>';
      }

      html +=
        '<article class="deal-entry' + (idx < 3 ? ' is-top-deal' : '') + '">' +
          '<div class="deal-row">' +
            '<div class="deal-group deal-group-provider">' +
              '<div class="deal-cell deal-cell-provider">' +
                getLogoHtml(d.provider) +
                '<div class="deal-provider-details">' +
                  '<span class="deal-provider-name">' + esc(d.provider) + '</span>' +
                  '<span class="deal-plan-tier">' + esc(d.title || d.tier) + '</span>' +
                  '<span class="deal-speed-badge">' + esc(speedDisplay) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="deal-group deal-group-price">' +
              '<div class="deal-cell deal-cell-promo">' +
                '<span class="deal-price-amount">$' + (hasPromo ? promo.toFixed(2) : regular.toFixed(2)) + '</span>' +
                '<span class="deal-price-cycle">/mo</span>' +
                (hasPromo
                  ? '<span class="deal-promo-duration">for ' + months + ' mos</span>'
                  : '<span class="deal-promo-duration">ongoing</span>') +
              '</div>' +
              '<div class="deal-cell deal-cell-regular">' +
                (hasPromo ? '<span class="deal-reverts-amount">Then $' + regular.toFixed(2) + '/mo</span>' : '<span class="deal-reverts-amount">No lock-in</span>') +
                '<span class="deal-total-first-year">1st yr: $' + firstYear.toFixed(2) + '</span>' +
                deltaHtml +
              '</div>' +
            '</div>' +
            '<div class="deal-group deal-group-offer">' +
              '<div class="deal-offer-summary">' +
                (hasPromo ? '<span class="deal-savings-tag">Save $' + savings.toFixed(0) + ' in promo</span>' : '<span class="deal-savings-tag deal-savings-tag--neutral">Standard Rate</span>') +
                '<div class="deal-badges-wrap">' + badgesHtml + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="deal-group deal-group-action">' +
              '<div class="deal-cell deal-cell-action">' +
                '<a class="deal-link" href="' + esc(d.url) + '" target="_blank" rel="nofollow noopener" ' +
                  'data-outbound="deal" data-provider="' + escAttr(d.provider) + '" data-plan="' + escAttr(d.title) + '" data-tier="' + escAttr(targetTier) + '">' +
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
        } else {
          localStorage.removeItem('jrs_user_cost');
        }
        renderList();
      });
    }
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
      })
      .catch(function (err) {
        console.warn('Could not load live deals catalog:', err);
      });
  }

  loadDeals();
})();
