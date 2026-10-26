#!/usr/bin/env python3
"""
Decode QR matrices produced by Bahar's vendored encoder (src/lib/qr.ts).
Renders each matrix to PNG (scale 8, border 4) and decodes with cv2.QRCodeDetector.
Also includes a DAMAGE TEST: flips up to N random data modules to test error correction.
"""
import json, sys
import numpy as np
from PIL import Image
import cv2

cases = json.loads(sys.argv[1])

def matrix_to_img(matrix, scale=8, border=4, invert=False):
    n = len(matrix)
    dim = n + border * 2
    arr = np.ones((dim, dim), dtype=np.uint8) * 255
    for y, row in enumerate(matrix):
        for x, v in enumerate(row):
            if v != invert:
                arr[y + border, x + border] = 0
    img = Image.fromarray(arr, "L").resize((dim * scale, dim * scale), Image.NEAREST)
    return np.array(img)

det = cv2.QRCodeDetector()
all_ok = True
for c in cases:
    m = c["matrix"]
    img = matrix_to_img(m)
    data, pts, _ = det.detectAndDecode(img)
    ok = data == c["text"]
    # error-correction damage test (deterministic seed)
    damaged = [row[:] for row in m]
    rng = np.random.default_rng(42)
    n = len(m)
    flipped = 0
    try_max = int(c.get("damage", 0))
    while flipped < try_max:
        y, x = int(rng.integers(0, n)), int(rng.integers(0, n))
        # avoid finder patterns (top-left, top-right, bottom-left 8x8 zones)
        if (x < 9 and y < 9) or (x >= n - 9 and y < 9) or (x < 9 and y >= n - 9):
            continue
        damaged[y][x] = not damaged[y][x]
        flipped += 1
    dmg_ok = None
    if try_max > 0:
        img2 = matrix_to_img(damaged)
        d2, _, _ = det.detectAndDecode(img2)
        dmg_ok = d2 == c["text"]
    status = "OK" if ok else f"FAIL (decoded={data!r})"
    dmg_status = "" if dmg_ok is None else (" | damaged(ECC) OK" if dmg_ok else f" | damaged FAIL (decoded={d2!r})")
    print(f'{c["text"][:36]:<38} ecl={c["ecl"]:<8} {status}{dmg_status}')
    if not ok:
        all_ok = False

print("RESULT:", "ALL DECODED CORRECTLY — QR implementation VALID" if all_ok else "FAILED")
