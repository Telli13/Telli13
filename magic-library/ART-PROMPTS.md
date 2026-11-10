# Images to generate for Magic Library Desktop

Generate each image below in ChatGPT (or any image tool). Save it with the **exact file name** into the
folder `magic-library/art/` and reload the page (F5). It replaces the code-drawn placeholder automatically.
Missing images are skipped, so you can add them one at a time.

**Important for every image**
- **No text, letters, numbers or logos anywhere.** All words (folder names, plates, buttons) are drawn by the app.
- PNG files need a **transparent background** (ask for it, as in the prompts).
- Keep one consistent style. Paste this **style line** at the start of every prompt:

> *Style: cozy magical old library, warm golden candlelight, dark old carved wood (walnut / mahogany), rich painterly realism, soft glow, high detail, consistent art set.*

If a tool can't produce the exact size, make the same shape (aspect ratio) and resize afterwards
(for example in Windows Photos → "Resize", or Paint → "Resize" with pixels).

---

## 1. Room (back layer)

| File | Size | Notes |
|---|---|---|
| `room.jpg` | 2560 × 1440 | Shown behind everything, cropped from the left/bottom on other screen shapes |

**Prompt:** *[style line] An empty interior of an old library room, seen straight from the front. On the LEFT third: a tall arched
gothic window with wooden mullions and daylight, an autumn forest outside, ivy leaves around the window frame. The rest of the
back wall: dark carved wood paneling, softly lit. Wooden floor at the bottom. The CENTER and RIGHT of the wall must be EMPTY
(no furniture, no shelves, no books): a big bookcase will be placed there later. No people, no text.*

## 2. Bookcase pieces (the app builds a bookcase of any size from them)

| File | Size | How it is used |
|---|---|---|
| `bookcase-back.jpg` | 1024 × 1024 | Back wall inside the shelves; **tiles** in both directions |
| `bookcase-side.png` | 160 × 1024 | Left and right outer columns; **repeats vertically** |
| `bookcase-crown.png` | 2400 × 240 | Carved top (cornice); **stretched sideways** to the bookcase width |
| `bookcase-base.png` | 2400 × 240 | Bottom plinth with drawers/panels; **stretched sideways** |
| `shelf.png` | 1024 × 64 | Front edge of every shelf board; **repeats sideways** |
| `pillar.png` | 96 × 1024 | Carved column between sections (Drive C | HDD 2TB); **stretched to the shelf height** |
| `plaque.png` | 800 × 160 | Brass name plate; the left and right 15% (ends) stay, the middle stretches |

**bookcase-back.jpg:** *[style line] Seamless tileable texture of dark aged vertical wooden planks, the inside back panel of an old bookcase, soft shadows, no objects. Must tile seamlessly in all directions.*

**bookcase-side.png:** *[style line] A tall carved wooden pilaster (vertical decorative column strip) of an antique bookcase, front view, fluted grooves and subtle carving, seamless when repeated vertically, transparent background, nothing else.*

**bookcase-crown.png:** *[style line] A wide carved wooden cornice for the top of an antique library bookcase, front view, mostly horizontal moldings with one carved ornament in the center and small scrolls at both ends, very wide panoramic format, transparent background.*

**bookcase-base.png:** *[style line] The bottom plinth of an antique carved bookcase, front view, a row of simple carved wooden panels and a molded top edge, very wide panoramic format, transparent background.*

**shelf.png:** *[style line] Front edge of a thick polished wooden bookshelf board, front view, warm highlight on the top edge, seamless when repeated horizontally, transparent background.*

**pillar.png:** *[style line] A narrow carved wooden column / divider between bookshelf sections, front view, carved capital at the top, simple fluting below, transparent background.*

**plaque.png:** *[style line] An empty polished brass name plate with ornate pointed ends and two small rivets, front view, warm reflections, completely blank in the middle (no text), wide format, transparent background.*

## 3. Book spines (the app colors them and writes the names)

| File | Size | Notes |
|---|---|---|
| `spine-1.png`, `spine-2.png`, `spine-3.png` | 256 × 768 | **Grey** leather texture; the app tints it to 8 colors |

