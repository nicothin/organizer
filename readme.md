# 📸 Photo Archive Organizer

Script for sorting photos and videos by capture date (EXIF) into `YYYY-MM` structure.

---

## 🚀 Features

- Recursive directory traversal
- Date detection:
  - EXIF (`DateTimeOriginal`, `CreateDate`, `CreationDate`)
  - fallback → `mtime`
- Sorting into folders: `photoarchive/YYYY-MM/`
- Renaming **only when there's a name conflict**
- Limited parallelism (suitable for large archives)

---

## 📁 Supported Formats

### Images
- `.jpg`, `.jpeg`, `.png`
- `.heic`, `.heif`
- `.webp`, `.tiff`, `.tif`

### RAW
- `.cr2`, `.cr3`, `.nef`, `.arw`
- `.dng`, `.rw2`, `.orf`

### Video
- `.mp4`, `.mov`
- `.avi`, `.mkv`
- `.3gp`, `.mts`, `.m2ts`
- `.wmv`

File extensions are case-insensitive (`.JPG` = `.jpg`)

---

## ⚙️ Installation

```bash
npm install
```

---

## ▶️ Usage

Specify paths in the file:

```js
const SOURCE_DIR = '/path/to/source';
const TARGET_BASE = '/path/to/photoarchive';
```

Run:

```bash
npm run
```

---

## 📦 How It Works

1. The script goes through all files in `SOURCE_DIR`
2. For each file:
   - gets date from EXIF
   - if not available → uses `mtime`
3. Determines destination folder: `YYYY-MM`
4. Moves the file

---

## 🏷 Renaming

Renaming occurs **only if the file already exists** in the target folder.

Example: `IMG_1234.jpg → IMG_1234-2023-07-21-14-32.jpg`

---

## ⚠️ Important

- Files are **moved**, not copied
- Original folder structure is not preserved
- Recommended:
  - test on a small sample
  - or make a backup

---

## ⚡ Performance

- Uses limited parallelism (`p-limit`)
- Recommended for large archives (100–300+ GB)
- Don't increase concurrency too much (optimal: 3–10)

---

## License

MIT
