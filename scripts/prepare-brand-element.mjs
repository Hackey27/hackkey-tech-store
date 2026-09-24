// Preserve the supplied glyph's pixels while removing its large white canvas.
// Usage: node scripts/prepare-brand-element.mjs input.png public/brand-element.png
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const [, , input, output] = process.argv;
if (!input || !output) throw new Error('Provide input and output PNG paths.');
const source = readFileSync(input);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (!source.subarray(0, 8).equals(signature)) throw new Error('Input is not a PNG.');

let width = 0;
let height = 0;
const imageData = [];
for (let offset = 8; offset < source.length;) {
  const length = source.readUInt32BE(offset);
  const type = source.toString('ascii', offset + 4, offset + 8);
  const data = source.subarray(offset + 8, offset + 8 + length);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
      throw new Error('Expected an 8-bit, non-interlaced RGBA PNG.');
    }
  }
  if (type === 'IDAT') imageData.push(data);
  offset += length + 12;
  if (type === 'IEND') break;
}
if (!width || !height) throw new Error('PNG dimensions are missing.');

const inflated = inflateSync(Buffer.concat(imageData));
const stride = width * 4;
const pixels = Buffer.alloc(height * stride);
let sourceOffset = 0;
for (let y = 0; y < height; y += 1) {
  const filter = inflated[sourceOffset++];
  for (let x = 0; x < stride; x += 1) {
    const value = inflated[sourceOffset++];
    const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
    const up = y ? pixels[(y - 1) * stride + x] : 0;
    const upperLeft = y && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
    let predictor = 0;
    if (filter === 1) predictor = left;
    else if (filter === 2) predictor = up;
    else if (filter === 3) predictor = Math.floor((left + up) / 2);
    else if (filter === 4) {
      const p = left + up - upperLeft;
      const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft);
      predictor = a <= b && a <= c ? left : b <= c ? up : upperLeft;
    } else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}.`);
    pixels[y * stride + x] = (value + predictor) & 255;
  }
}

let left = width, top = height, right = -1, bottom = -1;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const offset = y * stride + x * 4;
    // The supplied glyph is black over white, with black pixels carrying zero
    // source alpha. Use darkness as coverage and retain edge antialiasing.
    const darkness = 255 - Math.round((pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3);
    const alpha = darkness;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    pixels[offset + 3] = alpha;
    if (alpha > 4) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
}
if (right < left) throw new Error('No dark glyph was found.');
const margin = 12;
left = Math.max(0, left - margin); top = Math.max(0, top - margin);
right = Math.min(width - 1, right + margin); bottom = Math.min(height - 1, bottom + margin);
const outWidth = right - left + 1, outHeight = bottom - top + 1;
const rows = Buffer.alloc(outHeight * (outWidth * 4 + 1));
for (let y = 0; y < outHeight; y += 1) {
  pixels.copy(rows, y * (outWidth * 4 + 1) + 1, (top + y) * stride + left * 4, (top + y) * stride + (right + 1) * 4);
}

const crcTable = Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let j = 0; j < 8; j += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, checksum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(outWidth, 0); header.writeUInt32BE(outHeight, 4);
header[8] = 8; header[9] = 6;
writeFileSync(output, Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log(`Prepared ${outWidth} × ${outHeight} brand element: ${output}`);
