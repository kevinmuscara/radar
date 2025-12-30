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
        grade_level: category
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
    for (const cat of added) {
      await fetch(`/resources/category/${encodeURIComponent(cat)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_name: newName, status_page: newUrl, grade_level: cat })
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
      await fetch(`/resources/category/${encodeURIComponent(targetCat)}/${encodeURIComponent(originalName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_name: newName,
          status_page: newUrl,
          grade_level: targetCat
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
      await fetch(`/resources/category/${encodeURIComponent(cat)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_name: name,
          status_page: url,
          grade_level: cat
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

// Resource search/filter
function filterResources() {
  const qEl = document.getElementById('resource-search');
  if (!qEl) return;
  const q = qEl.value.trim().toLowerCase();
  const rows = document.querySelectorAll('#unique-resources-table tbody tr');
  rows.forEach(row => {
    const name = (row.cells[0] && row.cells[0].textContent) ? row.cells[0].textContent.toLowerCase() : '';
    const url = (row.cells[1] && row.cells[1].textContent) ? row.cells[1].textContent.toLowerCase() : '';
    const cats = (row.cells[2] && row.cells[2].textContent) ? row.cells[2].textContent.toLowerCase() : '';
    const matches = q === '' || name.includes(q) || url.includes(q) || cats.includes(q);
    row.style.display = matches ? '' : 'none';
  });
}

// attach listener when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('resource-search');
  if (search) search.addEventListener('input', filterResources);
});