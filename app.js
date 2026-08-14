(() => {
  const data = window.SITE_DATA;
  const profileEl = document.getElementById('profile');
  const listEl = document.getElementById('asset-list');
  const searchEl = document.getElementById('asset-search');
  const emptyEl = document.getElementById('empty-state');
  const loadMoreEl = document.getElementById('load-more');

  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const closeButton = lightbox.querySelector('.lightbox-close');
  const prevButton = lightbox.querySelector('.lightbox-prev');
  const nextButton = lightbox.querySelector('.lightbox-next');

  let visibleCount = data.settings.initialVisibleAssets || 5;
  let currentGallery = [];
  let currentIndex = 0;
  let touchStartX = null;
  let toastTimer = null;

  const icons = {
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="m4.5 7.5 7.5 6 7.5-6"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3.7 10.8c-.9.35-.86 1.62.06 1.92l4.42 1.45 1.64 5.02c.28.86 1.39 1.09 1.99.41l2.46-2.77 4.17 3.08c.72.53 1.75.12 1.91-.76L22 5.4C22.2 4.31 21.98 3.62 21 4Z"/><path d="m8.25 14.16 10.1-6.76"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12s0-4.1-.53-5.6a2.7 2.7 0 0 0-1.87-1.87C17.1 4 12 4 12 4s-5.1 0-6.6.53A2.7 2.7 0 0 0 3.53 6.4C3 7.9 3 12 3 12s0 4.1.53 5.6a2.7 2.7 0 0 0 1.87 1.87C6.9 20 12 20 12 20s5.1 0 6.6-.53a2.7 2.7 0 0 0 1.87-1.87C21 16.1 21 12 21 12Z"/><path d="m10 9 5 3-5 3Z"/></svg>',
    generic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="2.4"/><rect x="8" y="8" width="12" height="12" rx="2.4"/></svg>',
    unreal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.25"/><path d="M7.1 7.1v6.1c0 3 1.7 4.8 4.5 4.8 2.1 0 3.7-.9 4.9-2.6v2.1l2-1V6.3l-3.4 1.8v4.8c0 1.9-.9 3-2.5 3-1.5 0-2.3-.9-2.3-2.8V7.1H7.1Z"/></svg>',
    unity: '<svg viewBox="0 0 448 512" aria-hidden="true"><path d="M243.583 91.6027L323.695 138.384C326.575 140.026 326.68 144.583 323.695 146.225L228.503 201.854C225.623 203.55 222.22 203.444 219.549 201.854L124.357 146.225C121.425 144.636 121.373 139.973 124.357 138.384L204.417 91.6027V0L0 119.417V358.252L78.3843 312.477V218.914C78.3319 215.576 82.2066 213.192 85.0865 214.993L180.279 270.622C183.159 272.318 184.782 275.338 184.782 278.464V389.669C184.834 393.007 180.959 395.391 178.079 393.589L97.9673 346.808L19.583 392.583L224 512L428.417 392.583L350.033 346.808L269.921 393.589C267.093 395.338 263.114 393.06 263.218 389.669V278.464C263.218 275.126 265.051 272.159 267.721 270.622L362.914 214.993C365.741 213.245 369.72 215.47 369.616 218.914V312.477L448 358.252V119.417L243.583 0V91.6027Z"/></svg>'
  };

  function renderProfile() {
    const contacts = (data.profile.contacts || []).filter(c => c && c.href && c.label);
    profileEl.innerHTML = `
      <img class="profile-avatar" src="${data.profile.avatar}" alt="Kurai avatar">
      <div class="profile-content">
        <h1 class="profile-title">${data.profile.brand}</h1>
        <div class="profile-subtitle">${data.profile.subtitle || ''}</div>
        <p class="profile-intro">${data.profile.introHtml || ''}</p>
        ${contacts.length ? `<nav class="contacts" aria-label="Contact links">${contacts.map(c => `
          <a class="contact-chip" href="${c.href}" ${c.href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="${c.label}" title="${c.label}">
            ${icons[c.icon] || icons.generic}<span>${c.label}</span>
          </a>`).join('')}</nav>` : ''}
      </div>
      <div class="visit-counter" id="visit-counter" aria-label="Visitor counter">
        <span class="visit-counter-label">VISITS</span>
        <div class="visit-counter-digits" aria-hidden="true">
          ${Array.from({ length: 8 }, () => '<img class="visit-counter-digit" src="assets/images/counter/0.png" alt="">').join('')}
        </div>
        <span class="sr-only" id="visit-counter-value" aria-live="polite">0 visits</span>
      </div>`;
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
    const displayValue = String(numericValue).padStart(8, '0').slice(-8);
    const counterEl = document.getElementById('visit-counter');
    const textEl = document.getElementById('visit-counter-value');
    if (!counterEl) return;

    counterEl.querySelectorAll('.visit-counter-digit').forEach((img, index) => {
      const digit = displayValue[index];
      const src = `assets/images/counter/${digit}.png`;
      if (!img.src.endsWith(`/${digit}.png`)) img.src = src;
    });

    counterEl.dataset.value = String(numericValue);
    counterEl.title = `${numericValue.toLocaleString('en-US')} visits`;
    if (textEl) textEl.textContent = `${numericValue.toLocaleString('en-US')} visits`;
  }

  async function initVisitCounter() {
    const cachedValue = getCachedVisitCount();
    renderVisitCount(cachedValue ?? 0);

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
        ariaLabel: 'Open on Fab / Unreal Engine',
        icon: '<img class="platform-icon-image unreal-icon" src="assets/images/ui/unreal.png" alt="">'
      },
      {
        key: 'unity',
        label: 'Unity',
        ariaLabel: 'Open on Unity Asset Store',
        icon: icons.unity
      }
    ];

    return `<div class="store-shortcuts" aria-label="Store links">${platforms.map(platform => {
      const href = (stores[platform.key] || '').trim();
      const content = `${platform.icon}<span class="platform-label">${platform.label}</span>`;
      if (href) {
        return `<a class="platform-button platform-${platform.key}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${platform.ariaLabel}" title="${platform.ariaLabel}">${content}</a>`;
      }
      return `<span class="platform-button platform-${platform.key} is-disabled" aria-disabled="true" title="${platform.label} version is not available yet">${content}</span>`;
    }).join('')}</div>`;
  }

  function extraActionButtons(asset) {
    if (!asset.youtube) return '';
    return `<div class="store-row"><a class="store-button youtube-button" href="${asset.youtube}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a></div>`;
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

  function assetMatches(asset, query) {
    if (!query) return true;
    const haystack = [asset.title, asset.description, ...(asset.tags || []), ...(asset.keywords || [])].join(' ').toLowerCase();
    return query.split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
  }

  function renderAssets() {
    const query = searchEl.value.trim().toLowerCase();
    const matches = data.assets.filter(a => assetMatches(a, query));
    const visible = matches.slice(0, visibleCount);

    listEl.innerHTML = visible.map(asset => {
      const gallery = (asset.gallery || []).filter(Boolean);
      const extraGallery = gallery.slice(1);
      return `
      <article class="asset-card" id="${asset.id}" data-asset-id="${asset.id}">
        <div class="asset-tabs">
          <div class="asset-title-tab">
            <h2 class="asset-title"><a class="asset-title-link" href="#${asset.id}">${asset.title}</a></h2>
          </div>
          <div class="asset-tabs-gap" aria-hidden="true"></div>
          <div class="asset-copy-tab">
            <button class="copy-link-button" type="button" aria-label="Copy link to ${asset.title}" title="Copy link">
              ${icons.generic}
            </button>
          </div>
        </div>
        <div class="asset-card-body">
          <div class="asset-head">
            ${(asset.tags || []).length ? `<div class="asset-tags">${asset.tags.map(tag => `<button class="asset-tag" type="button" title="Search for ${tag}">${tag}</button>`).join('')}</div>` : ''}
            <img class="asset-main js-gallery-image" src="${asset.mainImage}" alt="${asset.title} preview" loading="lazy" data-gallery-index="0">
          </div>
          <div class="asset-actions">
            ${platformButtons(asset)}
            <button class="details-button" type="button" aria-expanded="false">Details</button>
          </div>
          <div class="asset-details" aria-hidden="true">
            <div class="asset-details-inner">
              <div class="asset-details-content">
                <p class="asset-description">${asset.description}</p>
                ${extraGallery.length ? `<div class="gallery-grid">${extraGallery.map((src, i) => `<img class="gallery-thumb js-gallery-image" src="${src}" alt="${asset.title} gallery image ${i + 2}" loading="lazy" data-gallery-index="${i + 1}">`).join('')}</div>` : ''}
                ${extraActionButtons(asset)}
              </div>
            </div>
          </div>
        </div>
      </article>`;
    }).join('');

    emptyEl.hidden = matches.length !== 0;
    loadMoreEl.hidden = visible.length >= matches.length;

    bindAssetInteractions();
  }

  function setCardOpen(card, open, { scroll = true } = {}) {
    if (!card) return;
    const detailsBtn = card.querySelector('.details-button');
    const details = card.querySelector('.asset-details');

    card.classList.toggle('is-open', open);
    detailsBtn.setAttribute('aria-expanded', String(open));
    detailsBtn.textContent = open ? 'Hide details' : 'Details';
    details.setAttribute('aria-hidden', String(!open));

    if (open && scroll) {
      requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
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

      history.replaceState(null, '', `#${assetId}`);
      showToast('Link copied!');
      button.classList.add('is-copied');
      button.title = 'Copied!';
      button.setAttribute('aria-label', 'Link copied');

      window.setTimeout(() => {
        button.classList.remove('is-copied');
        button.title = 'Copy link';
        button.setAttribute('aria-label', 'Copy asset link');
      }, 1400);
    } catch (error) {
      console.error('Could not copy asset link:', error);
      window.prompt('Copy this link:', url);
    }
  }

  function openAssetFromHash({ behavior = 'smooth' } = {}) {
    const assetId = assetIdFromHash();
    if (!assetId) return;

    const assetIndex = data.assets.findIndex(asset => asset.id === assetId);
    if (assetIndex < 0) return;

    if (assetIndex >= visibleCount) {
      visibleCount = assetIndex + 1;
      renderAssets();
    }

    requestAnimationFrame(() => {
      const card = document.getElementById(assetId);
      if (!card) return;
      setCardOpen(card, true, { scroll: false });
      card.scrollIntoView({ behavior, block: 'start' });
    });
  }

  function bindAssetInteractions() {
    document.querySelectorAll('.asset-card').forEach(card => {
      const asset = data.assets.find(a => a.id === card.dataset.assetId);
      const detailsBtn = card.querySelector('.details-button');
      const copyLinkBtn = card.querySelector('.copy-link-button');
      const titleLink = card.querySelector('.asset-title-link');

      detailsBtn.addEventListener('click', () => {
        const willOpen = !card.classList.contains('is-open');
        setCardOpen(card, willOpen);
        if (willOpen) history.replaceState(null, '', `#${asset.id}`);
      });

      copyLinkBtn.addEventListener('click', () => copyAssetLink(asset.id, copyLinkBtn));

      titleLink.addEventListener('click', () => {
        if (assetIdFromHash() === asset.id) {
          setCardOpen(card, true);
        }
      });

      card.querySelectorAll('.asset-tag').forEach(tagButton => {
        tagButton.addEventListener('click', () => {
          searchEl.value = tagButton.textContent.trim();
          visibleCount = data.settings.initialVisibleAssets || 5;
          renderAssets();
        });
      });

      card.querySelectorAll('.js-gallery-image').forEach(img => {
        img.addEventListener('click', () => openLightbox(asset.gallery || [asset.mainImage], Number(img.dataset.galleryIndex || 0), asset.title));
      });
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
    lightboxImage.alt = `${lightboxImage.dataset.title || 'Asset image'} — image ${currentIndex + 1}`;
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

  searchEl.addEventListener('input', () => { visibleCount = data.settings.initialVisibleAssets || 5; renderAssets(); });
  window.addEventListener('hashchange', () => openAssetFromHash({ behavior: 'smooth' }));
  loadMoreEl.addEventListener('click', () => { visibleCount += data.settings.loadMoreStep || 5; renderAssets(); });

  closeButton.addEventListener('click', closeLightbox);
  prevButton.addEventListener('click', () => moveLightbox(-1));
  nextButton.addEventListener('click', () => moveLightbox(1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') moveLightbox(-1);
    if (e.key === 'ArrowRight') moveLightbox(1);
  });

  lightbox.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, {passive:true});
  lightbox.addEventListener('touchend', e => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 45) moveLightbox(dx > 0 ? -1 : 1);
    touchStartX = null;
  }, {passive:true});

  document.getElementById('year').textContent = new Date().getFullYear();
  renderProfile();
  initVisitCounter();

  const initialAssetId = assetIdFromHash();
  const initialAssetIndex = data.assets.findIndex(asset => asset.id === initialAssetId);
  if (initialAssetIndex >= 0) visibleCount = Math.max(visibleCount, initialAssetIndex + 1);

  renderAssets();
  if (initialAssetIndex >= 0) openAssetFromHash({ behavior: 'auto' });
})();
