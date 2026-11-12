import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

// Official Aariz release on Figshare (CC BY 4.0): https://doi.org/10.6084/m9.figshare.27986417.v1
// The archive is a single zip, so images are read straight out of it with HTTP range requests.
const ARCHIVE_URL = process.env.AARIZ_ARCHIVE_URL || 'https://ndownloader.figshare.com/files/51041642';
// Serverless hosts (Vercel) only allow writes under the temp directory, and it is per instance.
const CACHE_DIR = path.resolve(process.env.AARIZ_CACHE_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'aariz-cache') : path.join('data', 'aariz-cache')));
// Vercel rejects function responses over 4.5 MB, so larger images are re-encoded below this size.
const MAX_RESPONSE_BYTES = process.env.VERCEL ? 4_000_000 : Infinity;
const INDEX_FILE = path.join(CACHE_DIR, 'index.json');
const SPLIT_ORDER: Record<string, number> = { train: 0, valid: 1, test: 2 };

export type AarizImage = { id: number; title: string; file: string; split: string; entry: string; method: number; compressedSize: number; offset: number };

const CONTENT_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', bmp: 'image/bmp' };

async function fetchRange(start: number, end?: number) {
  const response = await fetch(ARCHIVE_URL, { headers: { Range: end === undefined ? `bytes=${start}` : `bytes=${start}-${end}` }, cache: 'no-store' });
  if (response.status !== 206) throw new Error(`Aariz archive range request failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

function readZip64(extra: Buffer, fields: { uncompressed: boolean; compressed: boolean; offset: boolean }) {
  for (let pos = 0; pos + 4 <= extra.length;) {
    const id = extra.readUInt16LE(pos);
    const size = extra.readUInt16LE(pos + 2);
    if (id === 0x0001) {
      let cursor = pos + 4;
      const next = () => { const value = Number(extra.readBigUInt64LE(cursor)); cursor += 8; return value; };
      return { uncompressed: fields.uncompressed ? next() : undefined, compressed: fields.compressed ? next() : undefined, offset: fields.offset ? next() : undefined };
    }
    pos += 4 + size;
  }
  return {};
}

async function buildIndex(): Promise<AarizImage[]> {
  const tail = await fetchRange(-65557);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Could not locate the Aariz archive directory.');
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOffset = tail.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    const locator = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]), eocd);
    const zip64Eocd = await fetchRange(Number(tail.readBigUInt64LE(locator + 8)), Number(tail.readBigUInt64LE(locator + 8)) + 55);
    cdSize = Number(zip64Eocd.readBigUInt64LE(40));
    cdOffset = Number(zip64Eocd.readBigUInt64LE(48));
  }
  const directory = await fetchRange(cdOffset, cdOffset + cdSize - 1);

  const entries: Omit<AarizImage, 'id' | 'title'>[] = [];
  for (let pos = 0; pos + 46 <= directory.length && directory.readUInt32LE(pos) === 0x02014b50;) {
    const method = directory.readUInt16LE(pos + 10);
    let compressedSize = directory.readUInt32LE(pos + 20);
    const uncompressedSize = directory.readUInt32LE(pos + 24);
    const nameLength = directory.readUInt16LE(pos + 28);
    const extraLength = directory.readUInt16LE(pos + 30);
    const commentLength = directory.readUInt16LE(pos + 32);
    let offset = directory.readUInt32LE(pos + 42);
    const entry = directory.toString('utf8', pos + 46, pos + 46 + nameLength);
    const zip64 = readZip64(directory.subarray(pos + 46 + nameLength, pos + 46 + nameLength + extraLength), { uncompressed: uncompressedSize === 0xffffffff, compressed: compressedSize === 0xffffffff, offset: offset === 0xffffffff });
    compressedSize = zip64.compressed ?? compressedSize;
    offset = zip64.offset ?? offset;
    const match = entry.match(/(?:^|\/)(train|valid|test)\/Cephalograms\/([^/]+\.(png|jpe?g|bmp))$/i);
    if (match) entries.push({ entry, split: match[1].toLowerCase(), file: match[2], method, compressedSize, offset });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  if (!entries.length) throw new Error('No cephalograms were found in the Aariz archive.');

  entries.sort((a, b) => SPLIT_ORDER[a.split] - SPLIT_ORDER[b.split] || a.file.localeCompare(b.file));
  return entries.map((item, index) => ({ ...item, id: index + 1, title: `Aariz cephalogram ${String(index + 1).padStart(4, '0')}` }));
}

let indexPromise: Promise<AarizImage[]> | undefined;

export function getAarizIndex() {
  indexPromise ??= (async () => {
    try {
      return JSON.parse(await fs.readFile(INDEX_FILE, 'utf8')) as AarizImage[];
    } catch {
      const index = await buildIndex();
      await writeCache(INDEX_FILE, JSON.stringify(index));
      return index;
    }
  })().catch((error) => { indexPromise = undefined; throw error; });
  return indexPromise;
}

async function writeCache(file: string, data: string | Buffer) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(file, data);
  } catch (error) {
    console.warn('Could not write Aariz cache:', error);
  }
}

async function fitResponseLimit(body: Buffer, contentType: string) {
  if (body.length <= MAX_RESPONSE_BYTES) return { body, contentType };
  const sharp = (await import('sharp')).default;
  // Lossless greyscale PNG first (cephalograms are greyscale stored as RGB), JPEG q95 as a last resort.
  const png = await sharp(body).greyscale().png({ compressionLevel: 9 }).toBuffer();
  if (png.length <= MAX_RESPONSE_BYTES) return { body: png, contentType: 'image/png' };
  return { body: await sharp(body).greyscale().jpeg({ quality: 95 }).toBuffer(), contentType: 'image/jpeg' };
}

const inflight = new Map<number, Promise<{ body: Buffer; contentType: string }>>();

export async function getAarizImage(id: number) {
  const image = (await getAarizIndex()).find((item) => item.id === id);
  if (!image) return null;
  const contentType = CONTENT_TYPES[image.file.split('.').pop()!.toLowerCase()] || 'application/octet-stream';
  const cachePath = path.join(CACHE_DIR, image.file);
  try {
    return await fitResponseLimit(await fs.readFile(cachePath), contentType);
  } catch {
    // Not cached yet; download from the archive below.
  }
  if (!inflight.has(id)) {
    inflight.set(id, (async () => {
      // Local header name/extra lengths can differ from the central directory, so over-fetch a little.
      const chunk = await fetchRange(image.offset, image.offset + 30 + 1024 + image.compressedSize);
      if (chunk.readUInt32LE(0) !== 0x04034b50) throw new Error('Unexpected Aariz archive entry header.');
      const start = 30 + chunk.readUInt16LE(26) + chunk.readUInt16LE(28);
      const data = chunk.subarray(start, start + image.compressedSize);
      const body = image.method === 0 ? Buffer.from(data) : image.method === 8 ? inflateRawSync(data) : null;
      if (!body) throw new Error(`Unsupported compression method ${image.method}.`);
      await writeCache(cachePath, body);
      return fitResponseLimit(body, contentType);
    })().finally(() => inflight.delete(id)));
  }
  return inflight.get(id)!;
}
