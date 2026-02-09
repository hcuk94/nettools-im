// Service Status Button (Uptime Kuma status page)
(function () {
  'use strict';

  const STATUS_PAGE_SLUG = 'nettools-im';
  const STATUS_URL = 'https://status.nettools.im';
  const HEARTBEAT_API = `${STATUS_URL}/api/status-page/heartbeat/${STATUS_PAGE_SLUG}`;

  // Uptime Kuma heartbeat status codes (common):
  // 0 = DOWN, 1 = UP, 2 = PENDING, 3 = MAINTENANCE
  function classifyWorstStatus(latestStatuses) {
    // latestStatuses: number[]
    if (!latestStatuses.length) return 'unknown';

    if (latestStatuses.some((s) => s === 0)) return 'down';
    if (latestStatuses.some((s) => s === 2 || s === 3)) return 'warn';
    if (latestStatuses.every((s) => s === 1)) return 'ok';

    return 'unknown';
  }

  function setDotState(dot, state) {
    dot.classList.remove('status-dot--ok', 'status-dot--warn', 'status-dot--down', 'status-dot--unknown');
    dot.classList.add(`status-dot--${state}`);
  }

  function setButtonLabel(btn, label) {
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.setAttribute('data-tooltip', label);
  }

  async function refresh() {
    const btn = document.getElementById('service-status-btn');
    if (!btn) return;

    const dot = btn.querySelector('.status-dot');
    if (!dot) return;

    try {
      const res = await fetch(HEARTBEAT_API, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const heartbeatList = data && data.heartbeatList ? data.heartbeatList : {};

      const latestStatuses = Object.values(heartbeatList)
        .map((arr) => Array.isArray(arr) ? arr[arr.length - 1] : null)
        .filter(Boolean)
        .map((hb) => hb.status);

      const state = classifyWorstStatus(latestStatuses);
      setDotState(dot, state);

      const label =
        state === 'ok' ? 'Service Status: All systems operational' :
        state === 'warn' ? 'Service Status: Degraded' :
        state === 'down' ? 'Service Status: Outage' :
        'Service Status: Unknown';

      setButtonLabel(btn, label);
    } catch (e) {
      // Likely CORS or transient failure.
      setDotState(dot, 'unknown');
      setButtonLabel(btn, 'Service Status: Unavailable');
    }
  }

  function init() {
    document.addEventListener('DOMContentLoaded', function () {
      refresh();
      // Refresh periodically (keep it light)
      setInterval(refresh, 60 * 1000);
    });
  }

  init();
})();
