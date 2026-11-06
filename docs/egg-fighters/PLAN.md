# Chocolate Egg Fighters — analysis and implementation plan

Status: **proposal, nothing built yet.** Contact sheets of the reference video are next to this file
(`video-0-5s-4fps.png`, `video-5s-8s-10fps.png`).

---

## 1. What the reference video shows (9.4 s, 1080×608, 30 fps)

It is a 2.5D stickman fight on a plain white floor: one blue fighter with a rifle used as a club
against several black fighters. Frame by frame:

| Time | What happens | What we take from it |
|---|---|---|
| 0.0–0.8 s | A weapon is thrown and spins through the air; the target flinches. | Objects fly with spin; reactions start on the very first contact. |
| 0.8–1.3 s | Blue **dashes in low and flat**, almost horizontal, then pops up next to the enemy. | Dash = fast low lunge (~0.15 s), body leaned far forward, short recovery. |
| 1.3–2.5 s | A hit **launches the enemy into the air**, he tumbles (ragdoll-like), lands, debris splashes and **stays on the floor**. Blue also flips and lands crouched. | Strong hits launch upward + backward with spin. Fragments persist on the floor. |
| 2.5–5.0 s | Blue walks to the next enemy, **turns in one frame**, swings. | Turns are near-instant (1–3 frames), not slow rotations. |
| 5.0–7.5 s | Main exchange at close range: **hit-hit, short pause, weapon spin (circular smear), hit-hit**. The enemy is doubled over, **staggers back a step after every hit** and is pushed across the floor. The attacker keeps stepping forward to stay in range. | The core rhythm. Hits ~0.2–0.3 s apart inside a combo, ~0.5–0.7 s "wind-up" between combos. Victim never resets to a neutral pose. |
| ~5.2 s and ~7.3 s | **Finisher frames**: the screen darkens to a vignette with a bright yellow/white impact flash for 1–2 frames, then the victim flies off. | Big hits get hit-stop + flash + vignette + slow-mo, not just more knockback. |
| 7.5–9.4 s | Fight over, winner stands, splatter remains. | Short calm "victory beat" after the KO. |

**Measured feel to reproduce**
- Combo hits every **6–9 frames (0.2–0.3 s)**; pause between strings **0.5–0.7 s**, filled with a spin/feint, never idle.
- Turning toward the opponent: **~0.05–0.1 s** for a full flip of facing.
- Light hit: victim slides back ~0.3–0.5 m with a bent-over flinch. Heavy hit: lifted off the ground and tumbles.
- Every swing has a **motion smear** (arc trail); every heavy contact has a **flash**.
- Debris does not vanish — it accumulates on the floor during the fight.
- The camera is mostly side-on and steady; the action supplies the motion.

## 2. What the concept image shows

- Three fighters (Ninja, Samurai, Tech); you asked for **Ninja + Samurai** first.
- Same body plan for all: big egg torso-head, short blocky arms with fist blocks, blocky legs/boots,
  big angry cartoon eyes. Costume = headband/mask/scarf (ninja), helmet with crest + chest/shoulder armour (samurai).
- Destruction strip: intact → cracks → brown chips off showing white → white cracks showing yellow → capsule pops out with shards flying.
- Arena: Roblox-like blocky plaza (stone tiles, voxel greenery in the background).

## 3. The existing project

- This repo is **Mycelium Forest**: a browser 2D canvas game in plain JavaScript (`index.html`, `src/game.js` ~4800 lines,
  `src/audio.js` = Web Audio synthesized SFX/music, `src/texts.js`), no npm/bundler.
- It ships to Android as an **offline WebView APK** built by `android/build.sh` (no Gradle).
- There is no 3D engine, physics or fighting code to reuse. What *is* reusable:
  - the **no-build web + offline APK pipeline** (the same `build.sh` approach, a new package id);
  - the **synthesized-audio pattern** of `src/audio.js` (punch, crack, crunch, pop sounds without audio files);
  - the Russo One font and the README/docs conventions.
- Nothing in Mycelium Forest will be changed or deleted. The new game goes into its own folder.

## 4. Technology proposal