**Prompt (make 3 variations):** *Seamless grayscale leather texture for a book spine, medium grey overall (not dark, not light), subtle wear, creases and grain,
slightly rounded spine shading, NO gold bands, NO decorations, NO text. Flat front view, fills the whole image.*

> Gold bands, the icon, the tree emblem and the name are drawn by code on top, so the texture must stay plain.

## 4. Decor (used on shelves AND in the room, on transparent background)

| File | Size | Notes |
|---|---|---|
| `candle.png` | 400 × 1000 | **No flame!** The app draws a living flame. The candle fills the full height, wick tip touching the **top center** edge |
| `globe.png` | 800 × 1000 | Antique globe on a stand |
| `plant.png` | 800 × 1200 | Potted green plant |
| `hourglass.png` | 400 × 800 | Wooden/brass hourglass |
| `potion.png` | 500 × 800 | Round glass flask with glowing amber liquid |
| `book-stack.png` | 800 × 600 | 3–4 old books lying flat (spines blank) |
| `crystal-ball.png` | 500 × 700 | Small crystal ball on a brass stand |

**candle.png:** *[style line] A single thick ivory pillar candle with wax drips in a small brass holder, front view, the wick is NOT lit (no flame, no glow), the candle fills the whole image height with the wick tip at the very top center, transparent background.*

**globe.png:** *[style line] An antique world globe on a carved wooden and brass stand, front view, full object visible, transparent background, no text on the globe.*

**plant.png:** *[style line] A lush green potted plant with large leaves in an aged terracotta or brass pot, front view, full object visible, transparent background.*

**hourglass.png:** *[style line] An antique hourglass with wooden caps and brass posts, golden sand, front view, transparent background.*

**potion.png:** *[style line] A round glass alchemy flask with a cork, filled with softly glowing amber liquid, front view, transparent background.*

**book-stack.png:** *[style line] A small stack of three old leather books lying flat, blank spines without any text, front view, transparent background.*

**crystal-ball.png:** *[style line] A small crystal ball with a warm inner glow on an ornate brass stand, front view, transparent background.*

## 5. Foreground (in front of the bookcase)

| File | Size | Notes |
|---|---|---|
| `desk.png` | 2560 × 400 | Full-width desk: top surface in the upper ~35%, front edge below. **Stretched to the screen width** |
| `armchair.png` | 1000 × 1300 | Bottom-left corner of the screen |
| `open-book.png` | 1000 × 450 | Lies on the desk |
| `quill-inkwell.png` | 400 × 800 | Feather quill in an inkwell |
| `cup.png` | 600 × 520 | **No steam** (the app animates steam) |
| `ivy.png` | 1200 × 700 | Hangs over the top-left corner of the bookcase |

**desk.png:** *[style line] A long polished dark wooden desk seen from the front at eye level: the top surface with warm candle reflections in the upper part, the thick carved front edge in the lower part, completely empty (no objects), very wide panoramic format, transparent background above the desk.*

**armchair.png:** *[style line] A tufted dark-red leather armchair with a red patterned wool plaid blanket draped over it, seen from the front-right, placed in the lower-left corner, transparent background.*

**open-book.png:** *[style line] An old open book lying flat on a table, seen slightly from above, the pages show only a faint sketch of a tree (no writing), transparent background.*

**quill-inkwell.png:** *[style line] A white feather quill standing in a small black glass inkwell, front view, transparent background.*

**cup.png:** *[style line] A ceramic mug of tea with a small golden tree emblem, front view, no steam, transparent background.*

**ivy.png:** *[style line] Ivy vines with green and a few golden autumn leaves hanging down from a horizontal line at the top of the image, transparent background.*

## 6. Cursor

| File | Size | Notes |
|---|---|---|
| `wand.png` | 512 × 512 | Magic wand; the app shrinks it to 32 × 32. The **tip must be at the top-left corner** |

**Prompt:** *[style line] A magic wand made of dark wood with a gold band, lying diagonally from the top-left corner to the bottom-right corner, a tiny glowing spark at the tip in the top-left corner, transparent background.*

> When you open `index.html` directly from disk, some browsers don't let the app shrink the picture. If the cursor stays
> the old one, resize `wand.png` to 32 × 32 pixels yourself. In the real Windows app this works automatically.
