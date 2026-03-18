// Password Generator (XKCD 936-style)
// - Runs entirely in the browser
// - Uses a Diceware-style wordlist (EFF large wordlist)
//   Source: https://www.eff.org/dice
//
// Note: This generator does not send any data to a server.

(function () {
  'use strict';

  const WORDLIST_URL = '/assets/data/password-words.txt';

  /** @type {string[]|null} */
  let WORDS = null;
  /** @type {Promise<string[]>|null} */
  let wordLoadPromise = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function clampInt(n, min, max) {
    n = parseInt(String(n), 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function getRandomUint32() {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }

  // Uniform integer in [0, maxExclusive)
  function randInt(maxExclusive) {
    if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
      throw new Error('randInt maxExclusive must be > 0');
    }

    // Rejection sampling to avoid modulo bias
    const range = 0x100000000; // 2^32
    const limit = range - (range % maxExclusive);

    while (true) {
      const x = getRandomUint32();
      if (x < limit) return x % maxExclusive;
    }
  }

  function pickOne(arr) {
    return arr[randInt(arr.length)];
  }

  function titleCase(word) {
    if (!word) return word;
    return word[0].toUpperCase() + word.slice(1);
  }

  function applyCase(word, mode) {
    switch (mode) {
      case 'lower':
        return word.toLowerCase();
      case 'upper':
        return word.toUpperCase();
      case 'title':
        return titleCase(word.toLowerCase());
      case 'random': {
        // Randomly choose one of lower/title/upper per-word
        const r = randInt(3);
        if (r === 0) return word.toLowerCase();
        if (r === 1) return titleCase(word.toLowerCase());
        return word.toUpperCase();
      }
      default:
        return word;
    }
  }

  function randomDigits(count) {
    const n = clampInt(count, 1, 10);
    let out = '';
    for (let i = 0; i < n; i++) out += String(randInt(10));
    return out;
  }

  function sanitizeSymbolSet(symbolSetRaw) {
    const s = String(symbolSetRaw || '').trim();
    // Keep printable non-whitespace characters. Also de-dup.
    const seen = new Set();
    const out = [];
    for (const ch of s) {
      if (/\s/.test(ch)) continue;
      if (seen.has(ch)) continue;
      seen.add(ch);
      out.push(ch);
    }
    return out;
  }

  function estimateEntropyBits({
    wordCount,
    wordlistSize,
    includeNumber,
    numberDigits,
    includeSymbol,
    symbolSetSize,
    placement,
  }) {
    // Basic entropy estimate (independence assumption).
    // words: log2(wordlistSize^wordCount) = wordCount * log2(wordlistSize)
    let bits = wordCount * Math.log2(Math.max(1, wordlistSize));

    if (includeNumber) {
      bits += numberDigits * Math.log2(10);
    }

    if (includeSymbol) {
      bits += Math.log2(Math.max(1, symbolSetSize));
    }

    // Placement choice slightly affects search space; keep it conservative.
    // If user selected a fixed placement, don't add anything.
    if (placement === 'both') {
      // In "both", we add both a symbol and number either side; but in our UI we
      // *still* generate one symbol + one number (each placed at start/end).
      // No extra bits beyond the components.
    }

    if (!Number.isFinite(bits)) return null;
    return Math.round(bits);
  }

  async function loadWords() {
    if (WORDS) return WORDS;
    if (wordLoadPromise) return wordLoadPromise;

    wordLoadPromise = (async () => {
      const resp = await fetch(WORDLIST_URL, { cache: 'force-cache' });
      if (!resp.ok) throw new Error(`Failed to load wordlist (${resp.status})`);
      const text = await resp.text();
      const words = text
        .split(/\r?\n/)
        .map((w) => w.trim())
        .filter(Boolean);

      if (words.length < 500) {
        throw new Error('Wordlist unexpectedly small');
      }

      WORDS = words;
      return words;
    })();

    return wordLoadPromise;
  }

  function buildPassphrase(opts) {
    const {
      words,
      wordCount,
      separator,
      caseMode,
      includeNumber,
      numberDigits,
      includeSymbol,
      symbolSet,
      placement,
    } = opts;

    const chosen = [];
    for (let i = 0; i < wordCount; i++) {
      chosen.push(applyCase(pickOne(words), caseMode));
    }

    const base = chosen.join(separator);

    const digits = includeNumber ? randomDigits(numberDigits) : '';
    const symbol = includeSymbol ? pickOne(symbolSet) : '';

    // Placement rules:
    // - end: words + number + symbol (or whichever enabled)
    // - start: symbol + number + words
    // - both: symbol + words + number (keeps start+end padding)
    if (placement === 'start') {
      return `${symbol}${digits}${base}`;
    }

    if (placement === 'both') {
      // Put symbol at start, digits at end (if enabled)
      return `${symbol}${base}${digits}`;
    }

    // default: end
    return `${base}${digits}${symbol}`;
  }

  async function generateAndRender() {
    const outputEl = qs('pg-output');
    const entropyEl = qs('pg-entropy');
    const copyStatusEl = qs('pg-copy-status');

    if (copyStatusEl) copyStatusEl.textContent = '';

    let words;
    try {
      outputEl.textContent = 'Loading wordlist…';
      words = await loadWords();
    } catch (err) {
      outputEl.textContent = 'Failed to load wordlist.';
      entropyEl.textContent = '—';
      // eslint-disable-next-line no-console
      console.error(err);
      return;
    }

    const wordCount = clampInt(qs('pg-word-count').value, 3, 10);
    const separator = String(qs('pg-separator').value);
    const caseMode = String(qs('pg-case').value);
    const includeNumber = !!qs('pg-include-number').checked;
    const includeSymbol = !!qs('pg-include-symbol').checked;
    const numberDigits = clampInt(qs('pg-number-digits').value, 1, 10);
    const placement = String(qs('pg-placement').value);

    const symbolSet = sanitizeSymbolSet(qs('pg-symbol-set').value);
    if (includeSymbol && symbolSet.length === 0) {
      outputEl.textContent = 'Please provide at least one symbol in the symbol set.';
      entropyEl.textContent = '—';
      return;
    }

    if (!includeNumber && !includeSymbol) {
      // This is still XKCD-936 strong, but many services will reject it; warn inline.
      if (copyStatusEl) copyStatusEl.textContent = 'Note: some sites require a digit and symbol.';
    }

    const pass = buildPassphrase({
      words,
      wordCount,
      separator,
      caseMode,
      includeNumber,
      numberDigits,
      includeSymbol,
      symbolSet,
      placement,
    });

    outputEl.textContent = pass;

    const bits = estimateEntropyBits({
      wordCount,
      wordlistSize: words.length,
      includeNumber,
      numberDigits,
      includeSymbol,
      symbolSetSize: symbolSet.length,
      placement,
    });

    entropyEl.textContent = bits === null ? '—' : `${bits} bits`;
  }

  async function copyToClipboard() {
    const outputEl = qs('pg-output');
    const copyStatusEl = qs('pg-copy-status');
    const text = (outputEl && outputEl.textContent || '').trim();

    if (!text || text === '—' || text.endsWith('…')) {
      if (copyStatusEl) copyStatusEl.textContent = 'Nothing to copy yet.';
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      if (copyStatusEl) copyStatusEl.textContent = 'Copied.';
    } catch (err) {
      // Fallback for older browsers
      try {
        const tmp = document.createElement('textarea');
        tmp.value = text;
        tmp.setAttribute('readonly', '');
        tmp.style.position = 'fixed';
        tmp.style.top = '-1000px';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
        if (copyStatusEl) copyStatusEl.textContent = 'Copied.';
      } catch (err2) {
        if (copyStatusEl) copyStatusEl.textContent = 'Copy failed.';
        // eslint-disable-next-line no-console
        console.error(err, err2);
      }
    }
  }

  function wire() {
    const generateBtn = qs('pg-generate');
    const copyBtn = qs('pg-copy');

    if (generateBtn) generateBtn.addEventListener('click', generateAndRender);
    if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);

    // Auto-regenerate when options change
    const optionIds = [
      'pg-word-count',
      'pg-separator',
      'pg-case',
      'pg-include-number',
      'pg-include-symbol',
      'pg-number-digits',
      'pg-symbol-set',
      'pg-placement',
    ];

    for (const id of optionIds) {
      const el = qs(id);
      if (!el) continue;
      el.addEventListener('change', generateAndRender);
      el.addEventListener('input', function () {
        // avoid re-generating on every keystroke for huge symbol sets
        if (id === 'pg-symbol-set') return;
        generateAndRender();
      });
    }

    // Generate on first load
    generateAndRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
