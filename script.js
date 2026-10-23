"use strict";

/* =========================================
   NEBULA WALLS
   Secure-by-design frontend implementation
   ========================================= */

const FALLBACK_IMAGE = "https://picsum.photos/id/15/600/900";

const WALLPAPERS = [
  { id: "sabit", title: "Sabit", cat: "Boys", image: "my-photo.jpg", colors: ["black"], local: true },
  { id: "nature-1", title: "Forest Escape", cat: "Nature", image: "https://picsum.photos/id/15/600/900", colors: ["green"] },
  { id: "nature-2", title: "Mountain Silence", cat: "Nature", image: "https://picsum.photos/id/29/600/900", colors: ["blue", "green"] },
  { id: "swiss-1", title: "Alpine Dreams", cat: "Switzerland", image: "https://picsum.photos/id/1015/600/900", colors: ["blue", "green"] },
  { id: "bangladesh-1", title: "Green Homeland", cat: "Bangladesh", image: "https://picsum.photos/id/1018/600/900", colors: ["green"] },
  { id: "india-1", title: "Golden Horizon", cat: "India", image: "https://picsum.photos/id/1036/600/900", colors: ["orange"] },
  { id: "myanmar-1", title: "Quiet Landscape", cat: "Myanmar", image: "https://picsum.photos/id/1043/600/900", colors: ["green"] },
  { id: "wildlife-1", title: "Into the Wild", cat: "Wildlife", image: "https://picsum.photos/id/1024/600/900", colors: ["black", "green"] },
  { id: "space-1", title: "Deep Universe", cat: "Space", image: "https://picsum.photos/id/1002/600/900", colors: ["black", "blue"] },
  { id: "space-2", title: "Cosmic Blue", cat: "Space", image: "https://picsum.photos/id/1011/600/900", colors: ["blue", "purple"] },
  { id: "amoled-1", title: "Pure Black", cat: "AMOLED", image: "https://picsum.photos/id/1003/600/900", colors: ["black"] },
  { id: "amoled-2", title: "Neon Nights", cat: "AMOLED", image: "https://picsum.photos/id/1012/600/900", colors: ["black", "purple"] },
  { id: "anime-1", title: "Anime Universe", cat: "Anime", image: "https://picsum.photos/id/1025/600/900", colors: ["blue", "purple"] },
  { id: "anime-2", title: "Dark Fantasy", cat: "Anime", image: "https://picsum.photos/id/1039/600/900", colors: ["black", "red"] },
  { id: "minimal-1", title: "Minimal White", cat: "Minimal", image: "https://picsum.photos/id/1040/600/900", colors: ["white"] },
  { id: "live-placeholder", title: "Live Wallpapers Coming Soon", cat: "Live", image: "https://picsum.photos/id/1047/600/900", colors: ["blue"], comingSoon: true }
];

const CATEGORIES = [
  "All", "Boys", "Nature", "Switzerland", "Bangladesh",
  "India", "Myanmar", "Wildlife", "Space", "Cars",
  "AMOLED", "Anime", "Minimal", "Live"
];

const STORAGE_KEYS = {
  favorites: "nebula_favorites_v1",
  downloads: "nebula_downloads_v1",
  recent: "nebula_recent_v1"
};

const state = {
  category: "All",
  color: "all",
  query: "",
  tab: "home",
  sort: "latest",
  selected: null,
  visibleCount: 12,
  previewMode: "lockscreen"
};

const $ = (id) => document.getElementById(id);

const grid = $("grid");
const categoryBar = $("categoryBar");
const searchInput = $("searchInput");
const preview = $("preview");
const toast = $("toast");

let toastTimer = null;
let clockTimer = null;

/* ---------- Safe helpers ---------- */

function safeText(value, maxLength = 100) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, maxLength);
}

function safeImageUrl(value) {
  if (typeof value !== "string") return FALLBACK_IMAGE;

  const url = value.trim();

  if (/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(url)) {
    return url;
  }

  try {
    const parsed = new URL(url);

    const permittedHosts = [
      "picsum.photos",
      "images.unsplash.com"
    ];

    if (
      parsed.protocol === "https:" &&
      permittedHosts.includes(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    ) {
      return parsed.href;
    }
  } catch {
    // Invalid URL.
  }

  return FALLBACK_IMAGE;
}

function getWallpaper(id) {
  return WALLPAPERS.find((wall) => wall.id === id) || null;
}

/* ---------- Safe local storage ---------- */

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");

    if (!Array.isArray(value)) return [];

    const allowedIds = new Set(WALLPAPERS.map((wall) => wall.id));

    return [...new Set(
      value.filter(
        (item) => typeof item === "string" && allowedIds.has(item)
      )
    )].slice(0, 500);
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    const allowedIds = new Set(WALLPAPERS.map((wall) => wall.id));

    const safeList = [...new Set(
      list.filter(
        (item) => typeof item === "string" && allowedIds.has(item)
      )
    )].slice(0, 500);

    localStorage.setItem(key, JSON.stringify(safeList));
    return true;
  } catch {
    showToast("Storage unavailable on this device.");
    return false;
  }
}

