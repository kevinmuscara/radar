(function () {
  "use strict";

  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("dashboard-search-form");
  const categoryLinks = Array.from(
    document.querySelectorAll(".category-tag[data-view]"),
  );
  const categorySections = Array.from(
    document.querySelectorAll("details[data-category-section]"),
  );
  const noResults = document.getElementById("no-results");
  const announcementBanner = document.getElementById("announcement-banner");
  const announcementCards = Array.from(
    document.querySelectorAll("#announcement-banner-list .announcement-card"),
  );
  const currentIssuesAccordion = document.getElementById(
    "current-issues-accordion",
  );
  const currentIssuesCards = Array.from(
    document.querySelectorAll("#current-issues-grid .resource-card"),
  );
  const currentIssuesCount = document.getElementById("current-issues-count");
  const currentIssuesEmpty = document.getElementById("current-issues-empty");
  let announcementExpiryTimeoutId = null;
  const AUTO_REFRESH_INTERVAL_MS = 30 * 1000;
  let autoRefreshIntervalId = null;

  function clearAnnouncementExpiryTimer() {
    if (announcementExpiryTimeoutId !== null) {
      window.clearTimeout(announcementExpiryTimeoutId);
      announcementExpiryTimeoutId = null;
    }
  }

  function updateAnnouncementVisibility() {
    if (!announcementBanner || announcementCards.length === 0) {
      return;
    }

    const now = Date.now();
    let hasVisibleAnnouncement = false;

    announcementCards.forEach((card) => {
      const expiresAtRaw = String(card.dataset.expiresAt || "").trim();
      const expiresAt = parseInt(expiresAtRaw, 10);
      const isExpired = Number.isFinite(expiresAt) && expiresAt <= now;

      card.classList.toggle("hidden", isExpired);
      if (!isExpired) {
        hasVisibleAnnouncement = true;
      }
    });

    announcementBanner.classList.toggle("hidden", !hasVisibleAnnouncement);
  }

  function scheduleAnnouncementExpiryCheck() {
    if (!announcementBanner || announcementCards.length === 0) {
      return;
    }

    clearAnnouncementExpiryTimer();

    updateAnnouncementVisibility();

    const now = Date.now();
    const futureExpirations = announcementCards
      .map((card) => parseInt(String(card.dataset.expiresAt || "").trim(), 10))
      .filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > now);

    if (futureExpirations.length === 0) {
      return;
    }

    const nextExpiry = Math.min.apply(null, futureExpirations);
    const delay = Math.max(250, nextExpiry - now + 50);
    announcementExpiryTimeoutId = window.setTimeout(
      scheduleAnnouncementExpiryCheck,
      delay,
    );
  }

  scheduleAnnouncementExpiryCheck();

  function shouldSkipAutoRefresh() {
    if (document.hidden) {
      return true;
    }

    const activeElement = document.activeElement;
    if (activeElement && activeElement.id === "search-input") {
      return true;
    }

    return false;
  }

  function startAutoRefresh() {
    if (autoRefreshIntervalId !== null) {
      return;
    }

    autoRefreshIntervalId = window.setInterval(() => {
      if (shouldSkipAutoRefresh()) {
        return;
      }
      window.location.reload();
    }, AUTO_REFRESH_INTERVAL_MS);
  }

  function stopAutoRefresh() {
    if (autoRefreshIntervalId === null) {
      return;
    }

    window.clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = null;
  }

  startAutoRefresh();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearAnnouncementExpiryTimer();
      return;
    }

    scheduleAnnouncementExpiryCheck();
  });

  window.addEventListener("pagehide", clearAnnouncementExpiryTimer);
  window.addEventListener("beforeunload", clearAnnouncementExpiryTimer);
  window.addEventListener("beforeunload", stopAutoRefresh);

  if (!searchInput || !searchForm) {
    return;
  }

  const validViews = new Set(["all"]);
  categorySections.forEach((section) => {
    const slug = String(section.dataset.category || "").trim();
    if (slug) {
      validViews.add(slug);
    }
  });

  function normalizeStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requestedView = String(params.get("view") || "all").toLowerCase();
    const view = validViews.has(requestedView) ? requestedView : "all";
    const search = String(params.get("search") || "").trim();
    return { view, search };
  }

  function updateUrl(state, mode) {
    const params = new URLSearchParams(window.location.search);

    if (state.view && state.view !== "all") {
      params.set("view", state.view);
    } else {
      params.delete("view");
    }

    if (state.search) {
      params.set("search", state.search);
    } else {
      params.delete("search");
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery
      ? window.location.pathname + "?" + nextQuery
      : window.location.pathname;

    if (mode === "push") {
      window.history.pushState(null, "", nextUrl);
      return;
    }
    window.history.replaceState(null, "", nextUrl);
  }

  function matchesSearch(card, normalizedSearch) {
    if (!normalizedSearch) {
      return true;
    }
    const haystack = String(card.dataset.searchText || "").toLowerCase();
    return haystack.includes(normalizedSearch);
  }

  function applyState(state) {
    const normalizedSearch = state.search.toLowerCase();
    searchInput.value = state.search;

    let totalVisibleCards = 0;

    categoryLinks.forEach((link) => {
      const linkView = String(link.dataset.view || "all").toLowerCase();
      if (linkView === state.view) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    currentIssuesCards.forEach((card) => {
      const visible = matchesSearch(card, normalizedSearch);
      card.classList.toggle("hidden", !visible);
    });

    const visibleIssueCards = currentIssuesCards.filter(
      (card) => !card.classList.contains("hidden"),
    ).length;
    totalVisibleCards += visibleIssueCards;

    if (currentIssuesCount) {
      currentIssuesCount.textContent = String(visibleIssueCards);
    }
    if (currentIssuesEmpty) {
      currentIssuesEmpty.classList.toggle("hidden", visibleIssueCards > 0);
    }
    if (currentIssuesAccordion) {
      currentIssuesAccordion.classList.toggle(
        "hidden",
        visibleIssueCards === 0 && !!state.search,
      );
    }

    categorySections.forEach((section) => {
      const categorySlug = String(section.dataset.category || "").toLowerCase();
      const inView = state.view === "all" || categorySlug === state.view;

      const cards = Array.from(section.querySelectorAll(".resource-card"));
      cards.forEach((card) => {
        const visible = inView && matchesSearch(card, normalizedSearch);
        card.classList.toggle("hidden", !visible);
      });

      const visibleCards = cards.filter(
        (card) => !card.classList.contains("hidden"),
      ).length;
      totalVisibleCards += visibleCards;

      const categoryCount = section.querySelector("[data-category-count]");
      if (categoryCount) {
        categoryCount.textContent = String(visibleCards);
      }

      section.classList.toggle("hidden", !inView || visibleCards === 0);
    });

    if (noResults) {
      const noMatch = totalVisibleCards === 0 && !!state.search;
      noResults.classList.toggle("hidden", !noMatch);
      searchInput.classList.toggle("search-no-results", noMatch);
      searchInput.classList.toggle("search-shake", noMatch);
      if (!noMatch) {
        searchInput.classList.remove("search-shake");
      }
    }
  }

  let debounceTimer = null;

  searchInput.addEventListener("input", function () {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(function () {
      const state = normalizeStateFromUrl();
      state.search = searchInput.value.trim();
      updateUrl(state, "replace");
      applyState(state);
    }, 120);
  });

  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const state = normalizeStateFromUrl();
    state.search = searchInput.value.trim();
    updateUrl(state, "push");
    applyState(state);
  });

  categoryLinks.forEach((link) => {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      const state = normalizeStateFromUrl();
      state.view = String(link.dataset.view || "all").toLowerCase();
      updateUrl(state, "push");
      applyState(state);
    });
  });

  window.addEventListener("popstate", function () {
    applyState(normalizeStateFromUrl());
  });

  applyState(normalizeStateFromUrl());
})();
