/* Move data. Times in seconds. Tuned against the reference video:
 * combo hits land 0.2–0.3 s apart, the spin "turn" between strings takes ~0.35 s,
 * finishers launch the target and get a longer hit-stop.
 *
 *  startup / active / recovery  phases of the move
 *  reach      distance from the body centre to the hit point (m)
 *  radius     size of the hit area around the swing line
 *  damage     before the attacker's power stat
 *  knock      horizontal knock-back speed (m/s), divided by the target's weight
 *  lift       upward launch speed (m/s); > 0 sends the target flying and tumbling
 *  hitstun    how long a grounded target is stunned
 *  hitstop    freeze-frame on contact
 *  shake      camera shake strength
 *  lunge      forward speed the attacker gets during startup/active
 *  anim       pose used by the animator
 *  weapon     'katana' / 'sword' shows a blade in the right fist during the move
 *  finisher   allows the darkened slow-mo "finisher" effect (always used on a KO)
 */
'use strict';

(() => {
  EF.moves = {
    jabL: { startup: 0.07, active: 0.06, recovery: 0.17, reach: 1.15, radius: 0.5, damage: 4, knock: 3.0, lift: 0,
      hitstun: 0.3, hitstop: 0.05, shake: 0.07, lunge: 3.2, anim: 'punchL', sound: 'jab' },
    jabR: { startup: 0.07, active: 0.06, recovery: 0.19, reach: 1.15, radius: 0.5, damage: 4.5, knock: 3.6, lift: 0,
      hitstun: 0.32, hitstop: 0.055, shake: 0.08, lunge: 3.4, anim: 'punchR', sound: 'jab' },
    spinFist: { startup: 0.3, active: 0.08, recovery: 0.2, reach: 1.25, radius: 0.65, damage: 7, knock: 5.2, lift: 0,
      hitstun: 0.42, hitstop: 0.07, shake: 0.14, lunge: 2.2, anim: 'spin', sound: 'heavy' },
    hookR: { startup: 0.11, active: 0.07, recovery: 0.36, reach: 1.15, radius: 0.6, damage: 9, knock: 6.5, lift: 6.8,
      hitstun: 0.5, hitstop: 0.1, shake: 0.26, lunge: 3.5, anim: 'uppercut', sound: 'launch', finisher: true },
    hammer: { startup: 0.15, active: 0.08, recovery: 0.38, reach: 1.15, radius: 0.65, damage: 10, knock: 7.5, lift: 5.2,
      hitstun: 0.5, hitstop: 0.11, shake: 0.3, lunge: 3.0, anim: 'uppercut', sound: 'launch', finisher: true },
    katanaSlash: { startup: 0.22, active: 0.1, recovery: 0.34, reach: 1.55, radius: 0.85, damage: 11, knock: 7.5, lift: 4.2,
      hitstun: 0.5, hitstop: 0.11, shake: 0.28, lunge: 4.0, anim: 'slash', weapon: 'katana', sound: 'slash', finisher: true },
    overheadChop: { startup: 0.3, active: 0.1, recovery: 0.4, reach: 1.5, radius: 0.85, damage: 13, knock: 6.5, lift: 4.6,
      hitstop: 0.13, hitstun: 0.55, shake: 0.34, lunge: 3.0, anim: 'chop', weapon: 'sword', sound: 'slash', finisher: true },
    dashStrike: { startup: 0.04, active: 0.1, recovery: 0.26, reach: 1.2, radius: 0.6, damage: 6, knock: 6.5, lift: 2.4,
      hitstun: 0.42, hitstop: 0.08, shake: 0.18, lunge: 0, anim: 'dashStrike', sound: 'heavy' },
  };

  /** combo cancel window: the next hit can start this long after the active phase ends */
  EF.COMBO_CANCEL = 0.04;
  /** the combo string resets after this long without attacking */
  EF.COMBO_RESET = 0.45;
})();
