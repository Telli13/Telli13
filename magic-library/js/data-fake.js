// FAKE folder data for the prototype. Nothing here reads your real disk.
//
// The rest of the app only uses these functions (all return Promises):
//   getLocations()        → [{ id, name, kind, path }]
//   listFolder(path)      → { folders: [item], files: [item] }
//   getFavorites()        → [item]
//   search(text, limit)   → [{ name, type, path, chain: [{name, path}], location }]
// An item is { type: 'folder'|'file', name, path, ext?, size?, modified? }.
// A real data source (Tauri) only has to provide the same functions.
(function () {
  const ML = window.ML;
  const hash = ML.art.hash;
  const SEP = '\\';

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pad = (n, w) => String(n).padStart(w, '0');
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const byName = (a, b) => collator.compare(a.name, b.name);

  const LOCATIONS = [
    { id: 'c', name: 'Drive C', kind: 'drive', path: 'C:' },
    { id: 'hdd', name: 'HDD 2TB', kind: 'hdd', path: 'D:' },
    { id: 'dl', name: 'Downloads', kind: 'downloads', path: 'C:\\Users\\You\\Downloads' },
    { id: 'docs', name: 'Documents', kind: 'documents', path: 'C:\\Users\\You\\Documents' },
    { id: 'cloud', name: 'Cloud', kind: 'cloud', path: 'Cloud:' },
  ];

  const NORMAL = {
    c: ['Windows', 'Program Files', 'Games', 'Users', 'Temp', 'ProgramData', 'Drivers', 'Tools'],
    hdd: ['Videos', 'Photos 2025', 'Photos 2024', 'Music', 'Archive', 'Backup', 'Films', 'Old Projects'],
    dl: ['Torrents', 'ZIP', 'Installers', 'Images', 'Other'],
    docs: ['Work', 'Docs', 'Sheets', 'Slides', 'Projects', 'Notes', 'Letters'],
    cloud: ['Drive', 'Shared', 'Sync', 'Projects', 'Archive', 'Camera Uploads'],
  };
  const SCENARIOS = {
    normal: NORMAL,
    few: {
      c: ['Windows', 'Users'], hdd: ['Photos 2025', 'Backup'], dl: ['Installers'],
      docs: ['Work', 'Projects', 'Notes'], cloud: ['Shared'],
    },
    many: {
      c: NORMAL.c.concat(['PerfLogs', 'Recovery', 'Intel', 'Steam Library', 'Python', 'Scripts', 'Fonts', 'Logs',
        'Cache', 'Wallpapers', 'Screenshots', 'Portable Apps', 'Virtual Machines', 'Android SDK', 'Emulators',
        'Old Backups', 'Microsoft', 'Sound Packs', 'Node', 'Cursors']),
      hdd: NORMAL.hdd.concat(['Photos 2015', 'Photos 2016', 'Photos 2017', 'Photos 2018', 'Photos 2019',
        'Photos 2020', 'Photos 2021', 'Photos 2022', 'Photos 2023', 'Movies A–M', 'Movies N–Z', 'Series',
        'Audiobooks', 'Podcasts', 'Game Mods', 'ISO Images', 'Family Videos', 'Scans', 'Wedding', 'Travel',
        'Drone Footage', 'Sound Effects']),
      dl: NORMAL.dl.concat(['Fonts', 'Wallpapers', 'Ebooks', 'Drivers', 'Mods', 'Music', 'Videos', 'Patches',
        'Portable', 'Courses', 'Receipts', 'Maps']),
      docs: NORMAL.docs.concat(['Invoices', 'Contracts', 'Taxes 2025', 'Taxes 2024', 'Recipes', 'School',
        'Courses', 'Manuals', 'Templates', 'Resume', 'Scans', 'Medical', 'Insurance', 'Car', 'House',
        'Travel Plans', 'Journal', 'Poems', 'Ideas']),
      cloud: NORMAL.cloud.concat(['Photos Backup', 'Team Docs', 'Family', 'Recipes', 'Music', 'Work Share',
        'Clients', 'Website', 'Old Phone', 'Notes Sync']),
    },
  };
  const FAVORITES = ['docs:Work', 'hdd:Photos 2025', 'hdd:Music', 'hdd:Videos', 'docs:Projects', 'dl:Installers', 'docs:Notes', 'c:Users'];

  // Folders with fixed children (so the tree looks like a real PC).
  const SPECIAL = {
    'C:\\Users': ['You', 'Public'],
    'C:\\Users\\You': ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Saved Games'],
  };

  // Themes decide which subfolder and file names are generated.
  const THEMES = {
    photos: {
      re: /photo|camera|image|picture|screenshot|wallpaper|scan|wedding|travel|pictures/i,
      subs: ['Summer', 'Winter', 'Family', 'Trip to the Sea', 'Mountains', 'Birthday', 'Pets', 'Garden', 'Edited', 'Raw', 'Best Of', 'Weekend', 'New Year'],
      file: r => ({ name: pick(r, ['IMG_', 'DSC_', 'PXL_']) + pad(int(r, 1000, 9999), 4), ext: pick(r, ['jpg', 'jpg', 'jpg', 'png', 'heic']) }),
    },
    videos: {
      re: /video|film|movie|series|footage|clip/i,
      subs: ['Holidays', 'Family', 'Clips', 'Tutorials', 'Season 1', 'Season 2', 'Shorts', 'Concerts', 'Old Tapes'],
      file: r => ({ name: pick(r, ['Sunset timelapse', 'Birthday party', 'Road trip', 'Lake morning', 'Snow day', 'Kitchen recipe', 'Cat chasing light', 'Episode', 'Clip', 'Walk in the forest']) + ' ' + int(r, 1, 40), ext: pick(r, ['mp4', 'mp4', 'mkv', 'mov']) }),
    },
    music: {
      re: /music|audio|podcast|sound|song|audiobook/i,
      subs: ['Jazz', 'Classical', 'Rock', 'Folk', 'Ambient', 'Playlists', 'Soundtracks', 'Lo-fi', 'Live'],
      file: (r, i) => ({ name: pad(i + 1, 2) + ' ' + pick(r, ['Candlelight', 'Old Oak', 'Autumn Window', 'Silver Rain', 'Moonlit Road', 'Hearth', 'Quiet Harbor', 'Lantern Song', 'Midnight Library', 'Ember Waltz', 'Northern Wind']), ext: pick(r, ['mp3', 'mp3', 'flac']) }),
    },
    docs: {
      re: /work|project|doc|letter|note|sheet|slide|invoice|contract|tax|resume|journal|poem|idea|recipe|school|course|manual|template|medical|insurance|house|car|plan|client|team|website|receipt|desktop/i,
      subs: ['Reports', 'Clients', 'Drafts', '2025', '2026', 'Meeting Notes', 'Templates', 'Invoices', 'Ideas', 'Website', 'Presentation', 'Finished', 'Research'],
      file: (r, i, folder) => {
        const stem = pick(r, ['Report', 'Plan', 'Budget', 'Notes', 'Contract', 'Invoice', 'Summary', 'Proposal', 'Letter', 'Ideas', 'Meeting', 'Schedule', 'Checklist', 'Recipe', 'Story', 'Overview']);
        const tail = r() < 0.6 ? ' ' + pick(r, ['2024', '2025', '2026', 'final', 'v2', 'draft', 'Q3', 'March', 'October', 'for review']) : '';
        let ext = pick(r, ['docx', 'pdf', 'pdf', 'txt']);
        if (/sheet|budget|invoice|tax|receipt/i.test(folder)) ext = pick(r, ['xlsx', 'xlsx', 'csv']);
        else if (/slide|present/i.test(folder)) ext = 'pptx';
        else if (/note|idea|journal|poem/i.test(folder)) ext = pick(r, ['txt', 'md', 'docx']);
        else if (/website/i.test(folder)) ext = pick(r, ['html', 'css', 'js', 'png']);
        return { name: stem + tail, ext };
      },
    },
    games: {
      re: /game|steam|mods?\b|emulator/i,
      subs: ['Dragon Valley', 'Star Harbor', 'Clockwork Isles', 'Saves', 'Mods', 'Screenshots', 'Config', 'Lantern Keep'],
      file: r => pick(r, [
        { name: 'save_' + int(r, 1, 99), ext: 'sav' }, { name: 'settings', ext: 'cfg' }, { name: 'screenshot_' + int(r, 100, 999), ext: 'png' },
        { name: 'launcher', ext: 'exe' }, { name: 'readme', ext: 'txt' }, { name: 'data' + int(r, 1, 30), ext: 'dat' }]),
    },
    archives: {
      re: /zip|archive|backup|torrent|install|iso|patch|recovery|old|portable|other/i,
      subs: ['2023', '2024', '2025', 'Old', 'Misc', 'To Sort', 'Keep', 'Phone'],
      file: r => ({ name: pick(r, ['setup', 'backup', 'photos-export', 'project-files', 'driver-pack', 'old-site', 'fonts-pack', 'game-installer', 'notes-archive', 'tool']) + '-' + int(r, 1, 300), ext: pick(r, ['zip', 'zip', '7z', 'rar', 'exe', 'msi', 'iso']) }),
    },
    system: {
      re: /windows|program|system|driver|tool|data|temp|cache|log|perf|intel|amd|microsoft|python|node|script|sdk|font|cursor|virtual/i,
      subs: ['System32', 'Fonts', 'Config', 'Logs', 'Cache', 'Resources', 'Plugins', 'Locales', 'bin', 'lib', 'Updates'],
      file: r => pick(r, [
        { name: 'config', ext: 'ini' }, { name: 'settings', ext: 'json' }, { name: 'readme', ext: 'txt' }, { name: 'update', ext: 'log' },
        { name: 'setup', ext: 'exe' }, { name: 'lib' + pick(r, ['core', 'gfx', 'net', 'audio', 'ui']) + int(r, 1, 64), ext: 'dll' },
        { name: 'cache_' + int(r, 1000, 9999), ext: 'dat' }, { name: 'service', ext: 'xml' }, { name: 'run', ext: 'bat' }]),
    },
    generic: {
      re: /$^/,
      subs: ['New Folder', 'Misc', 'Keep', 'Stuff', 'To Sort', 'Old'],
      file: r => ({ name: pick(r, ['file', 'document', 'picture', 'note', 'list', 'scan']) + ' ' + int(r, 1, 99), ext: pick(r, ['txt', 'pdf', 'jpg', 'docx', 'zip']) }),
    },
  };
  const THEME_ORDER = ['games', 'photos', 'videos', 'music', 'docs', 'archives', 'system'];
  function detectTheme(name) {
    for (const t of THEME_ORDER) if (THEMES[t].re.test(name)) return t;
    return null;
  }

  const SIZES = { // [min KB, max KB]
    jpg: [800, 8000], png: [200, 6000], heic: [900, 4000], mp4: [30000, 2500000], mkv: [400000, 4000000], mov: [20000, 900000],
    mp3: [3000, 12000], flac: [20000, 60000], docx: [20, 2000], pdf: [60, 9000], txt: [1, 60], md: [1, 40], xlsx: [15, 3000], csv: [2, 900],
    pptx: [400, 30000], zip: [1000, 4000000], '7z': [1000, 3000000], rar: [1000, 2000000], exe: [800, 300000], msi: [2000, 200000],
    iso: [700000, 6000000], dll: [40, 5000], ini: [1, 8], json: [1, 50], log: [2, 4000], dat: [10, 90000], xml: [1, 200],
    bat: [1, 4], sav: [50, 9000], cfg: [1, 10], html: [3, 90], css: [2, 60], js: [3, 400],
  };

  function create() {
    let scenario = 'normal';
    let cache = new Map();   // path → listing
    let meta = new Map();    // folder path → { depth, theme, loc }
    let index = null;        // search index, built on first search
    const roots = new Map(LOCATIONS.map(l => [l.path, l]));

    function reset() { cache = new Map(); meta = new Map(); index = null; }

    function folderItem(parent, name, depth, theme, loc) {
      const path = parent + SEP + name;
      if (!meta.has(path)) meta.set(path, { depth, theme: detectTheme(name) || theme, loc });
      return { type: 'folder', name, path };
    }

    function list(path) {
      if (cache.has(path)) return cache.get(path);
      let res;
      const loc = roots.get(path);
      if (loc) {
        const names = SCENARIOS[scenario][loc.id] || [];
        res = { folders: names.map(n => folderItem(path, n, 1, 'generic', loc.id)), files: [] };
      } else {
        const m = meta.get(path) || { depth: 3, theme: 'generic', loc: null };
        const name = path.slice(path.lastIndexOf(SEP) + 1);
        const theme = THEMES[m.theme] || THEMES.generic;
        const r = rng(hash(scenario + '|' + path));

        let subNames;
        if (SPECIAL[path]) subNames = SPECIAL[path];
        else {
          const d = m.depth;
          const n = d === 1 ? int(r, 2, 7) : d === 2 ? int(r, 0, 5) : d === 3 ? int(r, 0, 3) : d < 6 && r() < 0.25 ? int(r, 1, 2) : 0;
          const pool = theme.subs.slice();
          subNames = [];
          for (let i = 0; i < n && pool.length; i++) subNames.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
        }
        const folders = subNames.map(n => folderItem(path, n, m.depth + 1, m.theme, m.loc));

        const nFiles = r() < 0.16 ? int(r, 48, 130) : int(r, m.depth === 1 ? 3 : 0, 24);
        const seen = new Set();
        const files = [];
        for (let i = 0; i < nFiles; i++) {
          const f = theme.file(r, i, name);
          let full = f.name + '.' + f.ext;
          let k = 2;
          while (seen.has(full.toLowerCase())) full = `${f.name} (${k++}).${f.ext}`;
          seen.add(full.toLowerCase());
          const [lo, hi] = SIZES[f.ext] || [1, 500];
          files.push({
            type: 'file', name: full, ext: f.ext, path: path + SEP + full,
            size: Math.round((lo + r() * (hi - lo)) * 1024),
            modified: new Date(2023, 0, 1).getTime() + Math.floor(r() * 3.8 * 365 * 864e5),
          });
        }
        res = { folders: folders.sort(byName), files: files.sort(byName) };
      }
      cache.set(path, res);
      return res;
    }

    function buildIndex() {
      index = [];
      for (const loc of LOCATIONS) {
        const walk = (path, chain, depth) => {
          const l = list(path);
          for (const f of l.folders) {
            const c = chain.concat([{ name: f.name, path: f.path }]);
            index.push({ name: f.name, low: f.name.toLowerCase(), type: 'folder', path: f.path, chain: c, location: loc.name });
            if (depth < 3) walk(f.path, c, depth + 1);
          }
          if (depth >= 1) for (const f of l.files) {
            index.push({ name: f.name, low: f.name.toLowerCase(), type: 'file', path: f.path, chain, location: loc.name });
          }
        };
        walk(loc.path, [], 0);
      }
    }

    function search(q, limit) {
      q = q.trim().toLowerCase();
      if (!q) return [];
      if (!index) buildIndex();
      const hits = [];
      for (const e of index) {
        const i = e.low.indexOf(q);
        if (i < 0) continue;
        let score = e.low === q ? 0 : i === 0 ? 1 : /[\s_\-.(]/.test(e.low[i - 1]) ? 2 : 3;
        if (e.type === 'file') score += 0.5;
        score += e.chain.length * 0.1;
        hits.push([score, e]);
      }
      hits.sort((a, b) => a[0] - b[0] || collator.compare(a[1].name, b[1].name));
      return hits.slice(0, limit || 8).map(h => h[1]);
    }

    return {
      get scenario() { return scenario; },
      scenarios: Object.keys(SCENARIOS),
      setScenario(s) { if (SCENARIOS[s]) { scenario = s; reset(); } },
      getLocations: async () => LOCATIONS.map(l => ({ ...l })),
      listFolder: async path => list(path),
      getFavorites: async () => {
        const out = [];
        for (const spec of FAVORITES) {
          const [locId, name] = spec.split(':');
          const loc = LOCATIONS.find(l => l.id === locId);
          const f = list(loc.path).folders.find(x => x.name === name);
          if (f) out.push(f);
        }
        return out;
      },
      search: async (q, limit) => search(q, limit),
      // Build the search index in the background so the first search is instant.
      warmup() { if (!index) buildIndex(); },
    };
  }

  ML.createFakeData = create;
})();
