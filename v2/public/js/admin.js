const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const tabPanels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

function setActiveTab(activeTab, { updateUrl = false } = {}) {
  if (!activeTab) {
    return;
  }

  tabs.forEach((tab) => {
    const isActive = tab === activeTab;
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.classList.toggle('border-black', isActive);
    tab.classList.toggle('bg-blue-50', isActive);
    tab.classList.toggle('text-black', isActive);
    tab.classList.toggle('border-transparent', !isActive);
  });

  const activePanelId = activeTab.getAttribute('aria-controls');

  tabPanels.forEach((panel) => {
    const isActive = panel.id === activePanelId;

    if (isActive) {
      panel.hidden = false;
      panel.setAttribute('aria-hidden', 'false');
      panel.classList.remove('tab-panel-enter');
      void panel.offsetWidth;
      panel.classList.add('tab-panel-enter');
    } else {
      panel.classList.remove('tab-panel-enter');
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    }
  });

  if (updateUrl) {
    const tabKey = activeTab.getAttribute('data-tab');

    if (tabKey) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => setActiveTab(tab, { updateUrl: true }));
});

const tabParam = new URLSearchParams(window.location.search).get('tab');
const tabFromUrl = tabs.find((tab) => tab.getAttribute('data-tab') === tabParam);
const initialTab = tabFromUrl || tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];

if (initialTab) {
  setActiveTab(initialTab);
}

const enhancedTables = Array.from(document.querySelectorAll('[data-enhanced-table]'));

function initEnhancedTable(table) {
  const tableId = table.getAttribute('data-enhanced-table');
  const tableBody = table.tBodies[0];

  if (!tableId || !tableBody) {
    return;
  }

  const allRows = Array.from(tableBody.querySelectorAll('tr'));
  const pageSize = Number(table.getAttribute('data-page-size')) || 5;
  const searchInput = document.querySelector(`[data-table-search="${tableId}"]`);
  const filterSelect = document.querySelector(`[data-table-filter="${tableId}"]`);
  const prevButton = document.querySelector(`[data-table-prev="${tableId}"]`);
  const nextButton = document.querySelector(`[data-table-next="${tableId}"]`);
  const pagesContainer = document.querySelector(`[data-table-pages="${tableId}"]`);
  const statusText = document.querySelector(`[data-table-status="${tableId}"]`);
  const clearSearchShake = () => {
    if (searchInput) {
      searchInput.classList.remove('search-shake', 'search-no-results');
    }
  };

  const triggerSearchShake = () => {
    if (!searchInput) {
      return;
    }

    searchInput.classList.remove('search-shake', 'search-no-results');
    void searchInput.offsetWidth;
    searchInput.classList.add('search-shake', 'search-no-results');
  };

  const getFilterValue = (row) => row.children[2]?.textContent.trim() || '';

  if (filterSelect) {
    const uniqueValues = Array.from(new Set(allRows.map(getFilterValue).filter(Boolean)));

    uniqueValues.sort((left, right) => left.localeCompare(right)).forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      filterSelect.appendChild(option);
    });
  }

  let currentPage = 1;
  let visibleRows = [...allRows];

  if (searchInput) {
    searchInput.addEventListener('animationend', (event) => {
      if (event.animationName === 'search-shake') {
        clearSearchShake();
      }
    });
  }

  function render() {
    const totalRows = visibleRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    currentPage = Math.min(currentPage, totalPages);

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    allRows.forEach((row) => {
      row.hidden = true;
    });

    visibleRows.slice(startIndex, endIndex).forEach((row) => {
      row.hidden = false;
    });

    if (statusText) {
      if (totalRows === 0) {
        statusText.textContent = 'No matching results';
      } else {
        statusText.textContent = `Showing ${startIndex + 1}-${Math.min(endIndex, totalRows)} of ${totalRows}`;
      }
    }

    if (prevButton) {
      prevButton.disabled = currentPage === 1 || totalRows === 0;
    }

    if (nextButton) {
      nextButton.disabled = currentPage >= totalPages || totalRows === 0;
    }

    if (pagesContainer) {
      pagesContainer.innerHTML = '';

      for (let page = 1; page <= totalPages; page += 1) {
        const pageButton = document.createElement('button');
        const isActive = page === currentPage;

        pageButton.type = 'button';
        pageButton.textContent = String(page);
        pageButton.className = 'table-page-btn rounded border px-2.5 py-1.5 text-sm font-medium';

        if (isActive) {
          pageButton.classList.add('is-active');
          pageButton.classList.add('border-black', 'bg-blue-50', 'text-black');
        } else {
          pageButton.classList.add('border-gray-300', 'text-gray-700');
        }

        pageButton.disabled = totalRows === 0;
        pageButton.addEventListener('click', () => {
          currentPage = page;
          render();
        });

        pagesContainer.appendChild(pageButton);
      }
    }
  }

  function applyFilters() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const selectedValue = filterSelect ? filterSelect.value : '';

    visibleRows = allRows.filter((row) => {
      const rowText = row.textContent.toLowerCase();
      const filterValue = getFilterValue(row);
      const queryMatch = !query || rowText.includes(query);
      const filterMatch = !selectedValue || filterValue === selectedValue;

      return queryMatch && filterMatch;
    });

    currentPage = 1;
    if (query && visibleRows.length === 0) {
      triggerSearchShake();
    } else {
      clearSearchShake();
    }
    render();
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', applyFilters);
  }

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        render();
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));

      if (currentPage < totalPages) {
        currentPage += 1;
        render();
      }
    });
  }

  applyFilters();
}

