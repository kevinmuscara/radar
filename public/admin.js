const state = {
  isSuperAdmin: false,
  role: 'superadmin',
  categories: [],
  resources: [],
  announcements: [],
  users: [],
  errors: [],
  editContext: null,
  deleteAction: null,
  deleteLabel: '',
  apiExplorerTarget: null,
  apiSelectedField: null,
  tableState: {}
};

const modals = {
  categories: 'modal-categories',
  resources: 'modal-resources',
  'api-explorer': 'modal-api-explorer',
  announcements: 'modal-announcements',
  credentials: 'modal-credentials',
  bulkimport: 'modal-bulkimport',
  'edit-categories': 'modal-edit-categories',
  'edit-resources': 'modal-edit-resources',
  'edit-announcements': 'modal-edit-announcements',
  'edit-credentials': 'modal-edit-credentials',
  'delete-confirm': 'modal-delete-confirm'
};

let modalStackZIndex = 60;

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function getSelectedValues(selector) {
  const element = qs(selector);
  if (!element) return [];

  if (element.tagName === 'SELECT') {
    return Array.from(element.selectedOptions || [])
      .map((option) => String(option.value || '').trim())
      .filter(Boolean);
  }

  const checked = qsa('input[type="checkbox"]:checked', element);
  return checked
    .map((input) => String(input.value || '').trim())
    .filter(Boolean);
}

function setCheckedValues(selector, values) {
  const element = qs(selector);
  if (!element) return;
  const selectedValues = new Set((values || []).map((value) => String(value || '').trim()));
  qsa('input[type="checkbox"]', element).forEach((input) => {
    input.checked = selectedValues.has(String(input.value || '').trim());
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toApiCheckType(uiType) {
  const map = {
    heartbeat: 'heartbeat',
    'web-scraping': 'scrape',
    'icmp-ping': 'icmp',
    'api-check': 'api'
  };
  return map[uiType] || 'api';
}

function toUiCheckType(apiType) {
  const map = {
    heartbeat: 'heartbeat',
    scrape: 'web-scraping',
    icmp: 'icmp-ping',
    api: 'api-check'
  };
  return map[apiType] || 'api-check';
}

function toUiRole(role) {
  if (role === 'superadmin') return 'Admin';
  if (role === 'resource_manager') return 'Role Manager';
  return role || 'Role Manager';
}

function toApiRole(uiRole) {
  if (uiRole === 'Admin' || uiRole === 'Super Admin') return 'superadmin';
  if (uiRole === 'Role Manager' || uiRole === 'Operations') return 'resource_manager';
  return null;
}

function toAnnouncementType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = new Set(['informative', 'warning', 'danger', 'success']);
  return allowed.has(normalized) ? normalized : 'informative';
}

function announcementTypeMeta(value) {
  const type = toAnnouncementType(value);
  if (type === 'warning') return { type, label: 'Warning', badge: 'bg-amber-100 text-amber-800 border-amber-300' };
  if (type === 'danger') return { type, label: 'Danger', badge: 'bg-red-100 text-red-800 border-red-300' };
  if (type === 'success') return { type, label: 'Success', badge: 'bg-green-100 text-green-800 border-green-300' };
  return { type, label: 'Informative', badge: 'bg-blue-100 text-blue-800 border-blue-300' };
}

function toDateTimeLocalValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const normalized = text.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[1]}T${match[2]}:${match[3]}` : '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toAnnouncementExpiresAt(inputValue) {
  const text = String(inputValue || '').trim();
  if (!text) return '';

  const dateOnly = text.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateOnly) return `${text}T23:59:00`;

  const dateTime = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateTime) return '';

  const [, datePart, hourPart, minutePart, secondPart] = dateTime;
  return `${datePart}T${hourPart}:${minutePart}:${secondPart || '00'}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.message || `Request failed (${response.status})`);
  }
  return body;
}

function showModal(alias) {
  const id = modals[alias] || alias;
  const modal = document.getElementById(id);
  if (!modal) return;
  modalStackZIndex += 1;
  modal.style.zIndex = String(modalStackZIndex);
  modal.style.display = 'flex';
  void modal.offsetWidth;
  const content = qs('.modal-content', modal);
  modal.classList.remove('exiting');
  content && content.classList.remove('exiting');
  modal.classList.add('entering');
  content && content.classList.add('entering');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    modal.classList.remove('entering');
    content && content.classList.remove('entering');
  }, 350);
}

function closeModal(alias) {
  const id = modals[alias] || alias;
  const modal = document.getElementById(id);
  if (!modal) return;
  const content = qs('.modal-content', modal);
  modal.classList.remove('entering');
  content && content.classList.remove('entering');
  modal.classList.add('exiting');
  content && content.classList.add('exiting');
  setTimeout(() => {
    modal.style.display = 'none';
    modal.style.zIndex = '';
    modal.classList.remove('exiting');
    content && content.classList.remove('exiting');
    const anyOpen = qsa('.modal-overlay').some((item) => item.style.display === 'flex');
    if (!anyOpen) {
      document.body.style.overflow = '';
      modalStackZIndex = 60;
    }
  }, 230);
}

function initTabs() {
  const tabs = qsa('[role="tab"]');
  const panels = qsa('[role="tabpanel"]');

  function setActiveTab(tab, updateUrl = false) {
    if (!tab) return;
    tabs.forEach((item) => {
      const active = item === tab;
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      item.classList.toggle('border-black', active);
      item.classList.toggle('bg-blue-50', active);
      item.classList.toggle('text-black', active);
      item.classList.toggle('border-transparent', !active);
    });

    const activePanelId = tab.getAttribute('aria-controls');
    panels.forEach((panel) => {
      const active = panel.id === activePanelId;
      panel.hidden = !active;
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) {
        panel.classList.remove('tab-panel-enter');
        void panel.offsetWidth;
        panel.classList.add('tab-panel-enter');
      } else {
        panel.classList.remove('tab-panel-enter');
      }
    });

    if (updateUrl) {
      const key = tab.getAttribute('data-tab');
      if (!key) return;
      const url = new URL(window.location.href);
      url.searchParams.set('tab', key);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => setActiveTab(tab, true)));

  const tabParam = new URLSearchParams(window.location.search).get('tab');
  const tabFromUrl = tabs.find((tab) => tab.getAttribute('data-tab') === tabParam);
  setActiveTab(tabFromUrl || tabs[0], false);
}

