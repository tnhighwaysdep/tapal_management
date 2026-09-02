// =============================================================================
// TAPAL CHASE - Government Portal Theme & Accessibility Utility Engine
// Manages Dark/Light theme toggle, text size resizer, live Indian date,
// and accessible portal utility bar features.
// =============================================================================

(function() {
  'use strict';

  // 1. Theme Management Functions
  function getStoredTheme() {
    try {
      return localStorage.getItem('tapal_theme') || 'light';
    } catch (e) {
      return 'light';
    }
  }

  function setGovTheme(theme) {
    const validTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', validTheme);
    try {
      localStorage.setItem('tapal_theme', validTheme);
    } catch (e) {}
    updateGovThemeUI(validTheme);
  }

  function toggleGovTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    setGovTheme(nextTheme);
  }

  function updateGovThemeUI(theme) {
    const themeButtons = document.querySelectorAll('.gov-theme-toggle-btn');
    themeButtons.forEach(btn => {
      const icon = btn.querySelector('.theme-toggle-icon') || btn.querySelector('i');
      const label = btn.querySelector('.theme-toggle-text') || btn.querySelector('span');
      if (icon) {
        icon.className = theme === 'dark' ? 'ri-sun-fill' : 'ri-moon-fill';
      }
      if (label) {
        label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
      }
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme');
    });
  }

  // 2. Text Resizer Functions (GIGW Compliant A- A A+)
  function setGovFontSize(size) {
    const sizes = { sm: '14px', md: '16px', lg: '18px' };
    const targetSize = sizes[size] || '16px';
    document.documentElement.style.fontSize = targetSize;
    try {
      localStorage.setItem('tapal_font_size', size);
    } catch (e) {}

    const resizerBtns = document.querySelectorAll('.gov-resizer-btn');
    resizerBtns.forEach(btn => {
      if (btn.getAttribute('data-size') === size) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // 3. Live Indian Standard Date Formatter
  function updateGovLiveDate() {
    const dateEls = document.querySelectorAll('.gov-live-date');
    if (dateEls.length === 0) return;
    const now = new Date();
    const options = { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' };
    const formatted = now.toLocaleDateString('en-IN', options);
    dateEls.forEach(el => {
      el.textContent = formatted;
    });
  }

  // 4. Breadcrumb Synchronizer
  function updateBreadcrumb(tabName) {
    const el = document.getElementById('breadcrumb-active-title');
    if (el && tabName) {
      el.textContent = tabName;
    }
  }

  // Expose to window for inline onclick handlers & cross-module calls
  window.toggleGovTheme = toggleGovTheme;
  window.setGovTheme = setGovTheme;
  window.setGovFontSize = setGovFontSize;
  window.updateGovThemeUI = updateGovThemeUI;
  window.updateGovBreadcrumb = updateBreadcrumb;

  // Initialize on DOM Ready
  function initPortalTheme() {
    const initialTheme = getStoredTheme();
    setGovTheme(initialTheme);

    let savedFontSize = 'md';
    try {
      savedFontSize = localStorage.getItem('tapal_font_size') || 'md';
    } catch (e) {}
    setGovFontSize(savedFontSize);

    updateGovLiveDate();

    // Bind click handlers to any theme toggle or resizer buttons in DOM
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.gov-theme-toggle-btn');
      if (toggleBtn) {
        e.preventDefault();
        toggleGovTheme();
      }

      const resizerBtn = e.target.closest('.gov-resizer-btn');
      if (resizerBtn) {
        e.preventDefault();
        const size = resizerBtn.getAttribute('data-size') || 'md';
        setGovFontSize(size);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortalTheme);
  } else {
    initPortalTheme();
  }
})();
