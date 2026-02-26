# Kidplan Album Downloader

Desktop app for bulk downloading photo albums from Kidplan.

Built with [Tauri 2](https://tauri.app/) (Rust backend) + React + TypeScript.

## Requirements

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) toolchain

## Development

```
npm install
npm run tauri dev
```

## Build

```
npm run tauri build
```

The built app will be at `src-tauri/target/release/bundle/`.

## CLI (legacy)

The original Python CLI script is still available on the `main` branch. See `kidplan_bulk_download.py`.

## How it works

1. Log in with your Kidplan email and password
2. Select which albums to download
3. Adjust settings (output directory, rate limiting, per-album limits)
4. Download - progress is shown in real time

Downloaded images are tracked in `kidplan-manifest.txt` to avoid re-downloading on subsequent runs.
