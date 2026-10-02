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
    alt: 'Gong Fu Style Teapot',
    price: 100,
    buyLink: 'https://square.link/u/MYXIKhsn'
    // To list a piece for sale: add `price` (number) and `buyLink` (Square
    // Payment Link URL, e.g. 'https://square.link/u/XXXXXXXX') to its entry.
    // When it sells, remove those two fields to take the Buy button down —
    // this is a static link, not a live-inventory widget, so it doesn't
    // know on its own when Square marks the item sold out.
  }
];

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
        // Square-sourced pieces: img/alt/title come straight from the
        // catalog item. Every gallery box is a fixed 4:5 crop (see CSS),
        // so the source photo's own dimensions don't matter here.
        pieces = live.map(p => ({
          id: p.id,
          title: p.title,
          materials: '',
          img: p.imageUrl,
          alt: p.title,
          price: p.price,
          buyLink: p.buyLink,
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

  el.innerHTML = pieces.map((piece) => {
    // Cards take each photo's natural aspect ratio; the grid is a CSS-columns masonry.
    const media = piece.placeholder
      ? '<div class="placeholder-image"><span class="chip">' + piece.placeholder + '</span></div>'
      : '<img src="' + piece.img + '" alt="' + piece.alt + '">';
    const tag = piece.soldOut
      ? '<span class="price-tag">SOLD</span>'
      : piece.price != null
      ? '<span class="price-tag">$' + piece.price + '</span>'
      : '';
    return '<a class="gallery-item' + (piece.soldOut ? ' sold' : '') + '"' +
      (piece.id ? ' href="product.html?id=' + encodeURIComponent(piece.id) + '"' : '') + '>' +
      '<div class="media">' + media + tag + '</div>' +
      '<div class="band"><p class="piece-title">' + piece.title + '</p></div>' +
      '</a>';
  }).join('');
}


// Product page (product.html?id=<Square item id>): large photo, extra photos
// as thumbnails, title, status/price, description and a Buy button.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderProduct(containerId) {
  const el = document.getElementById(containerId);
  const id = new URLSearchParams(location.search).get('id');
  let piece = null;
  try {
    const res = await fetch('/api/gallery?id=' + encodeURIComponent(id || ''));
    if (res.ok) piece = (await res.json())[0] || null;
  } catch (err) {
    console.error('product fetch failed', err);
  }
  if (!piece) {
    el.innerHTML = '<p class="gallery-empty">This piece could not be found. <a href="gallery.html">Back to Shop</a></p>';
    return;
  }

  document.title = piece.title + ' — Flaming Clay Ceramics';
  const photos = piece.imageUrls && piece.imageUrls.length ? piece.imageUrls : [piece.imageUrl];
  const title = escapeHtml(piece.title);
  const status = piece.soldOut ? 'Sold' : 'Available';
  const price = piece.soldOut || piece.price == null ? '' : '<p class="product-price">$' + piece.price + '</p>';
  const buy = !piece.soldOut && piece.buyLink
    ? '<a class="product-buy" href="' + piece.buyLink + '" target="_blank" rel="noopener">Buy</a>'
    : '';
  const desc = piece.description
    ? piece.description.split(/\n\s*\n/).map(p => '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('')
    : '';

  el.innerHTML =
    '<a href="#" class="product-back" id="productBack">&larr; Back to Shop</a>' +
    '<div class="product-layout">' +
      '<div class="product-photos">' +
        '<img id="productMain" class="product-main" src="' + photos[0] + '" alt="' + title + '">' +
        (photos.length > 1
          ? '<div class="product-thumbs">' + photos.map((u, i) =>
              '<button type="button" class="product-thumb' + (i === 0 ? ' active' : '') + '" data-src="' + u + '" aria-label="Photo ' + (i + 1) + '"><img src="' + u + '" alt=""></button>'
            ).join('') + '</div>'
          : '') +
      '</div>' +
      '<div class="product-info">' +
        '<h1 class="product-title">' + title + '</h1>' +
        '<p class="product-status' + (piece.soldOut ? ' sold' : '') + '">' + status + '</p>' +
        price + buy +
        '<div class="product-desc">' + desc + '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('productBack').addEventListener('click', (e) => {
    e.preventDefault();
    // Go back to whichever list page they came from; fall back to the shop.
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.href = 'gallery.html';
  });
  el.querySelectorAll('.product-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('productMain').src = btn.dataset.src;
      el.querySelectorAll('.product-thumb').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}