enhancedTables.forEach((table) => {
  initEnhancedTable(table);
});

// Modal Management
const modals = {
  categories: document.getElementById('modal-categories'),
  resources: document.getElementById('modal-resources'),
  'api-explorer': document.getElementById('modal-api-explorer'),
  announcements: document.getElementById('modal-announcements'),
  credentials: document.getElementById('modal-credentials'),
  bulkimport: document.getElementById('modal-bulkimport'),
  'edit-categories': document.getElementById('modal-edit-categories'),
  'edit-resources': document.getElementById('modal-edit-resources'),
  'edit-announcements': document.getElementById('modal-edit-announcements'),
  'edit-credentials': document.getElementById('modal-edit-credentials'),
  'delete-confirm': document.getElementById('modal-delete-confirm')
};

let currentDeleteButton = null;
let currentEditButton = null;
let currentApiTargetInputId = null;
let isFilteringApiTree = false;
let currentSelectedApiField = {
  path: 'page.url',
  type: 'string',
  value: 'https://status.clever.com'
};

function updateResourceCheckTypeSections() {
  const createCheckType = document.getElementById('resource-check-type');
  const createScrapeWrap = document.getElementById('resource-scrape-keywords-wrap');
  const createApiWrap = document.getElementById('resource-api-check-wrap');

  if (createCheckType && createScrapeWrap && createApiWrap) {
    createScrapeWrap.style.display = createCheckType.value === 'web-scraping' ? 'block' : 'none';
    createApiWrap.style.display = createCheckType.value === 'api-check' ? 'block' : 'none';
  }

  const editCheckType = document.getElementById('edit-resource-check-type');
  const editScrapeWrap = document.getElementById('edit-resource-scrape-keywords-wrap');
  const editApiWrap = document.getElementById('edit-resource-api-check-wrap');

  if (editCheckType && editScrapeWrap && editApiWrap) {
    editScrapeWrap.style.display = editCheckType.value === 'web-scraping' ? 'block' : 'none';
    editApiWrap.style.display = editCheckType.value === 'api-check' ? 'block' : 'none';
  }
}

