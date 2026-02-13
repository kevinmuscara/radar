async function addCategory() {
  const nameInput = document.getElementById('new-category-name');
  const category = nameInput ? nameInput.value.trim() : '';
  if (!category) return;

  try {
    const res = await fetch('/resources/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });
    if (res.ok) window.location.reload();
    else alert('Failed to add category');
  } catch (e) {
    console.error(e);
    alert('Error adding category');
  }
}

// Force refresh all statuses
document.addEventListener('DOMContentLoaded', () => {
  const forceRefreshBtn = document.getElementById('force-refresh-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  let progressInterval = null;

  // Function to update progress
  async function updateProgress() {
    try {
      const response = await fetch('/api/check-progress');
      const progress = await response.json();

      if (progress.isChecking) {
        // Show progress bar
        if (progressContainer) {
          progressContainer.classList.remove('hidden');
          if (progressBar) {
            progressBar.style.width = `${progress.percentage}%`;
          }
        }

        // Update button text
        if (forceRefreshBtn && progress.currentResourceName) {
          forceRefreshBtn.title = `Checking: ${progress.currentResourceName} (${progress.currentProgress}/${progress.totalResources})`;
        }
      } else {
        // Hide progress bar
        if (progressContainer) {
          progressContainer.classList.add('hidden');
        }
        
        // Reset button
        if (forceRefreshBtn) {
          forceRefreshBtn.title = 'Refresh All Statuses';
          forceRefreshBtn.disabled = false;
        }
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  }

  // Start polling for progress
  function startProgressPolling() {
    if (progressInterval) return;
    progressInterval = setInterval(updateProgress, 500); // Poll every 500ms
  }

  // Initial progress check
  updateProgress();
  startProgressPolling();

  if (forceRefreshBtn) {
    forceRefreshBtn.addEventListener('click', async () => {
      forceRefreshBtn.disabled = true;
      forceRefreshBtn.title = 'Refreshing...';

      try {
        const response = await fetch('/api/force-refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 429) {
          const data = await response.json();
          alert(data.message || 'Please wait before refreshing again');
          forceRefreshBtn.disabled = false;
        } else if (response.ok) {
          // Progress polling will handle the UI updates
          updateProgress();
        } else {
          alert('Failed to initiate refresh');
          forceRefreshBtn.disabled = false;
        }
      } catch (error) {
        console.error('Error forcing refresh:', error);
        alert('Error initiating refresh');
        forceRefreshBtn.disabled = false;
      }
    });
  }
});

async function updateCategory(oldCategory) {
  const newCategory = prompt("Enter new category name:", oldCategory);
  if (!newCategory || newCategory === oldCategory) return;

  try {
    const res = await fetch(`/resources/category/${encodeURIComponent(oldCategory)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newCategory })
    });
    if (res.ok) window.location.reload();
    else alert('Failed to update category');
  } catch (e) {
    console.error(e);
    alert('Error updating category');
  }
}

async function deleteCategory(category) {
  if (!confirm(`Are you sure you want to delete category "${category}"?`)) return;

  try {
    const res = await fetch(`/resources/category/${encodeURIComponent(category)}`, {
      method: 'DELETE'
    });
    if (res.ok) window.location.reload();
    else alert('Failed to delete category');
  } catch (e) {
    console.error(e);
    alert('Error deleting category');
  }
}

async function addResource(category, btn) {
  const row = btn.closest('tr');
  const name = row.querySelector('.new-res-name').value.trim();
  const url = row.querySelector('.new-res-url').value.trim();

  if (!name || !url) {
    alert('Please fill in both Name and URL');
    return;
  }

  try {
    const res = await fetch(`/resources/category/${encodeURIComponent(category)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_name: name,
        status_page: url,
        grade_level: category,
        check_type: 'api',
        scrape_keywords: ''
      })
    });
    if (res.ok) window.location.reload();
    else alert('Failed to add resource');
  } catch (e) {
    console.error(e);
    alert('Error adding resource');
  }
}

async function deleteResource(category, resourceName) {
  if (!confirm(`Delete resource "${resourceName}"?`)) return;

  try {
    const res = await fetch(`/resources/category/${encodeURIComponent(category)}/${encodeURIComponent(resourceName)}`, {
      method: 'DELETE'
    });
    if (res.ok) window.location.reload();
    else alert('Failed to delete resource');
  } catch (e) {
    console.error(e);
    alert('Error deleting resource');
  }
}

// Edit Modal Logic
async function editResource(name, url, faviconUrl = '') {
  document.getElementById('edit-original-name').value = name;
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-url').value = url;
  const editFaviconInput = document.getElementById('edit-favicon-url');
  if (editFaviconInput) editFaviconInput.value = faviconUrl || '';
  document.getElementById('edit-original-name').dataset.originalCategories = "";

  // Fetch and set categories
  const checkboxes = document.querySelectorAll('input[name="edit-categories"]');
  checkboxes.forEach(cb => cb.checked = false);

  try {
    const res = await fetch(`/resources/tags/${encodeURIComponent(name)}`);
    const data = await res.json();
    const categories = data.categories || [];
    document.getElementById('edit-original-name').dataset.originalCategories = JSON.stringify(categories);

    categories.forEach(cat => {
      const cb = document.getElementById(`edit-cat-${cat}`);
      if (cb) cb.checked = true;
    });
    // fetch definition (check_type, scrape_keywords, api_config)
    try {
      const defRes = await fetch(`/resources/definition/${encodeURIComponent(name)}`);
      if (defRes.ok) {
        const defData = await defRes.json();
        const def = defData.definition || defData.definition;
        if (def) {
          const ct = def.check_type || 'api';
          const sk = def.scrape_keywords || '';
          const apiConf = def.api_config || null;
          const fav = def.favicon_url || '';
          
          const sel = document.getElementById('edit-check-type');
          const inpt = document.getElementById('edit-scrape-keywords');
          const favInput = document.getElementById('edit-favicon-url');
          if (sel) sel.value = ct;
          if (inpt) inpt.value = sk;
          if (favInput) favInput.value = fav;

          // Show/hide analyze button based on check type
          updateAnalyzeButtonVisibility('edit');

          // Load API config if exists
          if (apiConf && ct === 'api') {
            try {
              editApiConfig = JSON.parse(apiConf);
              // Show a message that config is loaded
              const configSection = document.getElementById('edit-api-config-section');
              const fieldsEl = document.getElementById('edit-api-fields');
              // Reset modal layout to single column initially
              const modalGrid = document.getElementById('edit-modal-grid');
              if (modalGrid) modalGrid.className = 'grid grid-cols-1 gap-6';
              
              if (configSection && fieldsEl) {
                configSection.classList.remove('hidden');
                fieldsEl.innerHTML = `<p class="text-sm text-green-600 font-medium">✓ API field configuration loaded: <span class="font-mono">${editApiConfig.fieldPath}</span></p>
                <p class="text-xs text-gray-500 mt-1">Click "Analyze" to reconfigure or keep the current setting.</p>`;
              }
            } catch (e) {
              console.error('Failed to parse API config', e);
            }
          } else {
            editApiConfig = null;
            // Reset modal layout to single column
            const modalGrid = document.getElementById('edit-modal-grid');
            if (modalGrid) modalGrid.className = 'grid grid-cols-1 gap-6';
          }
        }
      }
    } catch (e) {
      // ignore definition errors
      console.error('Failed to fetch definition', e);
    }
  } catch (e) {
    console.error("Failed to fetch tags", e);
  }

  document.getElementById('edit-modal').classList.remove('hidden');
}

// Delete a resource from all categories (global delete)
async function deleteResourceGlobal(resourceName) {
  if (!confirm(`Delete resource "${resourceName}" from all categories?`)) return;

  try {
    // fetch categories for resource
    const res = await fetch(`/resources/tags/${encodeURIComponent(resourceName)}`);
    const data = await res.json();
    const categories = data.categories || [];

    for (const cat of categories) {
      await fetch(`/resources/category/${encodeURIComponent(cat)}/${encodeURIComponent(resourceName)}`, {
        method: 'DELETE'
      });
    }

    window.location.reload();
  } catch (e) {
    console.error(e);
    alert('Failed to delete resource');
  }
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function saveEdit() {
  const originalName = document.getElementById('edit-original-name').value;
  const originalCategories = JSON.parse(document.getElementById('edit-original-name').dataset.originalCategories || "[]");
  const newName = document.getElementById('edit-name').value;
  const newUrl = document.getElementById('edit-url').value;
  const newFaviconUrl = document.getElementById('edit-favicon-url') ? document.getElementById('edit-favicon-url').value.trim() : '';

  const checkboxes = document.querySelectorAll('input[name="edit-categories"]:checked');
  const newCategories = Array.from(checkboxes).map(cb => cb.value);

  if (!newName || !newUrl) {
    alert('Name and URL are required');
    return;
  }

  if (newCategories.length === 0) {
    alert('Please select at least one category');
    return;
  }

  try {
    // 1. Determine Added and Removed
    const added = newCategories.filter(x => !originalCategories.includes(x));
    const removed = originalCategories.filter(x => !newCategories.includes(x));

    // 2. Add to new categories
    const editCheckType = document.getElementById('edit-check-type') ? document.getElementById('edit-check-type').value : 'api';
    const editScrape = document.getElementById('edit-scrape-keywords') ? document.getElementById('edit-scrape-keywords').value : '';
    
    for (const cat of added) {
      const payload = { 
        resource_name: newName, 
        status_page: newUrl, 
        favicon_url: newFaviconUrl,
        grade_level: cat, 
        check_type: editCheckType, 
        scrape_keywords: editScrape 
      };
      
      // Add API config if it exists
      if (editCheckType === 'api' && editApiConfig) {
        payload.api_config = JSON.stringify(editApiConfig);
      }

      await fetch(`/resources/category/${encodeURIComponent(cat)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    // 3. Remove from old categories
    for (const cat of removed) {
      await fetch(`/resources/category/${encodeURIComponent(cat)}/${encodeURIComponent(originalName)}`, {
        method: 'DELETE'
      });
    }

    // 4. Update details (Definition) - Update one instance updates strict definition
    // We use one of the current categories to trigger the update route, or just any if it still exists.
    // If we removed all original categories, we rely on the Added ones.
    // If we only updated name/url, we need to call PUT.
    const targetCat = newCategories.length > 0 ? newCategories[0] : (added.length > 0 ? added[0] : null);

    if (targetCat) {
      const editCheckType = document.getElementById('edit-check-type') ? document.getElementById('edit-check-type').value : 'api';
      const editScrape = document.getElementById('edit-scrape-keywords') ? document.getElementById('edit-scrape-keywords').value : '';
      
      const payload = {
        resource_name: newName,
        status_page: newUrl,
        favicon_url: newFaviconUrl,
        grade_level: targetCat,
        check_type: editCheckType,
        scrape_keywords: editScrape
      };

      // Add API config if it exists
      if (editCheckType === 'api' && editApiConfig) {
        payload.api_config = JSON.stringify(editApiConfig);
      }

      await fetch(`/resources/category/${encodeURIComponent(targetCat)}/${encodeURIComponent(originalName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    // Reset API config
    editApiConfig = null;

    window.location.reload();
  } catch (e) {
    console.error(e);
    alert('Error updating resource');
  }
}


// Add Modal Logic
function openAddModal(category) {
  document.getElementById('add-name').value = '';
  document.getElementById('add-url').value = '';
  const addFaviconInput = document.getElementById('add-favicon-url');
  if (addFaviconInput) addFaviconInput.value = '';
  const ct = document.getElementById('add-check-type');
  const sk = document.getElementById('add-scrape-keywords');
  if (ct) ct.value = 'api';
  if (sk) sk.value = '';

  // Reset API config
  addApiConfig = null;
  const configSection = document.getElementById('add-api-config-section');
  if (configSection) configSection.classList.add('hidden');
  
  // Reset modal layout to single column
  const modalGrid = document.getElementById('add-modal-grid');
  if (modalGrid) modalGrid.className = 'grid grid-cols-1 gap-6';
  
  // Clear API fields
  const fieldsEl = document.getElementById('add-api-fields');
  if (fieldsEl) fieldsEl.innerHTML = '';
  
  updateAnalyzeButtonVisibility('add');

  const checkboxes = document.querySelectorAll('input[name="add-categories"]');
  checkboxes.forEach(cb => {
    cb.checked = (cb.value === category);
  });

  document.getElementById('add-modal').classList.remove('hidden');
}

function closeAddModal() {
  document.getElementById('add-modal').classList.add('hidden');
}

async function saveNewResource() {
  const name = document.getElementById('add-name').value;
  const url = document.getElementById('add-url').value;
  const faviconUrl = document.getElementById('add-favicon-url') ? document.getElementById('add-favicon-url').value.trim() : '';

  const checkboxes = document.querySelectorAll('input[name="add-categories"]:checked');
  const categories = Array.from(checkboxes).map(cb => cb.value);

  if (!name || !url) {
    alert('Name and URL are required');
    return;
  }

  if (categories.length === 0) {
    alert('Please select at least one category');
    return;
  }

  try {
    for (const cat of categories) {
      const addCT = document.getElementById('add-check-type') ? document.getElementById('add-check-type').value : 'api';
      const addSK = document.getElementById('add-scrape-keywords') ? document.getElementById('add-scrape-keywords').value : '';
      
      const payload = {
        resource_name: name,
        status_page: url,
        favicon_url: faviconUrl,
        grade_level: cat,
        check_type: addCT,
        scrape_keywords: addSK
      };

      // Add API config if it exists
      if (addCT === 'api' && addApiConfig) {
        payload.api_config = JSON.stringify(addApiConfig);
      }

      await fetch(`/resources/category/${encodeURIComponent(cat)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    
    // Reset API config
    addApiConfig = null;
    
    window.location.reload();
  } catch (e) {
    console.error(e);
    alert('Error adding resource');
  }
}

// Category modal controls
function openAddCategoryModal() {
  const el = document.getElementById('modal-new-category-name');
  if (el) el.value = '';
  document.getElementById('add-category-modal').classList.remove('hidden');
}

function closeAddCategoryModal() {
  document.getElementById('add-category-modal').classList.add('hidden');
}

async function saveNewCategory() {
  const input = document.getElementById('modal-new-category-name');
  const category = input ? input.value.trim() : '';
  if (!category) return alert('Please enter a category name');

  try {
    const res = await fetch('/resources/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });
    if (res.ok) window.location.reload();
    else alert('Failed to add category');
  } catch (e) {
    console.error(e);
    alert('Error adding category');
  }
}

// Pagination state
const resourcePagination = {
  currentPage: 1,
  itemsPerPage: 10,
  totalItems: 0,
  filteredRows: [],
  allRows: []
};

// Resource search/filter
function filterResources() {
  const qEl = document.getElementById('resource-search');
  if (!qEl) return;
  const q = qEl.value.trim().toLowerCase();
  
  resourcePagination.filteredRows = resourcePagination.allRows.filter(row => {
    const name = (row.cells[0] && row.cells[0].textContent) ? row.cells[0].textContent.toLowerCase() : '';
    const url = (row.cells[1] && row.cells[1].textContent) ? row.cells[1].textContent.toLowerCase() : '';
    const cats = (row.cells[2] && row.cells[2].textContent) ? row.cells[2].textContent.toLowerCase() : '';
    return q === '' || name.includes(q) || url.includes(q) || cats.includes(q);
  });
  
  resourcePagination.currentPage = 1;
  resourcePagination.totalItems = resourcePagination.filteredRows.length;
  updateResourcePagination();
}

function updateResourcePagination() {
  const { currentPage, itemsPerPage, filteredRows, allRows } = resourcePagination;
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  
  // Hide all rows first
  allRows.forEach(row => row.style.display = 'none');
  
  // Show only current page rows from filtered results
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  filteredRows.slice(startIdx, endIdx).forEach(row => row.style.display = '');
  
  // Update pagination info
  const infoEl = document.getElementById('pagination-info');
  if (infoEl) {
    if (filteredRows.length === 0) {
      infoEl.textContent = 'No resources found';
    } else {
      const showing = Math.min(endIdx, filteredRows.length);
      infoEl.textContent = `Showing ${startIdx + 1} to ${showing} of ${filteredRows.length}`;
    }
  }
  
  // Update pagination buttons
  const prevBtn = document.getElementById('pagination-prev');
  const nextBtn = document.getElementById('pagination-next');
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
  
  // Update page number buttons
  const numbersEl = document.getElementById('pagination-numbers');
  if (numbersEl) {
    numbersEl.innerHTML = '';
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = i;
      btn.className = `rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
        i === currentPage
          ? 'bg-indigo-600 text-white'
          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`;
      btn.onclick = () => goToResourcePage(i);
      numbersEl.appendChild(btn);
    }
  }
}

function nextResourcePage() {
  const totalPages = Math.ceil(resourcePagination.filteredRows.length / resourcePagination.itemsPerPage);
  if (resourcePagination.currentPage < totalPages) {
    resourcePagination.currentPage++;
    updateResourcePagination();
  }
}

function prevResourcePage() {
  if (resourcePagination.currentPage > 1) {
    resourcePagination.currentPage--;
    updateResourcePagination();
  }
}

function goToResourcePage(page) {
  resourcePagination.currentPage = page;
  updateResourcePagination();
}

// attach listener when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('resource-search');
  if (search) search.addEventListener('input', filterResources);
  // Initialize pagination
  const tbody = document.getElementById('resources-table-body');
  if (tbody) {
    const allRows = Array.from(tbody.querySelectorAll('.resource-row'));
    resourcePagination.allRows = allRows;
    resourcePagination.filteredRows = allRows;
    resourcePagination.totalItems = allRows.length;
    updateResourcePagination();
  }
  // load errors button hook
  const refreshErrors = document.getElementById('refresh-errors-btn');
  if (refreshErrors) refreshErrors.addEventListener('click', loadErrors);
  const clearErrorsBtn = document.getElementById('clear-errors-btn');
  if (clearErrorsBtn) clearErrorsBtn.addEventListener('click', clearAllErrors);
  // auto-load errors on page load for convenience
  if (document.getElementById('check-errors-table-body')) {
    loadErrors();
  }

  if (window.IS_SUPERADMIN) {
    loadManagedUsers();
  }
});

function openAddUserModal() {
  const usernameInput = document.getElementById('new-user-username');
  const passwordInput = document.getElementById('new-user-password');
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  const modal = document.getElementById('add-user-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAddUserModal() {
  const modal = document.getElementById('add-user-modal');
  if (modal) modal.classList.add('hidden');
}

async function loadErrors() {
  try {
    const res = await fetch('/resources/errors');
    if (!res.ok) throw new Error('Failed to fetch errors');
    const data = await res.json();
    const rows = data.errors || [];
    const tbody = document.getElementById('check-errors-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td class="py-2 pl-2 pr-3 text-sm text-gray-500" colspan="6">No recent errors.</td></tr>';
      return;
    }
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.className = 'odd:bg-white even:bg-gray-50';
      const time = new Date(r.created_at).toLocaleString();
      tr.innerHTML = `
        <td class="py-2 pl-2 pr-3 text-sm text-gray-700">${time}</td>
        <td class="py-2 px-3 text-sm text-gray-800">${r.resource_name || ''}</td>
        <td class="py-2 px-3 text-sm text-gray-600">${r.check_type || ''}</td>
        <td class="py-2 pr-2 text-sm text-gray-700">${(r.error_message || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
        <td class="py-2 pr-2 text-sm text-right">
          <button class="delete-error-btn p-1 text-red-500 hover:text-red-600" data-id="${r.id}" title="Delete error" aria-label="Delete error">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 inline-block">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9M21 6.5l-1 14.5a2.25 2.25 0 01-2.25 2.25H6.25A2.25 2.25 0 014 21L3 6.5M8.5 6.5V4.75A1.75 1.75 0 0110.25 3h3.5A1.75 1.75 0 0115.5 4.75V6.5" />
            </svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    // bind delete handlers
    const dels = tbody.querySelectorAll('.delete-error-btn');
    dels.forEach(btn => btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      if (!id) return;
      if (!confirm('Delete this error entry?')) return;
      try {
        const res2 = await fetch(`/resources/errors/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res2.ok) loadErrors(); else alert('Failed to delete error');
      } catch (err) { console.error(err); alert('Failed to delete error'); }
    }));
  } catch (e) {
    console.error('Failed to load errors', e);
  }
}

async function clearAllErrors() {
  if (!confirm('Clear all check errors? This cannot be undone.')) return;
  try {
    const res = await fetch('/resources/errors', { method: 'DELETE' });
    if (res.ok) loadErrors(); else alert('Failed to clear errors');
  } catch (e) { console.error('Failed to clear errors', e); alert('Failed to clear errors'); }
}

// CSV Import functions
function openImportModal() {
  document.getElementById('import-modal').classList.remove('hidden');
  document.getElementById('import-csv-file').value = '';
  document.getElementById('import-preview').innerHTML = '';
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  document.getElementById('import-csv-file').value = '';
  document.getElementById('import-preview').innerHTML = '';
}

function downloadCSVTemplate(event) {
  event.preventDefault();
  window.location.href = '/resources/template';
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index++;
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

async function exportCSV() {
  try {
    window.location.href = '/resources/export';
  } catch (error) {
    console.error(error);
    alert('Failed to export CSV');
  }
}

async function importCSV() {
  const fileInput = document.getElementById('import-csv-file');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select a CSV file');
    return;
  }

  const file = fileInput.files[0];
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    alert('CSV file must have at least a header row and one data row');
    return;
  }

  const headers = parseCSVLine(lines[0]);
  const requiredHeaders = ['category', 'resource_name', 'status_page', 'check_type'];
  
  // Validate headers
  const hasRequiredHeaders = requiredHeaders.every(h => headers.includes(h));
  if (!hasRequiredHeaders) {
    alert(`CSV must have columns: ${requiredHeaders.join(', ')} (api_config is optional)`);
    return;
  }

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; // Skip empty lines
    
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    if (!row.category || !row.resource_name || !row.status_page) {
      alert(`Row ${i + 1}: Missing required fields (category, resource_name, status_page)`);
      return;
    }

    if (!['api', 'scrape', 'heartbeat'].includes(row.check_type)) {
      alert(`Row ${i + 1}: check_type must be 'api', 'scrape', or 'heartbeat'`);
      return;
    }

    data.push(row);
  }

  if (data.length === 0) {
    alert('No valid data rows found in CSV');
    return;
  }

  // Show preview
  const preview = document.getElementById('import-preview');
  preview.innerHTML = `<p class="font-medium mb-2">Preview: ${data.length} items to import</p>`;
  data.slice(0, 5).forEach(item => {
    preview.innerHTML += `<p class="text-xs">${item.category} > ${item.resource_name} (${item.check_type})</p>`;
  });
  if (data.length > 5) {
    preview.innerHTML += `<p class="text-xs font-medium">... and ${data.length - 5} more</p>`;
  }

  if (!confirm(`Import ${data.length} items? This will add or update resources.`)) {
    return;
  }

  try {
    const res = await fetch('/resources/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });

    if (res.ok) {
      alert(`Successfully imported ${data.length} items`);
      closeImportModal();
      window.location.reload();
    } else {
      const error = await res.json();
      alert(`Import failed: ${error.error || 'Unknown error'}`);
    }
  } catch (e) {
    console.error(e);
    alert('Error importing CSV');
  }
}

async function loadManagedUsers() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  try {
    const response = await fetch('/setup/users');
    if (!response.ok) {
      throw new Error('Failed to load users');
    }

    const data = await response.json();
    const users = data.users || [];

    tbody.innerHTML = '';
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td class="py-2 pl-2 pr-3 text-sm text-gray-500" colspan="3">No users configured.</td></tr>';
      return;
    }

    users.forEach(user => {
      const tr = document.createElement('tr');
      tr.className = 'odd:bg-white even:bg-gray-50';
      const canDelete = user.role !== 'superadmin';
      tr.innerHTML = `
        <td class="py-2 pl-2 pr-3 text-sm text-gray-900">${user.username}</td>
        <td class="py-2 px-3 text-sm text-gray-600">${user.role}</td>
        <td class="py-2 px-2 text-right text-sm">
          ${canDelete ? `<button type="button" data-username="${user.username}" class="delete-user-btn p-1 text-red-500 hover:text-red-600" title="Delete User" aria-label="Delete User">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 inline-block">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const username = btn.getAttribute('data-username');
        if (!username) return;
        if (!confirm(`Delete user "${username}"?`)) return;

        try {
          const delResponse = await fetch(`/setup/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
          if (!delResponse.ok) {
            const err = await delResponse.json();
            throw new Error(err.error || 'Failed to delete user');
          }
          await loadManagedUsers();
        } catch (error) {
          console.error(error);
          alert(error.message || 'Failed to delete user');
        }
      });
    });
  } catch (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td class="py-2 pl-2 pr-3 text-sm text-gray-500" colspan="3">Unable to load users.</td></tr>';
  }
}

async function createManagedUser(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  const usernameInput = document.getElementById('new-user-username');
  const passwordInput = document.getElementById('new-user-password');
  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    alert('Username and password are required');
    return;
  }

  try {
    const response = await fetch('/setup/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role: 'resource_manager' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create user');
    }

    usernameInput.value = '';
    passwordInput.value = '';
    await loadManagedUsers();
    closeAddUserModal();
  } catch (error) {
    console.error(error);
    alert(error.message || 'Failed to create user');
  }
}

// API Field Configuration Functions
let addApiConfig = null;
let editApiConfig = null;

// Filter/search API tree
function filterAPITree(keyTerm, valueTerm, prefix) {
  const fieldsEl = document.getElementById(`${prefix}-api-fields`);
  if (!fieldsEl) return;
  
  const key = keyTerm.toLowerCase().trim();
  const val = valueTerm.toLowerCase().trim();
  
  // Get all tree items (folders and leaves)
  const folders = fieldsEl.querySelectorAll('.tree-folder');
  const leaves = fieldsEl.querySelectorAll('.tree-leaf');
  
  if (!key && !val) {
    // Show all, collapse all
    folders.forEach(folder => {
      folder.style.display = '';
      const contentContainer = folder.children[1]; // Second child is the content container
      if (contentContainer && contentContainer.classList) {
        contentContainer.classList.add('hidden');
        const arrow = folder.querySelector('svg');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
    });
    leaves.forEach(leaf => leaf.style.display = '');
    return;
  }
  
  // Search through folders and leaves
  const matchingPaths = new Set();
  const parentPaths = new Set();
  const immediateParents = new Set(); // Track immediate parents to show all siblings
  
  // First pass: Find matching leaves and collect their exact parent paths
  leaves.forEach(leaf => {
    const path = leaf.getAttribute('data-path') || '';
    const label = leaf.querySelector('.tree-label')?.textContent.toLowerCase() || '';
    const value = leaf.getAttribute('data-value')?.toLowerCase() || '';
    
    let keyMatch = !key || path.includes(key) || label.includes(key);
    let valueMatch = !val || value.includes(val);
    
    if (keyMatch && valueMatch) {
      leaf.style.display = '';
      matchingPaths.add(path.toLowerCase());
      
      // Extract immediate parent (the object containing this field)
      const lastDot = path.lastIndexOf('.');
      const lastBracket = path.lastIndexOf('[');
      const lastSeparator = Math.max(lastDot, lastBracket);
      
      if (lastSeparator !== -1) {
        let immediateParent;
        if (lastDot > lastBracket) {
          immediateParent = path.substring(0, lastDot);
        } else {
          const openBracket = path.lastIndexOf('[', lastBracket);
          if (openBracket !== -1) {
            immediateParent = path.substring(0, openBracket);
          }
        }
        if (immediateParent) {
          immediateParents.add(immediateParent.toLowerCase());
        }
      }
      
      // Extract all parent paths from the original path format (preserving [index] notation)
      let currentPath = path;
      while (currentPath.length > 0) {
        const lastDot = currentPath.lastIndexOf('.');
        const lastBracket = currentPath.lastIndexOf('[');
        const lastSeparator = Math.max(lastDot, lastBracket);
        
        if (lastSeparator === -1) break;
        
        if (lastDot > lastBracket) {
          currentPath = currentPath.substring(0, lastDot);
        } else {
          const openBracket = currentPath.lastIndexOf('[', lastBracket);
          if (openBracket === -1) break;
          currentPath = currentPath.substring(0, openBracket);
        }
        
        if (currentPath) {
          parentPaths.add(currentPath.toLowerCase());
        }
      }
    }
  });
  
  // Second pass: Show all leaves that are siblings of matching leaves (same immediate parent)
  leaves.forEach(leaf => {
    const path = leaf.getAttribute('data-path') || '';
    
    // Check if this leaf's immediate parent contains a match
    const lastDot = path.lastIndexOf('.');
    const lastBracket = path.lastIndexOf('[');
    const lastSeparator = Math.max(lastDot, lastBracket);
    
    if (lastSeparator !== -1) {
      let immediateParent;
      if (lastDot > lastBracket) {
        immediateParent = path.substring(0, lastDot);
      } else {
        const openBracket = path.lastIndexOf('[', lastBracket);
        if (openBracket !== -1) {
          immediateParent = path.substring(0, openBracket);
        }
      }
      
      if (immediateParent && immediateParents.has(immediateParent.toLowerCase())) {
        leaf.style.display = ''; // Show all siblings of matching leaves
      } else if (!matchingPaths.has(path.toLowerCase())) {
        leaf.style.display = 'none';
      }
    } else if (!matchingPaths.has(path.toLowerCase())) {
      leaf.style.display = 'none';
    }
  });
  
  // Third pass: Show and expand ONLY folders that are exact parents of matching leaves
  folders.forEach(folder => {
    const path = folder.getAttribute('data-path') || '';
    const pathLower = path.toLowerCase();
    
    // Check if this folder is an exact parent of any matching leaves
    const isParentOfMatch = parentPaths.has(pathLower);
    
    if (isParentOfMatch) {
      folder.style.display = '';
      // Expand folders that contain matches
      const contentContainer = folder.children[1]; // Second child is the content container
      if (contentContainer && contentContainer.classList) {
        contentContainer.classList.remove('hidden');
        const arrow = folder.querySelector('svg');
        if (arrow) arrow.style.transform = 'rotate(90deg)';
      }
    } else {
      folder.style.display = 'none';
    }
  });
}

// Build an interactive tree structure for API navigation
function buildAPITree(obj, path = '', prefix = 'add', level = 0) {
  const container = document.createElement('div');
  container.className = level === 0 ? '' : 'ml-4 border-l-2 border-gray-200 pl-2';

  if (obj === null || obj === undefined) {
    const item = createTreeItem(path, obj, 'null', prefix, level);
    container.appendChild(item);
    return container;
  }

  if (Array.isArray(obj)) {
    // For arrays, create numbered sections styled like a file explorer - all collapsed by default
    obj.forEach((item, idx) => {
      const itemPath = path ? `${path}[${idx}]` : `[${idx}]`;
      
      // Create array item container with file explorer styling
      const arrayItemContainer = document.createElement('div');
      arrayItemContainer.className = 'tree-folder my-1';
      arrayItemContainer.setAttribute('data-path', itemPath.toLowerCase());
      arrayItemContainer.setAttribute('data-key', `item-${idx}`);
      
      // Array item header (clickable to expand/collapse) - file explorer style
      const arrayHeader = document.createElement('div');
      arrayHeader.className = 'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gradient-to-r hover:from-gray-100 hover:to-transparent rounded-lg transition-all group';
      
      // Arrow icon for expand/collapse
      const arrow = document.createElement('svg');
      arrow.className = 'w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-all flex-shrink-0';
      arrow.setAttribute('fill', 'none');
      arrow.setAttribute('stroke', 'currentColor');
      arrow.setAttribute('viewBox', '0 0 24 24');
      arrow.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
      
      // Folder icon (same as objects for consistency)
      const folderIcon = document.createElement('span');
      folderIcon.className = 'text-lg flex-shrink-0';
      folderIcon.textContent = '📁';
      
      // Index badge - subtle and file-explorer themed
      const arrayBadge = document.createElement('span');
      arrayBadge.className = 'inline-flex items-center justify-center min-w-[24px] h-5 px-2 text-xs font-mono font-semibold text-gray-600 bg-gray-100 rounded border border-gray-300';
      arrayBadge.textContent = `[${idx}]`;
      
      // Generate label from first key-value pair in the object
      const arrayLabel = document.createElement('span');
      arrayLabel.className = 'text-sm font-medium text-gray-700 tree-label';
      
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const firstKey = Object.keys(item)[0];
        if (firstKey) {
          const firstValue = item[firstKey];
          let displayValue = String(firstValue);
          if (displayValue.length > 30) {
            displayValue = displayValue.substring(0, 30) + '...';
          }
          arrayLabel.textContent = `${firstKey}: ${displayValue}`;
        } else {
          arrayLabel.textContent = `Item ${idx}`;
        }
      } else {
        arrayLabel.textContent = `Item ${idx}`;
      }
      
      arrayHeader.appendChild(arrow);
      arrayHeader.appendChild(folderIcon);
      arrayHeader.appendChild(arrayBadge);
      arrayHeader.appendChild(arrayLabel);
      
      // Content container (collapsed by default) - with tree line
      const contentContainer = document.createElement('div');
      contentContainer.className = 'hidden ml-6 pl-4 border-l-2 border-gray-200';
      const itemTree = buildAPITree(item, itemPath, prefix, level);
      contentContainer.appendChild(itemTree);
      
      // Toggle expand/collapse
      arrayHeader.onclick = (e) => {
        e.stopPropagation();
        if (contentContainer.classList.contains('hidden')) {
          contentContainer.classList.remove('hidden');
          arrow.style.transform = 'rotate(90deg)';
          arrow.classList.add('text-gray-600');
          folderIcon.textContent = '📂'; // Open folder
        } else {
          contentContainer.classList.add('hidden');
          arrow.style.transform = 'rotate(0deg)';
          arrow.classList.remove('text-gray-600');
          folderIcon.textContent = '📁'; // Closed folder
        }
      };
      
      arrayItemContainer.appendChild(arrayHeader);
      arrayItemContainer.appendChild(contentContainer);
      container.appendChild(arrayItemContainer);
    });
    
    return container;
  }

  if (typeof obj === 'object') {
    // Show object properties
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newPath = path ? `${path}.${key}` : key;

      if (value !== null && typeof value === 'object') {
        // Nested object or array - make it collapsible
        const folderDiv = document.createElement('div');
        folderDiv.className = 'tree-folder';
        folderDiv.setAttribute('data-path', newPath.toLowerCase());
        folderDiv.setAttribute('data-key', key.toLowerCase());
        
        const header = document.createElement('div');
        header.className = 'py-1 px-2 hover:bg-gray-100 cursor-pointer rounded flex items-center gap-2 transition-colors';
        
        const isArray = Array.isArray(value);
        
        // Arrow icon
        const arrow = document.createElement('svg');
        arrow.className = 'w-4 h-4 text-gray-500 transition-transform';
        arrow.setAttribute('fill', 'none');
        arrow.setAttribute('stroke', 'currentColor');
        arrow.setAttribute('viewBox', '0 0 24 24');
        arrow.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
        
        // Folder/array icon
        const iconSpan = document.createElement('span');
        iconSpan.textContent = isArray ? '\ud83d\udcc1' : '\ud83d\udcc2';
        
        // Label
        const label = document.createElement('span');
        label.className = 'font-mono text-sm text-gray-700 tree-label';
        label.textContent = key;
        
        // Badge
        const badge = document.createElement('span');
        badge.className = 'text-xs text-gray-500 px-2 py-0.5 rounded';
        if (isArray) {
          badge.className += ' bg-purple-50';
          badge.textContent = `Array[${value.length}]`;
        } else {
          badge.className += ' bg-gray-100';
          badge.textContent = '{...}';
        }
        
        header.appendChild(arrow);
        header.appendChild(iconSpan);
        header.appendChild(label);
        header.appendChild(badge);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'hidden ml-4 border-l border-gray-200 pl-2';
        contentContainer.appendChild(buildAPITree(value, newPath, prefix, level + 1));

        header.onclick = (e) => {
          e.stopPropagation();
          if (contentContainer.classList.contains('hidden')) {
            contentContainer.classList.remove('hidden');
            arrow.style.transform = 'rotate(90deg)';
          } else {
            contentContainer.classList.add('hidden');
            arrow.style.transform = 'rotate(0deg)';
          }
        };

        folderDiv.appendChild(header);
        folderDiv.appendChild(contentContainer);
        container.appendChild(folderDiv);
      } else {
        // Leaf node - selectable field
        const item = createTreeItem(newPath, value, typeof value, prefix, level);
        container.appendChild(item);
      }
    });
  } else {
    // Primitive value
    const item = createTreeItem(path, obj, typeof obj, prefix, level);
    container.appendChild(item);
  }

  return container;
}

function createTreeItem(path, value, type, prefix, level) {
  const item = document.createElement('div');
  item.className = 'tree-leaf py-1.5 px-2 hover:bg-indigo-50 cursor-pointer rounded flex items-center gap-2 group';
  item.setAttribute('data-path', path.toLowerCase());
  item.setAttribute('data-value', String(value || '').toLowerCase());
  
  const pathParts = path.split(/[.\[\]]+/).filter(Boolean);
  const fieldName = pathParts[pathParts.length - 1] || path;
  
  const typeColor = {
    'string': 'text-green-600',
    'number': 'text-blue-600',
    'boolean': 'text-yellow-600',
    'null': 'text-gray-400'
  }[type] || 'text-gray-600';

  const displayValue = type === 'string' ? `"${value}"` : String(value);
  const truncatedValue = displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue;

  item.innerHTML = `
    <span class="text-indigo-500">•</span>
    <span class="font-mono text-sm text-gray-800 font-medium">${fieldName}</span>
    <span class="text-xs ${typeColor}">${type}</span>
    <span class="text-xs text-gray-500 flex-1 truncate">${truncatedValue}</span>
    <span class="text-xs text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
  `;

  item.onclick = (e) => {
    e.stopPropagation();
    selectField(path, value, prefix);
    
    // Visual feedback
    document.querySelectorAll(`#${prefix}-api-fields .bg-indigo-100`).forEach(el => {
      el.classList.remove('bg-indigo-100', 'border-indigo-300');
    });
    item.classList.add('bg-indigo-100', 'border', 'border-indigo-300');
  };

  return item;
}

function selectField(path, value, prefix) {
  if (prefix === 'add') {
    addApiConfig = { fieldPath: path };
  } else {
    editApiConfig = { fieldPath: path };
  }

  // Show confirmation
  const fieldsEl = document.getElementById(`${prefix}-api-fields`);
  let confirmEl = document.getElementById(`${prefix}-field-confirm`);
  
  if (!confirmEl) {
    confirmEl = document.createElement('div');
    confirmEl.id = `${prefix}-field-confirm`;
    confirmEl.className = 'mt-3 p-3 bg-green-50 border border-green-200 rounded-lg';
    fieldsEl.appendChild(confirmEl);
  }

  confirmEl.innerHTML = `
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <div class="flex-1">
        <p class="text-sm font-medium text-green-900">Selected Field</p>
        <p class="text-xs font-mono text-green-700 mt-1">${path}</p>
        <p class="text-xs text-green-600 mt-1">Current value: ${JSON.stringify(value)}</p>
      </div>
    </div>
  `;
}

// Show/Hide analyze button based on check type
function updateAnalyzeButtonVisibility(prefix) {
  const checkType = document.getElementById(`${prefix}-check-type`);
  const analyzeBtn = document.getElementById(`${prefix}-analyze-api-btn`);
  const configSection = document.getElementById(`${prefix}-api-config-section`);
  
  if (checkType && analyzeBtn && configSection) {
    if (checkType.value === 'api') {
      analyzeBtn.classList.remove('hidden');
    } else {
      analyzeBtn.classList.add('hidden');
      configSection.classList.add('hidden');
    }
  }
}

// Attach event listeners for check type changes
document.addEventListener('DOMContentLoaded', () => {
  const addCheckType = document.getElementById('add-check-type');
  const editCheckType = document.getElementById('edit-check-type');
  
  if (addCheckType) {
    addCheckType.addEventListener('change', () => updateAnalyzeButtonVisibility('add'));
  }
  
  if (editCheckType) {
    editCheckType.addEventListener('change', () => updateAnalyzeButtonVisibility('edit'));
  }
});

async function analyzeAddAPI() {
  const url = document.getElementById('add-url').value.trim();
  if (!url) {
    alert('Please enter a Status Page URL first');
    return;
  }

  const loadingEl = document.getElementById('add-api-loading');
  const fieldsEl = document.getElementById('add-api-fields');
  const errorEl = document.getElementById('add-api-error');
  const configSection = document.getElementById('add-api-config-section');

  configSection.classList.remove('hidden');
  loadingEl.classList.remove('hidden');
  fieldsEl.innerHTML = '';
  errorEl.classList.add('hidden');

  try {
    const response = await fetch('/api/analyze-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze API');
    }

    const data = await response.json();
    loadingEl.classList.add('hidden');

    // Build a tree structure from the API data with file explorer style
    fieldsEl.innerHTML = '';
    
    const mainContainer = document.createElement('div');
    mainContainer.className = 'h-full flex flex-col';
    
    // Header (like file explorer title bar)
    const header = document.createElement('div');
    header.className = 'bg-gradient-to-r from-slate-50 via-blue-50 to-slate-50 border-b-2 border-blue-200 px-5 py-4';
    
    const headerTitle = document.createElement('div');
    headerTitle.className = 'text-base font-bold text-slate-800 flex items-center gap-3';
    headerTitle.innerHTML = `
      <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
      </svg>
      <span>API Structure Explorer</span>
    `;
    
    const headerSubtitle = document.createElement('div');
    headerSubtitle.className = 'text-xs text-slate-600 mt-2 ml-9';
    headerSubtitle.textContent = 'Search and click on any value to select it as the status field';
    
    // Search inputs (key and value)
    const searchContainer = document.createElement('div');
    searchContainer.className = 'mt-4 ml-9 space-y-3';
    
    const keySearchWrapper = document.createElement('div');
    const keySearchLabel = document.createElement('label');
    keySearchLabel.className = 'block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide';
    keySearchLabel.textContent = '🔍 Search by Key';
    const keySearchInput = document.createElement('input');
    keySearchInput.type = 'text';
    keySearchInput.id = 'add-search-key';
    keySearchInput.placeholder = 'e.g. status, name, id...';
    keySearchInput.className = 'w-full text-sm px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all';
    keySearchInput.oninput = () => {
      const valInput = document.getElementById('add-search-value');
      filterAPITree(keySearchInput.value, valInput ? valInput.value : '', 'add');
    };
    keySearchWrapper.appendChild(keySearchLabel);
    keySearchWrapper.appendChild(keySearchInput);
    
    const valueSearchWrapper = document.createElement('div');
    const valueSearchLabel = document.createElement('label');
    valueSearchLabel.className = 'block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide';
    valueSearchLabel.textContent = '🎯 Search by Value';
    const valueSearchInput = document.createElement('input');
    valueSearchInput.type = 'text';
    valueSearchInput.id = 'add-search-value';
    valueSearchInput.placeholder = 'e.g. operational, active, ok...';
    valueSearchInput.className = 'w-full text-sm px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all';
    valueSearchInput.oninput = () => {
      const keyInput = document.getElementById('add-search-key');
      filterAPITree(keyInput ? keyInput.value : '', valueSearchInput.value, 'add');
    };
    valueSearchWrapper.appendChild(valueSearchLabel);
    valueSearchWrapper.appendChild(valueSearchInput);
    
    searchContainer.appendChild(keySearchWrapper);
    searchContainer.appendChild(valueSearchWrapper);
    
    header.appendChild(headerTitle);
    header.appendChild(headerSubtitle);
    header.appendChild(searchContainer);
    
    // Show the API explorer column
    document.getElementById('add-modal-grid').className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';

    // Tree container (scrollable content area)
    const treeContainer = document.createElement('div');
    treeContainer.className = 'flex-1 overflow-y-auto p-4 bg-white';
    treeContainer.appendChild(buildAPITree(data.apiData, '', 'add'));
    
    mainContainer.appendChild(header);
    mainContainer.appendChild(treeContainer);
    fieldsEl.appendChild(mainContainer);
  } catch (error) {
    loadingEl.classList.add('hidden');
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  }
}

async function analyzeEditAPI() {
  const url = document.getElementById('edit-url').value.trim();
  if (!url) {
    alert('Please enter a Status Page URL first');
    return;
  }

  const loadingEl = document.getElementById('edit-api-loading');
  const fieldsEl = document.getElementById('edit-api-fields');
  const errorEl = document.getElementById('edit-api-error');
  const configSection = document.getElementById('edit-api-config-section');

  configSection.classList.remove('hidden');
  loadingEl.classList.remove('hidden');
  fieldsEl.innerHTML = '';
  errorEl.classList.add('hidden');

  try {
    const response = await fetch('/api/analyze-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze API');
    }

    const data = await response.json();
    loadingEl.classList.add('hidden');

    // Build a tree structure from the API data with file explorer style
    fieldsEl.innerHTML = '';
    
    const mainContainer = document.createElement('div');
    mainContainer.className = 'h-full flex flex-col';
    
    // Header (like file explorer title bar)
    const header = document.createElement('div');
    header.className = 'bg-gradient-to-r from-slate-50 via-blue-50 to-slate-50 border-b-2 border-blue-200 px-5 py-4';
    
    const headerTitle = document.createElement('div');
    headerTitle.className = 'text-base font-bold text-slate-800 flex items-center gap-3';
    headerTitle.innerHTML = `
      <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
      </svg>
      <span>API Structure Explorer</span>
    `;
    
    const headerSubtitle = document.createElement('div');
    headerSubtitle.className = 'text-xs text-slate-600 mt-2 ml-9';
    headerSubtitle.textContent = 'Search and click on any value to select it as the status field';
    
    // Search inputs (key and value)
    const searchContainer = document.createElement('div');
    searchContainer.className = 'mt-4 ml-9 space-y-3';
    
    const keySearchWrapper = document.createElement('div');
    const keySearchLabel = document.createElement('label');
    keySearchLabel.className = 'block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide';
    keySearchLabel.textContent = '🔍 Search by Key';
    const keySearchInput = document.createElement('input');
    keySearchInput.type = 'text';
    keySearchInput.id = 'edit-search-key';
    keySearchInput.placeholder = 'e.g. status, name, id...';
    keySearchInput.className = 'w-full text-sm px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all';
    keySearchInput.oninput = () => {
      const valInput = document.getElementById('edit-search-value');
      filterAPITree(keySearchInput.value, valInput ? valInput.value : '', 'edit');
    };
    keySearchWrapper.appendChild(keySearchLabel);
    keySearchWrapper.appendChild(keySearchInput);
    
    const valueSearchWrapper = document.createElement('div');
    const valueSearchLabel = document.createElement('label');
    valueSearchLabel.className = 'block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide';
    valueSearchLabel.textContent = '🎯 Search by Value';
    const valueSearchInput = document.createElement('input');
    valueSearchInput.type = 'text';
    valueSearchInput.id = 'edit-search-value';
    valueSearchInput.placeholder = 'e.g. operational, active, ok...';
    valueSearchInput.className = 'w-full text-sm px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all';
    valueSearchInput.oninput = () => {
      const keyInput = document.getElementById('edit-search-key');
      filterAPITree(keyInput ? keyInput.value : '', valueSearchInput.value, 'edit');
    };
    valueSearchWrapper.appendChild(valueSearchLabel);
    valueSearchWrapper.appendChild(valueSearchInput);
    
    searchContainer.appendChild(keySearchWrapper);
    searchContainer.appendChild(valueSearchWrapper);
    
    header.appendChild(headerTitle);
    header.appendChild(headerSubtitle);
    header.appendChild(searchContainer);
    
    // Show the API explorer column
    document.getElementById('edit-modal-grid').className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';

    // Tree container (scrollable content area)
    const treeContainer = document.createElement('div');
    treeContainer.className = 'flex-1 overflow-y-auto p-4 bg-white';
    treeContainer.appendChild(buildAPITree(data.apiData, '', 'edit'));
    
    mainContainer.appendChild(header);
    mainContainer.appendChild(treeContainer);
    fieldsEl.appendChild(mainContainer);
  } catch (error) {
    loadingEl.classList.add('hidden');
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  }
}