function getFavorites() {
  return readList(STORAGE_KEYS.favorites);
}

function getDownloads() {
  return readList(STORAGE_KEYS.downloads);
}

function getRecent() {
  return readList(STORAGE_KEYS.recent);
}

/* ---------- Toast ---------- */

function showToast(message) {
  if (!toast) return;

  toast.textContent = safeText(message, 180);
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

/* ---------- Categories ---------- */

function renderCategories() {
  if (!categoryBar) return;

  categoryBar.replaceChildren();

  CATEGORIES.forEach((category) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className =
      "category-chip" +
      (state.category === category ? " active" : "");

    button.textContent = category;

    button.addEventListener("click", () => {
      state.category = category;
      state.tab = "explore";
      state.visibleCount = 12;

      updateNavigation();
      renderCategories();
      renderGrid();
    });

    categoryBar.appendChild(button);
  });
}

/* ---------- Filtering and sorting ---------- */

function getFilteredWallpapers() {
  let list = [...WALLPAPERS];

  if (state.tab === "favorites") {
    const favorites = getFavorites();
    list = list.filter((wall) => favorites.includes(wall.id));
  } else if (state.tab === "downloads") {
    const downloads = getDownloads();
    list = list.filter((wall) => downloads.includes(wall.id));
  } else if (state.tab === "profile") {
    list = getRecent()
      .map(getWallpaper)
      .filter(Boolean);
  } else if (state.category !== "All") {
    list = list.filter((wall) => wall.cat === state.category);
  }

  if (state.query) {
    const query = state.query.toLowerCase();

    list = list.filter((wall) =>
      wall.title.toLowerCase().includes(query) ||
      wall.cat.toLowerCase().includes(query)
    );
  }

  if (state.color !== "all") {
    list = list.filter(
      (wall) =>
        Array.isArray(wall.colors) &&
        wall.colors.includes(state.color)
    );
  }

  if (state.sort === "random") {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  } else if (state.sort === "favorites") {
    const favorites = getFavorites();

    list.sort((a, b) =>
      Number(favorites.includes(b.id)) -
      Number(favorites.includes(a.id))
    );
  }

  return list;
}

/* ---------- Image loading ---------- */

function setImageSource(img, wall) {
  const url = safeImageUrl(wall.image);

  img.src = url;
  img.alt = safeText(wall.title, 80);
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";

  img.addEventListener("error", () => {
    if (img.dataset.fallbackApplied === "1") return;

    img.dataset.fallbackApplied = "1";
    img.src = FALLBACK_IMAGE;
  }, { once: true });
}

/* ---------- Wallpaper cards ---------- */

function createCard(wall) {
  const card = document.createElement("article");
  card.className = "wallpaper-card";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "wallpaper-open";
  openButton.setAttribute(
    "aria-label",
    "Preview " + safeText(wall.title, 80)
  );

  const img = document.createElement("img");
  img.className = "wallpaper-image";
  setImageSource(img, wall);

  const badge = document.createElement("span");
  badge.className = "quality-badge";
  badge.textContent = wall.comingSoon
    ? "SOON"
    : wall.local
      ? "LOCAL"
      : "WALLPAPER";

  openButton.append(img, badge);

  openButton.addEventListener("click", () => openPreview(wall.id));

  const favButton = document.createElement("button");
  favButton.type = "button";
  favButton.className = "card-favorite";
  favButton.setAttribute("aria-label", "Toggle favorite");

  function refreshFavoriteButton() {
    const active = getFavorites().includes(wall.id);

    favButton.textContent = active ? "♥" : "♡";
    favButton.classList.toggle("is-favorite", active);
    favButton.setAttribute("aria-pressed", String(active));
  }

  refreshFavoriteButton();

  favButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(wall.id);
    refreshFavoriteButton();
  });

  const info = document.createElement("div");
  info.className = "wallpaper-info";

  const title = document.createElement("h3");
  title.textContent = safeText(wall.title, 80);

  const category = document.createElement("p");
  category.textContent = safeText(wall.cat, 40);

  info.append(title, category);
  card.append(openButton, favButton, info);

  return card;
}

