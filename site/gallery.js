// Shared gallery component. Single source of truth for the pieces shown on
// both the home page's "Recent Work" section and the full Ceramics/Gallery
// page — edit GALLERY_PIECES here and both pages update.
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
    title: 'Untitled (Porcelain)',
    materials: 'Porcelain · Jingdezhen, June 2026',
    placeholder: 'Jingdezhen piece — photo needed',
    aspect: '4/5'
  }
];

function renderGallery(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = GALLERY_PIECES.map(piece => {
    const media = piece.placeholder
      ? '<div class="placeholder-image" style="aspect-ratio:' + piece.aspect + '"><span class="chip">' + piece.placeholder + '</span></div>'
      : '<img src="' + piece.img + '" alt="' + piece.alt + '" style="aspect-ratio:' + piece.aspect + '; width:100%; object-fit:cover; display:block; background:transparent;">';
    return '<div class="gallery-item' + (piece.placeholder ? ' empty' : '') + '">' + media +
      '<div class="caption"><p class="piece-title">' + piece.title + '</p><p class="piece-materials">' + piece.materials + '</p></div></div>';
  }).join('');
}
