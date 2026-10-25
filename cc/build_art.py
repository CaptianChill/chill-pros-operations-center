"""Build clean (data-free) art layers + diamond shine masks for the Command Center.

Usage: python3 cc/build_art.py [desktop_src] [mobile_src]
Writes cc/desktop.webp, cc/mobile.webp, cc/desktop-shine.webp, cc/mobile-shine.webp
"""
import sys
import cv2
import numpy as np

DESKTOP_CLEAN = {
    "rects": [
        (360, 634, 594, 678),   # digital time
        (360, 684, 536, 709),   # date
        (711, 620, 736, 647),   # "3"
        (1031, 620, 1055, 647), # "0"
        (1393, 664, 1466, 700), # temp
        (1393, 701, 1444, 724), # condition
        (1393, 726, 1488, 748), # hi / lo
        (60, 902, 166, 930),    # server time
        (66, 930, 160, 951),    # server date
    ],
    "circles": [(292, 659, 28)],
    "flat": [(1310, 100, 1486, 520), (1318, 664, 1388, 736)],
}
MOBILE_CLEAN = {
    "rects": [
        (286, 996, 712, 1068),
        (292, 1076, 574, 1112),
        (202, 1166, 236, 1205),
        (202, 1316, 238, 1356),
    ],
    "circles": [(168, 1043, 50)],
}


def clean(path, spec, out):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    mask = np.zeros(img.shape[:2], np.uint8)
    for x0, y0, x1, y1 in spec["rects"]:
        mask[y0:y1, x0:x1] = 255
    for cx, cy, r in spec["circles"]:
        cv2.circle(mask, (cx, cy), r, 255, -1)
    # inpaint fills with surrounding panel colour; then darken filled text zones slightly
    res = cv2.inpaint(img, mask, 6, cv2.INPAINT_TELEA)
    big = mask > 0
    blur = cv2.GaussianBlur(res, (0, 0), 6)
    res[big] = blur[big]
    for x0, y0, x1, y1 in spec.get("flat", []):
        ring = np.concatenate([img[y0 - 3:y0, x0:x1].reshape(-1, 3), img[y1:y1 + 3, x0:x1].reshape(-1, 3)])
        col = np.median(ring, axis=0)
        res[y0:y1, x0:x1] = col
    cv2.imwrite(out, res, [cv2.IMWRITE_WEBP_QUALITY, 92])
    return res


def shine_mask(path, out):
    img = cv2.imread(path, cv2.IMREAD_COLOR).astype(np.float32)
    lum = img.mean(2)
    sat = img.max(2) - img.min(2)
    m = np.clip((lum - 150) / 90, 0, 1) * np.clip((70 - sat) / 50, 0, 1)
    m = cv2.GaussianBlur(m, (0, 0), 0.8)
    a = (m * 255).astype(np.uint8)
    rgba = np.dstack([np.full_like(a, 255)] * 3 + [a])
    cv2.imwrite(out, rgba, [cv2.IMWRITE_WEBP_QUALITY, 80])


if __name__ == "__main__":
    d = sys.argv[1] if len(sys.argv) > 1 else "cc/desktop-src.png"
    m = sys.argv[2] if len(sys.argv) > 2 else "cc/mobile-src.png"
    clean(d, DESKTOP_CLEAN, "cc/desktop.webp")
    clean(m, MOBILE_CLEAN, "cc/mobile.webp")
    shine_mask(d, "cc/desktop-shine.webp")
    shine_mask(m, "cc/mobile-shine.webp")
    print("ok")
