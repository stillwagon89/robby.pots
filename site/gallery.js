// Shared gallery component. Pieces now come live from Square (see
// /api/gallery, functions/api/gallery.ts) — add/price/retire pieces in the
// Square Item Library, no edits needed here. Which page a piece appears on
// is set by its Square categories: "Website" (Ceramics page), "Main Page"
// (homepage), "Folsom" (Folsom Collection page), "Everywhere" (all three).
//
// GALLERY_PIECES below is a fallback only, used if /api/gallery returns
// nothing (e.g. before Square is fully set up, or if the sync fails), so
// the site never shows a blank gallery. The Folsom page doesn't use it
// (these aren't Folsom pieces); it shows an empty message instead. Once Square is the confirmed
// source of truth for every piece, this fallback array can be deleted.
//
const GALLERY_PIECES = [
  {
    title: 'Moon Jar',
    materials: 'Stoneware · celadon glaze, iron-oxide rim',
    img: 'moon-jar.jpg',
    alt: 'Moon Jar'
  },
  {
    title: 'Matching Mug Set',
    materials: 'Stoneware · glossy speckled glaze',
    img: 'mug2.png',
    alt: 'Matching Mug Set'
  },
  {
    title: 'Serving Tray',
    materials: '',
    img: 'assets/gallery/serving-tray.jpg',
    alt: 'Serving Tray'
  },
  {
    title: 'Speckled Cream Mug',
    materials: '',
    img: 'assets/gallery/mug-cream.jpg',
    alt: 'Speckled Cream Mug'
  },
  {
    title: 'Black Glazed Mug',
    materials: '',
    img: 'assets/gallery/mug-black.jpg',
    alt: 'Black Glazed Mug'
  },
  {
    title: 'Blue Lidded Jar',
    materials: '',
    img: 'assets/gallery/jar-blue.jpg',
    alt: 'Blue Lidded Jar'
  },
  {
    title: 'White Tumbler',
    materials: '',
    img: 'assets/gallery/tumbler-white.jpg',
    alt: 'White Tumbler'
  },
  {
    title: 'Wave Teapot',
    materials: '',
    img: 'assets/gallery/teapot-green.webp',
    alt: 'Wave Teapot'
  },
  {
    title: 'Gong Fu Style Teapot',
    materials: '',
    img: 'assets/gallery/teapot-gongfu.jpg',
    alt: 'Gong Fu Style Teapot'
    // No prices or buy links here on purpose: this list only shows when the
    // live feed is down, and a hardcoded link can't know a piece has sold.
  }
];

// ---------- Photos ----------
// Square stores full-size originals (avg ~600 KB, up to 2 MB each). Cloudflare
// image resizing serves each one at the size its slot needs, as WebP/AVIF.
// If resizing is off for this domain (or on robbypots.pages.dev, where it
// never works) the /cdn-cgi/image URL fails; imgFallback swaps in the
// original and remembers that for the rest of the visit.
const RESIZE_OFF_KEY = 'fc-resize-off';
function resizeOff() {
  try { return sessionStorage.getItem(RESIZE_OFF_KEY) === '1'; } catch (e) { return false; }
}
function sizedUrl(src, w) {
  return '/cdn-cgi/image/width=' + w + ',quality=80,format=auto,fit=scale-down/' + src;
}
function canResize(src) {
  return /^https:\/\//.test(src) && !resizeOff();
}
function srcsetFor(src, widths) {
  return widths.map(w => sizedUrl(src, w) + ' ' + w + 'w').join(', ');
}
// widths: candidate pixel widths; sizes: the slot's CSS width; dims: [w, h]
// from the API so the browser reserves the right space before the photo loads.
function imgTag(src, opts) {
  const dims = opts.dims;
  let attrs = ' alt="' + escapeHtml(opts.alt || '') + '"' +
    (opts.id ? ' id="' + opts.id + '"' : '') +
    (opts.cls ? ' class="' + opts.cls + '"' : '') +
    (dims ? ' width="' + dims[0] + '" height="' + dims[1] + '"' : ' style="aspect-ratio: auto 4 / 5"') +
    (opts.lazy ? ' loading="lazy"' : '') +
    (opts.priority ? ' fetchpriority="high"' : '') +
    ' decoding="async"';
  if (!canResize(src)) return '<img src="' + src + '"' + attrs + '>';
  return '<img src="' + sizedUrl(src, opts.widths[1] || opts.widths[0]) + '" srcset="' + srcsetFor(src, opts.widths) +
    '" sizes="' + opts.sizes + '" data-orig="' + src + '" onerror="imgFallback(this)"' + attrs + '>';
}
function imgFallback(img) {
  const orig = img.dataset.orig;
  if (!orig || img.src === orig) return;
  try { sessionStorage.setItem(RESIZE_OFF_KEY, '1'); } catch (e) {}
  // Switch every other photo too, so lazy ones don't each fail first. Grids
  // are redrawn rather than edited: changing src on an existing lazy img (or
  // a cloned one) makes Chrome fetch it at once, loading the whole grid.
  document.querySelectorAll('.recent-work-grid').forEach(el => { if (el._pieces) layoutGallery(el); });
  document.querySelectorAll('img[data-orig]').forEach(i => {
    i.removeAttribute('srcset');
    i.removeAttribute('onerror');
    i.src = i.dataset.orig;
  });
}

