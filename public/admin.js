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
async function editResource(name, url) {
  document.getElementById('edit-original-name').value = name;
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-url').value = url;
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
    // fetch definition (check_type, scrape_keywords)
    try {
      const defRes = await fetch(`/resources/definition/${encodeURIComponent(name)}`);
      if (defRes.ok) {
        const defData = await defRes.json();
        const def = defData.definition || defData.definition;
        if (def) {
          const ct = def.check_type || 'api';
          const sk = def.scrape_keywords || '';
          const sel = document.getElementById('edit-check-type');
          const inpt = document.getElementById('edit-scrape-keywords');
          if (sel) sel.value = ct;
          if (inpt) inpt.value = sk;
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
      await fetch(`/resources/category/${encodeURIComponent(cat)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_name: newName, status_page: newUrl, grade_level: cat, check_type: editCheckType, scrape_keywords: editScrape })
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
      await fetch(`/resources/category/${encodeURIComponent(targetCat)}/${encodeURIComponent(originalName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_name: newName,
          status_page: newUrl,
          grade_level: targetCat,
          check_type: editCheckType,
          scrape_keywords: editScrape
        })
      });
    }

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
  const ct = document.getElementById('add-check-type');
  const sk = document.getElementById('add-scrape-keywords');
  if (ct) ct.value = 'api';
  if (sk) sk.value = '';

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
      await fetch(`/resources/category/${encodeURIComponent(cat)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_name: name,
          status_page: url,
          grade_level: cat,
          check_type: addCT,
          scrape_keywords: addSK
        })
      });
    }
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
});

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

async function importCSV() {
  const fileInput = document.getElementById('import-csv-file');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select a CSV file');
    return;
  }

  const file = fileInput.files[0];
  const text = await file.text();
  const lines = text.trim().split('\n');
  
  if (lines.length < 2) {
    alert('CSV file must have at least a header row and one data row');
    return;
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const requiredHeaders = ['category', 'resource_name', 'status_page', 'check_type'];
  
  // Validate headers
  const hasRequiredHeaders = requiredHeaders.every(h => headers.includes(h));
  if (!hasRequiredHeaders) {
    alert(`CSV must have columns: ${requiredHeaders.join(', ')}`);
    return;
  }

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; // Skip empty lines
    
    const values = lines[i].split(',').map(v => v.trim());
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