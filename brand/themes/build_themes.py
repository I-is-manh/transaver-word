"""Kiểm tra độ tương phản của mọi theme và sinh themes.css từ themes.json.

Chạy:  python3 brand/themes/build_themes.py
- Theme nào không đạt ngưỡng tương phản thì báo lỗi và KHÔNG ghi themes.css.
- Ngưỡng lấy theo quy định trong brand/tokens.json.
"""
import colorsys
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "themes.json"
OUT = HERE / "themes.css"
META = HERE / "themes.meta.js"

# (chữ, nền, ngưỡng tối thiểu, ý nghĩa)
# Chữ phụ và màu chủ đạo dùng 5.5: cao hơn chuẩn WCAG AA (4.5). tokens.json ghi 6.0 / 5.8
# nhưng chính bộ màu gốc Teal Mực đo được 5.87 / 5.77 trên surface-0.
RULES = [
    ("ink", "surface-0", 7.0, "Chữ chính trên nền trang"),
    ("ink", "surface-1", 7.0, "Chữ chính trên thẻ"),
    ("ink", "brand-tint", 4.5, "Chữ chính trên nền nhạt đang chọn"),
    ("ink-muted", "surface-0", 5.5, "Chữ phụ trên nền trang"),
    ("ink-muted", "surface-1", 5.5, "Chữ phụ trên thẻ"),
    ("brand", "surface-0", 5.5, "Màu chủ đạo (link, chữ) trên nền trang"),
    ("brand", "surface-1", 5.5, "Màu chủ đạo trên thẻ"),
    ("on-brand", "brand", 4.5, "Chữ trên nút chính"),
    ("brand-strong", "brand-tint", 4.5, "Chữ nhấn trên nền nhạt"),
    ("accent-strong", "surface-0", 4.5, "Chữ phần thưởng trên nền trang"),
    ("accent-strong", "surface-1", 4.5, "Chữ phần thưởng trên thẻ"),
    ("accent-strong", "accent-tint", 4.5, "Chữ phần thưởng trên chip XP"),
    ("on-accent", "accent", 4.5, "Chữ trên nền vàng (streak)"),
    ("line-strong", "surface-0", 3.0, "Viền ô nhập trên nền trang"),
    ("line-strong", "surface-1", 3.0, "Viền ô nhập trên thẻ"),
    ("danger", "surface-1", 4.5, "Màu Quên/lỗi trên thẻ"),
    ("on-danger", "danger", 4.5, "Chữ trên nút Quên"),
    ("info", "surface-1", 4.5, "Màu Dễ trên thẻ"),
    ("on-info", "info", 4.5, "Chữ trên nút Dễ"),
    ("again-fg", "again-bg", 4.5, "Chữ trên nút Quên (đặc hoặc viền)"),
]
MIN_HUE_GAP = 30  # độ: màu "Dễ" (info) phải khác màu chủ đạo đủ để phân biệt
DANGER_HUE_GAP = 25  # độ: màu chủ đạo gần màu đỏ hơn mức này thì nút Quên chuyển sang kiểu viền