function getApiExplorerPrefillUrl(apiTargetInputId) {
  const createUrlInput = document.getElementById('resource-url');
  const editUrlInput = document.getElementById('edit-resource-url');

  if (apiTargetInputId === 'resource-api-mapped-field') {
    return createUrlInput?.value?.trim() || '';
  }

  if (apiTargetInputId === 'edit-resource-api-mapped-field') {
    return editUrlInput?.value?.trim() || '';
  }

  return createUrlInput?.value?.trim() || editUrlInput?.value?.trim() || '';
}

// Open modal with animation
function openModal(modalId) {
  const modal = modals[modalId];
  if (!modal) return;

  modal.style.display = 'flex';
  // Force reflow
  void modal.offsetWidth;
  
  const overlay = modal;
  const content = modal.querySelector('.modal-content');
  
  overlay.classList.remove('exiting');
  content.classList.remove('exiting');
  overlay.classList.add('entering');
  content.classList.add('entering');

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Remove entering class after animation
  setTimeout(() => {
    overlay.classList.remove('entering');
    content.classList.remove('entering');
  }, 350);
}

// Close modal with animation
function closeModal(modalId) {
  const modal = modals[modalId];
  if (!modal) return;

  const overlay = modal;
  const content = modal.querySelector('.modal-content');
  
  overlay.classList.remove('entering');
  content.classList.remove('entering');
  overlay.classList.add('exiting');
  content.classList.add('exiting');

  // Hide after animation completes
  setTimeout(() => {
    modal.style.display = 'none';
    overlay.classList.remove('exiting');
    content.classList.remove('exiting');
    
    // Re-enable body scroll if no other modals are open
    const anyModalOpen = Object.values(modals).some(m => m && m.style.display === 'flex');
    if (!anyModalOpen) {
      document.body.style.overflow = '';
    }

    // Reset forms when closing creation modals
    if (modalId !== 'delete-confirm') {
      const form = modal.querySelector('form');
      if (form) {
        form.reset();
        updateResourceCheckTypeSections();
      }
    }
  }, 230);
}

// Plus button handlers (open creation modals)
document.querySelectorAll('[data-open-modal]').forEach(button => {
  button.addEventListener('click', (e) => {
    const modalId = button.getAttribute('data-open-modal');
    const apiTargetInputId = button.getAttribute('data-api-target');

    if (apiTargetInputId) {
      currentApiTargetInputId = apiTargetInputId;
    } else if (modalId === 'api-explorer') {
      currentApiTargetInputId = null;
    }

    if (modalId === 'api-explorer') {
      const apiExplorerUrlInput = document.getElementById('api-explorer-url');
      if (apiExplorerUrlInput) {
        apiExplorerUrlInput.value = getApiExplorerPrefillUrl(currentApiTargetInputId);
      }
      const apiSearchInputs = document.querySelectorAll('#modal-api-explorer input[type="search"]');
      apiSearchInputs.forEach((input) => {
        input.value = '';
      });
      applyApiTreeSearchFilter();
    }

    openModal(modalId);
  });
});

// Close button handlers
document.querySelectorAll('[data-close-modal]').forEach(button => {
  button.addEventListener('click', (e) => {
    const modalId = button.getAttribute('data-close-modal');
    closeModal(modalId);
  });
});

// Close modal when clicking on overlay (outside modal content)
Object.values(modals).forEach(modal => {
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const modalId = Object.keys(modals).find(key => modals[key] === modal);
        closeModal(modalId);
      }
    });
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModal = Object.entries(modals).find(([id, modal]) => modal && modal.style.display === 'flex');
    if (openModal) {
      closeModal(openModal[0]);
    }
  }
});

// API Explorer JSON tree mock accordion
function getApiTreeSearchTerms() {
  const apiSearchInputs = document.querySelectorAll('#modal-api-explorer input[type="search"]');
  const keyTerm = String(apiSearchInputs[0]?.value || '').trim().toLowerCase();
  const valueTerm = String(apiSearchInputs[1]?.value || '').trim().toLowerCase();
  return { keyTerm, valueTerm };
}

