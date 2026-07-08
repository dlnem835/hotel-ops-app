import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const appDir = path.join(rootDir, "app");

const PLACEHOLDER_SOURCE = path.join(publicDir, "one-eyrie-placeholder-icon.png");

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

async function resizeIcon(size, source) {
  return sharp(source).resize(size, size, { fit: "cover" }).png().toBuffer();
}

async function writePng(filePath, buffer) {
  await fs.writeFile(filePath, buffer);
}

async function generate() {
  const source = await fs.readFile(PLACEHOLDER_SOURCE);

  const icon16 = await resizeIcon(16, source);
  const icon32 = await resizeIcon(32, source);
  const icon48 = await resizeIcon(48, source);
  const icon180 = await resizeIcon(180, source);
  const icon192 = await resizeIcon(192, source);
  const icon512 = await resizeIcon(512, source);

  const faviconBuffer = await toIco([icon16, icon32, icon48]);

  await writePng(OUTPUTS.public.icon192, icon192);
  await writePng(OUTPUTS.public.icon512, icon512);
  await writePng(OUTPUTS.public.appleTouch, icon180);
  await fs.writeFile(OUTPUTS.public.favicon, faviconBuffer);

  await writePng(OUTPUTS.app.icon, icon512);
  await writePng(OUTPUTS.app.appleIcon, icon180);
  await fs.writeFile(OUTPUTS.app.favicon, faviconBuffer);

  console.log("Generated One Eyrie app icons from public/one-eyrie-placeholder-icon.png");
  console.log("  public/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png");
  console.log("  app/favicon.ico, icon.png, apple-icon.png");
}

await generate();
