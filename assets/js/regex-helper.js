// Regex Helper
// Build, test, and understand regular expressions
(function() {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let currentRegex = null;
  let currentMatches = [];

  // ============================================
  // Core Functions
  // ============================================

  function parseFlags(flagsStr) {
    const validFlags = ['g', 'i', 'm', 's', 'u', 'y'];
    const flags = (flagsStr || '').split('').filter(f => validFlags.includes(f));
    return [...new Set(flags)].join(''); // Remove duplicates
  }

  function buildRegex(pattern, flags) {
    try {
      const validFlags = parseFlags(flags);
      return new RegExp(pattern, validFlags);
    } catch (e) {
      throw new Error(e.message);
    }
  }

  function findMatches(regex, text) {
    const matches = [];
    if (!regex.global) {
      // For non-global, just get one match
      const match = regex.exec(text);
      if (match) {
        matches.push({
          text: match[0],
          index: match.index,
          length: match[0].length,
          groups: match.slice(1)
        });
      }
    } else {
      // Global: find all matches
      let match;
      while ((match = regex.exec(text)) !== null) {
        // Prevent infinite loop on zero-width matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
        matches.push({
          text: match[0],
          index: match.index,
          length: match[0].length,
          groups: match.slice(1)
        });
      }
    }
    return matches;
  }

  // ============================================
  // UI Update Functions
  // ============================================

  function showError(message) {
    const errorEl = $('regex-error');
    errorEl.querySelector('span').textContent = message;
    errorEl.classList.remove('hidden');
    $('regex-match-count').textContent = 'Invalid pattern';
    $('regex-match-count').classList.add('regex-error-badge');
  }

  function hideError() {
    $('regex-error').classList.add('hidden');
    $('regex-match-count').classList.remove('regex-error-badge');
  }

  function updateResults() {
    const pattern = $('regex-pattern').value;
    const flags = $('regex-flags').value;
    const text = $('regex-text').value;

    if (!pattern) {
      $('regex-results').innerHTML = '<div class="regex-no-matches">Enter a pattern to see matches</div>';
      $('regex-match-count').textContent = '0 matches';
      currentMatches = [];
      return;
    }

    try {
      currentRegex = buildRegex(pattern, flags);
      hideError();

      currentMatches = findMatches(currentRegex, text);

      // Update match count
      const count = currentMatches.length;
      $('regex-match-count').textContent = count === 1 ? '1 match' : `${count} matches`;

      // Display results
      displayMatches(currentMatches, text);

      // Update explanation display
      $('regex-explain-display').textContent = `/${pattern}/${parseFlags(flags)}`;

    } catch (e) {
      showError(e.message);
      currentMatches = [];
    }
  }

  function displayMatches(matches, originalText) {
    const container = $('regex-results');

    if (matches.length === 0) {
      container.innerHTML = '<div class="regex-no-matches">No matches found</div>';
      return;
    }

    const html = matches.map((match, idx) => {
      // Get context around the match
      const contextStart = Math.max(0, match.index - 20);
      const contextEnd = Math.min(originalText.length, match.index + match.length + 20);
      const before = originalText.slice(contextStart, match.index);
      const after = originalText.slice(match.index + match.length, contextEnd);

      let groupsHtml = '';
      if (match.groups.length > 0) {
        groupsHtml = '<div class="regex-match-groups">' +
          match.groups.map((g, i) => `<span class="regex-group">$${i + 1}: ${escapeHtml(g || '(empty)')}</span>`).join('') +
          '</div>';
      }

      return `
        <div class="regex-match-item">
          <div class="regex-match-header">
            <span class="regex-match-number">#${idx + 1}</span>
            <span class="regex-match-range">Position ${match.index}-${match.index + match.length}</span>
          </div>
          <div class="regex-match-content">
            <span class="regex-context">${escapeHtml(before)}</span>
            <mark class="regex-highlight">${escapeHtml(match.text)}</mark>
            <span class="regex-context">${escapeHtml(after)}</span>
          </div>
          ${groupsHtml}
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // Substitution
  // ============================================

  function performSubstitution() {
    if (!currentRegex || currentMatches.length === 0) {
      return;
    }

    const text = $('regex-text').value;
    const replacement = $('regex-substitute').value;

    // Create a new regex with global flag for replacement
    let flags = parseFlags($('regex-flags').value);
    if (!flags.includes('g')) {
      flags += 'g';
    }

    try {
      const regex = buildRegex($('regex-pattern').value, flags);
      const result = text.replace(regex, replacement);

      const resultEl = $('regex-substitute-result');
      resultEl.classList.remove('hidden');
      resultEl.querySelector('pre').textContent = result;
    } catch (e) {
      showError('Substitution error: ' + e.message);
    }
  }

  // ============================================
  // Pattern Explanation
  // ============================================

  function explainPattern() {
    const pattern = $('regex-pattern').value;
    const container = $('regex-explanation');

    if (!pattern) {
      container.innerHTML = '<div class="regex-no-explain">Enter a pattern to see explanation</div>';
      return;
    }

    const explanations = parsePatternForExplanation(pattern);

    if (explanations.length === 0) {
      container.innerHTML = '<div class="regex-no-explain">Pattern explanation not available</div>';
      return;
    }

    const html = explanations.map((exp, idx) => `
      <div class="regex-explain-item">
        <div class="regex-explain-token">
          <code>${escapeHtml(exp.token)}</code>
        </div>
        <div class="regex-explain-desc">${escapeHtml(exp.description)}</div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  function parsePatternForExplanation(pattern) {
    const explanations = [];
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];
      const remaining = pattern.slice(i);

      // Check for complex patterns first
      const result = matchComplexPattern(remaining);
      if (result) {
        explanations.push({ token: result.token, description: result.description });
        i += result.length;
        continue;
      }

      // Simple character explanations
      const simple = getSimpleExplanation(char);
      if (simple) {
        explanations.push({ token: char, description: simple });
      }
      i++;
    }

    return explanations;
  }

  function matchComplexPattern(str) {
    // Character classes like [a-z], [^abc], etc.
    const charClassMatch = str.match(/^\[(?:\^?)(?:[^\]]+)\]/);
    if (charClassMatch) {
      const isNegated = str[1] === '^';
      const content = isNegated ? str.slice(2, charClassMatch[0].length - 1) : str.slice(1, charClassMatch[0].length - 1);
      return {
        token: charClassMatch[0],
        description: isNegated ? `Any character NOT in [${content}]` : `Any character in [${content}]`,
        length: charClassMatch[0].length
      };
    }

    // Quantifiers with numbers like {2}, {2,}, {2,5}
    const quantMatch = str.match(/^\{(\d+)(,?)(\d*)\}/);
    if (quantMatch) {
      const [, min, comma, max] = quantMatch;
      let desc;
      if (!comma) desc = `Exactly ${min} times`;
      else if (!max) desc = `At least ${min} times`;
      else desc = `Between ${min} and ${max} times`;
      return { token: quantMatch[0], description: desc, length: quantMatch[0].length };
    }

    // Escape sequences
    const escapeMatch = str.match(/^\\./);
    if (escapeMatch) {
      const desc = getEscapeExplanation(escapeMatch[0]);
      return { token: escapeMatch[0], description: desc, length: 2 };
    }

    // Groups
    const groupMatch = str.match(/^\((?:\?[:<!]?(?:<[^>]+>)?)?/);
    if (groupMatch) {
      let desc = 'Capturing group';
      const g = groupMatch[0];
      if (g === '(?:') desc = 'Non-capturing group';
      else if (g.startsWith('(?<')) desc = 'Named capturing group';
      else if (g === '(?=') desc = 'Positive lookahead';
      else if (g === '(?!') desc = 'Negative lookahead';
      else if (g === '(?<=') desc = 'Positive lookbehind';
      else if (g === '(?<!') desc = 'Negative lookbehind';

      // Find the matching closing paren
      let depth = 1;
      let j = g.length;
      while (j < str.length && depth > 0) {
        if (str[j] === '(' && str[j-1] !== '\\') depth++;
        if (str[j] === ')' && str[j-1] !== '\\') depth--;
        j++;
      }
      return { token: str.slice(0, j), description: desc, length: j };
    }

    return null;
  }

  function getSimpleExplanation(char) {
    const map = {
      '.': 'Any character except newline',
      '^': 'Start of string/line',
      '$': 'End of string/line',
      '*': 'Zero or more of preceding',
      '+': 'One or more of preceding',
      '?': 'Zero or one of preceding (optional)',
      '|': 'Alternation (OR)',
      '\\': 'Escape character'
    };
    return map[char] || `Literal "${char}"`;
  }

  function getEscapeExplanation(seq) {
    const map = {
      '\\d': 'Digit (0-9)',
      '\\D': 'Non-digit',
      '\\w': 'Word character (a-z, A-Z, 0-9, _)',
      '\\W': 'Non-word character',
      '\\s': 'Whitespace character',
      '\\S': 'Non-whitespace character',
      '\\b': 'Word boundary',
      '\\B': 'Non-word boundary',
      '\\n': 'Newline',
      '\\r': 'Carriage return',
      '\\t': 'Tab',
      '\\v': 'Vertical tab',
      '\\f': 'Form feed',
      '\\0': 'Null character'
    };
    return map[seq] || `Escaped "${seq[1]}"`;
  }

  // ============================================
  // Tab Switching
  // ============================================

  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      const isActive = content.id === `${tab}-tab`;
      content.classList.toggle('active', isActive);
      content.classList.toggle('hidden', !isActive);
    });

    if (tab === 'explain') {
      explainPattern();
    }
  }

  // Load example into test tab
  function loadExample(pattern, flags, text) {
    $('regex-pattern').value = pattern;
    $('regex-flags').value = flags;
    $('regex-text').value = text;
    switchTab('test');
    updateResults();
  }

  // ============================================
  // Initialization
  // ============================================

  document.addEventListener('DOMContentLoaded', function() {
    // Initial test
    updateResults();

    // Pattern input changes
    $('regex-pattern').addEventListener('input', updateResults);
    $('regex-flags').addEventListener('input', updateResults);
    $('regex-text').addEventListener('input', updateResults);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Example items - click to load into test tab
    document.querySelectorAll('.regex-example-item').forEach(item => {
      item.addEventListener('click', () => {
        const patternEl = item.querySelector('.regex-example-pattern');
        const textEl = item.querySelector('.regex-example-text');
        if (patternEl && textEl) {
          const fullPattern = patternEl.textContent;
          const match = fullPattern.match(/^\/(.+)\/([gimsuy]*)$/);
          if (match) {
            loadExample(match[1], match[2] || '', textEl.textContent);
          }
        }
      });
      item.style.cursor = 'pointer';
    });

    // Substitution
    $('regex-replace-btn').addEventListener('click', performSubstitution);
  });
})();