function matchesApiTreeTerm(value, term) {
  if (!term) return true;
  return String(value || '').toLowerCase().includes(term);
}

function showAllApiTree(container) {
  if (!container) return;

  Array.from(container.children).forEach((child) => {
    child.style.display = '';

    if (child.classList.contains('api-field-row')) {
      return;
    }

    if (child.matches('button[data-tree-toggle]')) {
      const targetId = child.getAttribute('data-tree-toggle');
      const targetNode = document.getElementById(targetId);
      if (targetNode) {
        targetNode.style.display = '';
        targetNode.classList.remove('hidden');
        showAllApiTree(targetNode);
      }

      child.setAttribute('aria-expanded', 'true');
      const icon = child.querySelector('[data-tree-icon]');
      if (icon) icon.classList.add('rotate-90');
      return;
    }

    if (child.id) {
      showAllApiTree(child);
    }
  });
}

function isApiTreeLeafMatch(node, keyTerm, valueTerm) {
  const path = String(node.getAttribute('data-api-field-path') || '');
  const key = path.split('.').pop() || path;
  const value = String(node.getAttribute('data-api-field-value') || '');
  return matchesApiTreeTerm(key, keyTerm) && matchesApiTreeTerm(value, valueTerm);
}

function containerHasApiTreeMatch(container, keyTerm, valueTerm) {
  if (!container) return false;

  let hasMatch = false;

  Array.from(container.children).forEach((child) => {
    if (child.classList.contains('api-field-row')) {
      hasMatch = hasMatch || isApiTreeLeafMatch(child, keyTerm, valueTerm);
      return;
    }

    if (child.matches('button[data-tree-toggle]')) {
      const keyMatches = matchesApiTreeTerm(child.textContent || '', keyTerm) && !valueTerm;
      const targetId = child.getAttribute('data-tree-toggle');
      const targetNode = document.getElementById(targetId);
      const nestedMatch = targetNode ? containerHasApiTreeMatch(targetNode, keyTerm, valueTerm) : false;
      hasMatch = hasMatch || keyMatches || nestedMatch;
      return;
    }

    const rowText = String(child.textContent || '');
    hasMatch = hasMatch || (matchesApiTreeTerm(rowText, keyTerm) && matchesApiTreeTerm(rowText, valueTerm));
  });

  return hasMatch;
}

function filterApiTreeContainer(container, keyTerm, valueTerm) {
  if (!container) return false;

  const hasDirectLeafMatch = Array.from(container.children).some((child) => {
    return child.classList.contains('api-field-row') && isApiTreeLeafMatch(child, keyTerm, valueTerm);
  });

  if (hasDirectLeafMatch) {
    showAllApiTree(container);
    return true;
  }

  let hasVisibleChild = false;

  Array.from(container.children).forEach((child) => {
    if (child.classList.contains('api-field-row')) {
      const isVisible = false;
      child.style.display = isVisible ? '' : 'none';
      hasVisibleChild = hasVisibleChild || isVisible;
      return;
    }

    if (child.matches('button[data-tree-toggle]')) {
      const targetId = child.getAttribute('data-tree-toggle');
      const targetNode = document.getElementById(targetId);
      const keyMatches = matchesApiTreeTerm(child.textContent || '', keyTerm) && !valueTerm;

      let childBranchVisible = false;
      if (targetNode) {
        childBranchVisible = filterApiTreeContainer(targetNode, keyTerm, valueTerm);
      }

      if (keyMatches && targetNode) {
        showAllApiTree(targetNode);
        childBranchVisible = true;
      }

      const shouldShow = childBranchVisible || keyMatches;
      child.style.display = shouldShow ? '' : 'none';

      if (targetNode) {
        targetNode.style.display = shouldShow ? '' : 'none';
        targetNode.classList.toggle('hidden', !shouldShow);
      }

      child.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
      const icon = child.querySelector('[data-tree-icon]');
      if (icon) {
        icon.classList.toggle('rotate-90', shouldShow);
      }

      hasVisibleChild = hasVisibleChild || shouldShow;
      return;
    }

    const rowText = String(child.textContent || '').toLowerCase();
    const isVisible = matchesApiTreeTerm(rowText, keyTerm) && matchesApiTreeTerm(rowText, valueTerm);
    child.style.display = isVisible ? '' : 'none';
    hasVisibleChild = hasVisibleChild || isVisible;
  });

  if (!hasVisibleChild) {
    hasVisibleChild = containerHasApiTreeMatch(container, keyTerm, valueTerm);
  }

  return hasVisibleChild;
}