function initEnhancedTables() {
  qsa('[data-enhanced-table]').forEach((table) => {
    const tableId = table.getAttribute('data-enhanced-table');
    if (!tableId) return;

    if (!state.tableState[tableId]) {
      state.tableState[tableId] = { currentPage: 1 };

      const search = qs(`[data-table-search="${tableId}"]`);
      const filter = qs(`[data-table-filter="${tableId}"]`);
      const prev = qs(`[data-table-prev="${tableId}"]`);
      const next = qs(`[data-table-next="${tableId}"]`);

      const clearSearchFeedback = () => {
        if (!search) return;
        search.classList.remove('search-shake', 'search-no-results');
      };

      const applyNoResultsSearchFeedback = (animate = false) => {
        if (!search) return;

        search.classList.remove('search-shake', 'search-no-results');
        if (animate) {
          void search.offsetWidth;
          search.classList.add('search-shake');
          search.addEventListener('animationend', (event) => {
            if (event.animationName === 'search-shake') {
              search.classList.remove('search-shake');
            }
          }, { once: true });
        }

        search.classList.add('search-no-results');
      };

      search && search.addEventListener('input', () => {
        state.tableState[tableId].currentPage = 1;
        renderEnhancedTable(tableId, { animateSearchOnNoResults: true });
      });

      filter && filter.addEventListener('change', () => {
        state.tableState[tableId].currentPage = 1;
        clearSearchFeedback();
        renderEnhancedTable(tableId);
      });

      prev && prev.addEventListener('click', () => {
        const data = state.tableState[tableId];
        if (data.currentPage > 1) {
          data.currentPage -= 1;
          renderEnhancedTable(tableId);
        }
      });

      next && next.addEventListener('click', () => {
        const data = state.tableState[tableId];
        data.currentPage += 1;
        renderEnhancedTable(tableId);
      });

      state.tableState[tableId].searchFeedback = {
        clear: clearSearchFeedback,
        applyNoResults: applyNoResultsSearchFeedback
      };
    }

    renderEnhancedTable(tableId);
  });
}

function renderEnhancedTable(tableId, options = {}) {
  const { animateSearchOnNoResults = false } = options;
  const table = qs(`[data-enhanced-table="${tableId}"]`);
  if (!table || !table.tBodies[0]) return;

  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const pageSize = Number(table.getAttribute('data-page-size')) || 10;
  const search = qs(`[data-table-search="${tableId}"]`);
  const filter = qs(`[data-table-filter="${tableId}"]`);
  const status = qs(`[data-table-status="${tableId}"]`);
  const pages = qs(`[data-table-pages="${tableId}"]`);
  const prev = qs(`[data-table-prev="${tableId}"]`);
  const next = qs(`[data-table-next="${tableId}"]`);

  const query = String(search?.value || '').trim().toLowerCase();
  const selected = String(filter?.value || '').trim();

  const filtered = rows.filter((row) => {
    const text = row.textContent.toLowerCase();
    const filterCell = row.children[2] ? row.children[2].textContent.trim() : '';
    const filterValues = filterCell.split(',').map((value) => value.trim()).filter(Boolean);
    const queryOk = !query || text.includes(query);
    const filterOk = !selected || filterValues.includes(selected);
    return queryOk && filterOk;
  });

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const data = state.tableState[tableId];
  data.currentPage = Math.min(Math.max(1, data.currentPage), totalPages);

  const hasQuery = Boolean(query);
  const hasNoSearchResults = hasQuery && totalRows === 0;
  if (data.searchFeedback) {
    if (hasNoSearchResults) {
      data.searchFeedback.applyNoResults(animateSearchOnNoResults);
    } else {
      data.searchFeedback.clear();
    }
  }

  rows.forEach((row) => {
    row.hidden = true;
  });

  const start = (data.currentPage - 1) * pageSize;
  const end = start + pageSize;
  filtered.slice(start, end).forEach((row) => {
    row.hidden = false;
  });

  if (status) {
    if (totalRows === 0) {
      status.textContent = 'No matching results';
    } else {
      status.textContent = `Showing ${start + 1}-${Math.min(end, totalRows)} of ${totalRows}`;
    }
  }

  if (prev) prev.disabled = data.currentPage === 1 || totalRows === 0;
  if (next) next.disabled = data.currentPage >= totalPages || totalRows === 0;

  if (pages) {
    pages.innerHTML = '';

    const buildPageWindow = () => {
      const maxVisiblePageNumbers = 7;
      if (totalPages <= maxVisiblePageNumbers) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
      }

      const windowPages = [1];
      let start = Math.max(2, data.currentPage - 1);
      let end = Math.min(totalPages - 1, data.currentPage + 1);

      if (data.currentPage <= 4) {
        start = 2;
        end = 5;
      } else if (data.currentPage >= totalPages - 3) {
        start = totalPages - 4;
        end = totalPages - 1;
      }

      if (start > 2) windowPages.push('…');
      for (let page = start; page <= end; page += 1) {
        windowPages.push(page);
      }
      if (end < totalPages - 1) windowPages.push('…');

      windowPages.push(totalPages);
      return windowPages;
    };

    buildPageWindow().forEach((pageEntry) => {
      if (pageEntry === '…') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'inline-flex min-w-[20px] items-center justify-center px-1 text-sm text-gray-500';
        ellipsis.textContent = '…';
        pages.appendChild(ellipsis);
        return;
      }

      const page = Number(pageEntry);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(page);
      button.className = 'table-page-btn rounded border px-2.5 py-1.5 text-sm font-medium';
      if (page === data.currentPage) {
        button.classList.add('is-active', 'border-black', 'bg-blue-50', 'text-black');
      } else {
        button.classList.add('border-gray-300', 'text-gray-700');
      }
      button.disabled = totalRows === 0;
      button.addEventListener('click', () => {
        data.currentPage = page;
        renderEnhancedTable(tableId);
      });
      pages.appendChild(button);
    });
  }
}

function updateStats() {
  const cards = qsa('#setupCard .mt-6.grid.grid-cols-2.gap-4 > div');
  const resourcesCard = cards[0];
  const categoriesCard = cards[1];
  const usersCard = cards[2];
  const announcementsCard = cards[3];

  if (resourcesCard) {
    const value = qs('.text-3xl', resourcesCard);
    value && (value.textContent = String(state.resources.length));
  }
  if (categoriesCard) {
    const value = qs('.text-3xl', categoriesCard);
    value && (value.textContent = String(state.categories.length));
  }
  if (usersCard) {
    const value = qs('.text-3xl', usersCard);
    value && (value.textContent = state.isSuperAdmin ? String(state.users.length) : '--');
  }
  if (announcementsCard) {
    const value = qs('.text-3xl', announcementsCard);
    value && (value.textContent = String(state.announcements.length));
  }
}

