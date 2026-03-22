const fs = require('fs-extra');
const path = require('path');
const { exiftool } = require('exiftool-vendored');
const pLimit = require('p-limit').default;
const readline = require('readline');
const cliProgress = require('cli-progress');

const limit = pLimit(5);

const DEFAULT_SOURCE = '/media/nicothin/BackUps/TEMP/';
const DEFAULT_TARGET = '/media/nicothin/BackUps/TEMP/photoarchive';

const ALLOWED_EXT = [
  '.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tiff', '.tif',
  '.cr2', '.cr3', '.nef', '.arw', '.dng', '.rw2', '.orf',
  '.mp4', '.mov', '.avi', '.mkv', '.3gp', '.mts', '.m2ts', '.wmv'
];

// ---------- STATS ----------

const stats = {
  total: 0,
  processed: 0,
  moved: 0,
  copied: 0,
  skipped: 0,
  errors: 0,
  exifFallback: 0
};

// ---------- UTILS ----------

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (q) => new Promise(res => rl.question(q, res));

const pad = (n) => String(n).padStart(2, '0');

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function getYearMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function withRetry(fn, retries = 3, delay = 300) {
  let lastErr;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await sleep(delay * Math.pow(2, i)); // exponential backoff
    }
  }

  throw lastErr;
}

// ---------- INPUT ----------

async function getUserInput() {
  console.log('=== File Organization Tool ===\n');

  const sourceDir = await ask(`Source (default: ${DEFAULT_SOURCE}): `);
  const targetBase = await ask(`Target (default: ${DEFAULT_TARGET}): `);
  const moveChoice = await ask('Move or copy? (m/c, default m): ');

  const config = {
    sourceDir: sourceDir || DEFAULT_SOURCE,
    targetBase: targetBase || DEFAULT_TARGET,
    move: moveChoice.toLowerCase() !== 'c'
  };

  console.log('\n--- Summary ---');
  console.log(config);

  const confirm = await ask('\nContinue? (y/n): ');
  if (confirm.toLowerCase() === 'n') {
    rl.close();
    process.exit(0);
  }

  return config;
}

// ---------- CORE ----------

async function getDate(filePath) {
  try {
    const tags = await exiftool.read(filePath);
    const d = tags.DateTimeOriginal || tags.CreateDate || tags.CreationDate;

    if (d?.year) {
      return new Date(
        d.year,
        d.month - 1,
        d.day || 1,
        d.hour || 0,
        d.minute || 0
      );
    }
  } catch {
    stats.exifFallback++;
  }

  const { mtime } = await withRetry(() => fs.stat(filePath));
  return mtime;
}

async function resolveTargetPath(filePath, targetDir, date) {
  const parsed = path.parse(filePath);
  let finalPath = path.join(targetDir, parsed.base);

  if (await fs.pathExists(finalPath)) {
    const suffix = formatDate(date);
    let counter = 0;

    do {
      const extra = counter ? `-${counter}` : '';
      finalPath = path.join(
        targetDir,
        `${parsed.name}-${suffix}${extra}${parsed.ext}`
      );
      counter++;
    } while (await fs.pathExists(finalPath));
  }

  return finalPath;
}

async function handleFile(filePath, config, progressBar) {
  const ext = path.extname(filePath).toLowerCase();

  if (!ALLOWED_EXT.includes(ext)) {
    stats.skipped++;
    progressBar.increment();
    return;
  }

  try {
    const date = await getDate(filePath);
    const targetDir = path.join(config.targetBase, getYearMonth(date));

    await withRetry(() => fs.ensureDir(targetDir));

    const finalPath = await resolveTargetPath(filePath, targetDir, date);

    const op = config.move ? fs.move : fs.copy;

    await withRetry(() => op(filePath, finalPath));

    if (config.move) stats.moved++;
    else stats.copied++;

  } catch (err) {
    stats.errors++;
    console.error(`Error processing: ${filePath}`, err.message);
  }

  stats.processed++;
  progressBar.increment();
}

async function collectFiles(dir, config, list = []) {
  const items = await fs.readdir(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);

    const relative = path.relative(config.targetBase, fullPath);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) continue;

    const statsFs = await fs.stat(fullPath);

    if (statsFs.isDirectory()) {
      await collectFiles(fullPath, config, list);
    } else {
      list.push(fullPath);
    }
  }

  return list;
}

// ---------- ENTRY ----------

async function main() {
  try {
    const config = await getUserInput();

    console.log('\nScanning files...');
    const files = await collectFiles(config.sourceDir, config);
    stats.total = files.length;

    console.log(`Found ${stats.total} files\n`);

    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% | {value}/{total} | moved:{moved} copied:{copied} errors:{errors}',
    }, cliProgress.Presets.shades_classic);

    progressBar.start(stats.total, 0, {
      moved: 0,
      copied: 0,
      errors: 0
    });

    await Promise.all(files.map(file =>
      limit(() => handleFile(file, config, progressBar).then(() => {
        progressBar.update(stats.processed, {
          moved: stats.moved,
          copied: stats.copied,
          errors: stats.errors
        });
      }))
    ));

    progressBar.stop();

    console.log('\n=== RESULT ===');
    console.log(`Total files: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Moved: ${stats.moved}`);
    console.log(`Copied: ${stats.copied}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`EXIF fallback used: ${stats.exifFallback}`);

  } catch (err) {
    console.error('Critical error:', err);
  } finally {
    exiftool.end();
    rl.close();
  }
}

main();
