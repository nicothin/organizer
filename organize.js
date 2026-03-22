const fs = require('fs-extra');
const path = require('path');
const { exiftool } = require('exiftool-vendored');

const SOURCE_DIR = '/media/nicothin/largeBackup/vera/';
const TARGET_BASE = '/media/nicothin/largeBackup/vera/photoarchive';

// Расширения, которые игнорируем (сам скрипт, конфиги и т.д.)
const IGNORE_EXT = ['.js', '.json', '.txt', '.md'];

async function getTargetFolder(filePath) {
  try {
    const tags = await exiftool.read(filePath);

    // Ищем дату в метаданных (сначала фото, потом видео специфичные теги)
    const dateSource = tags.DateTimeOriginal || tags.CreateDate || tags.CreationDate;

    let date;
    if (dateSource && dateSource.year) {
      // Если нашли в EXIF
      date = new Date(dateSource.year, dateSource.month - 1);
    } else {
      // Если EXIF нет, берем дату модификации файла
      const stats = await fs.stat(filePath);
      date = stats.mtime;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return path.join(TARGET_BASE, `${year}-${month}`);
  } catch (e) {
    console.error(`Ошибка чтения метаданных для ${filePath}:`, e.message);
    return null;
  }
}

async function processDir(dir) {
  const items = await fs.readdir(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);

    // Пропускаем целевую папку, чтобы не уйти в бесконечный цикл
    if (fullPath.startsWith(TARGET_BASE)) continue;

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      await processDir(fullPath);
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      if (IGNORE_EXT.includes(ext)) continue;

      const targetDir = await getTargetFolder(fullPath);
      if (!targetDir) continue;

      await fs.ensureDir(targetDir);

      const targetPath = path.join(targetDir, item);

      // Чтобы не перезаписать файлы с одинаковыми именами из разных папок
      let finalPath = targetPath;
      if (await fs.pathExists(targetPath)) {
        finalPath = path.join(targetDir, `${Date.now()}-${item}`);
      }

      await fs.move(fullPath, finalPath);
      console.log(`Moved: ${item} -> ${path.basename(targetDir)}`);
    }
  }
}

processDir(SOURCE_DIR)
  .then(() => {
    console.log('Готово!');
    exiftool.end(); // Важно закрыть процесс exiftool
  })
  .catch(err => {
    console.error('Критическая ошибка:', err);
    exiftool.end();
  });
