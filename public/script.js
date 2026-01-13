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

  // Store cached statuses from server
  let cachedStatuses = {};

  async function loadCachedStatuses() {
    try {
      const response = await fetch('/api/cached-statuses');
      const data = await response.json();
      
      // Convert array to object keyed by resource name
      cachedStatuses = {};
      data.statuses.forEach(status => {
        cachedStatuses[status.resource_name] = status;
      });

      console.log(`[Dashboard] Loaded ${data.statuses.length} cached statuses`);
    } catch (error) {
      console.error('Error loading cached statuses:', error);
    }
  }

  async function loadData() {
    try {
      // Load cached statuses first
      await loadCachedStatuses();

      const response = await fetch('/resources');
      let resourceData = await response.json();
      resourceData = resourceData.resources;
      window.currentResourceData = resourceData;

      // Update global timestamp
      const lastUpdatedEl = document.getElementById('last-updated');
      if (lastUpdatedEl) {
        const now = new Date();
        lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      renderDashboard(resourceData);
    } catch (error) {
      console.error('Error fetching data:', error);
      container.innerHTML = '<div class="text-center text-red-500 py-12">Failed to load resources. Please try again later.</div>';
    }
  }

  async function getResourceStatus(resource) {
    // Get status from server's cached statuses
    const status = cachedStatuses[resource.resource_name];
    
    if (status) {
      return {
        status: status.status,
        last_checked: status.last_checked,
        status_url: status.status_url
      };
    }

    // If no cached status found, return unknown
    return { status: 'Unknown', last_checked: new Date().toISOString() };
  }

  // Derive a favicon URL for a resource's site. Attempts to extract the base domain from the
  // status_page (falling back to resource name) and uses Google's favicon service.
  function getFaviconUrl(resource) {
    let host = '';
    const tryExtract = (u) => {
      try {
        const url = new URL(u);
        return url.hostname;
      } catch (e) {
        try {
          const url2 = new URL('https://' + u);
          return url2.hostname;
        } catch (err) {
          return '';
        }
      }
    };

    if (resource.status_page) host = tryExtract(resource.status_page);
    if (!host && resource.resource_name) host = tryExtract(resource.resource_name);

    if (!host) return (window.BRANDING_LOGO || '/branding/favicon.ico');

    const parts = host.split('.');
    // Naive base domain extraction: take last two parts (handles most cases)
    const base = parts.length >= 2 ? parts.slice(-2).join('.') : host;
    // Use Google's favicon service (fast and reliable)
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(base)}`;
  }

  function updateCurrentIssues(resourceData) {
    const downServices = [];
    Object.values(resourceData).forEach(list => {
      if (Array.isArray(list)) {
        list.forEach(resource => {
          const status = cachedStatuses[resource.resource_name];
          
          if (status) {
            const statusLower = (status.status || '').toLowerCase();
            console.log(`[Current Issues Check] ${resource.resource_name}: ${statusLower}`);

            if (statusLower === 'outage' || statusLower === 'down' || statusLower === 'degraded' || statusLower === 'maintenance') {
              console.log(`[Current Issues] Adding ${resource.resource_name} with status ${statusLower}`);
              if (!downServices.some(r => r.resource_name === resource.resource_name)) {
                downServices.push({
                  ...resource,
                  current_status: statusLower.charAt(0).toUpperCase() + statusLower.slice(1)
                });
              }
            }
          }
        });
      }
    });
    
    console.log(`[Current Issues] Found ${downServices.length} services with issues`);

    const currentIssuesSection = document.getElementById('current-issues-section');
    
    if (downServices.length === 0) {
      // No issues - remove the section if it exists
      if (currentIssuesSection) {
        currentIssuesSection.remove();
      }
      return;
    }

    if (currentIssuesSection) {
      // Section exists - update it in place
      const grid = currentIssuesSection.querySelector('div.grid');
      const badge = currentIssuesSection.querySelector('span.rounded-full');
      
      if (badge) {
        badge.textContent = downServices.length;
      }
      
      if (grid) {
        // Clear and re-render the grid
        grid.innerHTML = '';
        downServices.forEach(resource => {
          const card = createResourceCard(resource, true);
          grid.appendChild(card);
          // Update status but don't wait for it since we're already in the update cycle
          updateCardStatus(card, resource).catch(err => console.error('Error updating card status:', err));
        });
      }
    } else {
      // Section doesn't exist - create it
      const tempContainer = document.createElement('div');
      renderSection("Current Issues", downServices, true, true, tempContainer, true);

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
        renderSection(sectionName, resourceData[sectionName], false, isDefaultExpanded, container, false);
      }
    });

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

  function renderSection(title, resources, isSpecial, startExpanded, targetContainer, skipIssuesUpdate = false) {
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

    resources.forEach(resource => {
      const card = createResourceCard(resource, isSpecial);
      grid.appendChild(card);
      updateCardStatus(card, resource).then(() => {
        // After each card status is updated, refresh the Current Issues section
        // Skip this if we're rendering the Current Issues section itself to prevent recursion
        if (!skipIssuesUpdate && window.currentResourceData) {
          updateCurrentIssues(window.currentResourceData);
        }
      });
    });

    section.appendChild(grid);
    targetContainer.appendChild(section);
  }

  function createResourceCard(resource, isSpecial) {
    const card = document.createElement('div');
      card.className = 'bg-white rounded-xl border border-slate-200 card-hover flex flex-col h-full shadow relative overflow-hidden status-unknown transition-shadow hover:shadow-lg';
      // compute favicon URL for this resource
      const faviconUrl = getFaviconUrl(resource);

            card.innerHTML = `
              <div class="flex flex-col h-full">
                <!-- Top bar with status dot -->
                <div class="h-1.5 w-full bg-slate-300 status-indicator-bar" aria-hidden="true"></div>
                
                <!-- Card content -->
                <div class="p-4 flex-1 flex flex-col min-w-0">
                  <div class="flex items-start gap-3 mb-3">
                    <img src="${faviconUrl}" alt="favicon" class="w-10 h-10 rounded-md object-contain flex-shrink-0" onerror="this.style.display='none'" />
                    <div class="flex-1 min-w-0">
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

              return `<h3 class="font-semibold text-slate-900 text-sm leading-snug min-w-0 mb-2">
                        <a href="${statusUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 hover:underline inline-flex items-center gap-1.5 min-w-0">
                          <span class="truncate" title="${resource.resource_name}">${resource.resource_name}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0">
                            <path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clip-rule="evenodd" />
                            <path fill-rule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clip-rule="evenodd" />
                          </svg>
                        </a>
                      </h3>`;
            } else {
              return `<h3 class="font-semibold text-slate-900 text-sm leading-snug min-w-0 mb-2 truncate" title="${resource.resource_name}">${resource.resource_name}</h3>`;
            }
          })()}
                    </div>
                  </div>
                  
                  <!-- Status label at bottom -->
                  <div class="mt-auto">
                    <div class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100">
                      <div class="status-indicator w-2 h-2 rounded-full bg-slate-300" title="" aria-hidden="true"></div>
                      <span class="status-text text-xs font-medium text-slate-600">Unknown</span>
                    </div>
                  </div>
                  <div class="status-tooltip hidden" style="display:none; position:absolute; right:4; bottom:60px; white-space:nowrap; background:#fff; border:1px solid #e6e9ee; padding:6px 8px; border-radius:6px; box-shadow:0 6px 18px rgba(15,23,42,0.08); font-size:12px; color:#0f172a; z-index:10;">Status</div>
                </div>
              </div>
            `;
    return card;
  }

  async function updateCardStatus(card, resource) {
    const statusData = await getResourceStatus(resource);

    const statusColor = getStatusColor(statusData.status);
    const statusText = statusData.status || 'Unknown';

    const indicator = card.querySelector('.status-indicator');
    const statusBar = card.querySelector('.status-indicator-bar');
    const statusTextEl = card.querySelector('.status-text');
    const tooltip = card.querySelector('.status-tooltip');

    // Update status dot and bar color
    if (indicator) {
      indicator.className = `status-indicator w-2 h-2 rounded-full ${statusColor}`;
      indicator.setAttribute('title', statusText);
      indicator.setAttribute('aria-label', `Status: ${statusText}`);
    }

    if (statusBar) {
      statusBar.className = `status-indicator-bar h-1.5 w-full ${statusColor}`;
    }

    // Update status text label
    if (statusTextEl) {
      statusTextEl.textContent = statusText;
    }

    // Set tooltip text
    if (tooltip) tooltip.textContent = statusText;

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

  // Auto-refresh every 30 seconds to get latest data from server cache
  const AUTO_REFRESH_INTERVAL = 30 * 1000; // 30 seconds
  setInterval(() => {
    loadData();
  }, AUTO_REFRESH_INTERVAL);

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