'use strict';
// ===== Mycelium Forest — данные и баланс =====
const ZONE_W = 1100;
const CORE = { x: ZONE_W / 2, y: 70 };
const SAVE_KEY = 'mycelium-forest-clay-v1';

const ZONES = [
  { name: 'Солнечная поляна', lvl: 1, cost: 0, depth: 760, tree: 'oak',
    sky: ['#58c7ff', '#c9f3ff'], grass: '#7ed957', soil: ['#b9763f', '#9a5a33', '#7a4429', '#5c3120'] },
  { name: 'Берёзовая роща', lvl: 4, cost: 60, depth: 860, tree: 'birch',
    sky: ['#6fd0ff', '#e2f9d8'], grass: '#a4e05a', soil: ['#c98a4b', '#a86a3a', '#83502f', '#613a25'] },
  { name: 'Туманное болото', lvl: 8, cost: 220, depth: 940, tree: 'willow',
    sky: ['#5fb7a9', '#d5f2c9'], grass: '#4fbf8a', soil: ['#6d7f4a', '#55683f', '#3f5236', '#2c3b2b'] },
  { name: 'Хрустальные недра', lvl: 13, cost: 600, depth: 1040, tree: 'crystal',
    sky: ['#7a8cff', '#e6d9ff'], grass: '#7fd6d0', soil: ['#7a6fb0', '#5f558f', '#473f70', '#322c52'] },
  { name: 'Древняя чаща', lvl: 19, cost: 1500, depth: 1120, tree: 'ancient',
    sky: ['#2f9e7a', '#f4e9a8'], grass: '#3fae4f', soil: ['#8a5a3c', '#6b4230', '#4f2f26', '#38201c'] },
  { name: 'Сердце земли', lvl: 26, cost: 4000, depth: 1200, tree: 'heart',
    sky: ['#ff8fb3', '#ffe6a3'], grass: '#ffb84d', soil: ['#a8454f', '#863443', '#632638', '#451a2b'] },
];

const SEASONS = [
  { id: 'spring', name: 'Весна', tip: 'Грибы растут быстрее', col: '#ff8fc7', mush: 1.35, spores: 1, water: 1.2, min: 1 },
  { id: 'summer', name: 'Лето', tip: 'Больше питания, но жди засуху', col: '#ffc531', mush: 1, spores: 1, water: .7, min: 1, nut: 1.4 },
  { id: 'autumn', name: 'Осень', tip: 'Грибная пора: споры ×1.5', col: '#ff7a2f', mush: 1.1, spores: 1.5, water: 1, min: 1 },
  { id: 'winter', name: 'Зима', tip: 'Рост медленнее, минералы ×2', col: '#8fd8ff', mush: .65, spores: 1, water: .8, min: 2 },
];
const SEASON_LEN = 95;

const MUSH = [
  { name: 'Сыроежка', lvl: 1, n: 10, w: 5, time: 9, val: 1, stem: '#fff1d6', cap: '#ff5d73', sw: 20, sh: 36, cw: 64, ch: 32 },
  { name: 'Лисичка', lvl: 3, n: 25, w: 10, time: 14, val: 3, stem: '#ffb238', cap: '#ff9416', sw: 18, sh: 34, cw: 62, ch: 26, shape: 'funnel' },
  { name: 'Боровик', lvl: 6, n: 60, w: 20, time: 22, val: 7, stem: '#f3dcb2', cap: '#9a5a2c', sw: 34, sh: 36, cw: 80, ch: 42 },
  { name: 'Мухомор', lvl: 9, n: 90, w: 30, time: 20, val: 8, stem: '#ffffff', cap: '#e8281e', sw: 20, sh: 50, cw: 78, ch: 38, deco: 'dots', tip: 'Ядовит: слизни гибнут' },
  { name: 'Светогриб', lvl: 13, n: 160, w: 45, time: 32, val: 18, stem: '#d9fff4', cap: '#22d3c5', sw: 16, sh: 54, cw: 60, ch: 40, deco: 'glow' },
  { name: 'Кристальник', lvl: 18, n: 320, w: 70, time: 42, val: 30, stem: '#e6dcff', cap: '#a06bff', sw: 22, sh: 40, cw: 74, ch: 44, deco: 'crystal', tip: 'Даёт ещё и минералы' },
  { name: 'Царь-гриб', lvl: 24, n: 700, w: 130, time: 60, val: 75, stem: '#ffe9b0', cap: '#7b2fd6', sw: 36, sh: 52, cw: 96, ch: 50, deco: 'crown' },
];

