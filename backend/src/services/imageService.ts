import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

/** multer u memoriju — sharp decode služi kao prava validacija sadržaja */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

export interface ProcessedImage {
  filePath: string; // relativna putanja unutar /uploads (URL: /uploads/<filePath>)
  thumbPath: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Dekodira sliku (odbija lažne fajlove), skida EXIF, generiše WebP full + thumb.
 * `subdir` npr. "venues/3/items" ili "events/5/gallery".
 */
export async function processImage(
  buffer: Buffer,
  subdir: string,
  opts: { maxDim?: number; thumbDim?: number; quality?: number } = {}
): Promise<ProcessedImage> {
  const { maxDim = 2000, thumbDim = 400, quality = 80 } = opts;

  let pipeline: sharp.Sharp;
  let meta: sharp.Metadata;
  try {
    // .rotate() primjenjuje EXIF orijentaciju; izlazni WebP nema EXIF (strip)
    pipeline = sharp(buffer).rotate();
    meta = await pipeline.metadata();
    if (!meta.width || !meta.height) throw new Error('no dimensions');
  } catch {
    throw new HttpError(400, 'Fajl nije validna slika');
  }

  const id = nanoid(16);
  const dir = path.join(env.uploadsDir, subdir);
  await fs.mkdir(dir, { recursive: true });

  const fileRel = path.posix.join(subdir.replaceAll('\\', '/'), `${id}.webp`);
  const thumbRel = path.posix.join(subdir.replaceAll('\\', '/'), `${id}_thumb.webp`);

  const full = await pipeline
    .clone()
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toFile(path.join(env.uploadsDir, fileRel));

  await pipeline
    .clone()
    .resize(thumbDim, thumbDim, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(path.join(env.uploadsDir, thumbRel));

  return {
    filePath: fileRel,
    thumbPath: thumbRel,
    width: full.width,
    height: full.height,
    bytes: full.size,
  };
}

/** Briše sliku s diska; greške ignoriše (fajl možda već ne postoji). */
export async function deleteImageFiles(...relPaths: (string | null | undefined)[]) {
  for (const rel of relPaths) {
    if (!rel) continue;
    // zaštita od path traversal — rel putanje su uvijek naše (nanoid), ali defensivno:
    const abs = path.resolve(env.uploadsDir, rel);
    if (!abs.startsWith(path.resolve(env.uploadsDir))) continue;
    await fs.unlink(abs).catch(() => {});
  }
}
