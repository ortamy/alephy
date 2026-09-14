#!/bin/bash
# ALEPHY Website Build Script
# Собирает сайт из src/ и корня в build/
# Запуск: bash tools/build.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"

echo "=== ALEPHY Website Build ==="
echo "Root: $ROOT_DIR"
echo "Build: $BUILD_DIR"

# 1. Очистка build/
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 2. Копирование корневых файлов
echo "[1/8] Copying root files..."
cp "$ROOT_DIR/index.html" "$BUILD_DIR/"
cp "$ROOT_DIR/app.js" "$BUILD_DIR/"
cp "$ROOT_DIR/favicon.svg" "$BUILD_DIR/"
cp "$ROOT_DIR/robots.txt" "$BUILD_DIR/"
cp "$ROOT_DIR/sitemap.xml" "$BUILD_DIR/"
cp "$ROOT_DIR/files.json" "$BUILD_DIR/" 2>/dev/null || true

# 2.1. Копирование css/ (lean-CSS лендинга)
cp -r "$ROOT_DIR/css" "$BUILD_DIR/css"

# 3. Копирование src/js/
echo "[2/8] Copying js/..."
cp -r "$ROOT_DIR/src/js" "$BUILD_DIR/js"

# 4. Копирование src/locales/
echo "[3/8] Copying locales/..."
cp -r "$ROOT_DIR/src/locales" "$BUILD_DIR/locales"

# 5. Копирование apps/researchlab/
echo "[4/8] Copying researchlab/..."
mkdir -p "$BUILD_DIR/apps"
cp -r "$ROOT_DIR/apps/researchlab" "$BUILD_DIR/apps/researchlab"

# 6. Копирование tools/
echo "[5/8] Copying tools/..."
cp -r "$ROOT_DIR/tools" "$BUILD_DIR/tools"

# 7. Копирование docs/
echo "[6/8] Copying docs/..."
mkdir -p "$BUILD_DIR/docs"
cp -r "$ROOT_DIR/docs/STRUCTURE.md" "$BUILD_DIR/docs/" 2>/dev/null || true

# 8. Копирование src/ и корневых ассетов (контент, страницы, данные, ассеты, стили)
echo "[7/8] Copying src/..."
cp -r "$ROOT_DIR/src/content" "$BUILD_DIR/content"
cp -r "$ROOT_DIR/src/pages" "$BUILD_DIR/pages"
cp -r "$ROOT_DIR/src/data" "$BUILD_DIR/data"
cp -r "$ROOT_DIR/assets" "$BUILD_DIR/assets"
mkdir -p "$BUILD_DIR/src/styles"
cp "$ROOT_DIR/src/styles/input.css" "$BUILD_DIR/src/styles/input.css"

# 9. Копирование config/ в build/ для сборки
echo "[8/8] Copying config and building CSS..."
cp -r "$ROOT_DIR/config" "$BUILD_DIR/config"
cp "$ROOT_DIR/package.json" "$BUILD_DIR/"
cp "$ROOT_DIR/package-lock.json" "$BUILD_DIR/" 2>/dev/null || true

cd "$BUILD_DIR"
npm install
npm run build

# GitHub Pages needs a root entrypoint in the artifact.
cp "$ROOT_DIR/index.html" "$BUILD_DIR/index.html"

echo "=== Build complete: $BUILD_DIR ==="