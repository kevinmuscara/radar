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
  let activeIssueReports = {};
  let activeAnnouncements = [];
  let announcementExpiryTimer = null;
  const REPORT_COOLDOWN_MS = 60 * 60 * 1000;
  const REPORT_COOLDOWN_STORAGE_KEY = 'resourceIssueReportCooldowns';

  function getReportCooldowns() {
    try {
      const raw = localStorage.getItem(REPORT_COOLDOWN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function setReportCooldowns(cooldowns) {
    try {
      localStorage.setItem(REPORT_COOLDOWN_STORAGE_KEY, JSON.stringify(cooldowns || {}));
    } catch (_error) {
    }
  }

  function getReportCooldownExpiry(resourceName) {
    if (!resourceName) return 0;
    const cooldowns = getReportCooldowns();
    const expiry = Number(cooldowns[resourceName] || 0);
    return Number.isFinite(expiry) ? expiry : 0;
  }

  function setReportCooldown(resourceName, expiryTs) {
    if (!resourceName) return;
    const cooldowns = getReportCooldowns();
    cooldowns[resourceName] = expiryTs;
    setReportCooldowns(cooldowns);
  }

  function clearExpiredReportCooldowns() {
    const now = Date.now();
    const cooldowns = getReportCooldowns();
    let changed = false;

    Object.keys(cooldowns).forEach((resourceName) => {
      const expiry = Number(cooldowns[resourceName] || 0);
      if (!Number.isFinite(expiry) || expiry <= now) {
        delete cooldowns[resourceName];
        changed = true;
      }
    });

    if (changed) {
      setReportCooldowns(cooldowns);
    }
  }

  function getCooldownRemainingMs(resourceName) {
    const expiry = getReportCooldownExpiry(resourceName);
    return Math.max(expiry - Date.now(), 0);
  }

  function formatCooldown(remainingMs) {
    const totalMinutes = Math.ceil(remainingMs / 60000);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${Math.max(totalMinutes, 1)}m`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderAnnouncements() {
    const announcementContainer = document.getElementById('announcement-container');
    if (!announcementContainer) return;

    pruneExpiredAnnouncements();

    announcementContainer.innerHTML = '';
    if (!activeAnnouncements.length) return;

    activeAnnouncements.forEach((announcement) => {
      const expiresAtRaw = announcement.expires_at ? String(announcement.expires_at).replace(' ', 'T') : '';
      const expiresAtText = expiresAtRaw
        ? new Date(expiresAtRaw).toLocaleString()
        : 'Unknown';

      const banner = document.createElement('div');
      banner.className = 'rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900';
      banner.innerHTML = `
        <div class="flex items-start gap-2">
          <span class="text-sm">ℹ️</span>
          <div class="min-w-0">
            <p class="text-sm font-medium break-words">${escapeHtml(announcement.message)}</p>
            <p class="text-xs text-blue-700 mt-1">Valid until: ${escapeHtml(expiresAtText)}</p>
          </div>
        </div>
      `;
      announcementContainer.appendChild(banner);
    });
  }

  function getAnnouncementExpiryTimestamp(announcement) {
    if (!announcement || !announcement.expires_at) return null;
    const expiresAtRaw = String(announcement.expires_at).replace(' ', 'T');
    const expiresAt = new Date(expiresAtRaw);
    if (Number.isNaN(expiresAt.getTime())) return null;
    return expiresAt.getTime();
  }

  function pruneExpiredAnnouncements() {
    const now = Date.now();
    activeAnnouncements = activeAnnouncements.filter((announcement) => {
      const expiryTs = getAnnouncementExpiryTimestamp(announcement);
      if (expiryTs === null) return true;
      return expiryTs > now;
    });
  }

  function scheduleAnnouncementExpiryRefresh() {
    if (announcementExpiryTimer) {
      clearTimeout(announcementExpiryTimer);
      announcementExpiryTimer = null;
    }

    pruneExpiredAnnouncements();
    const now = Date.now();
    const futureExpiryTimes = activeAnnouncements
      .map(getAnnouncementExpiryTimestamp)
      .filter((ts) => ts !== null && ts > now);

    if (!futureExpiryTimes.length) return;

    const nextExpiry = Math.min(...futureExpiryTimes);
    const delay = Math.max(nextExpiry - now + 200, 50);

    announcementExpiryTimer = setTimeout(async () => {
      pruneExpiredAnnouncements();
      renderAnnouncements();
      scheduleAnnouncementExpiryRefresh();

      try {
        await loadAnnouncements();
      } catch (_error) {
      }
    }, delay);
  }

  async function loadAnnouncements() {
    try {
      const response = await fetch('/resources/announcements/active');
      const data = await response.json();
      activeAnnouncements = Array.isArray(data.announcements) ? data.announcements : [];
      renderAnnouncements();
      scheduleAnnouncementExpiryRefresh();
    } catch (error) {
      console.error('Error loading announcements:', error);
      activeAnnouncements = [];
      renderAnnouncements();
      if (announcementExpiryTimer) {
        clearTimeout(announcementExpiryTimer);
        announcementExpiryTimer = null;
      }
    }
  }

  async function loadCachedStatuses() {
    try {
      const response = await fetch('/api/cached-statuses');
      const data = await response.json();
      
      // Convert array to object keyed by resource name
      cachedStatuses = {};
      data.statuses.forEach(status => {
        cachedStatuses[status.resource_name] = status;
      });
    } catch (error) {
      console.error('Error loading cached statuses:', error);
    }
  }

  async function loadIssueReports() {
    try {
      const response = await fetch('/resources/issue-reports');
      const data = await response.json();
      const reports = Array.isArray(data.reports) ? data.reports : [];

      activeIssueReports = {};
      reports.forEach(report => {
        if (report && report.resource_name) {
          const normalizedCount = Math.max(parseInt(report.report_count, 10) || 1, 1);
          activeIssueReports[report.resource_name] = {
            ...report,
            report_count: normalizedCount
          };
        }
      });
    } catch (error) {
      console.error('Error loading issue reports:', error);
    }
  }

  async function loadData() {
    try {
      // Load cached statuses first
      await loadCachedStatuses();
      await loadIssueReports();
      await loadAnnouncements();

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
      refreshAllIssueIndicators();
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
    if (resource && resource.favicon_url && String(resource.favicon_url).trim() !== '') {
      return String(resource.favicon_url).trim();
    }

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
          const isUserReported = !!activeIssueReports[resource.resource_name];
          const status = cachedStatuses[resource.resource_name];

          const statusLower = status ? (status.status || '').toLowerCase() : '';
          const hasStatusIssue = statusLower === 'outage' || statusLower === 'down' || statusLower === 'degraded' || statusLower === 'maintenance';

          if (isUserReported || hasStatusIssue) {
            if (!downServices.some(r => r.resource_name === resource.resource_name)) {
              downServices.push({
                ...resource,
                current_status: status ? (status.status || 'Unknown') : 'Unknown'
              });
            }
          }
        });
      }
    });

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
      card.dataset.resourceName = resource.resource_name;
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

                  <div class="absolute top-2 right-2 issue-flag hidden" aria-label="User reported issue">
                    <span class="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <span>🚩</span>
                      <span class="issue-count">1</span>
                    </span>
                  </div>
                  
                  <!-- Status label at bottom -->
                  <div class="mt-auto flex items-center justify-between gap-2">
                    <div class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100">
                      <div class="status-indicator w-2 h-2 rounded-full bg-slate-300" title="" aria-hidden="true"></div>
                      <span class="status-text text-xs font-medium text-slate-600">Unknown</span>
                    </div>
                    <button type="button" title="Report issue" aria-label="Report issue" class="report-issue-btn inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18m0-9h12.75c.621 0 1.125-.504 1.125-1.125V5.625A1.125 1.125 0 0 0 15.75 4.5H3v7.5Z" />
                      </svg>
                    </button>
                  </div>
                  <div class="status-tooltip hidden" style="display:none; position:absolute; right:4; bottom:60px; white-space:nowrap; background:#fff; border:1px solid #e6e9ee; padding:6px 8px; border-radius:6px; box-shadow:0 6px 18px rgba(15,23,42,0.08); font-size:12px; color:#0f172a; z-index:10;">Status</div>
                </div>
              </div>
            `;

    const reportButton = card.querySelector('.report-issue-btn');
    if (reportButton) {
      reportButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await reportResourceIssue(resource.resource_name, reportButton);
      });
    }

    updateIssueIndicator(card, resource.resource_name);
    return card;
  }

  function updateIssueIndicator(card, resourceName) {
    const flag = card.querySelector('.issue-flag');
    const issueCount = card.querySelector('.issue-count');
    if (!flag) return;
    const report = activeIssueReports[resourceName] || null;
    const hasIssue = !!report;

    if (hasIssue) {
      const reportCount = Math.max(parseInt(report.report_count, 10) || 1, 1);
      if (issueCount) {
        issueCount.textContent = String(reportCount);
      }
      flag.setAttribute('aria-label', `User reported issue count: ${reportCount}`);
    }

    if (hasIssue) {
      flag.classList.remove('hidden');
    } else {
      flag.removeAttribute('aria-label');
      if (issueCount) {
        issueCount.textContent = '1';
      }
      flag.classList.add('hidden');
    }
  }

  function updateReportButtonState(card, resourceName) {
    const button = card.querySelector('.report-issue-btn');
    if (!button) return;

    clearExpiredReportCooldowns();
    const remainingMs = getCooldownRemainingMs(resourceName);
    const isCoolingDown = remainingMs > 0;

    if (isCoolingDown) {
      const remainingText = formatCooldown(remainingMs);
      button.disabled = true;
      button.classList.add('opacity-50', 'cursor-not-allowed');
      button.setAttribute('title', `Already reported. Try again in ${remainingText}`);
      button.setAttribute('aria-label', `Already reported. Try again in ${remainingText}`);
    } else {
      button.disabled = false;
      button.classList.remove('opacity-50', 'cursor-not-allowed');
      button.setAttribute('title', 'Report issue');
      button.setAttribute('aria-label', 'Report issue');
    }
  }

  function refreshAllIssueIndicators() {
    const allCards = document.querySelectorAll('.card-hover[data-resource-name]');
    allCards.forEach(card => {
      const resourceName = card.getAttribute('data-resource-name');
      if (resourceName) {
        updateIssueIndicator(card, resourceName);
        updateReportButtonState(card, resourceName);
      }
    });
  }

  async function reportResourceIssue(resourceName, button) {
    if (!resourceName) return;

    clearExpiredReportCooldowns();
    const remainingMs = getCooldownRemainingMs(resourceName);
    if (remainingMs > 0) {
      alert(`You already reported this resource. Please wait ${formatCooldown(remainingMs)} before reporting again.`);
      refreshAllIssueIndicators();
      return;
    }

    const confirmed = window.confirm(`Report an issue for "${resourceName}"?`);
    if (!confirmed) {
      return;
    }

    try {
      if (button) {
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
      }

      const response = await fetch(`/resources/report-issue/${encodeURIComponent(resourceName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 429) {
        const retryAfterSeconds = Math.max(parseInt(data.retry_after_seconds, 10) || 0, 0);
        const cooldownExpiry = Date.now() + (retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : REPORT_COOLDOWN_MS);
        setReportCooldown(resourceName, cooldownExpiry);

        if (data && data.report) {
          const normalizedCount = Math.max(parseInt(data.report.report_count, 10) || 1, 1);
          activeIssueReports[resourceName] = {
            ...data.report,
            report_count: normalizedCount
          };
        }

        refreshAllIssueIndicators();
        if (window.currentResourceData) {
          updateCurrentIssues(window.currentResourceData);
        }

        alert(data.error || 'You can only report the same resource once per hour.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to report issue');
      }

      if (data && data.report) {
        const normalizedCount = Math.max(parseInt(data.report.report_count, 10) || 1, 1);
        activeIssueReports[resourceName] = {
          ...data.report,
          report_count: normalizedCount
        };
      }

      setReportCooldown(resourceName, Date.now() + REPORT_COOLDOWN_MS);
      refreshAllIssueIndicators();
      if (window.currentResourceData) {
        updateCurrentIssues(window.currentResourceData);
      }
    } catch (error) {
      console.error('Issue reporting failed:', error);
      alert('Could not report issue right now. Please try again.');
    } finally {
      refreshAllIssueIndicators();
    }
  }

  async function updateCardStatus(card, resource) {
    const statusData = await getResourceStatus(resource);
    const hasUserReportedIssue = !!activeIssueReports[resource.resource_name];

    const statusText = hasUserReportedIssue ? 'User Reported Issue' : (statusData.status || 'Unknown');
    const statusColor = hasUserReportedIssue ? 'bg-orange-500' : getStatusColor(statusData.status);

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

  // Auto-refresh every 5 minutes to get latest data from server cache
  const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  setInterval(() => {
    loadData();
  }, AUTO_REFRESH_INTERVAL);

  setInterval(async () => {
    await loadIssueReports();
    await loadAnnouncements();
    clearExpiredReportCooldowns();
    refreshAllIssueIndicators();
    if (window.currentResourceData) {
      updateCurrentIssues(window.currentResourceData);
    }
  }, 60 * 1000);

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