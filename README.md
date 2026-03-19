# PyArsenal

Personal tool distribution & update launcher — like Steam for your own tools.

Browse, install, update, and launch your personal tools from a single app. Tools are published as GitHub Releases and discovered via a centralized catalog.

## Features

- **Store** — Browse all available tools with search and category filters
- **Library** — Manage installed tools, launch them, check for updates
- **Auto-update check** — Compares installed versions against GitHub Releases on startup
- **Download & install** — Downloads the correct binary for your platform automatically
- **Bug report** — Opens the tool's GitHub Issues page directly from the app
- **Desktop integration** — Add the AppImage to your Linux application menu
- **Settings** — Optional GitHub PAT for higher API rate limits, stored in system keychain
- **Self-update** — The launcher updates itself via GitHub Releases

## Screenshots

*Coming soon*

## Stack

| Component | Technology |
|-----------|-----------|
| Framework | [Tauri v2](https://tauri.app/) (Rust) |
| Frontend | [SolidJS](https://www.solidjs.com/) + TypeScript |
| Styling | Custom CSS (Steam-inspired dark theme) |
| Packaging | AppImage, .deb, .rpm (Linux) / .msi, .exe (Windows) |
| Auto-update | tauri-plugin-updater |
| Keychain | system keyring (GNOME Keyring / Windows Credential Manager) |

## How it works

1. A [centralized catalog](https://github.com/Alexys829/pyarsenal-catalog) lists all available tools as a JSON file
2. Each tool publishes compiled binaries via GitHub Releases following the naming convention:
   ```
   ToolName-{version}-linux-x86_64.AppImage
   ToolName-{version}-windows-x86_64.exe
   ```
3. PyArsenal fetches the catalog, shows available tools, and handles download/install/update

## Build from source

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 20+
- Linux: `libwebkit2gtk-4.1-dev`, `librsvg2-dev`, `libgtk-3-dev`, `libssl-dev`, `pkg-config`

### Build

```bash
# Linux
./build_linux.sh

# Windows
build_windows.bat
```

Or manually:

```bash
npm install
npm run tauri build
```

Output:
- Linux: `src-tauri/target/release/bundle/appimage/PyArsenal_*.AppImage`
- Windows: `src-tauri/target/release/bundle/nsis/PyArsenal_*.exe`

### Development

```bash
npm install
npm run tauri dev
```

## Catalog

Tools are listed in [pyarsenal-catalog](https://github.com/Alexys829/pyarsenal-catalog). To add a tool, add an entry to `catalog.json`:

```json
{
  "id": "my-tool",
  "name": "My Tool",
  "description": "What it does.",
  "category": "Utilities",
  "icon": "my-tool.png",
  "repo": "username/my-tool",
  "platforms": ["linux", "windows"],
  "asset_patterns": {
    "linux": "MyTool-{version}-linux-x86_64.AppImage",
    "windows": "MyTool-{version}-windows-x86_64.exe"
  },
  "binary_name": {
    "linux": "MyTool.AppImage",
    "windows": "MyTool.exe"
  }
}
```

## License

MIT
