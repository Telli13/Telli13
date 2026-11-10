// Placeholder art: simple line icons and decor drawn with SVG.
// Replace these later with generated artwork (see README → "Replacing the art").
(function () {
  const ML = window.ML;

  // 24×24 line icons (stroke = currentColor). Generic shapes, no brand logos.
  const I = {
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 18l5-5 4 4 3-3 6 6"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 5v4M11 5v4M15 5v4M19 5v4"/><path d="M10 12l5 2.5-5 2.5z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    gamepad: '<path d="M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4z"/><path d="M7 10.5v3M5.5 12h3"/><circle cx="16" cy="11" r=".8"/><circle cx="18" cy="13" r=".8"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 13.7c3 .2 5.5 2.2 5.5 5.3"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    zip: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M12 3v2M11 5h2M12 7v1M11 8h2M12 10v1"/><rect x="10.5" y="12" width="3" height="4" rx=".8"/>',
    box: '<path d="M3 8l9-5 9 5-9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    cube: '<path d="M12 2.5l8 4.5v9.5l-8 4.5-8-4.5V7z"/><path d="M4 7l8 4.5L20 7M12 11.5V21"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15h6M9 18h4"/>',
    sheet: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M4 14h16M9 4v16M14.5 4v16"/>',
    slides: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M12 16v3M8 21l4-2 4 2"/><path d="M7 12l3-3 2 2 4-4"/>',
    notes: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9.5z"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 4.5l2-1.5M20 20v-4h-4"/>',
    chest: '<path d="M4 10a8 5 0 0 1 16 0v9H4z"/><path d="M4 12h16M11 11h2v3h-2z"/>',
    layers: '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M9 7V5h6v2M3 12h18"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    drive: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h.01M17 12h-6"/>',
    hdd: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="11" r="4"/><circle cx="12" cy="11" r=".8"/><path d="M8.5 18h7"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    exit: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
    arrowL: '<path d="M15 5l-7 7 7 7"/>',
    arrowR: '<path d="M9 5l7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
    feather: '<path d="M20 4C12 4 6 9 5 19l2-2c2-6 6-9 10-10-3 2-6 5-7 9 5-1 9-6 10-12z"/><path d="M5 19l-1 1"/>',
    tree: '<path d="M12 21v-9"/><path d="M12 12c0-3-1.4-5-3.5-6.5M12 12c0-3 1.4-5 3.5-6.5M12 9V3.5"/><path d="M12 14c-1.8-1.6-4.2-1.8-6.5-1M12 14c1.8-1.6 4.2-1.8 6.5-1M12 17c-2-1-4.4-.8-6 .3M12 17c2-1 4.4-.8 6 .3"/><path d="M8.5 21h7"/>',
  };

  function icon(name, cls) {
    return `<svg viewBox="0 0 24 24" class="ico${cls ? ' ' + cls : ''}" aria-hidden="true">${I[name] || I.folder}</svg>`;
  }

  // Which icon a folder gets, guessed from its name.
  const FOLDER_RULES = [
    [/favou?rite|star/i, 'star'],
    [/project/i, 'heart'],
    [/photo|image|picture|screenshot|wallpaper|\braw\b|edited|scan/i, 'image'],
    [/camera|drone/i, 'camera'],
    [/music|audio|song|playlist|podcast|soundtrack|jazz|rock|classical|folk|ambient|sound/i, 'music'],
    [/video|film|movie|series|clip|tutorial|footage|shorts/i, 'film'],
    [/windows|system|microsoft/i, 'monitor'],
    [/game|steam|\bsave|mods?\b|emulator/i, 'gamepad'],
    [/program|app|tool|\bbin\b|\blib\b|plugin|driver|sdk|python|node|script|portable|intel|amd/i, 'gear'],
    [/user|shared|public|family|\byou\b|guest|team|client/i, 'users'],
    [/temp|cache|data|log|perf/i, 'database'],
    [/download|torrent/i, 'download'],
    [/zip|\biso\b|patch/i, 'zip'],
    [/install|setup/i, 'box'],
    [/archive|old/i, 'chest'],
    [/backup|recovery/i, 'layers'],
    [/sync/i, 'sync'],
    [/drive|cloud/i, 'cloud'],
    [/sheet|budget|invoice|tax|receipt/i, 'sheet'],
    [/slide|presentation/i, 'slides'],
    [/note|idea|letter|journal|poem|recipe|ebook|manual|course|school/i, 'notes'],
    [/doc|report|draft|template|contract|resume|medical|insurance/i, 'doc'],
    [/work|meeting|office/i, 'briefcase'],
    [/code|web|site/i, 'code'],
    [/20\d\d|19\d\d/, 'clock'],
    [/other|misc/i, 'cube'],
  ];
  function folderIcon(name) {
    for (const [re, ic] of FOLDER_RULES) if (re.test(name)) return ic;
    return 'folder';
  }

  const FILE_RULES = {
    image: 'jpg jpeg png heic gif webp bmp raw cr2',
    film: 'mp4 mkv mov avi webm',
    music: 'mp3 flac wav ogg m4a',
    sheet: 'xlsx xls csv ods',
    slides: 'pptx ppt key odp',
    doc: 'docx doc pdf txt md rtf odt epub',
    zip: 'zip 7z rar iso tar gz',
    box: 'exe msi',
    gear: 'dll sys ini cfg json xml log dat sav',
    code: 'js py html css ts bat ps1 sh',
  };
  const FILE_MAP = {};
  for (const ic in FILE_RULES) for (const ext of FILE_RULES[ic].split(' ')) FILE_MAP[ext] = ic;
  function fileIcon(ext) { return FILE_MAP[(ext || '').toLowerCase()] || 'file'; }

  function locationIcon(kind) {
    return { drive: 'drive', hdd: 'hdd', downloads: 'download', documents: 'doc', cloud: 'cloud' }[kind] || 'folder';
  }

  // Decor that fills empty shelf spots. viewBox 40×100 = the same shape as a book.
  const D = {
    candle: `<ellipse cx="20" cy="66" rx="16" ry="16" fill="url(#g-halo)"/>
      <ellipse cx="20" cy="97" rx="15" ry="3" fill="#2a1609"/>
      <path d="M7 96h26l-3-5H10z" fill="url(#g-brass)"/>
      <rect x="13" y="60" width="14" height="32" rx="2" fill="url(#g-wax)"/>
      <path d="M13 63c2 0 2 6 4 6s1-6 3-6" fill="#f6ead0"/>
      <path d="M20 60v-3" stroke="#2a1609" stroke-width="1"/>
      <path class="flame" d="M20 44c3 5 5 8 3 12a3 3 0 0 1-6 0c-1.5-4 1-7 3-12z" fill="url(#g-flame)"/>`,
    globe: `<ellipse cx="20" cy="97" rx="14" ry="3" fill="#2a1609"/>
      <path d="M12 96h16l-3-4H15z" fill="#5a3820"/>
      <rect x="18.5" y="80" width="3" height="13" fill="url(#g-brass)"/>
      <circle cx="20" cy="66" r="14" fill="url(#g-globe)"/>
      <path d="M11 60c3-2 6 1 8-1s3-4 6-3 3 4 1 5-5 0-6 3-4 2-6 1-4-3-3-5zM22 70c2-1 5 0 6 2s-1 5-3 5-4-2-4-4z" fill="#6b7b3a" opacity=".8"/>
      <path d="M5 66a15 15 0 0 0 30 0" fill="none" stroke="url(#g-brass)" stroke-width="2"/>`,
    plant: `<ellipse cx="20" cy="97" rx="13" ry="3" fill="#2a1609"/>
      <path d="M9 78h22l-3 18H12z" fill="#8a4a24"/><rect x="8" y="76" width="24" height="5" rx="1" fill="#a35a2c"/>
      <path d="M20 77c-1-12-8-16-14-18 3 6 6 12 14 18zM20 77c1-14 7-20 13-22-2 8-5 15-13 22zM20 77c0-14-2-22-1-30 3 8 4 18 1 30z" fill="#4f7a3a"/>
      <path d="M20 77c-3-8-9-10-13-10 4 4 8 7 13 10z" fill="#3c6430"/>`,
    hourglass: `<ellipse cx="20" cy="97" rx="13" ry="3" fill="#2a1609"/>
      <rect x="7" y="53" width="26" height="4" rx="1" fill="#5a3820"/><rect x="7" y="91" width="26" height="4" rx="1" fill="#5a3820"/>
      <rect x="8" y="57" width="2" height="34" fill="url(#g-brass)"/><rect x="30" y="57" width="2" height="34" fill="url(#g-brass)"/>
      <path d="M12 57h16c0 9-6 12-6 17s6 8 6 17H12c0-9 6-12 6-17s-6-8-6-17z" fill="#f3e6c8" opacity=".25" stroke="#e8c27a" stroke-width=".7"/>
      <path d="M14 62h12c-1 4-4 7-6 9-2-2-5-5-6-9zM13 90c1-5 4-7 7-8 3 1 6 3 7 8z" fill="#e2b56a"/>`,
    potion: `<circle cx="20" cy="79" r="16" fill="url(#g-halo)"/>
      <ellipse cx="20" cy="97" rx="12" ry="2.5" fill="#2a1609"/>
      <rect x="16" y="56" width="8" height="9" fill="#f3e6c8" opacity=".35"/><rect x="15.5" y="52" width="9" height="5" rx="1" fill="#8a5a2c"/>
      <circle cx="20" cy="80" r="15" fill="#f3e6c8" opacity=".22" stroke="#e8c27a" stroke-width=".7"/>
      <path d="M6 82a14 14 0 0 0 28 0c-6 2-10-2-14 0s-8 2-14 0z" fill="url(#g-potion)"/>
      <circle cx="14" cy="74" r="2" fill="#fff" opacity=".5"/>`,
    stack: `<ellipse cx="20" cy="97" rx="18" ry="3" fill="#2a1609"/>
      <rect x="2" y="86" width="36" height="9" rx="1.5" fill="#5e1f20"/><rect x="2" y="88" width="36" height="1.2" fill="#c99a4e"/>
      <rect x="5" y="77" width="31" height="9" rx="1.5" fill="#2f4a33"/><rect x="5" y="79" width="31" height="1.2" fill="#c99a4e"/>
      <rect x="3" y="68" width="33" height="9" rx="1.5" fill="#5a3b22"/><rect x="3" y="70" width="33" height="1.2" fill="#c99a4e"/>
      <path d="M26 68l-6-14 4 0 4 14z" fill="#e8c27a" opacity=".8"/>`,
    crystal: `<circle cx="20" cy="74" r="18" fill="url(#g-halo)"/>
      <ellipse cx="20" cy="97" rx="13" ry="3" fill="#2a1609"/>
      <path d="M9 96h22l-4-9H13z" fill="url(#g-brass)"/>
      <circle cx="20" cy="74" r="13" fill="#ffd9a0" opacity=".28" stroke="#ffd58a" stroke-width=".8"/>
      <circle cx="20" cy="76" r="6" fill="#ffb54a" opacity=".45"/><circle cx="15" cy="69" r="2.4" fill="#fff" opacity=".6"/>`,
  };
  const DECOR_NAMES = Object.keys(D);

  function decor(name) {
    return `<svg viewBox="0 0 40 100" preserveAspectRatio="xMidYMax meet" class="decor-svg" aria-hidden="true">${D[name] || D.candle}</svg>`;
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ESC[c]); }

  function hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  ML.art = { icon, folderIcon, fileIcon, locationIcon, decor, DECOR_NAMES, esc, hash, BOOK_COLORS: 8 };
})();