function renderCategoryFilterOptions() {
  const select = qs('[data-table-filter="inventory-resources"]');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">All Categories</option>';
  [...new Set(state.resources.flatMap((item) => item.categories || []).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
  if (Array.from(select.options).some((o) => o.value === current)) {
    select.value = current;
  }
}

function renderResourceCategoryOptions() {
  const categoryOptions = state.categories
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((category) => `
      <label class="flex items-center gap-2 py-1.5">
        <input type="checkbox" class="h-4 w-4" value="${escapeHtml(category)}">
        <span>${escapeHtml(category)}</span>
      </label>
    `)
    .join('');

  const createWrap = qs('#resource-category-options');
  if (createWrap) {
    const current = getSelectedValues('#resource-category-options');
    createWrap.innerHTML = categoryOptions;
    setCheckedValues('#resource-category-options', current);
  }

  const editWrap = qs('#edit-resource-category-options');
  if (editWrap) {
    const current = getSelectedValues('#edit-resource-category-options');
    editWrap.innerHTML = categoryOptions;
    setCheckedValues('#edit-resource-category-options', current);
  }
}

function initializeCredentialRoleOptions() {
  const options = [
    { value: '', label: 'Select role' },
    { value: 'Admin', label: 'Admin' },
    { value: 'Role Manager', label: 'Role Manager' }
  ];

  const createSelect = qs('#user-role');
  if (createSelect) {
    const current = createSelect.value;
    createSelect.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
    createSelect.value = options.some((option) => option.value === current) ? current : '';
  }

  const editSelect = qs('#edit-user-role');
  if (editSelect) {
    const current = editSelect.value;
    editSelect.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
    editSelect.value = options.some((option) => option.value === current) ? current : '';
  }
}

function renderCategories() {
  const tbody = qs('[data-enhanced-table="staffing-directory"] tbody');
  if (!tbody) return;

  tbody.innerHTML = state.categories.map((category) => `
    <tr class="*:text-gray-900 *:first:font-medium">
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(category)}</td>
      <td class="px-3 py-2 whitespace-nowrap">
        <div class="flex items-center gap-2">
          <button type="button" aria-label="Edit ${escapeHtml(category)} category" class="edit-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-edit-type="category" data-edit-name="${escapeHtml(category)}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5"/></svg>
          </button>
          <button type="button" aria-label="Delete ${escapeHtml(category)} category" class="delete-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-delete-type="category" data-delete-item="${escapeHtml(category)}" data-category="${escapeHtml(category)}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.245-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderResources() {
  const tbody = qs('[data-enhanced-table="inventory-resources"] tbody');
  if (!tbody) return;

  tbody.innerHTML = state.resources.map((resource) => `
    <tr class="*:text-gray-900 *:first:font-medium">
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(resource.resource_name)}</td>
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(resource.status_page)}</td>
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml((resource.categories || []).join(', '))}</td>
      <td class="px-3 py-2 whitespace-nowrap">
        <div class="flex items-center gap-2">
          <button type="button" aria-label="Clear ${escapeHtml(resource.resource_name)}" class="rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-action="clear-issue" data-resource-name="${escapeHtml(resource.resource_name)}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364 6.364-1.06-1.06M6.697 6.697l-1.06-1.06m12.727 0-1.06 1.06M6.697 17.303l-1.06 1.06M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
          </button>
          <button type="button" aria-label="Edit ${escapeHtml(resource.resource_name)}" class="edit-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-edit-type="resource" data-edit-name="${escapeHtml(resource.resource_name)}" data-edit-url="${escapeHtml(resource.status_page)}" data-edit-category="${escapeHtml(resource.primaryCategory || '')}" data-edit-categories="${escapeHtml(JSON.stringify(resource.categories || []))}" data-edit-check-type="${escapeHtml(resource.check_type || 'api')}" data-edit-scrape-keywords="${escapeHtml(resource.scrape_keywords || '')}" data-edit-api-config="${escapeHtml(resource.api_config || '')}" data-edit-favicon="${escapeHtml(resource.favicon_url || '')}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5"/></svg>
          </button>
          <button type="button" aria-label="Delete ${escapeHtml(resource.resource_name)}" class="delete-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-delete-type="resource" data-delete-item="${escapeHtml(resource.resource_name)}" data-resource-name="${escapeHtml(resource.resource_name)}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.245-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAnnouncements() {
  const tbody = qs('[data-enhanced-table="operations-announcements"] tbody');
  if (!tbody) return;

  tbody.innerHTML = state.announcements.map((announcement) => {
    const typeMeta = announcementTypeMeta(announcement.type);
    const expiresDateTime = announcement.expires_at ? toDateTimeLocalValue(announcement.expires_at) : '';
    const expiresLabel = announcement.expires_at ? new Date(String(announcement.expires_at).replace(' ', 'T')).toLocaleString() : '';
    const createdBy = announcement.created_by ? `${announcement.created_by}${announcement.created_by_role ? ` (${announcement.created_by_role})` : ''}` : '-';

    return `
      <tr class="*:text-gray-900 *:first:font-medium">
        <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(announcement.message)}</td>
        <td class="px-3 py-2 whitespace-nowrap">
          <span class="inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${typeMeta.badge}">${escapeHtml(typeMeta.label)}</span>
        </td>
        <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(expiresLabel)}</td>
        <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(createdBy)}</td>
        <td class="px-3 py-2 whitespace-nowrap">
          <div class="flex items-center gap-2">
            <button type="button" aria-label="Edit announcement" class="edit-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-edit-type="announcement" data-edit-id="${announcement.id}" data-edit-message="${escapeHtml(announcement.message)}" data-edit-expires="${escapeHtml(expiresDateTime)}" data-edit-author="${escapeHtml(createdBy)}" data-edit-announcement-type="${escapeHtml(typeMeta.type)}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5"/></svg>
            </button>
            <button type="button" aria-label="Delete announcement" class="delete-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-delete-type="announcement" data-delete-item="announcement" data-announcement-id="${announcement.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.245-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderErrors() {
  const tbody = qs('[data-enhanced-table="operations-error-log"] tbody');
  if (!tbody) return;

  tbody.innerHTML = state.errors.map((error) => `
    <tr class="*:text-gray-900 *:first:font-medium">
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(new Date(error.created_at).toLocaleString())}</td>
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(error.resource_name || '')}</td>
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(error.check_type || '')}</td>
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(error.error_message || '')}</td>
      <td class="px-3 py-2 whitespace-nowrap">
        <div class="flex items-center gap-2">
          <button type="button" aria-label="Delete error" class="delete-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-delete-type="error" data-delete-item="error log" data-error-id="${error.id}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.245-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderUsers() {
  const tbody = qs('#panel-settings table tbody');
  if (!tbody) return;

  const rows = [];
  state.users.forEach((user) => {
    const isSuper = user.role === 'superadmin';
    rows.push(`
      <tr class="*:text-gray-900 *:first:font-medium">
        <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(user.username)}</td>
        <td class="px-3 py-2 whitespace-nowrap">••••••••</td>
        <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(toUiRole(user.role))}</td>
        <td class="px-3 py-2 whitespace-nowrap">
          <div class="flex items-center gap-2">
            <button type="button" aria-label="Edit ${escapeHtml(user.username)} credentials" class="edit-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-edit-type="credential" data-edit-username="${escapeHtml(user.username)}" data-edit-role="${escapeHtml(toUiRole(user.role))}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5"/></svg>
            </button>
            <button type="button" aria-label="Delete ${escapeHtml(user.username)} credentials" class="delete-btn-animated rounded border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100" data-delete-type="credential" data-delete-item="${escapeHtml(user.username)} user" data-username="${escapeHtml(user.username)}" ${isSuper ? 'disabled' : ''}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.245-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join('');
}

function refreshEmptyStates() {
  const map = {
    categories: 'staffing-directory',
    resources: 'inventory-resources',
    announcements: 'operations-announcements',
    credentials: null
  };

  Object.entries(map).forEach(([key, tableId]) => {
    const empty = qs(`[data-empty-state="${key}"]`);
    if (!empty) return;

    let hasRows = false;
    let wrapper = null;

    if (key === 'credentials') {
      const table = qs('#panel-settings table');
      wrapper = table ? table.closest('.max-h-80') : null;
      hasRows = !!(table && qsa('tbody tr', table).length > 0);
    } else {
      const table = qs(`[data-enhanced-table="${tableId}"]`);
      wrapper = table ? table.closest('.max-h-80') : null;
      hasRows = !!(table && qsa('tbody tr', table).length > 0);
    }

    if (wrapper) wrapper.style.display = hasRows ? '' : 'none';
    empty.style.display = hasRows ? 'none' : 'block';
  });
}

function renderAll() {
  renderCategories();
  renderResources();
  renderAnnouncements();
  state.isSuperAdmin && renderUsers();
  state.isSuperAdmin && renderErrors();
  renderCategoryFilterOptions();
  renderResourceCategoryOptions();
  initEnhancedTables();
  refreshEmptyStates();
  updateStats();
}

async function loadAllData() {
  const resourcesRes = await requestJson('/resources');
  const categoriesRes = await requestJson('/resources/categories');
  const announcementsRes = await requestJson('/resources/announcements');

  const resourceMap = new Map();
  Object.entries(resourcesRes.resources || {}).forEach(([category, list]) => {
    (list || []).forEach((resource) => {
      if (!resource || !resource.resource_name) return;
      if (!resourceMap.has(resource.resource_name)) {
        resourceMap.set(resource.resource_name, {
          resource_name: resource.resource_name,
          status_page: resource.status_page || '',
          favicon_url: resource.favicon_url || '',
          check_type: resource.check_type || 'api',
          scrape_keywords: resource.scrape_keywords || '',
          api_config: resource.api_config || '',
          categories: []
        });
      }
      const item = resourceMap.get(resource.resource_name);
      if (!item.categories.includes(category)) item.categories.push(category);
      item.primaryCategory = item.categories[0] || category;
    });
  });

  state.resources = Array.from(resourceMap.values()).sort((a, b) => a.resource_name.localeCompare(b.resource_name));
  state.categories = (categoriesRes.categories || []).slice().sort((a, b) => a.localeCompare(b));
  state.announcements = (announcementsRes.announcements || []).slice();

  if (state.isSuperAdmin) {
    const [usersRes, errorsRes] = await Promise.allSettled([
      requestJson('/setup/users'),
      requestJson('/resources/errors')
    ]);
    state.users = usersRes.status === 'fulfilled' ? (usersRes.value.users || []) : [];
    state.errors = errorsRes.status === 'fulfilled' ? (errorsRes.value.errors || []) : [];
  } else {
    state.users = [];
    state.errors = [];
  }

  renderAll();
}

function updateResourceCheckSections() {
  const createType = qs('#resource-check-type');
  const createScrape = qs('#resource-scrape-keywords-wrap');
  const createApi = qs('#resource-api-check-wrap');
  if (createType && createScrape && createApi) {
    createScrape.style.display = createType.value === 'web-scraping' ? 'block' : 'none';
    createApi.style.display = createType.value === 'api-check' ? 'block' : 'none';
  }

  const editType = qs('#edit-resource-check-type');
  const editScrape = qs('#edit-resource-scrape-keywords-wrap');
  const editApi = qs('#edit-resource-api-check-wrap');
  if (editType && editScrape && editApi) {
    editScrape.style.display = editType.value === 'web-scraping' ? 'block' : 'none';
    editApi.style.display = editType.value === 'api-check' ? 'block' : 'none';
  }
}

function bindModalTriggers() {
  qsa('[data-open-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      const modal = button.getAttribute('data-open-modal');
      const apiTarget = button.getAttribute('data-api-target');
      if (apiTarget) {
        state.apiExplorerTarget = apiTarget;
      }
      if (modal === 'api-explorer') {
        const sourceUrl = state.apiExplorerTarget === 'edit-resource-api-mapped-field'
          ? qs('#edit-resource-url')?.value
          : qs('#resource-url')?.value;
        const urlInput = qs('#api-explorer-url');
        if (urlInput && sourceUrl) urlInput.value = sourceUrl;
        resetApiExplorerState();
      }
      if (modal === 'resources' || modal === 'edit-resources') {
        updateResourceCheckSections();
      }
      showModal(modal);
    });
  });

  qsa('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal(button.getAttribute('data-close-modal'));
    });
  });

  qsa('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        const key = Object.keys(modals).find((alias) => modals[alias] === modal.id);
        key && closeModal(key);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = qsa('.modal-overlay').find((modal) => modal.style.display === 'flex');
    if (!open) return;
    const key = Object.keys(modals).find((alias) => modals[alias] === open.id);
    key && closeModal(key);
  });
}

function setApiUseFieldEnabled(enabled) {
  const useFieldButton = qs('#api-explorer-use-field');
  if (!useFieldButton) return;
  useFieldButton.disabled = !enabled;
  useFieldButton.classList.toggle('opacity-50', !enabled);
  useFieldButton.classList.toggle('cursor-not-allowed', !enabled);
}

function setApiSelectedFieldPreview(path = '—', type = '—', value = '—') {
  const pathNode = qs('#api-selected-path');
  const typeNode = qs('#api-selected-type');
  const valueNode = qs('#api-selected-value');
  if (pathNode) pathNode.textContent = path;
  if (typeNode) typeNode.textContent = type;
  if (valueNode) valueNode.textContent = value;
}

function resetApiExplorerState() {
  const preview = qs('#modal-api-explorer [role="tree"]');
  if (preview) {
    preview.innerHTML = '<p class="rounded border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">No API data loaded yet. Enter a URL and click Analyze.</p>';
  }
  state.apiSelectedField = null;
  setApiSelectedFieldPreview();
  setApiUseFieldEnabled(false);
}

function initApiExplorer() {
  const analyzeButton = qs('#modal-api-explorer button[type="button"].rounded-lg.border.border-blue-600.bg-blue-600');
  const useFieldButton = qs('#api-explorer-use-field');

  resetApiExplorerState();

  analyzeButton && analyzeButton.addEventListener('click', async () => {
    const url = qs('#api-explorer-url')?.value?.trim();
    if (!url) return alert('API URL is required');

    try {
      const data = await requestJson('/api/analyze-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      renderApiTree(data.apiData);
      const firstPath = data.paths && data.paths[0];
      if (firstPath) {
        state.apiSelectedField = firstPath;
        setApiSelectedFieldPreview(
          firstPath.path,
          firstPath.type,
          String(firstPath.value ?? '')
        );
        setApiUseFieldEnabled(true);
      } else {
        state.apiSelectedField = null;
        setApiSelectedFieldPreview();
        setApiUseFieldEnabled(false);
      }
    } catch (error) {
      alert(error.message || 'Failed to analyze API');
    }
  });

  useFieldButton && useFieldButton.addEventListener('click', () => {
    const targetId = state.apiExplorerTarget || 'resource-api-mapped-field';
    const input = qs(`#${targetId}`);
    if (input && state.apiSelectedField?.path) {
      input.value = state.apiSelectedField.path;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeModal('api-explorer');
  });

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-tree-toggle]');
    if (toggle) {
      const targetId = toggle.getAttribute('data-tree-toggle');
      const node = qs(`#${targetId}`);
      if (!node) return;
      const isOpen = !node.classList.contains('hidden');
      node.classList.toggle('hidden', isOpen);
      toggle.setAttribute('aria-expanded', String(!isOpen));
      const icon = qs('[data-tree-icon]', toggle);
      icon && icon.classList.toggle('rotate-90', !isOpen);
      return;
    }

    const row = event.target.closest('.api-field-row');
    if (!row) return;

    qsa('.api-field-row').forEach((item) => item.classList.remove('bg-blue-50'));
    row.classList.add('bg-blue-50');

    state.apiSelectedField = {
      path: row.getAttribute('data-api-field-path') || '',
      type: row.getAttribute('data-api-field-type') || '',
      value: row.getAttribute('data-api-field-value') || ''
    };

    setApiSelectedFieldPreview(
      state.apiSelectedField.path,
      state.apiSelectedField.type,
      state.apiSelectedField.value
    );
    setApiUseFieldEnabled(Boolean(state.apiSelectedField.path));
  });
}

