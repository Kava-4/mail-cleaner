from PIL import Image
import numpy as np
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = os.path.join(ROOT, "apps", "web", "public")

# Original wide render with rounded-square background
src = os.path.join(out_dir, "icon-source.png")
if not os.path.exists(src):
    src = os.path.join(
        os.path.expanduser("~"),
        ".cursor",
        "projects",
        "c-Users-kavao-OneDrive-Desktop-mail-cleaner",
        "assets",
        "icon.png",
    )

img = Image.open(src).convert("RGBA")
arr = np.array(img, dtype=np.float32)
h, w = arr.shape[:2]
lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]

# Detect glass disc center from bright interior pixels
interior = lum > 70
ys, xs = np.where(interior)
cx = float(xs.mean())
cy = float(ys.mean())

# Outer edge of glass circle: scan outward until ring stays dark
radius = 360
for r in range(300, 430):
    angles = np.linspace(0, 2 * np.pi, 720, endpoint=False)
    px = (cx + r * np.cos(angles)).astype(int)
    py = (cy + r * np.sin(angles)).astype(int)
    px = np.clip(px, 0, w - 1)
    py = np.clip(py, 0, h - 1)
    ring = lum[py, px]
    if ring.mean() > 42:
        radius = r

radius = min(radius + 1, 392)
print(f"center=({cx:.1f},{cy:.1f}) radius={radius}")

yy, xx = np.ogrid[:h, :w]
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
feather = 2.5
circle_alpha = np.clip((radius - dist) / feather, 0, 1) * 255
arr[:, :, 3] = np.minimum(arr[:, :, 3], circle_alpha)

size = int(radius * 2 + 4)
left = max(0, int(cx - size / 2))
top = max(0, int(cy - size / 2))
cropped = Image.fromarray(arr.astype(np.uint8), "RGBA").crop(
    (left, top, min(w, left + size), min(h, top + size))
)

side = max(cropped.size)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(cropped, ((side - cropped.size[0]) // 2, (side - cropped.size[1]) // 2))
final = square.resize((512, 512), Image.Resampling.LANCZOS)

for name in ["icon.png", "apple-touch-icon.png"]:
    final.save(os.path.join(out_dir, name), "PNG")
    print("saved", name)
