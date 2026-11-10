// Magic wand cursor + sparkle bursts on click.
// The cursor is a native system cursor image, so it costs nothing per mouse move.
(function () {
  const ML = window.ML;

  function wandSVG(hot) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs><radialGradient id="g"><stop offset="0" stop-color="#fffbe0"/><stop offset=".4" stop-color="#ffd36a" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a2a" stop-opacity="0"/></radialGradient></defs>
      <circle cx="5" cy="5" r="${hot ? 5 : 3.6}" fill="url(#g)"/>
      ${hot ? '<path d="M5 0v3M5 7v3M0 5h3M7 5h3" stroke="#fff3c4" stroke-width="1" stroke-linecap="round"/>' : ''}
      <path d="M7 7L29 29" stroke="#140a03" stroke-width="5" stroke-linecap="round"/>
      <path d="M7 7L29 29" stroke="#6b3f1f" stroke-width="3" stroke-linecap="round"/>
      <path d="M7.5 7.5L11 11" stroke="#e8c27a" stroke-width="3" stroke-linecap="round"/>
      <path d="M21 21L28 28" stroke="#3a2010" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M20.5 20.5l1.5 1.5" stroke="#e8c27a" stroke-width="3.4"/>
      <circle cx="5" cy="5" r="1.5" fill="#fffbe6"/></svg>`;
  }
  const uri = svg => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}") 5 5`;

  let active = [];
  function sparkle(x, y, big) {
    const el = document.createElement('div');
    el.className = 'spark' + (big ? ' big' : '');
    el.style.transform = `translate(${x}px, ${y}px)`;
    const n = big ? 12 : 8;
    let html = '<b></b>';
    for (let i = 0; i < n; i++) {
      const a = Math.round(i * (360 / n) + Math.random() * 24);
      const d = Math.round((big ? 34 : 18) + Math.random() * (big ? 40 : 22));
      html += `<i style="--a:${a}deg;--d:${d}px"></i>`;
    }
    el.innerHTML = html;
    document.body.appendChild(el);
    active.push(el);
    if (active.length > 8) active.shift().remove();
    setTimeout(() => { el.remove(); active = active.filter(e => e !== el); }, 650);
  }

  function sparkleAt(el, big) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height / 2, big);
  }

  function init() {
    const root = document.documentElement.style;
    root.setProperty('--wand', `${uri(wandSVG(false))}, auto`);
    root.setProperty('--wand-hot', `${uri(wandSVG(true))}, pointer`);
    document.addEventListener('pointerdown', e => {
      if (e.button === 0) sparkle(e.clientX, e.clientY);
    }, { capture: true, passive: true });
  }

  ML.fx = { init, sparkle, sparkleAt };
})();
