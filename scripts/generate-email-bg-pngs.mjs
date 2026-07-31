import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buf) {
  let c = ~0;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c2 = n;
    for (let k = 0; k < 8; k++) c2 = c2 & 1 ? 0xedb88320 ^ (c2 >>> 1) : c2 >>> 1;
    table[n] = c2 >>> 0;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcB]);
}

function solidPng(r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.from([0, r, g, b]);
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.resolve("public/email");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "oe-bg-black.png"), solidPng(0x11, 0x11, 0x11));
fs.writeFileSync(path.join(dir, "oe-bg-card.png"), solidPng(0x21, 0x1f, 0x1b));
fs.writeFileSync(path.join(dir, "oe-bg-panel.png"), solidPng(0x1a, 0x18, 0x15));
console.log("Wrote email background PNGs to", dir);
