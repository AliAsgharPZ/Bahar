/* Generate PWA PNG icons from the Bahar logo SVG using sharp */
const fs = require("fs");
const sharp = require("sharp");

const svg = fs.readFileSync(require("path").join(__dirname, "..", "public", "logo.svg"));

async function main() {
  const sizes = [192, 512, 180, 96, 32];
  for (const size of sizes) {
    await sharp(svg, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(require("path").join(__dirname, "..", "public", "icons", `icon-${size}.png`));
    console.log(`icon-${size}.png generated`);
  }
  // maskable icon (safe zone: 80% content)
  const inner = svg.toString().replace(/<\/?svg[^>]*>/g, "");
  const maskable = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="#00825E"/>
    <g transform="translate(51.2,51.2) scale(0.8)">
      ${inner}
    </g>
  </svg>`;
  await sharp(Buffer.from(maskable), { density: 300 })
    .resize(512, 512)
    .png()
    .toFile(require("path").join(__dirname, "..", "public", "icons", "icon-maskable-512.png"));
  console.log("icon-maskable-512.png generated");

  // favicon
  await sharp(svg, { density: 300 }).resize(48, 48).png().toFile(require("path").join(__dirname, "..", "public", "favicon.png"));
  console.log("favicon.png generated");
}
main().catch(console.error);