- **Three.js (one vendored file, no CDN)** for 3D rendering — runs in the browser and in the existing WebView APK offline.
- **Own lightweight physics** instead of a full engine: the fighters are kinematic characters with
  velocity, knockback and gravity (gives exact control over the feel); fragments are simple rigid
  bodies (position, velocity, spin, bounce/friction on floor and arena walls, sleep when still).
  This is faster on phones than a general physics engine and easier to tune. A real engine
  (cannon-es / Rapier) can be swapped in later behind the same `physics.js` interface if needed.
- Models are **built in code from primitives** (egg = lathe geometry, blocky limbs = boxes, armour = extruded shapes),
  so they are true 3D, tiny, and every chocolate piece is a real separate mesh.
- **Not Roblox Studio.** The game is "Roblox-inspired" in look, built on the same stack as your current project.
  (If you actually want it inside Roblox Studio / Luau, the plan changes completely — tell me before Phase 1.)
- The name stays generic ("Chocolate Egg Fighters") — no real chocolate-brand names or logos.

### Folder layout (proposed)

```
egg-fighters/
  index.html
  lib/three.module.min.js        vendored
  src/main.js                    boot, loop, fixed 60 Hz step
  src/game/match.js              game management: rounds, win/lose, restart, slow-mo, hit-stop clock
  src/game/input.js              keyboard + touch joystick/buttons
  src/game/ai.js                 opponent brain (rhythm, spacing, randomness)
  src/fighters/roster.js         character definitions (data only: costume, stats, combos)
  src/fighters/model.js          shared body rig: egg + limbs + face, joints for animation
  src/fighters/costumes.js       ninja / samurai accessory builders
  src/fighters/movement.js       locomotion, facing, dash, circling, knockback, recovery
  src/fighters/animator.js       procedural poses (punch, wind-up, flinch, tumble, idle bounce)
  src/combat/moves.js            move data: startup/active/recovery frames, reach, damage, knockback, hit-stop
  src/combat/combat.js           combo state machine, hit detection, hit reactions
  src/damage/shell.js            pre-fractured shell layer (chunks, chunk HP, crack textures)
  src/damage/eggDamage.js        damage calc, localised chunk damage, 5 stages
  src/damage/fragments.js        flying/settled chocolate pieces + crumbs (pooled)
  src/damage/capsule.js          yellow capsule: pop out, roll, open, toy reveal
  src/world/arena.js             blocky arena, walls, lighting
  src/world/camera.js            follow midpoint, zoom by distance, shake, finisher punch-in
  src/fx/fx.js                   impact flash, smear trails, vignette, dust
  src/audio.js                   synthesized SFX (pattern from Mycelium Forest)
  src/ui/hud.js                  health bars, stage pips, round/victory screens
```

## 5. Key designs

### 5.1 The three physical layers

Each egg is three nested, separately built meshes on the same body:

1. **Brown shell** — egg surface (radius 1.0), **pre-fractured into ~40–60 curved chunks** with thickness
   (jittered Voronoi-style patches on the egg surface), milk-chocolate material (warm brown, soft specular, slight subsurface tint).
2. **White shell** — a second, slightly smaller egg (radius ~0.93), its own ~30–40 chunks, cream-white material.
   It physically sits under the brown one, so it is only seen through holes.
3. **Yellow capsule** — a glossy plastic capsule of two halves inside (radius ~0.8), holding a small toy model.

Damage is **localised**: a hit damages chunks around the contact point (falloff by distance), so the
side that gets punched breaks first. Each chunk has HP:
- partly damaged → crack overlay on that chunk (procedural crack texture, alpha grows with damage);
- HP 0 → the chunk is hidden on the body and an identical piece is **spawned as a physical fragment** with
  outward + hit-direction velocity and spin; it bounces, slides and **stays on the arena floor** (pooled, capped, oldest fade out).
- A white chunk can only break once the brown chunks covering it are gone.

Eyes, mask, helmet etc. sit on the **costume/face layer** that follows the body, so the fighter stays
readable and expressive even when a lot of shell is gone (the eyes move inward with the remaining surface).

### 5.2 Five stages (driven by accumulated damage, persistent, never reset)

