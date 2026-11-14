#!/usr/bin/env python3
"""Make PWA icons for both apps from the APPROVED logo (never a hand-picked file).
Usage: python3 scripts/make-icons.py   (run from repo root; needs Pillow)"""
import subprocess, json, pathlib
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
logo = pathlib.Path(subprocess.check_output(
    ['approved', 'get', str(pathlib.Path.home() / '.workflow/scratch/marketing/brand/bone-kit/logo')], text=True).strip())
bg = json.loads((root / 'BRAND.lock').read_text())['dark']['bg']
bg_rgb = tuple(int(bg[i:i + 2], 16) for i in (1, 3, 5))
src = Image.open(logo).convert('RGB')

def maskable(size):
    # 80% safe zone: shrink the tile onto the lock's dark bg so launcher masks never clip the art
    canvas = Image.new('RGB', (size, size), bg_rgb)
    inner = int(size * 0.8)
    canvas.paste(src.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2,) * 2)
    return canvas

for app in ('mandi-ghost', 'seance-board'):
    pub = root / 'apps' / app / 'public'
    pub.mkdir(exist_ok=True)
    for n in (192, 512):
        src.resize((n, n), Image.LANCZOS).save(pub / f'icon-{n}.png')
    maskable(512).save(pub / 'icon-maskable-512.png')
    src.resize((180, 180), Image.LANCZOS).save(pub / 'apple-touch-icon.png')
print('ok', logo)
