# Magic Library Desktop — web prototype (Phase 1)

A cozy magical library that shows your folders as books on bookcases.
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
| Try other amounts of folders | Bottom‑left **Sample library**: *Few folders* (small bookcases + decor), *Normal*, *Many folders* (several walls of bookcases) |

## Files (what is where)

```
magic-library/
  index.html          the page itself
  css/style.css       all the looks: wood, books, pages, glow, animations
  js/texts.js         ALL words shown on screen (change or translate them here)
  js/art.js           placeholder icons + decor (candles, globe, plant, hourglass, potion…)
  js/data-fake.js     the fake folders (the only file that will be swapped for real disk access)
  js/platform.js      "talk to Windows" functions: exit, open a file (do nothing in the browser)
  js/layout.js        math: book size, shelves per bookcase, how bookcases fill the screen
  js/library.js       draws the favorites shelf and the bookcases
  js/book.js          the open book: pages, page turning, ribbons
  js/search.js        the search spell
  js/effects.js       wand cursor + sparkles
  js/app.js           starts everything, keyboard, Exit dialog
```

## Built for speed

* Only the **visible** bookcase wall exists on screen. Other walls are only data until you move to them.
* An open book only draws its **two visible pages**, plus one turning page during the animation.
* All animations are short (0.3–0.5 s, under 1 s even when steps are chained) and only move or fade things, which graphics cards do cheaply.
* The wand is a normal system cursor image, so moving the mouse costs nothing.
* One click listener serves all books, instead of one per book.
* No downloaded fonts or libraries. Everything is local.

## Replacing the art later

All text is drawn by code, so generated images must contain **no words**.

* **Room background**: `body { background: … }` in `css/style.css` → e.g. `url(art/room.jpg) center / cover`.
* **Book spines**: `.book` in `css/style.css`. Add a texture image to its `background` (keep `var(--bc)` for the color tint). The name, icon and emblem stay on top as code.
* **Bookcase wood / shelves**: `.unit` (frame) and `.row::after` (shelf board).
* **Decor**: the `D` list in `js/art.js`. Each item can become `<image href="art/candle.png" …>`.
* **Book cover / pages**: `.cover .front`, `.paper-left`, `.paper-right` in `css/style.css`.

## Later: turning it into a Windows app with Tauri (Phase 2)

The code is already split so that only two small files need to change:

1. **`js/data-fake.js` → a real data source.** It must provide the same functions
   (`getLocations`, `listFolder`, `getFavorites`, `search`). In Tauri they will call Rust commands
   such as `list_dir(path)` that read the disk.
2. **`js/platform.js`** already calls Tauri commands `exit_shell` and `open_path` when it runs inside the app.
   They only need to be written on the Rust side.

The folder needs no build step: Tauri's `frontendDist` can point straight at `magic-library/`.
The window will be full‑screen and borderless, and it can start with Windows instead of the normal desktop.
