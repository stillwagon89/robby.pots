// Shared gallery component. Pieces now come live from Square (see
// /api/gallery, functions/api/gallery.ts) — add/price/retire pieces in the
// Square Item Library's "Website" category, no edits needed here.
//
// GALLERY_PIECES below is a fallback only, used if /api/gallery returns
// nothing (e.g. before Square is fully set up, or if the sync fails), so
// the site never shows a blank gallery. Once Square is the confirmed
// source of truth for every piece, this fallback array can be deleted.
//
// SHOW_CAPTIONS: title/materials text is hidden below each photo while this
// is false, but stays in GALLERY_PIECES below so it's one flip to bring back.
const SHOW_CAPTIONS = false;

const GALLERY_PIECES = [
  {
    title: 'Moon Jar',
    materials: 'Stoneware · celadon glaze, iron-oxide rim',
    img: 'moon-jar.jpg',
    alt: 'Moon Jar',
    aspect: '4/5'
  },
  {
    title: 'Matching Mug Set',
    materials: 'Stoneware · glossy speckled glaze',
    img: 'mug2.png',
    alt: 'Matching Mug Set',
    aspect: '5/4'
  },
  {
    title: 'Serving Tray',
    materials: '',
    img: 'assets/gallery/serving-tray.jpg',
    alt: 'Serving Tray',
    aspect: '768/1024'
  },
  {
    title: 'Speckled Cream Mug',
    materials: '',
    img: 'assets/gallery/mug-cream.jpg',
    alt: 'Speckled Cream Mug',
    aspect: '1206/1552'
  },
  {
    title: 'Black Glazed Mug',
    materials: '',
    img: 'assets/gallery/mug-black.jpg',
    alt: 'Black Glazed Mug',
    aspect: '768/1024'
  },
  {
    title: 'Blue Lidded Jar',
    materials: '',
    img: 'assets/gallery/jar-blue.jpg',
    alt: 'Blue Lidded Jar',
    aspect: '768/1024'
  },
  {
    title: 'White Tumbler',
    materials: '',
    img: 'assets/gallery/tumbler-white.jpg',
    alt: 'White Tumbler',
    aspect: '768/1024'
  },
  {
    title: 'Wave Teapot',
    materials: '',
    img: 'assets/gallery/teapot-green.webp',
    alt: 'Wave Teapot',
    aspect: '1136/1016'
  },
  {
    title: 'Gong Fu Style Teapot',
    materials: '',
    img: 'assets/gallery/teapot-gongfu.jpg',
    alt: 'Gong Fu Style Teapot',
    aspect: '1200/1072',
    price: 100,
    buyLink: 'https://square.link/u/MYXIKhsn'
    // To list a piece for sale: add `price` (number) and `buyLink` (Square
    // Payment Link URL, e.g. 'https://square.link/u/XXXXXXXX') to its entry.
    // When it sells, remove those two fields to take the Buy button down —
    // this is a static link, not a live-inventory widget, so it doesn't
    // know on its own when Square marks the item sold out.
  }
];

async function renderGallery(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  let pieces = GALLERY_PIECES;
  try {
    const res = await fetch('/api/gallery');
    if (res.ok) {
      const live = await res.json();
      if (Array.isArray(live) && live.length) {
        // Square-sourced pieces: img/alt/title come straight from the
        // catalog item, aspect ratio isn't known ahead of time (measured
        // client-side once the photo loads, see below).
        pieces = live.map(p => ({
          title: p.title,
          materials: '',
          img: p.imageUrl,
          alt: p.title,
          price: p.price,
          buyLink: p.buyLink
        }));
      }
    }
  } catch (err) {
    console.error('gallery fetch failed, using fallback pieces', err);
  }

  el.innerHTML = pieces.map((piece, i) => {
    const aspectStyle = piece.aspect ? 'aspect-ratio:' + piece.aspect + '; ' : '';
    const media = piece.placeholder
      ? '<div class="placeholder-image" style="aspect-ratio:' + piece.aspect + '"><span class="chip">' + piece.placeholder + '</span></div>'
      : '<img data-piece-index="' + i + '" src="' + piece.img + '" alt="' + piece.alt + '" style="' + aspectStyle + 'width:100%; object-fit:cover; display:block; background:transparent;">';
    const caption = SHOW_CAPTIONS
      ? '<div class="caption"><p class="piece-title">' + piece.title + '</p><p class="piece-materials">' + piece.materials + '</p></div>'
      : '';
    const buy = piece.buyLink
      ? '<a class="buy-btn" href="' + piece.buyLink + '" target="_blank" rel="noopener">' +
        (piece.price ? 'Buy — $' + piece.price : 'Buy') + '</a>'
      : '';
    return '<div class="gallery-item' + (piece.placeholder ? ' empty' : '') + '">' + media + caption + buy + '</div>';
  }).join('');

  // Pieces without a hardcoded aspect (i.e. live Square photos) get their
  // real aspect ratio applied once the image has loaded, so they don't
  // stretch/squash to a default box.
  el.querySelectorAll('img[data-piece-index]').forEach(img => {
    const piece = pieces[Number(img.dataset.pieceIndex)];
    if (piece.aspect) return;
    const apply = () => {
      if (img.naturalWidth && img.naturalHeight) {
        img.style.aspectRatio = img.naturalWidth + '/' + img.naturalHeight;
      }
    };
    if (img.complete) apply();
    else img.addEventListener('load', apply, { once: true });
  });
}
