// IP Address Lookup
// Uses a lightweight backend API (RDAP + MaxMind)
(function() {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function getApiBase() {
    // Prefer explicit override for local dev
    if (window.NETTOOLS_IPLOOKUP_API_BASE) return window.NETTOOLS_IPLOOKUP_API_BASE;

    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8787';
    }

    // Default production base (adjust in backend deploy)
    return 'https://iplookup.nettools.im';
  }

  const API_BASE = getApiBase().replace(/\/$/, '');

  function showError(msg) {
    const el = $('ip-error');
    el.querySelector('span').textContent = msg;
    el.classList.remove('hidden');
  }

  function clearError() {
    const el = $('ip-error');
    el.classList.add('hidden');
    el.querySelector('span').textContent = '';
  }

  function showLoading(show) {
    const el = $('ip-loading');
    el.classList.toggle('hidden', !show);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
  }

  function isIpLikely(input) {
    // Lightweight check; backend will validate properly.
    if (!input) return false;
    return /[:.]/.test(input) || /^[0-9a-fA-F]{8,}$/.test(input);
  }

  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      const isActive = content.id === `${tab}-tab`;
      content.classList.toggle('active', isActive);
      content.classList.toggle('hidden', !isActive);
    });
  }

  function addSummaryItem(label, value, highlight = false) {
    const grid = $('ip-summary');
    const item = document.createElement('div');
    item.className = 'summary-item';
    item.innerHTML = `
      <span class="summary-label">${escapeHtml(label)}</span>
      <span class="summary-value${highlight ? ' highlight' : ''}">${escapeHtml(value)}</span>
    `;
    grid.appendChild(item);
  }

  function addDetailRow(key, value, isMono = false) {
    const tbody = $('ip-details-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="white-space: nowrap; font-weight: 600; color: var(--text-primary);">${escapeHtml(key)}</td>
      <td style="${isMono ? 'font-family: var(--font-mono);' : ''}">${value}</td>
    `;
    tbody.appendChild(tr);
  }

  function linkify(url) {
    const safe = escapeHtml(url);
    return `<a href="${safe}" target="_blank" rel="noopener" style="color: var(--accent-color); text-decoration: none;">${safe}</a>`;
  }

  function fmtList(arr) {
    if (!arr || !arr.length) return '-';
    return escapeHtml(arr.join(', '));
  }

  function fmtMaybe(val) {
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'string') return escapeHtml(val);
    return escapeHtml(String(val));
  }

  function populate(result) {
    $('ip-summary').innerHTML = '';
    $('ip-details-body').innerHTML = '';

    // Summary
    addSummaryItem('IP', result.ip || '-', true);
    if (result.asn?.number) addSummaryItem('ASN', `AS${result.asn.number}`);
    if (result.asn?.org) addSummaryItem('ASN Org', result.asn.org);
    if (result.geo?.country?.name) addSummaryItem('Country', result.geo.country.name);
    if (result.geo?.city) addSummaryItem('City', result.geo.city);
    if (result.geo?.timezone) addSummaryItem('Timezone', result.geo.timezone);

    $('ip-details-info').textContent = result.cached ? 'cached' : 'live';

    // Details table
    addDetailRow('IP Version', fmtMaybe(result.version), true);
    addDetailRow('Source', fmtMaybe(result.source));

    if (result.geo) {
      addDetailRow('Continent', fmtMaybe(result.geo.continent?.name));
      addDetailRow('Country ISO', fmtMaybe(result.geo.country?.iso_code), true);
      addDetailRow('Region', fmtMaybe(result.geo.region));
      addDetailRow('Postal', fmtMaybe(result.geo.postal));
      if (result.geo.location?.lat != null && result.geo.location?.lon != null) {
        addDetailRow('Location', `${result.geo.location.lat}, ${result.geo.location.lon}`, true);
      }
      if (result.geo.location?.accuracy_radius_km != null) {
        addDetailRow('Accuracy Radius', `${result.geo.location.accuracy_radius_km} km`);
      }
    }

    if (result.asn) {
      addDetailRow('ASN', result.asn.number ? `AS${escapeHtml(String(result.asn.number))}` : '-', true);
      addDetailRow('ASN Org', fmtMaybe(result.asn.org));
    }

    if (result.rdap) {
      addDetailRow('RDAP Name', fmtMaybe(result.rdap.name));
      addDetailRow('RDAP Handle', fmtMaybe(result.rdap.handle), true);
      addDetailRow('RDAP Type', fmtMaybe(result.rdap.type));
      if (result.rdap.cidr) addDetailRow('CIDR', fmtMaybe(result.rdap.cidr), true);
      if (result.rdap.startAddress) addDetailRow('Start', fmtMaybe(result.rdap.startAddress), true);
      if (result.rdap.endAddress) addDetailRow('End', fmtMaybe(result.rdap.endAddress), true);
      if (result.rdap.status?.length) addDetailRow('Status', fmtList(result.rdap.status));
      if (result.rdap.parentHandle) addDetailRow('Parent Handle', fmtMaybe(result.rdap.parentHandle), true);
      if (result.rdap.rir) addDetailRow('Registry', fmtMaybe(result.rdap.rir));
      if (result.rdap.links?.rdap) addDetailRow('RDAP URL', linkify(result.rdap.links.rdap));
      if (result.rdap.abuseEmail) addDetailRow('Abuse Email', `<span style="font-family: var(--font-mono);">${escapeHtml(result.rdap.abuseEmail)}</span>`);
      if (result.rdap.abusePhone) addDetailRow('Abuse Phone', `<span style="font-family: var(--font-mono);">${escapeHtml(result.rdap.abusePhone)}</span>`);
    }

    // Raw
    $('raw-json').textContent = JSON.stringify(result, null, 2);
    $('raw-info').textContent = result.ip ? result.ip : '-';

    $('ip-results').classList.remove('hidden');
  }

  async function fetchJson(url) {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'omit'
    });

    let body = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      body = { error: await res.text() };
    }

    if (!res.ok) {
      const msg = body?.error || body?.message || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  async function lookup(ipInput) {
    clearError();
    $('ip-results').classList.add('hidden');
    showLoading(true);

    try {
      const ip = (ipInput || '').trim();

      // Prefer /v1/me for blank lookups.
      let data;
      if (!ip) {
        data = await fetchJson(`${API_BASE}/v1/me`);
      } else {
        // Basic client-side hint; backend does full validation.
        if (!isIpLikely(ip)) {
          throw new Error('Please enter a valid IPv4/IPv6 address');
        }
        data = await fetchJson(`${API_BASE}/v1/ip/${encodeURIComponent(ip)}`);
      }

      populate(data);
      switchTab('lookup');
    } catch (e) {
      if (e.status === 429) {
        showError('Rate limit hit (24 lookups / 24h). Please try again later.');
      } else {
        showError(e.message || 'Lookup failed');
      }
    } finally {
      showLoading(false);
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    $('ip-lookup-btn').addEventListener('click', () => lookup($('ip-lookup-input').value));
    $('ip-lookup-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') lookup($('ip-lookup-input').value);
    });

    $('ip-clear-btn').addEventListener('click', () => {
      $('ip-lookup-input').value = '';
      $('ip-results').classList.add('hidden');
      clearError();
      $('raw-json').textContent = '';
      $('raw-info').textContent = '-';
    });

    // Optional: auto lookup if user pastes
    $('ip-lookup-input').addEventListener('paste', () => {
      setTimeout(() => lookup($('ip-lookup-input').value), 50);
    });
  });
})();
