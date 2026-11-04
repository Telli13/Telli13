/* Mycelium Forest — texts of the intro, the first-play tips and their buttons.
 * Edit or translate here; the game reads window.MF_TEXT at start-up.
 * To add a language, copy the object, translate the values and assign it instead.
 */
window.MF_TEXT = {
  intro: {
    screens: [
      'Поздравляю, ты гриб!',
      'Твоя цель — размножаться',
      'Не думай, что будет легко',
    ],
    skip: 'Пропустить ›',
    next: 'Кликни, чтобы продолжить',
  },
  // first-play tips, shown one at a time on level 1
  tips: {
    grow: 'Кликай, чтобы грибница росла',
    food: 'Тянись к воде и пище',
    rocks: 'Камни не пройти',
  },
  // rain: clouds gather from collected water, then the player calls one of two rains
  rain: {
    meter: 'Тучи',
    good: 'Тёплый дождь',
    storm: 'Гроза',
    ready: 'Тучи собрались — можно вызвать дождь над всем лесом!',
    need: 'Мало туч — собирай воду',
    busy: 'Дождь уже идёт',
    goodCast: 'Тёплый дождь над всем лесом: почва напитается, появятся новые ресурсы',
    stormCast: 'Гроза над всем лесом! Вредителей смоет, звери разбегутся',
    stormHit: 'Гроза смыла вредителей: {pests}, спугнула зверей: {animals}',
  },
  // day and night: a message as each part of the day begins, and the clock's labels
  daynight: {
    day: 'Наступил день — существа прячутся по норам',
    dusk: 'Темнеет… ночью выходят страшные существа',
    night: 'Ночь! Из глубины лезут тени-жуки — береги грибницу',
    dawn: 'Рассвет — тени уползают обратно',
    names: { day: 'День', dusk: 'Закат', night: 'Ночь', dawn: 'Рассвет' },
  },
  // trees (mycorrhiza), children under trees, the fairy ring
  forest: {
    trees: { birch: 'Берёза', oak: 'Дуб', spruce: 'Ель' },
    treesOf: { birch: 'берёзы', oak: 'дуба', spruce: 'ели' },
    species: { birch: 'подберёзовик', oak: 'белый гриб', spruce: 'рыжик' },
    speciesMany: { birch: 'подберёзовики', oak: 'белые грибы', spruce: 'рыжики' },
    res: { water: 'воды', organic: 'органики', mineral: 'минер.', sugar: 'сахара' },
    union: 'Союз с деревом ({tree})! Оно платит сахаром, а под ним вырастут {kids}',
    paid: 'Дерево ({tree}) заплатило {n} сахара за воду и минералы',
    unpaid: 'Дерево ({tree}) не получило плату — доверие падает',
    broken: 'Дерево ({tree}) разорвало союз: ему не платили',
    cut: 'Нить к корням оборвалась — союз с деревом ({tree}) потерян',
    kid: 'Под деревом ({tree}) проклюнулся {kid}!',
    ring: 'Ведьмин круг! Дети сами растут там, где нити матери выходят к поверхности',
    allied: 'союз',
    reach: 'корни {tree} — дотянись нитью',
    stopped: 'не растёт: нет союза',
  },
  // neighbouring fungi: kin (merge for sugar) and rival (war at the border)
  nets: {
    names: { kin: 'Родня', rival: 'Соперник', rot: 'Гнилушка', parasite: 'Опёнок' },
    namesLow: { rival: 'соперник', parasite: 'опёнок' },
    seen: {
      kin: 'Рядом живёт родственная грибница — дотянись до неё нитью',
      rival: 'Чужая фиолетовая грибница! Она ест ресурсы и захватывает деревья',
      rot: 'Гнилушка на старом бревне — с ней можно торговать',
      parasite: 'Опёнок-паразит! Он ползёт к дереву, чтобы съесть его корни',
    },
    seenKin: 'Рядом живёт родственная грибница — дотянись до неё нитью',
    seenRival: 'Чужая фиолетовая грибница! Она ест ресурсы и захватывает деревья',
    contactKin: 'Нити родни встретились с твоими! Кликни по её грибу — слияние за {n} сахара',
    kinReach: 'дотянись нитью',
    kinClick: 'кликни: слияние за {n} сахара',
    reachKin: 'Сначала дотянись нитью до грибницы родни',
    mergeNeed: 'Для слияния нужно {n} сахара',
    merged: 'Слияние! Сеть родни, её гриб и запасы теперь твои',
    rivalPower: 'сила {n}',
    rivalAte: 'Соперник съел ресурс',
    rivalTree: 'Соперник захватил корни дерева ({tree})',
    treeTaken: 'Корни дерева ({tree}) заняты соперником — отрежь его нить',
    frontWin: 'Фронт: сахар потрачен — {name} отброшен',
    frontLose: 'Фронт: {name} сильнее — твоя нить задушена',
    frontNoSugar: 'Фронт: без сахара не устоять — нить задушена',
    rivalDead: 'Корень соперника перерезан — он погиб! +{n} сахара',
    contactRot: 'Гнилушка на связи! Каждые 20 с: {w} воды → {o} органики',
    rotTrade: '{w} воды → {o} органики · {s} с',
    rotTraded: 'Гнилушка переработала бревно: {w} воды → {o} органики',
    rotNeedWater: 'Гнилушке нужно {w} воды для обмена',
    parasiteReached: 'Опёнок вгрызся в корни дерева ({tree})! Перережь его нить, пока дерево не погибло',
    parasiteBiting: 'грызёт корни: {tree} {hp}%',
    parasiteDead: 'Опёнок уничтожен! Дерево спасено. +{n} сахара',
    treeInfested: 'Опёнок грызёт корни! {hp}%',
    treeDied: 'Дерево ({tree}) погибло — опёнок съел его корни',
  },
  pause: {
    title: 'Пауза',
    hint: 'Лес замер и ждёт тебя',
    resume: '▶ Продолжить',
    menu: '☰ Уровни',
  },
  menu: {
    intro: '▶ Интро',
  },
};
