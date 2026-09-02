(() => {
  const data = window.SITE_DATA;
  if (!data) return;

  // Keep ordinary visits/reloads at the top instead of restoring an old scroll position.
  // Direct asset links (#asset-id) are handled separately and still scroll to that asset.
  const navigationType = performance.getEntriesByType?.('navigation')?.[0]?.type || '';
  const shouldResetScrollOnLoad = !location.hash && navigationType !== 'back_forward';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (shouldResetScrollOnLoad) {
    window.scrollTo(0, 0);
    window.addEventListener('pageshow', () => {
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }, { once: true });
  }

  const profileEl = document.getElementById('profile');
  const listEl = document.getElementById('asset-list');
  const searchEl = document.getElementById('asset-search');
  const emptyEl = document.getElementById('empty-state');
  const paginationEl = document.getElementById('pagination');
  const catalogEl = document.querySelector('.catalog');

  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const closeButton = lightbox.querySelector('.lightbox-close');
  const prevButton = lightbox.querySelector('.lightbox-prev');
  const nextButton = lightbox.querySelector('.lightbox-next');

  const supportedLanguages = Object.keys(data.languages || { en: {} });
  const languageStorageKey = data.settings?.languageStorageKey || 'kurai_site_language';
  const assetsPerPage = Math.max(1, Number(data.settings?.assetsPerPage || data.settings?.initialVisibleAssets || 5));

  let currentLanguage = getInitialLanguage();
  let currentPage = 1;
  let currentGallery = [];
  let currentIndex = 0;
  let touchStartX = null;
  let toastTimer = null;
  let currentVisitCount = 0;

  const icons = {
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="m4.5 7.5 7.5 6 7.5-6"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3.7 10.8c-.9.35-.86 1.62.06 1.92l4.42 1.45 1.64 5.02c.28.86 1.39 1.09 1.99.41l2.46-2.77 4.17 3.08c.72.53 1.75.12 1.91-.76L22 5.4C22.2 4.31 21.98 3.62 21 4Z"/><path d="m8.25 14.16 10.1-6.76"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10 9.15 15.1 12 10 14.85Z" fill="var(--accent)" stroke="none"/></svg>',
    generic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="2.4"/><rect x="8" y="8" width="12" height="12" rx="2.4"/></svg>',
    unity: '<svg viewBox="0 0 448 512" aria-hidden="true"><path d="M243.583 91.6027L323.695 138.384C326.575 140.026 326.68 144.583 323.695 146.225L228.503 201.854C225.623 203.55 222.22 203.444 219.549 201.854L124.357 146.225C121.425 144.636 121.373 139.973 124.357 138.384L204.417 91.6027V0L0 119.417V358.252L78.3843 312.477V218.914C78.3319 215.576 82.2066 213.192 85.0865 214.993L180.279 270.622C183.159 272.318 184.782 275.338 184.782 278.464V389.669C184.834 393.007 180.959 395.391 178.079 393.589L97.9673 346.808L19.583 392.583L224 512L428.417 392.583L350.033 346.808L269.921 393.589C267.093 395.338 263.114 393.06 263.218 389.669V278.464C263.218 275.126 265.051 272.159 267.721 270.622L362.914 214.993C365.741 213.245 369.72 215.47 369.616 218.914V312.477L448 358.252V119.417L243.583 0V91.6027Z"/></svg>'
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function format(template, variables = {}) {
    return String(template ?? '').replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
  }

  function t(key, variables = {}) {
    const local = data.translations?.[currentLanguage]?.ui?.[key];
    const fallback = data.translations?.en?.ui?.[key];
    return format(local ?? fallback ?? key, variables);
  }

  function languageFromBrowser(value) {
    const lang = String(value || '').toLowerCase();
    if (lang.startsWith('uk')) return 'uk';
    if (lang.startsWith('ru')) return 'ru';
    if (lang.startsWith('tr')) return 'tr';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('pt')) return 'pt-BR';
    if (lang.startsWith('es')) return 'es';
    return 'en';
  }

  function getInitialLanguage() {
    try {
      const saved = localStorage.getItem(languageStorageKey);
      if (saved && supportedLanguages.includes(saved)) return saved;
    } catch {
      // Ignore storage restrictions and fall back to the browser preference.
    }

    const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language];

    for (const browserLanguage of browserLanguages) {
      const candidate = languageFromBrowser(browserLanguage);
      if (supportedLanguages.includes(candidate)) return candidate;
    }

    return supportedLanguages.includes('en') ? 'en' : supportedLanguages[0];
  }

  function saveLanguage(language) {
    try {
      localStorage.setItem(languageStorageKey, language);
    } catch {
      // Language still changes for the current session when storage is unavailable.
    }
  }

  function flagIcon(language) {
    const common = 'class="language-flag-svg" viewBox="0 0 60 36" aria-hidden="true" focusable="false"';
    if (language === 'en') {
      return `<svg ${common}><rect width="60" height="36" fill="#012169"/><path d="M0 0 60 36M60 0 0 36" stroke="#fff" stroke-width="8"/><path d="M0 0 60 36M60 0 0 36" stroke="#c8102e" stroke-width="4"/><path d="M30 0v36M0 18h60" stroke="#fff" stroke-width="12"/><path d="M30 0v36M0 18h60" stroke="#c8102e" stroke-width="7"/></svg>`;
    }
    if (language === 'uk') {
      return `<svg ${common}><rect width="60" height="18" fill="#0057b7"/><rect y="18" width="60" height="18" fill="#ffd700"/></svg>`;
    }
    if (language === 'ru') {
      // Intentionally the white-blue-white flag requested for the Russian-language option.
      return `<svg ${common}><rect width="60" height="12" fill="#fff"/><rect y="12" width="60" height="12" fill="#5b9bd5"/><rect y="24" width="60" height="12" fill="#fff"/></svg>`;
    }
    if (language === 'tr') {
      return `<svg ${common}><rect width="60" height="36" fill="#e30a17"/><circle cx="24" cy="18" r="10" fill="#fff"/><circle cx="28" cy="18" r="8" fill="#e30a17"/><path d="m37 18 3.5 1.15-2.15-2.95v3.65l2.15-2.95L37 18Z" fill="#fff" transform="scale(1.35) translate(-10.5 -4.7)"/></svg>`;
    }
    if (language === 'ja') {
      return `<svg ${common}><rect width="60" height="36" fill="#fff"/><circle cx="30" cy="18" r="9" fill="#bc002d"/></svg>`;
    }
    if (language === 'pt-BR') {
      // Portuguese flag for the Portuguese-language option.
      return `<svg ${common}><rect width="24" height="36" fill="#046a38"/><rect x="24" width="36" height="36" fill="#da291c"/><circle cx="24" cy="18" r="8.3" fill="none" stroke="#ffcc00" stroke-width="2.1"/><circle cx="24" cy="18" r="5.2" fill="#fff" stroke="#da291c" stroke-width="1"/><path d="M20.4 14.8h7.2v5.6c0 2.4-1.8 4.3-3.6 5.1-1.8-.8-3.6-2.7-3.6-5.1Z" fill="#fff" stroke="#da291c" stroke-width=".8"/><circle cx="22.2" cy="17.2" r=".7" fill="#1f4e9e"/><circle cx="24" cy="17.2" r=".7" fill="#1f4e9e"/><circle cx="25.8" cy="17.2" r=".7" fill="#1f4e9e"/><circle cx="23.1" cy="19.1" r=".7" fill="#1f4e9e"/><circle cx="24.9" cy="19.1" r=".7" fill="#1f4e9e"/></svg>`;
    }
    if (language === 'es') {
      return `<svg ${common}><rect width="60" height="9" fill="#aa151b"/><rect y="9" width="60" height="18" fill="#f1bf00"/><rect y="27" width="60" height="9" fill="#aa151b"/></svg>`;
    }
    return '';
  }

  function localizedAsset(asset, language = currentLanguage) {
    const localized = asset.i18n?.[language] || asset.i18n?.en || {};
    return {
      ...asset,
      title: localized.title || asset.id,
      description: localized.description || '',
      tags: localized.tags || []
    };
  }

  function localizedProfile() {
    return data.profile.i18n?.[currentLanguage] || data.profile.i18n?.en || {};
  }

  function languageSwitcherHtml() {
    const selected = data.languages[currentLanguage];
    const options = supportedLanguages.map(language => {
      const item = data.languages[language];
      const active = language === currentLanguage;
      return `<button class="language-option${active ? ' is-active' : ''}" type="button" role="option" aria-selected="${active}" data-language="${escapeHtml(language)}">
        <span class="language-flag">${flagIcon(language)}</span>
        <span class="language-option-name">${escapeHtml(item.name)}</span>
        <span class="language-option-code">${escapeHtml(item.code)}</span>
      </button>`;
    }).join('');

    return `<div class="language-switcher" id="language-switcher">
      <button class="language-toggle" id="language-toggle" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${escapeHtml(t('selectLanguage'))}" title="${escapeHtml(t('language'))}">
        <span class="language-flag">${flagIcon(currentLanguage)}</span>
        <span class="language-current-code">${escapeHtml(selected.code)}</span>
        <span class="language-chevron" aria-hidden="true">▾</span>
      </button>
      <div class="language-menu" id="language-menu" role="listbox" aria-label="${escapeHtml(t('selectLanguage'))}" hidden>
        ${options}
      </div>
    </div>`;
  }

  function profilePlatformButtons() {
    const stores = data.profile.profileStores || {};
    const items = [
      {
        key: 'fab',
        label: 'Fab',
        href: stores.fab,
        icon: '<img class="profile-platform-icon-image" src="assets/images/ui/unreal.png" alt="">'
      },
      {
        key: 'unity',
        label: 'Unity Asset Store',
        href: stores.unity,
        icon: icons.unity
      }
    ].filter(item => item.href);

    if (!items.length) return '';

    return `<nav class="profile-platforms" aria-label="Asset stores">${items.map(item => `
      <a class="profile-platform-button profile-platform-${item.key}" href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}">
        <span class="profile-platform-icon">${item.icon}</span>
        <span>${escapeHtml(item.label)}</span>
      </a>`).join('')}</nav>`;
  }

  function renderProfile() {
    const profile = localizedProfile();
    const contacts = (data.profile.contacts || []).filter(contact => contact && contact.href && contact.label);

    profileEl.innerHTML = `
      <img class="profile-avatar" src="${escapeHtml(data.profile.avatar)}" alt="Kurai avatar">
      <div class="profile-content">
        <h1 class="profile-title">${escapeHtml(data.profile.brand)}</h1>
        <div class="profile-subtitle">${escapeHtml(profile.subtitle || '')}</div>
        <p class="profile-intro">${profile.introHtml || ''}</p>
        ${profilePlatformButtons()}
        ${contacts.length ? `<nav class="contacts" aria-label="Contact links">${contacts.map(contact => `
          <a class="contact-chip" href="${escapeHtml(contact.href)}" ${contact.href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="${escapeHtml(contact.label)}" title="${escapeHtml(contact.label)}">
            ${icons[contact.icon] || icons.generic}<span>${escapeHtml(contact.label)}</span>
          </a>`).join('')}</nav>` : ''}
      </div>
      <div class="profile-tools">
        <div class="visit-counter" id="visit-counter" aria-label="${escapeHtml(t('visitsCount', { count: currentVisitCount }))}">
          <span class="visit-counter-label">${escapeHtml(t('visitsLabel'))}</span>
          <div class="visit-counter-digits" aria-hidden="true">
            ${Array.from({ length: 8 }, () => '<img class="visit-counter-digit" src="assets/images/counter/0.png" alt="">').join('')}
          </div>
          <span class="sr-only" id="visit-counter-value" aria-live="polite">${escapeHtml(t('visitsCount', { count: currentVisitCount }))}</span>
        </div>
        ${languageSwitcherHtml()}
      </div>`;
  }

  function updateStaticUi() {
    const htmlLanguage = data.languages[currentLanguage]?.htmlLang || currentLanguage;
    document.documentElement.lang = htmlLanguage;

    const meta = document.querySelector('meta[name="description"]');
    const translatedMeta = data.translations?.[currentLanguage]?.metaDescription || data.translations?.en?.metaDescription;
    if (meta && translatedMeta) meta.setAttribute('content', translatedMeta);

    const catalog = document.querySelector('.catalog');
    if (catalog) catalog.setAttribute('aria-label', t('catalogAria'));
    searchEl.placeholder = t('searchPlaceholder');
    searchEl.setAttribute('aria-label', t('searchAria'));
    emptyEl.textContent = t('emptyState');
    if (paginationEl) paginationEl.setAttribute('aria-label', t('paginationAria'));

    lightbox.setAttribute('aria-label', t('imageGallery'));
    closeButton.setAttribute('aria-label', t('closeGallery'));
    prevButton.setAttribute('aria-label', t('previousImage'));
    nextButton.setAttribute('aria-label', t('nextImage'));
  }

  function closeLanguageMenu() {
    const toggle = document.getElementById('language-toggle');
    const menu = document.getElementById('language-menu');
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  }

  function toggleLanguageMenu() {
    const toggle = document.getElementById('language-toggle');
    const menu = document.getElementById('language-menu');
    if (!toggle || !menu) return;
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  }

  function setLanguage(language) {
    if (!supportedLanguages.includes(language)) return;
    if (language === currentLanguage) {
      closeLanguageMenu();
      return;
    }

    currentLanguage = language;
    saveLanguage(language);
    updateStaticUi();
    renderProfile();
    renderVisitCount(currentVisitCount);
    renderAssets();

    const assetId = assetIdFromHash();
    if (assetId) {
      const card = document.getElementById(assetId);
      if (card) setCardOpen(card, true, { scroll: false });
    }
  }

  const VISIT_COUNTER = {
    apiBase: 'https://countapi.mileshilliard.com/api/v1',
    key: 'kurai-primo-github-visits-2026-e4aeca852b54922c',
    cookieName: 'kurai_visit_counted',
    cookieMaxAge: 24 * 60 * 60,
    storageKey: 'kurai_visit_counter_last'
  };

  function hasCookie(name) {
    return document.cookie.split(';').some(part => part.trim().startsWith(`${name}=`));
  }

  function setVisitCookie() {
    let cookie = `${VISIT_COUNTER.cookieName}=1; Max-Age=${VISIT_COUNTER.cookieMaxAge}; Path=/; SameSite=Lax`;
    if (location.protocol === 'https:') cookie += '; Secure';
    document.cookie = cookie;
  }

  function getCachedVisitCount() {
    try {
      const value = Number.parseInt(localStorage.getItem(VISIT_COUNTER.storageKey), 10);
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch {
      return null;
    }
  }

  function cacheVisitCount(value) {
    try {
      localStorage.setItem(VISIT_COUNTER.storageKey, String(value));
    } catch {
      // The counter still works when localStorage is unavailable.
    }
  }

  function renderVisitCount(value) {
    const numericValue = Math.max(0, Math.floor(Number(value) || 0));
    currentVisitCount = numericValue;
    const displayValue = String(numericValue).padStart(8, '0').slice(-8);
    const counterEl = document.getElementById('visit-counter');
    const textEl = document.getElementById('visit-counter-value');
    if (!counterEl) return;

    counterEl.querySelectorAll('.visit-counter-digit').forEach((img, index) => {
      const digit = displayValue[index];
      if (!img.src.endsWith(`/${digit}.png`)) img.src = `assets/images/counter/${digit}.png`;
    });

    const locale = data.languages[currentLanguage]?.htmlLang || 'en-US';
    const formattedCount = numericValue.toLocaleString(locale);
    const visitText = t('visitsCount', { count: formattedCount });
    counterEl.dataset.value = String(numericValue);
    counterEl.title = visitText;
    counterEl.setAttribute('aria-label', visitText);
    if (textEl) textEl.textContent = visitText;
  }

  async function initVisitCounter() {
    const cachedValue = getCachedVisitCount();
    renderVisitCount(cachedValue ?? 0);

    // Never increment the real counter while previewing index.html locally.
    if (location.hostname !== 'kurai-primo.github.io') return;

    const alreadyCounted = hasCookie(VISIT_COUNTER.cookieName);
    const action = alreadyCounted ? 'get' : 'hit';
    const endpoint = `${VISIT_COUNTER.apiBase}/${action}/${encodeURIComponent(VISIT_COUNTER.key)}`;

    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Visitor counter returned ${response.status}`);

      const payload = await response.json();
      const value = Number.parseInt(payload.value, 10);
      if (!Number.isFinite(value) || value < 0) throw new Error('Visitor counter returned an invalid value');

      renderVisitCount(value);
      cacheVisitCount(value);
      if (!alreadyCounted) setVisitCookie();
    } catch (error) {
      console.warn('Visitor counter unavailable; showing cached value.', error);
    }
  }

  function platformButtons(asset) {
    const stores = asset.stores || {};
    const platforms = [
      {
        key: 'fab',
        label: 'Unreal',
        ariaLabel: t('openFab'),
        icon: '<img class="platform-icon-image unreal-icon" src="assets/images/ui/unreal.png" alt="">'
      },
      {
        key: 'unity',
        label: 'Unity',
        ariaLabel: t('openUnity'),
        icon: icons.unity
      }
    ];

    return `<div class="store-shortcuts" aria-label="${escapeHtml(t('storeLinks'))}">${platforms.map(platform => {
      const href = (stores[platform.key] || '').trim();
      const content = `${platform.icon}<span class="platform-label">${platform.label}</span>`;
      if (href) {
        return `<a class="platform-button platform-${platform.key}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(platform.ariaLabel)}" title="${escapeHtml(platform.ariaLabel)}">${content}</a>`;
      }
      const unavailable = t('notAvailable', { platform: platform.label });
      return `<span class="platform-button platform-${platform.key} is-disabled" aria-disabled="true" title="${escapeHtml(unavailable)}">${content}</span>`;
    }).join('')}</div>`;
  }

  function extraActionButtons(asset) {
    if (!asset.youtube) return '';
    return `<div class="store-row"><a class="store-button youtube-button" href="${escapeHtml(asset.youtube)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('watchYouTube'))}</a></div>`;
  }

  function showToast(message) {
    const toast = document.getElementById('site-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function normalizeSearch(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function assetSearchText(asset) {
    const localizedContent = Object.values(asset.i18n || {}).flatMap(content => [
      content?.title || '',
      content?.description || '',
      ...(content?.tags || [])
    ]);
    return normalizeSearch([...localizedContent, ...(asset.keywords || [])].join(' '));
  }

  function assetMatches(asset, query) {
    if (!query) return true;
    const haystack = assetSearchText(asset);
    return normalizeSearch(query).split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
  }

  function filteredAssets() {
    const query = searchEl.value.trim();
    return data.assets.filter(asset => assetMatches(asset, query));
  }

  function paginationItems(totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const items = [1];
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 4) {
      start = 2;
      end = 4;
    } else if (currentPage >= totalPages - 3) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    if (start > 2) items.push('ellipsis-left');
    for (let page = start; page <= end; page += 1) items.push(page);
    if (end < totalPages - 1) items.push('ellipsis-right');
    items.push(totalPages);
    return items;
  }

  function renderPagination(totalPages) {
    if (!paginationEl) return;

    const shouldShow = totalPages > 1;
    paginationEl.hidden = !shouldShow;
    if (!shouldShow) {
      paginationEl.innerHTML = '';
      return;
    }

    const items = paginationItems(totalPages);
    const pageButtons = items.map(item => {
      if (typeof item !== 'number') return '<span class="pagination-ellipsis" aria-hidden="true">…</span>';
      const active = item === currentPage;
      return `<button class="pagination-button pagination-number${active ? ' is-active' : ''}" type="button" data-page="${item}" ${active ? 'aria-current="page"' : ''} aria-label="${escapeHtml(t('pageLabel', { page: item }))}"><span>${item}</span></button>`;
    }).join('');

    paginationEl.innerHTML = `
      <button class="pagination-button pagination-arrow" type="button" data-page="${currentPage - 1}" aria-label="${escapeHtml(t('previousPage'))}" ${currentPage <= 1 ? 'disabled' : ''}><span>‹</span></button>
      <div class="pagination-pages">${pageButtons}</div>
      <button class="pagination-button pagination-arrow" type="button" data-page="${currentPage + 1}" aria-label="${escapeHtml(t('nextPage'))}" ${currentPage >= totalPages ? 'disabled' : ''}><span>›</span></button>`;
  }

  function renderAssets() {
    const matches = filteredAssets();
    const totalPages = Math.max(1, Math.ceil(matches.length / assetsPerPage));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    const startIndex = (currentPage - 1) * assetsPerPage;
    const visible = matches.slice(startIndex, startIndex + assetsPerPage);

    listEl.innerHTML = visible.map(baseAsset => {
      const asset = localizedAsset(baseAsset);
      const gallery = (asset.gallery || []).filter(Boolean);
      const hasExtraGallery = gallery.length > 1;
      const safeTitle = escapeHtml(asset.title);

      return `<article class="asset-card" id="${escapeHtml(asset.id)}" data-asset-id="${escapeHtml(asset.id)}">
        <div class="asset-tabs">
          <div class="asset-title-tab">
            <h2 class="asset-title"><a class="asset-title-link" href="#${encodeURIComponent(asset.id)}">${safeTitle}</a></h2>
          </div>
          <div class="asset-tabs-gap" aria-hidden="true"></div>
          <div class="asset-copy-tab">
            <button class="copy-link-button" type="button" aria-label="${escapeHtml(t('copyLinkTo', { title: asset.title }))}" title="${escapeHtml(t('copyLink'))}">
              ${icons.generic}
            </button>
          </div>
        </div>
        <div class="asset-card-body">
          <div class="asset-head">
            ${(asset.tags || []).length ? `<div class="asset-tags">${asset.tags.map(tag => `<button class="asset-tag" type="button" title="${escapeHtml(t('searchFor', { tag }))}">${escapeHtml(tag)}</button>`).join('')}</div>` : ''}
            <img class="asset-main js-gallery-image" src="${escapeHtml(asset.mainImage)}" alt="${escapeHtml(t('previewAlt', { title: asset.title }))}" loading="lazy" decoding="async" data-gallery-index="0">
          </div>
          <div class="asset-actions">
            ${platformButtons(asset)}
            <button class="details-button" type="button" aria-expanded="false">${escapeHtml(t('details'))}</button>
          </div>
          <div class="asset-details" aria-hidden="true">
            <div class="asset-details-inner">
              <div class="asset-details-content">
                <p class="asset-description">${escapeHtml(asset.description)}</p>
                ${hasExtraGallery ? '<div class="gallery-grid" data-gallery-grid></div>' : ''}
                ${extraActionButtons(asset)}
              </div>
            </div>
          </div>
        </div>
      </article>`;
    }).join('');

    emptyEl.hidden = matches.length !== 0;
    renderPagination(matches.length ? totalPages : 0);
    bindAssetInteractions();

    const assetId = assetIdFromHash();
    const card = assetId ? document.getElementById(assetId) : null;
    if (card) setCardOpen(card, true, { scroll: false });
  }

  function clearAssetHash() {
    if (!assetIdFromHash()) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }

  function goToPage(page, { scroll = true } = {}) {
    const matches = filteredAssets();
    const totalPages = Math.max(1, Math.ceil(matches.length / assetsPerPage));
    const nextPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    if (nextPage === currentPage) return;

    currentPage = nextPage;
    clearAssetHash();
    renderAssets();

    if (scroll) {
      requestAnimationFrame(() => (catalogEl || searchEl).scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function bindGalleryImage(img, asset) {
    if (!img || img.dataset.galleryBound === 'true') return;
    img.dataset.galleryBound = 'true';
    img.addEventListener('click', () => {
      openLightbox(asset.gallery || [asset.mainImage], Number(img.dataset.galleryIndex || 0), asset.title);
    });
  }

  function ensureGalleryLoaded(card) {
    const grid = card?.querySelector('[data-gallery-grid]');
    if (!grid || grid.dataset.loaded === 'true') return;

    const baseAsset = data.assets.find(asset => asset.id === card.dataset.assetId);
    if (!baseAsset) return;
    const asset = localizedAsset(baseAsset);
    const extraGallery = (asset.gallery || []).filter(Boolean).slice(1);

    grid.innerHTML = extraGallery.map((src, index) =>
      `<img class="gallery-thumb js-gallery-image" src="${escapeHtml(src)}" alt="${escapeHtml(t('galleryAlt', { title: asset.title, index: index + 2 }))}" loading="lazy" decoding="async" fetchpriority="low" data-gallery-index="${index + 1}">`
    ).join('');
    grid.dataset.loaded = 'true';
    grid.querySelectorAll('.js-gallery-image').forEach(img => bindGalleryImage(img, asset));
  }

  function setCardOpen(card, open, { scroll = true } = {}) {
    if (!card) return;
    const detailsBtn = card.querySelector('.details-button');
    const details = card.querySelector('.asset-details');
    if (!detailsBtn || !details) return;

    if (open) ensureGalleryLoaded(card);

    card.classList.toggle('is-open', open);
    detailsBtn.setAttribute('aria-expanded', String(open));
    detailsBtn.textContent = open ? t('hideDetails') : t('details');
    details.setAttribute('aria-hidden', String(!open));

    if (open && scroll) requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function assetIdFromHash() {
    if (!location.hash || location.hash.length < 2) return '';
    try {
      return decodeURIComponent(location.hash.slice(1));
    } catch {
      return location.hash.slice(1);
    }
  }

  function assetShareUrl(assetId) {
    const url = new URL(window.location.href);
    url.hash = assetId;
    return url.toString();
  }

  async function copyAssetLink(assetId, button) {
    const url = assetShareUrl(assetId);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }

      showToast(t('linkCopied'));
      button.classList.add('is-copied');
      button.title = t('copied');
      button.setAttribute('aria-label', t('linkCopied'));

      window.setTimeout(() => {
        button.classList.remove('is-copied');
        button.title = t('copyLink');
        button.setAttribute('aria-label', t('copyAssetLink'));
      }, 1400);
    } catch (error) {
      console.error('Could not copy asset link:', error);
      window.prompt(t('copyPrompt'), url);
    }
  }

  function openAssetFromHash({ behavior = 'smooth' } = {}) {
    const assetId = assetIdFromHash();
    if (!assetId) return;

    const asset = data.assets.find(item => item.id === assetId);
    if (!asset) return;

    const activeQuery = searchEl.value.trim();
    if (activeQuery && !assetMatches(asset, activeQuery)) searchEl.value = '';

    const matches = filteredAssets();
    const assetIndex = matches.findIndex(item => item.id === assetId);
    if (assetIndex < 0) return;

    currentPage = Math.floor(assetIndex / assetsPerPage) + 1;
    renderAssets();

    requestAnimationFrame(() => {
      const card = document.getElementById(assetId);
      if (!card) return;
      setCardOpen(card, true, { scroll: false });
      card.scrollIntoView({ behavior, block: 'start' });
    });
  }

  function bindAssetInteractions() {
    document.querySelectorAll('.asset-card').forEach(card => {
      const baseAsset = data.assets.find(asset => asset.id === card.dataset.assetId);
      if (!baseAsset) return;
      const asset = localizedAsset(baseAsset);
      const detailsBtn = card.querySelector('.details-button');
      const copyLinkBtn = card.querySelector('.copy-link-button');
      const titleLink = card.querySelector('.asset-title-link');

      detailsBtn?.addEventListener('click', () => {
        const willOpen = !card.classList.contains('is-open');
        setCardOpen(card, willOpen);
      });

      copyLinkBtn?.addEventListener('click', () => copyAssetLink(asset.id, copyLinkBtn));

      titleLink?.addEventListener('click', event => {
        event.preventDefault();
        setCardOpen(card, true);
      });

      card.querySelectorAll('.asset-tag').forEach(tagButton => {
        tagButton.addEventListener('click', () => {
          searchEl.value = tagButton.textContent.trim();
          currentPage = 1;
          clearAssetHash();
          renderAssets();
          searchEl.focus({ preventScroll: true });
        });
      });

      card.querySelectorAll('.js-gallery-image').forEach(img => bindGalleryImage(img, asset));
    });
  }

  function openLightbox(gallery, index, title) {
    currentGallery = gallery.filter(Boolean);
    currentIndex = Math.max(0, Math.min(index, currentGallery.length - 1));
    lightboxImage.dataset.title = title || 'Asset image';
    updateLightbox();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    closeButton.focus();
  }

  function updateLightbox() {
    if (!currentGallery.length) return;
    lightboxImage.src = currentGallery[currentIndex];
    lightboxImage.alt = t('imageAlt', { title: lightboxImage.dataset.title || 'Asset', index: currentIndex + 1 });
    lightboxCounter.textContent = `${currentIndex + 1} / ${currentGallery.length}`;
    const multiple = currentGallery.length > 1;
    prevButton.hidden = !multiple;
    nextButton.hidden = !multiple;
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
  }

  function moveLightbox(delta) {
    if (!currentGallery.length) return;
    currentIndex = (currentIndex + delta + currentGallery.length) % currentGallery.length;
    updateLightbox();
  }

  searchEl.addEventListener('input', () => {
    currentPage = 1;
    clearAssetHash();
    renderAssets();
  });

  window.addEventListener('hashchange', () => openAssetFromHash({ behavior: 'smooth' }));

  paginationEl?.addEventListener('click', event => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    goToPage(Number(button.dataset.page));
  });

  document.addEventListener('click', event => {
    const toggle = event.target.closest('#language-toggle');
    if (toggle) {
      toggleLanguageMenu();
      return;
    }

    const languageOption = event.target.closest('.language-option[data-language]');
    if (languageOption) {
      setLanguage(languageOption.dataset.language);
      return;
    }

    if (!event.target.closest('#language-switcher')) closeLanguageMenu();
  });

  closeButton.addEventListener('click', closeLightbox);
  prevButton.addEventListener('click', () => moveLightbox(-1));
  nextButton.addEventListener('click', () => moveLightbox(1));
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeLanguageMenu();
    if (!lightbox.classList.contains('is-open')) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') moveLightbox(-1);
    if (event.key === 'ArrowRight') moveLightbox(1);
  });

  lightbox.addEventListener('touchstart', event => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', event => {
    if (touchStartX == null) return;
    const dx = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 45) moveLightbox(dx > 0 ? -1 : 1);
    touchStartX = null;
  }, { passive: true });

  document.getElementById('year').textContent = new Date().getFullYear();
  updateStaticUi();
  renderProfile();
  initVisitCounter();

  const initialAssetId = assetIdFromHash();
  const initialAssetIndex = data.assets.findIndex(asset => asset.id === initialAssetId);
  if (initialAssetIndex >= 0) currentPage = Math.floor(initialAssetIndex / assetsPerPage) + 1;

  renderAssets();
  if (initialAssetIndex >= 0) openAssetFromHash({ behavior: 'auto' });
})();
