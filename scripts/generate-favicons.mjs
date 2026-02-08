import sharp from "sharp";
import toIco from "to-ico";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "logo-icon.png");
const out = join(root, "public");

await mkdir(out, { recursive: true });

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(out, name));
  console.log(`  ✓ ${name}`);
}

// Generate favicon.ico from 16, 32, 48px PNGs
const icoBuffers = await Promise.all(
  [16, 32, 48].map((s) => sharp(src).resize(s, s).png().toBuffer())
);
const ico = await toIco(icoBuffers);
await writeFile(join(out, "favicon.ico"), ico);
console.log("  ✓ favicon.ico");

console.log("\nAll favicons generated in public/");
