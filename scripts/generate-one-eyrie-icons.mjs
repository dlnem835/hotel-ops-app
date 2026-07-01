import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const appDir = path.join(rootDir, "app");

/** Eagle artwork fills this share of the final square (80–85% target). */
const EAGLE_FILL = 0.825;
const ICON_BG = { r: 17, g: 17, b: 17, alpha: 1 };

const STACKED_LOGO = path.join(publicDir, "one-eyrie-logo-stacked.png");
const EAGLE_SOURCE = path.join(publicDir, "one-eyrie-icon-source.png");

const OUTPUTS = {
  public: {
    favicon: path.join(publicDir, "favicon.ico"),
    appleTouch: path.join(publicDir, "apple-touch-icon.png"),
    icon192: path.join(publicDir, "icon-192.png"),
    icon512: path.join(publicDir, "icon-512.png"),
  },
  app: {
    favicon: path.join(appDir, "favicon.ico"),
    icon: path.join(appDir, "icon.png"),
    appleIcon: path.join(appDir, "apple-icon.png"),
  },
};

async function extractEagleArtwork() {
  const meta = await sharp(STACKED_LOGO).metadata();
  const size = meta.width ?? 1024;

  const cropped = await sharp(STACKED_LOGO)
    .extract({
      left: Math.round(size * 0.255),
      top: Math.round(size * 0.07),
      width: Math.round(size * 0.49),
      height: Math.round(size * 0.49),
    })
    .png()
    .toBuffer();

  const trimmed = await sharp(cropped).trim({ threshold: 8 }).png().toBuffer();
  await fs.writeFile(EAGLE_SOURCE, trimmed);
  return trimmed;
}

async function renderSquareIcon(size, eagleArtwork) {
  const eagleSize = Math.round(size * EAGLE_FILL);
  const offset = Math.round((size - eagleSize) / 2);

  const eagle = await sharp(eagleArtwork)
    .resize(eagleSize, eagleSize, {
      fit: "contain",
      background: ICON_BG,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: ICON_BG,
    },
  })
    .composite([{ input: eagle, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function writePng(filePath, buffer) {
  await fs.writeFile(filePath, buffer);
}

async function generate() {
  const eagleArtwork = await extractEagleArtwork();

  const icon16 = await renderSquareIcon(16, eagleArtwork);
  const icon32 = await renderSquareIcon(32, eagleArtwork);
  const icon48 = await renderSquareIcon(48, eagleArtwork);
  const icon180 = await renderSquareIcon(180, eagleArtwork);
  const icon192 = await renderSquareIcon(192, eagleArtwork);
  const icon512 = await renderSquareIcon(512, eagleArtwork);

  const faviconBuffer = await toIco([icon16, icon32, icon48]);

  await writePng(OUTPUTS.public.icon192, icon192);
  await writePng(OUTPUTS.public.icon512, icon512);
  await writePng(OUTPUTS.public.appleTouch, icon180);
  await fs.writeFile(OUTPUTS.public.favicon, faviconBuffer);

  await writePng(OUTPUTS.app.icon, icon512);
  await writePng(OUTPUTS.app.appleIcon, icon180);
  await fs.writeFile(OUTPUTS.app.favicon, faviconBuffer);

  console.log("Generated One Eyrie app icons:");
  console.log("  public/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png");
  console.log("  app/favicon.ico, icon.png, apple-icon.png");
  console.log(`  Eagle fill: ${Math.round(EAGLE_FILL * 100)}% of square`);
}

await generate();