function renderApiTree(data) {
  const preview = qs('#modal-api-explorer [role="tree"]');
  if (!preview) return;

  let counter = 0;
  function nextId() {
    counter += 1;
    return `api-node-${counter}`;
  }

  function makeLeaf(path, value) {
    const type = Array.isArray(value) ? 'array' : typeof value;
    return `<div data-api-field-path="${escapeHtml(path)}" data-api-field-type="${escapeHtml(type)}" data-api-field-value="${escapeHtml(JSON.stringify(value))}" class="api-field-row cursor-pointer rounded px-2 py-1"><span class="text-gray-900">• ${escapeHtml(path.split('.').slice(-1)[0])}</span> <span class="text-green-700">${escapeHtml(type)}</span> ${escapeHtml(JSON.stringify(value))}</div>`;
  }

  function walk(value, path, depth = 0) {
    if (value === null || typeof value !== 'object') {
      return makeLeaf(path, value);
    }

    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item])
      : Object.entries(value);

    return entries.map(([key, child]) => {
      const childPath = path ? (Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`) : key;
      if (child && typeof child === 'object') {
        const id = nextId();
        const label = Array.isArray(child) ? `📁 ${key}` : `📁 ${key}`;
        const meta = Array.isArray(child) ? `Array[${child.length}]` : 'Object';
        return `
          <button type="button" data-tree-toggle="${id}" aria-expanded="false" class="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-gray-100">
            <span class="flex items-center gap-2">
              <svg data-tree-icon xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4 text-gray-500 transition-transform"><path fill-rule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L10.94 10 6.22 5.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>
              <span class="font-medium text-gray-900">${escapeHtml(label)}</span>
            </span>
            <span class="text-xs text-gray-500">${escapeHtml(meta)}</span>
          </button>
          <div id="${id}" class="hidden space-y-1.5" style="margin-left: ${Math.max(18, 24 - depth)}px; padding-left: 14px; border-left: 2px solid #e5e7eb;">
            ${walk(child, childPath, depth + 1)}
          </div>
        `;
      }
      return makeLeaf(childPath, child);
    }).join('');
  }

  preview.innerHTML = walk(data, '');
}

async function handleDelete(type, button) {
  if (type === 'category') {
    const category = button.getAttribute('data-category');
    await requestJson(`/resources/category/${encodeURIComponent(category)}`, { method: 'DELETE' });
    return;
  }

  if (type === 'resource') {
    const resourceName = button.getAttribute('data-resource-name');
    const tags = await requestJson(`/resources/tags/${encodeURIComponent(resourceName)}`);
    const categories = tags.categories || [];
    await Promise.all(categories.map((category) => requestJson(`/resources/category/${encodeURIComponent(category)}/${encodeURIComponent(resourceName)}`, { method: 'DELETE' })));
    return;
  }

  if (type === 'announcement') {
    const id = button.getAttribute('data-announcement-id');
    await requestJson(`/resources/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return;
  }

  if (type === 'credential') {
    const username = button.getAttribute('data-username');
    await requestJson(`/setup/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
    return;
  }

  if (type === 'error') {
    const id = button.getAttribute('data-error-id');
    await requestJson(`/resources/errors/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

function bindGlobalActions() {
  document.addEventListener('click', async (event) => {
    const editButton = event.target.closest('.edit-btn-animated');
    if (editButton) {
      const editType = editButton.getAttribute('data-edit-type');
      if (editType === 'category') {
        qs('#edit-category-name').value = editButton.getAttribute('data-edit-name') || '';
        state.editContext = { type: 'category', oldName: editButton.getAttribute('data-edit-name') || '' };
        showModal('edit-categories');
      }

      if (editType === 'resource') {
        qs('#edit-resource-name').value = editButton.getAttribute('data-edit-name') || '';
        qs('#edit-resource-url').value = editButton.getAttribute('data-edit-url') || '';
        if (qs('#edit-resource-category-options')) {
          let parsedCategories = [];
          const rawCategories = editButton.getAttribute('data-edit-categories') || '';
          if (rawCategories) {
            try {
              const decoded = JSON.parse(rawCategories);
              if (Array.isArray(decoded)) {
                parsedCategories = decoded.map((value) => String(value || '').trim()).filter(Boolean);
              }
            } catch (_error) {
            }
          }
          
          if (parsedCategories.length === 0) {
            const fallback = editButton.getAttribute('data-edit-category') || '';
            if (fallback) parsedCategories = [fallback];
          }
          
          setCheckedValues('#edit-resource-category-options', parsedCategories);
        }
        qs('#edit-resource-check-type').value = toUiCheckType(editButton.getAttribute('data-edit-check-type') || 'api');
        qs('#edit-resource-scrape-keywords').value = editButton.getAttribute('data-edit-scrape-keywords') || '';
        qs('#edit-resource-api-mapped-field').value = '';

        const configRaw = editButton.getAttribute('data-edit-api-config') || '';
        if (configRaw) {
          try {
            const parsed = JSON.parse(configRaw);
            if (parsed && parsed.fieldPath) {
              qs('#edit-resource-api-mapped-field').value = parsed.fieldPath;
            }
          } catch (_error) {
          }
        }

        state.editContext = {
          type: 'resource',
          oldName: editButton.getAttribute('data-edit-name') || '',
          oldCategory: editButton.getAttribute('data-edit-category') || ''
        };

        updateResourceCheckSections();
        showModal('edit-resources');
      }

      if (editType === 'announcement') {
        qs('#edit-announcement-message').value = editButton.getAttribute('data-edit-message') || '';
        qs('#edit-announcement-expires').value = editButton.getAttribute('data-edit-expires') || '';
        qs('#edit-announcement-type').value = toAnnouncementType(editButton.getAttribute('data-edit-announcement-type') || 'informative');
        state.editContext = {
          type: 'announcement',
          id: editButton.getAttribute('data-edit-id') || ''
        };
        showModal('edit-announcements');
      }

      if (editType === 'credential') {
        const selectedRole = editButton.getAttribute('data-edit-role') || 'Role Manager';
        qs('#edit-user-username').value = editButton.getAttribute('data-edit-username') || '';
        qs('#edit-user-password').value = '';
        qs('#edit-user-role').value = selectedRole;
        const roleSelect = qs('#edit-user-role');
        if (roleSelect) {
          const isSuperadminRow = selectedRole === 'Admin' || selectedRole === 'Super Admin';
          roleSelect.disabled = isSuperadminRow;
        }
        state.editContext = {
          type: 'credential',
          oldUsername: editButton.getAttribute('data-edit-username') || '',
          oldRole: selectedRole
        };
        showModal('edit-credentials');
      }
      return;
    }

    const clearIssue = event.target.closest('[data-action="clear-issue"]');
    if (clearIssue) {
      const name = clearIssue.getAttribute('data-resource-name');
      if (!name) return;
      try {
        await requestJson(`/resources/issue-reports/${encodeURIComponent(name)}`, { method: 'DELETE' });
        alert(`Cleared issue report state for ${name}`);
      } catch (error) {
        alert(error.message || 'Failed to clear issue state');
      }
      return;
    }

    const deleteButton = event.target.closest('.delete-btn-animated');
    if (deleteButton) {
      const type = deleteButton.getAttribute('data-delete-type');
      const item = deleteButton.getAttribute('data-delete-item') || 'item';
      state.deleteAction = async () => handleDelete(type, deleteButton);
      state.deleteLabel = item;
      qs('#delete-item-name').textContent = item;
      showModal('delete-confirm');
      return;
    }

    const refreshErrors = event.target.closest('button[aria-label="Manual refresh error log"]');
    if (refreshErrors && state.isSuperAdmin) {
      try {
        const data = await requestJson('/resources/errors');
        state.errors = data.errors || [];
        renderErrors();
        initEnhancedTables();
        refreshEmptyStates();
      } catch (error) {
        alert(error.message || 'Failed to load errors');
      }
      return;
    }

    const clearErrors = event.target.closest('button[aria-label="Delete all error logs"]');
    if (clearErrors && state.isSuperAdmin) {
      if (!confirm('Delete all error logs?')) return;
      try {
        await requestJson('/resources/errors', { method: 'DELETE' });
        state.errors = [];
        renderErrors();
        initEnhancedTables();
        refreshEmptyStates();
      } catch (error) {
        alert(error.message || 'Failed to clear errors');
      }
      return;
    }

    const exportButton = event.target.closest('#panel-resources button');
    if (exportButton && exportButton.textContent.trim().toLowerCase() === 'export') {
      window.location.href = '/resources/export';
    }
  });

  const confirmDelete = qs('#confirm-delete-action');
  confirmDelete && confirmDelete.addEventListener('click', async () => {
    if (!state.deleteAction) return;
    try {
      await state.deleteAction();
      closeModal('delete-confirm');
      state.deleteAction = null;
      await loadAllData();
    } catch (error) {
      alert(error.message || `Failed to delete ${state.deleteLabel}`);
    }
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read import file'));
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(text);
          const rows = Array.isArray(parsed) ? parsed : [];
          const data = rows.map((item) => ({
            category: item.category || item.categories || '',
            resource_name: item.resource_name || item.name || '',
            status_page: item.status_page || item.status_url || item.url || '',
            favicon_url: item.favicon_url || '',
            check_type: item.check_type || 'api',
            scrape_keywords: item.scrape_keywords || '',
            api_config: item.api_config || ''
          }));
          resolve(data);
          return;
        }

        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (!lines.length) {
          resolve([]);
          return;
        }

        const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
        const rows = lines.slice(1).map((line) => {
          const values = parseCsvLine(line);
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] ?? '';
          });
          return {
            category: row.category || row.categories || '',
            resource_name: row.resource_name || row.name || '',
            status_page: row.status_page || row.status_url || row.url || '',
            favicon_url: row.favicon_url || '',
            check_type: row.check_type || 'api',
            scrape_keywords: row.scrape_keywords || '',
            api_config: row.api_config || ''
          };
        });
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetBulkImportProgress() {
  const wrap = qs('#bulkimport-progress-wrap');
  const label = qs('#bulkimport-progress-label');
  const count = qs('#bulkimport-progress-count');
  const bar = qs('#bulkimport-progress-bar');
  const remaining = qs('#bulkimport-progress-remaining');

  if (wrap) wrap.classList.add('hidden');
  if (label) label.textContent = 'Import progress';
  if (count) count.textContent = '0 / 0';
  if (remaining) remaining.textContent = '0 resources remaining';
  if (bar) {
    bar.style.width = '0%';
    bar.setAttribute('aria-valuenow', '0');
  }
}

function setBulkImportProgress(job) {
  const wrap = qs('#bulkimport-progress-wrap');
  const label = qs('#bulkimport-progress-label');
  const count = qs('#bulkimport-progress-count');
  const bar = qs('#bulkimport-progress-bar');
  const remaining = qs('#bulkimport-progress-remaining');

  if (wrap) wrap.classList.remove('hidden');

  const total = Number(job?.total || 0);
  const processed = Number(job?.processed || 0);
  const left = Number(job?.remaining || 0);
  const progressPct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  if (label) label.textContent = job?.message || 'Importing resources';
  if (count) count.textContent = `${processed} / ${total}`;
  if (remaining) {
    const noun = left === 1 ? 'resource' : 'resources';
    remaining.textContent = `${left} ${noun} remaining to import`;
  }
  if (bar) {
    bar.style.width = `${progressPct}%`;
    bar.setAttribute('aria-valuenow', String(progressPct));
  }
}

function bindForms() {
  const formCategories = qs('#form-categories');
  formCategories && formCategories.addEventListener('submit', async (event) => {
    event.preventDefault();
    const category = qs('#category-name')?.value?.trim();
    if (!category) return alert('Category name is required');
    try {
      await requestJson('/resources/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      closeModal('categories');
      formCategories.reset();
      await loadAllData();
    } catch (error) {
      alert(error.message || 'Failed to create category');
    }
  });

  const formResources = qs('#form-resources');
  formResources && formResources.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = qs('#resource-name').value.trim();
    const url = qs('#resource-url').value.trim();
    const categories = getSelectedValues('#resource-category-options');
    const checkTypeValue = qs('#resource-check-type').value;
    const checkType = toApiCheckType(checkTypeValue);
    const scrapeKeywords = qs('#resource-scrape-keywords').value.trim();
    const fieldPath = qs('#resource-api-mapped-field').value.trim();

    if (!name || !url || categories.length === 0) return alert('Name, URL, and at least one category are required');
    if (!checkTypeValue) return alert('Check type is required');

    const payload = {
      resource_name: name,
      status_page: url,
      grade_level: categories[0],
      categories,
      check_type: checkType,
      scrape_keywords: scrapeKeywords,
      api_config: fieldPath && checkType === 'api' ? JSON.stringify({ fieldPath }) : null
    };

    try {
      await requestJson(`/resources/category/${encodeURIComponent(categories[0])}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      closeModal('resources');
      formResources.reset();
      updateResourceCheckSections();
      await loadAllData();
    } catch (error) {
      alert(error.message || 'Failed to create resource');
    }
  });

  const formEditCategories = qs('#form-edit-categories');
  formEditCategories && formEditCategories.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.editContext || state.editContext.type !== 'category') return;
    const newName = qs('#edit-category-name').value.trim();
    if (!newName) return alert('Category name is required');

    try {
      await requestJson(`/resources/category/${encodeURIComponent(state.editContext.oldName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCategory: newName })
      });
      closeModal('edit-categories');
      state.editContext = null;
      await loadAllData();
    } catch (error) {
      alert(error.message || 'Failed to update category');
    }
  });

  const formEditResources = qs('#form-edit-resources');
  formEditResources && formEditResources.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.editContext || state.editContext.type !== 'resource') return;

    const newName = qs('#edit-resource-name').value.trim();
    const newUrl = qs('#edit-resource-url').value.trim();
    const newCategories = getSelectedValues('#edit-resource-category-options');
    const checkTypeValue = qs('#edit-resource-check-type').value;
    const checkType = toApiCheckType(checkTypeValue);
    const scrapeKeywords = qs('#edit-resource-scrape-keywords').value.trim();
    const fieldPath = qs('#edit-resource-api-mapped-field').value.trim();

    if (!newName || !newUrl || newCategories.length === 0) return alert('Name, URL, and at least one category are required');
    if (!checkTypeValue) return alert('Check type is required');

    const payload = {
      resource_name: newName,
      status_page: newUrl,
      grade_level: newCategories[0],
      categories: newCategories,
      check_type: checkType,
      scrape_keywords: scrapeKeywords,
      api_config: fieldPath && checkType === 'api' ? JSON.stringify({ fieldPath }) : null
    };

    try {
      await requestJson(`/resources/category/${encodeURIComponent(state.editContext.oldCategory)}/${encodeURIComponent(state.editContext.oldName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      closeModal('edit-resources');
      state.editContext = null;
      await loadAllData();
    } catch (error) {
      alert(error.message || 'Failed to update resource');
    }
  });

  const formAnnouncements = qs('#form-announcements');
  formAnnouncements && formAnnouncements.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = qs('#announcement-message').value.trim();
    const inputValue = qs('#announcement-expires').value;
    const type = toAnnouncementType(qs('#announcement-type').value);
    const expiresAt = toAnnouncementExpiresAt(inputValue);
    if (!message || !expiresAt) return alert('Message and expiration date/time are required');

    try {
      await requestJson('/resources/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, expires_at: expiresAt, type })
      });
      closeModal('announcements');
      formAnnouncements.reset();
      await loadAllData();
    } catch (error) {
      alert(error.message || 'Failed to create announcement');
    }
  });

  const formEditAnnouncements = qs('#form-edit-announcements');
  formEditAnnouncements && formEditAnnouncements.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.editContext || state.editContext.type !== 'announcement') return;

    const message = qs('#edit-announcement-message').value.trim();
    const inputValue = qs('#edit-announcement-expires').value;
    const type = toAnnouncementType(qs('#edit-announcement-type').value);
    const expiresAt = toAnnouncementExpiresAt(inputValue);
    if (!message || !expiresAt) return alert('Message and expiration date/time are required');

    try {
      await requestJson(`/resources/announcements/${encodeURIComponent(state.editContext.id)}`, { method: 'DELETE' });
      await requestJson('/resources/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, expires_at: expiresAt, type })
      });
      closeModal('edit-announcements');
      state.editContext = null;
      await loadAllData();
    } catch (error) {
      alert(error.message || 'Failed to update announcement');
    }
  });

  const formCredentials = qs('#form-credentials');
  formCredentials && formCredentials.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = qs('#user-username').value.trim();
    const password = qs('#user-password').value;
    const role = qs('#user-role').value;
    const mappedRole = toApiRole(role);
    if (!mappedRole) return alert('Select a valid role');

    try {
      await requestJson('/setup/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: mappedRole })
      });
      closeModal('credentials');
      formCredentials.reset();
      await loadAllData();
    } catch (error) {
      alert(error.message || 'Failed to create user');
    }
  });

  const formEditCredentials = qs('#form-edit-credentials');
  formEditCredentials && formEditCredentials.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.editContext || state.editContext.type !== 'credential') return;

    const username = qs('#edit-user-username').value.trim();
    const password = qs('#edit-user-password').value;
    const role = qs('#edit-user-role').value;
    const oldRole = state.editContext.oldRole;
    const isSuperadminEdit = oldRole === 'Admin' || oldRole === 'Super Admin';

    if (isSuperadminEdit) {
      try {
        const formData = new FormData();
        const schoolName = qs('#school\\.name')?.value?.trim() || document.body.dataset.schoolName || '';
          const primaryColor = qs('#primary-color')?.value || document.body.dataset.primaryColor || '#6b7280';
        const refreshInterval = qs('#status-check-interval')?.value || document.body.dataset.refreshInterval || '30';
        formData.set('username', username);
        formData.set('password', password || '');
        formData.set('schoolName', schoolName);
          formData.set('primaryColor', primaryColor);
        formData.set('refreshInterval', refreshInterval);

        const response = await fetch('/setup/update', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to update superadmin credentials');

        closeModal('edit-credentials');
        state.editContext = null;
        await loadAllData();
      } catch (error) {
        alert(error.message || 'Failed to update superadmin credentials');
      }
      return;
    }

    const mappedRole = toApiRole(role);
    if (!mappedRole) return alert('Select a valid role');
    if (!password) return alert('Password is required when editing a user');

    try {
      await requestJson(`/setup/users/${encodeURIComponent(state.editContext.oldUsername)}`, { method: 'DELETE' });
      await requestJson('/setup/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: mappedRole })
      });
      closeModal('edit-credentials');
      state.editContext = null;
      await loadAllData();
    } catch (error) {
      alert(error.message || 'Failed to update user');
    }
  });

  const formBulkImport = qs('#form-bulkimport');
  formBulkImport && formBulkImport.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fileInput = qs('#bulkimport-file');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!file) return alert('Select a file to import');

    const submitButton = qs('button[form="form-bulkimport"][type="submit"]');

    try {
      resetBulkImportProgress();
      submitButton && (submitButton.disabled = true);

      const data = await parseImportFile(file);
      if (!data.length) return alert('No rows found in file');

      const start = await requestJson('/resources/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });

      const jobId = start.jobId;
      if (!jobId) throw new Error('Import job did not start correctly');

      let finished = false;
      while (!finished) {
        const modal = qs('#modal-bulkimport');
        if (modal && modal.style.display !== 'flex') {
          break;
        }

        const progress = await requestJson(`/resources/import/progress/${encodeURIComponent(jobId)}`);
        const job = progress.job || {};
        setBulkImportProgress(job);

        if (job.status === 'completed') {
          finished = true;
          closeModal('bulkimport');
          formBulkImport.reset();
          const display = qs('#file-name-display');
          display && display.classList.add('hidden');
          resetBulkImportProgress();
          await loadAllData();
          break;
        }

        if (job.status === 'failed') {
          throw new Error(job.error || 'Import failed');
        }

        await sleep(400);
      }
    } catch (error) {
      alert(error.message || 'Failed to import file');
    } finally {
      submitButton && (submitButton.disabled = false);
    }
  });

  const bulkInput = qs('#bulkimport-file');
  const fileNameWrap = qs('#file-name-display');
  const fileName = qs('#selected-file-name');
  bulkInput && bulkInput.addEventListener('change', () => {
    const file = bulkInput.files && bulkInput.files[0];
    if (!file) {
      fileNameWrap && fileNameWrap.classList.add('hidden');
      return;
    }
    fileName && (fileName.textContent = file.name);
    fileNameWrap && fileNameWrap.classList.remove('hidden');
  });

  const settingsForm = qs('#branding-settings-form');
  settingsForm && settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData();
    const schoolName = qs('#school\\.name')?.value?.trim() || document.body.dataset.schoolName || '';
    const primaryColor = qs('#primary-color')?.value || document.body.dataset.primaryColor || '#6b7280';
    const username = document.body.dataset.adminUsername || 'admin';
    const logo = qs('#school-logo')?.files?.[0];

    formData.set('username', username);
    formData.set('password', '');
    formData.set('schoolName', schoolName);
    formData.set('primaryColor', primaryColor);
    if (logo) formData.set('logo', logo);

    try {
      const response = await fetch('/setup/update', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Failed to update settings');
      window.location.reload();
    } catch (error) {
      alert(error.message || 'Failed to update settings');
    }
  });

  const intervalForm = qs('#status-interval-form');
  intervalForm && intervalForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const refreshInterval = String(qs('#status-check-interval')?.value || '').trim();

    if (!refreshInterval) {
      return alert('Interval (minutes) is required');
    }

    try {
      await requestJson('/setup/refresh-interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshInterval })
      });
      document.body.dataset.refreshInterval = refreshInterval;
      alert('Status check interval updated');
    } catch (error) {
      alert(error.message || 'Failed to update status check interval');
    }
  });
}

function applyRoleVisibility() {
  if (state.isSuperAdmin) return;

  const tabSettings = qs('#tab-settings');
  const panelSettings = qs('#panel-settings');
  tabSettings && (tabSettings.style.display = 'none');
  panelSettings && (panelSettings.style.display = 'none');

  const errorCard = qsa('#panel-operations .rounded.border.border-gray-300.bg-white').find((card) => {
    const title = qs('h3', card);
    return title && title.textContent.trim() === 'Error Log';
  });
  errorCard && (errorCard.style.display = 'none');
}

function bindManualCheck() {
  const button = qs('#manual-check-btn');
  if (!button) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    const old = button.textContent;
    button.textContent = 'Checking...';
    try {
      const res = await requestJson('/api/force-refresh', { method: 'POST' });
      alert(res.message || 'Status refresh started');
    } catch (error) {
      alert(error.message || 'Failed to trigger status check');
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  });
}

function initDefaultsFromServer() {
  const schoolName = document.body.dataset.schoolName || '';
  const interval = document.body.dataset.refreshInterval || '30';
  const brandingLogo = document.body.dataset.brandingLogo || '';
    const primaryColor = document.body.dataset.primaryColor || '#6b7280';
  const schoolInput = qs('#school\\.name');
  const intervalInput = qs('#status-check-interval');
  const uploadLabelText = qs('label[for="school-logo"] span.text-sm.font-medium.text-gray-700');
    const primaryColorInput = qs('#primary-color');
  const announcementExpiry = qs('#announcement-expires');
  const editAnnouncementExpiry = qs('#edit-announcement-expires');

  schoolInput && (schoolInput.value = schoolName);
  intervalInput && (intervalInput.value = interval);
  if (uploadLabelText && brandingLogo) {
    uploadLabelText.textContent = `Current logo: ${brandingLogo} (click to replace)`;
  }
  if (primaryColorInput) primaryColorInput.value = primaryColor;
  if (announcementExpiry) announcementExpiry.type = 'datetime-local';
  if (editAnnouncementExpiry) editAnnouncementExpiry.type = 'datetime-local';
}

async function init() {
  state.role = (document.body.dataset.role || 'superadmin').toLowerCase();
  state.isSuperAdmin = document.body.dataset.isSuperadmin === 'true' || state.role === 'superadmin';

  initTabs();
  bindModalTriggers();
  bindGlobalActions();
  bindForms();
  initApiExplorer();
  bindManualCheck();
  initDefaultsFromServer();
  initializeCredentialRoleOptions();
  updateResourceCheckSections();

  const createCheckType = qs('#resource-check-type');
  const editCheckType = qs('#edit-resource-check-type');
  createCheckType && createCheckType.addEventListener('change', updateResourceCheckSections);
  editCheckType && editCheckType.addEventListener('change', updateResourceCheckSections);

  applyRoleVisibility();

  try {
    await loadAllData();
  } catch (error) {
    console.error(error);
    alert(error.message || 'Failed to load admin data');
  }
}

document.addEventListener('DOMContentLoaded', init);
