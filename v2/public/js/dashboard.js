// Resource search and filter functionality
const searchInput = document.getElementById('search-input');
const noResults = document.getElementById('no-results');
const categoryTags = document.querySelectorAll('.category-tag');
const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
const categoryFilterContainer = document.getElementById('category-filter-container');
const detailsElements = document.querySelectorAll('details[data-category]');
const currentIssuesAccordion = document.getElementById('current-issues-accordion');
const currentIssuesGrid = document.getElementById('current-issues-grid');
const currentIssuesCount = document.getElementById('current-issues-count');
const currentIssuesEmpty = document.getElementById('current-issues-empty');
const announcementBanner = document.getElementById('announcement-banner');
const announcementBannerMessage = document.getElementById('announcement-banner-message');
const announcementBannerExpires = document.getElementById('announcement-banner-expires');

// Resource mapping for search
const resources = {
  'google workspace': 'k-12',
  'gmail': 'k-12',
  'canvas': 'k-12',
  'zoom': 'k-12',
  'powerschool': 'k-12',
  'microsoft teams': 'k-12',
  'schoology': 'k-12',
  'blackboard': 'higher-ed',
  'moodle': 'higher-ed',
  'webex': 'higher-ed',
  'banner': 'higher-ed',
  'email server': 'communication',
  'slack': 'communication',
  'discord': 'communication'
};

let currentFilter = 'all';
let currentSearch = '';

function renderAnnouncementBanner() {
  if (!announcementBanner || !announcementBannerMessage || !announcementBannerExpires) {
    return;
  }

  announcementBannerMessage.textContent = '';
  announcementBannerExpires.textContent = '';
  announcementBanner.classList.add('hidden');
}

function syncCategoryFilterVisibility() {
  if (!categoryFilterContainer) {
    return;
  }

  const isMobile = window.matchMedia('(max-width: 639px)').matches;
  const isExpanded = mobileFilterToggle?.getAttribute('aria-expanded') === 'true';

  if (isMobile) {
    categoryFilterContainer.classList.toggle('hidden', !isExpanded);
  } else {
    categoryFilterContainer.classList.remove('hidden');
    if (mobileFilterToggle) {
      mobileFilterToggle.setAttribute('aria-expanded', 'false');
    }
  }
}

// Initialize from URL
function initializeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view && view !== 'all') {
    currentFilter = view;
    updateActiveTag(view);
  }
}

// Update active category tag
function updateActiveTag(category) {
  categoryTags.forEach(tag => {
    if (tag.getAttribute('data-category') === category) {
      tag.classList.add('active');
    } else {
      tag.classList.remove('active');
    }
  });
}

// Update URL
function updateUrl(category) {
  const url = new URL(window.location.href);
  if (category === 'all') {
    url.searchParams.delete('view');
  } else {
    url.searchParams.set('view', category);
  }
  window.history.replaceState({}, '', url.toString());
}

function isIssueCard(card) {
  const statusBadge = card.querySelector('span');
  const statusText = statusBadge ? statusBadge.textContent.trim().toLowerCase() : '';
  return statusText !== 'operational' && statusText !== '';
}

function renderCurrentIssues() {
  if (!currentIssuesGrid || !currentIssuesCount || !currentIssuesEmpty) {
    return;
  }

  currentIssuesGrid.innerHTML = '';
  const normalizedQuery = currentSearch.toLowerCase().trim();

  const issueCards = [];
  detailsElements.forEach(details => {
    details.querySelectorAll('.resource-card').forEach(card => {
      const resourceName = card.querySelector('h3')?.textContent.toLowerCase() || '';
      const searchMatch = !normalizedQuery || resourceName.includes(normalizedQuery);

      if (isIssueCard(card) && searchMatch) {
        issueCards.push(card);
      }
    });
  });

  issueCards.forEach(card => {
    const clone = card.cloneNode(true);
    clone.classList.remove('card-hidden');
    currentIssuesGrid.appendChild(clone);
  });

  currentIssuesCount.textContent = String(issueCards.length);
  currentIssuesEmpty.classList.toggle('hidden', issueCards.length > 0);
  currentIssuesGrid.classList.toggle('hidden', issueCards.length === 0);

  if (currentIssuesAccordion) {
    currentIssuesAccordion.classList.remove('accordion-no-visible-cards');
  }
}