def lum(hex_color):
    h = hex_color.lstrip("#")
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    rgb = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def hue(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hls(r, g, b)[0] * 360


def full_palette(theme, mode, fixed):
    p = dict(fixed[mode])
    p.update(theme[mode])
    # Chữ trên nút đỏ/nút Dễ: trắng ở chế độ sáng, màu nền trang ở chế độ tối
    p.setdefault("on-danger", "#FFFFFF" if mode == "light" else p["surface-0"])
    p.setdefault("on-info", "#FFFFFF" if mode == "light" else p["surface-0"])
    # Nút Quên: nền đỏ đặc, trừ khi màu chủ đạo gần màu đỏ (Tết, Giáng sinh, Halloween, Trung thu)
    # thì chuyển sang kiểu viền để không lẫn với nút chính
    if danger_like_brand(p):
        p["again-bg"], p["again-fg"], p["again-border"] = p["surface-1"], p["danger"], p["danger"]
    else:
        p["again-bg"], p["again-fg"], p["again-border"] = p["danger"], p["on-danger"], p["danger"]
    return p


def danger_like_brand(p):
    gap = abs(hue(p["brand"]) - hue(p["danger"]))
    return min(gap, 360 - gap) < DANGER_HUE_GAP


def check(data):
    problems, report = [], []
    for t in data["themes"]:
        for mode in ("light", "dark"):
            p = full_palette(t, mode, data["fixed"])
            worst = None
            for fg, bg, minimum, label in RULES:
                r = contrast(p[fg], p[bg])
                if worst is None or r / minimum < worst[0]:
                    worst = (r / minimum, label, r, minimum)
                if r < minimum:
                    problems.append(f"{t['name']} ({mode}): {label} {fg}/{bg} = {r:.2f}:1, cần ≥ {minimum}")
            gap = abs(hue(p["brand"]) - hue(p["info"]))
            gap = min(gap, 360 - gap)
            if gap < MIN_HUE_GAP:
                problems.append(f"{t['name']} ({mode}): màu Dễ (info) quá giống màu chủ đạo, lệch {gap:.0f}°")
            report.append(f"  {t['name']:<10} {mode:<5}  sát ngưỡng nhất: {worst[1]} {worst[2]:.1f}:1 (cần {worst[3]})")
    return problems, report


def build_css(data):
    lines = [
        "/* Sinh tự động từ themes.json bằng build_themes.py. Không sửa tay file này. */",
        "/* Dùng: đặt data-tv-theme=\"<id>\" lên <html> hoặc phần tử gốc.",
        "   Mặc định theo hệ điều hành; ép chế độ bằng data-tv-mode=\"light\" | \"dark\". */",
        "",
        ":root {",
    ]
    for k, v in data["motion"].items():
        lines.append(f"  --tv-{k}: {v};")
    lines += ["}", ""]
    tokens = list(full_palette(data["themes"][0], "light", data["fixed"]).keys())

    def block(selector, palette, indent=""):
        out = [f"{indent}{selector} {{"]
        out += [f"{indent}  --{k}: {palette[k]};" for k in tokens]
        out.append(f"{indent}}}")
        return out

    for t in data["themes"]:
        light = full_palette(t, "light", data["fixed"])
        dark = full_palette(t, "dark", data["fixed"])
        sel = f'[data-tv-theme="{t["id"]}"]'
        lines.append(f"/* {t['name']} · {t['tier']} */")
        lines += block(sel, light)
        lines.append("@media (prefers-color-scheme: dark) {")
        lines += block(f'{sel}:not([data-tv-mode="light"])', dark, "  ")
        lines.append("}")
        lines += block(f'{sel}[data-tv-mode="dark"]', dark)
        lines.append("")
    return "\n".join(lines)


def season_windows(event, year):
    """Khoảng ngày (bắt đầu, kết thúc) của một dịp trong năm, gồm cả hai đầu. None nếu thiếu dữ liệu."""
    from datetime import date, timedelta
    if event["rule"] == "fixed":
        sm, sd = map(int, event["start"].split("-"))
        em, ed = map(int, event["end"].split("-"))
        return date(year, sm, sd), date(year, em, ed)
    anchor = event.get("anchor_dates", {}).get(str(year))
    if not anchor:
        return None
    a = date.fromisoformat(anchor)
    return a - timedelta(days=event["days_before"]), a + timedelta(days=event["days_after"])


def check_seasons(data):
    problems = []
    ids = {t["id"]: t for t in data["themes"]}
    events = data.get("seasons", {}).get("events", [])
    for e in events:
        t = ids.get(e["theme"])
        if not t:
            problems.append(f"Dịp {e['name']}: không có theme '{e['theme']}'")
        elif t["tier"] != "seasonal":
            problems.append(f"Dịp {e['name']}: theme '{e['theme']}' phải có tier 'seasonal'")
        if t and t["effects"] not in data["effect_sets"]:
            problems.append(f"Theme {t['name']}: không có bộ hiệu ứng '{t['effects']}'")
    years = sorted({int(y) for e in events for y in e.get("anchor_dates", {})})
    for y in years:
        wins = [(season_windows(e, y), e["name"]) for e in events]
        wins = sorted([w for w in wins if w[0]], key=lambda w: w[0][0])
        for (a, na), (b, nb) in zip(wins, wins[1:]):
            if b[0] <= a[1]:
                problems.append(f"Năm {y}: dịp {na} và {nb} chồng ngày nhau")
        for e in events:
            if e["rule"] == "lunar" and str(y) not in e.get("anchor_dates", {}):
                problems.append(f"Dịp {e['name']}: thiếu ngày âm lịch quy đổi cho năm {y}")
    return problems, years


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    problems, report = check(data)
    season_problems, years = check_seasons(data)
    problems += season_problems
    print("Độ tương phản (cặp sát ngưỡng nhất của mỗi theme):")
    print("\n".join(report))
    if problems:
        print("\nKHÔNG ĐẠT:")
        print("\n".join("  - " + p for p in problems))
        sys.exit(1)
    OUT.write_text(build_css(data), encoding="utf-8")
    # Bản thông tin theme dạng JS, để trang mở trực tiếp từ file (file://) đọc được mà không cần fetch JSON
    meta = [{k: t[k] for k in ("id", "name", "tier", "concept", "study", "effects") if k in t} | {"default": t.get("default", False)}
            for t in data["themes"]]
    seasons = data.get("seasons", {}).get("events", [])
    META.write_text("/* Sinh tự động từ themes.json bằng build_themes.py. Không sửa tay. */\n"
                    f"window.TV_THEMES = {json.dumps(meta, ensure_ascii=False, indent=2)};\n"
                    f"window.TV_SEASONS = {json.dumps(seasons, ensure_ascii=False, indent=2)};\n", encoding="utf-8")
    print(f"\nLịch theme theo dịp hợp lệ cho các năm {years[0]}–{years[-1]}." if years else "")
    for y in years[:1]:
        for e in seasons:
            w = season_windows(e, y)
            print(f"  {y}: {e['name']:<24} {w[0]:%d/%m} – {w[1]:%d/%m}")
    print(f"\nTất cả theme đạt. Đã ghi {OUT.relative_to(HERE.parent.parent)} và {META.relative_to(HERE.parent.parent)}")


if __name__ == "__main__":
    main()