function applyApiTreeSearchFilter() {
  const treeRoot = document.querySelector('#modal-api-explorer [role="tree"]');
  if (!treeRoot) return;

  const { keyTerm, valueTerm } = getApiTreeSearchTerms();
  isFilteringApiTree = Boolean(keyTerm || valueTerm);

  if (!isFilteringApiTree) {
    Array.from(treeRoot.querySelectorAll('*')).forEach((node) => {
      node.style.display = '';
    });
    return;
  }

  filterApiTreeContainer(treeRoot, keyTerm, valueTerm);
}

document.querySelectorAll('#modal-api-explorer input[type="search"]').forEach((input) => {
  input.addEventListener('input', applyApiTreeSearchFilter);
});

document.addEventListener('click', (e) => {
  const toggleButton = e.target.closest('[data-tree-toggle]');
  if (!toggleButton) return;

  if (isFilteringApiTree) {
    return;
  }

  const targetId = toggleButton.getAttribute('data-tree-toggle');
  const targetNode = document.getElementById(targetId);
  if (!targetNode) return;

  const isOpen = !targetNode.classList.contains('hidden');
  targetNode.classList.toggle('hidden', isOpen);
  toggleButton.setAttribute('aria-expanded', String(!isOpen));

  const icon = toggleButton.querySelector('[data-tree-icon]');
  if (icon) {
    icon.classList.toggle('rotate-90', !isOpen);
  }
});

document.addEventListener('click', (e) => {
  const fieldRow = e.target.closest('.api-field-row');
  if (!fieldRow) return;

  document.querySelectorAll('.api-field-row').forEach((row) => {
    row.classList.remove('bg-blue-50');
  });
  fieldRow.classList.add('bg-blue-50');

  currentSelectedApiField = {
    path: fieldRow.getAttribute('data-api-field-path') || '',
    type: fieldRow.getAttribute('data-api-field-type') || '',
    value: fieldRow.getAttribute('data-api-field-value') || ''
  };

  const pathElement = document.getElementById('api-selected-path');
  const typeElement = document.getElementById('api-selected-type');
  const valueElement = document.getElementById('api-selected-value');

  if (pathElement) pathElement.textContent = currentSelectedApiField.path;
  if (typeElement) typeElement.textContent = currentSelectedApiField.type;
  if (valueElement) valueElement.textContent = currentSelectedApiField.value;
});

