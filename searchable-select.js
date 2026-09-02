// =============================================================================
// TAPAL CHASE - Universal Searchable Select / Combobox Engine
// Provides instant live search, keyboard navigation, and seamless 2-way sync
// for all dropdown elements across the entire application.
// =============================================================================

(function() {
  'use strict';

  // Active open dropdown tracker
  let activeOpenDropdown = null;

  // Cache the native original property descriptor BEFORE modifying prototype
  const originalSelectDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  if (originalSelectDescriptor && originalSelectDescriptor.get && originalSelectDescriptor.set) {
    Object.defineProperty(HTMLSelectElement.prototype, 'value', {
      get: function() {
        return originalSelectDescriptor.get.call(this);
      },
      set: function(val) {
        originalSelectDescriptor.set.call(this, val);
        if (this._searchableSelectInstance) {
          try {
            this._searchableSelectInstance.syncFromNative();
          } catch (e) {}
        }
      },
      configurable: true
    });
  }

  class SearchableSelect {
    constructor(selectEl) {
      if (!selectEl) return null;
      if (selectEl._searchableSelectInstance) {
        return selectEl._searchableSelectInstance;
      }

      this.selectEl = selectEl;
      this.selectEl._searchableSelectInstance = this;
      this.isOpen = false;
      this.highlightedIndex = -1;
      this.filteredOptions = [];

      this.init();
    }

    init() {
      if (!this.selectEl) return;

      // Create Container
      this.container = document.createElement('div');
      this.container.className = 'searchable-select-container';
      if (this.selectEl.id) {
        this.container.setAttribute('data-target-select', this.selectEl.id);
      }

      // Copy relevant style classes from original select
      if (this.selectEl.classList.contains('th-dropdown-select')) {
        this.container.classList.add('is-th-filter');
      }
      if (this.selectEl.classList.contains('whom-select')) {
        this.container.classList.add('is-whom-filter');
      }
      if (this.selectEl.classList.contains('filter-select')) {
        this.container.classList.add('is-filter-select');
      }

      // Preserve inline style hints if present
      if (this.selectEl.style.width && this.selectEl.style.width !== '100%') {
        this.container.style.width = this.selectEl.style.width;
      }
      if (this.selectEl.style.minWidth) {
        this.container.style.minWidth = this.selectEl.style.minWidth;
      }

      // Trigger Element
      this.trigger = document.createElement('div');
      this.trigger.className = 'searchable-select-trigger';
      this.trigger.tabIndex = 0;
      this.trigger.setAttribute('role', 'combobox');
      this.trigger.setAttribute('aria-haspopup', 'listbox');
      this.trigger.setAttribute('aria-expanded', 'false');

      this.labelSpan = document.createElement('span');
      this.labelSpan.className = 'searchable-select-label';

      this.iconEl = document.createElement('i');
      this.iconEl.className = 'ri-arrow-down-s-line searchable-select-arrow';

      this.trigger.appendChild(this.labelSpan);
      this.trigger.appendChild(this.iconEl);

      // Dropdown Panel
      this.dropdown = document.createElement('div');
      this.dropdown.className = 'searchable-select-dropdown';
      this.dropdown.style.display = 'none';

      // Search Box Header
      this.searchBox = document.createElement('div');
      this.searchBox.className = 'searchable-select-search-box';

      this.searchIcon = document.createElement('i');
      this.searchIcon.className = 'ri-search-line search-icon';

      this.searchInput = document.createElement('input');
      this.searchInput.type = 'text';
      this.searchInput.className = 'searchable-select-input';
      this.searchInput.placeholder = 'Type to search...';
      this.searchInput.autocomplete = 'off';
      this.searchInput.spellcheck = false;

      this.clearBtn = document.createElement('button');
      this.clearBtn.type = 'button';
      this.clearBtn.className = 'searchable-select-clear-btn';
      this.clearBtn.innerHTML = '&times;';
      this.clearBtn.title = 'Clear search';
      this.clearBtn.style.display = 'none';

      this.searchBox.appendChild(this.searchIcon);
      this.searchBox.appendChild(this.searchInput);
      this.searchBox.appendChild(this.clearBtn);

      // Options List
      this.optionsList = document.createElement('ul');
      this.optionsList.className = 'searchable-select-options';
      this.optionsList.setAttribute('role', 'listbox');

      // Empty State
      this.emptyEl = document.createElement('div');
      this.emptyEl.className = 'searchable-select-empty';
      this.emptyEl.innerHTML = '<i class="ri-search-eye-line"></i> No matching options';
      this.emptyEl.style.display = 'none';

      this.dropdown.appendChild(this.searchBox);
      this.dropdown.appendChild(this.optionsList);
      this.dropdown.appendChild(this.emptyEl);

      // Insert container directly after select element in DOM
      this.container.appendChild(this.trigger);
      if (this.selectEl.parentNode) {
        this.selectEl.parentNode.insertBefore(this.container, this.selectEl.nextSibling);
      }
      document.body.appendChild(this.dropdown);

      // Visually hide native select
      this.selectEl.classList.add('searchable-select-native-hidden');

      // Build options and sync initial label
      this.buildOptions();
      this.syncFromNative();

      // Bind Event Listeners
      this.bindEvents();

      // Observe DOM mutations on native select (e.g. innerHTML updates from cascading dropdowns)
      this.observer = new MutationObserver(() => {
        try {
          this.buildOptions();
          this.syncFromNative();
        } catch (e) {}
      });
      this.observer.observe(this.selectEl, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'required']
      });
    }

    buildOptions() {
      if (!this.selectEl) return;
      const rawOptions = Array.from(this.selectEl.options || []);
      this.optionsData = rawOptions.map(opt => {
        const text = opt ? (opt.textContent || opt.innerText || opt.text || opt.value || '').trim() : '';
        const value = opt ? (opt.value || '') : '';
        return {
          value: value,
          text: text,
          disabled: opt ? !!opt.disabled : false,
          isCustomAdd: value === '__ADD_NEW__',
          isManage: value === '__MANAGE_OPTIONS__',
          element: opt
        };
      });

      this.filterOptions(this.searchInput ? this.searchInput.value : '');
    }

    filterOptions(query) {
      if (!this.optionsList || !this.optionsData) return;
      const q = (query || '').trim().toLowerCase();
      this.optionsList.innerHTML = '';
      this.filteredOptions = [];
      this.highlightedIndex = -1;

      let matchCount = 0;

      this.optionsData.forEach((opt, idx) => {
        if (!opt) return;
        const optText = opt.text || '';
        const optVal = opt.value || '';
        const isAction = opt.isCustomAdd || opt.isManage;
        const matchesQuery = !q || isAction || optText.toLowerCase().includes(q) || optVal.toLowerCase().includes(q);

        if (matchesQuery) {
          const li = document.createElement('li');
          li.className = 'searchable-select-option';
          li.setAttribute('role', 'option');
          li.setAttribute('data-value', optVal);
          li.setAttribute('data-index', idx);

          const isSelected = this.selectEl && this.selectEl.value === optVal;
          if (isSelected) {
            li.classList.add('is-selected');
          }

          if (opt.isCustomAdd) {
            li.classList.add('is-action-add');
            li.innerHTML = `<i class="ri-add-circle-line option-icon"></i> <span>${this.escapeHtml(optText)}</span>`;
          } else if (opt.isManage) {
            li.classList.add('is-action-manage');
            li.innerHTML = `<i class="ri-delete-bin-line option-icon"></i> <span>${this.escapeHtml(optText)}</span>`;
          } else {
            const highlightedText = q ? this.highlightMatch(optText, q) : this.escapeHtml(optText);
            li.innerHTML = `
              <span class="option-text">${highlightedText}</span>
              ${isSelected ? '<i class="ri-check-line check-icon"></i>' : ''}
            `;
          }

          li.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectOption(optVal);
          });

          this.optionsList.appendChild(li);
          this.filteredOptions.push({ opt, element: li });
          if (!isAction) matchCount++;
        }
      });

      // Toggle empty message
      if (this.filteredOptions.length === 0 || (q && matchCount === 0 && !this.filteredOptions.some(f => !f.opt.isCustomAdd && !f.opt.isManage))) {
        this.emptyEl.style.display = 'block';
      } else {
        this.emptyEl.style.display = 'none';
      }

      // Auto highlight first matching item if search query active
      if (q && this.filteredOptions.length > 0) {
        this.highlightOption(0);
      }
    }

    highlightMatch(text, query) {
      if (!query) return this.escapeHtml(text);
      const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
      return this.escapeHtml(text).replace(regex, '<mark class="searchable-select-match">$1</mark>');
    }

    escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    highlightOption(index) {
      if (this.filteredOptions.length === 0) return;
      if (index < 0) index = 0;
      if (index >= this.filteredOptions.length) index = this.filteredOptions.length - 1;

      this.highlightedIndex = index;
      this.filteredOptions.forEach((item, idx) => {
        if (idx === index) {
          item.element.classList.add('is-highlighted');
          item.element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          item.element.classList.remove('is-highlighted');
        }
      });
    }

    selectOption(value) {
      if (this.selectEl.value !== value) {
        this.selectEl.value = value;
      }
      this.syncFromNative();

      // Dispatch native events for all application handlers to react
      this.selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      this.selectEl.dispatchEvent(new Event('change', { bubbles: true }));

      if (typeof this.selectEl.onchange === 'function') {
        this.selectEl.onchange(new Event('change'));
      }

      this.close();
      this.trigger.focus();
    }

    syncFromNative() {
      if (!this.selectEl || !this.labelSpan) return;
      const selectedOpt = this.selectEl.options && this.selectEl.selectedIndex >= 0
        ? this.selectEl.options[this.selectEl.selectedIndex]
        : null;
      const text = selectedOpt ? (selectedOpt.textContent || selectedOpt.innerText || selectedOpt.text || selectedOpt.value || '').trim() : '';
      this.labelSpan.textContent = text || this.selectEl.getAttribute('placeholder') || '-- Select --';
      this.labelSpan.title = text;

      // Update disabled state
      if (this.container) {
        if (this.selectEl.disabled) {
          this.container.classList.add('is-disabled');
          if (this.trigger) {
            this.trigger.setAttribute('aria-disabled', 'true');
            this.trigger.tabIndex = -1;
          }
        } else {
          this.container.classList.remove('is-disabled');
          if (this.trigger) {
            this.trigger.removeAttribute('aria-disabled');
            this.trigger.tabIndex = 0;
          }
        }
      }

      // Re-mark selected class in filtered list
      const val = this.selectEl.value;
      if (this.optionsList) {
        Array.from(this.optionsList.children).forEach(li => {
          if (li.getAttribute('data-value') === val) {
            li.classList.add('is-selected');
          } else {
            li.classList.remove('is-selected');
          }
        });
      }
    }

    open() {
      if (this.selectEl.disabled || this.isOpen) return;

      // Close any other open dropdown
      if (activeOpenDropdown && activeOpenDropdown !== this) {
        activeOpenDropdown.close();
      }

      this.isOpen = true;
      activeOpenDropdown = this;

      this.container.classList.add('is-open');
      this.trigger.setAttribute('aria-expanded', 'true');
      this.dropdown.style.display = 'flex';

      // Reset search filter
      this.searchInput.value = '';
      this.clearBtn.style.display = 'none';
      this.filterOptions('');

      // Position the floating dropdown
      this.positionDropdown();

      // Focus search input
      setTimeout(() => {
        this.searchInput.focus();
        const selectedLi = this.optionsList.querySelector('.is-selected');
        if (selectedLi) {
          selectedLi.scrollIntoView({ block: 'nearest' });
        }
      }, 50);
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      if (activeOpenDropdown === this) {
        activeOpenDropdown = null;
      }

      this.container.classList.remove('is-open');
      this.trigger.setAttribute('aria-expanded', 'false');
      this.dropdown.style.display = 'none';
      this.searchInput.value = '';
    }

    positionDropdown() {
      const rect = this.trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      const openUpwards = spaceBelow < 240 && spaceAbove > spaceBelow;

      const minWidth = Math.max(rect.width, 220);
      let left = rect.left;

      if (left + minWidth > viewportWidth - 10) {
        left = viewportWidth - minWidth - 10;
      }
      if (left < 10) left = 10;

      this.dropdown.style.position = 'fixed';
      this.dropdown.style.width = minWidth + 'px';
      this.dropdown.style.left = left + 'px';
      this.dropdown.style.zIndex = '999999';

      if (openUpwards) {
        this.dropdown.classList.add('is-drop-up');
        this.dropdown.style.top = 'auto';
        this.dropdown.style.bottom = (viewportHeight - rect.top + 4) + 'px';
      } else {
        this.dropdown.classList.remove('is-drop-up');
        this.dropdown.style.bottom = 'auto';
        this.dropdown.style.top = (rect.bottom + 4) + 'px';
      }
    }

    bindEvents() {
      // Trigger click & keyboard
      this.trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      });

      this.trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.open();
        }
      });

      // Search input typing
      this.searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        this.clearBtn.style.display = val ? 'block' : 'none';
        this.filterOptions(val);
      });

      // Clear button
      this.clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.searchInput.value = '';
        this.clearBtn.style.display = 'none';
        this.filterOptions('');
        this.searchInput.focus();
      });

      // Dropdown Keyboard navigation
      this.dropdown.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.highlightOption(this.highlightedIndex + 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.highlightOption(this.highlightedIndex - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredOptions.length) {
            this.selectOption(this.filteredOptions[this.highlightedIndex].opt.value);
          } else if (this.filteredOptions.length === 1) {
            this.selectOption(this.filteredOptions[0].opt.value);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
          this.trigger.focus();
        } else if (e.key === 'Tab') {
          this.close();
        }
      });

      // Stop propagation inside dropdown clicks
      this.dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      // Native select change event listener
      this.selectEl.addEventListener('change', () => {
        if (this.container) this.container.classList.remove('has-error');
        this.syncFromNative();
      });
      this.selectEl.addEventListener('input', () => {
        if (this.container) this.container.classList.remove('has-error');
        this.syncFromNative();
      });
    }
  }

  // Global helper functions
  window.makeSearchableSelect = function(selectEl) {
    if (!selectEl || selectEl.tagName !== 'SELECT') return null;
    if (selectEl.dataset.noSearchable === 'true') return null;
    if (selectEl._searchableSelectInstance) return selectEl._searchableSelectInstance;
    return new SearchableSelect(selectEl);
  };

  window.refreshSearchableSelect = function(selectEl) {
    if (selectEl && selectEl._searchableSelectInstance) {
      selectEl._searchableSelectInstance.buildOptions();
      selectEl._searchableSelectInstance.syncFromNative();
    }
  };

  window.initSearchableSelects = function(root = document) {
    const selects = root.querySelectorAll('select:not([data-no-searchable="true"])');
    selects.forEach(sel => {
      window.makeSearchableSelect(sel);
    });
  };

  // Close open dropdown on outside click or window resize
  document.addEventListener('click', (e) => {
    if (activeOpenDropdown) {
      if (!activeOpenDropdown.container.contains(e.target) && !activeOpenDropdown.dropdown.contains(e.target)) {
        activeOpenDropdown.close();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (activeOpenDropdown) {
      activeOpenDropdown.positionDropdown();
    }
  });

  window.addEventListener('scroll', () => {
    if (activeOpenDropdown) {
      activeOpenDropdown.positionDropdown();
    }
  }, true);

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.initSearchableSelects();
    });
  } else {
    window.initSearchableSelects();
  }

  // Observer for dynamically added selects (excluding already processed ones)
  const bodyObserver = new MutationObserver((mutations) => {
    let hasNewUnprocessedSelects = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          if (node.tagName === 'SELECT' && !node._searchableSelectInstance) {
            hasNewUnprocessedSelects = true;
            break;
          }
          if (node.querySelectorAll) {
            const innerSelects = node.querySelectorAll('select:not([data-no-searchable="true"])');
            for (const s of innerSelects) {
              if (!s._searchableSelectInstance) {
                hasNewUnprocessedSelects = true;
                break;
              }
            }
          }
        }
      }
      if (hasNewUnprocessedSelects) break;
    }
    if (hasNewUnprocessedSelects) {
      window.initSearchableSelects();
    }
  });

  if (document.body) {
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
