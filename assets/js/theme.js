// Theme Management
(function() {
  'use strict';

  const THEME_KEY = 'nettools-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  // Get system preference
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  }

  // Get stored theme or fall back to system preference
  function getStoredTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    return stored || getSystemTheme();
  }

  // Apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateToggleButton(theme);
  }

  // Update toggle button text and icon
  function updateToggleButton(theme) {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    const isDark = theme === DARK;
    btn.innerHTML = `
      <svg class="theme-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${isDark 
          ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
          : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        }
      </svg>
      <span>${isDark ? 'Light Mode' : 'Dark Mode'}</span>
    `;
  }

  // Toggle theme
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || getStoredTheme();
    const next = current === DARK ? LIGHT : DARK;
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  // Initialize on page load
  function init() {
    // Apply theme immediately to prevent flash
    const theme = getStoredTheme();
    document.documentElement.setAttribute('data-theme', theme);

    // Set up toggle button after DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
      // Update button text to reflect current theme
      updateToggleButton(theme);
      
      const btn = document.querySelector('.theme-toggle');
      if (btn) {
        btn.addEventListener('click', toggleTheme);
      }
    });

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      // Only auto-switch if user hasn't set a preference
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? DARK : LIGHT);
      }
    });
  }

  init();
})();
