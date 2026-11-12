#!/usr/bin/env python3
"""Converts the CC0 Quaternius GLB models in tide/assets-src/ into tide/js/assets.js.

Each model is flattened to one mesh: node transforms applied, material colours baked into
vertex colours, positions quantised to int16, normals to int8. No runtime loader is needed.
Usage: python3 tools/build_tide_assets.py
"""
import json, struct, base64, os, sys
import numpy as np

SRC = os.path.join(os.path.dirname(__file__), '..', 'tide', 'assets-src')
OUT = os.path.join(os.path.dirname(__file__), '..', 'tide', 'js', 'assets.js')
CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def node_mat(n):
    if 'matrix' in n: return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    m[:3, :3] = quat_mat(n.get('rotation', [0, 0, 0, 1])) * np.array(n.get('scale', [1, 1, 1]))
    m[:3, 3] = n.get('translation', [0, 0, 0])
    return m

def load(path):
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl]); bin_ = b[20 + jl + 8:]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        fmt, sz = CT[a['componentType']]; nc = NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', sz * nc)
        raw = np.frombuffer(bin_, dtype=np.uint8, count=(a['count'] - 1) * stride + sz * nc, offset=off)
        idx = (np.arange(a['count'])[:, None] * stride + np.arange(sz * nc)[None, :]).ravel()
        return np.frombuffer(raw[idx].tobytes(), dtype='<' + fmt).reshape(a['count'], nc).astype(np.float64)
    P, N, C, I = [], [], [], []; base = 0
    def walk(ni, parent):
        nonlocal base
        n = j['nodes'][ni]; m = parent @ node_mat(n)
        if 'mesh' in n:
            for pr in j['meshes'][n['mesh']]['primitives']:
                p = acc(pr['attributes']['POSITION']); nrm = acc(pr['attributes']['NORMAL']) if 'NORMAL' in pr['attributes'] else np.tile([0, 1, 0], (len(p), 1))
                p = p @ m[:3, :3].T + m[:3, 3]; nm = np.linalg.inv(m[:3, :3]).T; nrm = nrm @ nm.T
                nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
                col = [1, 1, 1]
                if 'material' in pr: col = j['materials'][pr['material']].get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[:3]
                idx = acc(pr['indices']).ravel().astype(np.int64) if 'indices' in pr else np.arange(len(p))
                if np.linalg.det(m[:3, :3]) < 0: idx = idx.reshape(-1, 3)[:, ::-1].ravel()
                P.append(p); N.append(nrm); C.append(np.tile(col, (len(p), 1))); I.append(idx + base); base += len(p)
        for c in n.get('children', []): walk(c, m)
    for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return np.vstack(P), np.vstack(N), np.vstack(C), np.concatenate(I)

def b64(a): return base64.b64encode(a.tobytes()).decode()

def build(name, fit):
    p, n, c, i = load(os.path.join(SRC, name + '.glb'))
    lo, hi = p.min(0), p.max(0); ctr = (lo + hi) / 2
    if fit == 'base': ctr[1] = lo[1]
    p = p - ctr; dim = (hi - lo).max(); p /= dim            # наибольший габарит = 1
    h = (p[:, 1] - p[:, 1].min()) / max(1e-9, p[:, 1].max() - p[:, 1].min())
    c = c * (0.72 + 0.28 * h[:, None])                        # мягкое затемнение к низу
    ext = float(np.abs(p).max())
    return {'p': b64(np.round(p / ext * 32767).astype('<i2')), 'n': b64(np.round(n * 127).astype('i1')),
            'c': b64(np.round(np.clip(c, 0, 1) ** (1 / 2.2) * 255).astype('u1')), 'i': b64(i.astype('<u2')),
            'e': round(ext, 5), 'd': [round(float(x), 4) for x in (hi - lo) / dim]}, len(p), len(i) // 3

res = {}; tot = 0
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.glb'): continue
    name = f[:-4]; fit = 'base' if name.startswith(('Ship_', 'Rock_', 'Tree_', 'Deco_')) else 'center'
    res[name], v, t = build(name, fit); tot += t
    print(f'{name:22s} verts {v:6d} tris {t:6d} dims {res[name]["d"]}')
with open(OUT, 'w') as o:
    o.write('// Сгенерировано tools/build_tide_assets.py из моделей Quaternius (CC0). Не править руками.\n\'use strict\';\nconst ASSETS = ' + json.dumps(res, separators=(',', ':')) + ';\n')
print('total tris', tot, 'size', os.path.getsize(OUT) // 1024, 'KB')
