// Shared gallery component. Pieces now come live from Square (see
// /api/gallery, functions/api/gallery.ts) — add/price/retire pieces in the
// Square Item Library's "Website" category, no edits needed here.
//
// GALLERY_PIECES below is a fallback only, used if /api/gallery returns
// nothing (e.g. before Square is fully set up, or if the sync fails), so
// the site never shows a blank gallery. Once Square is the confirmed
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
        // catalog item. Every gallery box is a fixed 4:5 crop (see CSS),
        // so the source photo's own dimensions don't matter here.
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

  el.innerHTML = pieces.map((piece) => {
    // Every gallery box is a fixed 4:5 crop (see .gallery-item in CSS), so
    // the same box size and hover-title position apply no matter what
    // aspect ratio the source photo actually is.
    const media = piece.placeholder
      ? '<div class="placeholder-image"><span class="chip">' + piece.placeholder + '</span></div>'
      : '<img src="' + piece.img + '" alt="' + piece.alt + '">';
    // Title always comes along; the buy pill only appears (on hover, see
    // CSS) when the piece is actually purchasable.
    const buy = piece.buyLink
      ? '<a class="buy-btn" href="' + piece.buyLink + '" target="_blank" rel="noopener">Buy — $' + piece.price + '</a>'
      : '';
    const hover = piece.placeholder
      ? ''
      : '<div class="piece-hover"><p class="piece-hover-title">' + piece.title + '</p>' + buy + '</div>';
    return '<div class="gallery-item' + (piece.placeholder ? ' empty' : '') + '">' + media + hover + '</div>';
  }).join('');
}
