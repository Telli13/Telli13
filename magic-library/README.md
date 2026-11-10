# Magic Library Desktop — web prototype (Phase 1)

A cozy magical library that shows your folders as books on a big carved bookcase,
in a 2.5D room: window light with floating dust, candles, a desk with an open book, cup and quill.
This is the **browser prototype**. It uses **fake sample folders**, so nothing on your disk is read or changed.

## How to run it (no programming needed)

1. On GitHub, open the repository, switch to the branch with this folder, click the green **Code** button → **Download ZIP**.
2. Unzip it anywhere (right‑click → *Extract All…*).
3. Open the folder `magic-library` and **double‑click `index.html`**. It opens in Edge or Chrome.
4. Press **F11** for full screen (F11 again to leave).

Nothing to install. It works offline.

## What you can do

| Action | How |
|---|---|
| Look at a book | Move the wand over it: it glows and slides out a little |
| Open a book (folder) | Click it: it flies out, the cover opens, the pages show files and sub‑folders |
| Turn pages | Click the right/left page, the arrows in the page corners, the **← →** keys or the mouse wheel |
| Open a sub‑folder | Click a bold "chapter" line: pages riffle forward, a new ribbon appears on top |
| Go back up | Click a ribbon at the top of the book, or press **Backspace** |
| Close the book | **Close** button, **Esc**, or click outside the book |
| Move between bookcases | Big arrows on the sides, the dots at the bottom, or **← →** |
| Search spell | Click the search field, **or just start typing anywhere**. The best match glows on its shelf. Stop typing for about a second (or press **Enter**) and the book flies to you, opened at the right chapter. **↑ ↓** pick another result |
| Exit | **Exit** button, top right. In the real app it returns to the normal Windows desktop |
| Calm mode | **Calm** button at the bottom left: no parallax, no dust, slower candles, softer glow. It remembers your choice |
| Try other amounts of folders | Bottom‑left **Sample library**: *Few folders* (small bookcases + decor), *Normal*, *Many folders* (several walls of bookcases) |

## Files (what is where)

```
magic-library/
  index.html          the page itself (scene layers + controls)
  ART-PROMPTS.md      the list of pictures to generate, with sizes and ready prompts
  art/                put generated pictures here (exact file names, see art/README.txt)
  css/style.css       all the looks: room, bookcase, books, plates, candles, pages, animations
  js/texts.js         ALL words shown on screen (change or translate them here)
  js/art.js           placeholder icons + shelf decor (candles, globe, plant, hourglass, potion…)
  js/art-slots.js     the list of swappable pictures; loads art/<file> when it exists
  js/scene.js         the room around the bookcase: window, light beam, desk, armchair, globe, plant…
  js/data-fake.js     the fake folders (the only file that will be swapped for real disk access)
  js/platform.js      "talk to Windows" functions: exit, open a file (do nothing in the browser)
  js/layout.js        math: book size, shelf tiers, where the bookcase stands, sections on tiers
  js/library.js       draws the bookcase: Favorites tier + search, sections, brass plates, books
  js/book.js          the open book: pages, page turning, ribbons
  js/search.js        the search spell
  js/effects.js       wand cursor, sparkles, mouse parallax, window dust, calm mode, speed safety net
  js/app.js           starts everything, keyboard, Exit dialog, Calm button
```

## The scene in layers

Back to front: **room** (wall + arched window) → **window light + dust** → **bookcase** → **desk and decor**
(armchair, globe, plant, candles, open book, cup, quill) → **warm light and vignette**.
When the mouse moves, the room shifts a little one way and the desk the other way, so the scene has depth.
The bookcase itself stays still, so books never slide away from the wand.

## Built for speed

* Only the **visible** wall of shelves exists on screen. Other walls are only data until you move there.
* An open book only draws its **two visible pages** (one on phones), plus one turning page during the animation.
* While a book is open, the room behind it stops moving (no parallax, no dust).
* All page and book animations are short (0.3–0.5 s).
* The always-on effects are cheap: only the small candle flames flicker; the glows are still pictures;
  dust is ~50 soft dots drawn at half resolution, 30 times a second; parallax only runs while the mouse moves.
* **Safety net:** if the computer can't keep up (under ~40 frames per second), parallax and dust switch off by
  themselves. Calm mode does the same on purpose.
* The wand is a normal system cursor image, so moving the mouse costs nothing.
* No downloaded fonts or libraries. Everything is local.

## Replacing the art

Every picture is a **slot** with a fixed file name. Generate the pictures listed in **ART-PROMPTS.md**,
save them into `art/` with exactly those names, and reload. No code changes are needed. Missing files keep the
placeholder drawing. The bookcase is built from pieces (back, sides, crown, base, shelves, pillars, plates), so it
still fits any number of folders and any screen size. Candle flames, tea steam and dust stay animated by code on
top of the pictures. All words stay code-drawn, so pictures must contain no text.

## Later: turning it into a Windows app with Tauri (Phase 2)

The code is already split so that only two small files need to change:

1. **`js/data-fake.js` → a real data source.** It must provide the same functions
   (`getLocations`, `listFolder`, `getFavorites`, `search`). In Tauri they will call Rust commands
   such as `list_dir(path)` that read the disk.
2. **`js/platform.js`** already calls Tauri commands `exit_shell` and `open_path` when it runs inside the app.
   They only need to be written on the Rust side.

The folder needs no build step: Tauri's `frontendDist` can point straight at `magic-library/`.
The window will be full‑screen and borderless, and it can start with Windows instead of the normal desktop.