// Прокачка грибницы (за минералы)
const UPG = [
  { name: 'Длинные гифы', desc: 'Дальность роста +12%', icon: 'bud', base: 12, k: 1.55, max: 12 },
  { name: 'Быстрый сок', desc: 'Залежи дают на 25% больше', icon: 'n', base: 15, k: 1.6, max: 20 },
  { name: 'Кладовые', desc: 'Запас воды и питания +120', icon: 'w', base: 10, k: 1.5, max: 25 },
  { name: 'Щедрые шляпки', desc: 'Споры за грибы +10%', icon: 's', base: 20, k: 1.6, max: 25 },
  { name: 'Лёгкий рост', desc: 'Рост гиф дешевле на 6%', icon: 'core', base: 18, k: 1.6, max: 10 },
];

// Дерево сверхспособностей (за споры). col/row — позиция в дереве.
const POWERS = [
  { id: 'root', name: 'Пробуждение', icon: 'core', col: 1, row: 0, max: 1, cost: [0], desc: 'Спора проснулась. Отсюда растут три ветви силы.' },
  { id: 'a1', name: 'Жажда жизни', icon: 'n', col: 0, row: 1, max: 5, cost: [8, 40, 200, 1000, 5000], req: 'root', desc: 'Сердце грибницы само добывает больше воды и питания (+60% за уровень).' },
  { id: 'a2', name: 'Взрыв роста', icon: 'bud', col: 0, row: 2, max: 1, cost: [120], req: 'a1', active: { cd: 80 }, desc: 'Умение: 12 секунд гифы растут бесплатно и вдвое дальше.' },
  { id: 'a3', name: 'Корни-разведчики', icon: 'relic', col: 0, row: 3, max: 1, cost: [2000], req: 'a2', desc: 'Все клады и артефакты в открытых зонах видны сквозь землю.' },
  { id: 'a4', name: 'Симбиоз', icon: 'tree', col: 0, row: 4, max: 1, cost: [40000], req: 'a3', desc: 'Пробуждённые деревья приносят вдвое больше спор.' },
  { id: 'b1', name: 'Колючий мицелий', icon: 'beetle', col: 1, row: 1, max: 3, cost: [10, 150, 3000], req: 'root', desc: 'Жуки грызут гифы на 50% дольше за уровень. На 3 уровне удар вдвое сильнее.' },
  { id: 'b2', name: 'Ядовитое облако', icon: 'm3', col: 1, row: 2, max: 1, cost: [140], req: 'b1', active: { cd: 55 }, desc: 'Умение: травит всех вредителей на экране и ранит босса.' },
  { id: 'b3', name: 'Стражи-светлячки', icon: 'fly', col: 1, row: 3, max: 3, cost: [1200, 6000, 25000], req: 'b2', desc: 'Светлячки сами бьют вредителей. Чем выше уровень, тем чаще.' },
  { id: 'b4', name: 'Гнев земли', icon: 'rock', col: 1, row: 4, max: 1, cost: [50000], req: 'b3', active: { cd: 100 }, desc: 'Умение: землетрясение оглушает и сильно ранит всех врагов, даже боссов.' },
  { id: 'c1', name: 'Щедрость', icon: 's', col: 2, row: 1, max: 5, cost: [10, 50, 250, 1200, 6000], req: 'root', desc: 'Все грибы дают на 15% больше спор за уровень.' },
  { id: 'c2', name: 'Призыв дождя', icon: 'cloud', col: 2, row: 2, max: 1, cost: [130], req: 'c1', active: { cd: 110 }, desc: 'Умение: вызывает ливень. Кончает засуху, наполняет воду.' },
  { id: 'c3', name: 'Лесные духи', icon: 'wisp', col: 2, row: 3, max: 3, cost: [1500, 8000, 30000], req: 'c2', desc: 'Духи сами собирают зрелые грибы. Чем выше уровень, тем быстрее.' },
  { id: 'c4', name: 'Золотая пора', icon: 'm0g', col: 2, row: 4, max: 1, cost: [60000], req: 'c3', active: { cd: 140 }, desc: 'Умение: все грибы мгновенно созревают, и многие — золотыми.' },
  { id: 'god', name: 'Бог земли', icon: 'heart', col: 1, row: 5, max: 1, cost: [400000], req: ['a4', 'b4', 'c4'], desc: 'Лес — это ты. Все споры ×2, рост гиф вдвое дешевле.' },
  { id: 'bless', name: 'Благословение леса', icon: 'tree', col: 1, row: 6, max: 99, cost: [], req: 'god', desc: 'Бесконечный дар: каждое благословение навсегда даёт ещё +10% спор.' },
];

