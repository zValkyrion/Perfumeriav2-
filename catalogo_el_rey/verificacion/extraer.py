import sys, os, re, json, csv
from collections import defaultdict
import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
PDF = r"C:\Users\eurec\Downloads\Catalogo_ElReyDeLosPerfumes.pdf"
BASE = os.path.join(os.environ["TEMP"], "elrey")
OUT = os.path.join(BASE, "salida")
IMG = os.path.join(OUT, "imagenes")
CHK = os.path.join(BASE, "verificacion")
for d in (IMG, CHK):
    os.makedirs(d, exist_ok=True)
Z = 2.0  # ~144 dpi, la resolución nativa de las imágenes del PDF

GEN = {"M": "Mujer", "H": "Hombre", "U": "Unisex", "": ""}
FIELDS = ["pagina", "codigo", "alternos", "nombre_catalogo", "nombre", "marca", "ml",
          "concentracion", "genero", "categoria", "agotado", "precio", "nota"]

rows_by_page = defaultdict(list)
with open(os.path.join(BASE, "datos.txt"), encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        assert len(parts) == 13, (len(parts), line)
        e = dict(zip(FIELDS, parts))
        rows_by_page[int(e["pagina"])].append(e)


def clusters(idx, gap=3):
    out = []
    for i in idx:
        if out and i - out[-1][1] <= gap:
            out[-1][1] = i
        else:
            out.append([i, i])
    return out


def gender_in_text(t):
    t = t.lower()
    if re.search(r"\bunisex\b", t):
        return "U"
    if re.search(r"\b(mujer|dama|women|woman|her|ella|femme|lady|donna)\b", t):
        return "M"
    if re.search(r"\b(hombre|hombres|men|man|him|homme|caballero|uomo)\b|men's", t):
        return "H"
    return ""


doc = pymupdf.open(PDF)
productos, problemas, crops_for_sheet = [], [], []

for pno in sorted(rows_by_page):
    entries = rows_by_page[pno]
    page = doc[pno - 1]
    pix = page.get_pixmap(matrix=pymupdf.Matrix(Z, Z))
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    g = np.asarray(img.convert("L"))
    H, W = g.shape
    ink = g < 235  # las líneas de la tabla son de 1 px y gris claro

    hl = clusters(np.where(ink.sum(axis=1) / W > 0.55)[0])
    hy = [(a + b) / 2 for a, b in hl]
    y0, y1 = int(hy[0]), int(hy[-1])
    vl = clusters(np.where(ink[y0:y1].sum(axis=0) / (y1 - y0) > 0.8)[0])
    vx = [(a + b) / 2 for a, b in vl]
    rows = [(hy[i], hy[i + 1]) for i in range(len(hy) - 1) if hy[i + 1] - hy[i] > 40]

    # Las fotos oscuras generan "líneas" falsas dentro de la columna 1, así que el
    # divisor col1|col2 se ubica a ~222 px a la izquierda del divisor col2|col3.
    right = [x for x in vx if x >= 500]
    c23 = right[0] if right else 543
    near = [x for x in vx if 290 <= x <= 345]
    c12 = min(near, key=lambda x: abs(x - (c23 - 222))) if near else c23 - 222
    left = [x for x in vx if x < 120]
    c01 = left[0] if left else c12 - 235
    if not near or not left:
        problemas.append(f"p{pno}: bordes de columna 1 estimados ({c01:.0f}, {c12:.0f})")
    if len(rows) < len(entries):
        problemas.append(f"p{pno}: {len(rows)} filas detectadas, se esperaban {len(entries)}")
        continue
    rows = rows[len(rows) - len(entries):]  # p2 trae 2 filas de encabezado

    words = [w for w in page.get_text("words") if re.fullmatch(r"\d{3}", w[4])]
    for e, (ra, rb) in zip(entries, rows):
        # el único texto numérico real del PDF son los precios; nombres y códigos son imagen
        prices = {int(w[4]) for w in words if ra <= (w[1] + w[3]) / 2 * Z <= rb}
        if e["codigo"] == "-":
            if prices:
                problemas.append(f"p{pno}: fila vacía con precio {prices}")
            continue
        if len(prices) != 1:
            problemas.append(f"p{pno} {e['codigo']}: precios en texto {prices}")
        precio_txt = prices.pop() if len(prices) == 1 else None
        if precio_txt is not None and precio_txt != int(e["precio"]):
            problemas.append(f"p{pno} {e['codigo']}: leí {e['precio']} pero el texto dice {precio_txt}")

        def crop_cell(xa, xb, name):
            box = (int(xa) + 4, int(ra) + 4, int(xb) - 4, int(rb) - 4)
            c = img.crop(box)
            a = np.asarray(c).min(axis=2) < 235
            ys, xs = np.where(a)
            if len(xs):
                pad = 6
                c = c.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0),
                            min(xs.max() + pad + 1, c.width), min(ys.max() + pad + 1, c.height)))
            path = os.path.join(IMG, name)
            c.save(path, quality=92)
            return c

        c = crop_cell(c01, c12, f"{e['codigo']}.jpg")
        if e["codigo"] == "0192":  # la celda del nombre también trae una foto
            crop_cell(c12, c23, "0192_b.jpg")
        crops_for_sheet.append((e["codigo"], e["nombre"], c))

        g_txt = gender_in_text(e["nombre_catalogo"])
        g = e["genero"]
        if g_txt and g and g_txt != g:
            problemas.append(f"{e['codigo']}: género manual {g} vs texto {g_txt}")
        productos.append({
            "codigo": e["codigo"],
            "codigos_alternos": [c_ for c_ in e["alternos"].split(",") if c_],
            "nombre": e["nombre"],
            "nombre_catalogo": e["nombre_catalogo"],
            "marca": e["marca"],
            "ml": int(e["ml"]) if e["ml"] else None,
            "concentracion": e["concentracion"] or None,
            "genero": GEN[g] or None,
            "genero_fuente": ("catálogo" if g_txt else "inferido") if g else None,
            "categoria": e["categoria"],
            "precio_mxn": precio_txt if precio_txt is not None else int(e["precio"]),
            "agotado": e["agotado"] == "1",
            "imagen": f"imagenes/{e['codigo']}.jpg",
            "pagina_pdf": pno,
            "nota": e["nota"] or None,
        })

