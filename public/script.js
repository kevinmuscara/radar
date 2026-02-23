document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('search-input');
  const noResults = document.getElementById('no-results');
  const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
  const categoryFilterContainer = document.getElementById('category-filter-container');
  const categoryTagWrap = categoryFilterContainer ? categoryFilterContainer.querySelector('.flex.flex-wrap.gap-2') : null;
  const contentRoot = document.querySelector('.content-entry-animate .space-y-8');
  const lastUpdated = document.getElementById('last-updated');
  const currentIssuesGridId = 'current-issues-grid';
  const isLotrMode = document.body?.dataset?.lotrMode === 'true';

  const uiText = isLotrMode
    ? {
        allResources: 'All Resources',
        currentIssues: 'Shadows Rising',
        currentIssuesEmpty: 'The realm stands at peace.',
        noResults: 'No realms match your search.',
        searchPlaceholder: 'Search the realms of Middle-earth...',
        reportIssue: 'Raise the beacon',
        announcementTitle: 'Herald',
        announcementExpiresPrefix: 'Word carries until',
        announcementNoExpiration: 'Word carries with no set ending',
        lastUpdatedPrefix: 'Last watch'
      }
    : {
        allResources: 'All Resources',
        currentIssues: 'Current Issues',
        currentIssuesEmpty: 'No current issues.',
        noResults: 'No resources found matching your search.',
        searchPlaceholder: 'Search for a resource...',
        reportIssue: 'Report issue',
        announcementTitle: 'Announcement',
        announcementExpiresPrefix: 'Valid until',
        announcementNoExpiration: 'Valid until: No expiration',
        lastUpdatedPrefix: 'Last updated'
      };

  let resourcesByCategory = {};
  let cachedStatuses = {};
  let issueReports = {};
  let announcements = [];
  let announcementExpiryTimer = null;
  let categorySlugs = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let openAccordionKeys = new Set(['current-issues']);
  let hasCapturedAccordionState = false;
  let hasRenderedDashboardOnce = false;

  function clearSearchFeedback() {
    if (!searchInput) return;
    searchInput.classList.remove('search-shake', 'search-no-results');
  }

  function applyNoResultsSearchFeedback(animate = false) {
    if (!searchInput) return;

    searchInput.classList.remove('search-shake', 'search-no-results');
    if (animate) {
      void searchInput.offsetWidth;
      searchInput.classList.add('search-shake');
      searchInput.addEventListener('animationend', (event) => {
        if (event.animationName === 'search-shake') {
          searchInput.classList.remove('search-shake');
        }
      }, { once: true });
    }

    searchInput.classList.add('search-no-results');
  }

  function updateSearchFeedback(resultCount, animate = false) {
    const hasQuery = Boolean(String(currentSearch || '').trim());
    const hasNoResults = hasQuery && resultCount === 0;
    if (hasNoResults) {
      applyNoResultsSearchFeedback(animate);
    } else {
      clearSearchFeedback();
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function statusMeta(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'operational') return { label: 'Operational', badge: 'bg-green-100 text-green-800' };
    if (s === 'degraded') return { label: 'Degraded', badge: 'bg-amber-100 text-amber-800' };
    if (s === 'maintenance') return { label: 'Maintenance', badge: 'bg-blue-100 text-blue-800' };
    if (s === 'outage' || s === 'down') return { label: 'Outage', badge: 'bg-red-100 text-red-800' };
    if (!s) return { label: 'Unknown', badge: 'bg-slate-100 text-slate-700' };
    return { label: String(status), badge: 'bg-slate-100 text-slate-700' };
  }

  function faviconFor(resource) {
    if (resource.favicon_url && String(resource.favicon_url).trim()) return String(resource.favicon_url).trim();

    const tryHost = (input) => {
      if (!input) return '';
      try {
        return new URL(input).hostname;
      } catch (_error) {
        try {
          return new URL(`https://${input}`).hostname;
        } catch (_error2) {
          return '';
        }
      }
    };

    const host = tryHost(resource.status_page) || tryHost(resource.resource_name);
    if (!host) return document.body.dataset.schoolLogo || '/branding/logo.png';
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;
  }

  function getStatusFor(resourceName) {
    const status = cachedStatuses[resourceName];
    if (!status) return 'Unknown';
    return status.status || 'Unknown';
  }

  function issueCountFor(resourceName) {
    const report = issueReports[resourceName];
    if (!report) return 0;
    return Math.max(parseInt(report.report_count, 10) || 1, 1);
  }

  function isIssue(resourceName) {
    const count = issueCountFor(resourceName);
    if (count > 0) return true;
    const s = String(getStatusFor(resourceName)).toLowerCase();
    return s === 'degraded' || s === 'maintenance' || s === 'outage' || s === 'down';
  }

  function allResources() {
    return Object.entries(resourcesByCategory).flatMap(([category, items]) =>
      (items || []).map((resource) => ({ ...resource, __category: category }))
    );
  }

  function uniqueResourcesByName(items) {
    const seen = new Set();
    return (items || []).filter((resource) => {
      const key = String(resource?.resource_name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function accordionKeyFromDetails(details) {
    if (!details) return null;
    if (details.id === 'current-issues-accordion') return 'current-issues';
    const category = details.getAttribute('data-category');
    return category ? `category:${category}` : null;
  }

  function captureOpenAccordions() {
    if (!contentRoot) return;

    const next = new Set();
    contentRoot.querySelectorAll('details').forEach((details) => {
      const key = accordionKeyFromDetails(details);
      if (!key) return;
      if (details.open) next.add(key);
    });

    openAccordionKeys = next;
    hasCapturedAccordionState = true;
  }

  function filteredResources() {
    const query = currentSearch.trim().toLowerCase();
    return allResources().filter((resource) => {
      const categorySlug = slugify(resource.__category);
      const filterOk = currentFilter === 'all' || currentFilter === categorySlug;
      const text = `${resource.resource_name || ''} ${resource.status_page || ''} ${resource.__category || ''}`.toLowerCase();
      const searchOk = !query || text.includes(query);
      return filterOk && searchOk;
    });
  }

  function renderFilterButtons() {
    if (!categoryTagWrap) return;
    categoryTagWrap.innerHTML = '';

    const defs = [{ slug: 'all', label: uiText.allResources }].concat(
      categorySlugs.map((entry) => ({ slug: entry.slug, label: entry.name }))
    );

    defs.forEach((entry) => {
      const button = document.createElement('button');
      button.className = 'category-tag px-4 py-2 border-2 font-medium rounded-lg transition-all';
      button.dataset.category = entry.slug;
      button.textContent = entry.label;
      if (entry.slug === currentFilter) button.classList.add('active');
      button.addEventListener('click', () => {
        currentFilter = entry.slug;
        currentSearch = '';
        if (searchInput) {
          searchInput.value = '';
        }
        clearSearchFeedback();
        if (mobileFilterToggle && window.matchMedia('(max-width: 639px)').matches) {
          mobileFilterToggle.setAttribute('aria-expanded', 'false');
          syncCategoryFilterVisibility();
        }
        updateUrl();
        renderDashboard();
      });
      categoryTagWrap.appendChild(button);
    });
  }

  function syncCategoryFilterVisibility() {
    if (!categoryFilterContainer) return;
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    const isExpanded = mobileFilterToggle?.getAttribute('aria-expanded') === 'true';
    if (isMobile) {
      categoryFilterContainer.classList.toggle('hidden', !isExpanded);
    } else {
      categoryFilterContainer.classList.remove('hidden');
      if (mobileFilterToggle) mobileFilterToggle.setAttribute('aria-expanded', 'false');
    }
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (currentFilter === 'all') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', currentFilter);
    }
    window.history.replaceState({}, '', url.toString());
  }

  function initializeFromUrl() {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view) currentFilter = view;
  }

  function parseAnnouncementExpiry(expiresAt) {
    if (!expiresAt) return null;
    const time = new Date(String(expiresAt).replace(' ', 'T')).getTime();
    if (Number.isNaN(time)) return null;
    return time;
  }

  function normalizeAnnouncementType(type) {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'warning' || normalized === 'danger' || normalized === 'success') {
      return normalized;
    }
    return 'informative';
  }

  function clearAnnouncementExpiryTimer() {
    if (!announcementExpiryTimer) return;
    clearTimeout(announcementExpiryTimer);
    announcementExpiryTimer = null;
  }

  function scheduleAnnouncementExpiryCheck() {
    clearAnnouncementExpiryTimer();

    const now = Date.now();
    const futureExpirations = (announcements || [])
      .map((announcement) => parseAnnouncementExpiry(announcement?.expires_at))
      .filter((time) => Number.isFinite(time) && time > now);

    if (!futureExpirations.length) return;

    const nextExpiration = Math.min(...futureExpirations);
    const delay = Math.max(0, nextExpiration - now + 1000);
    const maxDelay = 2147483647;

    announcementExpiryTimer = setTimeout(() => {
      renderAnnouncements();
    }, Math.min(delay, maxDelay));
  }

  function renderAnnouncements() {
    const banner = document.getElementById('announcement-banner');
    const listNode = document.getElementById('announcement-banner-list');

    if (!banner || !listNode) return;

    const now = Date.now();
    const active = (announcements || []).filter((announcement) => {
      if (!announcement.expires_at) return true;
      const time = parseAnnouncementExpiry(announcement.expires_at);
      if (!Number.isFinite(time)) return true;
      return time > now;
    });

    const visibleAnnouncements = active.slice(0, 3);

    if (!visibleAnnouncements.length) {
      banner.classList.add('hidden');
      listNode.innerHTML = '';
      scheduleAnnouncementExpiryCheck();
      return;
    }

    listNode.innerHTML = '';

    visibleAnnouncements.forEach((announcement) => {
      const type = normalizeAnnouncementType(announcement?.type);
      const expiryTime = parseAnnouncementExpiry(announcement.expires_at);

      const card = document.createElement('article');
      card.className = 'announcement-card w-full rounded border-2 px-4 py-3';
      card.dataset.announcementType = type;

      const title = document.createElement('p');
      title.className = 'announcement-card-title text-sm font-bold uppercase tracking-wide';
      title.textContent = uiText.announcementTitle;

      const message = document.createElement('p');
      message.className = 'announcement-card-message mt-1 text-sm font-medium break-words sm:text-base';
      message.textContent = announcement.message || '';

      const expires = document.createElement('p');
      expires.className = 'announcement-card-expires mt-2 text-xs font-semibold sm:text-sm';
      expires.textContent = Number.isFinite(expiryTime)
        ? `${uiText.announcementExpiresPrefix}: ${new Date(expiryTime).toLocaleString()}`
        : uiText.announcementNoExpiration;

      card.appendChild(title);
      card.appendChild(message);
      card.appendChild(expires);
      listNode.appendChild(card);
    });

    banner.classList.remove('hidden');
    scheduleAnnouncementExpiryCheck();
  }

  function renderCard(resource) {
    const status = statusMeta(getStatusFor(resource.resource_name));
    const reportCount = issueCountFor(resource.resource_name);
    const reportLabel = reportCount > 0
      ? `${uiText.reportIssue} (${reportCount} existing report${reportCount === 1 ? '' : 's'})`
      : uiText.reportIssue;
    const reportCountMarkup = reportCount > 0
      ? `<span class="report-count inline-flex min-w-5 items-center justify-center rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-bold text-yellow-800">${reportCount}</span>`
      : '';

    return `
      <div class="resource-card flex flex-col rounded-lg border-2 border-gray-200 bg-white shadow-sm hover:shadow-lg" data-resource-name="${escapeHtml(resource.resource_name)}" data-category="${escapeHtml(slugify(resource.__category))}">
        <div class="flex gap-4 p-4">
          <div class="icon-square flex-shrink-0 w-20 h-20 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-4xl transform -rotate-3 border-2 border-blue-200">
            <img src="${escapeHtml(faviconFor(resource))}" />
          </div>
          <div class="flex min-w-0 flex-col flex-1">
            <div class="mb-2 flex min-w-0 items-start justify-between gap-2">
              <h3 class="min-w-0 break-words font-semibold leading-snug text-gray-900">${escapeHtml(resource.resource_name)}</h3>
              <button type="button" title="${escapeHtml(reportLabel)}" aria-label="${escapeHtml(reportLabel)}" class="report-issue-btn inline-flex shrink-0 items-center gap-1 text-gray-400 hover:text-amber-500 transition-colors" data-resource-name="${escapeHtml(resource.resource_name)}">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h2v18H4V3zm4 2h10l-2.2 4L18 13H8V5z"/></svg>
                ${reportCountMarkup}
              </button>
            </div>
            <span class="inline-block w-fit px-3 py-1 text-sm font-medium rounded-full ${status.badge}">${escapeHtml(status.label)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderDashboard(options = {}) {
    const { animateSearchOnNoResults = false } = options;
    if (!contentRoot) return;

    if (hasRenderedDashboardOnce) {
      document.body.classList.add('dashboard-no-rerender-animations');
    }

    captureOpenAccordions();
    const hasSavedAccordionState = hasCapturedAccordionState;

    const list = filteredResources();
    updateSearchFeedback(list.length, animateSearchOnNoResults);

    const grouped = {};
    list.forEach((resource) => {
      const key = resource.__category;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(resource);
    });

    const currentIssues = uniqueResourcesByName(list.filter((resource) => isIssue(resource.resource_name)));
    const sections = [];
    const currentIssuesOpen = hasSavedAccordionState ? openAccordionKeys.has('current-issues') : true;

    sections.push(`
      <details class="group border-2 border-black shadow-[4px_4px_0_0] [&_summary::-webkit-details-marker]:hidden" id="current-issues-accordion" ${currentIssuesOpen ? 'open' : ''}>
        <summary class="flex cursor-pointer items-center justify-between gap-4 bg-white px-4 py-3 font-medium text-gray-900 hover:bg-yellow-100 focus:bg-yellow-100 focus:outline-0">
          <div class="flex items-center gap-3">
            <span class="font-semibold">${uiText.currentIssues}</span>
            <span id="current-issues-count" class="inline-block px-2.5 py-1 text-sm font-bold bg-yellow-100 text-yellow-800 border border-yellow-400 rounded-full">${currentIssues.length}</span>
          </div>
          <svg class="size-5 shrink-0 group-open:-rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </summary>
        <div class="border-t-2 border-black p-4 bg-white">
          <div id="${currentIssuesGridId}" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">${currentIssues.map(renderCard).join('')}</div>
          <p id="current-issues-empty" class="${currentIssues.length ? 'hidden' : ''} text-sm text-gray-600">${uiText.currentIssuesEmpty}</p>
        </div>
      </details>
    `);

    categorySlugs.forEach(({ name, slug }) => {
      const resources = grouped[name] || [];
      const shouldShow = currentFilter === 'all' || currentFilter === slug;
      if (!shouldShow) return;
      const categoryAccordionKey = `category:${slug}`;
      const categoryOpen = hasSavedAccordionState
        ? openAccordionKeys.has(categoryAccordionKey)
        : currentFilter !== 'all';

      sections.push(`
        <details class="group border-2 border-black shadow-[4px_4px_0_0] [&_summary::-webkit-details-marker]:hidden" data-category="${escapeHtml(slug)}" ${categoryOpen ? 'open' : ''}>
          <summary class="flex cursor-pointer items-center justify-between gap-4 bg-white px-4 py-3 font-medium text-gray-900 hover:bg-yellow-100 focus:bg-yellow-100 focus:outline-0">
            <div class="flex items-center gap-3">
              <span class="font-semibold">${escapeHtml(name)}</span>
              <span class="inline-block px-2.5 py-1 text-sm font-bold bg-yellow-100 text-yellow-800 border border-yellow-400 rounded-full">${resources.length}</span>
            </div>
            <svg class="size-5 shrink-0 group-open:-rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </summary>
          <div class="border-t-2 border-black p-4 bg-white">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              ${resources.map(renderCard).join('')}
            </div>
          </div>
        </details>
      `);
    });

    contentRoot.innerHTML = sections.join('');

    const hasCategoryResults = Object.values(grouped).some((items) => items.length > 0);
    if (noResults) noResults.classList.toggle('hidden', hasCategoryResults || currentIssues.length > 0);

    bindReportButtons();

    contentRoot.querySelectorAll('details').forEach((details) => {
      details.addEventListener('toggle', () => {
        const key = accordionKeyFromDetails(details);
        if (!key) return;
        hasCapturedAccordionState = true;
        if (details.open) openAccordionKeys.add(key);
        else openAccordionKeys.delete(key);
      });
    });

    refreshFilterTagState();
    hasRenderedDashboardOnce = true;
  }

  function refreshFilterTagState() {
    document.querySelectorAll('.category-tag').forEach((tag) => {
      tag.classList.toggle('active', tag.dataset.category === currentFilter);
    });
  }

  function bindReportButtons() {
    document.querySelectorAll('.report-issue-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const resourceName = button.getAttribute('data-resource-name');
        if (!resourceName) return;

        button.disabled = true;
        try {
          const response = await fetch(`/resources/report-issue/${encodeURIComponent(resourceName)}`, { method: 'POST' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || `Failed (${response.status})`);
          }
          await loadIssueReports();
          renderDashboard();
        } catch (error) {
          alert(error.message || 'Failed to report issue');
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  async function loadCachedStatuses() {
    const response = await fetch('/api/cached-statuses');
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Failed to load statuses');

    cachedStatuses = {};
    (body.statuses || []).forEach((status) => {
      cachedStatuses[status.resource_name] = status;
    });
  }

  async function loadIssueReports() {
    const response = await fetch('/resources/issue-reports');
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Failed to load issue reports');

    issueReports = {};
    (body.reports || []).forEach((report) => {
      if (!report || !report.resource_name) return;
      issueReports[report.resource_name] = report;
    });
  }

  async function loadAnnouncements() {
    const response = await fetch('/resources/announcements/active');
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Failed to load announcements');
    announcements = body.announcements || [];
    renderAnnouncements();
  }

  async function loadResources() {
    const [resourcesRes, categoriesRes] = await Promise.all([
      fetch('/resources'),
      fetch('/resources/categories')
    ]);

    const resourcesBody = await resourcesRes.json().catch(() => ({}));
    const categoriesBody = await categoriesRes.json().catch(() => ({}));
    if (!resourcesRes.ok) throw new Error(resourcesBody.error || 'Failed to load resources');
    if (!categoriesRes.ok) throw new Error(categoriesBody.error || 'Failed to load categories');

    resourcesByCategory = resourcesBody.resources || {};
    categorySlugs = (categoriesBody.categories || []).map((name) => ({ name, slug: slugify(name) }));
  }

  async function loadAll() {
    await Promise.all([loadResources(), loadCachedStatuses(), loadIssueReports(), loadAnnouncements()]);

    if (lastUpdated) {
      lastUpdated.textContent = `${uiText.lastUpdatedPrefix}: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    renderFilterButtons();
    syncCategoryFilterVisibility();
    renderDashboard();
  }

  initializeFromUrl();

  if (searchInput) {
    searchInput.placeholder = uiText.searchPlaceholder;
  }

  if (noResults) {
    const noResultsMessage = noResults.querySelector('p');
    if (noResultsMessage) {
      noResultsMessage.textContent = uiText.noResults;
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      currentSearch = event.target.value || '';
      renderDashboard({ animateSearchOnNoResults: true });
    });
  }

  if (mobileFilterToggle) {
    mobileFilterToggle.addEventListener('click', () => {
      const expanded = mobileFilterToggle.getAttribute('aria-expanded') === 'true';
      mobileFilterToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      syncCategoryFilterVisibility();
    });
  }

  window.addEventListener('resize', syncCategoryFilterVisibility);

  try {
    await loadAll();
  } catch (error) {
    console.error(error);
    if (contentRoot) {
      contentRoot.innerHTML = '<div class="text-center text-red-500 py-12">Failed to load dashboard data.</div>';
    }
  }

  setInterval(async () => {
    try {
      await Promise.all([loadCachedStatuses(), loadIssueReports(), loadAnnouncements()]);
      renderDashboard();
      if (lastUpdated) {
        lastUpdated.textContent = `${uiText.lastUpdatedPrefix}: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    } catch (_error) {
    }
  }, 60000);
});