/* ---------- Render gallery ---------- */

function renderGrid() {
  if (!grid) return;

  const filtered = getFilteredWallpapers();
  const visible = filtered.slice(0, state.visibleCount);

  grid.replaceChildren();

  visible.forEach((wall) => {
    grid.appendChild(createCard(wall));
  });

  if ($("loading")) $("loading").classList.add("hidden");

  if ($("empty")) {
    $("empty").classList.toggle("hidden", filtered.length !== 0);
  }

  if ($("resultCount")) {
    $("resultCount").textContent =
      filtered.length +
      (filtered.length === 1 ? " wallpaper" : " wallpapers");
  }

  if ($("loadMoreBtn")) {
    $("loadMoreBtn").classList.toggle(
      "hidden",
      visible.length >= filtered.length
    );
  }

  const titles = {
    home: "Explore Wallpapers",
    explore: "Explore Collections",
    favorites: "Your Favorites",
    downloads: "Your Downloads",
    profile: "Recently Viewed"
  };

  if ($("sectionTitle")) {
    $("sectionTitle").textContent =
      state.tab === "explore" && state.category !== "All"
        ? state.category
        : titles[state.tab] || "Explore Wallpapers";
  }

  if ($("sectionEyebrow")) {
    $("sectionEyebrow").textContent =
      state.tab === "favorites" ? "YOUR COLLECTION" :
      state.tab === "downloads" ? "SAVED ON THIS DEVICE" :
      state.tab === "profile" ? "YOUR HISTORY" :
      "CURATED FOR YOU";
  }
}

/* ---------- Favorites and history ---------- */

function toggleFavorite(id) {
  if (!getWallpaper(id)) return;

  const favorites = getFavorites();

  if (favorites.includes(id)) {
    writeList(
      STORAGE_KEYS.favorites,
      favorites.filter((item) => item !== id)
    );

    showToast("Removed from favorites");
  } else {
    writeList(STORAGE_KEYS.favorites, [id, ...favorites]);
    showToast("Added to favorites ♥");
  }

  updatePreviewFavorite();
  renderGrid();
}

function addRecent(id) {
  const recent = getRecent().filter((item) => item !== id);

  writeList(
    STORAGE_KEYS.recent,
    [id, ...recent].slice(0, 100)
  );
   }
/* ---------- Preview clock ---------- */

function updateClock() {
  const now = new Date();

  if ($("previewClock")) {
    $("previewClock").textContent =
      now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
  }

  if ($("previewDate")) {
    $("previewDate").textContent =
      now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
      }).toUpperCase();
  }
}

/* ---------- Preview modes ---------- */

