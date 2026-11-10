// Swappable art. Every picture in the scene is a "slot" with a fixed file name.
// Put a file with that exact name into the  art/  folder and it replaces the
// code-drawn placeholder automatically (no code changes). Missing files are fine.
// See ART-PROMPTS.md for sizes and ready-to-use prompts.
(function () {
  const ML = window.ML;

  // id → file name inside art/.  kind: how it is applied.
  const SLOTS = [
    // room & light
    { id: 'room', file: 'room.jpg' },
    // bookcase pieces (they stretch / repeat to any bookcase size)
    { id: 'bookcase-back', file: 'bookcase-back.jpg' },
    { id: 'bookcase-side', file: 'bookcase-side.png' },
    { id: 'bookcase-crown', file: 'bookcase-crown.png' },
    { id: 'bookcase-base', file: 'bookcase-base.png' },
    { id: 'shelf', file: 'shelf.png' },
    { id: 'pillar', file: 'pillar.png' },
    { id: 'plaque', file: 'plaque.png', kind: 'plaque' },
    // books
    { id: 'spine-1', file: 'spine-1.png' },
    { id: 'spine-2', file: 'spine-2.png' },
    { id: 'spine-3', file: 'spine-3.png' },
    // decor (used on shelves AND in the room / on the desk)
    { id: 'candle', file: 'candle.png' },
    { id: 'globe', file: 'globe.png' },
    { id: 'plant', file: 'plant.png' },
    { id: 'hourglass', file: 'hourglass.png' },
    { id: 'potion', file: 'potion.png' },
    { id: 'stack', file: 'book-stack.png' },
    { id: 'crystal', file: 'crystal-ball.png' },
    // foreground
    { id: 'desk', file: 'desk.png' },
    { id: 'armchair', file: 'armchair.png' },
    { id: 'open-book', file: 'open-book.png' },
    { id: 'quill', file: 'quill-inkwell.png' },
    { id: 'cup', file: 'cup.png' },
    { id: 'ivy', file: 'ivy.png' },
    // cursor
    { id: 'wand', file: 'wand.png', kind: 'cursor' },
  ];

  const loaded = new Set();
  let style = null;

  function addRule(css) {
    if (!style) { style = document.createElement('style'); style.id = 'art-rules'; document.head.appendChild(style); }
    style.appendChild(document.createTextNode(css + '\n'));
  }

  function apply(slot, url) {
    loaded.add(slot.id);
    document.body.classList.add('art-' + slot.id);
    const u = `url("${url}")`;
    if (slot.kind === 'plaque') {
      // 800×160 image: the left and right 15% (the decorated ends) keep their shape, the middle stretches.
      addRule(`.plaque{background:none;clip-path:none;padding:0 .3em;border-style:solid;border-color:transparent;border-width:0 calc(var(--plaque-h) * .75);border-image:${u} 0 15% fill / 0 calc(var(--plaque-h) * .75) stretch}.plaque::before{display:none}`);
    } else if (slot.kind === 'cursor') {
      ML.fx && ML.fx.setWandImage && ML.fx.setWandImage(url);
    } else {
      addRule(`[data-slot="${slot.id}"]{background-image:${u} !important}[data-slot="${slot.id}"]>.ph{display:none !important}`);
    }
  }

  function init() {
    for (const s of SLOTS) {
      const img = new Image();
      const url = 'art/' + s.file;
      img.onload = () => apply(s, url);
      img.src = url;
    }
  }

  ML.slots = { init, list: SLOTS, has: id => loaded.has(id) };
})();
