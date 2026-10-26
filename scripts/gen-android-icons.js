// دروازه شاد بهار — ساخت آیکون‌های mipmap اندروید از آیکون PWA
const sharp = require("sharp");
const fs = require("fs");

const SRC = require("path").join(__dirname, "..", "public", "icons", "icon-512.png");
const MASK = require("path").join(__dirname, "..", "public", "icons", "icon-maskable-512.png");
const OUT = "/tmp/bahar-android/app/src/main/res";

const sizes = { "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192 };
const fgSizes = { "mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432 };

(async () => {
  for (const [dpi, px] of Object.entries(sizes)) {
    const dir = `${OUT}/mipmap-${dpi}`;
    fs.mkdirSync(dir, { recursive: true });
    await sharp(SRC).resize(px, px).png().toFile(`${dir}/ic_launcher.png`);
    await sharp(SRC).resize(px, px).png().toFile(`${dir}/ic_launcher_round.png`);
    console.log("launcher", dpi, px);
  }
  for (const [dpi, px] of Object.entries(fgSizes)) {
    const dir = `${OUT}/mipmap-${dpi}`;
    await sharp(MASK).resize(px, px).png().toFile(`${dir}/ic_launcher_foreground.png`);
    console.log("foreground", dpi, px);
  }
  console.log("done");
})();
