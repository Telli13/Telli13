#!/usr/bin/env python3
"""Cut individual sprites out of the art sheets (white background -> transparent PNG).

Usage:  python3 tools/cut_sprites.py
Needs:  pip install pillow numpy scipy

How it works
1. Background = near-white pixels connected to the sheet border (flood fill),
   so white details *inside* objects (daisy petals, mushroom spots) survive.
2. Along the background and its edge band we apply "colour to alpha" against
   white, which keeps soft anti-aliased edges and halos instead of a hard cut.
3. Opaque pixels are grouped into objects with connected-component labelling
   (after a dilation so loose grass blades / crumbs stick to their object),
   sorted in reading order and saved with the names listed in SHEETS.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art", "source")
OUT = os.path.join(ROOT, "art", "sprites")

# Names in reading order (top row left->right, then the next row ...).
SHEETS = {
    "underground_sheet.png": dict(
        rows=[
            ["mycelium_1", "mycelium_2", "mycelium_3", "mycelium_4", "mycelium_5"],
            ["roots_stump", "roots_long", "roots_turf"],
            ["worm", "grub", "beetle", "woodlouse", "ant"],
            ["water_drop", "water_pool", "leaf", "crystal", "sugar", "spore"],
            ["rock_mossy", "log_hollow", "burrow"],
        ],
        merge=3,
    ),
    "animals_mushrooms_sheet.png": dict(
        rows=[
            ["hedgehog", "squirrel", "rabbit", "robin", "bluetit"],
            ["mushroom_1", "mushroom_2", "mushroom_3", "mushroom_4", "mushroom_5", "mushroom_6"],
        ],
        merge=3,
    ),
    "rocks_tiles_sheet.png": dict(
        rows=[
            ["rock_1", "rock_2", "rock_3", "rock_4"],
            ["log", "branch", "leaf_pile"],
            ["soil_tile_1", "soil_tile_2", "soil_tile_3"],
        ],
        merge=3,
        # the three soil tiles almost touch: force a cut (x, y_from, y_to)
        cuts=[(516, 600, 1024), (1016, 600, 1024)],
    ),
    "trees_plants_sheet.png": dict(
        rows=[
            ["oak", "birch", "spruce"],
            ["bush_berries", "bush_flowers", "fern_1", "fern_2"],
            ["daisies", "bluebells", "buttercups", "grass_1", "grass_2", "grass_3"],
        ],
        merge=3,
    ),
}

BG_DIST = 34      # "distance from white" below which a pixel may be background
EDGE_BAND = 3     # px of object edge that also gets colour-to-alpha
HOLE_MEAN = 9     # mean distance from white of an enclosed hole to count as background
HOLE_MIN = 60     # px; smaller enclosed white spots are kept (petals, highlights)
MIN_AREA = 600    # ignore specks smaller than this (px of opaque area)


def cut_alpha(rgb):
    """Return float RGBA (0..1) with the white background removed."""
    f = rgb.astype(np.float32) / 255.0
    dist = 1.0 - f.min(axis=2)                       # 0 = pure white
    cand = dist < BG_DIST / 255.0
    lab, n = ndi.label(cand)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border != 0]
    bg = np.isin(lab, border)
    # holes of almost pure white enclosed by an object (gaps between roots,
    # grass blades, under the ant...) are background too; light-but-shaded
    # details such as daisy petals or mushroom spots have a higher mean distance.
    means = ndi.mean(dist, lab, index=np.arange(1, n + 1))
    sizes = ndi.sum(cand, lab, index=np.arange(1, n + 1))
    holes = np.where((means < HOLE_MEAN / 255.0) & (sizes > HOLE_MIN))[0] + 1
    bg |= np.isin(lab, holes)
    soft = ndi.binary_dilation(bg, iterations=EDGE_BAND)

    # colour to alpha against white: alpha = max channel distance from white
    a = (1.0 - f).max(axis=2)
    a = np.clip(a / 0.55, 0, 1)                      # boost so real colours stay opaque
    alpha = np.where(soft, a, 1.0)
    alpha[bg & (dist < 6 / 255.0)] = 0.0
    # un-premultiply the white so edges are not haloed
    safe = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip((f - (1.0 - alpha[..., None])) / safe, 0, 1)
    col = np.where(soft[..., None], col, f)
    return np.dstack([col, alpha])


def components(alpha, merge, cuts=()):
    solid = alpha > 0.12
    for x, y0, y1 in cuts:
        solid[y0:y1, x - 2:x + 3] = False
    grown = ndi.binary_dilation(solid, iterations=merge)
    for x, y0, y1 in cuts:
        grown[y0:y1, x - 2:x + 3] = False
    lab, n = ndi.label(grown)
    objs = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        own = (lab[sl] == i) & solid[sl]
        if own.sum() < MIN_AREA:
            continue
        objs.append((sl, i))
    return lab, objs


def reading_order(objs, nrows):
    """Group objects into nrows rows by vertical centre (k-means-ish), then sort by x."""
    cy = np.array([(s[0].start + s[0].stop) / 2 for s, _ in objs])
    # initial row centres spread over the range
    centres = np.linspace(cy.min(), cy.max(), nrows)
    for _ in range(20):
        idx = np.abs(cy[:, None] - centres[None, :]).argmin(axis=1)
        for r in range(nrows):
            if (idx == r).any():
                centres[r] = cy[idx == r].mean()
    idx = np.abs(cy[:, None] - centres[None, :]).argmin(axis=1)
    rows = []
    for r in np.argsort(centres):
        members = [objs[k] for k in np.where(idx == r)[0]]
        members.sort(key=lambda o: o[0][1].start)
        rows.append(members)
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    ok = True
    for sheet, cfg in SHEETS.items():
        img = Image.open(os.path.join(SRC, sheet)).convert("RGB")
        rgba = cut_alpha(np.asarray(img))
        lab, objs = components(rgba[..., 3], cfg["merge"], cfg.get("cuts", ()))
        rows = reading_order(objs, len(cfg["rows"]))
        for r, (names, members) in enumerate(zip(cfg["rows"], rows)):
            if len(names) != len(members):
                ok = False
                print(f"!! {sheet} row {r}: expected {len(names)} objects, found {len(members)}:",
                      [(m[0][1].start, m[0][0].start) for m in members])
                continue
            for name, (sl, i) in zip(names, members):
                pad = 2
                y0, y1 = max(sl[0].start - pad, 0), min(sl[0].stop + pad, lab.shape[0])
                x0, x1 = max(sl[1].start - pad, 0), min(sl[1].stop + pad, lab.shape[1])
                crop = rgba[y0:y1, x0:x1].copy()
                crop[..., 3] *= (lab[y0:y1, x0:x1] == i)        # drop neighbours' pixels
                out = Image.fromarray((crop * 255 + 0.5).astype(np.uint8), "RGBA")
                out.save(os.path.join(OUT, name + ".png"), optimize=True)
                print(f"{sheet:30s} -> {name:14s} {out.size}")
    # the forest background is used as-is (no cut-out needed)
    Image.open(os.path.join(SRC, "background.png")).convert("RGB").save(
        os.path.join(OUT, "background.jpg"), quality=88)
    print("background.jpg saved")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
