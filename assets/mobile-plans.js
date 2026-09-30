/**
 * Dedicated Mobile Plans Comparison Page Controller (JRS Digital)
 * Powers /deals/mobile-plans/
 * Reuses site-deals.css design tokens, classes, and calculation models.
 */
(function () {
  'use strict';

  var DATA_URL = 'https://raw.githubusercontent.com/jeevanshah/au-plans-scraper/main/data/deals.json';
  var FALLBACK_URL = '/data/deals.json';

  var NETWORK_METADATA = {
    'ALDImobile': { network: 'Telstra Wholesale', popCoverage: '98.8%', code: 'telstra_wholesale', logoHost: 'www.aldimobile.com.au' },
    'Boost Mobile': { network: 'Telstra Retail', popCoverage: '99.6%', code: 'telstra_retail', logoHost: 'boost.com.au' },
    'Telstra': { network: 'Telstra Retail', popCoverage: '99.6%', code: 'telstra_retail', logoHost: 'www.telstra.com.au' },
    'Mate': { network: 'Telstra Wholesale', popCoverage: '98.8%', code: 'telstra_wholesale', logoHost: 'www.letsbemates.com.au' },
    'amaysim': { network: 'Optus Network', popCoverage: '98.5%', code: 'optus', logoHost: 'www.amaysim.com.au' },
    'Moose Mobile': { network: 'Optus Network', popCoverage: '98.5%', code: 'optus', logoHost: 'moosemobile.com.au' },
    'Dodo': { network: 'Optus Network', popCoverage: '98.5%', code: 'optus', logoHost: 'www.dodo.com' },
    'Aussie Broadband': { network: 'Optus Network', popCoverage: '98.5%', code: 'optus', logoHost: 'www.aussiebroadband.com.au' },
    'TPG': { network: 'Vodafone Network', popCoverage: '96.0%', code: 'vodafone', logoHost: 'www.tpg.com.au' },
    'Felix': { network: 'Vodafone Network', popCoverage: '96.0%', code: 'vodafone', logoHost: 'www.felixmobile.com.au' },
    'Kogan Mobile': { network: 'Vodafone Network', popCoverage: '96.0%', code: 'vodafone', logoHost: 'www.koganmobile.com.au' },
    'Vodafone': { network: 'Vodafone Network', popCoverage: '96.0%', code: 'vodafone', logoHost: 'www.vodafone.com.au' }
  };

  function parsePrice(val) {
    if (val === null || val === undefined || val === '') return 0;
    var n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }

  function getDataGB(d) {
    var t = (d.tier || d.title || '').toString();
    if (/unlimited/i.test(t)) return 999999;
    var m = t.match(/(\d+)\s*GB/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function calcCosts(d) {
    var promo = parsePrice(d.promoPrice);
    var regular = parsePrice(d.regularPrice);
    var promoMonths = parseInt(d.promoMonths, 10) || 0;
    var days = parseInt(d.billingCycleDays, 10) || 30;

    var hasPromo = promo > 0 && promoMonths > 0 && promo !== regular;
    var effectiveReg = regular > 0 ? regular : promo;

    var annualCost = 0;
    var sixMonthCost = 0;
    var regularAnnualCost = 0;
    var cycleLabel = 'month';

    if (days >= 360 && days <= 370) {
      // Annual 365-day pack: 1 upfront recharge
      cycleLabel = 'year';
      annualCost = promo > 0 ? promo : regular;
      regularAnnualCost = effectiveReg;
      sixMonthCost = annualCost / 2;
    } else if (days >= 170 && days <= 190) {
      // Semi-annual: 2 recharges per year
      cycleLabel = '6 months';
      annualCost = (promo > 0 ? promo : regular) * 2;
      regularAnnualCost = effectiveReg * 2;
      sixMonthCost = promo > 0 ? promo : regular;
    } else if (days === 28) {
      // 28-day cycle: 13 recharges per calendar year
      cycleLabel = '28 days';
      var promoCycles = Math.min(promoMonths, 13);
      var regCycles = 13 - promoCycles;
      annualCost = hasPromo ? (promo * promoCycles) + (effectiveReg * regCycles) : effectiveReg * 13;
      regularAnnualCost = effectiveReg * 13;
      var promo6 = Math.min(promoMonths, 6.5);
      var reg6 = 6.5 - promo6;
      sixMonthCost = hasPromo ? (promo * promo6) + (effectiveReg * reg6) : effectiveReg * 6.5;
    } else if (days === 7) {
      // 7-day cycle: 52 recharges per year
      cycleLabel = '7 days';
      annualCost = effectiveReg * 52;
      regularAnnualCost = effectiveReg * 52;
      sixMonthCost = annualCost / 2;
    } else {
      // Standard monthly (~30 days): 12 recharges per year
      cycleLabel = 'month';
      var pMonths = Math.min(promoMonths, 12);
      var rMonths = 12 - pMonths;
      annualCost = hasPromo ? (promo * pMonths) + (effectiveReg * rMonths) : effectiveReg * 12;
      regularAnnualCost = effectiveReg * 12;
      var p6 = Math.min(promoMonths, 6);
      var r6 = 6 - p6;
      sixMonthCost = hasPromo ? (promo * p6) + (effectiveReg * r6) : effectiveReg * 6;
    }

    var monthlyEquiv = annualCost / 12;
    var regularMonthlyEquiv = regularAnnualCost / 12;
    var annualSavings = Math.max(0, regularAnnualCost - annualCost);

    return {
      promo: promo,
      regular: effectiveReg,
      hasPromo: hasPromo,
      promoMonths: promoMonths,
      days: days,
      cycleLabel: cycleLabel,
      annualCost: annualCost,
      sixMonthCost: sixMonthCost,
      monthlyEquiv: monthlyEquiv,
      regularMonthlyEquiv: regularMonthlyEquiv,
      annualSavings: annualSavings
    };
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
    var meta = NETWORK_METADATA[deal.provider] || {};
    var host = meta.logoHost;
    if (!host && deal.url) {
      try { host = new URL(deal.url).hostname; } catch (e) {}
    }
    return host ? 'https://www.google.com/s2/favicons?sz=64&domain=' + host : '';
  }

  var rootEl = document.querySelector('[data-mobile-page]');
  if (!rootEl) return;

  var grid = document.querySelector('[data-grid]');
  var networkFilter = document.querySelector('[data-network-filter]');
  var expiryFilter = document.querySelector('[data-expiry-filter]');
  var dataFilter = document.querySelector('[data-data-filter]');
  var providerFilter = document.querySelector('[data-provider-filter]');
  var sortSelect = document.querySelector('[data-sort-select]');
  var mineInput = document.querySelector('[data-mine-input]');
  var mineClear = document.querySelector('[data-mine-clear]');
  var planCountEl = document.querySelector('[data-plan-count]');
  var minPriceEl = document.querySelector('[data-min-price]');

  var allMobileDeals = [];
  var activeSort = 'totalfirstyear';
  var selectedNetwork = '';
  var selectedExpiry = '';
  var selectedData = '';
  var selectedProvider = '';
  var userCurrentBill = parseFloat(localStorage.getItem('jrs_user_cost')) || 0;

  function readUrlParams() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.has('network')) selectedNetwork = params.get('network');
      if (params.has('expiry')) selectedExpiry = params.get('expiry');
      if (params.has('data')) selectedData = params.get('data');
      if (params.has('provider')) selectedProvider = params.get('provider');
      if (params.has('sort')) activeSort = params.get('sort');
    } catch (e) {}
  }

  function updateUrlParams() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (selectedNetwork) params.set('network', selectedNetwork); else params.delete('network');
      if (selectedExpiry) params.set('expiry', selectedExpiry); else params.delete('expiry');
      if (selectedData) params.set('data', selectedData); else params.delete('data');
      if (selectedProvider) params.set('provider', selectedProvider); else params.delete('provider');
      if (activeSort && activeSort !== 'totalfirstyear') params.set('sort', activeSort); else params.delete('sort');
      var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', newUrl);
    } catch (e) {}
  }

  readUrlParams();

  if (mineInput && userCurrentBill > 0) {
    mineInput.value = userCurrentBill.toFixed(0);
    if (mineClear) mineClear.hidden = false;
  }

  function topPickLabel() {
    if (activeSort === 'monthlyrate') return 'Lowest monthly rate';
    if (activeSort === 'mostdata') return 'Maximum data allowance';
    return 'Lowest 1st-year cost';
  }

  function sortDeals(list) {
    var sorted = list.slice();
    if (activeSort === 'totalfirstyear') {
      sorted.sort(function (a, b) {
        return a._costs.annualCost - b._costs.annualCost;
      });
    } else if (activeSort === 'monthlyrate') {
      sorted.sort(function (a, b) {
        return a._costs.monthlyEquiv - b._costs.monthlyEquiv;
      });
    } else if (activeSort === 'mostdata') {
      sorted.sort(function (a, b) {
        return getDataGB(b) - getDataGB(a) || a._costs.annualCost - b._costs.annualCost;
      });
    }
    return sorted;
  }

  function vsMineHtml(monthlyEquiv) {
    if (!userCurrentBill || userCurrentBill <= 0) return '';
    var diff = monthlyEquiv - userCurrentBill;
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

    var filtered = allMobileDeals;

    if (selectedNetwork) {
      filtered = filtered.filter(function (d) {
        var meta = NETWORK_METADATA[d.provider] || {};
        if (selectedNetwork === 'telstra_retail') return meta.code === 'telstra_retail';
        if (selectedNetwork === 'telstra_wholesale') return meta.code === 'telstra_wholesale';
        if (selectedNetwork === 'optus') return meta.code === 'optus';
        if (selectedNetwork === 'vodafone') return meta.code === 'vodafone';
        return true;
      });
    }

    if (selectedExpiry) {
      filtered = filtered.filter(function (d) {
        var days = parseInt(d.billingCycleDays, 10) || 30;
        if (selectedExpiry === 'monthly') return days >= 28 && days <= 31;
        if (selectedExpiry === 'annual') return days >= 360 && days <= 370;
        if (selectedExpiry === 'short') return days <= 14;
        if (selectedExpiry === 'sixmonth') return days >= 170 && days <= 190;
        return true;
      });
    }

    if (selectedData) {
      filtered = filtered.filter(function (d) {
        var gb = getDataGB(d);
        if (selectedData === 'light') return gb < 30;
        if (selectedData === 'medium') return gb >= 30 && gb < 100;
        if (selectedData === 'heavy') return gb >= 100;
        return true;
      });
    }

    if (selectedProvider) {
      filtered = filtered.filter(function (d) {
        return d.provider === selectedProvider;
      });
    }

    var sorted = sortDeals(filtered);

    if (planCountEl) planCountEl.textContent = sorted.length;
    if (minPriceEl && sorted.length > 0) {
      var minMo = Math.min.apply(null, sorted.map(function (d) { return d._costs.monthlyEquiv; }));
      minPriceEl.textContent = '$' + minMo.toFixed(0);
    }

    if (sorted.length === 0) {
      grid.innerHTML = '<div class="deals-empty"><p class="deals-empty-title" style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">No mobile plans found</p><p class="deals-empty-sub" style="color:var(--w-ink-70);">Try resetting your filters.</p></div>';
      return;
    }

    var html = '';
    sorted.forEach(function (d, idx) {
      var c = d._costs;
      var meta = NETWORK_METADATA[d.provider] || { network: 'Mobile Network', popCoverage: '4G/5G', code: 'other' };

      var deltaAnnualHtml = '';
      if (userCurrentBill && userCurrentBill > 0) {
        var userAnnual = userCurrentBill * 12;
        var diffAnnual = userAnnual - c.annualCost;
        if (diffAnnual > 5) {
          deltaAnnualHtml = '<span class="deal-cell-subnote" style="color:#059669;font-weight:600;display:block;margin-top:2px;">Save $' + diffAnnual.toFixed(0) + '/yr vs current</span>';
        } else if (diffAnnual < -5) {
          deltaAnnualHtml = '<span class="deal-cell-subnote" style="color:#92400E;display:block;margin-top:2px;">+$' + Math.abs(diffAnnual).toFixed(0) + '/yr vs current</span>';
        }
      }

      var dataVal = d.tier || (getDataGB(d) ? getDataGB(d) + 'GB' : 'SIM Plan');
      var techLabel = (d.techType || '4G/5G') + ' &bull; ' + meta.network;

      var badgesHtml = '';
      if (meta.code === 'telstra_retail') {
        badgesHtml += '<button type="button" class="deal-badge deal-badge--good" title="Full Telstra Retail Network: 99.6% Australian population coverage">Telstra Retail (99.6%)</button>';
      } else if (meta.code === 'telstra_wholesale') {
        badgesHtml += '<button type="button" class="deal-badge deal-badge--neutral" title="Telstra Wholesale Network: 98.8% Australian population coverage">Telstra Wholesale (98.8%)</button>';
      } else if (meta.code === 'optus') {
        badgesHtml += '<button type="button" class="deal-badge deal-badge--neutral" title="Optus Mobile Network: 98.5% Australian population coverage">Optus Net (98.5%)</button>';
      } else if (meta.code === 'vodafone') {
        badgesHtml += '<button type="button" class="deal-badge deal-badge--neutral" title="Vodafone Mobile Network: 96% Australian population coverage">Vodafone Net (96%)</button>';
      }

      var offerFacts = [];
      if (c.days === 28) {
        offerFacts.push('<button type="button" class="deal-offer-fact-text deal-offer-fact-text--warn" title="28-day recharge cycle renews 13 times per year">28-day cycle (13x/yr)</button>');
      } else if (c.days >= 360) {
        offerFacts.push('<span class="deal-offer-fact-text" style="color:#059669;font-weight:600;">365-day upfront pack</span>');
      }

      if (c.hasPromo && c.annualSavings > 0) {
        offerFacts.push('<span class="deal-offer-fact-text">Save $' + c.annualSavings.toFixed(0) + ' intro</span>');
      }

      var isNoLockIn = true; // All Australian SIM-only plans tracked are no lock-in contracts

      var promoDisplayPrice = c.hasPromo ? c.promo : c.regular;
      var promoCaption = '';
      if (c.days >= 360) {
        promoCaption = 'for 365 days';
      } else if (c.hasPromo) {
        promoCaption = 'for ' + c.promoMonths + ' mos';
      } else {
        promoCaption = 'per ' + c.cycleLabel;
      }

      var ongoingDisplayPrice = c.regular;
      var ongoingCaption = '';
      if (c.days >= 360) {
        ongoingCaption = '$' + c.monthlyEquiv.toFixed(2) + '/mo equiv';
      } else if (c.days === 28) {
        ongoingCaption = 'per 28 days ($' + c.monthlyEquiv.toFixed(2) + '/mo)';
      } else {
        ongoingCaption = 'ongoing';
      }

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
              '<div class="deal-cell deal-cell-speed" data-label="Data &amp; Network">' +
                '<span class="deal-cell-body">' +
                  '<span class="deal-cell-value">' + esc(dataVal) + '</span>' +
                  '<span class="deal-cell-caption">' + techLabel + '</span>' +
                '</span>' +
              '</div>' +
            '</div>' +
            '<div class="deal-group deal-group-cost">' +
              '<div class="deal-cost-primary">' +
                '<div class="deal-cell deal-cell-promo" data-label="Recharge">' +
                  '<span class="deal-cell-body">' +
                    '<span class="deal-price-orange">$' + promoDisplayPrice.toFixed(2) + '<small>/' + (c.days >= 360 ? 'yr' : c.cycleLabel) + '</small></span>' +
                    '<span class="deal-cell-caption">' + esc(promoCaption) + '</span>' +
                  '</span>' +
                '</div>' +
                '<div class="deal-cell deal-cell-after" data-label="Ongoing / Mo">' +
                  '<span class="deal-cell-body">' +
                    '<span class="deal-price-navy">$' + (c.days >= 360 ? c.monthlyEquiv.toFixed(2) : ongoingDisplayPrice.toFixed(2)) + '<small>/mo</small></span>' +
                    '<span class="deal-cell-caption">' + esc(ongoingCaption) + '</span>' +
                    vsMineHtml(c.monthlyEquiv) +
                  '</span>' +
                '</div>' +
              '</div>' +
              '<div class="deal-cost-totals">' +
                '<div class="deal-cell deal-cell-sixmonth" data-label="6-mo total">' +
                  '<span class="deal-cell-body">' +
                    '<span class="deal-price-navy">$' + c.sixMonthCost.toFixed(2) + '</span>' +
                    '<span class="deal-cell-caption">6 months</span>' +
                  '</span>' +
                '</div>' +
                '<div class="deal-cell deal-cell-total" data-label="1-year total">' +
                  '<span class="deal-cell-body">' +
                    '<span class="deal-price-total">$' + c.annualCost.toFixed(2) + '</span>' +
                    '<span class="deal-cell-caption">first year ($' + c.monthlyEquiv.toFixed(2) + '/mo)</span>' +
                    (c.annualSavings > 0 ? '<span class="deal-essential-saving">Save $' + c.annualSavings.toFixed(0) + ' intro</span>' : '') +
                    deltaAnnualHtml +
                  '</span>' +
                '</div>' +
                '<div class="deal-cell deal-cell-savings" data-label="Savings">' +
                  '<span class="deal-cell-body">' +
                    (c.annualSavings > 0
                      ? '<span class="deal-savings-amt">$' + c.annualSavings.toFixed(2) + '</span><span class="deal-savings-pct">Save ' + Math.round((c.annualSavings / (c.regularMonthlyEquiv * 12)) * 100) + '%</span>'
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
                  'aria-label="View mobile plan for ' + escAttr(d.provider + ' ' + (d.title || d.tier)) + '" ' +
                  'data-outbound="deal" data-provider="' + escAttr(d.provider) + '" data-plan="' + escAttr(d.title || d.tier) + '" data-tier="Mobile SIM">' +
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
    allMobileDeals.forEach(function (d) {
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
      if (selectedProvider) providerFilter.value = selectedProvider;
    }

    if (networkFilter && selectedNetwork) networkFilter.value = selectedNetwork;
    if (expiryFilter && selectedExpiry) expiryFilter.value = selectedExpiry;
    if (dataFilter && selectedData) dataFilter.value = selectedData;
    if (sortSelect && activeSort) sortSelect.value = activeSort;
  }

  function bindEvents() {
    if (networkFilter) {
      networkFilter.addEventListener('change', function () {
        selectedNetwork = networkFilter.value;
        updateUrlParams();
        renderList();
      });
    }

    if (expiryFilter) {
      expiryFilter.addEventListener('change', function () {
        selectedExpiry = expiryFilter.value;
        updateUrlParams();
        renderList();
      });
    }

    if (dataFilter) {
      dataFilter.addEventListener('change', function () {
        selectedData = dataFilter.value;
        updateUrlParams();
        renderList();
      });
    }

    if (providerFilter) {
      providerFilter.addEventListener('change', function () {
        selectedProvider = providerFilter.value;
        updateUrlParams();
        renderList();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        activeSort = sortSelect.value;
        updateUrlParams();
        renderList();
      });
    }

    if (mineInput) {
      mineInput.addEventListener('input', function () {
        var val = parseFloat(mineInput.value);
        if (!isNaN(val) && val > 0) {
          userCurrentBill = val;
          localStorage.setItem('jrs_user_cost', val.toString());
          if (mineClear) mineClear.hidden = false;
        } else {
          userCurrentBill = 0;
          localStorage.removeItem('jrs_user_cost');
          if (mineClear) mineClear.hidden = true;
        }
        renderList();
      });
    }

    if (mineClear) {
      mineClear.addEventListener('click', function () {
        mineInput.value = '';
        userCurrentBill = 0;
        localStorage.removeItem('jrs_user_cost');
        mineClear.hidden = true;
        renderList();
      });
    }
  }

  function loadDeals() {
    fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('Network response error');
        return r.json();
      })
      .catch(function () {
        return fetch(FALLBACK_URL).then(function (r) { return r.json(); });
      })
      .then(function (deals) {
        allMobileDeals = deals.filter(function (d) {
          return d.serviceType === 'mobile';
        }).map(function (d) {
          d._costs = calcCosts(d);
          return d;
        });

        initFilters();
        bindEvents();
        renderList();
        window.__MOBILE_PLANS_RENDERED__ = true;
      })
      .catch(function (err) {
        console.error('Failed to load mobile deals:', err);
        window.__MOBILE_PLANS_RENDERED__ = true;
      });
  }

  loadDeals();
})();