const apiUseSelectedFieldButton = document.getElementById('api-explorer-use-field');
if (apiUseSelectedFieldButton) {
  apiUseSelectedFieldButton.addEventListener('click', () => {
    if (!currentApiTargetInputId) currentApiTargetInputId = 'resource-api-mapped-field';

    const targetInput = document.getElementById(currentApiTargetInputId);
    if (targetInput) {
      targetInput.value = currentSelectedApiField.path;
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    closeModal('api-explorer');
  });
}

const createCheckTypeSelect = document.getElementById('resource-check-type');
if (createCheckTypeSelect) {
  createCheckTypeSelect.addEventListener('change', updateResourceCheckTypeSections);
}

const editCheckTypeSelect = document.getElementById('edit-resource-check-type');
if (editCheckTypeSelect) {
  editCheckTypeSelect.addEventListener('change', updateResourceCheckTypeSections);
}

updateResourceCheckTypeSections();

// Empty State Management
function checkEmptyStates() {
  const tableMapping = {
    'categories': document.querySelector('[data-enhanced-table="staffing-directory"]'),
    'resources': document.querySelector('[data-enhanced-table="inventory-resources"]'),
    'announcements': document.querySelector('[data-enhanced-table="operations-announcements"]'),
    'credentials': document.querySelector('#panel-settings table')
  };

  Object.keys(tableMapping).forEach(key => {
    const table = tableMapping[key];
    const emptyState = document.querySelector(`[data-empty-state="${key}"]`);
    
    if (!table || !emptyState) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // Count all rows (including hidden ones from pagination)
    const allRows = tbody.querySelectorAll('tr');
    const hasRows = allRows.length > 0;

    // Get the table wrapper (parent of the table)
    const tableWrapper = table.closest('.overflow-auto');
    
    if (!hasRows) {
      // Hide table, show empty state
      if (tableWrapper) tableWrapper.style.display = 'none';
      emptyState.style.display = 'block';
      emptyState.classList.add('show');
    } else {
      // Show table, hide empty state
      if (tableWrapper) tableWrapper.style.display = '';
      emptyState.style.display = 'none';
      emptyState.classList.remove('show');
    }
  });
}

// Check empty states on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkEmptyStates);
} else {
  checkEmptyStates();
}

// Delete confirmation logic
document.querySelectorAll('.delete-btn-animated').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const itemName = button.getAttribute('data-delete-item');
    const itemType = button.getAttribute('data-delete-type');
    
    // Update modal content
    const itemNameElement = document.getElementById('delete-item-name');
    if (itemNameElement) {
      itemNameElement.textContent = itemName;
    }
    
    // Store reference to the button that triggered delete
    currentDeleteButton = button;
    
    // Open confirmation modal
    openModal('delete-confirm');
  });
});

// Edit button handlers
document.querySelectorAll('.edit-btn-animated').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const editType = button.getAttribute('data-edit-type');
    
    // Store reference to the button that triggered edit
    currentEditButton = button;
    
    // Populate the appropriate modal based on type
    if (editType === 'category') {
      const name = button.getAttribute('data-edit-name');
      document.getElementById('edit-category-name').value = name;
      openModal('edit-categories');
    } else if (editType === 'resource') {
      const name = button.getAttribute('data-edit-name');
      const url = button.getAttribute('data-edit-url');
      const category = button.getAttribute('data-edit-category');
      document.getElementById('edit-resource-name').value = name;
      document.getElementById('edit-resource-url').value = url;
      document.getElementById('edit-resource-category').value = category;
      openModal('edit-resources');
    } else if (editType === 'announcement') {
      const message = button.getAttribute('data-edit-message');
      const expires = button.getAttribute('data-edit-expires');
      document.getElementById('edit-announcement-message').value = message;
      document.getElementById('edit-announcement-expires').value = expires;
      openModal('edit-announcements');
    } else if (editType === 'credential') {
      const username = button.getAttribute('data-edit-username');
      const role = button.getAttribute('data-edit-role');
      document.getElementById('edit-user-username').value = username;
      document.getElementById('edit-user-password').value = '';
      document.getElementById('edit-user-role').value = role;
      openModal('edit-credentials');
    }
  });
});

// Confirm delete action
const confirmDeleteButton = document.getElementById('confirm-delete-action');
if (confirmDeleteButton) {
  confirmDeleteButton.addEventListener('click', () => {
    // Here you would normally make an API call to delete the item
    // For now, we'll just log it and close the modal
    
    if (currentDeleteButton) {
      const itemName = currentDeleteButton.getAttribute('data-delete-item');
      const itemType = currentDeleteButton.getAttribute('data-delete-type');
      const row = currentDeleteButton.closest('tr');
      
      console.log(`Deleting ${itemType}: ${itemName}`);
      
      // Optionally: Remove the row from the table (for visual demo)
      if (row) {
        row.style.transition = 'opacity 300ms, transform 300ms';
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
          row.remove();
          // Check if table is now empty after row removal
          checkEmptyStates();
        }, 300);
      }
    }
    
    // Reset and close
    currentDeleteButton = null;
    closeModal('delete-confirm');
  });
}

