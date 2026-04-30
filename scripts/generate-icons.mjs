import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'src', 'assets', 'icons');

const sizes = [16, 48, 128];
const icons = ['periscope', 'submarine-red', 'submarine-green'];

for (const icon of icons) {
  const svgPath = join(iconsDir, `${icon}.svg`);
  const svgBuffer = readFileSync(svgPath);
  for (const size of sizes) {
    const outPath = join(iconsDir, `${icon}-${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
}
console.log('Done.');