const RARITY = {
  c: { name: 'Обычный', col: '#8fd16a' }, r: { name: 'Редкий', col: '#4db8ff' },
  e: { name: 'Эпический', col: '#c06bff' }, l: { name: 'Легендарный', col: '#ffb62e' },
};
// stat: spores, cap, min, reach, flow, mush, combo, golden, kill, chew, cost, tree
const ARTIFACTS = [
  { name: 'Жёлудь-прародитель', r: 'c', icon: 'acorn', col: '#c98a4b', stat: 'spores', v: .05, txt: 'Споры +5%' },
  { name: 'Ракушка улитки', r: 'c', icon: 'shell', col: '#f2c9a0', stat: 'cap', v: 60, txt: 'Запасы +60' },
  { name: 'Монета лесника', r: 'c', icon: 'coin', col: '#ffc531', stat: 'min', v: .1, txt: 'Минералы +10%' },
  { name: 'Косточка крота', r: 'r', icon: 'bone', col: '#fff4dc', stat: 'reach', v: .08, txt: 'Дальность +8%' },
  { name: 'Берестяной свиток', r: 'c', icon: 'scroll', col: '#f5ead0', stat: 'flow', v: .1, txt: 'Добыча +10%' },
  { name: 'Перо сойки', r: 'c', icon: 'feather', col: '#4db8ff', stat: 'mush', v: .08, txt: 'Рост грибов +8%' },
  { name: 'Янтарная слеза', r: 'r', icon: 'drop', col: '#ff9f1a', stat: 'spores', v: .1, txt: 'Споры +10%' },
  { name: 'Кольцо грибника', r: 'r', icon: 'ring', col: '#ffd24a', stat: 'combo', v: .6, txt: 'Комбо держится дольше' },
  { name: 'Болотный огонёк', r: 'r', icon: 'flame', col: '#5ff0c0', stat: 'golden', v: .03, txt: 'Золотые грибы чаще' },
  { name: 'Зуб щуки', r: 'c', icon: 'tooth', col: '#f4f7ff', stat: 'kill', v: .5, txt: 'Награда за вредителей +50%' },
  { name: 'Маска лешего', r: 'e', icon: 'mask', col: '#6fae4a', stat: 'chew', v: .3, txt: 'Гифы крепче на 30%' },
  { name: 'Лягушачья корона', r: 'r', icon: 'crown', col: '#8fe04a', stat: 'flow', v: .15, txt: 'Добыча +15%' },
  { name: 'Горный хрусталь', r: 'r', icon: 'gem', col: '#7fe9ff', stat: 'min', v: .2, txt: 'Минералы +20%' },
  { name: 'Древний трилобит', r: 'e', icon: 'shell', col: '#9aa3c7', stat: 'cap', v: 250, txt: 'Запасы +250' },
  { name: 'Рубиновое семя', r: 'e', icon: 'acorn', col: '#ff3b5c', stat: 'spores', v: .2, txt: 'Споры +20%' },
  { name: 'Кристалл эха', r: 'r', icon: 'gem', col: '#c58bff', stat: 'reach', v: .1, txt: 'Дальность +10%' },
  { name: 'Клык вепря', r: 'e', icon: 'tooth', col: '#ffe2a8', stat: 'kill', v: 1, txt: 'Награда за вредителей +100%' },
  { name: 'Золотой жёлудь', r: 'e', icon: 'acorn', col: '#ffc531', stat: 'mush', v: .15, txt: 'Рост грибов +15%' },
  { name: 'Маска друида', r: 'l', icon: 'mask', col: '#c98a4b', stat: 'cost', v: .15, txt: 'Рост гиф дешевле на 15%' },
  { name: 'Перстень королевы', r: 'e', icon: 'ring', col: '#c06bff', stat: 'chew', v: .4, txt: 'Гифы крепче на 40%' },
  { name: 'Семя мирового древа', r: 'l', icon: 'acorn', col: '#5ff07a', stat: 'spores', v: .4, txt: 'Споры +40%' },
  { name: 'Слеза земли', r: 'l', icon: 'drop', col: '#4db8ff', stat: 'flow', v: .3, txt: 'Добыча +30%' },
  { name: 'Корона грибного царя', r: 'l', icon: 'crown', col: '#ffc531', stat: 'golden', v: .05, txt: 'Золотые грибы намного чаще' },
  { name: 'Сердце метеорита', r: 'l', icon: 'flame', col: '#ff5d3b', stat: 'tree', v: .5, txt: 'Деревья дают +50% спор' },
];

