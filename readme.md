# 📸 Photo Archive Organizer

A smart tool for automatically sorting photos and videos by creation date into `YYYY-MM` folder structure.

## 🚀 Features

- **Recursive directory processing**.
- **Date detection** from EXIF data (DateTimeOriginal, CreateDate, CreationDate) with fallback to mtime.
- **Automatic renaming** only when file names conflict.
- **Limited parallelization** (suitable for large archives).
- **Support for various photo and video formats**.
- **Error handling** with retries and logging.

## 📁 Supported Formats

### Images
- `.jpg`, `.jpeg`, `.png`
- `.heic`, `.heif`
- `.webp`, `.tiff`, `.tif`

### RAW photos
- `.cr2`, `.cr3`, `.nef`, `.arw`
- `.dng`, `.rw2`, `.orf`

### Video
- `.mp4`, `.mov`
- `.avi`, `.mkv`
- `.3gp`, `.mts`, `.m2ts`
- `.wmv`

Format is case-insensitive.

## ⚙️ Installation

```bash
git clone git@github.com:nicothin/organizer.git
cd SOME_DIRECTORY

npm install
```

## ▶️ Usage

```bash
npm start
```

### Path Configuration

Before running the script, it will ask you for:
1. Source directory path.
2. Target directory path.
3. Move or copy files.

## 📦 How It Works

1. The script recursively walks through all files in the source directory.
2. For each file:
   - Extracts date from EXIF data.
   - If EXIF is not available — uses file modification date (mtime).
3. Determines the target folder in `YYYY-MM` format.
4. Moves or copies the file to the target folder.
5. When file name conflicts occur, automatically adds a date suffix.

## 🏷 File Renaming

Renaming occurs **only when there is a name conflict** in the target folder.

Example:
- `IMG_1234.jpg` → `IMG_1234-2023-07-21-14-32.jpg`

## ⚡ Performance

- Uses limited parallelization (`p-limit`).
- Suitable for large archives (100+ GB).
- Optimal number of parallel operations: 3–10.

## 🛠 Requirements

- Node.js (version 14 or higher)

## 📄 License

MIT
