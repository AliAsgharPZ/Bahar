// تبدیل GeoJSON استان‌های ایران (GADM) به مسیرهای SVG بهینه برای اپ
// اجرا: node scripts/geo/build-iran-map.ts
import fs from "fs";

const FA: Record<string, string> = {
  Alborz: "البرز", Ardebil: "اردبیل", Bushehr: "بوشهر",
  ChaharMahallandBakhtiari: "چهارمحال و بختیاری", EastAzarbaijan: "آذربایجان شرقی",
  Esfahan: "اصفهان", Fars: "فارس", Gilan: "گیلان", Golestan: "گلستان",
  Hamadan: "همدان", Hormozgan: "هرمزگان", Ilam: "ایلام", Kerman: "کرمان",
  Kermanshah: "کرمانشاه", Khuzestan: "خوزستان",
  KohgiluyehandBuyerAhmad: "کهگیلویه و بویراحمد", Kordestan: "کردستان",
  Lorestan: "لرستان", Markazi: "مرکزی", Mazandaran: "مازندران",
  NorthKhorasan: "خراسان شمالی", Qazvin: "قزوین", Qom: "قم",
  RazaviKhorasan: "خراسان رضوی", Semnan: "سمنان",
  SistanandBaluchestan: "سیستان و بلوچستان", SouthKhorasan: "خراسان جنوبی",
  Tehran: "تهران", WestAzarbaijan: "آذربایجان غربی", Yazd: "یزد", Zanjan: "زنجان",
};

type Pt = [number, number];

function area(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a / 2);
}

// ساده‌سازی Douglas-Peucker
function dp(points: Pt[], tol: number): Pt[] {
  if (points.length < 4) return points;
  const sqTol = tol * tol;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = 0, idx = -1;
    const [x1, y1] = points[first];
    const [x2, y2] = points[last];
    const dx = x2 - x1, dy = y2 - y1;
    const len = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [x, y] = points[i];
      let t = len ? ((x - x1) * dx + (y - y1) * dy) / len : 0;
      t = Math.max(0, Math.min(1, t));
      const px = x1 + t * dx, py = y1 + t * dy;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d > maxDist) { maxDist = d; idx = i; }
    }
    if (maxDist > sqTol && idx > 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const geo = JSON.parse(fs.readFileSync(new URL("gadm-irn1.json", import.meta.url), "utf8"));

/** استخراج حلقه‌های بیرونی و داخلی از Polygon/MultiPolygon (GADM چهار سطح دارد) */
function allRings(geometry: { type: string; coordinates: unknown }): Pt[][] {
  const rings: Pt[][] = [];
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates as Pt[][]) rings.push(ring);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates as Pt[][][]) {
      for (const ring of polygon) rings.push(ring);
    }
  }
  return rings;
}

// ۱) گرد آوری همه نقاط برای محدوده
let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
for (const f of geo.features) {
  const rings = allRings(f.geometry);
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
}

// ۲) تصویر استوانه‌ای با تصحیح عرض جغرافیایی
const W = 760;
const centerLat = (minLat + maxLat) / 2;
const kx = Math.cos((centerLat * Math.PI) / 180);
const aspect = ((maxLat - minLat) / ((maxLon - minLon) * kx));
const H = Math.round(W * aspect);
const sx = W / ((maxLon - minLon) * kx);
const sy = sx; // مقیاس یکسان — نسبت حفظ می‌شود

function project(lon: number, lat: number): Pt {
  return [ +( (lon - minLon) * kx * sx ).toFixed(1), +(( maxLat - lat) * sy).toFixed(1) ];
}

type Out = { fa: string; en: string; d: string; cx: number; cy: number; approxArea: number };
const out: Out[] = [];

for (const f of geo.features) {
  const rings = allRings(f.geometry);
  const parts: string[] = [];
  let sumX = 0, sumY = 0, sumW = 0;
  let totalArea = 0;
  for (const ring of rings) {
    if (ring.length < 8) continue; // جزیره‌های بسیار ریز حذف
    const a = area(ring);
    if (a < 0.005) continue; // ~ کمتر از ۵ کیلومترمربع
    totalArea += a;
    const simplified = dp(ring, 0.015);
    if (simplified.length < 4) continue;
    const proj = simplified.map(([lon, lat]) => project(lon, lat));
    // بستن حلقه
    if (proj[0][0] !== proj[proj.length - 1][0] || proj[0][1] !== proj[proj.length - 1][1]) proj.push(proj[0]);
    parts.push("M" + proj.map((p) => p.join(" ")).join("L") + "Z");
    // مرکز وزنی برای برچسب
    let cx = 0, cy = 0;
    for (const p of proj) { cx += p[0]; cy += p[1]; }
    cx /= proj.length; cy /= proj.length;
    sumX += cx * a; sumY += cy * a; sumW += a;
  }
  if (parts.length === 0) continue;
  out.push({
    fa: FA[f.properties.NAME_1] ?? f.properties.NAME_1,
    en: f.properties.NAME_1,
    d: parts.join(""),
    cx: +(sumX / sumW).toFixed(1),
    cy: +(sumY / sumW).toFixed(1),
    approxArea: +totalArea.toFixed(2),
  });
}

out.sort((a, b) => b.approxArea - a.approxArea);

const header = `// ============================================================
// بهار | نقشه ایران — ۳۱ استان (ساخته‌شده از GADM 4.1، ساده‌سازی DP)
// جهت استفاده در انتخابگر استان برای مدارس و هدف‌گیری اطلاعیه
// viewBox: 0 0 ${W} ${H}
// ============================================================
`;

const body = `export type IranProvincePath = { fa: string; en: string; d: string; cx: number; cy: number; approxArea: number };

export const IRAN_MAP_VIEWBOX = { w: ${W}, h: ${H} };

export const IRAN_PROVINCE_PATHS: IranProvincePath[] = ${JSON.stringify(out)};
`;

fs.writeFileSync(new URL("../../src/lib/iran-map.ts", import.meta.url), header + body);
console.log("provinces:", out.length, "| size:", (header + body).length, "bytes | viewBox:", W, "x", H);
