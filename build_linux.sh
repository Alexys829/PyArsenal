#!/bin/bash
set -e

echo "=== PyArsenal - Linux Build ==="
echo ""

# Check prerequisites
if ! command -v rustc &> /dev/null; then
    echo "Error: Rust not found. Install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "Error: Node.js not found. Install via nvm or your package manager."
    exit 1
fi

echo "Rust:  $(rustc --version)"
echo "Node:  $(node --version)"
echo "npm:   $(npm --version)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm ci
    echo ""
fi

# Build
echo "Building PyArsenal (this may take a few minutes on first build)..."
npm run tauri build

echo ""
echo "=== Build complete! ==="
echo ""
echo "Output files:"

# List generated bundles
ls -lh src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null
ls -lh src-tauri/target/release/bundle/deb/*.deb 2>/dev/null
ls -lh src-tauri/target/release/bundle/rpm/*.rpm 2>/dev/null

echo ""
echo "AppImage: src-tauri/target/release/bundle/appimage/"
echo "Deb:      src-tauri/target/release/bundle/deb/"
echo "RPM:      src-tauri/target/release/bundle/rpm/"