// Pieces seen on a list page, so product.html can draw instantly from them
// instead of waiting on another API call (then it refreshes from the API).
const PIECES_KEY = 'fc-pieces';
function rememberPieces(live) {
  try {
    const all = JSON.parse(sessionStorage.getItem(PIECES_KEY) || '{}');
    live.forEach(p => { all[p.id] = p; });
    sessionStorage.setItem(PIECES_KEY, JSON.stringify(all));
  } catch (e) {}
}
function rememberedPiece(id) {
  try { return JSON.parse(sessionStorage.getItem(PIECES_KEY) || '{}')[id] || null; } catch (e) { return null; }
}

// ---------- Gallery grid ----------
const GRID_WIDTHS = [300, 450, 600, 800];
const GRID_SIZES = '(max-width: 768px) calc(50vw - 26px), 300px';
const TWO_COLUMNS = window.matchMedia('(max-width: 768px)');

// collection: 'all' (Shop page, every piece), 'website', 'home' or 'folsom'.
async function renderGallery(containerId, collection) {
  const el = document.getElementById(containerId);
  if (!el) return;
  collection = collection || 'website';

  let pieces = collection === 'folsom' ? [] : GALLERY_PIECES;
  try {
    const res = await fetch('/api/gallery?collection=' + collection);
    if (res.ok) {
      const live = await res.json();
      if (Array.isArray(live) && live.length) {
        rememberPieces(live);
        pieces = live.map(p => ({
          id: p.id,
          title: p.title,
          img: p.imageUrl,
          dims: (p.imageDims || [])[0] || null,
          alt: p.title,
          price: p.price,
          soldOut: p.soldOut
        }));
      }
    }
  } catch (err) {
    console.error('gallery fetch failed, using fallback pieces', err);
  }

  if (!pieces.length) {
    el.innerHTML = '<p class="gallery-empty">New pieces coming soon.</p>';
    return;
  }

  el._pieces = pieces;
  layoutGallery(el);
  if (!el._relayout) {
    el._relayout = () => layoutGallery(el);
    TWO_COLUMNS.addEventListener('change', el._relayout);
  }
}

// Masonry: each card goes into whichever column is currently shortest, in
// feed order (newest first). Unlike CSS columns, which fill column 1 top to
// bottom before starting column 2, this keeps the newest pieces in the top
// rows. Heights come from the photo dimensions the API sends.
function layoutGallery(el) {
  const pieces = el._pieces;
  const n = TWO_COLUMNS.matches ? 2 : 3;
  const cols = Array.from({ length: n }, () => ({ h: 0, html: [] }));
  pieces.forEach((piece, i) => {
    const col = cols.reduce((a, b) => (b.h < a.h ? b : a));
    const ratio = piece.dims ? piece.dims[1] / piece.dims[0] : 5 / 4;
    col.h += ratio + 0.2; // + title band
    col.html.push(cardHtml(piece, i < n * 2, i < n));
  });
  el.classList.add('masonry');
  el.innerHTML = cols.map(c => '<div class="masonry-col">' + c.html.join('') + '</div>').join('');
}

function cardHtml(piece, aboveFold, priority) {
  const media = imgTag(piece.img, {
    alt: piece.alt, dims: piece.dims, widths: GRID_WIDTHS, sizes: GRID_SIZES,
    lazy: !aboveFold, priority: priority
  });
  const tag = piece.soldOut
    ? '<span class="price-tag">SOLD</span>'
    : piece.price != null
    ? '<span class="price-tag">$' + piece.price + '</span>'
    : '';
  return '<a class="gallery-item' + (piece.soldOut ? ' sold' : '') + '"' +
    (piece.id ? ' href="product.html?id=' + encodeURIComponent(piece.id) + '"' : '') + '>' +
    '<div class="media">' + media + tag + '</div>' +
    '<div class="band"><p class="piece-title">' + escapeHtml(piece.title) + '</p></div>' +
    '</a>';
}


