#!/usr/bin/env python3
"""Cut art/source/sheet2_creatures.png (already transparent) into art/sprites2/*.png.
Objects are found by their alpha, grouped into the sheet's 8 rows and named in reading order."""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'source', 'sheet2_creatures.png')
OUT = os.path.join(ROOT, 'art', 'sprites2')
BANDS = [(0, 135), (135, 255), (255, 395), (395, 515), (515, 600), (600, 745), (745, 862), (862, 1024)]
NAMES = [
    ['rabbit_sit', 'rabbit_sit2', 'rabbit_crouch', 'rabbit_hop1', 'rabbit_hop2', 'rabbit_leap', 'rabbit_sleep',
     'hedgehog_1', 'hedgehog_2', 'hedgehog_3', 'hedgehog_4', 'hedgehog_ball'],
    ['squirrel_sit', 'squirrel_sit2', 'squirrel_stand', 'squirrel_run1', 'squirrel_run2', 'squirrel_eat', 'squirrel_eat2',
     'robin_stand', 'robin_peck', 'robin_fly1', 'robin_fly2', 'robin_fly3', 'robin_stand2'],
    ['fox_sit', 'fox_stand', 'fox_walk1', 'fox_walk2', 'fox_run', 'boar_1', 'boar_2', 'boar_3', 'boar_root', 'boar_puff'],
    ['wolf_1', 'wolf_2', 'wolf_3', 'wolf_growl', 'badger_1', 'badger_2', 'badger_3', 'spider_1', 'spider_2', 'spider_3'],
    ['ant_1', 'ant_2', 'ant_3', 'beetle_1', 'beetle_2', 'beetle_3', 'louse_1', 'louse_2', 'louse_ball',
     'worm_long', 'worm_short', 'grub_1', 'grub_2'],
    ['amanita_1', 'amanita_2', 'amanita_3', 'amanita_4', 'blue_1', 'blue_2', 'blue_3', 'purple_1',
     'chant_1', 'chant_2', 'chant_3', 'chant_4', 'pink_cluster', 'bracket_stump'],
    ['bolete', 'bolete_cluster', 'morel', 'coral', 'magenta_cluster', 'truffles', 'teal_cluster', 'violet_cluster',
     'leaf2', 'berries', 'acorns', 'acorn', 'pinecone', 'moss', 'sticks'],
    ['myc_1', 'myc_2', 'myc_3', 'myc_4', 'myc_5', 'myc_6', 'ore_blue_low', 'ore_blue', 'ore_purple_low', 'ore_purple',
     'ore_gold', 'rock_plain', 'nest_glow', 'orb'],
]

im = Image.open(SRC).convert('RGBA')
a = np.asarray(im)
solid = a[..., 3] > 128
lab, _ = ndi.label(ndi.binary_dilation(solid, iterations=1))
rows = [[] for _ in BANDS]
for i, sl in enumerate(ndi.find_objects(lab), 1):
    if (solid[sl] & (lab[sl] == i)).sum() <= 250:
        continue
    cy = (sl[0].start + sl[0].stop) / 2
    for k, (y0, y1) in enumerate(BANDS):
        if y0 <= cy < y1:
            rows[k].append((sl, i))
os.makedirs(OUT, exist_ok=True)
for k, (names, objs) in enumerate(zip(NAMES, rows)):
    objs.sort(key=lambda o: o[0][1].start)
    assert len(objs) == len(names), (k, len(objs), len(names))
    for name, (sl, i) in zip(names, objs):
        p = 2
        y0, y1 = max(0, sl[0].start - p), min(a.shape[0], sl[0].stop + p)
        x0, x1 = max(0, sl[1].start - p), min(a.shape[1], sl[1].stop + p)
        crop = a[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(lab[y0:y1, x0:x1] == i, crop[..., 3], 0)  # drop the neighbours' pixels
        Image.fromarray(crop, 'RGBA').save(os.path.join(OUT, name + '.png'), optimize=True)
print('saved', sum(len(n) for n in NAMES), 'sprites to', OUT)

# the two forest backgrounds: top half is day, bottom half is night (a white line between)
bg = Image.open(os.path.join(ROOT, 'art', 'source', 'bg_day_night.png')).convert('RGB')
bg.crop((0, 0, bg.width, 503)).save(os.path.join(ROOT, 'art', 'sprites', 'bg_day.jpg'), quality=90)
bg.crop((0, 513, bg.width, bg.height)).save(os.path.join(ROOT, 'art', 'sprites', 'bg_night.jpg'), quality=90)
print('saved bg_day.jpg, bg_night.jpg')