// Form submission handlers (prevent actual submission since this is just UI)
document.querySelectorAll('#form-categories, #form-resources, #form-announcements, #form-credentials').forEach(form => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    console.log('Form submitted:', form.id, data);
    
    // Close the modal
    const modalId = form.closest('.modal-overlay').id.replace('modal-', '');
    closeModal(modalId);
    
    // Show a success message (you could implement a toast notification here)
    alert(`${modalId.charAt(0).toUpperCase() + modalId.slice(1)} created successfully!`);
  });
});

// Edit form submission handlers
document.querySelectorAll('#form-edit-categories, #form-edit-resources, #form-edit-announcements, #form-edit-credentials').forEach(form => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    console.log('Edit form submitted:', form.id, data);
    
    // Update the table row with new data
    if (currentEditButton) {
      const row = currentEditButton.closest('tr');
      if (row) {
        const cells = row.querySelectorAll('td');
        
        // Update based on form type
        if (form.id === 'form-edit-categories') {
          cells[0].textContent = data['category-name'];
        } else if (form.id === 'form-edit-resources') {
          cells[0].textContent = data['resource-name'];
          cells[1].textContent = data['resource-url'];
          cells[2].textContent = data['resource-category'];
          // Update button data attributes
          currentEditButton.setAttribute('data-edit-name', data['resource-name']);
          currentEditButton.setAttribute('data-edit-url', data['resource-url']);
          currentEditButton.setAttribute('data-edit-category', data['resource-category']);
        } else if (form.id === 'form-edit-announcements') {
          cells[0].textContent = data['announcement-message'];
          const expiresDate = new Date(data['announcement-expires']);
          cells[1].textContent = expiresDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
          const existingAuthor = currentEditButton.getAttribute('data-edit-author') || cells[2].textContent;
          cells[2].textContent = existingAuthor;
          // Update button data attributes
          currentEditButton.setAttribute('data-edit-message', data['announcement-message']);
          currentEditButton.setAttribute('data-edit-expires', data['announcement-expires']);
          currentEditButton.setAttribute('data-edit-author', existingAuthor);
        } else if (form.id === 'form-edit-credentials') {
          cells[0].textContent = data['user-username'];
          // Password stays as ••••••••
          cells[2].textContent = data['user-role'];
          // Update button data attributes
          currentEditButton.setAttribute('data-edit-username', data['user-username']);
          currentEditButton.setAttribute('data-edit-role', data['user-role']);
        }
        
        // Add a subtle flash animation to show the row was updated
        row.style.transition = 'background-color 600ms ease';
        row.style.backgroundColor = '#dbeafe';
        setTimeout(() => {
          row.style.backgroundColor = '';
        }, 600);
      }
    }
    
    // Close the modal
    const modalId = form.closest('.modal-overlay').id.replace('modal-', '');
    closeModal(modalId);
    
    // Reset current edit button
    currentEditButton = null;
    
    // Show a success message
    const typeName = form.id.replace('form-edit-', '').replace('-', ' ');
    alert(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} updated successfully!`);
    
    // Check empty states after edit
    checkEmptyStates();
  });
});

// Bulk Import File Input Handler
const bulkImportFileInput = document.getElementById('bulkimport-file');
const fileNameDisplay = document.getElementById('file-name-display');
const selectedFileNameSpan = document.getElementById('selected-file-name');

if (bulkImportFileInput && fileNameDisplay && selectedFileNameSpan) {
  bulkImportFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFileNameSpan.textContent = file.name;
      fileNameDisplay.classList.remove('hidden');
    } else {
      fileNameDisplay.classList.add('hidden');
    }
  });
}