| Stage | Accumulated damage | Guaranteed visual |
|---|---|---|
| 1 Perfect egg | 0 % | all chunks intact |
| 2 Cracked brown | > 0–20 % | cracks on hit areas, first small chips fly |
| 3 White revealed | 20–50 % | large brown areas gone, white clearly visible |
| 4 White breaking | 50–85 % | white cracks and chips, yellow capsule visible through holes |
| 5 Capsule release | 100 % = KO | remaining shell bursts, capsule falls out, rolls, opens, random toy pops out |

If localised hits haven't produced the guaranteed look when a stage threshold is crossed, the system
breaks the weakest chunks to match — so stage and visuals always agree.

### 5.3 Combat feel (from the video)

- **Per-fighter state machine:** Neutral(approach / circle / retreat) → Dash → Attack(startup → active → recovery,
  with a cancel window into the next combo hit) → Hitstun(flinch, pushed back) → Launched(airborne tumble) → Recover → KO.
- **Facing:** snaps toward the opponent in ~0.08 s (fast slerp), the whole body leans into movement; squash & stretch on landing and impacts.
- **Combos (data in `moves.js`):** Jab-Jab (0.2 s apart), Jab-Jab-Spin finisher (0.6 s wind-up spin with smear),
  Dash-strike, Launcher (heavy, lifts the target). Ninja: faster, lighter, katana slash special. Samurai: slower, heavier, bigger knockback.
- **Reactions to every hit:** light → doubled-over flinch + 0.3–0.5 m slide; heavy → lifted and tumbling,
  then a balance-recovery wobble; nobody stands still between hits.
- **Neutral movement:** AI and the player constantly circle, step in/out, feint and dash; AI timing is randomised
  (±20–30 %) so the two fighters are never in sync.
- **Juice:** hit-stop 40 ms (light) → 120 ms (heavy), camera shake scaled by force, impact flash sprite,
  smear trails on swings, chocolate chips and crumbs on every hit, and on finishers the video's
  **darkened vignette + bright flash + short slow-mo**.
- **Controls:** WASD/arrows move, `J` attack (tap-tap = combo), `K` dash, `L` heavy; on phones a joystick + 3 buttons.
  Plus a **CPU-vs-CPU demo mode** used to tune and compare the feel against the video.

## 6. Phases and how each is tested

| Phase | Build | Test before moving on |
|---|---|---|
| **1** Characters + arena | `egg-fighters/` page, Three.js, shared rig, Ninja + Samurai costumes, blocky arena, camera, idle animation | Playwright screenshots of both fighters from 4 angles + arena; runs at 60 fps desktop; you review the look |
| **2** Movement + combat dynamics | movement, fast turning, dash, circling, combos, hit reactions, knockback, hit-stop, shake, smears, AI, CPU-vs-CPU | Recorded GIF/clip of CPU-vs-CPU compared side by side with the video timing; automated sim of 50 bouts checking no stuck states, fighters stay in arena, combo timings within targets |
| **3** Three layers + 5 stages | brown/white shells pre-fractured, capsule inside, chunk HP, cracks, stage logic | debug keys `1`–`5` force each stage; screenshots of all 5 stages for both fighters; unit checks that damage only accumulates |
| **4** Destruction + capsule | physical fragments, crumbs, floor persistence, capsule pop/roll/open, toy reveal | stress test (many fragments, fps stays ≥ 50 on a mid phone in the APK), screenshots/clip of the final burst |
| **5** Playable 1v1 | player vs CPU, health/stage HUD, KO/victory/defeat, rematch, sound, Android APK | full playthroughs on desktop and phone; README section; APK in `download/` |

Each phase is committed and pushed separately with screenshots so you can review before the next one.

## 7. Questions before Phase 1 (defaults in bold if you don't answer)

1. Engine: **Three.js web game like your current project** — or real Roblox Studio (Luau)?
2. Weapons: the video's fighter swings a weapon. **Punches as the base + a costume special (katana / heavy samurai swing)**, or punches only?
3. Who plays: **you vs CPU (+ CPU-vs-CPU demo)**, or also two players on one keyboard?
4. Android APK for this game: **yes, as a separate app next to Mycelium Forest**, in Phase 5.