function setPreviewMode(mode) {
  const validModes = [
    "lockscreen",
    "homescreen",
    "fullscreen"
  ];

  if (!validModes.includes(mode)) return;

  state.previewMode = mode;

  if (preview) {
    preview.dataset.previewMode = mode;

    preview.classList.toggle(
      "mode-lockscreen",
      mode === "lockscreen"
    );

    preview.classList.toggle(
      "mode-homescreen",
      mode === "homescreen"
    );

    preview.classList.toggle(
      "mode-fullscreen",
      mode === "fullscreen"
    );
  }

  const phoneFrame = $("phoneFrame");

  if (phoneFrame) {
    phoneFrame.dataset.previewMode = mode;

    phoneFrame.classList.toggle(
      "mode-lockscreen",
      mode === "lockscreen"
    );

    phoneFrame.classList.toggle(
      "mode-homescreen",
      mode === "homescreen"
    );

    phoneFrame.classList.toggle(
      "mode-fullscreen",
      mode === "fullscreen"
    );
  }

  const clock = document.querySelector(".phone-clock");
  const dock = document.querySelector(".phone-dock");
  const status = document.querySelector(".phone-status");

  if (clock) clock.hidden = mode !== "lockscreen";
  if (dock) dock.hidden = mode !== "homescreen";
  if (status) status.hidden = mode === "fullscreen";

  document.querySelectorAll(".preview-mode-btn[data-preview-mode]")
    .forEach((button) => {
      const active = button.dataset.previewMode === mode;

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
}

function updatePreviewFavorite() {
  if (!state.selected || !$("favoriteBtn")) return;

  const isFavorite =
    getFavorites().includes(state.selected.id);

  $("favoriteBtn").textContent = isFavorite ? "♥" : "♡";

  $("favoriteBtn").setAttribute(
    "aria-pressed",
    String(isFavorite)
  );
}

/* ---------- Open and close preview ---------- */

function openPreview(id) {
  const wall = getWallpaper(id);

  if (!wall) {
    showToast("Wallpaper not found.");
    return;
  }

  if (wall.comingSoon) {
    showToast("Live wallpapers will be added later.");
    return;
  }

  state.selected = wall;

  if ($("previewTitle")) {
    $("previewTitle").textContent = safeText(wall.title, 80);
  }

  if ($("previewCategory")) {
    $("previewCategory").textContent = safeText(wall.cat, 40);
  }

  if ($("previewName")) {
    $("previewName").textContent = safeText(wall.title, 80);
  }

  if ($("previewResolution")) {
    $("previewResolution").textContent =
      "Actual resolution is not verified";
  }

  if ($("previewMessage")) {
    $("previewMessage").textContent = "";
  }

  const wallpaperElement = $("phoneWallpaper");

  if (wallpaperElement) {
    wallpaperElement.style.backgroundImage =
      `url("${safeImageUrl(wall.image)}")`;
  }

  updatePreviewFavorite();
  updateClock();
  addRecent(wall.id);

  if (preview) preview.classList.remove("hidden");

  document.body.style.overflow = "hidden";

  setPreviewMode(state.previewMode);
  startClock();
}

function closePreview() {
  if (preview) preview.classList.add("hidden");

  document.body.style.overflow = "";
  state.selected = null;

  stopClock();
}

function startClock() {
  stopClock();

  clockTimer = setInterval(updateClock, 15000);
}

function stopClock() {
  if (clockTimer !== null) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

/* ---------- Download ---------- */

async function downloadWallpaper() {
  const wall = state.selected;

  if (!wall) return;

  const url = safeImageUrl(wall.image);
  const button = $("downloadBtn");
  const message = $("previewMessage");

  if (button) button.disabled = true;
  if (message) message.textContent = "Preparing download...";

  try {
    if (/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(url)) {
      const link = document.createElement("a");

      link.href = url;
      link.download = safeText(wall.title, 60) + ".jpg";

      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error("Download unavailable");
      }

      const blob = await response.blob();

      if (!blob.type.startsWith("image/")) {
        throw new Error("Unexpected file type");
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = safeText(wall.title, 60) + ".jpg";

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    }

    const downloads = getDownloads().filter(
      (id) => id !== wall.id
    );

    writeList(
      STORAGE_KEYS.downloads,
      [wall.id, ...downloads]
    );

    if (message) message.textContent = "Download requested.";

    showToast("Download requested");
  } catch {
    try {
      window.open(url, "_blank", "noopener,noreferrer");

      if (message) {
        message.textContent =
          "If download did not start, use your browser's save option.";
      }
    } catch {
      showToast("Download failed. Try again.");
    }
  } finally {
    if (button) button.disabled = false;

    if (state.tab === "downloads") {
      renderGrid();
    }
  }
}

/* ---------- Android wallpaper bridge ---------- */

function setWallpaper() {
  const wall = state.selected;

  if (!wall) return;

  const url = safeImageUrl(wall.image);

  try {
    if (
      window.Android &&
      typeof window.Android.setWallpaper === "function"
    ) {
      window.Android.setWallpaper(url);

      if ($("previewMessage")) {
        $("previewMessage").textContent =
          "Wallpaper request sent to Android.";
      }

      return;
    }
  } catch {
    // Safe fallback below.
  }

  if ($("previewMessage")) {
    $("previewMessage").textContent =
      "Direct setting is not available in this app wrapper. Download the image and set it from your device's wallpaper settings.";
  }

  showToast("Download the image to set it as wallpaper.");
}

/* ---------- Share ---------- */

async function shareWallpaper() {
  const wall = state.selected;

  if (!wall) return;

  const shareData = {
    title: safeText(wall.title, 80),
    text: "Discover this wallpaper on Nebula Walls."
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(
        shareData.title + " — Nebula Walls"
      );

      showToast("Wallpaper title copied");
    } else {
      showToast(
        "Sharing is not supported in this browser."
      );
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      showToast("Unable to share right now.");
    }
  }
}

/* ---------- Daily wallpaper ---------- */

function getDailyWallpaper() {
  const available = WALLPAPERS.filter(
    (wall) => !wall.comingSoon
  );

  if (!available.length) return null;

  const now = new Date();

  const dayNumber = Math.floor(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ) / 86400000
  );

  return available[dayNumber % available.length];
}

function renderDailyWallpaper() {
  const wall = getDailyWallpaper();

  if (!wall) return;

  if ($("dailyTitle")) {
    $("dailyTitle").textContent = safeText(wall.title, 80);
  }

  if ($("dailyImage")) {
    $("dailyImage").style.backgroundImage =
      `url("${safeImageUrl(wall.image)}")`;
  }

  if ($("dailyWallpaper")) {
    $("dailyWallpaper").addEventListener("click", () => {
      openPreview(wall.id);
    });
  }
}

/* ---------- Surprise me ---------- */

function surpriseMe() {
  const candidates = getFilteredWallpapers().filter(
    (wall) => !wall.comingSoon
  );

  if (!candidates.length) {
    showToast("No wallpapers found. Try another filter.");
    return;
  }

  const wall = candidates[
    Math.floor(Math.random() * candidates.length)
  ];

  openPreview(wall.id);
  }
/* ---------- Navigation ---------- */

function updateNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.tab === state.tab;

    button.classList.toggle("active", active);

    button.setAttribute(
      "aria-current",
      active ? "page" : "false"
    );
  });
}