// Product page (product.html?id=<Square item id>): large photo, extra photos
// as thumbnails, title, status/price, description and a Buy button.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderProduct(containerId) {
  const el = document.getElementById(containerId);
  const id = new URLSearchParams(location.search).get('id');
  // Draw straight away from the list page's data when we have it, then
  // redraw only if the live API says something changed (e.g. it just sold).
  const remembered = rememberedPiece(id);
  if (remembered) drawProduct(el, remembered);
  let piece = null;
  try {
    const res = await fetch('/api/gallery?id=' + encodeURIComponent(id || ''));
    if (res.ok) piece = (await res.json())[0] || null;
  } catch (err) {
    console.error('product fetch failed', err);
  }
  if (piece && remembered && JSON.stringify(piece) === JSON.stringify(remembered)) return;
  if (!piece && remembered) return;
  if (!piece) {
    el.innerHTML = '<p class="gallery-empty">This piece could not be found. <a href="gallery.html">Back to Shop</a></p>';
    return;
  }
  rememberPieces([piece]);
  drawProduct(el, piece);
}

const PRODUCT_WIDTHS = [500, 800, 1200];
const PRODUCT_SIZES = '(max-width: 760px) calc(100vw - 40px), 520px';

function drawProduct(el, piece) {
  document.title = piece.title + ' — Flaming Clay Ceramics';
  const photos = piece.imageUrls && piece.imageUrls.length ? piece.imageUrls : [piece.imageUrl];
  const dims = piece.imageDims || [];
  const title = escapeHtml(piece.title);
  const status = piece.soldOut ? 'Sold' : 'Available';
  const price = piece.soldOut || piece.price == null ? '' : '<p class="product-price">$' + piece.price + '</p>';
  // Available but no checkout link yet (Square link creation failed or is
  // still pending): send buyers to the contact form rather than a dead end.
  const buy = piece.soldOut
    ? ''
    : piece.buyLink
    ? '<a class="product-buy" href="' + piece.buyLink + '" target="_blank" rel="noopener">Buy</a>'
    : '<a class="product-buy" href="contact.html">Ask about this piece</a>';
  const desc = piece.description
    ? piece.description.split(/\n\s*\n/).map(p => '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('')
    : '';

  el.innerHTML =
    '<a href="#" class="product-back" id="productBack">&larr; Back to Shop</a>' +
    '<div class="product-layout">' +
      '<div class="product-photos">' +
        imgTag(photos[0], { id: 'productMain', cls: 'product-main', alt: piece.title, dims: dims[0], widths: PRODUCT_WIDTHS, sizes: PRODUCT_SIZES, priority: true }) +
        (photos.length > 1
          ? '<div class="product-thumbs">' + photos.map((u, i) =>
              '<button type="button" class="product-thumb' + (i === 0 ? ' active' : '') + '" data-i="' + i + '" aria-label="Photo ' + (i + 1) + '">' +
                imgTag(u, { alt: '', dims: dims[i], widths: [160, 240], sizes: '80px' }) + '</button>'
            ).join('') + '</div>'
          : '') +
      '</div>' +
      '<div class="product-info">' +
        '<h1 class="product-title">' + title + '</h1>' +
        '<p class="product-status' + (piece.soldOut ? ' sold' : '') + '">' + status + '</p>' +
        price + buy +
        '<div class="product-desc">' + desc + '</div>' +
      '</div>' +
    '</div>' +
    // Phones: price + Buy pinned to the bottom of the screen, since a tall
    // photo pushes the in-page button below the fold.
    (buy ? '<div class="product-buy-bar">' + (piece.price != null ? '<span class="product-buy-bar-price">$' + piece.price + '</span>' : '') + buy + '</div>' : '');

  document.getElementById('productBack').addEventListener('click', (e) => {
    e.preventDefault();
    // Go back to whichever list page they came from; fall back to the shop.
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.href = 'gallery.html';
  });
  el.querySelectorAll('.product-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.i;
      document.getElementById('productMain').outerHTML = imgTag(photos[i], { id: 'productMain', cls: 'product-main', alt: piece.title, dims: dims[i], widths: PRODUCT_WIDTHS, sizes: PRODUCT_SIZES });
      el.querySelectorAll('.product-thumb').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}
