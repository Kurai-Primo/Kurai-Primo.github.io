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

  const icons = {
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="m4.5 7.5 7.5 6 7.5-6"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3.7 10.8c-.9.35-.86 1.62.06 1.92l4.42 1.45 1.64 5.02c.28.86 1.39 1.09 1.99.41l2.46-2.77 4.17 3.08c.72.53 1.75.12 1.91-.76L22 5.4C22.2 4.31 21.98 3.62 21 4Z"/><path d="m8.25 14.16 10.1-6.76"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12s0-4.1-.53-5.6a2.7 2.7 0 0 0-1.87-1.87C17.1 4 12 4 12 4s-5.1 0-6.6.53A2.7 2.7 0 0 0 3.53 6.4C3 7.9 3 12 3 12s0 4.1.53 5.6a2.7 2.7 0 0 0 1.87 1.87C6.9 20 12 20 12 20s5.1 0 6.6-.53a2.7 2.7 0 0 0 1.87-1.87C21 16.1 21 12 21 12Z"/><path d="m10 9 5 3-5 3Z"/></svg>',
    generic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"/></svg>'
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

  function actionButtons(asset) {
    const stores = asset.stores || {};
    const buttons = [];
    if (stores.fab) buttons.push(`<a class="store-button primary" href="${stores.fab}" target="_blank" rel="noopener noreferrer">Buy on Fab</a>`);
    if (stores.unity) buttons.push(`<a class="store-button secondary" href="${stores.unity}" target="_blank" rel="noopener noreferrer">Buy on Unity</a>`);
    if (asset.youtube) buttons.push(`<a class="store-button youtube-button" href="${asset.youtube}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>`);
    return buttons.length ? `<div class="store-row">${buttons.join('')}</div>` : '';
  }

  function assetMatches(asset, query) {
    if (!query) return true;
    const haystack = [asset.title, asset.description, ...(asset.keywords || [])].join(' ').toLowerCase();
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
            ${(asset.tags || []).length ? `<div class="asset-tags">${asset.tags.map(tag => `<span class="asset-tag">${tag}</span>`).join('')}</div>` : ''}
            <img class="asset-main js-gallery-image" src="${asset.mainImage}" alt="${asset.title} preview" loading="lazy" data-gallery-index="0">
          </div>
          <div class="asset-actions">
            <button class="details-button" type="button" aria-expanded="false">Details</button>
          </div>
          <div class="asset-details" aria-hidden="true">
            <div class="asset-details-inner">
              <div class="asset-details-content">
                <p class="asset-description">${asset.description}</p>
                ${extraGallery.length ? `<div class="gallery-grid">${extraGallery.map((src, i) => `<img class="gallery-thumb js-gallery-image" src="${src}" alt="${asset.title} gallery image ${i + 2}" loading="lazy" data-gallery-index="${i + 1}">`).join('')}</div>` : ''}
                ${actionButtons(asset)}
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