function initializeReportIssueButtons() {
  const reportButtons = document.querySelectorAll('.resource-card button[aria-label="Report issue"]');
  const tooltipText = 'Report an issue if you are currently experiencing problems with this resource.';

  reportButtons.forEach(button => {
    button.setAttribute('title', tooltipText);

    const icon = button.querySelector('svg');
    if (icon) {
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.innerHTML = '<path d="M4 3h2v18H4V3zm4 2h10l-2.2 4L18 13H8V5z"/>';
    }
  });
}

// Filter accordions by category
function filterByCategory(category) {
  currentFilter = category;
  updateActiveTag(category);
  updateUrl(category);
  applyFilters();
}

// Apply both search and category filters
function applyFilters() {
  let visibleCount = 0;
  renderCurrentIssues();

  detailsElements.forEach(details => {
    const category = details.getAttribute('data-category');
    const cards = details.querySelectorAll('.resource-card');
    let visibleCardsInAccordion = 0;

    // Filter individual cards within accordion
    cards.forEach(card => {
      const resourceName = card.querySelector('h3')?.textContent.toLowerCase() || '';

      // Check category filter
      const categoryMatch = currentFilter === 'all' || category === currentFilter;

      // Check search filter
      let searchMatch = true;
      if (currentSearch) {
        searchMatch = resourceName.includes(currentSearch.toLowerCase().trim());
      }

      const isVisible = categoryMatch && searchMatch;
      card.classList.toggle('card-hidden', !isVisible);

      if (isVisible) {
        visibleCardsInAccordion++;
        visibleCount++;
      }
    });

    // Show/hide entire accordion based on visible cards
    details.classList.toggle('accordion-no-visible-cards', visibleCardsInAccordion === 0);

    // Auto-open selected category accordion in focused view
    if (currentFilter !== 'all') {
      const isSelectedCategory = category === currentFilter;
      details.open = isSelectedCategory && visibleCardsInAccordion > 0;
    }
  });

  // Show no results message if nothing found
  noResults.classList.toggle('hidden', visibleCount > 0);
}

// Search functionality
function performSearch(query) {
  currentSearch = query;

  if (query === '') {
    clearSearchShake();
  } else {
    applyFilters();

    // Count visible results
    let visibleCount = 0;
    detailsElements.forEach(details => {
      visibleCount += details.querySelectorAll('.resource-card:not(.card-hidden)').length;
    });

    // Show shake animation if no results
    if (visibleCount === 0) {
      triggerSearchShake();
    } else {
      clearSearchShake();
    }
  }

  applyFilters();
}

// Shake animation functions
const clearSearchShake = () => {
  searchInput.addEventListener('animationend', function clearHandler() {
    searchInput.classList.remove('search-shake', 'search-no-results');
    searchInput.removeEventListener('animationend', clearHandler);
  }, { once: true });
};

const triggerSearchShake = () => {
  if (searchInput.classList.contains('search-shake')) {
    searchInput.classList.remove('search-shake', 'search-no-results');
  }

  void searchInput.offsetWidth;

  searchInput.classList.remove('search-shake', 'search-no-results');
  searchInput.classList.add('search-shake', 'search-no-results');

  searchInput.addEventListener('animationend', function clearHandler(event) {
    if (event.animationName === 'search-shake') {
      clearSearchShake();
    }
  }, { once: true });
};

// Event listeners
searchInput.addEventListener('input', (event) => {
  performSearch(event.target.value);
});

categoryTags.forEach(tag => {
  tag.addEventListener('click', () => {
    const category = tag.getAttribute('data-category');
    filterByCategory(category);
    searchInput.value = '';
    currentSearch = '';
    searchInput.classList.remove('search-shake', 'search-no-results');
    applyFilters();

    if (window.matchMedia('(max-width: 639px)').matches && mobileFilterToggle) {
      mobileFilterToggle.setAttribute('aria-expanded', 'false');
      syncCategoryFilterVisibility();
    }
  });
});

if (mobileFilterToggle) {
  mobileFilterToggle.addEventListener('click', () => {
    const isExpanded = mobileFilterToggle.getAttribute('aria-expanded') === 'true';
    mobileFilterToggle.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
    syncCategoryFilterVisibility();
  });
}

window.addEventListener('resize', syncCategoryFilterVisibility);

// Initialize
initializeFromUrl();
syncCategoryFilterVisibility();
initializeReportIssueButtons();
renderAnnouncementBanner();
renderCurrentIssues();
applyFilters();
