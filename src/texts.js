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
    ready: 'Тучи собрались — можно вызвать дождь! Он пойдёт там, куда смотрит камера',
    need: 'Мало туч — собирай воду',
    busy: 'Дождь уже идёт',
    goodCast: 'Тёплый дождь: почва напитается, появятся новые ресурсы',
    stormCast: 'Гроза! Вредителей смоет, звери разбегутся',
    stormHit: 'Гроза смыла вредителей: {pests}, спугнула зверей: {animals}',
  },
  menu: {
    intro: '▶ Интро',
  },
};
