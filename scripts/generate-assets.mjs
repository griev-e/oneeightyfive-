import sharp from "sharp";
import { mkdirSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const BG = "#0A0A0B";
const MINT = "#34D399";

// The Surplus mark: a rounded plus — the daily surplus, the added set.
// scale = plus size relative to canvas; bar thickness = 26% of plus size.
function plusMarkSVG(size, { scale = 0.44, opaque = true } = {}) {
  const plus = size * scale;
  const bar = plus * 0.26;
  const r = bar / 2;
  const c = size / 2;
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  ${opaque ? `<rect width="${size}" height="${size}" fill="${BG}"/>` : ""}
  <rect x="${c - bar / 2}" y="${c - plus / 2}" width="${bar}" height="${plus}" rx="${r}" fill="${MINT}"/>
  <rect x="${c - plus / 2}" y="${c - bar / 2}" width="${plus}" height="${bar}" rx="${r}" fill="${MINT}"/>
</svg>`;
}

function splashSVG(w, h) {
  const plus = Math.round(Math.min(w, h) * 0.16);
  const bar = plus * 0.26;
  const r = bar / 2;
  const cx = w / 2;
  const cy = h / 2;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <rect x="${cx - bar / 2}" y="${cy - plus / 2}" width="${bar}" height="${plus}" rx="${r}" fill="${MINT}"/>
  <rect x="${cx - plus / 2}" y="${cy - bar / 2}" width="${plus}" height="${bar}" rx="${r}" fill="${MINT}"/>
</svg>`;
}

mkdirSync(`${ROOT}/public/icons`, { recursive: true });
mkdirSync(`${ROOT}/public/splash`, { recursive: true });

const icons = [
  ["public/icons/icon-192.png", 192, { scale: 0.44 }],
  ["public/icons/icon-512.png", 512, { scale: 0.44 }],
  // maskable: content must sit inside the central 80% safe zone
  ["public/icons/icon-512-maskable.png", 512, { scale: 0.36 }],
  ["public/icons/apple-touch-icon.png", 180, { scale: 0.44 }],
  ["src/app/icon.png", 512, { scale: 0.44 }],
];

for (const [path, size, opts] of icons) {
  await sharp(Buffer.from(plusMarkSVG(size, opts))).png().toFile(`${ROOT}/${path}`);
  console.log("icon", path);
}

const SPLASH = [
  [440, 956, 3],
  [420, 912, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [375, 667, 2],
  [744, 1133, 2],
  [820, 1180, 2],
  [834, 1194, 2],
  [1024, 1366, 2],
];

for (const [w, h, r] of SPLASH) {
  const pw = w * r;
  const ph = h * r;
  await sharp(Buffer.from(splashSVG(pw, ph)))
    .png()
    .toFile(`${ROOT}/public/splash/splash-${pw}x${ph}.png`);
  console.log("splash", `${pw}x${ph}`);
}
