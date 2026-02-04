// IP Subnet Calculator
// Supports both IPv4 and IPv6
(function() {
  'use strict';

  // ============================================
  // IPv4 Functions
  // ============================================

  function isValidIPv4(ip) {
    // Check if it's CIDR notation
    if (ip.includes('/')) {
      const [addr, cidr] = ip.split('/');
      const cidrNum = parseInt(cidr, 10);
      if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > 32) return false;
      return isValidIPv4(addr);
    }
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
    });
  }

  function parseIPv4Input(input) {
    // Returns { ip: string, targetCidr: number|null }
    if (input.includes('/')) {
      const [ip, cidr] = input.split('/');
      return { ip: ip.trim(), targetCidr: parseInt(cidr, 10) };
    }
    return { ip: input.trim(), targetCidr: null };
  }

  function ipv4ToInt(ip) {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  function intToIPv4(int) {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255
    ].join('.');
  }

  function getIPv4SubnetMask(cidr) {
    if (cidr === 0) return 0;
    return (~0 << (32 - cidr)) >>> 0;
  }

  function intToSubnetMask(int) {
    return intToIPv4(int);
  }

  function calculateIPv4Subnets(ip) {
    const ipInt = ipv4ToInt(ip);
    const subnets = [];

    for (let cidr = 32; cidr >= 0; cidr--) {
      const mask = getIPv4SubnetMask(cidr);
      const networkAddress = (ipInt & mask) >>> 0;
      const broadcastAddress = (networkAddress | (~mask >>> 0)) >>> 0;
      const hostCount = Math.pow(2, 32 - cidr);

      subnets.push({
        cidr: cidr,
        cidrNotation: intToIPv4(networkAddress) + '/' + cidr,
        networkAddress: intToIPv4(networkAddress),
        broadcastAddress: intToIPv4(broadcastAddress),
        range: intToIPv4(networkAddress) + ' - ' + intToIPv4(broadcastAddress),
        subnetMask: intToSubnetMask(mask),
        hostCount: hostCount,
        hostCountFormatted: formatNumber(hostCount)
      });
    }

    return subnets;
  }

  function getIPv4Summary(ip) {
    const ipInt = ipv4ToInt(ip);
    const binary = ipInt.toString(2).padStart(32, '0');
    const formattedBinary = binary.match(/.{8}/g).join('.');
    
    // Determine IP class
    const firstOctet = parseInt(ip.split('.')[0], 10);
    let ipClass, defaultMask;
    if (firstOctet < 128) {
      ipClass = 'A';
      defaultMask = '255.0.0.0 (/8)';
    } else if (firstOctet < 192) {
      ipClass = 'B';
      defaultMask = '255.255.0.0 (/16)';
    } else if (firstOctet < 224) {
      ipClass = 'C';
      defaultMask = '255.255.255.0 (/24)';
    } else if (firstOctet < 240) {
      ipClass = 'D (Multicast)';
      defaultMask = 'N/A';
    } else {
      ipClass = 'E (Reserved)';
      defaultMask = 'N/A';
    }

    // Determine if private
    let isPrivate = false;
    if (firstOctet === 10) isPrivate = true;
    else if (firstOctet === 172 && ip.split('.')[1] >= 16 && ip.split('.')[1] <= 31) isPrivate = true;
    else if (firstOctet === 192 && ip.split('.')[1] == 168) isPrivate = true;
    else if (ip === '127.0.0.1' || ip.startsWith('127.')) isPrivate = true;

    return {
      ip: ip,
      binary: formattedBinary,
      decimal: ipInt,
      hexadecimal: '0x' + ipInt.toString(16).toUpperCase().padStart(8, '0'),
      ipClass: ipClass,
      defaultMask: defaultMask,
      isPrivate: isPrivate ? 'Yes (RFC 1918)' : 'No (Public)'
    };
  }

  // ============================================
  // IPv6 Functions
  // ============================================

  function expandIPv6(ip) {
    // Remove any leading/trailing whitespace
    ip = ip.trim().toLowerCase();
    
    // Handle :: expansion
    if (ip.includes('::')) {
      const parts = ip.split('::');
      const left = parts[0] ? parts[0].split(':') : [];
      const right = parts[1] ? parts[1].split(':') : [];
      const missing = 8 - left.length - right.length;
      const middle = Array(missing).fill('0000');
      const expanded = [...left, ...middle, ...right];
      return expanded.map(p => p.padStart(4, '0')).join(':');
    }
    
    return ip.split(':').map(p => p.padStart(4, '0')).join(':');
  }

  function isValidIPv6(ip) {
    // Check if it's CIDR notation
    if (ip.includes('/')) {
      const [addr, prefix] = ip.split('/');
      const prefixNum = parseInt(prefix, 10);
      if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 128) return false;
      return isValidIPv6(addr);
    }
    
    // Basic validation
    ip = ip.trim().toLowerCase();
    
    // Check for invalid characters
    if (!/^[0-9a-f:]+$/.test(ip)) return false;
    
    // Check :: appears at most once
    const doubleColonCount = (ip.match(/::/g) || []).length;
    if (doubleColonCount > 1) return false;
    
    // Expand and validate
    try {
      const expanded = expandIPv6(ip);
      const parts = expanded.split(':');
      if (parts.length !== 8) return false;
      return parts.every(part => {
        if (part.length !== 4) return false;
        const num = parseInt(part, 16);
        return !isNaN(num) && num >= 0 && num <= 65535;
      });
    } catch (e) {
      return false;
    }
  }

  function parseIPv6Input(input) {
    // Returns { ip: string, targetPrefix: number|null }
    if (input.includes('/')) {
      const [ip, prefix] = input.split('/');
      return { ip: ip.trim(), targetPrefix: parseInt(prefix, 10) };
    }
    return { ip: input.trim(), targetPrefix: null };
  }

  function ipv6ToBigInt(ip) {
    const expanded = expandIPv6(ip);
    const hex = expanded.replace(/:/g, '');
    return BigInt('0x' + hex);
  }

  function bigIntToIPv6(bigint) {
    const hex = bigint.toString(16).padStart(32, '0');
    const parts = [];
    for (let i = 0; i < 32; i += 4) {
      parts.push(hex.substring(i, i + 4));
    }
    return parts.join(':');
  }

  function compressIPv6(ip) {
    // First expand fully
    const expanded = expandIPv6(ip);
    let parts = expanded.split(':');
    
    // Remove leading zeros from each part
    parts = parts.map(p => p.replace(/^0+/, '') || '0');
    
    // Find longest run of zeros
    let maxStart = -1, maxLen = 0;
    let currentStart = -1, currentLen = 0;
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '0') {
        if (currentStart === -1) currentStart = i;
        currentLen++;
        if (currentLen > maxLen) {
          maxLen = currentLen;
          maxStart = currentStart;
        }
      } else {
        currentStart = -1;
        currentLen = 0;
      }
    }
    
    // Only compress if we have at least 2 consecutive zeros
    if (maxLen >= 2) {
      const before = parts.slice(0, maxStart);
      const after = parts.slice(maxStart + maxLen);
      if (before.length === 0 && after.length === 0) return '::';
      if (before.length === 0) return '::' + after.join(':');
      if (after.length === 0) return before.join(':') + '::';
      return before.join(':') + '::' + after.join(':');
    }
    
    return parts.join(':');
  }

  function calculateIPv6Subnets(ip) {
    const ipBigInt = ipv6ToBigInt(ip);
    const subnets = [];
    const maxBits = 128n;

    // Common IPv6 prefix lengths
    const prefixes = [128, 127, 126, 124, 120, 112, 96, 80, 64, 56, 52, 48, 44, 40, 36, 32, 28, 24, 20, 16, 12, 8, 4, 0];

    for (const prefix of prefixes) {
      const prefixBigInt = BigInt(prefix);
      const hostBits = maxBits - prefixBigInt;
      
      // Calculate mask
      let mask;
      if (prefix === 0) {
        mask = 0n;
      } else if (prefix === 128) {
        mask = (1n << 128n) - 1n;
      } else {
        mask = ((1n << 128n) - 1n) ^ ((1n << hostBits) - 1n);
      }
      
      const networkAddress = ipBigInt & mask;
      const lastAddress = networkAddress | ((1n << hostBits) - 1n);
      const hostCount = 1n << hostBits;

      subnets.push({
        prefix: prefix,
        cidrNotation: compressIPv6(bigIntToIPv6(networkAddress)) + '/' + prefix,
        networkAddress: compressIPv6(bigIntToIPv6(networkAddress)),
        lastAddress: compressIPv6(bigIntToIPv6(lastAddress)),
        range: compressIPv6(bigIntToIPv6(networkAddress)) + ' - ' + compressIPv6(bigIntToIPv6(lastAddress)),
        hostCount: hostCount,
        hostCountFormatted: formatBigNumber(hostCount)
      });
    }

    return subnets;
  }

  function getIPv6Summary(ip) {
    const expanded = expandIPv6(ip);
    const compressed = compressIPv6(ip);
    const bigint = ipv6ToBigInt(ip);
    
    // Convert to binary (grouped)
    const hex = bigint.toString(16).padStart(32, '0');
    let binary = '';
    for (const char of hex) {
      binary += parseInt(char, 16).toString(2).padStart(4, '0');
    }
    
    // Determine scope
    const firstWord = expanded.substring(0, 4);
    let scope = 'Global Unicast';
    if (expanded.startsWith('fe80')) scope = 'Link-Local';
    else if (expanded.startsWith('fc') || expanded.startsWith('fd')) scope = 'Unique Local (ULA)';
    else if (expanded.startsWith('ff')) scope = 'Multicast';
    else if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') scope = 'Loopback';
    else if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') scope = 'Unspecified';
    else if (expanded.startsWith('2001:0db8')) scope = 'Documentation';
    else if (expanded.startsWith('2001') || expanded.startsWith('2002') || expanded.startsWith('2003')) scope = 'Global Unicast';

    return {
      ip: ip,
      expanded: expanded,
      compressed: compressed,
      scope: scope,
      prefixHint: scope === 'Link-Local' ? '/10' : scope === 'Unique Local (ULA)' ? '/7' : '/64 (typical)'
    };
  }

  // ============================================
  // Utility Functions
  // ============================================

  function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return num.toLocaleString();
    return num.toString();
  }

  function formatBigNumber(bigint) {
    if (bigint >= 1000000000000000000000000000000000000n) {
      return '~3.4 × 10³⁸';
    }
    if (bigint >= 1000000000000000000000000n) {
      const exp = bigint.toString().length - 1;
      return '~10^' + exp;
    }
    if (bigint >= 1000000000000n) {
      return (Number(bigint / 1000000000n) / 1000).toFixed(2) + 'T';
    }
    if (bigint >= 1000000000n) {
      return (Number(bigint / 1000000n) / 1000).toFixed(2) + 'B';
    }
    if (bigint >= 1000000n) {
      return (Number(bigint / 1000n) / 1000).toFixed(2) + 'M';
    }
    return bigint.toLocaleString();
  }

  // ============================================
  // UI Functions
  // ============================================

  function showError(message) {
    const errorEl = document.getElementById('error-message');
    const resultsEl = document.getElementById('results-container');
    
    errorEl.querySelector('span').textContent = message;
    errorEl.classList.remove('hidden');
    resultsEl.classList.add('hidden');
  }

  function hideError() {
    document.getElementById('error-message').classList.add('hidden');
  }

  function renderIPv4Results(ip, targetCidr = null) {
    const summary = getIPv4Summary(ip);
    const subnets = calculateIPv4Subnets(ip);
    
    // Render summary
    const summaryHtml = `
      <div class="summary-item">
        <span class="summary-label">IP Address</span>
        <span class="summary-value">${summary.ip}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Binary</span>
        <span class="summary-value">${summary.binary}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Decimal</span>
        <span class="summary-value">${summary.decimal}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Hexadecimal</span>
        <span class="summary-value">${summary.hexadecimal}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">IP Class</span>
        <span class="summary-value">${summary.ipClass}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Private/Public</span>
        <span class="summary-value">${summary.isPrivate}</span>
      </div>
    `;
    
    // Render table
    let tableHtml = `
      <table class="results-table">
        <thead>
          <tr>
            <th>CIDR Block</th>
            <th>IP Range (Network - Broadcast)</th>
            <th>Subnet Mask</th>
            <th class="ip-count">IP Quantity</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    for (const subnet of subnets) {
      const isHighlighted = targetCidr !== null && subnet.cidr === targetCidr;
      const highlightClass = isHighlighted ? 'highlighted' : '';
      const indicator = isHighlighted ? ' ← Your Subnet' : '';
      tableHtml += `
        <tr class="${highlightClass}">
          <td class="cidr">${subnet.cidrNotation}${indicator}</td>
          <td>${subnet.range}</td>
          <td>${subnet.subnetMask}</td>
          <td class="ip-count">${subnet.hostCountFormatted}</td>
        </tr>
      `;
    }
    
    tableHtml += '</tbody></table>';
    
    document.getElementById('summary-grid').innerHTML = summaryHtml;
    const infoText = targetCidr !== null 
      ? `Showing all subnets with /${targetCidr} highlighted for ${ip}` 
      : `Showing all ${subnets.length} subnets for ${ip}`;
    document.getElementById('results-info').textContent = infoText;
    document.getElementById('results-table-container').innerHTML = tableHtml;
    document.getElementById('results-container').classList.remove('hidden');
  }

  function renderIPv6Results(ip, targetPrefix = null) {
    const summary = getIPv6Summary(ip);
    const subnets = calculateIPv6Subnets(ip);
    
    // Render summary
    const summaryHtml = `
      <div class="summary-item">
        <span class="summary-label">Input</span>
        <span class="summary-value">${summary.ip}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Expanded</span>
        <span class="summary-value">${summary.expanded}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Compressed</span>
        <span class="summary-value">${summary.compressed}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Scope</span>
        <span class="summary-value">${summary.scope}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Typical Prefix</span>
        <span class="summary-value">${summary.prefixHint}</span>
      </div>
    `;
    
    // Render table
    let tableHtml = `
      <table class="results-table">
        <thead>
          <tr>
            <th>Prefix</th>
            <th>Network Range</th>
            <th class="ip-count">Address Quantity</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    for (const subnet of subnets) {
      const isHighlighted = targetPrefix !== null && subnet.prefix === targetPrefix;
      const highlightClass = isHighlighted ? 'highlighted' : '';
      const indicator = isHighlighted ? ' ← Your Prefix' : '';
      tableHtml += `
        <tr class="${highlightClass}">
          <td class="cidr">${subnet.cidrNotation}${indicator}</td>
          <td>${subnet.range}</td>
          <td class="ip-count">${subnet.hostCountFormatted}</td>
        </tr>
      `;
    }
    
    tableHtml += '</tbody></table>';
    
    document.getElementById('summary-grid').innerHTML = summaryHtml;
    const infoText = targetPrefix !== null 
      ? `Showing common prefixes with /${targetPrefix} highlighted for ${compressIPv6(ip)}` 
      : `Showing common prefix lengths for ${compressIPv6(ip)}`;
    document.getElementById('results-info').textContent = infoText;
    document.getElementById('results-table-container').innerHTML = tableHtml;
    document.getElementById('results-container').classList.remove('hidden');
  }

  function calculate() {
    const activeTab = document.querySelector('.tab-btn.active');
    const isIPv6 = activeTab && activeTab.dataset.tab === 'ipv6';
    
    const input = document.getElementById('ip-input').value.trim();
    
    if (!input) {
      showError('Please enter an IP address');
      return;
    }
    
    hideError();
    
    if (isIPv6) {
      if (!isValidIPv6(input)) {
        showError('Invalid IPv6 address. Please enter a valid IPv6 address (e.g., 2001:db8::1 or 2001:db8::/64)');
        return;
      }
      const { ip, targetPrefix } = parseIPv6Input(input);
      renderIPv6Results(ip, targetPrefix);
    } else {
      if (!isValidIPv4(input)) {
        showError('Invalid IPv4 address. Please enter a valid IPv4 address (e.g., 192.168.1.1 or 192.168.1.0/24)');
        return;
      }
      const { ip, targetCidr } = parseIPv4Input(input);
      renderIPv4Results(ip, targetCidr);
    }
  }

  function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update placeholder
    const input = document.getElementById('ip-input');
    if (tab === 'ipv6') {
      input.placeholder = 'e.g., 2001:db8::1 or 2001:db8::/64';
    } else {
      input.placeholder = 'e.g., 192.168.1.1 or 192.168.1.0/24';
    }
    
    // Clear results
    document.getElementById('results-container').classList.add('hidden');
    hideError();
  }

  // ============================================
  // Initialization
  // ============================================

  document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        switchTab(this.dataset.tab);
      });
    });
    
    // Calculate button
    const calcBtn = document.getElementById('calculate-btn');
    if (calcBtn) {
      calcBtn.addEventListener('click', calculate);
    }
    
    // Enter key to calculate
    const input = document.getElementById('ip-input');
    if (input) {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          calculate();
        }
      });
    }
    
    // Clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        document.getElementById('ip-input').value = '';
        document.getElementById('results-container').classList.add('hidden');
        hideError();
      });
    }
  });
})();
