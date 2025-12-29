document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('dashboard-container');

  let sectionOrder = await fetch(`/resources/categories`);
  sectionOrder = await sectionOrder.json();
  sectionOrder = sectionOrder.categories;

  const getStatusColor = (status) => {
    if (!status) return 'bg-slate-400';
    const s = status.toLowerCase();
    if (s === 'operational') return 'bg-green-500';
    if (s === 'degraded') return 'bg-yellow-500';
    if (s === 'outage' || s === 'down') return 'bg-red-500';
    if (s === 'maintenance') return 'bg-blue-500';
    return 'bg-slate-400';
  };

  const CACHE_DURATION = 10 * 60 * 1000;
  const CACHE_KEY_PREFIX = 'status_cache_';
  async function loadData() {
    try {
      const response = await fetch('/resources');
      let resourceData = await response.json();
      resourceData = resourceData.resources;

      // Update global timestamp
      const lastUpdatedEl = document.getElementById('last-updated');
      if (lastUpdatedEl) {
        const now = new Date();
        lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      const updatePromises = renderDashboard(resourceData);

      // Wait for all status checks to complete, then update Current Issues
      Promise.all(updatePromises).then(() => {
        updateCurrentIssues(resourceData);
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      container.innerHTML = '<div class="text-center text-red-500 py-12">Failed to load resources. Please try again later.</div>';
    }
  }

  async function getResourceStatus(resource) {
    const cacheKey = CACHE_KEY_PREFIX + resource.resource_name;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }

    try {
      const params = new URLSearchParams({
        url: resource.status_page || '',
        name: resource.resource_name
      });
      const response = await fetch(`/api/check-status?${params}`);
      const data = await response.json();

      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));

      return data;
    } catch (error) {
      console.error('Status check failed:', error);
      return { status: 'Unknown', last_checked: new Date().toISOString() };
    }
  }

  function updateCurrentIssues(resourceData) {
    const downServices = [];
    Object.values(resourceData).forEach(list => {
      if (Array.isArray(list)) {
        list.forEach(resource => {
          const cacheKey = CACHE_KEY_PREFIX + resource.resource_name;
          const cached = localStorage.getItem(cacheKey);
          let status = 'Unknown';

          if (cached) {
            const { data } = JSON.parse(cached);
            status = (data.status || '').toLowerCase();
          }

          if (status === 'outage' || status === 'down' || status === 'degraded' || status === 'maintenance') {
            if (!downServices.some(r => r.resource_name === resource.resource_name)) {
              downServices.push({
                ...resource,
                current_status: status.charAt(0).toUpperCase() + status.slice(1)
              });
            }
          }
        });
      }
    });

    const currentIssuesSection = document.getElementById('current-issues-section');
    if (currentIssuesSection) {
      currentIssuesSection.remove();
    }

    if (downServices.length > 0) {
      // Create a temporary container to render the section
      const tempContainer = document.createElement('div');
      renderSection("Current Issues", downServices, true, true, tempContainer);

      const newSection = tempContainer.firstElementChild;
      newSection.id = 'current-issues-section';

      // Insert at the top of the dashboard container
      if (container.firstChild) {
        container.insertBefore(newSection, container.firstChild);
      } else {
        container.appendChild(newSection);
      }
    }
  }

  function renderDashboard(resourceData) {
    container.innerHTML = '';
    const updatePromises = [];

    // Initial check for cached issues
    updateCurrentIssues(resourceData);

    // Filter Logic
    const urlParams = new URLSearchParams(window.location.search);
    const currentView = urlParams.get('view');

    // Render Filter Buttons
    renderFilterButtons(currentView);

    sectionOrder.forEach(sectionName => {
      // If a view filter is set, only show that section (or if it matches the slug)
      if (currentView) {
        const slug = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (slug !== currentView) {
          return;
        }
      }

      if (resourceData[sectionName] && resourceData[sectionName].length > 0) {
        const isDefaultExpanded = sectionName === "Approved for K-12" || !!currentView;
        const sectionPromises = renderSection(sectionName, resourceData[sectionName], false, isDefaultExpanded, container);
        updatePromises.push(...sectionPromises);
      }
    });

    return updatePromises;

    function renderFilterButtons(activeView) {
      const filterContainer = document.getElementById('filter-container');
      if (!filterContainer) return;

      filterContainer.innerHTML = '';

      // Helper to create button
      const createButton = (label, viewValue) => {
        const btn = document.createElement('button');
        const isActive = viewValue === activeView || (viewValue === null && !activeView);

        btn.className = `px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${isActive
          ? 'bg-primary text-white border-primary'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`;
        btn.textContent = label;

        btn.addEventListener('click', () => {
          const newUrl = new URL(window.location);
          if (viewValue) {
            newUrl.searchParams.set('view', viewValue);
          } else {
            newUrl.searchParams.delete('view');
          }
          window.history.pushState({}, '', newUrl);
          renderDashboard(resourceData);
        });

        return btn;
      };

      // "All" button
      filterContainer.appendChild(createButton('All', null));

      // Category buttons
      sectionOrder.forEach(sectionName => {
        // Only show filter if category has items
        if (resourceData[sectionName] && resourceData[sectionName].length > 0) {
          const slug = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          filterContainer.appendChild(createButton(sectionName, slug));
        }
      });
    }
  }

  function renderSection(title, resources, isSpecial, startExpanded, targetContainer) {
    const section = document.createElement('section');
    section.className = 'animate-fade-in group';
    section.dataset.defaultExpanded = startExpanded;
    section.dataset.expanded = startExpanded;

    const header = document.createElement('div');
    const headerBgClass = isSpecial ? 'bg-red-50 hover:bg-red-100 border-red-100' : 'hover:bg-slate-50 border-slate-200';
    const titleColorClass = isSpecial ? 'text-red-800' : 'text-slate-800';

    header.className = `flex items-center justify-between mb-6 border-b pb-2 cursor-pointer select-none transition-colors rounded-t-lg px-2 pt-2 ${headerBgClass}`;

    header.innerHTML = `
            <div class="flex items-center gap-3">
                <h2 class="text-2xl font-bold ${titleColorClass}">${title}</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                    ${resources.length}
                </span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-slate-400 transition-transform duration-200 transform ${startExpanded ? '' : '-rotate-180'}">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
        `;
    section.appendChild(header);

    const grid = document.createElement('div');
    const initialGridClasses = startExpanded
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-all duration-300 ease-in-out origin-top'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-all duration-300 ease-in-out origin-top hidden';

    grid.className = initialGridClasses;

    header.addEventListener('click', () => {
      const isCurrentlyExpanded = section.dataset.expanded === 'true';
      const newExpandedState = !isCurrentlyExpanded;
      section.dataset.expanded = newExpandedState;

      const icon = header.querySelector('svg');
      if (newExpandedState) {
        grid.classList.remove('hidden');
        icon.classList.remove('-rotate-180');
      } else {
        grid.classList.add('hidden');
        icon.classList.add('-rotate-180');
      }
    });

    const promises = [];

    resources.forEach(resource => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl border border-slate-200 p-5 card-hover flex flex-col h-full shadow-sm relative overflow-hidden status-unknown';

      card.innerHTML = `
                <div class="flex-1">
                    <div class="flex justify-between items-start mb-2">
                        ${(() => {
          if (isSpecial && resource.status_page && resource.status_page.trim() !== "") {
            let statusUrl = resource.status_page;
            // Remove API suffixes to get the user-facing page
            statusUrl = statusUrl.replace(/\/api\/v2\/summary\.json$/, '');
            statusUrl = statusUrl.replace(/\/summary\.json$/, '');
            // Remove trailing slash if present after replacement
            if (statusUrl.endsWith('/')) {
              statusUrl = statusUrl.slice(0, -1);
            }

            return `<h3 class="font-semibold text-slate-900 text-lg line-clamp-2 leading-tight" title="${resource.resource_name}">
                                    <a href="${statusUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 hover:underline inline-flex items-center gap-1">
                                        ${resource.resource_name}
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-slate-400">
                                            <path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clip-rule="evenodd" />
                                            <path fill-rule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clip-rule="evenodd" />
                                        </svg>
                                    </a>
                                </h3>`;
          } else {
            return `<h3 class="font-semibold text-slate-900 text-lg line-clamp-2 leading-tight" title="${resource.resource_name}">${resource.resource_name}</h3>`;
          }
        })()}
                        <div class="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 ml-2 shrink-0">
                            <span class="status-dot w-2 h-2 rounded-full bg-slate-300 animate-pulse"></span>
                            <span class="status-text text-xs font-medium text-slate-600">Last updated</span>
                        </div>
                    </div>
                </div>
            `;
      grid.appendChild(card);

      promises.push(updateCardStatus(card, resource));
    });

    section.appendChild(grid);
    targetContainer.appendChild(section);

    return promises;
  }

  async function updateCardStatus(card, resource) {
    const statusData = await getResourceStatus(resource);

    const statusColor = getStatusColor(statusData.status);
    const statusText = statusData.status || 'Unknown';

    const dot = card.querySelector('.status-dot');
    const text = card.querySelector('.status-text');

    dot.className = `status-dot w-2.5 h-2.5 rounded-full ${statusColor} ${statusText === 'Operational' ? 'animate-pulse' : ''}`;

    text.textContent = statusText;
    text.className = `status-text text-sm font-medium ${statusText === 'Operational' ? 'text-slate-700' : 'text-slate-900'}`;

    if (statusText === 'Unknown' || statusText === 'Last updated') {
      card.classList.add('status-unknown');
    } else {
      card.classList.remove('status-unknown');
    }

    updateSectionCounts();
  }

  function updateSectionCounts() {
    const isHidingUnknown = document.body.classList.contains('hide-unknown');
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
      const cards = section.querySelectorAll('.card-hover');
      let visibleCount = 0;

      cards.forEach(card => {
        const isHiddenBySearch = card.classList.contains('hidden');
        const isHiddenByToggle = isHidingUnknown && card.classList.contains('status-unknown');

        if (!isHiddenBySearch && !isHiddenByToggle) {
          visibleCount++;
        }
      });

      const badge = section.querySelector('span.rounded-full');
      if (badge) {
        badge.textContent = visibleCount;
      }
      if (visibleCount === 0) {
        section.classList.add('hidden');
      } else {
        section.classList.remove('hidden');
      }
    });
  }

  loadData();

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Clear status cache but preserve other potential preferences if needed (though user said clear localstorage)
      localStorage.clear();
      window.location.reload();
    });
  }

  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
      const cards = section.querySelectorAll('.card-hover');
      const header = section.querySelector('div.cursor-pointer');
      const grid = section.querySelector('.grid');
      const icon = header.querySelector('svg');

      cards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        if (title.includes(searchTerm)) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });

      if (searchTerm.length > 0) {
        grid.classList.remove('hidden');
        icon.classList.remove('-rotate-180');
        section.dataset.expanded = 'true';
      } else {
        const defaultExpanded = section.dataset.defaultExpanded === 'true';
        section.dataset.expanded = defaultExpanded;

        if (defaultExpanded) {
          grid.classList.remove('hidden');
          icon.classList.remove('-rotate-180');
        } else {
          grid.classList.add('hidden');
          icon.classList.add('-rotate-180');
        }
      }
    });

    updateSectionCounts();
  });

  const filterToggle = document.getElementById('filter-toggle');
  const filterContainer = document.getElementById('filter-container');

  if (filterToggle && filterContainer) {
    filterToggle.addEventListener('click', () => {
      filterContainer.classList.toggle('hidden');
      filterContainer.classList.toggle('flex');
    });
  }
});