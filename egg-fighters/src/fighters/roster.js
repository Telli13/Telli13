/* Fighter roster: data only. Every fighter uses the same rig and combat system;
 * here they differ by costume, colours, stats and their move set (moves live in combat/moves.js).
 */
'use strict';

(() => {
  EF.roster = {
    ninja: {
      id: 'ninja',
      name: 'Ninja Egg',
      costume: 'ninja',
      colors: { sleeve: 0x18181e, cuff: 0x18181e, fist: 0x26201e, leg: 0x18181e, boot: 0x2a1a18 },
      ui: '#e2333f',
      stats: { speed: 5.4, dashSpeed: 15.5, power: 1.0, weight: 0.95, turnRate: 30, attackRate: 1.04 },
      moves: { combo: ['jabL', 'jabR', 'spinFist', 'hookR'], heavy: 'katanaSlash', dash: 'dashStrike' },
    },
    samurai: {
      id: 'samurai',
      name: 'Samurai Egg',
      costume: 'samurai',
      colors: { sleeve: 0x7d1820, cuff: 0x1d1517, fist: 0x3a2318, leg: 0x1d1517, boot: 0x2b1b14 },
      ui: '#f0b429',
      stats: { speed: 4.8, dashSpeed: 13.5, power: 1.1, weight: 1.08, turnRate: 24, attackRate: 1.0 },
      moves: { combo: ['jabL', 'jabR', 'spinFist', 'hammer'], heavy: 'overheadChop', dash: 'dashStrike' },
    },
  };
})();
