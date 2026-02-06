// MAC Vendor Lookup
// Identify network device manufacturers from MAC addresses using IEEE OUI database
(function() {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let database = null;
  let databaseLoaded = false;

  // ============================================
  // MAC Address Parsing & Validation
  // ============================================

  function normalizeMac(input) {
    // Remove all separators and convert to uppercase
    const cleaned = input.toUpperCase().replace(/[:\-.\s]/g, '');
    
    // Validate: must be 12 hex characters
    if (!/^[0-9A-F]{12}$/.test(cleaned)) {
      return null;
    }
    
    return cleaned;
  }

  function formatMac(normalized, style = 'colon') {
    if (!normalized || normalized.length !== 12) return normalized;
    
    switch (style) {
      case 'colon':
        return normalized.match(/.{2}/g).join(':');
      case 'dash':
        return normalized.match(/.{2}/g).join('-');
      case 'dot':
        return normalized.match(/.{4}/g).join('.');
      case 'none':
        return normalized;
      default:
        return normalized.match(/.{2}/g).join(':');
    }
  }

  function getOuiPrefix(normalized) {
    // Standard OUI is first 6 hex chars (24 bits)
    return normalized.substring(0, 6);
  }

  function isLocallyAdministered(normalized) {
    // Bit 1 of first byte (second hex char bit 1)
    // If second character is 2, 6, A, or E (bit 1 set), it's locally administered
    const secondChar = normalized[1];
    return ['2', '6', 'A', 'E'].includes(secondChar);
  }

  function isMulticast(normalized) {
    // Bit 0 of first byte (second hex char bit 0)
    // If second character is odd, it's multicast
    const secondChar = normalized[1];
    return ['1', '3', '5', '7', '9', 'B', 'D', 'F'].includes(secondChar);
  }

  function isBroadcast(normalized) {
    return normalized === 'FFFFFFFFFFFF';
  }

  // ============================================
  // Database Loading & Lookup
  // ============================================

  async function loadDatabase() {
    if (databaseLoaded) return true;
    
    showLoading(true);
    
    try {
      // Try to load the lite database first (faster)
      const response = await fetch('/assets/data/oui-database-lite.json');
      if (!response.ok) {
        throw new Error(`Failed to load database: ${response.status}`);
      }
      
      database = await response.json();
      databaseLoaded = true;
      
      // Update database info display
      updateDbInfo();
      
      showLoading(false);
      return true;
    } catch (error) {
      console.error('Failed to load OUI database:', error);
      showError('Failed to load OUI database. Please refresh the page.');
      showLoading(false);
      return false;
    }
  }

  function lookupVendor(normalized) {
    if (!database || !normalized) return null;
    
    // Try MA-S/IAB first (36-bit, most specific)
    const mas_prefix = normalized.substring(0, 9);
    if (database.mas && database.mas[mas_prefix]) {
      return {
        vendor: database.mas[mas_prefix],
        prefix: mas_prefix,
        type: 'MA-S/IAB',
        bits: 36
      };
    }
    
    // Try MA-M next (28-bit)
    const mam_prefix = normalized.substring(0, 7);
    if (database.mam && database.mam[mam_prefix]) {
      return {
        vendor: database.mam[mam_prefix],
        prefix: mam_prefix,
        type: 'MA-M',
        bits: 28
      };
    }
    
    // Try MA-L (24-bit, most common)
    const mal_prefix = normalized.substring(0, 6);
    if (database.mal && database.mal[mal_prefix]) {
      return {
        vendor: database.mal[mal_prefix],
        prefix: mal_prefix,
        type: 'MA-L',
        bits: 24
      };
    }
    
    return null;
  }

  function searchVendors(query, limit = 100) {
    if (!database || !query) return [];
    
    const results = [];
    const searchTerm = query.toLowerCase();
    
    // Search in all databases
    const searchDb = (db, type) => {
      if (!db) return;
      for (const [prefix, vendor] of Object.entries(db)) {
        const vendorName = typeof vendor === 'string' ? vendor : vendor.n;
        if (vendorName && vendorName.toLowerCase().includes(searchTerm)) {
          results.push({
            prefix,
            vendor: vendorName,
            type
          });
          if (results.length >= limit) return;
        }
      }
    };
    
    searchDb(database.mal, 'MA-L');
    if (results.length < limit) searchDb(database.mam, 'MA-M');
    if (results.length < limit) searchDb(database.mas, 'MA-S/IAB');
    
    return results.slice(0, limit);
  }

  // ============================================
  // UI Functions
  // ============================================

  function showError(msg) {
    const el = $('error-message');
    el.querySelector('span').textContent = msg;
    el.classList.remove('hidden');
  }

  function clearError() {
    const el = $('error-message');
    el.classList.add('hidden');
    el.querySelector('span').textContent = '';
  }

  function showLoading(show) {
    const el = $('loading-indicator');
    if (show) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function updateDbInfo() {
    if (!database) return;
    
    $('db-info').classList.remove('hidden');
    $('db-total').textContent = database.counts?.total?.toLocaleString() || '-';
    
    if (database.generated) {
      const date = new Date(database.generated);
      $('db-updated').textContent = date.toLocaleDateString();
    }
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

    // Hide all results when switching tabs
    $('results-container').classList.add('hidden');
    $('batch-results-container').classList.add('hidden');
    $('search-results-container').classList.add('hidden');
    clearError();
  }

  // ============================================
  // Single Lookup
  // ============================================

  function performLookup() {
    clearError();
    $('results-container').classList.add('hidden');
    
    const input = $('mac-input').value.trim();
    if (!input) {
      showError('Please enter a MAC address');
      return;
    }
    
    const normalized = normalizeMac(input);
    if (!normalized) {
      showError('Invalid MAC address format. Expected format: AA:BB:CC:DD:EE:FF');
      return;
    }
    
    const result = lookupVendor(normalized);
    const locallyAdmin = isLocallyAdministered(normalized);
    const multicast = isMulticast(normalized);
    const broadcast = isBroadcast(normalized);
    
    // Build summary grid
    const summaryGrid = $('summary-grid');
    summaryGrid.innerHTML = '';
    
    const addSummaryItem = (label, value, highlight = false) => {
      const item = document.createElement('div');
      item.className = 'summary-item';
      item.innerHTML = `
        <span class="summary-label">${label}</span>
        <span class="summary-value${highlight ? ' highlight' : ''}">${value}</span>
      `;
      summaryGrid.appendChild(item);
    };
    
    addSummaryItem('MAC Address', formatMac(normalized, 'colon'));
    
    if (result) {
      addSummaryItem('Vendor', result.vendor, true);
      addSummaryItem('OUI Prefix', formatMac(result.prefix.padEnd(12, '0'), 'colon').substring(0, result.prefix.length + Math.floor(result.prefix.length / 2)));
      addSummaryItem('Registration', result.type);
    } else if (locallyAdmin) {
      addSummaryItem('Vendor', 'Locally Administered', true);
    } else {
      addSummaryItem('Vendor', 'Unknown', true);
    }
    
    // Build details section
    const detailsSection = $('mac-details');
    detailsSection.innerHTML = '';
    
    // Address type badges
    const badges = [];
    if (broadcast) {
      badges.push('<span class="mac-badge broadcast">Broadcast</span>');
    } else if (multicast) {
      badges.push('<span class="mac-badge multicast">Multicast</span>');
    } else {
      badges.push('<span class="mac-badge unicast">Unicast</span>');
    }
    
    if (locallyAdmin) {
      badges.push('<span class="mac-badge local">Locally Administered</span>');
    } else {
      badges.push('<span class="mac-badge global">Globally Unique (UAA)</span>');
    }
    
    detailsSection.innerHTML = `
      <div class="mac-badges">${badges.join('')}</div>
      <div class="mac-formats">
        <h4>Format Conversions</h4>
        <div class="mac-format-list">
          <div class="mac-format-row">
            <span class="mac-format-label">Colon (Unix)</span>
            <code class="mac-format-value" data-copy="${formatMac(normalized, 'colon')}">${formatMac(normalized, 'colon')}</code>
            <button class="btn btn-sm btn-secondary mac-copy-btn" data-copy="${formatMac(normalized, 'colon')}">Copy</button>
          </div>
          <div class="mac-format-row">
            <span class="mac-format-label">Dash (Windows)</span>
            <code class="mac-format-value">${formatMac(normalized, 'dash')}</code>
            <button class="btn btn-sm btn-secondary mac-copy-btn" data-copy="${formatMac(normalized, 'dash')}">Copy</button>
          </div>
          <div class="mac-format-row">
            <span class="mac-format-label">Dot (Cisco)</span>
            <code class="mac-format-value">${formatMac(normalized, 'dot')}</code>
            <button class="btn btn-sm btn-secondary mac-copy-btn" data-copy="${formatMac(normalized, 'dot')}">Copy</button>
          </div>
          <div class="mac-format-row">
            <span class="mac-format-label">No Separator</span>
            <code class="mac-format-value">${normalized}</code>
            <button class="btn btn-sm btn-secondary mac-copy-btn" data-copy="${normalized}">Copy</button>
          </div>
        </div>
      </div>
      ${!result && !locallyAdmin ? `
        <div class="mac-not-found-info">
          <p>This OUI prefix is not registered in the IEEE database. Possible reasons:</p>
          <ul>
            <li>The device uses a private/internal MAC address</li>
            <li>The manufacturer hasn't registered this prefix</li>
            <li>The MAC address may be spoofed or randomly generated</li>
          </ul>
        </div>
      ` : ''}
      ${locallyAdmin ? `
        <div class="mac-local-info">
          <p>This MAC address has the locally administered bit set, indicating it was not assigned by a manufacturer. Common sources:</p>
          <ul>
            <li>Virtual machines (VMware, VirtualBox, Hyper-V)</li>
            <li>Docker containers and Kubernetes pods</li>
            <li>macOS/iOS/Android private WiFi addresses</li>
            <li>Software-defined networking</li>
            <li>Manual configuration or MAC spoofing</li>
          </ul>
        </div>
      ` : ''}
    `;
    
    // Add copy button handlers
    detailsSection.querySelectorAll('.mac-copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const text = this.dataset.copy;
        navigator.clipboard.writeText(text).then(() => {
          const original = this.textContent;
          this.textContent = 'Copied';
          setTimeout(() => this.textContent = original, 1000);
        });
      });
    });
    
    $('results-container').classList.remove('hidden');
  }

  // ============================================
  // Batch Lookup
  // ============================================

  let batchResults = [];

  function performBatchLookup() {
    clearError();
    $('batch-results-container').classList.add('hidden');
    batchResults = [];
    
    const input = $('batch-input').value.trim();
    if (!input) {
      showError('Please enter at least one MAC address');
      return;
    }
    
    const lines = input.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      showError('No valid MAC addresses found');
      return;
    }
    
    const tbody = $('batch-results-body');
    tbody.innerHTML = '';
    
    let found = 0;
    let notFound = 0;
    let invalid = 0;
    
    lines.forEach(line => {
      const normalized = normalizeMac(line);
      const row = document.createElement('tr');
      
      if (!normalized) {
        invalid++;
        row.innerHTML = `
          <td><code>${escapeHtml(line)}</code></td>
          <td>-</td>
          <td>-</td>
          <td><span class="mac-badge error">Invalid</span></td>
        `;
        batchResults.push({ mac: line, vendor: '', type: '', status: 'Invalid' });
      } else {
        const result = lookupVendor(normalized);
        const locallyAdmin = isLocallyAdministered(normalized);
        
        if (result) {
          found++;
          row.innerHTML = `
            <td><code>${formatMac(normalized, 'colon')}</code></td>
            <td>${escapeHtml(result.vendor)}</td>
            <td>${result.type}</td>
            <td><span class="mac-badge success">Found</span></td>
          `;
          batchResults.push({ 
            mac: formatMac(normalized, 'colon'), 
            vendor: result.vendor, 
            type: result.type, 
            status: 'Found' 
          });
        } else if (locallyAdmin) {
          notFound++;
          row.innerHTML = `
            <td><code>${formatMac(normalized, 'colon')}</code></td>
            <td>Locally Administered</td>
            <td>-</td>
            <td><span class="mac-badge local">Local</span></td>
          `;
          batchResults.push({ 
            mac: formatMac(normalized, 'colon'), 
            vendor: 'Locally Administered', 
            type: '', 
            status: 'Local' 
          });
        } else {
          notFound++;
          row.innerHTML = `
            <td><code>${formatMac(normalized, 'colon')}</code></td>
            <td>-</td>
            <td>-</td>
            <td><span class="mac-badge warning">Not Found</span></td>
          `;
          batchResults.push({ 
            mac: formatMac(normalized, 'colon'), 
            vendor: '', 
            type: '', 
            status: 'Not Found' 
          });
        }
      }
      
      tbody.appendChild(row);
    });
    
    $('batch-results-info').textContent = `${found} found, ${notFound} not found, ${invalid} invalid`;
    $('batch-results-container').classList.remove('hidden');
    $('batch-export-btn').disabled = batchResults.length === 0;
  }

  function exportBatchCsv() {
    if (batchResults.length === 0) return;
    
    const headers = ['MAC Address', 'Vendor', 'Type', 'Status'];
    const rows = batchResults.map(r => [r.mac, r.vendor, r.type, r.status]);
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mac-lookup-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ============================================
  // Vendor Search
  // ============================================

  function performVendorSearch() {
    clearError();
    $('search-results-container').classList.add('hidden');
    
    const query = $('vendor-search-input').value.trim();
    if (!query) {
      showError('Please enter a vendor name to search');
      return;
    }
    
    if (query.length < 2) {
      showError('Please enter at least 2 characters');
      return;
    }
    
    const results = searchVendors(query, 200);
    
    if (results.length === 0) {
      showError(`No vendors found matching "${query}"`);
      return;
    }
    
    const tbody = $('search-results-body');
    tbody.innerHTML = '';
    
    results.forEach(result => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><code>${formatOuiDisplay(result.prefix)}</code></td>
        <td>${escapeHtml(result.vendor)}</td>
        <td>${result.type}</td>
      `;
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        // Switch to lookup tab and populate with a sample MAC
        switchTab('lookup');
        const sampleMac = result.prefix.padEnd(12, '0');
        $('mac-input').value = formatMac(sampleMac, 'colon');
        performLookup();
      });
      tbody.appendChild(row);
    });
    
    $('search-results-info').textContent = `${results.length} results${results.length >= 200 ? ' (limited)' : ''}`;
    $('search-results-container').classList.remove('hidden');
  }

  // ============================================
  // Utility Functions
  // ============================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatOuiDisplay(prefix) {
    // Format OUI prefix with colons for display
    if (prefix.length <= 6) {
      return prefix.match(/.{2}/g).join(':');
    } else if (prefix.length === 7) {
      // MA-M: 7 chars -> AA:BB:CC:D
      const pairs = prefix.substring(0, 6).match(/.{2}/g);
      return pairs.join(':') + ':' + prefix[6];
    } else {
      // MA-S: 9 chars -> AA:BB:CC:DD:E
      const pairs = prefix.substring(0, 8).match(/.{2}/g);
      return pairs.join(':') + ':' + prefix[8];
    }
  }

  // ============================================
  // Event Listeners
  // ============================================

  document.addEventListener('DOMContentLoaded', async function() {
    // Load database
    await loadDatabase();
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Single lookup
    $('lookup-btn').addEventListener('click', performLookup);
    $('mac-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performLookup();
    });
    $('clear-btn').addEventListener('click', () => {
      $('mac-input').value = '';
      $('results-container').classList.add('hidden');
      clearError();
    });
    
    // Batch lookup
    $('batch-lookup-btn').addEventListener('click', performBatchLookup);
    $('batch-clear-btn').addEventListener('click', () => {
      $('batch-input').value = '';
      $('batch-results-container').classList.add('hidden');
      batchResults = [];
      clearError();
    });
    $('batch-export-btn').addEventListener('click', exportBatchCsv);
    
    // Vendor search
    $('search-btn').addEventListener('click', performVendorSearch);
    $('vendor-search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performVendorSearch();
    });
    
    // Auto-lookup on paste in single lookup
    $('mac-input').addEventListener('paste', () => {
      setTimeout(performLookup, 50);
    });
  });
})();
