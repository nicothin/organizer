const fs = require('fs-extra');
const path = require('path');
const { exiftool } = require('exiftool-vendored');
const pLimit = require('p-limit');

const SOURCE_DIR = '/media/nicothin/largeBackup/vera/';
const TARGET_BASE = '/media/nicothin/largeBackup/vera/photoarchive';

// Ограничение параллелизма (подбирается)
const limit = pLimit(5);

// Разрешённые расширения (фото + видео)
const ALLOWED_EXT = [
  // images
  '.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tiff', '.tif',
  // RAW formats
  '.cr2', '.cr3', '.nef', '.arw', '.dng', '.rw2', '.orf',
  // video
  '.mp4', '.mov', '.avi', '.mkv', '.3gp', '.mts', '.m2ts', '.wmv'
];

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

async function getDate(filePath) {
  try {
    const tags = await exiftool.read(filePath);

    const dateSource =
      tags.DateTimeOriginal ||
      tags.CreateDate ||
      tags.CreationDate;

    if (dateSource && dateSource.year) {
      return new Date(
        dateSource.year,
        dateSource.month - 1,
        dateSource.day || 1,
        dateSource.hour || 0,
        dateSource.minute || 0
      );
    }
  } catch (e) {
    console.warn(`EXIF ошибка: ${filePath} → fallback на mtime`);
  }

  // fallback всегда
  const stats = await fs.stat(filePath);
  return stats.mtime;
}

async function processFile(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return;

  const date = await getDate(fullPath);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const targetDir = path.join(TARGET_BASE, `${year}-${month}`);
  await fs.ensureDir(targetDir);

  const parsed = path.parse(fullPath);
  const dateSuffix = formatDate(date);

  const newName = `${parsed.name}-${dateSuffix}${parsed.ext}`;
  let finalPath = path.join(targetDir, newName);

  // защита от коллизий
  let counter = 1;
  while (await fs.pathExists(finalPath)) {
    finalPath = path.join(
      targetDir,
      `${parsed.name}-${dateSuffix}-${counter}${parsed.ext}`
    );
    counter++;
  }

  await fs.move(fullPath, finalPath);
  console.log(`Moved: ${parsed.base} -> ${path.basename(targetDir)}`);
}

async function processDir(dir) {
  const items = await fs.readdir(dir);

  const tasks = items.map(item => limit(async () => {
    const fullPath = path.join(dir, item);

    // безопасная проверка, что мы НЕ внутри TARGET_BASE
    const relative = path.relative(TARGET_BASE, fullPath);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      return;
    }

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      return processDir(fullPath);
    } else {
      return processFile(fullPath);
    }
  }));

  await Promise.all(tasks);
}

processDir(SOURCE_DIR)
  .then(() => {
    console.log('Готово!');
    exiftool.end();
  })
  .catch(err => {
    console.error('Критическая ошибка:', err);
    exiftool.end();
  });
