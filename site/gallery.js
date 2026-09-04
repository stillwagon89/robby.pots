// Shared gallery component. Single source of truth for the pieces shown on
// both the home page's "Recent Work" section and the full Ceramics/Gallery
// page — edit GALLERY_PIECES here and both pages update.
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
  }
];

function renderGallery(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = GALLERY_PIECES.map(piece => {
    const media = piece.placeholder
      ? '<div class="placeholder-image" style="aspect-ratio:' + piece.aspect + '"><span class="chip">' + piece.placeholder + '</span></div>'
      : '<img src="' + piece.img + '" alt="' + piece.alt + '" style="aspect-ratio:' + piece.aspect + '; width:100%; object-fit:cover; display:block; background:transparent;">';
    const caption = SHOW_CAPTIONS
      ? '<div class="caption"><p class="piece-title">' + piece.title + '</p><p class="piece-materials">' + piece.materials + '</p></div>'
      : '';
    return '<div class="gallery-item' + (piece.placeholder ? ' empty' : '') + '">' + media + caption + '</div>';
  }).join('');
}