const RANKS = [
  { lvl: 1, name: 'Спора' }, { lvl: 3, name: 'Росток' }, { lvl: 6, name: 'Грибница' },
  { lvl: 10, name: 'Ведьмин круг' }, { lvl: 15, name: 'Хранитель рощи' }, { lvl: 21, name: 'Дух леса' },
  { lvl: 28, name: 'Владыка корней' }, { lvl: 36, name: 'Бог земли' },
];
function powCost(P, l) { return P.cost[l] !== undefined ? P.cost[l] : Math.round(60000 * Math.pow(1.45, l)); }
function rankOf(lvl) { let r = 0; for (let i = 0; i < RANKS.length; i++) if (lvl >= RANKS[i].lvl) r = i; return r; }
function xpNeed(lvl) { return Math.round(9 * Math.pow(lvl, 1.8) + 24); }

const DAILY = [
  { s: 20, txt: '20 спор' }, { m: 30, txt: '30 минералов' }, { s: 60, txt: '60 спор' },
  { m: 80, s: 40, txt: '80 минералов и 40 спор' }, { s: 150, txt: '150 спор' },
  { m: 200, s: 100, txt: '200 минералов и 100 спор' }, { s: 300, art: 1, txt: '300 спор и артефакт!' },
];

// Обучающая цепочка заданий, дальше — случайные
const TUTORIAL = [
  { key: 'grow', need: 3, text: 'Нажимай на землю рядом с грибницей — вырасти 3 гифы', s: 3 },
  { key: 'link_n', need: 1, text: 'Дотянись гифой до коричневой залежи перегноя', s: 4 },
  { key: 'link_w', need: 1, text: 'Дотянись до голубой воды', s: 4 },
  { key: 'plant', need: 1, text: 'Нажми на зелёный росток у поверхности — посади гриб', s: 5 },
  { key: 'harvest', need: 3, text: 'Собери 3 зрелых гриба. Новые ростки появляются над гифами у самой поверхности', s: 8 },
  { key: 'link_m', need: 1, text: 'Найди в глубине кристаллы минералов', s: 8, m: 10 },
  { key: 'upgrade', need: 1, text: 'Улучши грибницу — кнопка слева внизу', s: 10 },
  { key: 'tree', need: 1, text: 'Разбуди дерево: дотянись до светящегося корня', s: 12, m: 10 },
  { key: 'power', need: 1, text: 'Изучи сверхспособность (кнопка «Силы»)', s: 15 },
  { key: 'kill', need: 3, text: 'Раздави 3 вредителей — просто жми на них!', s: 20, m: 15 },
];
const QUESTS = [
  { key: 'harvest', n: [8, 40], text: 'Собери грибов: {n}' },
  { key: 'kill', n: [4, 14], text: 'Раздави вредителей: {n}' },
  { key: 'grow', n: [10, 40], text: 'Вырасти гиф: {n}' },
  { key: 'link', n: [2, 6], text: 'Подключи залежей: {n}' },
  { key: 'plant', n: [2, 6], text: 'Посади грибов: {n}' },
  { key: 'combo', n: [8, 30], text: 'Набери комбо ×{n}', max: 1 },
  { key: 'catch', n: [4, 12], text: 'Поймай в небе капель, звёзд и светлячков: {n}' },
  { key: 'spores', n: [40, 3000], text: 'Заработай спор: {n}' },
  { key: 'golden', n: [1, 4], text: 'Собери золотых грибов: {n}' },
  { key: 'boss', n: [1, 1], text: 'Победи мини-босса', lvl: 4 },
  { key: 'tree', n: [1, 3], text: 'Разбуди деревьев: {n}' },
];

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Детерминированная генерация зоны: залежи, камни, деревья
function genZone(z) {
  const Z = ZONES[z], r = mulberry(1337 + z * 7919), x0 = z * ZONE_W, deps = [], rocks = [], trees = [];
  const ok = (x, y, d) => deps.every(o => Math.hypot(o.x - x, o.y - y) > d) && rocks.every(o => Math.hypot(o.x - x, o.y - y) > o.r + 60) &&
    (z > 0 || Math.hypot(CORE.x - x, CORE.y - y) > 110);
  const put = (type, n, ymin, ymax, rad) => {
    for (let i = 0, tries = 0; i < n && tries < 400; tries++) {
      const x = x0 + 70 + r() * (ZONE_W - 140), y = ymin + r() * (ymax - ymin);
      if (!ok(x, y, 120)) continue;
      deps.push({ type, x, y, r: rad, z }); i++;
    }
  };
  if (z === 0) {
    deps.push({ type: 'n', x: CORE.x + 105, y: 165, r: 30, z }, { type: 'w', x: CORE.x - 120, y: 205, r: 28, z },
      { type: 'm', x: CORE.x + 30, y: 350, r: 26, z });
  }
  if (z === 5) deps.push({ type: 'heart', x: x0 + ZONE_W / 2, y: Z.depth - 150, r: 60, z });
  for (let i = 0; i < 7; i++) {
    for (let t = 0; t < 50; t++) {
      const x = x0 + 80 + r() * (ZONE_W - 160), y = 170 + r() * (Z.depth - 300), rr = 34 + r() * 30;
      if (deps.every(o => Math.hypot(o.x - x, o.y - y) > o.r + rr + 50) && rocks.every(o => Math.hypot(o.x - x, o.y - y) > o.r + rr + 70) &&
        Math.hypot(CORE.x - x, CORE.y - y) > 200) { rocks.push({ x, y, r: rr, seed: (r() * 1e6) | 0 }); break; }
    }
  }
  put('relic', 4, Z.depth * .45, Z.depth - 70, 22);
  put('n', 9, 110, Z.depth - 60, 30);
  put('w', 7, 130, Z.depth - 60, 28);
  put('m', 5 + (z === 3 ? 4 : 0), 280, Z.depth - 50, 26);
  put('amber', 3, 200, Z.depth - 50, 18);
  deps.forEach((d, i) => { d.id = z * 100 + i; });
  let ri = 0; deps.forEach(d => { if (d.type === 'relic') d.art = z * 4 + ri++; });
  for (let i = 0; i < 5; i++) {
    const x = x0 + 110 + i * (ZONE_W - 220) / 4 + (r() - .5) * 70;
    if (z === 0 && Math.abs(x - CORE.x) < 90) { trees.push({ id: z * 10 + i, x: x + 130, ry: 95 + r() * 40, z, s: .8 + r() * .35 }); continue; }
    trees.push({ id: z * 10 + i, x, ry: 95 + r() * 45, z, s: .8 + r() * .35 });
  }
  return { deps, rocks, trees };
}