# códigos repetidos
seen = defaultdict(list)
for p in productos:
    for c_ in [p["codigo"], *p["codigos_alternos"]]:
        seen[c_].append(p["nombre"])
for c_, names in seen.items():
    if len(names) > 1:
        problemas.append(f"código repetido {c_}: {names}")

with open(os.path.join(OUT, "productos.json"), "w", encoding="utf-8") as f:
    json.dump(productos, f, ensure_ascii=False, indent=2)

cols = ["codigo", "codigos_alternos", "nombre", "marca", "ml", "concentracion", "genero",
        "genero_fuente", "categoria", "precio_mxn", "agotado", "imagen", "pagina_pdf",
        "nombre_catalogo", "nota"]
with open(os.path.join(OUT, "productos.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(cols)
    for p in productos:
        row = dict(p)
        row["codigos_alternos"] = ", ".join(p["codigos_alternos"])
        row["agotado"] = "sí" if p["agotado"] else "no"
        w.writerow(["" if row[k] is None else row[k] for k in cols])

# hojas de contacto para revisar que foto y código coinciden
try:
    font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 13)
except OSError:
    font = ImageFont.load_default()
TW, TH, N = 220, 250, 42
for s in range(0, len(crops_for_sheet), N):
    chunk = crops_for_sheet[s:s + N]
    sheet = Image.new("RGB", (TW * 7, TH * ((len(chunk) + 6) // 7)), "white")
    d = ImageDraw.Draw(sheet)
    for i, (code, name, c) in enumerate(chunk):
        t = c.copy()
        t.thumbnail((TW - 10, TH - 50))
        x, y = (i % 7) * TW, (i // 7) * TH
        sheet.paste(t, (x + 5, y + 5))
        d.text((x + 5, y + TH - 42), code, fill="red", font=font)
        d.text((x + 5, y + TH - 25), name[:30], fill="black", font=font)
    sheet.save(os.path.join(CHK, f"hoja_{s // N + 1}.jpg"), quality=85)

print(f"productos: {len(productos)}")
print("problemas:" if problemas else "sin problemas")
for p in problemas:
    print("  -", p)