function navigate(tab) {
  const allowedTabs = [
    "home",
    "explore",
    "favorites",
    "downloads",
    "profile"
  ];

  if (!allowedTabs.includes(tab)) return;

  state.tab = tab;
  state.visibleCount = 12;

  if (tab === "home") {
    state.category = "All";
    state.color = "all";
    state.query = "";

    if (searchInput) searchInput.value = "";

    document.querySelectorAll(".color-chip").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.color === "all"
      );
    });
  }

  if (tab === "explore") {
    state.category = "All";
  }

  updateNavigation();
  renderCategories();
  renderGrid();

  if (tab === "explore" && $("sectionTitle")) {
    $("sectionTitle").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

/* ---------- Safe event binding ---------- */

function bindClick(id, handler) {
  const element = $(id);

  if (element) {
    element.addEventListener("click", handler);
  }
}

/* ---------- Event listeners ---------- */

function initEvents() {
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = safeText(searchInput.value, 80).trim();
      state.visibleCount = 12;

      if ($("clearSearch")) {
        $("clearSearch").classList.toggle(
          "hidden",
          searchInput.value.length === 0
        );
      }

      renderGrid();
    });
  }

  bindClick("clearSearch", () => {
    if (searchInput) searchInput.value = "";

    state.query = "";
    state.visibleCount = 12;

    if ($("clearSearch")) {
      $("clearSearch").classList.add("hidden");
    }

    renderGrid();
  });

  bindClick("loadMoreBtn", () => {
    state.visibleCount += 12;
    renderGrid();
  });

  bindClick("closePreview", closePreview);
  bindClick("downloadBtn", downloadWallpaper);
  bindClick("setWallpaperBtn", setWallpaper);
  bindClick("shareBtn", shareWallpaper);

  bindClick("favoriteBtn", () => {
    if (!state.selected) return;

    toggleFavorite(state.selected.id);
    updatePreviewFavorite();
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.tab);
    });
  });

  document.querySelectorAll(".color-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.color = button.dataset.color || "all";
      state.visibleCount = 12;

      document.querySelectorAll(".color-chip").forEach((chip) => {
        chip.classList.toggle("active", chip === button);
      });

      renderGrid();
    });
  });

  document.querySelectorAll(
    ".preview-mode-btn[data-preview-mode]"
  ).forEach((button) => {
    button.addEventListener("click", () => {
      setPreviewMode(button.dataset.previewMode);
    });
  });

  bindClick("surpriseBtn", surpriseMe);
  bindClick("surpriseMeBtn", surpriseMe);

  const sortSelect = $("sortSelect");

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      const allowedSorts = [
        "latest",
        "random",
        "favorites"
      ];

      state.sort = allowedSorts.includes(sortSelect.value)
        ? sortSelect.value
        : "latest";

      renderGrid();
    });
  }

  if (preview) {
    preview.addEventListener("click", (event) => {
      if (event.target === preview) {
        closePreview();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      preview &&
      !preview.classList.contains("hidden")
    ) {
      closePreview();
    }
  });
}

/* ---------- Initialize app ---------- */

function initApp() {
  initEvents();
  renderCategories();
  renderGrid();
  renderDailyWallpaper();
  updateNavigation();
  updateClock();
  setPreviewMode("lockscreen");
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initApp,
    { once: true }
  );
} else {
  initApp();
}
